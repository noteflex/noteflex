// src/components/MarkdownContent.tsx
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface Props {
  children: string;
}

export default function MarkdownContent({ children }: Props) {
  return (
    <article className="space-y-4 leading-relaxed text-foreground/90">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h1 className="text-2xl font-bold mt-10 mb-4 text-foreground">{children}</h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-xl font-bold mt-8 mb-3 text-foreground">{children}</h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-lg font-semibold mt-6 mb-2 text-foreground">{children}</h3>
          ),
          p: ({ children }) => <p className="mb-3">{children}</p>,
          ul: ({ children }) => (
            <ul className="list-disc pl-6 mb-3 space-y-1">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal pl-6 mb-3 space-y-1">{children}</ol>
          ),
          li: ({ children }) => <li className="leading-relaxed">{children}</li>,
          a: ({ children, href }) => {
            const isExternal = href?.startsWith("http");
            return (
              <a href={href} className="text-primary underline hover:text-primary/80" target={isExternal ? "_blank" : undefined} rel={isExternal ? "noopener noreferrer" : undefined}>{children}</a>
            );
          },
          strong: ({ children }) => (
            <strong className="font-semibold text-foreground">{children}</strong>
          ),
          em: ({ children }) => <em className="italic">{children}</em>,
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-primary/40 pl-4 italic text-foreground/80 my-4">
              {children}
            </blockquote>
          ),
          hr: () => <hr className="my-8 border-border" />,
          table: ({ children }) => (
            <div className="overflow-x-auto my-4">
              <table className="min-w-full border border-border text-sm">{children}</table>
            </div>
          ),
          th: ({ children }) => (
            <th className="border border-border px-3 py-2 bg-muted font-semibold text-left">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="border border-border px-3 py-2">{children}</td>
          ),
          code: ({ children }) => (
            <code className="px-1.5 py-0.5 rounded bg-muted text-sm font-mono">{children}</code>
          ),
          pre: ({ children }) => (
            <pre className="my-4 p-4 rounded-lg bg-muted overflow-x-auto text-sm">{children}</pre>
          ),
          img: ({ src, alt }) => (
            <img
              src={src}
              alt={alt ?? ""}
              className="block mx-auto my-6 rounded-lg"
              style={{
                maxWidth: "min(100%, 600px)",
                maxHeight: "300px",
                width: "auto",
                height: "auto",
                objectFit: "contain",
              }}
              loading="lazy"
            />
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </article>
  );
}