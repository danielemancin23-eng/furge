import { API } from "@/lib/api";

const cleanBase = (u) => u.trim().replace(/\/+$/, "").replace(/\/chat\/completions$/, "");

export function friendlyNetworkError(settings) {
  if (settings.connection_mode === "server") return "Il server non riesce a raggiungere l'endpoint. Per Ollama via Tailscale usa la modalità «Dal mio dispositivo».";
  const http = /^http:\/\//i.test(settings.endpoint_url) && window.location.protocol === "https:";
  return http
    ? "Il browser blocca gli indirizzi http:// da una pagina https. Su Ollama usa Tailscale Serve (https://nome-pc.tuo-tailnet.ts.net) oppure la modalità server con un endpoint pubblico."
    : "Endpoint non raggiungibile dal browser: controlla che Tailscale sia attivo su questo dispositivo, che Ollama sia acceso e che OLLAMA_ORIGINS consenta questo sito.";
}

/** Streams an OpenAI-compatible chat completion. Yields {type:"text"|"think", text}. */
export async function* streamCompletion(settings, messages, { maxTokens, temperature, signal, getToken } = {}) {
  if (!settings?.endpoint_url || !settings?.model_name) throw new Error("Configura URL endpoint e nome modello nelle Impostazioni");
  const body = {
    model: settings.model_name.trim(), messages, stream: true,
    max_tokens: maxTokens || settings.max_tokens || 8192,
    temperature: temperature ?? settings.temperature ?? 0.7,
  };
  let res;
  try {
    if (settings.connection_mode === "server") {
      res = await fetch(`${API}/llm/proxy`, {
        method: "POST", signal,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${await getToken()}` },
        body: JSON.stringify({ endpoint: cleanBase(settings.endpoint_url), api_key: settings.api_key || null, body }),
      });
    } else {
      const headers = { "Content-Type": "application/json" };
      if (settings.api_key) headers.Authorization = `Bearer ${settings.api_key}`;
      res = await fetch(`${cleanBase(settings.endpoint_url)}/chat/completions`, { method: "POST", signal, headers, body: JSON.stringify(body) });
    }
  } catch (e) {
    if (e.name === "AbortError") throw e;
    throw new Error(friendlyNetworkError(settings));
  }
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    if (res.status === 401 || res.status === 403) throw new Error(settings.connection_mode === "server" && t.includes("proprietario") ? "Sessione scaduta: rientra" : "Chiave API rifiutata dall'endpoint (401/403)");
    if (res.status === 404) throw new Error("Modello o URL non trovato (404): controlla nome modello e URL");
    throw new Error(`L'endpoint ha risposto ${res.status}: ${t.slice(0, 200)}`);
  }
  const ctype = res.headers.get("content-type") || "";
  if (ctype.includes("application/json")) {
    const d = await res.json();
    const m = d.choices?.[0]?.message || {};
    if (m.reasoning_content || m.reasoning) yield { type: "think", text: m.reasoning_content || m.reasoning };
    if (m.content) yield { type: "text", text: m.content };
    return;
  }
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let i;
    while ((i = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
      if (!line.startsWith("data:")) continue;
      const data = line.slice(5).trim();
      if (data === "[DONE]") return;
      let j; try { j = JSON.parse(data); } catch { continue; }
      if (j.furge_error) throw new Error(j.furge_error === 502 ? friendlyNetworkError(settings) : `L'endpoint ha risposto ${j.furge_error}: ${String(j.detail || "").slice(0, 200)}`);
      if (j.error) throw new Error(typeof j.error === "string" ? j.error : j.error.message || "Errore dell'endpoint");
      const d = j.choices?.[0]?.delta || {};
      const think = d.reasoning_content || d.reasoning;
      if (think) yield { type: "think", text: think };
      if (d.content) yield { type: "text", text: d.content };
    }
  }
}

/** Collects a full completion; strips <think> blocks. */
export async function complete(settings, messages, opts) {
  let out = "";
  for await (const ev of streamCompletion(settings, messages, opts)) if (ev.type === "text") out += ev.text;
  return splitThink(out).answer;
}

/** Separates <think>...</think> reasoning (Qwen3, DeepSeek) from the visible answer, also while streaming. */
export function splitThink(text) {
  const open = text.indexOf("<think>");
  if (open < 0) return { think: "", answer: text, thinking: false };
  const close = text.indexOf("</think>", open);
  if (close < 0) return { think: text.slice(open + 7), answer: text.slice(0, open), thinking: true };
  const rest = splitThink(text.slice(0, open) + text.slice(close + 8));
  return { think: (text.slice(open + 7, close) + (rest.think ? `\n${rest.think}` : "")).trim(), answer: rest.answer, thinking: rest.thinking };
}

export async function webSearch(settings, query, getToken) {
  if (!settings.tavily_key) throw new Error("Aggiungi la chiave Tavily nelle Impostazioni per usare la Ricerca Web");
  const res = await fetch(`${API}/search`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${await getToken()}` },
    body: JSON.stringify({ query: query.slice(0, 380), api_key: settings.tavily_key, max_results: 6 }),
  });
  const d = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(d.detail || `Ricerca non riuscita (${res.status})`);
  return d;
}

export const sanitizeInput = (s, max = 60000) => String(s || "").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").slice(0, max);
