export type CodePreviewApiMode = "rest" | "graphql";
export type CodePreviewThemeSkin = "default" | "tailwind" | "bootstrap";
export type CodePreviewSnippetKind = "freeform" | "useFreeform";

export type CodePreviewOptions = {
  handle: string;
  apiMode: CodePreviewApiMode;
  themeSkin: CodePreviewThemeSkin;
  /** Public Craft URL shown in snippets (never empty origin). */
  baseUrl: string;
  framework: "react" | "vue";
};

/** Prefer configured Craft URL; otherwise a placeholder for copy-paste. */
export function displayCraftBaseUrl(configured?: string | null): string {
  const fromEnv = configured?.trim();
  if (fromEnv) {
    return fromEnv.replace(/\/+$/, "");
  }
  return "https://your-craft-site.test";
}

function themeImportBlock(
  framework: "react" | "vue",
  skin: CodePreviewThemeSkin,
): { imports: string; themeExpr: string; cssNotes: string } {
  if (skin === "tailwind") {
    return {
      imports:
        framework === "react"
          ? `import { tailwindTheme } from '@solspace/freeform-theme-tailwind';`
          : `import { tailwindTheme } from '@solspace/freeform-theme-tailwind';`,
      themeExpr: "tailwindTheme",
      cssNotes:
        "// Wire Tailwind per @solspace/freeform-theme-tailwind docs (utilities + @source).",
    };
  }

  if (skin === "bootstrap") {
    return {
      imports: `import { bootstrapTheme } from '@solspace/freeform-theme-bootstrap';
import 'bootstrap/dist/css/bootstrap.min.css';
import '@solspace/freeform-theme-bootstrap/styles.css';`,
      themeExpr: "bootstrapTheme",
      cssNotes: "",
    };
  }

  return {
    imports: `import { lightTheme } from '@solspace/freeform-theme-default';
import '@solspace/freeform-theme-default/styles.css';`,
    themeExpr: "lightTheme",
    cssNotes: "",
  };
}

function graphqlImportNote(framework: "react" | "vue"): string {
  if (framework === "react") {
    return `// Copy graphqlFetch from the Freeform headless React demo (REST → GraphQL adapter).
import { graphqlFetch } from './graphqlFetch';`;
  }
  return `// Copy graphqlFetch from the Freeform headless Vue / Nuxt demo (REST → GraphQL adapter).
import { graphqlFetch } from './graphqlFetch';`;
}

export function buildFreeformSnippet(options: CodePreviewOptions): string {
  const { handle, apiMode, themeSkin, baseUrl, framework } = options;
  const theme = themeImportBlock(framework, themeSkin);
  const isGql = apiMode === "graphql";

  if (framework === "react") {
    const lines = [
      `import { Freeform } from '@solspace/freeform-react';`,
      `import { recommendedExtensions } from '@solspace/freeform-extensions';`,
      theme.imports,
      ...(isGql ? [graphqlImportNote("react")] : []),
      ...(theme.cssNotes ? [theme.cssNotes] : []),
      ``,
      `export function ContactForm() {`,
      `  return (`,
      `    <Freeform`,
      `      handle="${handle}"`,
      `      baseUrl="${baseUrl}"`,
      ...(isGql ? [`      fetch={graphqlFetch}`] : []),
      `      theme={${theme.themeExpr}}`,
      `      extensions={recommendedExtensions}`,
      `    />`,
      `  );`,
      `}`,
    ];
    return lines.join("\n");
  }

  const lines = [
    `<script setup lang="ts">`,
    `import { Freeform } from '@solspace/freeform-vue';`,
    `import { recommendedExtensions } from '@solspace/freeform-extensions';`,
    theme.imports,
    ...(isGql ? [graphqlImportNote("vue")] : []),
    ...(theme.cssNotes ? [theme.cssNotes] : []),
    `</script>`,
    ``,
    `<template>`,
    `  <Freeform`,
    `    handle="${handle}"`,
    `    base-url="${baseUrl}"`,
    ...(isGql ? [`    :fetch="graphqlFetch"`] : []),
    `    :theme="${theme.themeExpr}"`,
    `    :extensions="recommendedExtensions"`,
    `  />`,
    `</template>`,
  ];
  return lines.join("\n");
}

export function buildUseFreeformSnippet(options: CodePreviewOptions): string {
  const { handle, apiMode, baseUrl, framework } = options;
  const isGql = apiMode === "graphql";

  if (framework === "react") {
    const lines = [
      `import { useFreeform, FormLoader } from '@solspace/freeform-react';`,
      `import { recommendedExtensions } from '@solspace/freeform-extensions';`,
      ...(isGql ? [graphqlImportNote("react")] : []),
      ``,
      `export function ContactForm() {`,
      `  const form = useFreeform({`,
      `    handle: '${handle}',`,
      `    baseUrl: '${baseUrl}',`,
      ...(isGql ? [`    fetch: graphqlFetch,`] : []),
      `    extensions: recommendedExtensions,`,
      `  });`,
      ``,
      `  if (form.status === 'loading' || !form.manifest) {`,
      `    return <FormLoader message="Loading…" />;`,
      `  }`,
      ``,
      `  return (`,
      `    <form onSubmit={(event) => void form.submit(event)}>`,
      `      {/* Map form.pages / form.fields — see the headless demo HeadlessForm */}`,
      `      <button type="submit" disabled={form.submitting}>`,
      `        Submit`,
      `      </button>`,
      `    </form>`,
      `  );`,
      `}`,
    ];
    return lines.join("\n");
  }

  const lines = [
    `<script setup lang="ts">`,
    `import { useFreeform } from '@solspace/freeform-vue';`,
    `import { recommendedExtensions } from '@solspace/freeform-extensions';`,
    ...(isGql ? [graphqlImportNote("vue")] : []),
    ``,
    `const form = useFreeform({`,
    `  handle: '${handle}',`,
    `  baseUrl: '${baseUrl}',`,
    ...(isGql ? [`  fetch: graphqlFetch,`] : []),
    `  extensions: recommendedExtensions,`,
    `});`,
    `</script>`,
    ``,
    `<template>`,
    `  <form v-if="form.manifest" @submit.prevent="form.submit()">`,
    `    <!-- Map form.pages / form.fields — see the headless demo HeadlessForm -->`,
    `    <button type="submit" :disabled="form.submitting">Submit</button>`,
    `  </form>`,
    `</template>`,
  ];
  return lines.join("\n");
}

export function buildCodeSnippet(
  kind: CodePreviewSnippetKind,
  options: CodePreviewOptions,
): string {
  return kind === "freeform"
    ? buildFreeformSnippet(options)
    : buildUseFreeformSnippet(options);
}
