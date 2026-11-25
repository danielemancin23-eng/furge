import { useMemo } from "react";
import JSZip from "jszip";
import { sb, useAuth } from "@/lib/supabase";

export const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const now = () => new Date().toISOString();
const must = ({ data, error }) => { if (error) throw new Error(error.message); return data; };

function nameFromPrompt(prompt) {
  const words = prompt.replace(/\s+/g, " ").trim().split(" ");
  const name = words.slice(0, 6).join(" ");
  return (name.slice(0, 60) + (name.length > 60 || words.length > 6 ? "…" : "")) || "Nuovo progetto";
}

export async function addVersion(project, html, source, label) {
  const last = must(await sb().from("project_versions").select("number").eq("project_id", project.id).order("number", { ascending: false }).limit(1));
  const number = (last[0]?.number || 0) + 1;
  const v = must(await sb().from("project_versions").insert({ project_id: project.id, number, html, source, label: (label || "").slice(0, 200), size: html.length })
    .select("id,project_id,number,source,label,size,created_at").single());
  must(await sb().from("projects").update({ current_version: number, current_html: html, updated_at: now() }).eq("id", project.id));
  return v;
}

/** Supabase-backed replacement of the old REST API (same paths, so screens stay unchanged). RLS enforces ownership. */
export function useApi() {
  const { getToken } = useAuth();
  return useMemo(() => {
    const routes = [
      ["GET", /^\/projects$/, async () => must(await sb().from("projects").select("id,name,kind,initial_prompt,current_version,created_at,updated_at").order("updated_at", { ascending: false }))],
      ["POST", /^\/projects$/, async (_, b) => must(await sb().from("projects").insert({
        name: (b.name || "").trim().slice(0, 120) || nameFromPrompt(b.prompt), kind: ["webapp", "mobile", "website"].includes(b.kind) ? b.kind : "webapp",
        initial_prompt: b.prompt.slice(0, 20000) }).select("id,name,kind,initial_prompt,current_version,created_at,updated_at").single())],
      ["GET", /^\/projects\/([^/]+)$/, async ([id]) => {
        const project = must(await sb().from("projects").select("*").eq("id", id).maybeSingle());
        if (!project) throw Object.assign(new Error("Progetto non trovato"), { status: 404 });
        const [messages, versions] = await Promise.all([
          sb().from("project_messages").select("*").eq("project_id", id).order("created_at"),
          sb().from("project_versions").select("id,project_id,number,source,label,size,created_at").eq("project_id", id).order("number", { ascending: false }),
        ]);
        return { project, messages: must(messages), versions: must(versions) };
      }],
      ["PATCH", /^\/projects\/([^/]+)$/, async ([id], b) => must(await sb().from("projects").update({ name: b.name.trim().slice(0, 120), updated_at: now() }).eq("id", id).select("id,name").single())],
      ["DELETE", /^\/projects\/([^/]+)$/, async ([id]) => { must(await sb().from("projects").delete().eq("id", id)); return { ok: true }; }],
      ["POST", /^\/projects\/([^/]+)\/duplicate$/, async ([id]) => {
        const src = must(await sb().from("projects").select("*").eq("id", id).single());
        const p = must(await sb().from("projects").insert({ name: `${src.name} (copia)`.slice(0, 120), kind: src.kind, initial_prompt: src.initial_prompt }).select("*").single());
        if (src.current_html) await addVersion(p, src.current_html, "duplicate", `Copiato da "${src.name}" v${src.current_version}`);
        return p;
      }],
      ["GET", /^\/projects\/([^/]+)\/versions\/(\d+)$/, async ([id, n]) => {
        const v = must(await sb().from("project_versions").select("*").eq("project_id", id).eq("number", Number(n)).maybeSingle());
        if (!v) throw new Error("Versione non trovata");
        return v;
      }],
      ["POST", /^\/projects\/([^/]+)\/versions$/, async ([id], b) => addVersion({ id }, b.html, "manual", b.label || "Modifica manuale del codice")],
      ["POST", /^\/projects\/([^/]+)\/versions\/(\d+)\/restore$/, async ([id, n]) => {
        const src = must(await sb().from("project_versions").select("html").eq("project_id", id).eq("number", Number(n)).single());
        return addVersion({ id }, src.html, "restore", `Ripristinata la v${n}`);
      }],
    ];
    const call = async (method, url, body) => {
      for (const [m, re, fn] of routes) {
        const match = m === method && url.match(re);
        if (match) return fn(match.slice(1), body);
      }
      throw new Error(`Operazione non supportata: ${method} ${url}`);
    };
    return {
      getToken,
      headers: async () => ({ Authorization: `Bearer ${await getToken()}` }),
      get: (u) => call("GET", u),
      post: (u, b) => call("POST", u, b || {}),
      patch: (u, b) => call("PATCH", u, b),
      del: (u) => call("DELETE", u),
      download: async (projectId) => {
        const p = must(await sb().from("projects").select("name,current_html,current_version,initial_prompt").eq("id", projectId).single());
        if (!p.current_html) throw new Error("Il progetto non ha ancora codice");
        const slug = p.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 50) || "progetto";
        const zip = new JSZip();
        zip.file(`${slug}/index.html`, p.current_html);
        zip.file(`${slug}/README.md`, `# ${p.name}\n\nGenerato con Furge (v${p.current_version}).\n\nApri index.html nel browser o pubblicalo su un hosting statico.\n\n## Prompt iniziale\n\n${p.initial_prompt}\n`);
        const blob = await zip.generateAsync({ type: "blob" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a"); a.href = url; a.download = `${slug}.zip`;
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 2000);
      },
    };
  }, [getToken]);
}

export function errMsg(e, fallback = "Qualcosa è andato storto") {
  return e?.response?.data?.detail || e?.message || fallback;
}

export function timeAgo(iso) {
  if (!iso) return "";
  const s = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return "adesso";
  const m = Math.floor(s / 60); if (m < 60) return `${m} min fa`;
  const h = Math.floor(m / 60); if (h < 24) return `${h} h fa`;
  const d = Math.floor(h / 24); if (d < 30) return `${d} g fa`;
  return new Date(iso).toLocaleDateString("it-IT");
}

export function formatTime(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleString("it-IT", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "short" });
}

// Wraps generated HTML for the sandboxed preview: storage persisted via the parent, errors reported up.
export function buildPreviewDoc(html, storageKey) {
  if (!html) return "";
  let snapshot = {};
  try { snapshot = JSON.parse(localStorage.getItem(storageKey) || "{}"); } catch {}
  const shim = `<script>(function(){var D=${JSON.stringify(snapshot).replace(/</g, "\\u003c")};
function mk(d,persist){var s={getItem:function(k){return Object.prototype.hasOwnProperty.call(d,k)?d[k]:null},setItem:function(k,v){d[k]=String(v);persist&&sync()},removeItem:function(k){delete d[k];persist&&sync()},clear:function(){for(var k in d)delete d[k];persist&&sync()},key:function(i){return Object.keys(d)[i]||null}};Object.defineProperty(s,'length',{get:function(){return Object.keys(d).length}});return s}
function sync(){try{parent.postMessage({__forge:'storage',data:D},'*')}catch(e){}}
var ok=true;try{window.localStorage.getItem('x')}catch(e){ok=false}
if(!ok){try{Object.defineProperty(window,'localStorage',{value:mk(D,true),configurable:true});Object.defineProperty(window,'sessionStorage',{value:mk({},false),configurable:true})}catch(e){}}
function rep(m){try{parent.postMessage({__forge:'error',message:String(m).slice(0,500)},'*')}catch(e){}}
window.addEventListener('error',function(e){rep((e.message||'Errore')+(e.lineno?' (riga '+e.lineno+')':''))});
window.addEventListener('unhandledrejection',function(e){rep('Promise: '+(e.reason&&e.reason.message||e.reason))});
var ce=console.error;console.error=function(){rep([].map.call(arguments,function(a){return a&&a.message?a.message:String(a)}).join(' '));ce.apply(console,arguments)};
})();</script>`;
  if (/<head[^>]*>/i.test(html)) return html.replace(/<head[^>]*>/i, (m) => m + shim);
  if (/<html[^>]*>/i.test(html)) return html.replace(/<html[^>]*>/i, (m) => m + shim);
  return shim + html;
}

export async function resizeImage(file, max = 1280) {
  const dataUrl = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(file); });
  const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = dataUrl; });
  const scale = Math.min(1, max / Math.max(img.width, img.height));
  const c = document.createElement("canvas");
  c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", 0.85);
}
