import ReactMarkdown from "react-markdown";
import rehypeSanitize from "rehype-sanitize";

const safeUrl = (url) => (/^(https?:|mailto:|#|\/)/i.test(url || "") ? url : "#");

/** Markdown renderer hardened against XSS: raw HTML skipped, output sanitized, only safe URLs. */
export default function SafeMarkdown({ children }) {
  return (
    <ReactMarkdown
      skipHtml
      rehypePlugins={[rehypeSanitize]}
      urlTransform={safeUrl}
      components={{ a: ({ node, ...p }) => <a {...p} target="_blank" rel="noopener noreferrer nofollow" className="text-primary underline underline-offset-2" /> }}
    >
      {String(children || "")}
    </ReactMarkdown>
  );
}
