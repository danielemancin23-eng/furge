import { useEffect, useRef, useState } from "react";
import SafeMarkdown from "@/components/SafeMarkdown";
import { ArrowUp, Square, ImagePlus, X, RotateCcw, Layers, Wand2, AlertTriangle, Code2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { formatTime, resizeImage } from "@/lib/api";
import AgentPicker from "@/components/AgentPicker";
import TeamSteps from "@/components/workspace/TeamSteps";

const SUGGESTIONS = ["Rendila più moderna", "Aggiungi la modalità scura", "Migliora la versione mobile", "Aggiungi animazioni"];

export function splitStream(t) {
  const i = t.indexOf("```");
  if (i < 0) return { before: t, code: null, after: "" };
  const rest = t.slice(i + 3).replace(/^[a-zA-Z]*\s*\n?/, "");
  const j = rest.indexOf("```");
  if (j < 0) return { before: t.slice(0, i), code: rest, after: "", open: true };
  return { before: t.slice(0, i), code: rest.slice(0, j), after: rest.slice(j + 3) };
}

function StatusPill({ state }) {
  const map = {
    idle: { label: "In attesa", dot: "bg-muted-foreground/60" },
    thinking: { label: "Sto pensando…", dot: "bg-[hsl(38_92%_55%)] animate-pulse" },
    building: { label: "Sto costruendo…", dot: "bg-primary animate-pulse" },
  };
  const s = map[state] || map.idle;
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-secondary/60 px-3 py-1 text-xs text-muted-foreground" data-testid="chat-status-pill">
      <span className={`forge-dot ${s.dot}`} />{s.label}
    </span>
  );
}

function AssistantBubble({ msg, onRestore, currentVersion, onView, onRetry, isLast, generating }) {
  return (
    <div className={`rounded-xl border p-3 text-sm ${msg.error ? "bg-[hsl(0_40%_10%)] border-[hsl(0_50%_30%)]" : "bg-card border-border"}`} data-testid="chat-message-assistant">
      <div className="mb-1.5 flex items-center gap-2 font-mono text-[11px] text-muted-foreground">
        <span className="text-primary">furge</span>
        {msg.model_label && <span className="truncate" data-testid="chat-message-model">{msg.model_label}</span>}
        {msg.version && <span className="inline-flex items-center gap-1 rounded bg-secondary px-1.5 py-0.5 text-foreground"><Layers className="h-3 w-3" />v{msg.version}</span>}
        <span className="ml-auto">{formatTime(msg.created_at)}</span>
      </div>
      <TeamSteps steps={msg.steps} />
      <div className="forge-md text-[hsl(210_20%_90%)] leading-relaxed"><SafeMarkdown>{msg.content}</SafeMarkdown></div>
      {msg.error && isLast && !generating && (
        <Button size="sm" variant="secondary" className="mt-2 h-7" onClick={onRetry} data-testid="chat-retry-button"><RotateCcw className="h-3.5 w-3.5 mr-1" />Riprova</Button>
      )}
      {msg.version && msg.version !== currentVersion && (
        <div className="mt-2 flex gap-2">
          <button onClick={() => onView(msg.version)} className="text-xs text-muted-foreground hover:text-foreground" data-testid="chat-view-version-button">Vedi v{msg.version}</button>
          <button onClick={() => onRestore(msg.version)} className="inline-flex items-center gap-1 text-xs text-primary hover:underline" data-testid="chat-restore-version-button"><RotateCcw className="h-3 w-3" />Ripristina</button>
        </div>
      )}
    </div>
  );
}

export default function ChatPanel({ streamSteps = [], text, setText, streamModel, messages, streamText, generating, onSend, onStop, onRestore, onView, currentVersion, previewErrors, onFixErrors }) {
  const [image, setImage] = useState(null);
  const endRef = useRef(null);
  const fileRef = useRef(null);
  const parts = streamText ? splitStream(streamText) : null;
  const state = !generating ? "idle" : parts?.code != null ? "building" : "thinking";

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [messages.length, streamText, generating]);

  const submit = () => {
    const t = text.trim();
    if (!t || generating) return;
    onSend(t, image);
    setText(""); setImage(null);
  };

  const pickImage = async (e) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (!/^image\/(png|jpe?g|webp)$/.test(f.type)) return toast.error("Usa un'immagine PNG, JPG o WEBP");
    try { setImage(await resizeImage(f)); } catch { toast.error("Impossibile leggere l'immagine"); }
  };

  const lines = parts?.code ? parts.code.split("\n").length : 0;

  return (
    <div className="flex h-full flex-col bg-[hsl(var(--panel))]" data-testid="chat-panel">
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-border px-4">
        <span className="text-sm font-medium">Agente</span>
        <StatusPill state={state} />
      </div>

      <div className="flex-1 overflow-y-auto forge-scroll px-4 py-4 space-y-3" data-testid="chat-messages">
        {messages.length === 0 && !generating && (
          <div className="rounded-xl border border-dashed border-border p-5 text-sm text-muted-foreground" data-testid="chat-empty-state">
            Descrivi cosa vuoi costruire o modificare. Puoi allegare uno screenshot come riferimento.
          </div>
        )}
        {messages.map((m, idx) => m.role === "user" ? (
          <div key={m.id} className="flex justify-end">
            <div className="max-w-[88%] rounded-xl bg-secondary/70 border border-border/60 p-3 text-sm whitespace-pre-wrap" data-testid="chat-message-user">
              {m.image_preview && <img src={m.image_preview} alt="allegato" className="mb-2 max-h-40 rounded-md border border-border" />}
              {!m.image_preview && m.has_image && <span className="mb-1 block font-mono text-[11px] text-muted-foreground">[immagine allegata]</span>}
              {m.content}
            </div>
          </div>
        ) : (
          <AssistantBubble key={m.id} msg={m} onRestore={onRestore} onView={onView} currentVersion={currentVersion}
            isLast={idx === messages.length - 1} generating={generating} onRetry={() => {
              const lastUser = [...messages].reverse().find((x) => x.role === "user");
              if (lastUser) onSend(lastUser.content, lastUser.image_preview || null);
            }} />
        ))}

        {generating && (
          <div className="rounded-xl bg-card border border-primary/30 p-3 text-sm" data-testid="chat-streaming-message">
            <div className="mb-1.5 flex gap-2 font-mono text-[11px]"><span className="text-primary">furge</span>{streamModel && <span className="text-muted-foreground">{streamModel}</span>}</div>
            <TeamSteps steps={streamSteps.filter((s) => s.role !== "qa")} live={!streamText} />
            {!streamText && !streamSteps.length && <p className="text-muted-foreground forge-caret">Sto analizzando la richiesta</p>}
            {parts?.before && <div className="forge-md text-[hsl(210_20%_90%)]"><SafeMarkdown>{parts.before}</SafeMarkdown></div>}
            {parts?.code != null && (
              <div className="mt-2 rounded-lg border border-border bg-[hsl(220_14%_5%)] p-3" data-testid="chat-code-progress">
                <div className="flex items-center gap-2 font-mono text-[11px] text-muted-foreground">
                  <Code2 className="h-3.5 w-3.5 text-primary" /> index.html
                  <span className="ml-auto text-foreground">{lines} righe</span>
                </div>
                <div className="mt-2 h-[2px] rounded bg-secondary overflow-hidden">{parts.open && <div className="h-full w-full forge-scan" />}</div>
                <pre className="mt-2 max-h-24 overflow-hidden font-mono text-[10.5px] leading-4 text-muted-foreground/80 whitespace-pre-wrap break-all">{parts.code.split("\n").slice(-6).join("\n")}</pre>
              </div>
            )}
            {parts?.after && <div className="forge-md mt-2 text-[hsl(210_20%_90%)]"><SafeMarkdown>{parts.after}</SafeMarkdown></div>}
            {streamSteps.some((s) => s.role === "qa") && <div className="mt-2"><TeamSteps steps={streamSteps.filter((s) => s.role === "qa")} live /></div>}
          </div>
        )}
        <div ref={endRef} />
      </div>

      {previewErrors.length > 0 && !generating && (
        <div className="mx-4 mb-2 flex items-center gap-2 rounded-lg border border-[hsl(38_60%_30%)] bg-[hsl(38_40%_9%)] px-3 py-2 text-xs" data-testid="preview-errors-banner">
          <AlertTriangle className="h-4 w-4 shrink-0 text-[hsl(38_92%_55%)]" />
          <span className="truncate text-[hsl(38_60%_80%)]">{previewErrors.length} errore/i nell'anteprima: {previewErrors[0]}</span>
          <Button size="sm" variant="secondary" className="ml-auto h-7 shrink-0" onClick={onFixErrors} data-testid="preview-fix-errors-button"><Wand2 className="h-3.5 w-3.5 mr-1" />Correggi</Button>
        </div>
      )}

      <div className="shrink-0 border-t border-border p-3">
        {messages.length > 0 && !generating && (
          <div className="mb-2 flex gap-1.5 overflow-x-auto forge-scroll pb-1">
            {SUGGESTIONS.map((s, i) => (
              <button key={s} onClick={() => setText(s)} className="shrink-0 rounded-full border border-border/70 bg-secondary/60 px-2.5 py-1 text-[11px] text-muted-foreground hover:text-foreground hover:border-primary/50" data-testid={`chat-suggestion-${i}`}>{s}</button>
            ))}
          </div>
        )}
        <div className="rounded-xl border border-border bg-card focus-within:border-primary/60 transition-colors">
          {image && (
            <div className="relative m-2 mb-0 inline-block">
              <img src={image} alt="allegato" className="h-16 rounded-md border border-border" data-testid="chat-image-preview" />
              <button onClick={() => setImage(null)} className="absolute -right-2 -top-2 rounded-full bg-secondary border border-border p-0.5" data-testid="chat-image-remove-button"><X className="h-3 w-3" /></button>
            </div>
          )}
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); } }}
            placeholder={messages.length ? "Chiedi una modifica…" : "Descrivi la tua app…"}
            className="min-h-[64px] max-h-48 resize-none border-0 bg-transparent text-sm focus-visible:ring-0 focus-visible:ring-offset-0"
            data-testid="workspace-chat-input"
          />
          <div className="flex items-center justify-between px-2 pb-2">
            <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={pickImage} data-testid="chat-image-input" />
            <div className="flex min-w-0 items-center gap-1">
              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => fileRef.current?.click()} disabled={generating} title="Allega immagine" data-testid="chat-attach-image-button"><ImagePlus className="h-4 w-4" /></Button>
              <AgentPicker disabled={generating} />
            </div>
            {generating ? (
              <Button size="sm" variant="secondary" onClick={onStop} className="h-8" data-testid="workspace-chat-stop-button"><Square className="h-3.5 w-3.5 mr-1.5 fill-current" />Ferma</Button>
            ) : (
              <Button size="icon" className="h-8 w-8" onClick={submit} disabled={!text.trim()} data-testid="workspace-chat-send-button"><ArrowUp className="h-4 w-4" /></Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
