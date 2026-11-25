import * as pdfjs from "pdfjs-dist/legacy/build/pdf";

pdfjs.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjs.version}/legacy/build/pdf.worker.min.js`;

export const ACCEPTED = ".pdf,.txt,.md,.csv,.json,.html,.htm,.xml,.js,.ts,.py,.css,.log,.yaml,.yml";
const MAX_CHARS = 120000;

/** Extracts text locally in the browser: nothing is uploaded anywhere. */
export async function extractText(file) {
  if (file.size > 25 * 1024 * 1024) throw new Error(`${file.name}: file troppo grande (max 25 MB)`);
  const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
  let text = "";
  let pages = null;
  if (isPdf) {
    const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
    pages = doc.numPages;
    const parts = [];
    for (let p = 1; p <= doc.numPages && parts.join("").length < MAX_CHARS; p++) {
      const page = await doc.getPage(p);
      const tc = await page.getTextContent();
      parts.push(`\n[Pagina ${p}]\n` + tc.items.map((i) => i.str).join(" "));
    }
    text = parts.join("");
    if (!text.replace(/\[Pagina \d+\]/g, "").trim()) throw new Error(`${file.name}: PDF senza testo selezionabile (probabilmente scansionato)`);
  } else {
    text = await file.text();
  }
  const truncated = text.length > MAX_CHARS;
  return { name: file.name, size: file.size, pages, chars: Math.min(text.length, MAX_CHARS), truncated, text: text.slice(0, MAX_CHARS) };
}
