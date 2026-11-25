import { useEffect, useMemo, useState } from "react";
import { Archive, Search, Trash2, Copy, Download, Flame, Loader2, ScrollText, FileText, Globe } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import SafeMarkdown from "@/components/SafeMarkdown";
import { sb, useAuth } from "@/lib/supabase";
import { formatTime } from "@/lib/api";

const KINDS = { all: { label: "Tutti" }, riassunto: { label: "Riassunti", icon: ScrollText }, report: { label: "Report", icon: FileText }, ricerca: { label: "Ricerche", icon: Globe } };

export default function ArchivePage() {
  const { user } = useAuth();
  const [items, setItems] = useState(null);
  const [kind, setKind] = useState("all");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(null);
  const [destroy, setDestroy] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [destroying, setDestroying] = useState(false);

  const load = async () => {
    const { data, error } = await sb().from("archive_items").select("*").order("created_at", { ascending: false }).limit(500);
    if (error) { toast.error(error.message); setItems([]); } else setItems(data);
  };
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => (items || []).filter((i) => (kind === "all" || i.kind === kind) && (i.title + i.content).toLowerCase().includes(q.toLowerCase())), [items, kind, q]);

  const remove = async (it) => {
    const { error } = await sb().from("archive_items").delete().eq("id", it.id);
    if (error) return toast.error(error.message);
    setItems((l) => l.filter((x) => x.id !== it.id)); setOpen(null); toast.success("Elemento eliminato");
  };
  const download = (it) => {
    const md = `# ${it.title}\n\n${it.content}\n\n${(it.sources || []).map((s, i) => `[${i + 1}] ${s.title} - ${s.url}`).join("\n")}`;
    const url = URL.createObjectURL(new Blob([md], { type: "text/markdown" }));
    const a = document.createElement("a"); a.href = url; a.download = `${it.title.replace(/[^a-z0-9]+/gi, "-").slice(0, 50) || "furge"}.md`; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };

  const destroyAll = async () => {
    if (confirmText !== "DISTRUGGI") return;
    setDestroying(true);
    try {
      for (const t of ["chats", "archive_items", "projects"]) {
        const { error } = await sb().from(t).delete().eq("user_id", user.id);
        if (error) throw new Error(error.message);
      }
      Object.keys(localStorage).filter((k) => k.startsWith("forge-ls-")).forEach((k) => localStorage.removeItem(k));
      setItems([]); setDestroy(false); setConfirmText("");
      toast.success("Cronologia distrutta: chat, archivio e progetti eliminati");
    } catch (e) { toast.error(e.message); }
    finally { setDestroying(false); }
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-8 sm:py-10" data-testid="archive-page">
      <div className="flex flex-wrap items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-xl border border-border bg-card"><Archive className="h-5 w-5 text-primary" /></div>
        <div className="mr-auto"><h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">Archivio</h1><p className="text-sm text-muted-foreground">Riassunti, report e ricerche raccolte da Furge.</p></div>
        <Button variant="destructive" onClick={() => setDestroy(true)} className="bg-[hsl(0_72%_48%)] hover:bg-[hsl(0_72%_42%)]" data-testid="archive-destroy-button"><Flame className="h-4 w-4 mr-1.5" />Distruggi Cronologia</Button>
      </div>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex gap-1 overflow-x-auto forge-scroll rounded-lg border border-border bg-secondary/40 p-1" data-testid="archive-filter">
          {Object.entries(KINDS).map(([k, v]) => <button key={k} onClick={() => setKind(k)} className={`h-8 shrink-0 rounded-md px-3 text-xs ${kind === k ? "bg-card text-primary shadow-[0_0_0_1px_hsl(220_10%_22%)]" : "text-muted-foreground hover:text-foreground"}`} data-testid={`archive-filter-${k}`}>{v.label}</button>)}
        </div>
        <div className="relative sm:ml-auto sm:w-72"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cerca nell'archivio…" className="h-9 pl-9 bg-card" data-testid="archive-search-input" /></div>
      </div>

      {items === null ? <div className="mt-10 grid place-items-center"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
        : filtered.length === 0 ? (
          <div className="mt-6 rounded-xl border border-dashed border-border p-10 text-center" data-testid="archive-empty-state"><Archive className="mx-auto h-7 w-7 text-muted-foreground" /><p className="mt-2 text-sm font-medium">Archivio vuoto</p><p className="text-xs text-muted-foreground">In chat usa «Archivia», «Riassumi» o la Ricerca Web: i risultati appaiono qui.</p></div>
        ) : (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((it) => {
              const Icon = KINDS[it.kind]?.icon || FileText;
              return (
                <button key={it.id} onClick={() => setOpen(it)} className="rounded-xl border border-border bg-card p-4 text-left transition-colors hover:border-primary/40" data-testid="archive-item">
                  <div className="mb-2 flex items-center gap-2 font-mono text-[10px] text-muted-foreground"><Icon className="h-3.5 w-3.5 text-primary" />{it.kind}<span className="ml-auto">{formatTime(it.created_at)}</span></div>
                  <p className="line-clamp-2 text-sm font-medium">{it.title}</p>
                  <p className="mt-1 line-clamp-3 text-xs text-muted-foreground">{it.content.replace(/[#*_>`]/g, "").slice(0, 240)}</p>
                </button>
              );
            })}
          </div>
        )}

      <Dialog open={!!open} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto forge-scroll bg-card border-border sm:max-w-2xl" data-testid="archive-item-dialog">
          {open && (<>
            <DialogHeader><DialogTitle className="pr-6">{open.title}</DialogTitle></DialogHeader>
            <div className="forge-md text-sm leading-relaxed text-[hsl(210_20%_90%)]"><SafeMarkdown>{open.content}</SafeMarkdown></div>
            {open.sources?.length > 0 && <ol className="space-y-1 border-t border-border pt-3 text-xs">{open.sources.map((s, i) => <li key={i}><a href={/^https?:/i.test(s.url) ? s.url : "#"} target="_blank" rel="noopener noreferrer nofollow" className="hover:text-primary"><span className="font-mono text-primary">[{i + 1}]</span> {s.title}</a></li>)}</ol>}
            <div className="flex gap-2 border-t border-border pt-3">
              <Button size="sm" variant="secondary" onClick={() => navigator.clipboard.writeText(open.content).then(() => toast.success("Copiato"))} data-testid="archive-copy-button"><Copy className="h-4 w-4 mr-1" />Copia</Button>
              <Button size="sm" variant="secondary" onClick={() => download(open)} data-testid="archive-download-button"><Download className="h-4 w-4 mr-1" />.md</Button>
              <Button size="sm" variant="ghost" className="ml-auto text-[hsl(0_72%_60%)]" onClick={() => remove(open)} data-testid="archive-delete-button"><Trash2 className="h-4 w-4 mr-1" />Elimina</Button>
            </div>
          </>)}
        </DialogContent>
      </Dialog>

      <AlertDialog open={destroy} onOpenChange={(o) => { setDestroy(o); if (!o) setConfirmText(""); }}>
        <AlertDialogContent className="bg-card border-[hsl(0_50%_30%)]" data-testid="destroy-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2"><Flame className="h-5 w-5 text-[hsl(0_72%_60%)]" />Distruggere tutta la cronologia?</AlertDialogTitle>
            <AlertDialogDescription>Elimina per sempre dal database tutte le chat, l'archivio e i progetti con le loro versioni. Ruolo e Impostazioni restano. Non si può annullare.</AlertDialogDescription>
          </AlertDialogHeader>
          <div><p className="mb-1.5 text-xs text-muted-foreground">Scrivi <b className="text-foreground">DISTRUGGI</b> per confermare</p><Input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} className="bg-background font-mono" data-testid="destroy-confirm-input" /></div>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="destroy-cancel-button">Annulla</AlertDialogCancel>
            <Button onClick={destroyAll} disabled={confirmText !== "DISTRUGGI" || destroying} className="bg-[hsl(0_72%_48%)] text-white hover:bg-[hsl(0_72%_42%)]" data-testid="destroy-confirm-button">{destroying ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Flame className="h-4 w-4 mr-1.5" />}Distruggi tutto</Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
