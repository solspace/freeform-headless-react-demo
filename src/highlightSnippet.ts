import { codeToHtml } from "shiki";

export type HighlightLang = "tsx" | "vue";

/** Shiki HTML for demo code panels (github-dark). */
export async function highlightSnippet(
  code: string,
  lang: HighlightLang,
): Promise<string> {
  return codeToHtml(code, {
    lang,
    theme: "github-dark",
  });
}
