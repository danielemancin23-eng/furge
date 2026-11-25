import { sb } from "@/lib/supabase";
import { addVersion } from "@/lib/api";
import { streamCompletion, splitThink } from "@/lib/llm";

const SYSTEM_PROMPT = `Sei Furge, un ingegnere front-end di livello mondiale e un designer eccellente.
Costruisci applicazioni web COMPLETE e FUNZIONANTI in un UNICO file index.html (HTML + CSS + JavaScript inline).

REGOLE DI OUTPUT (obbligatorie):
1. Inizia con 1-3 frasi brevi in italiano che spiegano cosa hai costruito o cambiato.
2. Poi scrivi il file COMPLETO dentro un unico blocco \`\`\`html ... \`\`\` (mai parziale, mai "...resto invariato").
3. Dopo il blocco di codice, opzionalmente, una riga "Prossimi passi:" con 2-3 suggerimenti brevi.
4. Se l'utente fa solo una domanda che non richiede modifiche al codice, rispondi senza blocco di codice.

REGOLE DI QUALITÀ:
- Design moderno, curato, responsive (mobile first), con ottima tipografia, spaziature, micro-interazioni e stati hover/focus.
- Puoi usare CDN pubbliche affidabili (https://cdn.tailwindcss.com, Google Fonts, unpkg/jsdelivr per Chart.js, Alpine.js, Lucide...).
- Per le immagini usa URL reali di https://images.unsplash.com o https://picsum.photos.
- Persistenza con localStorage quando ha senso. JavaScript funzionante, senza errori e senza placeholder.
- Testo dell'app nella lingua dell'utente (default italiano).
- Quando modifichi un'app esistente, mantieni ciò che funziona e restituisci SEMPRE il file intero.`;

const KINDS = {
  webapp: "TIPO DI PROGETTO: applicazione web interattiva (dashboard, tool, gioco, gestionale...).",
  mobile: "TIPO DI PROGETTO: APP MOBILE. Layout 100% mobile (390px), barra di navigazione in basso con icone, header fisso, aree sicure (env(safe-area-inset-*)), bottoni grandi (min 44px), transizioni tra schermate, meta tag apple-mobile-web-app-capable e theme-color. Su desktop centra l'app in una cornice larga max 430px.",
  website: "TIPO DI PROGETTO: SITO WEB / LANDING PAGE professionale: hero d'impatto, sezioni ben ritmate, menu mobile, call-to-action, testimonianze, FAQ, footer completo, SEO base (title, meta description, Open Graph).",
};

const ROLES = {
  ceo: { title: "CEO • Visione prodotto", prompt: "Sei il CEO/Product Manager. In massimo 140 parole, in italiano, definisci: obiettivo dell'app, utenti target, le 5-7 funzionalità MVP prioritarie e cosa la renderà speciale. Elenco puntato, niente codice." },
  cto: { title: "CTO • Architettura", prompt: "Sei il CTO. In massimo 160 parole, in italiano, definisci l'architettura per un'app in UN SOLO file index.html: schermate/sezioni, struttura dati (localStorage), librerie CDN, interazioni chiave e casi limite. Elenco puntato, niente codice." },
  designer: { title: "Designer • Stile visivo", prompt: "Sei il Lead Designer. In massimo 120 parole, in italiano, definisci: palette (codici hex), font Google, stile dei componenti, spaziature, micro-animazioni e layout mobile. Elenco puntato, niente codice." },
  qa: { title: "QA • Controllo qualità", prompt: "Sei il QA Tester. Analizza il codice index.html fornito. In massimo 120 parole, in italiano: elenca con ✅ le cose verificate e con ⚠️ eventuali bug o miglioramenti concreti. Sii specifico e onesto, niente codice." },
};

const FENCE = /```(?:html|HTML)?\s*\n([\s\S]*?)```/g;

export function extractHtml(text) {
  const blocks = [...text.matchAll(FENCE)].map((m) => m[1].trim()).filter((b) => /<html|<!doctype|<body|<div/i.test(b));
  if (blocks.length) return blocks.sort((a, b) => b.length - a.length)[0];
  const m = text.match(/```(?:html|HTML)\s*\n([\s\S]*)$/);
  return m && /<html/i.test(m[1]) ? m[1].trim() : null;
}

export function stripCode(text) {
  return text.replace(FENCE, "\n\n").replace(/```(?:html|HTML)\s*\n[\s\S]*$/, "").replace(/\n{3,}/g, "\n\n").trim();
}

function buildPrompt(currentHtml, history, message) {
  const parts = [];
  if (history.length) parts.push("CONVERSAZIONE PRECEDENTE (riassunto):\n" + history.slice(-8).map((m) => `${m.role === "user" ? "Utente" : "Furge"}: ${m.content.slice(0, 800)}`).join("\n"));
  if (currentHtml) parts.push("FILE ATTUALE index.html:\n```html\n" + currentHtml + "\n```", "RICHIESTA DI MODIFICA:\n" + message);
  else parts.push("NUOVA APP DA COSTRUIRE:\n" + message);
  return parts.join("\n\n");
}

function rolesFor(agent, isEdit) {
  if (agent === "f3") return isEdit ? ["cto"] : ["ceo", "cto", "designer"];
  if (agent === "f2") return isEdit ? [] : ["cto"];
  return [];
}

async function* textOnly(settings, messages, opts) {
  // Hides <think> reasoning of local reasoning models from the visible stream.
  let raw = "", shown = 0;
  for await (const ev of streamCompletion(settings, messages, opts)) {
    if (ev.type !== "text") continue;
    raw += ev.text;
    const { answer } = splitThink(raw);
    if (answer.length > shown) { yield answer.slice(shown); shown = answer.length; }
  }
}

/** Runs the F-1/F-2/F-3 pipeline against the owner's own model and persists everything in Supabase. */
export async function* runBuilderChat({ project, history, message, image, agent, settings, getToken, signal }) {
  const opts = { signal, getToken };
  const userMsg = (await sb().from("project_messages").insert({ project_id: project.id, role: "user", content: message, has_image: !!image }).select("*").single()).data;
  yield { type: "start", user_message: userMsg };
  const label = settings.model_name;
  yield { type: "model", model: label, label, fallback: false };
  const kind = KINDS[project.kind] || KINDS.webapp;
  const isEdit = !!project.current_html;
  const notes = [], steps = [];
  try {
    for (const role of rolesFor(agent, isEdit)) {
      const r = ROLES[role];
      yield { type: "step_start", role, title: r.title };
      let ctx = `${kind}\n\nRICHIESTA DELL'UTENTE:\n${message}`;
      if (notes.length) ctx += "\n\nDECISIONI GIÀ PRESE DAL TEAM:\n" + notes.join("\n\n");
      if (isEdit) ctx += "\n\n(Modifica a un'app esistente: pianifica solo le modifiche.)";
      let text = "";
      for await (const chunk of textOnly(settings, [{ role: "system", content: r.prompt }, { role: "user", content: ctx }], { ...opts, maxTokens: 2500 })) {
        text += chunk; yield { type: "step_delta", role, text: chunk };
      }
      notes.push(`[${r.title}]\n${text.trim()}`);
      steps.push({ role, title: r.title, content: text.trim() });
      yield { type: "step_done", role, title: r.title, content: text.trim() };
    }
    let devMessage = `${kind}\n\n${message}`;
    if (notes.length) devMessage += "\n\nPIANO DEL TEAM DA SEGUIRE CON PRECISIONE:\n" + notes.join("\n\n");
    const prompt = buildPrompt(project.current_html || null, history, devMessage);
    const userContent = image ? [{ type: "text", text: prompt }, { type: "image_url", image_url: { url: image } }] : prompt;
    let full = "";
    for await (const chunk of textOnly(settings, [{ role: "system", content: SYSTEM_PROMPT }, { role: "user", content: userContent }], opts)) {
      full += chunk; yield { type: "delta", text: chunk };
    }
    const html = extractHtml(full);
    if (html && (agent === "f2" || agent === "f3")) {
      const r = ROLES.qa;
      yield { type: "step_start", role: "qa", title: r.title };
      let text = "";
      try {
        for await (const chunk of textOnly(settings, [{ role: "system", content: r.prompt }, { role: "user", content: `RICHIESTA: ${message}\n\nCODICE:\n\`\`\`html\n${html}\n\`\`\`` }], { ...opts, maxTokens: 2000 })) {
          text += chunk; yield { type: "step_delta", role: "qa", text: chunk };
        }
      } catch (e) { if (e.name === "AbortError") throw e; text = text || `Controllo qualità non disponibile (${e.message.slice(0, 80)}).`; }
      steps.push({ role: "qa", title: r.title, content: text.trim() });
      yield { type: "step_done", role: "qa", title: r.title, content: text.trim() };
    }
    const visible = html ? stripCode(full) : full.trim();
    let version = null;
    if (html) version = await addVersion(project, html, "ai", (visible.split("\n")[0] || message).slice(0, 200));
    else await sb().from("projects").update({ updated_at: new Date().toISOString() }).eq("id", project.id);
    const a = (await sb().from("project_messages").insert({ project_id: project.id, role: "assistant", content: visible || "Fatto.", version: version?.number ?? null, steps, model_label: label, agent }).select("*").single()).data;
    yield { type: "done", message: a, version, html };
  } catch (e) {
    if (e.name === "AbortError") throw e;
    const err = (await sb().from("project_messages").insert({ project_id: project.id, role: "assistant", content: `Errore: ${e.message}`, error: true, steps, model_label: label, agent }).select("*").single()).data;
    yield { type: "error", message: err || { id: `err-${Date.now()}`, role: "assistant", error: true, content: `Errore: ${e.message}` } };
  }
}
