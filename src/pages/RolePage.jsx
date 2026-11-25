import { useEffect, useState } from "react";
import { Save, Loader2, UserCog, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useSettings } from "@/lib/supabase";
import { sanitizeInput } from "@/lib/llm";

const TEMPLATES = [
  { id: "assistente", label: "Assistente personale", text: "Sei Furge, il mio assistente personale. Rispondi sempre in italiano, in modo diretto, pratico e onesto. Quando non sei sicuro dillo. Usa elenchi puntati e titoli brevi quando aiutano." },
  { id: "ricercatore", label: "Ricercatore", text: "Sei un ricercatore meticoloso. Analizzi le fonti, confronti punti di vista, distingui fatti da opinioni e citi sempre le fonti con [1], [2]. Concludi con un riepilogo e le domande ancora aperte." },
  { id: "sviluppatore", label: "Sviluppatore senior", text: "Sei uno sviluppatore senior full-stack. Spieghi il perché delle scelte, scrivi codice pulito e commentato, segnali rischi di sicurezza e proponi test." },
  { id: "business", label: "Consulente business", text: "Sei un consulente strategico. Ragioni su mercato, clienti, costi e ricavi. Dai piani d'azione concreti con priorità, tempi e metriche." },
];

export default function RolePage() {
  const { settings, save } = useSettings();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (settings) setText(settings.system_prompt || ""); }, [settings]);
  const dirty = settings && text !== (settings.system_prompt || "");

  const submit = async () => {
    setBusy(true);
    try { await save({ system_prompt: sanitizeInput(text, 20000) }); toast.success("Ruolo salvato"); }
    catch (e) { toast.error(e.message); }
    finally { setBusy(false); }
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-8 sm:py-10" data-testid="role-page">
      <div className="flex items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-xl border border-border bg-card"><UserCog className="h-5 w-5 text-primary" /></div>
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">Ruolo dell'agente</h1>
          <p className="text-sm text-muted-foreground">Il System Prompt fisso che Furge segue in ogni chat.</p>
        </div>
      </div>
      <div className="mt-6 flex gap-2 overflow-x-auto forge-scroll pb-1">
        {TEMPLATES.map((t) => <button key={t.id} onClick={() => setText(t.text)} className="shrink-0 rounded-full border border-border/70 bg-secondary/60 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:border-primary/50" data-testid={`role-template-${t.id}`}>{t.label}</button>)}
      </div>
      <div className="mt-3 rounded-2xl border border-border bg-card focus-within:border-primary/60 transition-colors">
        <Textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Es. Sei Furge, un esperto di… Rispondi sempre…" className="min-h-[45vh] resize-y border-0 bg-transparent p-5 font-mono text-sm leading-relaxed focus-visible:ring-0 focus-visible:ring-offset-0" data-testid="role-textarea" />
        <div className="flex items-center gap-2 border-t border-border px-4 py-3">
          <span className="font-mono text-[11px] text-muted-foreground" data-testid="role-char-count">{text.length.toLocaleString("it-IT")} caratteri</span>
          {dirty && <span className="font-mono text-[11px] text-[hsl(38_92%_55%)]">● non salvato</span>}
          <div className="ml-auto flex gap-2">
            {dirty && <Button variant="ghost" size="sm" onClick={() => setText(settings.system_prompt || "")} data-testid="role-discard-button"><RotateCcw className="h-4 w-4 mr-1" />Annulla</Button>}
            <Button size="sm" onClick={submit} disabled={!dirty || busy} data-testid="role-save-button">{busy ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Save className="h-4 w-4 mr-1.5" />}Salva ruolo</Button>
          </div>
        </div>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">Salvato solo nel tuo profilo privato su Supabase (protetto da RLS).</p>
    </div>
  );
}
