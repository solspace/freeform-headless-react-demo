import { useMemo, useState, type FormEvent } from "react";
import {
  createFreeformClient,
  type FreeformManifest,
  type SubmitResponse,
} from "@solspace/freeform-core";
import { Freeform, FormLoader, useFreeform } from "@solspace/freeform-react";
import { recommendedExtensions } from "@solspace/freeform-extensions";
import {
  darkTheme,
  lightTheme,
  systemTheme,
  type FreeformReactTheme,
} from "@solspace/freeform-react-theme-default";

type ViewMode = "component" | "headless" | "manifest";
type ColorScheme = "light" | "dark" | "system";

/** Same-origin — Vite proxies `/freeform` to Craft (see vite.config.ts). */
const baseUrl = typeof window !== "undefined" ? window.location.origin : "";

const defaultHandle =
  import.meta.env.VITE_FREEFORM_HANDLE?.trim() || "contact";

const themesByScheme: Record<ColorScheme, FreeformReactTheme> = {
  light: lightTheme,
  dark: darkTheme,
  system: systemTheme,
};

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

  const client = useMemo(() => createFreeformClient({ baseUrl }), []);

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
}: {
  handle: string;
  onSubmit: (response: SubmitResponse) => void;
}) {
  const form = useFreeform({
    handle,
    baseUrl,
    extensions: recommendedExtensions,
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

      <button type="submit" disabled={form.isSubmitting}>
        {form.isSubmitting ? "Submitting…" : "Submit (headless)"}
      </button>

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
}: {
  handle: string;
  onSubmit: (response: SubmitResponse) => void;
  theme: FreeformReactTheme;
}) {
  return (
    <div className="panel">
      <Freeform
        handle={handle}
        baseUrl={baseUrl}
        theme={theme}
        extensions={recommendedExtensions}
        allowRawHtml
        loadingMessage={`Loading ${handle}…`}
        onSuccess={onSubmit}
        onError={onSubmit}
      />
    </div>
  );
}

export function App() {
  const [handleDraft, setHandleDraft] = useState(defaultHandle);
  const [handle, setHandle] = useState(defaultHandle);
  const [mode, setMode] = useState<ViewMode>("component");
  const [colorScheme, setColorScheme] = useState<ColorScheme>("system");
  const [lastSubmit, setLastSubmit] = useState<SubmitResponse | null>(null);
  const [manifestInfo, setManifestInfo] = useState<string | null>(null);
  const theme = themesByScheme[colorScheme];

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
              Official <code>@solspace/freeform-*</code> packages from npm,
              proxied to your Craft site via <code>/freeform</code>.
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
      </section>

      {mode === "component" ? (
        <ComponentForm
          key={handle}
          handle={handle}
          onSubmit={setLastSubmit}
          theme={theme}
        />
      ) : null}

      {mode === "headless" ? (
        <HeadlessForm
          key={handle}
          handle={handle}
          onSubmit={setLastSubmit}
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
