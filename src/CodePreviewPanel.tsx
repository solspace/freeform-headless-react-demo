import { useCallback, useEffect, useMemo, useState } from "react";
import {
  buildCodeSnippet,
  displayCraftBaseUrl,
  type CodePreviewSnippetKind,
} from "./codePreview";
import { highlightSnippet } from "./highlightSnippet";

type ApiMode = "rest" | "graphql";
type ThemeSkin = "default" | "tailwind" | "bootstrap";

const snippetBaseUrl = displayCraftBaseUrl(
  import.meta.env.VITE_FREEFORM_BASE_URL,
);

export default function CodePreviewPanel({
  handle,
  apiMode,
  themeSkin,
}: {
  handle: string;
  apiMode: ApiMode;
  themeSkin: ThemeSkin;
}) {
  const [kind, setKind] = useState<CodePreviewSnippetKind>("freeform");
  const [copied, setCopied] = useState(false);
  const [highlightedHtml, setHighlightedHtml] = useState<string>("");

  const code = useMemo(
    () =>
      buildCodeSnippet(kind, {
        handle,
        apiMode,
        themeSkin,
        baseUrl: snippetBaseUrl,
        framework: "react",
      }),
    [kind, handle, apiMode, themeSkin],
  );

  useEffect(() => {
    let cancelled = false;
    setHighlightedHtml("");
    void highlightSnippet(code, "tsx").then((html) => {
      if (!cancelled) setHighlightedHtml(html);
    });
    return () => {
      cancelled = true;
    };
  }, [code]);

  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }, [code]);

  return (
    <div className="code-preview">
      <div className="code-preview__toolbar">
        <div
          className="view-picker view-picker--compact"
          role="tablist"
          aria-label="Code snippet"
        >
          <button
            type="button"
            role="tab"
            aria-selected={kind === "freeform"}
            className={`view-picker__tab ${kind === "freeform" ? "is-active" : ""}`}
            onClick={() => setKind("freeform")}
          >
            {"<Freeform />"}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={kind === "useFreeform"}
            className={`view-picker__tab ${kind === "useFreeform" ? "is-active" : ""}`}
            onClick={() => setKind("useFreeform")}
          >
            useFreeform()
          </button>
        </div>
        <button
          type="button"
          className="code-preview__copy"
          onClick={() => void copy()}
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      {highlightedHtml ? (
        <div
          className="code-preview__shiki"
          dangerouslySetInnerHTML={{ __html: highlightedHtml }}
        />
      ) : (
        <pre className="code-preview__pre">{code}</pre>
      )}
    </div>
  );
}
