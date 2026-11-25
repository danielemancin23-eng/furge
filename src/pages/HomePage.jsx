import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowUp, Loader2, Search, FolderOpen, Globe, Smartphone, Monitor, Cpu } from "lucide-react";
import AgentPicker from "@/components/AgentPicker";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import ProjectCard from "@/components/ProjectCard";
import { useApi, errMsg } from "@/lib/api";
import { useSettings } from "@/lib/supabase";

const TEMPLATES = [
  { id: "landing-page", label: "Landing page prodotto", prompt: "Una landing page moderna per un'app di produttività: hero con CTA, sezione funzionalità, testimonianze, prezzi a 3 piani e FAQ con accordion." },
  { id: "dashboard-kpi", label: "Dashboard KPI", prompt: "Una dashboard analytics dark con sidebar, 4 card KPI, grafico a linee e a barre con Chart.js, tabella ordini recenti filtrabile." },
  { id: "todo", label: "Todo minimal", prompt: "Un'app todo minimal ed elegante con categorie, priorità, filtri, drag per riordinare e salvataggio in localStorage." },
  { id: "portfolio", label: "Portfolio", prompt: "Un portfolio personale per un designer con hero animato, griglia progetti con filtri, sezione chi sono e form contatti." },
  { id: "gioco", label: "Mini gioco", prompt: "Un gioco Snake moderno con punteggio, record salvato, livelli di velocità e controlli touch per mobile." },
  { id: "finanze", label: "Gestione spese", prompt: "Un'app per tracciare spese ed entrate mensili con categorie, grafico a torta, saldo e salvataggio locale." },
];

const BUILD_TYPES = [
  { id: "website", label: "Sito web", icon: Globe, placeholder: "Es. Sito per il mio ristorante con menu, galleria e prenotazioni…" },
  { id: "mobile", label: "App mobile", icon: Smartphone, placeholder: "Crea un'app mobile: es. tracker di allenamenti con statistiche…" },
  { id: "webapp", label: "Web app", icon: Monitor, placeholder: "Es. Un'app per prenotare tavoli in un ristorante, con calendario e conferma via modulo…" },
];

export default function HomePage() {
  const api = useApi();
  const navigate = useNavigate();
  const { settings, configured } = useSettings();
  const [prompt, setPrompt] = useState("");
  const [buildType, setBuildType] = useState("webapp");
  const bt = BUILD_TYPES.find((b) => b.id === buildType);
  const [creating, setCreating] = useState(false);
  const [projects, setProjects] = useState(null);
  const [query, setQuery] = useState("");
  const taRef = useRef(null);

  const load = async () => {
    try { setProjects(await api.get("/projects")); }
    catch (e) { toast.error(errMsg(e)); setProjects([]); }
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, []);

  useEffect(() => {
    const onKey = (e) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); taRef.current?.focus(); } };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const create = async () => {
    const text = prompt.trim();
    if (!text || creating) return;
    if (!configured) { toast.error("Configura prima il modello nelle Impostazioni"); navigate("/impostazioni"); return; }
    setCreating(true);
    try {
      const p = await api.post("/projects", { prompt: text, kind: buildType });
      navigate(`/project/${p.id}`, { state: { autoPrompt: text } });
    } catch (e) { toast.error(errMsg(e)); setCreating(false); }
  };

  const filtered = useMemo(() => (projects || []).filter((p) => p.name.toLowerCase().includes(query.toLowerCase())), [projects, query]);

  return (
    <div className="min-h-full">
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 forge-grid-bg pointer-events-none" />
        <div className="absolute inset-x-0 top-0 h-[420px] forge-hero-glow pointer-events-none" />
        <div className="relative mx-auto max-w-3xl px-4 sm:px-6 pt-16 sm:pt-24 pb-14">
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.24 }}>
            <p className="font-mono text-[11px] tracking-[0.2em] uppercase text-primary text-center mb-4" data-testid="home-greeting">
              Progetti • builder privato
            </p>
            <h1 className="text-center text-4xl sm:text-5xl lg:text-6xl font-semibold tracking-tight">Cosa vuoi costruire?</h1>
            <p className="mt-4 text-center text-base md:text-lg text-muted-foreground">Descrivi la tua app. Il tuo modello scrive HTML, CSS e JavaScript e Furge te la mostra dal vivo.</p>
          </motion.div>

          <div className="mt-8 flex justify-center gap-1.5 overflow-x-auto forge-scroll pb-1" data-testid="build-type-chips">
            {BUILD_TYPES.map(({ id, label, icon: Icon, badge }) => (
              <button key={id} onClick={() => setBuildType(id)} data-testid={`build-type-${id}`}
                className={`relative shrink-0 inline-flex h-10 items-center gap-2 rounded-full border px-3.5 text-sm transition-colors ${buildType === id ? "border-primary/60 bg-card text-foreground shadow-[0_0_0_1px_hsl(190_90%_45%/0.25)]" : "border-border bg-secondary/50 text-muted-foreground hover:text-foreground"}`}>
                <Icon className={`h-4 w-4 ${buildType === id ? "text-primary" : ""}`} /><span className={buildType === id ? "" : "hidden sm:inline"}>{label}</span>
                {badge && <span className="absolute -top-2 -right-1 rounded-md bg-[hsl(0_72%_52%)] px-1.5 py-px text-[9px] font-semibold uppercase text-white">{badge}</span>}
              </button>
            ))}
          </div>

          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.24, delay: 0.06 }}
            className="mt-4 rounded-2xl bg-card border border-border shadow-[0_12px_40px_hsl(220_30%_2%/0.55)] focus-within:border-primary/60 focus-within:shadow-[0_0_0_1px_hsl(190_90%_45%/0.35),0_12px_40px_hsl(220_30%_2%/0.55)] transition-[border-color,box-shadow] duration-200">
            <Textarea
              ref={taRef}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey || !e.shiftKey)) { e.preventDefault(); create(); } }}
              placeholder={bt.placeholder}
              className="min-h-[128px] resize-none border-0 bg-transparent px-5 pt-5 text-base focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-muted-foreground/60"
              data-testid="home-hero-prompt-textarea"
            />
            <div className="flex items-center justify-between gap-3 px-4 pb-4">
              <div className="flex flex-wrap items-center gap-2 min-w-0">
                <span className="inline-flex h-8 max-w-[200px] items-center gap-1.5 rounded-lg border border-border bg-secondary/50 px-2.5 text-xs" data-testid="home-model-badge"><Cpu className="h-3.5 w-3.5 shrink-0 text-primary" /><span className="truncate font-mono">{configured ? settings.model_name : "nessun modello"}</span></span>
                <AgentPicker side="bottom" />
                <span className="font-mono text-[11px] text-muted-foreground hidden md:block">Invio per generare • Shift+Invio a capo</span>
              </div>
              <Button onClick={create} disabled={!prompt.trim() || creating} className="ml-auto h-10 px-5 font-medium hover:shadow-[0_0_0_1px_hsl(190_90%_45%/0.35),0_10px_30px_hsl(190_90%_45%/0.15)]" data-testid="home-generate-button">
                {creating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ArrowUp className="h-4 w-4 mr-2" />}
                Genera
              </Button>
            </div>
          </motion.div>

          <div className="mt-5 flex gap-2 overflow-x-auto pb-1 sm:flex-wrap sm:justify-center forge-scroll">
            {TEMPLATES.map((t) => (
              <button key={t.id} onClick={() => { setPrompt(t.prompt); taRef.current?.focus(); }}
                className="shrink-0 rounded-full px-3.5 py-1.5 text-xs bg-secondary/70 hover:bg-secondary border border-border/70 hover:border-primary/50 text-muted-foreground hover:text-foreground transition-colors"
                data-testid={`template-chip-${t.id}`}>
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pb-20">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
          <div className="flex items-baseline gap-3">
            <h2 className="text-xl font-semibold tracking-tight">I tuoi progetti</h2>
            {projects && <span className="font-mono text-xs text-muted-foreground" data-testid="projects-count">{projects.length}</span>}
          </div>
          {projects?.length > 0 && (
            <div className="relative sm:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Cerca progetti…" className="pl-9 h-9 bg-card" data-testid="projects-search-input" />
            </div>
          )}
        </div>

        {projects === null ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {[0, 1, 2].map((i) => <Skeleton key={i} className="h-64 rounded-xl bg-card" />)}
          </div>
        ) : projects.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-card/60 p-12 text-center" data-testid="projects-empty-state">
            <FolderOpen className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="mt-3 font-medium">Nessun progetto ancora</p>
            <p className="text-sm text-muted-foreground">Scrivi un'idea qui sopra o scegli un modello per iniziare.</p>
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground" data-testid="projects-no-results">Nessun progetto corrisponde a “{query}”.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" data-testid="projects-grid">
            {filtered.map((p) => <ProjectCard key={p.id} project={p} onChanged={load} />)}
          </div>
        )}
      </section>
    </div>
  );
}
