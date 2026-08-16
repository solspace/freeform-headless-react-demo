import {
  useCallback,
  useEffect,
  useMemo,
  useState,
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
} from "@solspace/freeform-react-theme-default";
import {
  craftGraphql,
  HEADLESS_MANIFEST_QUERY,
} from "./graphql";
import { graphqlFetch } from "./graphqlFetch";

type ApiMode = "rest" | "graphql";
type ViewMode = "component" | "headless" | "manifest";
type ColorScheme = "light" | "dark" | "system";

type DraftCredentials = {
  draftToken: string | null;
  draftKey: string | null;
};

/** Same-origin — Vite proxies `/freeform` to Craft (see vite.config.ts). */
const baseUrl = typeof window !== "undefined" ? window.location.origin : "";

const defaultHandle =
  import.meta.env.VITE_FREEFORM_HANDLE?.trim() || "contact";

const demoExtensions = [...recommendedExtensions, calculationExtension];

const themesByScheme: Record<ColorScheme, FreeformReactTheme> = {
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

function ManifestPanel({
  handle,
  onLoaded,
}: {
  handle: string;
  onLoaded: (manifest: FreeformManifest) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [manifest, setManifest] = useState<FreeformManifest | null>(null);

  const client = useMemo(() => {
    const next = createFreeformClient({ baseUrl });
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
    <div className="panel">
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
}: {
  handle: string;
  onLoaded: (manifest: FreeformManifest) => void;
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
      setManifest(data.freeformHeadlessManifest);
      onLoaded(data.freeformHeadlessManifest);
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
    <div className="panel">
      <p>
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
}: {
  handle: string;
  onSubmit: (response: SubmitResponse) => void;
  draftToken: string | null;
  draftKey: string | null;
  fetchImpl?: typeof fetch;
}) {
  const form = useFreeform({
    handle,
    baseUrl,
    fetch: fetchImpl,
    extensions: demoExtensions,
    draftToken,
    draftKey,
    onSuccess: onSubmit,
    onError: onSubmit,
  });

  if (form.loading) {
    return (
      <div className="panel">
        <FormLoader
          message={
            fetchImpl
              ? `Loading ${handle} via GraphQL…`
              : `Loading ${handle}…`
          }
        />
      </div>
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
    <form className="headless-form panel" onSubmit={form.handleSubmit}>
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

function ComponentForm({
  handle,
  onSubmit,
  theme,
  draftToken,
  draftKey,
  fetchImpl,
}: {
  handle: string;
  onSubmit: (response: SubmitResponse) => void;
  theme: FreeformReactTheme;
  draftToken: string | null;
  draftKey: string | null;
  fetchImpl?: typeof fetch;
}) {
  return (
    <div className="panel">
      {fetchImpl ? (
        <pre className="panel-meta" style={{ marginBottom: "1rem" }}>
          {`<Freeform
  handle="${handle}"
  baseUrl={window.location.origin}
  fetch={graphqlFetch}
  extensions={recommendedExtensions}
/>`}
        </pre>
      ) : null}
      <Freeform
        key={`${fetchImpl ? "gql" : "rest"}:${handle}:${draftToken ?? ""}:${draftKey ?? ""}`}
        handle={handle}
        baseUrl={baseUrl}
        fetch={fetchImpl}
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
  const [colorScheme, setColorScheme] = useState<ColorScheme>("system");
  const [lastSubmit, setLastSubmit] = useState<SubmitResponse | null>(null);
  const [manifestInfo, setManifestInfo] = useState<string | null>(null);
  const [draft, setDraft] = useState<DraftCredentials>(initialDraft);
  const [resumeUrl, setResumeUrl] = useState<string | null>(() => {
    if (initialDraft.draftToken && initialDraft.draftKey) {
      return window.location.href;
    }
    return null;
  });
  const theme = themesByScheme[colorScheme];
  const hasGraphqlToken = Boolean(import.meta.env.VITE_GRAPHQL_TOKEN?.trim());
  const transportFetch = apiMode === "graphql" ? graphqlFetch : undefined;

  useEffect(() => {
    if (colorScheme === "system") {
      delete document.documentElement.dataset.theme;
    } else {
      document.documentElement.dataset.theme = colorScheme;
    }
  }, [colorScheme]);

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

  function applyHandle(event: FormEvent) {
    event.preventDefault();
    const next = handleDraft.trim();
    if (!next) {
      return;
    }
    setHandle(next);
    setLastSubmit(null);
    setManifestInfo(null);
  }

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
      <header>
        <div className="header-row">
          <div className="header-row__copy">
            <h1>Freeform Headless React Demo</h1>
            <p>
              Official <code>@solspace/freeform-*</code> packages from npm.
              Choose <strong>REST</strong> or <strong>GraphQL</strong>, then try{" "}
              <code>&lt;Freeform /&gt;</code>, <code>useFreeform()</code>, or
              Manifest JSON.
            </p>
          </div>
          <div
            className="scheme-toggle"
            role="group"
            aria-label="Color scheme"
          >
            {(["light", "dark", "system"] as const).map((scheme) => (
              <button
                key={scheme}
                type="button"
                className={`scheme-toggle__btn ${colorScheme === scheme ? "is-active" : ""}`}
                onClick={() => setColorScheme(scheme)}
              >
                {scheme === "light"
                  ? "Light"
                  : scheme === "dark"
                    ? "Dark"
                    : "System"}
              </button>
            ))}
          </div>
        </div>
      </header>

      <section className="panel">
        <h2 className="panel-title">Form settings</h2>
        <p className="panel-help">
          Use any Freeform form handle that is exposed for headless (see
          README). Default comes from <code>VITE_FREEFORM_HANDLE</code>.
        </p>
        <form className="handle-form" onSubmit={applyHandle}>
          <label>
            Form handle
            <input
              value={handleDraft}
              onChange={(event) => setHandleDraft(event.target.value)}
              placeholder="contact"
              autoComplete="off"
              spellCheck={false}
            />
          </label>
          <button type="submit">Load form</button>
        </form>
        <p className="panel-meta">
          Active handle: <code>{handle}</code>
        </p>
      </section>

      <section className="panel panel--demo">
        <div className="demo-toolbar">
          <div className="demo-toolbar__head">
            <h2 className="panel-title">Try the form</h2>
            <p className="panel-help demo-toolbar__lead">
              Pick how the demo talks to Craft, then choose a React integration
              style.
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
              Add <code>VITE_GRAPHQL_TOKEN</code> to <code>.env</code> to unlock
              GraphQL (Craft schema: form read + submit + site access).
            </p>
          ) : apiMode === "graphql" ? (
            <p className="demo-callout demo-callout--graphql">
              GraphQL mode passes <code>fetch={"{graphqlFetch}"}</code> to the
              React packages. File uploads still use REST multipart.
            </p>
          ) : (
            <p className="demo-callout demo-callout--rest">
              REST mode uses the official headless API — best starting point for
              new projects.
            </p>
          )}
        </div>

        {(manifestInfo || lastSubmit || resumeUrl) && (
          <div className="demo-feedback">
            {manifestInfo ? (
              <div className="status">
                Loaded manifest: <strong>{manifestInfo}</strong>
              </div>
            ) : null}

            {lastSubmit ? (
              <div
                className={`status ${lastSubmit.success ? "is-success" : "is-error"}`}
              >
                Last submit: <code>{lastSubmit.status}</code>
                {lastSubmit.complete ? " (complete)" : ""}
                <span
                  className={`transport-tag transport-tag--${apiMode}`}
                >
                  {apiMode.toUpperCase()}
                </span>
              </div>
            ) : null}

            {resumeUrl ? (
              <div className="status is-success">
                <strong>Resume URL</strong> (copy / refresh to restore a saved
                draft):
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

      {mode === "component" ? (
        <ComponentForm
          key={`${apiMode}:${handle}`}
          handle={handle}
          onSubmit={handleSubmitResponse}
          theme={theme}
          draftToken={draft.draftToken}
          draftKey={draft.draftKey}
          fetchImpl={transportFetch}
        />
      ) : null}

      {mode === "headless" ? (
        <HeadlessForm
          key={`${apiMode}:${handle}`}
          handle={handle}
          onSubmit={handleSubmitResponse}
          draftToken={draft.draftToken}
          draftKey={draft.draftKey}
          fetchImpl={transportFetch}
        />
      ) : null}

      {mode === "manifest" && apiMode === "rest" ? (
        <ManifestPanel
          key={`rest:${handle}`}
          handle={handle}
          onLoaded={(manifest) =>
            setManifestInfo(
              `${manifest.form.handle} (${Object.keys(manifest.fields).length} fields) · REST`,
            )
          }
        />
      ) : null}

      {mode === "manifest" && apiMode === "graphql" ? (
        <GraphqlManifestPanel
          key={`gql:${handle}`}
          handle={handle}
          onLoaded={(manifest) =>
            setManifestInfo(
              `${manifest.form.handle} (${Object.keys(manifest.fields).length} fields) · GraphQL`,
            )
          }
        />
      ) : null}

      {lastSubmit ? (
        <section className="panel">
          <h2 className="panel-title">Last submit response</h2>
          <pre>{JSON.stringify(lastSubmit, null, 2)}</pre>
        </section>
      ) : null}
    </div>
  );
}
