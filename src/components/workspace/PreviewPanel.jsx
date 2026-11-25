import { useEffect, useMemo, useRef, useState } from "react";
import { RotateCw, Monitor, Tablet, Smartphone, ExternalLink, Sparkles, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { buildPreviewDoc } from "@/lib/api";

const DEVICES = [
  { id: "desktop", icon: Monitor, width: "100%", label: "Desktop" },
  { id: "tablet", icon: Tablet, width: "768px", label: "Tablet" },
  { id: "mobile", icon: Smartphone, width: "390px", label: "Mobile" },
];

export default function PreviewPanel({ initialDevice = "desktop", html, projectId, generating, viewing, onExitViewing, onRestoreViewing, onErrors }) {
  const [device, setDevice] = useState(initialDevice);
  const [refreshKey, setRefreshKey] = useState(0);
  const iframeRef = useRef(null);
  const storageKey = `forge-ls-${projectId}`;

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const doc = useMemo(() => buildPreviewDoc(html, storageKey), [html, refreshKey, storageKey]);

  useEffect(() => { onErrors?.([]); /* reset on every new document */ // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc]);

  useEffect(() => {
    const onMsg = (e) => {
      if (!iframeRef.current || e.source !== iframeRef.current.contentWindow || !e.data?.__forge) return;
      if (e.data.__forge === "storage") { try { localStorage.setItem(storageKey, JSON.stringify(e.data.data)); } catch {} }
      if (e.data.__forge === "error") onErrors?.((prev) => (prev.length > 20 || prev.includes(e.data.message) ? prev : [...prev, e.data.message]));
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [storageKey, onErrors]);

  useEffect(() => {
    const onKey = (e) => {
      if (["INPUT", "TEXTAREA"].includes(document.activeElement?.tagName) || document.activeElement?.closest?.(".monaco-editor")) return;
      const d = { 1: "desktop", 2: "tablet", 3: "mobile" }[e.key];
      if (d && !e.metaKey && !e.ctrlKey && !e.altKey) setDevice(d);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const openTab = () => {
    const withBase = /<head[^>]*>/i.test(html) ? html.replace(/<head[^>]*>/i, (m) => `${m}<base href="${window.location.origin}/">`) : `<base href="${window.location.origin}/">${html}`;
    const url = URL.createObjectURL(new Blob([withBase], { type: "text/html" }));
    window.open(url, "_blank", "noopener");
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  };

  const width = DEVICES.find((d) => d.id === device).width;

  return (
    <div className="flex h-full flex-col" data-testid="preview-panel">
      <div className="flex h-11 shrink-0 items-center gap-2 border-b border-border px-3">
        <div className="flex items-center rounded-lg border border-border bg-secondary/50 p-0.5" data-testid="workspace-preview-device-toggle">
          {DEVICES.map(({ id, icon: Icon, label }) => (
            <button key={id} onClick={() => setDevice(id)} title={label}
              className={`h-7 w-8 grid place-items-center rounded-md transition-colors ${device === id ? "bg-card text-primary shadow-[0_0_0_1px_hsl(220_10%_22%)]" : "text-muted-foreground hover:text-foreground"}`}
              data-testid={`preview-device-${id}`}><Icon className="h-3.5 w-3.5" /></button>
          ))}
        </div>
        <div className="hidden md:flex flex-1 items-center justify-center">
          <span className="rounded-md bg-secondary/50 border border-border px-3 py-1 font-mono text-[11px] text-muted-foreground">index.html</span>
        </div>
        <div className="ml-auto flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setRefreshKey((k) => k + 1)} disabled={!html} title="Ricarica" data-testid="preview-refresh-button"><RotateCw className="h-4 w-4" /></Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={openTab} disabled={!html} title="Apri in una nuova scheda" data-testid="preview-open-tab-button"><ExternalLink className="h-4 w-4" /></Button>
        </div>
      </div>

      {viewing && (
        <div className="flex items-center gap-2 border-b border-border bg-[hsl(190_50%_8%)] px-3 py-2 text-xs" data-testid="preview-viewing-banner">
          <Eye className="h-3.5 w-3.5 text-primary" />
          <span>Stai guardando la <b>v{viewing}</b></span>
          <Button size="sm" className="ml-auto h-7" onClick={onRestoreViewing} data-testid="preview-viewing-restore-button">Ripristina</Button>
          <Button size="sm" variant="secondary" className="h-7" onClick={onExitViewing} data-testid="preview-viewing-exit-button">Torna all'ultima</Button>
        </div>
      )}

      <div className="relative flex-1 overflow-auto bg-[hsl(220_14%_5%)] forge-scroll">
        {generating && <div className="absolute inset-x-0 top-0 z-10 h-[2px] forge-scan" data-testid="preview-progress" />}
        {html ? (
          <div className="mx-auto h-full transition-[max-width] duration-200" style={{ maxWidth: width, padding: device === "desktop" ? 0 : "16px 0" }}>
            <iframe
              key={refreshKey}
              ref={iframeRef}
              title="Anteprima app"
              srcDoc={doc}
              sandbox="allow-scripts allow-forms allow-modals allow-popups allow-popups-to-escape-sandbox allow-downloads"
              className={`h-full w-full bg-white ${device === "desktop" ? "" : "rounded-xl border border-border shadow-[0_12px_40px_hsl(220_30%_2%/0.55)]"}`}
              style={{ border: device === "desktop" ? 0 : undefined }}
              data-testid="preview-iframe"
            />
          </div>
        ) : (
          <div className="absolute inset-0 grid place-items-center p-6" data-testid="preview-empty-state">
            <div className="text-center max-w-xs">
              <div className="mx-auto mb-4 h-12 w-12 rounded-xl border border-border bg-card grid place-items-center">
                <Sparkles className={`h-5 w-5 text-primary ${generating ? "animate-pulse" : ""}`} />
              </div>
              <p className="font-medium">{generating ? "Forge sta costruendo la tua app…" : "Nessuna anteprima"}</p>
              <p className="mt-1 text-sm text-muted-foreground">{generating ? "L'anteprima apparirà appena il codice è pronto." : "Scrivi nella chat cosa vuoi costruire."}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
