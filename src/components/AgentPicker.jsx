import { useEffect, useState } from "react";
import { Check, ChevronDown, Users, Zap, Layers3 } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export const AGENTS = [
  { id: "f1", label: "F-1", name: "Veloce", desc: "Un solo sviluppatore: risultato rapido ed economico", icon: Zap },
  { id: "f2", label: "F-2", name: "Approfondito", desc: "Architetto + sviluppatore + controllo qualità", icon: Layers3 },
  { id: "f3", label: "F-3", name: "Team completo", desc: "CEO, CTO, Designer, Sviluppatore e QA lavorano insieme", icon: Users },
];

const KEY = "forge-agent";
const listeners = new Set();
export function useAgent() {
  const [agent, setAgentState] = useState(() => localStorage.getItem(KEY) || "f3");
  useEffect(() => { const l = (v) => setAgentState(v); listeners.add(l); return () => listeners.delete(l); }, []);
  const setAgent = (v) => { localStorage.setItem(KEY, v); listeners.forEach((l) => l(v)); };
  return [agent, setAgent];
}

export default function AgentPicker({ disabled = false, side = "top", align = "start" }) {
  const [agent, setAgent] = useAgent();
  const [open, setOpen] = useState(false);
  const cur = AGENTS.find((a) => a.id === agent) || AGENTS[2];
  const Icon = cur.icon;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" disabled={disabled}
          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-secondary/50 px-2.5 text-xs hover:border-primary/50 transition-colors disabled:opacity-50"
          data-testid="agent-picker-trigger">
          <Icon className="h-3.5 w-3.5 text-[hsl(38_92%_55%)]" />
          <span className="font-mono" data-testid="agent-picker-current">{cur.label}</span>
          <span className="hidden sm:inline text-muted-foreground">{cur.name}</span>
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent side={side} align={align} className="w-[300px] p-1.5 bg-card border-border" data-testid="agent-picker-content">
        <p className="px-2 pb-1 pt-2 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Seleziona agente</p>
        {AGENTS.map((a) => {
          const I = a.icon;
          return (
            <button key={a.id} type="button" onClick={() => { setAgent(a.id); setOpen(false); }}
              className={`flex w-full items-start gap-2.5 rounded-lg px-2 py-2 text-left transition-colors ${a.id === agent ? "bg-[hsl(190_50%_10%)]" : "hover:bg-secondary/70"}`}
              data-testid={`agent-option-${a.id}`}>
              <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-secondary border border-border"><I className="h-3.5 w-3.5 text-[hsl(38_92%_55%)]" /></span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2"><span className="font-mono text-sm font-medium">{a.label}</span><span className="text-sm">{a.name}</span>
                  {a.id === agent && <Check className="ml-auto h-4 w-4 text-primary" />}</span>
                <span className="mt-0.5 block text-xs text-muted-foreground leading-snug">{a.desc}</span>
              </span>
            </button>
          );
        })}
        <p className="border-t border-border mt-1 px-2 pt-2 pb-1 text-[11px] text-muted-foreground">Più agenti = risultato migliore, ma più tempo e più saldo.</p>
      </PopoverContent>
    </Popover>
  );
}
