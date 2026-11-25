import { Bot, PencilLine, RotateCcw, Copy, Eye, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatTime } from "@/lib/api";

const SOURCES = {
  ai: { label: "AI", icon: Bot },
  manual: { label: "Manuale", icon: PencilLine },
  restore: { label: "Ripristino", icon: RotateCcw },
  duplicate: { label: "Copia", icon: Copy },
};

export default function VersionsPanel({ versions, currentVersion, viewingNumber, onView, onRestore, generating }) {
  if (!versions.length) {
    return (
      <div className="h-full grid place-items-center p-6 text-center" data-testid="versions-empty-state">
        <div><p className="font-medium">Nessuna versione</p><p className="text-sm text-muted-foreground">Ogni risposta dell'AI o salvataggio crea una versione.</p></div>
      </div>
    );
  }
  return (
    <div className="h-full overflow-y-auto forge-scroll p-4" data-testid="versions-panel">
      <ol className="relative space-y-2 before:absolute before:left-[19px] before:top-3 before:bottom-3 before:w-px before:bg-border">
        {versions.map((v) => {
          const s = SOURCES[v.source] || SOURCES.ai;
          const Icon = s.icon;
          const isCurrent = v.number === currentVersion;
          const isViewing = v.number === viewingNumber;
          return (
            <li key={v.id} className={`relative flex items-start gap-3 rounded-xl border p-3 transition-colors ${isViewing ? "border-primary/60 bg-[hsl(190_50%_8%)]" : "border-border bg-card hover:border-border/100"}`} data-testid="version-item">
              <div className={`relative z-10 h-6 w-6 shrink-0 rounded-full border grid place-items-center ${isCurrent ? "border-primary bg-primary text-primary-foreground" : "border-border bg-secondary text-muted-foreground"}`}>
                {isCurrent ? <Check className="h-3.5 w-3.5" /> : <Icon className="h-3 w-3" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2 font-mono text-[11px] text-muted-foreground">
                  <span className="text-foreground font-medium" data-testid="version-number">v{v.number}</span>
                  <span className="rounded bg-secondary px-1.5 py-0.5">{s.label}</span>
                  {isCurrent && <span className="text-primary">attuale</span>}
                  <span>{formatTime(v.created_at)}</span>
                  <span>{(v.size / 1024).toFixed(1)} KB</span>
                </div>
                <p className="mt-1 text-sm text-[hsl(210_20%_88%)] line-clamp-2">{v.label}</p>
              </div>
              {!isCurrent && (
                <div className="flex shrink-0 gap-1">
                  <Button variant="ghost" size="icon" className="h-8 w-8" title="Visualizza" onClick={() => onView(v.number)} data-testid="versions-view-button"><Eye className="h-4 w-4" /></Button>
                  <Button variant="secondary" size="sm" className="h-8" disabled={generating} onClick={() => onRestore(v.number)} data-testid="versions-restore-button"><RotateCcw className="h-3.5 w-3.5 mr-1" />Ripristina</Button>
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
