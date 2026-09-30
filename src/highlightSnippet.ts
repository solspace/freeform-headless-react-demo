export type HighlightLang = "tsx" | "vue";

type Highlighter = {
  codeToHtml: (
    code: string,
    options: { lang: string; theme: string },
  ) => string;
};

let highlighterPromise: Promise<Highlighter> | null = null;

function getHighlighter(): Promise<Highlighter> {
  if (!highlighterPromise) {
    highlighterPromise = import("shiki").then(({ createHighlighter }) =>
      createHighlighter({
        themes: ["github-dark"],
        langs: ["tsx", "vue"],
      }),
    );
  }
  return highlighterPromise;
}

/** Lazy Shiki highlight — only loads when Code preview is opened. */
export async function highlightSnippet(
  code: string,
  lang: HighlightLang,
): Promise<string> {
  const highlighter = await getHighlighter();
  return highlighter.codeToHtml(code, {
    lang,
    theme: "github-dark",
  });
}
