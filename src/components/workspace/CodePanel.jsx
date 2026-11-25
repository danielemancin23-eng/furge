import { useEffect, useRef, useState } from "react";
import Editor from "@monaco-editor/react";
import { Save, Copy, Undo2, Loader2, Lock } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export default function CodePanel({ html, streamingCode, generating, viewing, onSave }) {
  const [draft, setDraft] = useState(html || "");
  const [saving, setSaving] = useState(false);
  const dirtyRef = useRef(false);
  const readOnly = generating || !!viewing;
  const value = generating ? (streamingCode ?? "") : viewing ? viewing.html : draft;
  const dirty = !readOnly && draft !== (html || "");
  dirtyRef.current = dirty;

  useEffect(() => { setDraft(html || ""); }, [html]);

  const save = async () => {
    if (!dirty || saving) return;
    setSaving(true);
    try { await onSave(draft); } finally { setSaving(false); }
  };
  const saveRef = useRef(save);
  saveRef.current = save;

  const copy = async () => {
    try { await navigator.clipboard.writeText(value); toast.success("Codice copiato"); } catch { toast.error("Copia non riuscita"); }
  };

  return (
    <div className="flex h-full flex-col" data-testid="code-panel">
      <div className="flex h-11 shrink-0 items-center gap-2 border-b border-border px-3">
        <span className="rounded-md bg-secondary/50 border border-border px-2.5 py-1 font-mono text-[11px]">index.html</span>
        {dirty && <span className="font-mono text-[11px] text-[hsl(38_92%_55%)]" data-testid="code-dirty-indicator">● modifiche non salvate</span>}
        {readOnly && <span className="inline-flex items-center gap-1 font-mono text-[11px] text-muted-foreground"><Lock className="h-3 w-3" />{generating ? "generazione in corso" : `sola lettura • v${viewing.number}`}</span>}
        <div className="ml-auto flex items-center gap-1.5">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={copy} disabled={!value} title="Copia" data-testid="code-copy-button"><Copy className="h-4 w-4" /></Button>
          {dirty && <Button variant="ghost" size="sm" className="h-8" onClick={() => setDraft(html || "")} data-testid="code-discard-button"><Undo2 className="h-4 w-4 mr-1" />Annulla</Button>}
          <Button size="sm" className="h-8" onClick={save} disabled={!dirty || saving} data-testid="workspace-code-save-version-button">
            {saving ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Save className="h-4 w-4 mr-1.5" />}Salva versione
          </Button>
        </div>
      </div>
      <div className="flex-1 min-h-0" data-testid="code-editor">
        <Editor
          height="100%"
          language="html"
          theme="vs-dark"
          value={value}
          onChange={(v) => !readOnly && setDraft(v ?? "")}
          onMount={(editor, monaco) => {
            editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => saveRef.current());
          }}
          loading={<div className="p-4 text-sm text-muted-foreground">Caricamento editor…</div>}
          options={{
            readOnly,
            fontSize: 13,
            fontFamily: "IBM Plex Mono, ui-monospace, monospace",
            minimap: { enabled: false },
            wordWrap: "on",
            scrollBeyondLastLine: false,
            smoothScrolling: true,
            padding: { top: 12 },
            tabSize: 2,
            automaticLayout: true,
          }}
        />
      </div>
    </div>
  );
}
