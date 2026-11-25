import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useParams, Link } from "react-router-dom";
import { ArrowLeft, Download, Loader2, Check, MessageSquare, Eye, Code2, History } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import Logo from "@/components/Logo";
import { useAuth, useSettings } from "@/lib/supabase";
import { runBuilderChat } from "@/lib/builder";
import { useAgent } from "@/components/AgentPicker";
import ChatPanel, { splitStream } from "@/components/workspace/ChatPanel";
import PreviewPanel from "@/components/workspace/PreviewPanel";
import CodePanel from "@/components/workspace/CodePanel";
import VersionsPanel from "@/components/workspace/VersionsPanel";
import { useApi, errMsg } from "@/lib/api";

function useIsDesktop() {
  const q = "(min-width: 1024px)";
  const [m, setM] = useState(() => window.matchMedia(q).matches);
  useEffect(() => { const mq = window.matchMedia(q); const h = () => setM(mq.matches); mq.addEventListener("change", h); return () => mq.removeEventListener("change", h); }, []);
  return m;
}

const MAIN_TABS = [
  { id: "preview", label: "Anteprima", short: "Vista", icon: Eye },
  { id: "code", label: "Codice", icon: Code2 },
  { id: "versions", label: "Versioni", short: "Storia", icon: History },
];

function TabBar({ tabs, value, onChange, versionsCount }) {
  return (
    <div className="flex h-11 shrink-0 items-center gap-0.5 sm:gap-1 border-b border-border px-1 sm:px-2 bg-[hsl(var(--panel))]" role="tablist">
      {tabs.map(({ id, label, short, icon: Icon }) => (
        <button key={id} role="tab" aria-selected={value === id} onClick={() => onChange(id)}
          className={`relative inline-flex h-11 flex-1 lg:flex-none justify-center items-center gap-1.5 px-1.5 sm:px-3 text-[13px] sm:text-sm transition-colors ${value === id ? "text-foreground" : "text-muted-foreground hover:text-foreground"}`}
          data-testid={`workspace-tab-${id}`}>
          <Icon className="hidden min-[400px]:block h-4 w-4 shrink-0" /><span className="sm:hidden">{short || label}</span><span className="hidden sm:inline">{label}</span>
          {id === "versions" && versionsCount > 0 && <span className="hidden sm:inline rounded bg-secondary px-1.5 font-mono text-[10px]">{versionsCount}</span>}
          {value === id && <span className="absolute inset-x-2 bottom-0 h-[2px] rounded bg-primary shadow-[0_0_10px_hsl(190_90%_45%/0.6)]" />}
        </button>
      ))}
    </div>
  );
}

export default function WorkspacePage() {
  const { id } = useParams();
  const api = useApi();
  const navigate = useNavigate();
  const location = useLocation();
  const isDesktop = useIsDesktop();
  const { settings, configured } = useSettings();
  const { getToken } = useAuth();
  const [streamModel, setStreamModel] = useState("");
  const [composer, setComposer] = useState("");
  const [streamSteps, setStreamSteps] = useState([]);
  const [agent] = useAgent();

  const [project, setProject] = useState(null);
  const [messages, setMessages] = useState([]);
  const [versions, setVersions] = useState([]);
  const [html, setHtml] = useState("");
  const [name, setName] = useState("");
  const [savedName, setSavedName] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [streamText, setStreamText] = useState("");
  const [tab, setTab] = useState("preview");
  const [mobileTab, setMobileTab] = useState("chat");
  const [viewing, setViewing] = useState(null);
  const [previewErrors, setPreviewErrors] = useState([]);
  const [downloading, setDownloading] = useState(false);
  const [visited, setVisited] = useState(["preview", "chat"]);
  const abortRef = useRef(null);
  const autoRan = useRef(false);

  const load = useCallback(async () => {
    try {
      const d = await api.get(`/projects/${id}`);
      setProject(d.project); setMessages(d.messages); setVersions(d.versions);
      setHtml(d.project.current_html || ""); setName(d.project.name);
      return d;
    } catch (e) {
      toast.error(errMsg(e)); navigate("/progetti", { replace: true });
    }
  }, [api, id, navigate]);

  const send = useCallback(async (text, image = null) => {
    if (generating) return;
    setViewing(null); setGenerating(true); setStreamText(""); setPreviewErrors([]); setStreamModel(settings?.model_name || ""); setStreamSteps([]);
    const tempId = `tmp-${Date.now()}`;
    setMessages((m) => [...m, { id: tempId, role: "user", content: text, image_preview: image, created_at: new Date().toISOString() }]);
    if (!isDesktop) setMobileTab("chat");
    const ctrl = new AbortController(); abortRef.current = ctrl;
    let full = "";
    try {
      if (!configured) throw new Error("Configura URL endpoint e nome modello nelle Impostazioni");
      for await (const ev of runBuilderChat({ project: { ...project, current_html: html }, history: messages.filter((m) => !String(m.id).startsWith("tmp-")).map(({ role, content }) => ({ role, content })),
        message: text, image, agent, settings, getToken, signal: ctrl.signal })) {
        {
          if (ev.type === "start") setMessages((m) => m.map((x) => (x.id === tempId ? { ...ev.user_message, image_preview: image } : x)));
          else if (ev.type === "delta") { full += ev.text; setStreamText(full); }
          else if (ev.type === "step_start") setStreamSteps((st) => [...st, { role: ev.role, title: ev.title, content: "", done: false }]);
          else if (ev.type === "step_delta") setStreamSteps((st) => st.map((x, i) => (i === st.length - 1 ? { ...x, content: x.content + ev.text } : x)));
          else if (ev.type === "step_done") setStreamSteps((st) => st.map((x, i) => (i === st.length - 1 ? { ...x, content: ev.content, done: true } : x)));
          else if (ev.type === "model") { setStreamModel(ev.label); if (ev.fallback) toast.message(`Il modello scelto non ha risposto: uso ${ev.label}`); }
          else if (ev.type === "error") { setMessages((m) => [...m, ev.message]); toast.error("Generazione non riuscita"); }
          else if (ev.type === "done") {
            setMessages((m) => [...m, ev.message]);
            if (ev.version && ev.html) {
              setVersions((v) => [ev.version, ...v]); setHtml(ev.html);
              setProject((p) => ({ ...p, current_version: ev.version.number }));
              if (!isDesktop) setMobileTab("preview"); else setTab("preview");
              toast.success(`Versione v${ev.version.number} pronta`);
            }
          }
        }
      }
    } catch (e) {
      if (e.name === "AbortError") {
        setMessages((m) => [...m, { id: `stop-${Date.now()}`, role: "assistant", content: "Generazione interrotta. Nessuna versione salvata.", created_at: new Date().toISOString() }]);
      } else {
        setMessages((m) => [...m, { id: `err-${Date.now()}`, role: "assistant", error: true, content: `Errore: ${e.message}`, created_at: new Date().toISOString() }]);
        toast.error(e.message);
      }
    } finally {
      setGenerating(false); setStreamText(""); setStreamSteps([]); abortRef.current = null;
    }
  }, [generating, isDesktop, settings, configured, agent, project, messages, getToken, html]);

  useEffect(() => {
    (async () => {
      const d = await load();
      const auto = location.state?.autoPrompt;
      if (d && auto && !autoRan.current && d.messages.length === 0) {
        autoRan.current = true;
        navigate(location.pathname, { replace: true, state: null });
        send(auto);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => () => abortRef.current?.abort(), []);
  useEffect(() => {
    const k = isDesktop ? tab : mobileTab;
    setVisited((v) => (v.includes(k) ? v : [...v, k]));
  }, [tab, mobileTab, isDesktop]);

  const rename = async () => {
    const n = name.trim();
    if (!n || n === project?.name) { setName(project?.name || ""); return; }
    try { await api.patch(`/projects/${id}`, { name: n }); setProject((p) => ({ ...p, name: n })); setSavedName(true); toast.success("Nome aggiornato"); }
    catch (e) { toast.error(errMsg(e)); }
  };

  const view = async (number) => {
    try {
      const v = await api.get(`/projects/${id}/versions/${number}`);
      setViewing({ number, html: v.html });
      if (!isDesktop) setMobileTab("preview"); else if (tab === "versions") setTab("preview");
    } catch (e) { toast.error(errMsg(e)); }
  };

  const restore = async (number) => {
    try {
      const v = await api.post(`/projects/${id}/versions/${number}/restore`);
      const full = await api.get(`/projects/${id}/versions/${v.number}`);
      setVersions((vs) => [v, ...vs]); setHtml(full.html); setViewing(null);
      setProject((p) => ({ ...p, current_version: v.number }));
      toast.success(`Ripristinata la v${number} come v${v.number}`);
    } catch (e) { toast.error(errMsg(e)); }
  };

  const saveCode = async (code) => {
    try {
      const v = await api.post(`/projects/${id}/versions`, { html: code, label: "Modifica manuale del codice" });
      setVersions((vs) => [v, ...vs]); setHtml(code);
      setProject((p) => ({ ...p, current_version: v.number }));
      toast.success(`Salvata come v${v.number}`);
    } catch (e) { toast.error(errMsg(e)); }
  };

  const download = async () => {
    setDownloading(true);
    try { await api.download(id, project?.name); toast.success("Download avviato"); }
    catch (e) { toast.error(html ? errMsg(e) : "Il progetto non ha ancora codice"); }
    finally { setDownloading(false); }
  };

  const fixErrors = () => send(`Nell'anteprima ci sono questi errori JavaScript, correggili mantenendo tutto il resto invariato:\n${previewErrors.slice(0, 8).map((e) => `- ${e}`).join("\n")}`);

  if (!project) {
    return <div className="h-screen grid place-items-center" data-testid="workspace-loading"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  const streamingCode = generating && streamText ? splitStream(streamText).code : null;
  const shownHtml = viewing ? viewing.html : html;
  const current = project.current_version;

  const chat = <ChatPanel streamSteps={streamSteps} text={composer} setText={setComposer} streamModel={streamModel} messages={messages} streamText={streamText} generating={generating} onSend={send} onStop={() => abortRef.current?.abort()}
    onRestore={restore} onView={view} currentVersion={current} previewErrors={previewErrors} onFixErrors={fixErrors} />;
  const preview = <PreviewPanel initialDevice={project.kind === "mobile" ? "mobile" : "desktop"} html={shownHtml} projectId={id} generating={generating} viewing={viewing?.number}
    onExitViewing={() => setViewing(null)} onRestoreViewing={() => restore(viewing.number)} onErrors={setPreviewErrors} />;
  const code = <CodePanel html={html} streamingCode={streamingCode} generating={generating} viewing={viewing} onSave={saveCode} />;
  const versionsEl = <VersionsPanel versions={versions} currentVersion={current} viewingNumber={viewing?.number} onView={view} onRestore={restore} generating={generating} />;
  const panels = { chat, preview, code, versions: versionsEl };
  const active = isDesktop ? tab : mobileTab;
  const keys = isDesktop ? ["preview", "code", "versions"] : ["chat", "preview", "code", "versions"];
  // Keep visited panels mounted (hidden) so the code editor and preview are not torn down on tab switch.
  const renderPanels = () => keys.filter((k) => k === active || visited.includes(k)).map((k) => (
    <div key={k} className={k === active ? "h-full" : "hidden"}>{panels[k]}</div>
  ));

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden" data-testid="workspace-page">
      <header className="relative z-40 flex h-14 shrink-0 items-center gap-2 border-b border-border bg-background px-2 sm:px-4">
        <Button asChild variant="ghost" size="icon" className="h-9 w-9 shrink-0" data-testid="workspace-back-button"><Link to="/progetti"><ArrowLeft className="h-4 w-4" /></Link></Button>
        <div className="hidden sm:block"><Logo size={24} /></div>
        <Input value={name} onChange={(e) => { setName(e.target.value); setSavedName(false); }} onBlur={rename}
          onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); if (e.key === "Escape") { setName(project.name); setSavedName(true); } }}
          className="h-9 min-w-0 max-w-[320px] flex-1 sm:flex-none sm:w-[300px] bg-transparent border-border/60 text-sm font-medium" data-testid="workspace-project-name-input" />
        {savedName && <span className="hidden md:inline-flex items-center gap-1 font-mono text-[11px] text-muted-foreground"><Check className="h-3 w-3 text-[hsl(155_70%_42%)]" />Salvato</span>}
        {current > 0 && <span className="hidden md:inline-flex rounded bg-secondary px-2 py-0.5 font-mono text-[11px]" data-testid="workspace-current-version">v{current}</span>}
        <div className="ml-auto flex items-center gap-2">
          <Button variant="secondary" size="sm" className="h-9" onClick={download} disabled={!html || downloading} data-testid="topbar-download-zip-button">
            {downloading ? <Loader2 className="h-4 w-4 animate-spin sm:mr-1.5" /> : <Download className="h-4 w-4 sm:mr-1.5" />}<span className="hidden sm:inline">Scarica</span>
          </Button>
          <span className="hidden md:inline-flex max-w-[180px] truncate rounded-lg border border-border bg-secondary/50 px-2.5 py-1 font-mono text-[11px]" data-testid="workspace-model-badge">{settings?.model_name || "nessun modello"}</span>
        </div>
        <div className="absolute inset-x-0 bottom-0 forge-hairline" />
      </header>

      {isDesktop ? (
        <ResizablePanelGroup direction="horizontal" className="flex-1 min-h-0">
          <ResizablePanel defaultSize={30} minSize={22} maxSize={50}>{chat}</ResizablePanel>
          <ResizableHandle className="hover:bg-primary/60 transition-colors" data-testid="workspace-resize-handle" />
          <ResizablePanel defaultSize={70} minSize={40}>
            <div className="flex h-full flex-col">
              <TabBar tabs={MAIN_TABS} value={tab} onChange={setTab} versionsCount={versions.length} />
              <div className="flex-1 min-h-0">{renderPanels()}</div>
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      ) : (
        <div className="flex flex-1 min-h-0 flex-col">
          <TabBar tabs={[{ id: "chat", label: "Chat", icon: MessageSquare }, ...MAIN_TABS]} value={mobileTab} onChange={setMobileTab} versionsCount={versions.length} />
          <div className="flex-1 min-h-0">{renderPanels()}</div>
        </div>
      )}
    </div>
  );
}
