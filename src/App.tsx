import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import {
  createFreeformClient,
  type FreeformManifest,
  type SubmitResponse,
} from "@solspace/freeform-core";
import { Freeform, FormLoader, useFreeform } from "@solspace/freeform-react";
import {
  calculationExtension,
  recommendedExtensions,
} from "@solspace/freeform-extensions";
import {
  darkTheme,
  lightTheme,
  systemTheme,
  type FreeformReactTheme,
} from "@solspace/freeform-theme-default";
import {
  bootstrapDarkTheme,
  bootstrapTheme,
} from "@solspace/freeform-theme-bootstrap";
import {
  tailwindDarkTheme,
  tailwindTheme,
} from "@solspace/freeform-theme-tailwind";
import {
  craftGraphql,
  HEADLESS_MANIFEST_QUERY,
} from "./graphql";
import { graphqlFetch as rawGraphqlFetch } from "./graphqlFetch";
import { withFakerResolvedFetch, resolveManifestFakerDefaults } from "./resolveFakerDefaults";
import { resolveCraftBaseUrl } from "./craftUrl";
import {
  buildCodeSnippet,
  displayCraftBaseUrl,
  type CodePreviewSnippetKind,
} from "./codePreview";
import { highlightSnippet } from "./highlightSnippet";
import { IconGithub, IconMoon, IconSun, IconSystem } from "./icons";
import {
  readStoredColorScheme,
  readStoredThemeSkin,
  writeStoredColorScheme,
  writeStoredThemeSkin,
} from "./themePrefs";

type ApiMode = "rest" | "graphql";
type ViewMode = "component" | "headless" | "manifest";
type StageLayout = "preview" | "code";
type ColorScheme = "light" | "dark" | "system";
type ThemeSkin = "default" | "tailwind" | "bootstrap";

const GITHUB_REPO =
  "https://github.com/solspace/freeform-headless-react-demo";

const schemeIcons = {
  light: IconSun,
  dark: IconMoon,
  system: IconSystem,
} as const;

type DraftCredentials = {
  draftToken: string | null;
  draftKey: string | null;
};

/** Same-origin proxy locally, or VITE_FREEFORM_BASE_URL on Vercel / other hosts. */
const baseUrl = resolveCraftBaseUrl(
  import.meta.env.VITE_FREEFORM_BASE_URL,
);

/** Craft URL shown in copy-paste snippets (never empty origin). */
const snippetBaseUrl = displayCraftBaseUrl(
  import.meta.env.VITE_FREEFORM_BASE_URL,
);

const demoFetch = withFakerResolvedFetch();
const graphqlFetch = withFakerResolvedFetch(rawGraphqlFetch);

const defaultHandle =
  import.meta.env.VITE_FREEFORM_HANDLE?.trim() || "contact";

/** Forms exposed for headless on demo.solspace.com (config/freeform.php). */
const DEMO_FORMS = [
  { handle: "contact", label: "Contact" },
  { handle: "jobApplication", label: "Job Application" },
  { handle: "multiplePage", label: "Multiple Page" },
  { handle: "newsletter", label: "Newsletter" },
  { handle: "quote", label: "Get a Quote" },
] as const;

const DEMO_FORM_HANDLES: ReadonlySet<string> = new Set(
  DEMO_FORMS.map((form) => form.handle),
);
const CUSTOM_HANDLE_VALUE = "__custom__";

const packageSource =
  import.meta.env.VITE_FREEFORM_PACKAGES === "local" ? "local" : "npm";

const demoExtensions = [...recommendedExtensions, calculationExtension];

const defaultThemesByScheme: Record<ColorScheme, FreeformReactTheme> = {
  light: lightTheme,
  dark: darkTheme,
  system: systemTheme,
};

function readDraftFromUrl(): DraftCredentials {
  const params = new URLSearchParams(window.location.search);
  return {
    draftToken: params.get("session-token"),
    draftKey: params.get("key"),
  };
}

function writeDraftToUrl(token: string, key: string): string {
  const url = new URL(window.location.href);
  url.searchParams.set("session-token", token);
  url.searchParams.set("key", key);
  const href = `${url.pathname}${url.search}${url.hash}`;
  window.history.replaceState({}, "", href);
  return url.toString();
}

function clearDraftFromUrl(): void {
  const url = new URL(window.location.href);
  url.searchParams.delete("session-token");
  url.searchParams.delete("key");
  window.history.replaceState(
    {},
    "",
    `${url.pathname}${url.search}${url.hash}`,
  );
}

function SubmitFeedback({
  lastSubmit,
  apiMode,
}: {
  lastSubmit: SubmitResponse;
  apiMode: ApiMode;
}) {
  return (
    <div className="submit-feedback">
      <div className="stage-divider" />
      <div
        className={`status ${lastSubmit.success ? "is-success" : "is-error"}`}
      >
        Last submit: <code>{lastSubmit.status}</code>
        {lastSubmit.complete ? " (complete)" : ""}
        <span className={`transport-tag transport-tag--${apiMode}`}>
          {apiMode.toUpperCase()}
        </span>
      </div>
      <h3 className="panel-title panel-title--sub">Last submit response</h3>
      {lastSubmit.message ? (
        <p className="submit-message">{lastSubmit.message}</p>
      ) : null}
      <pre className="submit-response-pre">
        {JSON.stringify(lastSubmit, null, 2)}
      </pre>
    </div>
  );
}

function ManifestPanel({
  handle,
  onLoaded,
  embedded = false,
}: {
  handle: string;
  onLoaded: (manifest: FreeformManifest) => void;
  embedded?: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [manifest, setManifest] = useState<FreeformManifest | null>(null);

  const client = useMemo(() => {
    const next = createFreeformClient({ baseUrl, fetch: demoFetch });
    for (const extension of demoExtensions) {
      next.extensions.register(extension);
    }
    return next;
  }, []);

  async function loadManifest() {
    setLoading(true);
    setError(null);

    try {
      const data = await client.loadManifest({ handle });
      setManifest(data);
      onLoaded(data);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Failed to load manifest.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={embedded ? undefined : "panel panel--stage"}>
      {!embedded ? <h2 className="panel-title">Form preview</h2> : null}
      <div className="controls">
        <button
          type="button"
          onClick={() => void loadManifest()}
          disabled={loading || !handle}
        >
          {loading ? "Loading…" : "Fetch manifest"}
        </button>
      </div>

      {error ? <div className="status is-error">{error}</div> : null}

      {loading ? (
        <div style={{ marginTop: "1rem" }}>
          <FormLoader
            message={`Fetching ${handle} manifest…`}
            variant="spinner"
          />
        </div>
      ) : null}

      {manifest ? (
        <pre style={{ marginTop: "1rem" }}>
          {JSON.stringify(manifest, null, 2)}
        </pre>
      ) : null}
    </div>
  );
}

function GraphqlManifestPanel({
  handle,
  onLoaded,
  embedded = false,
}: {
  handle: string;
  onLoaded: (manifest: FreeformManifest) => void;
  embedded?: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [manifest, setManifest] = useState<FreeformManifest | null>(null);

  async function loadManifest() {
    setLoading(true);
    setError(null);

    try {
      const data = await craftGraphql<{
        freeformHeadlessManifest: FreeformManifest;
      }>(HEADLESS_MANIFEST_QUERY, { handle });
      const resolved = resolveManifestFakerDefaults(
        data.freeformHeadlessManifest,
      );
      setManifest(resolved);
      onLoaded(resolved);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Failed to load GraphQL manifest.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={embedded ? undefined : "panel panel--stage"}>
      {!embedded ? <h2 className="panel-title">Form preview</h2> : null}
      <p className="panel-help">
        Raw <code>freeformHeadlessManifest</code> query (same shape as REST
        manifest <code>data</code>).
      </p>
      <div className="controls">
        <button
          type="button"
          onClick={() => void loadManifest()}
          disabled={loading || !handle}
        >
          {loading ? "Loading…" : "Fetch GraphQL manifest"}
        </button>
      </div>

      {error ? <div className="status is-error">{error}</div> : null}

      {loading ? (
        <div style={{ marginTop: "1rem" }}>
          <FormLoader
            message={`Fetching ${handle} via GraphQL…`}
            variant="spinner"
          />
        </div>
      ) : null}

      {manifest ? (
        <pre style={{ marginTop: "1rem" }}>
          {JSON.stringify(manifest, null, 2)}
        </pre>
      ) : null}
    </div>
  );
}

function HeadlessForm({
  handle,
  onSubmit,
  draftToken,
  draftKey,
  fetchImpl,
  embedded = false,
}: {
  handle: string;
  onSubmit: (response: SubmitResponse) => void;
  draftToken: string | null;
  draftKey: string | null;
  fetchImpl?: typeof fetch;
  embedded?: boolean;
}) {
  const form = useFreeform({
    handle,
    baseUrl,
    fetch: fetchImpl ?? demoFetch,
    extensions: demoExtensions,
    draftToken,
    draftKey,
    onSuccess: onSubmit,
    onError: onSubmit,
  });

  if (form.loading) {
    return (
      <FormLoader
        message={
          fetchImpl
            ? `Loading ${handle} via GraphQL…`
            : `Loading ${handle}…`
        }
      />
    );
  }

  if (form.error) {
    return <div className="status is-error">{form.error.message}</div>;
  }

  if (!form.manifest) {
    return null;
  }

  const pages = form.manifest.layout.pages;
  const currentPage = pages[form.currentPageIndex] ?? pages[0];
  const isFirstPage = form.currentPageIndex === 0;
  const isLastPage =
    pages.length === 0 || form.currentPageIndex >= pages.length - 1;
  const visibleHandles = (currentPage?.rows ?? [])
    .flatMap((row) => row.fields)
    .filter((fieldHandle) => form.isFieldVisible(fieldHandle));

  return (
    <form
      className={embedded ? "headless-form" : "headless-form panel panel--stage"}
      onSubmit={form.handleSubmit}
    >
      {!embedded ? <h2 className="panel-title">Form preview</h2> : null}
      <p>
        Headless mode: you own the markup. Core still loads the manifest,
        manages state, and submits
        {fetchImpl ? (
          <>
            {" "}
            via <code>fetch={"{graphqlFetch}"}</code>
          </>
        ) : null}
        .
      </p>

      {form.formErrors.map((message) => (
        <div key={message} className="status is-error">
          {message}
        </div>
      ))}
      {form.pageErrors.map((message) => (
        <div key={message} className="status is-error">
          {message}
        </div>
      ))}

      {visibleHandles.map((fieldHandle) => {
        const field = form.manifest!.fields[fieldHandle];
        if (field.type === "hidden" || field.type === "html") {
          return null;
        }

        const props = form.getFieldProps(fieldHandle);

        return (
          <label key={fieldHandle}>
            {field.label}
            {field.type === "textarea" ? (
              <textarea
                {...props}
                value={String(form.values[fieldHandle] ?? "")}
              />
            ) : (
              <input
                {...props}
                type={field.type === "email" ? "email" : "text"}
                value={String(form.values[fieldHandle] ?? "")}
              />
            )}
            {(form.fieldErrors[fieldHandle] ?? []).map((message) => (
              <span key={message} className="status is-error">
                {message}
              </span>
            ))}
          </label>
        );
      })}

      <div className="controls" style={{ display: "flex", gap: "0.5rem" }}>
        {!isFirstPage && currentPage?.buttons.back ? (
          <button
            type="button"
            disabled={form.isSubmitting}
            onClick={() => void form.goBack()}
          >
            {currentPage.buttons.back.label}
          </button>
        ) : null}
        {!isLastPage && currentPage?.buttons.submit ? (
          <button
            type="button"
            disabled={form.isSubmitting}
            onClick={() => void form.goNext()}
          >
            {form.isSubmitting ? "Loading…" : currentPage.buttons.submit.label}
          </button>
        ) : null}
        {isLastPage && currentPage?.buttons.submit ? (
          <button type="submit" disabled={form.isSubmitting}>
            {form.isSubmitting ? "Submitting…" : currentPage.buttons.submit.label}
          </button>
        ) : null}
        {currentPage?.buttons.save ? (
          <button
            type="button"
            disabled={form.isSubmitting}
            onClick={() => void form.saveDraft()}
          >
            {currentPage.buttons.save.label}
          </button>
        ) : null}
      </div>

      {form.isComplete && form.successMessage ? (
        <div className="status is-success">{form.successMessage}</div>
      ) : null}
    </form>
  );
}

function CodePreviewPanel({
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
        <div className="view-picker view-picker--compact" role="tablist" aria-label="Code snippet">
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
        <button type="button" className="code-preview__copy" onClick={() => void copy()}>
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

function ComponentForm({
  handle,
  onSubmit,
  theme,
  draftToken,
  draftKey,
  fetchImpl,
  previewDark,
  embedded = false,
}: {
  handle: string;
  onSubmit: (response: SubmitResponse) => void;
  theme: FreeformReactTheme;
  draftToken: string | null;
  draftKey: string | null;
  fetchImpl?: typeof fetch;
  previewDark?: boolean;
  embedded?: boolean;
}) {
  return (
    <div className={previewDark ? "panel--bootstrap-dark" : undefined}>
      {!embedded ? <h2 className="panel-title">Form preview</h2> : null}
      <Freeform
        key={`${fetchImpl ? "gql" : "rest"}:${handle}:${draftToken ?? ""}:${draftKey ?? ""}`}
        handle={handle}
        baseUrl={baseUrl}
        fetch={fetchImpl ?? demoFetch}
        theme={theme}
        extensions={demoExtensions}
        draftToken={draftToken}
        draftKey={draftKey}
        allowRawHtml
        loadingMessage={
          fetchImpl
            ? `Loading ${handle} via GraphQL…`
            : `Loading ${handle}…`
        }
        onSuccess={onSubmit}
        onError={onSubmit}
      />
    </div>
  );
}

export function App() {
  const initialDraft = useMemo(() => readDraftFromUrl(), []);
  const [handleDraft, setHandleDraft] = useState(defaultHandle);
  const [handle, setHandle] = useState(defaultHandle);
  const [apiMode, setApiMode] = useState<ApiMode>("rest");
  const [mode, setMode] = useState<ViewMode>("component");
  const [stageLayout, setStageLayout] = useState<StageLayout>("preview");
  const [colorScheme, setColorScheme] = useState<ColorScheme>(() =>
    readStoredColorScheme("system"),
  );
  const [themeSkin, setThemeSkin] = useState<ThemeSkin>(() =>
    readStoredThemeSkin("default"),
  );
  const [prefersDark, setPrefersDark] = useState(false);
  const [lastSubmit, setLastSubmit] = useState<SubmitResponse | null>(null);
  const [manifestInfo, setManifestInfo] = useState<string | null>(null);
  const [draft, setDraft] = useState<DraftCredentials>(initialDraft);
  const [resumeUrl, setResumeUrl] = useState<string | null>(() => {
    if (initialDraft.draftToken && initialDraft.draftKey) {
      return window.location.href;
    }
    return null;
  });
  const theme = useMemo(() => {
    const useDark =
      colorScheme === "dark" || (colorScheme === "system" && prefersDark);

    if (themeSkin === "tailwind") {
      return useDark ? tailwindDarkTheme : tailwindTheme;
    }

    if (themeSkin === "bootstrap") {
      return useDark ? bootstrapDarkTheme : bootstrapTheme;
    }

    return defaultThemesByScheme[colorScheme];
  }, [themeSkin, colorScheme, prefersDark]);
  const bootstrapPreviewDark =
    themeSkin === "bootstrap" &&
    (colorScheme === "dark" ||
      (colorScheme === "system" && prefersDark));
  const hasGraphqlToken = Boolean(import.meta.env.VITE_GRAPHQL_TOKEN?.trim());
  const transportFetch = apiMode === "graphql" ? graphqlFetch : undefined;

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const sync = () => setPrefersDark(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (colorScheme === "system") {
      delete document.documentElement.dataset.theme;
    } else {
      document.documentElement.dataset.theme = colorScheme;
    }
    writeStoredColorScheme(colorScheme);
  }, [colorScheme]);

  useEffect(() => {
    writeStoredThemeSkin(themeSkin);
  }, [themeSkin]);

  const handleSubmitResponse = useCallback((response: SubmitResponse) => {
    setLastSubmit(response);

    if (
      response.status === "draft_saved" &&
      response.draft?.token &&
      response.draft?.key
    ) {
      const { token, key } = response.draft;
      const url = writeDraftToUrl(token, key);
      // Keep existing form mounted — only sync URL + resume hint.
      // Form state already holds values + draft tokens from applySubmitResponse.
      setDraft((current) =>
        current.draftToken === token && current.draftKey === key
          ? current
          : {
              draftToken: token,
              draftKey: key,
            },
      );
      setResumeUrl(url);
      return;
    }

    if (response.complete && response.success) {
      clearDraftFromUrl();
      setDraft({ draftToken: null, draftKey: null });
      setResumeUrl(null);
    }
  }, []);

  function loadHandle(next: string) {
    const trimmed = next.trim();
    if (!trimmed) {
      return;
    }
    setHandleDraft(trimmed);
    setHandle(trimmed);
    setLastSubmit(null);
    setManifestInfo(null);
  }

  function applyHandle(event: FormEvent) {
    event.preventDefault();
    loadHandle(handleDraft);
  }

  function onFormSelect(event: ChangeEvent<HTMLSelectElement>) {
    const value = event.target.value;
    if (value === CUSTOM_HANDLE_VALUE) {
      setHandleDraft("");
      return;
    }
    loadHandle(value);
  }

  const formSelectValue = DEMO_FORM_HANDLES.has(handleDraft)
    ? handleDraft
    : CUSTOM_HANDLE_VALUE;

  function switchApiMode(next: ApiMode) {
    if (next === "graphql" && !hasGraphqlToken) {
      return;
    }
    setApiMode(next);
    setLastSubmit(null);
    setManifestInfo(null);
  }

  return (
    <div className="app" data-theme={colorScheme}>
      <header className="app-header">
        <div className="header-row">
          <h1 className="header-brand">
            <img
              className="header-brand__icon"
              src={`${import.meta.env.BASE_URL}solspace-icon.png`}
              alt=""
              width={32}
              height={32}
            />
            <span>
              Freeform Headless React Demo
              <span className="package-source">{packageSource}</span>
            </span>
          </h1>
          <div className="header-row__controls">
            <div
              className="scheme-toggle"
              role="group"
              aria-label="Form theme"
            >
              {(["default", "tailwind", "bootstrap"] as const).map((skin) => (
                <button
                  key={skin}
                  type="button"
                  className={`scheme-toggle__btn ${themeSkin === skin ? "is-active" : ""}`}
                  onClick={() => setThemeSkin(skin)}
                >
                  {skin === "default"
                    ? "Default"
                    : skin === "tailwind"
                      ? "Tailwind"
                      : "Bootstrap"}
                </button>
              ))}
            </div>
            <div
              className="scheme-toggle scheme-toggle--icons"
              role="group"
              aria-label="Color scheme"
            >
              {(["light", "dark", "system"] as const).map((scheme) => {
                const Icon = schemeIcons[scheme];
                return (
                  <button
                    key={scheme}
                    type="button"
                    className={`scheme-toggle__btn scheme-toggle__btn--icon ${colorScheme === scheme ? "is-active" : ""}`}
                    aria-label={
                      scheme === "light"
                        ? "Light"
                        : scheme === "dark"
                          ? "Dark"
                          : "System"
                    }
                    aria-pressed={colorScheme === scheme}
                    title={
                      scheme === "light"
                        ? "Light"
                        : scheme === "dark"
                          ? "Dark"
                          : "System"
                    }
                    onClick={() => setColorScheme(scheme)}
                  >
                    <Icon />
                  </button>
                );
              })}
            </div>
            <a
              className="header-github"
              href={GITHUB_REPO}
              target="_blank"
              rel="noreferrer"
              title="View on GitHub"
              aria-label="View on GitHub"
            >
              <IconGithub />
            </a>
          </div>
        </div>
        <p className="header-lead">
          {packageSource === "local" ? (
            <>
              Using sibling Craft Freeform packages. Set{" "}
              <code>FREEFORM_PACKAGES=npm</code> (or <code>pnpm dev:npm</code>)
              to switch to npmjs.com.
            </>
          ) : (
            <>
              Official <code>@solspace/freeform-*</code> packages from npm. Set{" "}
              <code>FREEFORM_PACKAGES=local</code> (or <code>pnpm dev:local</code>
              ) to use the Craft checkout.
            </>
          )}{" "}
          Choose <strong>REST</strong> or <strong>GraphQL</strong>, then try{" "}
          <code>&lt;Freeform /&gt;</code>, <code>useFreeform()</code>, or
          Manifest JSON.
        </p>
      </header>

      <div className="demo-layout">
        <aside className="demo-sidebar">
          <section className="panel panel--sidebar panel--controls">
            <h2 className="panel-title">Form settings</h2>
            <p className="panel-help">
              Pick a demo form exposed for headless, or choose{" "}
              <strong>Custom handle</strong> for any other Freeform handle.
              Default comes from <code>VITE_FREEFORM_HANDLE</code>.
            </p>
            <form className="handle-form" onSubmit={applyHandle}>
              <label>
                Form
                <select
                  value={formSelectValue}
                  onChange={onFormSelect}
                  aria-label="Form handle"
                >
                  {DEMO_FORMS.map((form) => (
                    <option key={form.handle} value={form.handle}>
                      {form.label} ({form.handle})
                    </option>
                  ))}
                  <option value={CUSTOM_HANDLE_VALUE}>Custom handle…</option>
                </select>
              </label>
              {formSelectValue === CUSTOM_HANDLE_VALUE ? (
                <>
                  <label>
                    Custom handle
                    <input
                      value={handleDraft}
                      onChange={(event) => setHandleDraft(event.target.value)}
                      placeholder="yourFormHandle"
                      autoComplete="off"
                      spellCheck={false}
                    />
                  </label>
                  <button type="submit">Load form</button>
                </>
              ) : null}
            </form>
            <p className="panel-meta">
              Active handle: <code>{handle}</code>
            </p>

            <div className="sidebar-divider" />

            <div className="demo-toolbar demo-toolbar--embedded">
              <div className="demo-toolbar__head">
                <h2 className="panel-title">Try the form</h2>
                <p className="panel-help demo-toolbar__lead">
                  Pick how the demo talks to Craft, then choose a React
                  integration style.
                </p>
              </div>

              <div className="demo-toolbar__section">
                <span className="demo-toolbar__label">API transport</span>
                <div className="api-picker" role="tablist" aria-label="API mode">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={apiMode === "rest"}
                    className={`api-picker__option api-picker__option--rest ${apiMode === "rest" ? "is-active" : ""}`}
                    onClick={() => switchApiMode("rest")}
                  >
                    <span className="api-picker__title">REST</span>
                    <span className="api-picker__desc">
                      <code>/freeform</code> headless endpoints
                    </span>
                    <span className="api-picker__badge">Default</span>
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={apiMode === "graphql"}
                    className={`api-picker__option api-picker__option--graphql ${apiMode === "graphql" ? "is-active" : ""}`}
                    onClick={() => switchApiMode("graphql")}
                    title={
                      hasGraphqlToken
                        ? undefined
                        : "Set VITE_GRAPHQL_TOKEN in .env to enable GraphQL"
                    }
                    disabled={!hasGraphqlToken}
                  >
                    <span className="api-picker__title">GraphQL</span>
                    <span className="api-picker__desc">
                      Craft <code>freeformHeadless*</code> adapters
                    </span>
                    {!hasGraphqlToken ? (
                      <span className="api-picker__badge api-picker__badge--muted">
                        Token required
                      </span>
                    ) : null}
                  </button>
                </div>
              </div>

              <div className="demo-toolbar__section">
                <span className="demo-toolbar__label">Demo view</span>
                <div className="view-picker" role="tablist" aria-label="Demo view">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={mode === "component"}
                    className={`view-picker__tab ${mode === "component" ? "is-active" : ""}`}
                    onClick={() => setMode("component")}
                  >
                    &lt;Freeform /&gt;
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={mode === "headless"}
                    className={`view-picker__tab ${mode === "headless" ? "is-active" : ""}`}
                    onClick={() => setMode("headless")}
                  >
                    useFreeform()
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={mode === "manifest"}
                    className={`view-picker__tab ${mode === "manifest" ? "is-active" : ""}`}
                    onClick={() => setMode("manifest")}
                  >
                    Manifest JSON
                  </button>
                </div>
              </div>

              {!hasGraphqlToken ? (
                <p className="demo-callout demo-callout--info">
                  Add <code>VITE_GRAPHQL_TOKEN</code> to <code>.env</code> to
                  unlock GraphQL (Craft schema: form read + submit + site
                  access).
                </p>
              ) : apiMode === "graphql" ? (
                <p className="demo-callout demo-callout--graphql">
                  GraphQL mode passes <code>fetch={"{graphqlFetch}"}</code> to the
                  React packages. File uploads still use REST multipart.
                </p>
              ) : (
                <p className="demo-callout demo-callout--rest">
                  REST mode uses the official headless API — best starting point
                  for new projects.
                </p>
              )}
            </div>

            {(manifestInfo || resumeUrl) && (
              <div className="demo-feedback">
                {manifestInfo ? (
                  <div className="status">
                    Loaded manifest: <strong>{manifestInfo}</strong>
                  </div>
                ) : null}

                {resumeUrl ? (
                  <div className="status is-success">
                    <strong>Resume URL</strong> (copy / refresh to restore a
                    saved draft):
                    <div className="resume-url">
                      <code>{resumeUrl}</code>
                    </div>
                    <p className="resume-hint">
                      Query params: <code>session-token</code> + <code>key</code>
                    </p>
                  </div>
                ) : null}
              </div>
            )}
          </section>
        </aside>

        <main className="demo-stage" aria-label="Form stage">
          <div
            className={`panel panel--stage${bootstrapPreviewDark && mode === "component" && stageLayout === "preview" ? " panel--bootstrap-dark" : ""}`}
          >
            {mode !== "manifest" ? (
              <div className="stage-header">
                <div
                  className="view-picker view-picker--compact"
                  role="tablist"
                  aria-label="Stage layout"
                >
                  <button
                    type="button"
                    role="tab"
                    aria-selected={stageLayout === "preview"}
                    className={`view-picker__tab ${stageLayout === "preview" ? "is-active" : ""}`}
                    onClick={() => setStageLayout("preview")}
                  >
                    Preview
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={stageLayout === "code"}
                    className={`view-picker__tab ${stageLayout === "code" ? "is-active" : ""}`}
                    onClick={() => setStageLayout("code")}
                  >
                    Code
                  </button>
                </div>
              </div>
            ) : null}

            {mode === "manifest" ? (
              <>
                {apiMode === "rest" ? (
                  <ManifestPanel
                    key={`rest:${handle}`}
                    embedded
                    handle={handle}
                    onLoaded={(manifest) =>
                      setManifestInfo(
                        `${manifest.form.handle} (${Object.keys(manifest.fields).length} fields) · REST`,
                      )
                    }
                  />
                ) : (
                  <GraphqlManifestPanel
                    key={`gql:${handle}`}
                    embedded
                    handle={handle}
                    onLoaded={(manifest) =>
                      setManifestInfo(
                        `${manifest.form.handle} (${Object.keys(manifest.fields).length} fields) · GraphQL`,
                      )
                    }
                  />
                )}
              </>
            ) : (
              <div
                className={`stage-flip ${stageLayout === "code" ? "is-code" : "is-preview"}`}
                key={stageLayout}
              >
                {stageLayout === "preview" ? (
                  <div className="stage-flip__face">
                    {mode === "component" ? (
                      <ComponentForm
                        key={`${apiMode}:${handle}`}
                        embedded
                        handle={handle}
                        onSubmit={handleSubmitResponse}
                        theme={theme}
                        draftToken={draft.draftToken}
                        draftKey={draft.draftKey}
                        fetchImpl={transportFetch}
                        previewDark={bootstrapPreviewDark}
                      />
                    ) : null}

                    {mode === "headless" ? (
                      <HeadlessForm
                        key={`${apiMode}:${handle}`}
                        embedded
                        handle={handle}
                        onSubmit={handleSubmitResponse}
                        draftToken={draft.draftToken}
                        draftKey={draft.draftKey}
                        fetchImpl={transportFetch}
                      />
                    ) : null}
                  </div>
                ) : (
                  <div className="stage-flip__face">
                    <CodePreviewPanel
                      handle={handle}
                      apiMode={apiMode}
                      themeSkin={themeSkin}
                    />
                  </div>
                )}
              </div>
            )}

            {lastSubmit && stageLayout === "preview" ? (
              <SubmitFeedback lastSubmit={lastSubmit} apiMode={apiMode} />
            ) : null}
          </div>
        </main>
      </div>
    </div>
  );
}
