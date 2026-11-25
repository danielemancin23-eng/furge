import { useEffect, useState } from "react";
import { Save, Loader2, Settings, Eye, EyeOff, PlugZap, Search, Monitor, Server, Info } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth, useSettings } from "@/lib/supabase";
import { complete, webSearch, sanitizeInput } from "@/lib/llm";

const PRESETS = [
  { id: "ollama", label: "Ollama (Tailscale)", endpoint_url: "https://nome-pc.tuo-tailnet.ts.net/v1", model_name: "huihui_ai/qwen3-abliterated:32b", connection_mode: "browser" },
  { id: "groq", label: "Groq", endpoint_url: "https://api.groq.com/openai/v1", model_name: "llama-3.3-70b-versatile", connection_mode: "server" },
  { id: "openrouter", label: "OpenRouter", endpoint_url: "https://openrouter.ai/api/v1", model_name: "meta-llama/llama-3.3-70b-instruct", connection_mode: "server" },
];

function Field({ label, hint, children }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-muted-foreground">{label}</label>
      {children}
      {hint && <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function Secret({ value, onChange, placeholder, testid }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input type={show ? "text" : "password"} autoComplete="off" spellCheck={false} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="h-10 pr-10 bg-background font-mono text-xs" data-testid={testid} />
      <button type="button" onClick={() => setShow((s) => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" data-testid={`${testid}-toggle`}>{show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>
    </div>
  );
}

export default function SettingsPage() {
  const { settings, save } = useSettings();
  const { getToken, email } = useAuth();
  const [form, setForm] = useState(null);
  const [busy, setBusy] = useState(false);
  const [testing, setTesting] = useState("");
  useEffect(() => { if (settings) setForm({ ...settings }); }, [settings]);
  if (!form) return <div className="grid h-full place-items-center"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>;
  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));

  const clean = () => ({
    endpoint_url: sanitizeInput(form.endpoint_url, 500).trim(), model_name: sanitizeInput(form.model_name, 200).trim(),
    api_key: sanitizeInput(form.api_key, 500).trim(), tavily_key: sanitizeInput(form.tavily_key, 200).trim(),
    connection_mode: form.connection_mode === "server" ? "server" : "browser",
    max_tokens: Math.min(200000, Math.max(256, Number(form.max_tokens) || 8192)),
    temperature: Math.min(2, Math.max(0, Number(form.temperature) || 0)),
  });
  const submit = async () => {
    const c = clean();
    if (c.endpoint_url && !/^https?:\/\//i.test(c.endpoint_url)) return toast.error("L'URL deve iniziare con http:// o https://");
    setBusy(true);
    try { await save(c); toast.success("Impostazioni salvate"); } catch (e) { toast.error(e.message); } finally { setBusy(false); }
  };
  const testLLM = async () => {
    setTesting("llm");
    try {
      const out = await complete({ ...form, ...clean() }, [{ role: "user", content: "Rispondi solo con la parola: OK" }], { maxTokens: 300, getToken });
      toast.success(`Connessione riuscita: «${out.trim().slice(0, 60)}»`);
    } catch (e) { toast.error(e.message, { duration: 9000 }); }
    finally { setTesting(""); }
  };
  const testSearch = async () => {
    setTesting("search");
    try { const r = await webSearch({ ...form, ...clean() }, "notizie di oggi", getToken); toast.success(`Tavily OK: ${r.results.length} risultati`); }
    catch (e) { toast.error(e.message); } finally { setTesting(""); }
  };
  const mode = form.connection_mode;

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-8 sm:py-10 space-y-6" data-testid="settings-page">
      <div className="flex items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-xl border border-border bg-card"><Settings className="h-5 w-5 text-primary" /></div>
        <div><h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">Impostazioni</h1><p className="text-sm text-muted-foreground">Motore IA e chiavi, salvati solo nel tuo profilo privato (RLS).</p></div>
      </div>

      <section className="rounded-2xl border border-border bg-card p-5 space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-medium mr-auto">Motore IA (compatibile OpenAI / Ollama)</h2>
          {PRESETS.map((p) => <button key={p.id} onClick={() => setForm((f) => ({ ...f, endpoint_url: p.endpoint_url, model_name: p.model_name, connection_mode: p.connection_mode }))} className="rounded-full border border-border/70 bg-secondary/60 px-2.5 py-1 text-[11px] text-muted-foreground hover:text-foreground hover:border-primary/50" data-testid={`settings-preset-${p.id}`}>{p.label}</button>)}
        </div>
        <Field label="URL Endpoint" hint="Es. https://nome-pc.tuo-tailnet.ts.net/v1 (Ollama con Tailscale Serve) oppure https://api.groq.com/openai/v1">
          <Input value={form.endpoint_url} onChange={(e) => set("endpoint_url")(e.target.value)} placeholder="https://…/v1" className="h-10 bg-background font-mono text-xs" data-testid="settings-endpoint-input" />
        </Field>
        <Field label="Nome modello" hint="Es. huihui_ai/qwen3-abliterated:32b oppure llama-3.3-70b-versatile">
          <Input value={form.model_name} onChange={(e) => set("model_name")(e.target.value)} placeholder="nome-del-modello" className="h-10 bg-background font-mono text-xs" data-testid="settings-model-input" />
        </Field>
        <Field label="Chiave API (opzionale)" hint="Lascia vuoto per Ollama locale. Per Groq usa la tua chiave gsk_…">
          <Secret value={form.api_key} onChange={set("api_key")} placeholder="vuota per Ollama" testid="settings-apikey-input" />
        </Field>
        <Field label="Connessione">
          <div className="grid gap-2 sm:grid-cols-2" data-testid="settings-connection-mode">
            {[{ id: "browser", icon: Monitor, t: "Dal mio dispositivo", d: "Per Ollama via Tailscale: il dispositivo deve essere nella tua tailnet" }, { id: "server", icon: Server, t: "Dal server di Furge", d: "Per endpoint pubblici (Groq, OpenRouter): funziona ovunque" }].map(({ id, icon: Icon, t, d }) => (
              <button key={id} type="button" onClick={() => set("connection_mode")(id)} className={`flex gap-3 rounded-xl border p-3 text-left transition-colors ${mode === id ? "border-primary/60 bg-[hsl(190_50%_8%)]" : "border-border bg-background hover:border-border"}`} data-testid={`settings-mode-${id}`}>
                <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${mode === id ? "text-primary" : "text-muted-foreground"}`} />
                <span><span className="block text-sm font-medium">{t}</span><span className="block text-[11px] text-muted-foreground">{d}</span></span>
              </button>
            ))}
          </div>
        </Field>
        {mode === "browser" && (
          <div className="flex gap-2 rounded-lg border border-border bg-background p-3 text-[11px] text-muted-foreground leading-relaxed" data-testid="settings-ollama-help">
            <Info className="h-4 w-4 shrink-0 text-primary" />
            <span>Sul PC con la RTX 5080: avvia Ollama con <code className="text-foreground">OLLAMA_ORIGINS=*</code> e <code className="text-foreground">OLLAMA_CONTEXT_LENGTH=32768</code>, poi esponi la porta in HTTPS nella tailnet con <code className="text-foreground">tailscale serve --bg 11434</code>. Un indirizzo http://100.x.y.z viene bloccato dai browser su una pagina https.</span>
          </div>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Token massimi per risposta"><Input type="number" min={256} max={200000} value={form.max_tokens} onChange={(e) => set("max_tokens")(e.target.value)} className="h-10 bg-background" data-testid="settings-maxtokens-input" /></Field>
          <Field label="Temperatura (0-2)"><Input type="number" step="0.1" min={0} max={2} value={form.temperature} onChange={(e) => set("temperature")(e.target.value)} className="h-10 bg-background" data-testid="settings-temperature-input" /></Field>
        </div>
        <Button variant="secondary" onClick={testLLM} disabled={!!testing || !form.endpoint_url || !form.model_name} data-testid="settings-test-llm-button">
          {testing === "llm" ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <PlugZap className="h-4 w-4 mr-1.5" />}Prova connessione
        </Button>
      </section>

      <section className="rounded-2xl border border-border bg-card p-5 space-y-4">
        <h2 className="font-medium">Ricerca Web (Tavily)</h2>
        <Field label="Chiave Tavily" hint="La trovi su tavily.com: serve per l'interruttore «Ricerca Web» in chat.">
          <Secret value={form.tavily_key} onChange={set("tavily_key")} placeholder="tvly-…" testid="settings-tavily-input" />
        </Field>
        <Button variant="secondary" onClick={testSearch} disabled={!!testing || !form.tavily_key} data-testid="settings-test-search-button">
          {testing === "search" ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Search className="h-4 w-4 mr-1.5" />}Prova ricerca
        </Button>
      </section>

      <div className="sticky bottom-[calc(72px+env(safe-area-inset-bottom))] lg:bottom-4 flex items-center gap-3 rounded-xl border border-border bg-card/95 backdrop-blur p-3">
        <span className="min-w-0 truncate text-xs text-muted-foreground">Account: {email}</span>
        <Button className="ml-auto" onClick={submit} disabled={busy} data-testid="settings-save-button">{busy ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Save className="h-4 w-4 mr-1.5" />}Salva</Button>
      </div>
    </div>
  );
}
