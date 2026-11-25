import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MoreHorizontal, Copy, Download, Trash2, ExternalLink, Layers, Globe } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useApi, errMsg, timeAgo, buildPreviewDoc } from "@/lib/api";

function Thumbnail({ project }) {
  const api = useApi();
  const ref = useRef(null);
  const [html, setHtml] = useState(null);
  useEffect(() => {
    if (!project.current_version) return;
    const el = ref.current;
    const obs = new IntersectionObserver(async ([entry]) => {
      if (!entry.isIntersecting) return;
      obs.disconnect();
      try { const v = await api.get(`/projects/${project.id}/versions/${project.current_version}`); setHtml(v.html); } catch {}
    }, { rootMargin: "200px" });
    if (el) obs.observe(el);
    return () => obs.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.id, project.current_version]);

  return (
    <div ref={ref} className="relative h-40 overflow-hidden rounded-t-xl bg-[hsl(220_14%_5%)] border-b border-border">
      {html ? (
        <iframe title={`anteprima-${project.name}`} srcDoc={buildPreviewDoc(html, `forge-ls-${project.id}`)} sandbox="allow-scripts" tabIndex={-1} scrolling="no"
          className="pointer-events-none absolute left-0 top-0 origin-top-left bg-white" style={{ width: "400%", height: "400%", transform: "scale(0.25)", border: 0 }} />
      ) : (
        <div className="absolute inset-0 grid place-items-center forge-grid-bg">
          <span className="text-4xl font-semibold text-primary/70">{project.name.slice(0, 1).toUpperCase()}</span>
        </div>
      )}
    </div>
  );
}

export default function ProjectCard({ project, onChanged }) {
  const api = useApi();
  const navigate = useNavigate();
  const [confirm, setConfirm] = useState(false);
  const open = () => navigate(`/project/${project.id}`);

  const duplicate = async () => {
    try { await api.post(`/projects/${project.id}/duplicate`); toast.success("Progetto duplicato"); onChanged(); }
    catch (e) { toast.error(errMsg(e)); }
  };
  const download = async () => {
    try { await api.download(project.id, project.name); toast.success("Download avviato"); }
    catch (e) { toast.error(project.current_version ? errMsg(e) : "Il progetto non ha ancora codice"); }
  };
  const remove = async () => {
    try { await api.del(`/projects/${project.id}`); toast.success("Progetto eliminato"); onChanged(); }
    catch (e) { toast.error(errMsg(e)); }
  };

  return (
    <div className="group min-w-0 overflow-hidden rounded-xl bg-card border border-border hover:border-primary/40 hover:shadow-[0_12px_40px_hsl(220_30%_2%/0.55)] transition-[border-color,box-shadow] duration-200" data-testid="project-card">
      <button onClick={open} className="block w-full text-left" data-testid="project-card-open-button"><Thumbnail project={project} /></button>
      <div className="flex items-start justify-between gap-2 p-4">
        <button onClick={open} className="min-w-0 text-left">
          <p className="truncate font-medium" data-testid="project-card-name">{project.name}</p>
          <p className="mt-1 flex items-center gap-2 font-mono text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1"><Layers className="h-3 w-3" />{project.current_version ? `v${project.current_version}` : "bozza"}</span>
            <span>•</span><span>{timeAgo(project.updated_at)}</span>
            {project.kind && project.kind !== "webapp" && <span className="rounded bg-secondary px-1.5 text-foreground" data-testid="project-card-kind">{project.kind === "mobile" ? "app mobile" : "sito web"}</span>}
            {project.share_enabled && <span className="inline-flex items-center gap-1 text-primary" data-testid="project-card-public-badge"><Globe className="h-3 w-3" />pubblico</span>}
          </p>
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" data-testid="project-card-menu-button"><MoreHorizontal className="h-4 w-4" /></Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem onClick={open} data-testid="project-card-menu-open"><ExternalLink className="h-4 w-4 mr-2" />Apri</DropdownMenuItem>
            <DropdownMenuItem onClick={duplicate} data-testid="project-card-menu-duplicate"><Copy className="h-4 w-4 mr-2" />Duplica</DropdownMenuItem>
            <DropdownMenuItem onClick={download} data-testid="project-card-menu-download"><Download className="h-4 w-4 mr-2" />Scarica zip</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setConfirm(true)} className="text-[hsl(0_72%_60%)] focus:text-[hsl(0_72%_60%)]" data-testid="project-card-menu-delete"><Trash2 className="h-4 w-4 mr-2" />Elimina</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent className="bg-card">
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminare “{project.name}”?</AlertDialogTitle>
            <AlertDialogDescription>Verranno eliminate tutte le versioni e la chat. Non si può annullare.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="delete-cancel-button">Annulla</AlertDialogCancel>
            <AlertDialogAction onClick={remove} className="bg-destructive text-destructive-foreground hover:bg-destructive/90" data-testid="delete-confirm-button">Elimina</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
