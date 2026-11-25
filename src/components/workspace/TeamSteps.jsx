import { useState } from "react";
import SafeMarkdown from "@/components/SafeMarkdown";
import { Crown, Cpu, Palette, ShieldCheck, ChevronDown, Loader2, Users } from "lucide-react";

export const ROLE_STYLE = {
  ceo: { icon: Crown, color: "hsl(38 92% 55%)", name: "CEO" },
  cto: { icon: Cpu, color: "hsl(190 90% 50%)", name: "CTO" },
  designer: { icon: Palette, color: "hsl(320 70% 65%)", name: "Designer" },
  qa: { icon: ShieldCheck, color: "hsl(155 70% 45%)", name: "QA" },
};

function Step({ step, live }) {
  const [open, setOpen] = useState(!!live);
  const st = ROLE_STYLE[step.role] || ROLE_STYLE.cto;
  const Icon = st.icon;
  const isOpen = live ? true : open;
  return (
    <div className="rounded-lg border border-border bg-[hsl(220_14%_6%)]" data-testid={`team-step-${step.role}`}>
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-2 px-2.5 py-2 text-left">
        <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md" style={{ background: `color-mix(in srgb, ${st.color} 18%, transparent)` }}>
          <Icon className="h-3.5 w-3.5" style={{ color: st.color }} />
        </span>
        <span className="text-xs font-medium">{step.title}</span>
        {live && !step.done ? <Loader2 className="ml-auto h-3.5 w-3.5 animate-spin text-muted-foreground" /> : <ChevronDown className={`ml-auto h-3.5 w-3.5 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`} />}
      </button>
      {isOpen && step.content && (
        <div className="forge-md border-t border-border px-3 py-2 text-xs text-[hsl(210_20%_85%)] leading-relaxed"><SafeMarkdown>{step.content}</SafeMarkdown></div>
      )}
    </div>
  );
}

export default function TeamSteps({ steps, live = false }) {
  if (!steps?.length) return null;
  return (
    <div className="mb-2 space-y-1.5" data-testid="team-steps">
      <p className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground"><Users className="h-3 w-3" />Il team</p>
      {steps.map((s, i) => <Step key={`${s.role}-${i}`} step={s} live={live && i === steps.length - 1 && !s.done} />)}
    </div>
  );
}
