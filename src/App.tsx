import { useCallback, useMemo, useState, type FormEvent } from "react";
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

function HeadlessForm({
  handle,
  onSubmit,
  draftToken,
  draftKey,
}: {
  handle: string;
  onSubmit: (response: SubmitResponse) => void;
  draftToken: string | null;
  draftKey: string | null;
}) {
  const form = useFreeform({
    handle,
    baseUrl,
    extensions: demoExtensions,
    draftToken,
    draftKey,
    onSuccess: onSubmit,
    onError: onSubmit,
  });

  if (form.loading) {
    return (
      <div className="panel">
        <FormLoader message={`Loading ${handle}…`} />
      </div>
    );
  }

  if (form.error) {
    return <div className="status is-error">{form.error.message}</div>;
  }

  if (!form.manifest) {
    return null;
  }

  const visibleHandles = Object.keys(form.manifest.fields).filter(
    (fieldHandle) => form.isFieldVisible(fieldHandle),
  );

  return (
    <form className="headless-form panel" onSubmit={form.handleSubmit}>
      <p>
        Headless mode: you own the markup. Core still loads the manifest,
        manages state, and submits.
      </p>

      {form.formErrors.map((message) => (
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
        <button type="submit" disabled={form.isSubmitting}>
          {form.isSubmitting ? "Submitting…" : "Submit (headless)"}
        </button>
        <button
          type="button"
          disabled={form.isSubmitting}
          onClick={() => void form.saveDraft()}
        >
          Save draft
        </button>
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
}: {
  handle: string;
  onSubmit: (response: SubmitResponse) => void;
  theme: FreeformReactTheme;
  draftToken: string | null;
  draftKey: string | null;
}) {
  return (
    <div className="panel">
      <Freeform
        key={handle}
        handle={handle}
        baseUrl={baseUrl}
        theme={theme}
        extensions={demoExtensions}
        draftToken={draftToken}
        draftKey={draftKey}
        allowRawHtml
        loadingMessage={`Loading ${handle}…`}
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

  const handleSubmitResponse = useCallback((response: SubmitResponse) => {
    setLastSubmit(response);

    if (
      response.status === "draft_saved" &&
      response.draft?.token &&
      response.draft?.key
    ) {
      const url = writeDraftToUrl(response.draft.token, response.draft.key);
      // Keep existing form mounted — only sync URL + resume hint.
      // Form state already holds values + draft tokens from applySubmitResponse.
      setDraft((current) =>
        current.draftToken === response.draft?.token &&
        current.draftKey === response.draft?.key
          ? current
          : {
              draftToken: response.draft.token,
              draftKey: response.draft.key,
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

  return (
    <div className="app" data-theme={colorScheme}>
      <header>
        <div className="header-row">
          <div>
            <h1>Freeform Headless React Demo</h1>
            <p>
              Official <code>@solspace/freeform-*</code> packages from npm
              (0.1.1+), proxied to your Craft site via <code>/freeform</code>.
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

      <section className="panel">
        <div className="tabs">
          <button
            type="button"
            className={`tab ${mode === "component" ? "is-active" : ""}`}
            onClick={() => setMode("component")}
          >
            &lt;Freeform /&gt;
          </button>
          <button
            type="button"
            className={`tab ${mode === "headless" ? "is-active" : ""}`}
            onClick={() => setMode("headless")}
          >
            useFreeform()
          </button>
          <button
            type="button"
            className={`tab ${mode === "manifest" ? "is-active" : ""}`}
            onClick={() => setMode("manifest")}
          >
            Manifest JSON
          </button>
        </div>

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
          </div>
        ) : null}

        {resumeUrl ? (
          <div className="status is-success">
            <strong>Resume URL</strong> (copy / refresh to restore a saved
            draft):
            <div style={{ marginTop: "0.5rem", wordBreak: "break-all" }}>
              <code>{resumeUrl}</code>
            </div>
            <p style={{ margin: "0.5rem 0 0", fontSize: "0.9rem" }}>
              Query params: <code>session-token</code> + <code>key</code>
            </p>
          </div>
        ) : null}
      </section>

      {mode === "component" ? (
        <ComponentForm
          key={handle}
          handle={handle}
          onSubmit={handleSubmitResponse}
          theme={theme}
          draftToken={draft.draftToken}
          draftKey={draft.draftKey}
        />
      ) : null}

      {mode === "headless" ? (
        <HeadlessForm
          key={handle}
          handle={handle}
          onSubmit={handleSubmitResponse}
          draftToken={draft.draftToken}
          draftKey={draft.draftKey}
        />
      ) : null}

      {mode === "manifest" ? (
        <ManifestPanel
          key={handle}
          handle={handle}
          onLoaded={(manifest) =>
            setManifestInfo(
              `${manifest.form.handle} (${Object.keys(manifest.fields).length} fields)`,
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
