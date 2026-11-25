import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { ArrowUp, Square, Paperclip, X, Globe, Plus, Trash2, FileText, Copy, Archive, ScrollText, Brain, ChevronDown, Loader2, MessagesSquare, Settings } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import SafeMarkdown from "@/components/SafeMarkdown";
import { sb, useAuth, useSettings } from "@/lib/supabase";
import { streamCompletion, splitThink, webSearch, complete, sanitizeInput } from "@/lib/llm";
import { extractText, ACCEPTED } from "@/lib/files";
import { timeAgo } from "@/lib/api";

const DEFAULT_ROLE = "Sei Furge, un assistente IA personale e privato. Rispondi in italiano, in modo chiaro, preciso e onesto, usando markdown.";
const must = ({ data, error }) => { if (error) throw new Error(error.message); return data; };

function attachmentsContext(atts) {
  return (atts || []).filter((a) => a.text).map((a) => `--- FILE ALLEGATO: ${a.name} ---\n${a.text}\n--- FINE FILE ---`).join("\n\n");
}

function Thinking({ text, live }) {
  const [open, setOpen] = useState(false);
  if (!text) return null;
  return (
    <div className="mb-2 rounded-lg border border-border bg-[hsl(220_14%_6%)]" data-testid="chat-thinking">
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-muted-foreground">
        <Brain className={`h-3.5 w-3.5 ${live ? "animate-pulse text-primary" : ""}`} />{live ? "Sta ragionando…" : "Ragionamento"}<ChevronDown className={`ml-auto h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && <pre className="max-h-64 overflow-auto whitespace-pre-wrap border-t border-border px-3 py-2 font-mono text-[11px] text-muted-foreground">{text}</pre>}
    </div>
  );
}

function Sources({ sources }) {
  if (!sources?.length) return null;
  return (
    <div className="mt-3 border-t border-border pt-2" data-testid="chat-sources">
      <p className="mb-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Fonti</p>
      <ol className="space-y-1">
        {sources.map((s, i) => {
          let host = ""; try { host = new URL(s.url).hostname.replace(/^www\./, ""); } catch {}
          return (
            <li key={i} className="text-xs"><a href={/^https?:/i.test(s.url) ? s.url : "#"} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex gap-1.5 hover:text-primary">
              <span className="font-mono text-primary">[{i + 1}]</span><span className="line-clamp-1">{s.title || host}</span><span className="text-muted-foreground">{host}</span></a></li>
          );
        })}
      </ol>
    </div>
  );
}

export default function ChatPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { getToken } = useAuth();
  const { settings, configured } = useSettings();
  const [chats, setChats] = useState([]);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [files, setFiles] = useState([]);
  const [reading, setReading] = useState(false);
  const [search, setSearch] = useState(() => localStorage.getItem("furge-search") === "1");
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState("");
  const [live, setLive] = useState({ think: "", answer: "", sources: [] });
  const [showList, setShowList] = useState(false);
  const [summarizing, setSummarizing] = useState(false);
  const abortRef = useRef(null);
  const endRef = useRef(null);
  const fileRef = useRef(null);
  const skipLoad = useRef(false);

  const loadChats = async () => { try { setChats(must(await sb().from("chats").select("*").order("updated_at", { ascending: false }).limit(200))); } catch (e) { toast.error(e.message); } };
  useEffect(() => { loadChats(); }, []);
  useEffect(() => {
    if (skipLoad.current) { skipLoad.current = false; return; }
    if (!id) { setMessages([]); return; }
    sb().from("chat_messages").select("*").eq("chat_id", id).order("created_at").then(({ data, error }) => {
      if (error) { toast.error(error.message); navigate("/chat", { replace: true }); } else setMessages(data);
    });
    setShowList(false);
  }, [id, navigate]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [messages.length, live.answer, live.think, phase]);
  useEffect(() => { localStorage.setItem("furge-search", search ? "1" : "0"); }, [search]);

  const pickFiles = async (e) => {
    const list = [...(e.target.files || [])]; e.target.value = "";
    if (!list.length) return;
    setReading(true);
    for (const f of list.slice(0, 5)) {
      try { const r = await extractText(f); setFiles((fs) => [...fs, r]); if (r.truncated) toast.message(`${f.name}: testo troncato a 120.000 caratteri`); }
      catch (err) { toast.error(err.message || `Impossibile leggere ${f.name}`); }
    }
    setReading(false);
  };

  const send = async () => {
    const msg = sanitizeInput(text.trim(), 20000);
    if ((!msg && !files.length) || busy) return;
    if (!configured) { toast.error("Configura prima il modello nelle Impostazioni"); return; }
    const content = msg || "Analizza i file allegati.";
    const atts = files;
    setText(""); setFiles([]); setBusy(true); setLive({ think: "", answer: "", sources: [] });
    const ctrl = new AbortController(); abortRef.current = ctrl;
    let chatId = id;
    let raw = "", think = "", sources = [];
    try {
      if (!chatId) {
        const c = must(await sb().from("chats").insert({ title: content.slice(0, 60) }).select("*").single());
        chatId = c.id; skipLoad.current = true; navigate(`/chat/${c.id}`, { replace: true });
      }
      const userRow = must(await sb().from("chat_messages").insert({ chat_id: chatId, role: "user", content, attachments: atts.map((a) => ({ name: a.name, pages: a.pages, chars: a.chars, text: a.text })) }).select("*").single());
      const history = [...messages];
      setMessages((m) => [...m, userRow]);

      let searchCtx = "";
      if (search) {
        setPhase("Cerco sul web…");
        try {
          const r = await webSearch(settings, content, getToken);
          sources = r.results.map(({ title, url }) => ({ title, url }));
          setLive((l) => ({ ...l, sources }));
          searchCtx = "RISULTATI DELLA RICERCA WEB (usa queste informazioni aggiornate e cita le fonti con [n]):\n" + (r.answer ? `Sintesi: ${r.answer}\n\n` : "") + r.results.map((x, i) => `[${i + 1}] ${x.title} — ${x.url}\n${x.content}`).join("\n\n");
          await sb().from("archive_items").insert({ kind: "ricerca", title: content.slice(0, 120), chat_id: chatId,
            content: (r.answer ? `**Sintesi:** ${r.answer}\n\n` : "") + r.results.map((x, i) => `### [${i + 1}] ${x.title}\n${x.url}\n\n${x.content.slice(0, 600)}`).join("\n\n"), sources });
        } catch (e2) { toast.error(e2.message); }
      }
      setPhase("Sto scrivendo…");
      const system = `${settings.system_prompt?.trim() || DEFAULT_ROLE}\n\nData di oggi: ${new Date().toLocaleDateString("it-IT", { dateStyle: "full" })}.${searchCtx ? " Quando usi la ricerca web cita le fonti nel testo con [1], [2]…" : ""}`;
      const convo = history.slice(-20).map((m) => ({ role: m.role, content: (m.attachments?.length ? attachmentsContext(m.attachments).slice(0, 30000) + "\n\n" : "") + m.content }));
      const current = [attachmentsContext(atts), searchCtx, `DOMANDA:\n${content}`].filter(Boolean).join("\n\n");
      for await (const ev of streamCompletion(settings, [{ role: "system", content: system }, ...convo, { role: "user", content: current }], { signal: ctrl.signal, getToken })) {
        if (ev.type === "think") think += ev.text; else raw += ev.text;
        const s = splitThink(raw);
        setLive({ think: (think + (s.think ? `\n${s.think}` : "")).trim(), answer: s.answer, sources, thinking: s.thinking || (!!think && !s.answer) });
      }
      const answer = splitThink(raw).answer.trim() || "(nessuna risposta)";
      const a = must(await sb().from("chat_messages").insert({ chat_id: chatId, role: "assistant", content: answer, sources }).select("*").single());
      setMessages((m) => [...m, a]);
      await sb().from("chats").update({ updated_at: new Date().toISOString() }).eq("id", chatId);
    } catch (e) {
      if (e.name === "AbortError") {
        const partial = splitThink(raw).answer.trim();
        if (partial && chatId) { const a = (await sb().from("chat_messages").insert({ chat_id: chatId, role: "assistant", content: partial + "\n\n_(interrotto)_", sources }).select("*").single()).data; if (a) setMessages((m) => [...m, a]); }
      } else {
        setMessages((m) => [...m, { id: `err-${Date.now()}`, role: "assistant", content: e.message, error: true }]);
      }
    } finally {
      setBusy(false); setPhase(""); setLive({ think: "", answer: "", sources: [] }); abortRef.current = null; loadChats();
    }
  };

  const archive = async (m) => {
    const q = messages[messages.findIndex((x) => x.id === m.id) - 1];
    const { error } = await sb().from("archive_items").insert({ kind: "report", title: (q?.content || m.content).slice(0, 120), content: m.content, sources: m.sources || [], chat_id: id || null });
    error ? toast.error(error.message) : toast.success("Salvato nell'Archivio");
  };

  const summarize = async () => {
    if (!messages.length || summarizing) return;
    setSummarizing(true);
    try {
      const transcript = messages.filter((m) => !m.error).map((m) => `${m.role === "user" ? "Utente" : "Furge"}: ${m.content}`).join("\n\n").slice(-60000);
      const out = await complete(settings, [{ role: "system", content: "Riassumi la conversazione in italiano, in markdown: punti chiave, decisioni, informazioni utili e prossimi passi. Massimo 300 parole." }, { role: "user", content: transcript }], { getToken, maxTokens: 3000 });
      const title = chats.find((c) => c.id === id)?.title || "Chat";
      must(await sb().from("archive_items").insert({ kind: "riassunto", title: `Riassunto: ${title}`.slice(0, 120), content: out.trim(), chat_id: id }));
      toast.success("Riassunto salvato nell'Archivio");
    } catch (e) { toast.error(e.message); }
    finally { setSummarizing(false); }
  };

  const removeChat = async (cid) => {
    const { error } = await sb().from("chats").delete().eq("id", cid);
    if (error) return toast.error(error.message);
    toast.success("Chat eliminata"); loadChats(); if (cid === id) navigate("/chat");
  };

  const current = chats.find((c) => c.id === id);
  const list = (
    <div className="space-y-1" data-testid="chat-list">
      <Button variant="secondary" className="mb-2 w-full" onClick={() => navigate("/chat")} data-testid="chat-new-button"><Plus className="h-4 w-4 mr-1.5" />Nuova chat</Button>
      {chats.map((c) => (
        <div key={c.id} onClick={() => navigate(`/chat/${c.id}`)} className={`group flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-sm ${c.id === id ? "bg-secondary" : "hover:bg-secondary/60"}`} data-testid="chat-list-item">
          <span className="min-w-0 flex-1"><span className="block truncate">{c.title}</span><span className="block font-mono text-[10px] text-muted-foreground">{timeAgo(c.updated_at)}</span></span>
          <button onClick={(e) => { e.stopPropagation(); removeChat(c.id); }} className="text-muted-foreground opacity-60 hover:text-[hsl(0_72%_60%)] lg:opacity-0 lg:group-hover:opacity-100" data-testid="chat-delete-button"><Trash2 className="h-3.5 w-3.5" /></button>
        </div>
      ))}
      {!chats.length && <p className="px-2 text-xs text-muted-foreground">Nessuna chat salvata.</p>}
    </div>
  );

  return (
    <div className="flex h-full">
      <aside className="hidden xl:block w-64 shrink-0 overflow-y-auto forge-scroll border-r border-border p-3">{list}</aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex h-12 shrink-0 items-center gap-2 border-b border-border px-3 sm:px-5">
          <button onClick={() => setShowList((s) => !s)} className="xl:hidden rounded-md p-1.5 text-muted-foreground hover:bg-secondary" data-testid="chat-list-toggle"><MessagesSquare className="h-4 w-4" /></button>
          <p className="min-w-0 flex-1 truncate text-sm font-medium" data-testid="chat-title">{current?.title || "Nuova chat"}</p>
          {id && <Button variant="ghost" size="sm" className="h-8" onClick={summarize} disabled={summarizing || busy || !messages.length} data-testid="chat-summarize-button">{summarizing ? <Loader2 className="h-4 w-4 animate-spin sm:mr-1.5" /> : <ScrollText className="h-4 w-4 sm:mr-1.5" />}<span className="hidden sm:inline">Riassumi</span></Button>}
        </div>
        {showList && <div className="xl:hidden max-h-[50vh] overflow-y-auto forge-scroll border-b border-border bg-[hsl(var(--panel))] p-3">{list}</div>}

        <div className="flex-1 overflow-y-auto forge-scroll">
          <div className="mx-auto max-w-3xl space-y-4 px-4 py-6" data-testid="chat-messages">
            {!configured && (
              <div className="rounded-xl border border-[hsl(38_60%_30%)] bg-[hsl(38_40%_9%)] p-4 text-sm" data-testid="chat-not-configured">
                Collega il tuo modello (Ollama o compatibile OpenAI) per iniziare. <Link to="/impostazioni" className="text-primary underline"><Settings className="inline h-3.5 w-3.5" /> Impostazioni</Link>
              </div>
            )}
            {!messages.length && !busy && (
              <div className="pt-12 text-center" data-testid="chat-empty-state">
                <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight">Ciao, sono Furge.</h1>
                <p className="mt-2 text-muted-foreground">Chiedimi qualsiasi cosa, allega PDF o testi, attiva la Ricerca Web per notizie aggiornate.</p>
              </div>
            )}
            {messages.map((m) => m.role === "user" ? (
              <div key={m.id} className="flex justify-end">
                <div className="max-w-[88%] rounded-xl border border-border/60 bg-secondary/70 p-3 text-sm whitespace-pre-wrap" data-testid="chat-user-message">
                  {m.attachments?.length > 0 && <div className="mb-2 flex flex-wrap gap-1">{m.attachments.map((a, i) => <span key={i} className="inline-flex items-center gap-1 rounded-md bg-background px-2 py-0.5 font-mono text-[10px] text-muted-foreground"><FileText className="h-3 w-3" />{a.name}</span>)}</div>}
                  {m.content}
                </div>
              </div>
            ) : (
              <div key={m.id} className={`group rounded-xl border p-4 text-sm ${m.error ? "border-[hsl(0_50%_30%)] bg-[hsl(0_40%_10%)]" : "border-border bg-card"}`} data-testid="chat-assistant-message">
                <div className="forge-md leading-relaxed text-[hsl(210_20%_90%)]"><SafeMarkdown>{m.content}</SafeMarkdown></div>
                <Sources sources={m.sources} />
                {!m.error && (
                  <div className="mt-2 flex gap-1">
                    <Button variant="ghost" size="sm" className="h-7 px-2 text-[11px]" onClick={() => navigator.clipboard.writeText(m.content).then(() => toast.success("Copiato"))} data-testid="chat-copy-button"><Copy className="h-3.5 w-3.5 mr-1" />Copia</Button>
                    <Button variant="ghost" size="sm" className="h-7 px-2 text-[11px]" onClick={() => archive(m)} data-testid="chat-archive-button"><Archive className="h-3.5 w-3.5 mr-1" />Archivia</Button>
                  </div>
                )}
              </div>
            ))}
            {busy && (
              <div className="rounded-xl border border-primary/30 bg-card p-4 text-sm" data-testid="chat-streaming">
                <Thinking text={live.think} live={live.thinking} />
                {live.answer ? <div className="forge-md text-[hsl(210_20%_90%)]"><SafeMarkdown>{live.answer}</SafeMarkdown></div> : <p className="forge-caret text-muted-foreground">{phase}</p>}
                <Sources sources={live.sources} />
              </div>
            )}
            <div ref={endRef} />
          </div>
        </div>

        <div className="shrink-0 border-t border-border p-3">
          <div className="mx-auto max-w-3xl rounded-xl border border-border bg-card focus-within:border-primary/60 transition-colors">
            {(files.length > 0 || reading) && (
              <div className="flex flex-wrap gap-1.5 px-3 pt-3">
                {files.map((f, i) => (
                  <span key={i} className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-2 py-1 text-[11px]" data-testid="chat-file-chip">
                    <FileText className="h-3.5 w-3.5 text-primary" />{f.name}<span className="font-mono text-muted-foreground">{f.pages ? `${f.pages} pag • ` : ""}{Math.round(f.chars / 1000)}k car</span>
                    <button onClick={() => setFiles((fs) => fs.filter((_, j) => j !== i))} data-testid="chat-file-remove"><X className="h-3 w-3" /></button>
                  </span>
                ))}
                {reading && <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" />Leggo il file…</span>}
              </div>
            )}
            <Textarea value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && window.innerWidth > 768) { e.preventDefault(); send(); } }}
              placeholder="Scrivi a Furge…" className="min-h-[60px] max-h-48 resize-none border-0 bg-transparent text-sm focus-visible:ring-0 focus-visible:ring-offset-0" data-testid="chat-input" />
            <div className="flex items-center gap-2 px-2 pb-2">
              <input ref={fileRef} type="file" multiple accept={ACCEPTED} className="hidden" onChange={pickFiles} data-testid="chat-file-input" />
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => fileRef.current?.click()} disabled={busy || reading} title="Allega PDF o file di testo" data-testid="chat-attach-button"><Paperclip className="h-4 w-4" /></Button>
              <label className={`inline-flex h-8 cursor-pointer items-center gap-2 rounded-lg border px-2.5 text-xs transition-colors ${search ? "border-primary/60 bg-[hsl(190_50%_10%)] text-foreground" : "border-border text-muted-foreground"}`} data-testid="chat-search-toggle">
                <Globe className={`h-3.5 w-3.5 ${search ? "text-primary" : ""}`} />Ricerca Web<Switch checked={search} onCheckedChange={setSearch} className="scale-75" data-testid="chat-search-switch" />
              </label>
              {busy ? <Button size="sm" variant="secondary" className="ml-auto h-8" onClick={() => abortRef.current?.abort()} data-testid="chat-stop-button"><Square className="h-3.5 w-3.5 mr-1.5 fill-current" />Ferma</Button>
                : <Button size="icon" className="ml-auto h-8 w-8" onClick={send} disabled={(!text.trim() && !files.length) || reading} data-testid="chat-send-button"><ArrowUp className="h-4 w-4" /></Button>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
