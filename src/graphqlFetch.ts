/**
 * Drop-in `fetch` for `@solspace/freeform-react` that routes Freeform headless
 * REST URLs through Craft GraphQL adapters, while leaving CSRF + multipart
 * file uploads on REST.
 *
 * Usage:
 *
 * ```tsx
 * <Freeform handle="contact" baseUrl={origin} fetch={graphqlFetch} … />
 * useFreeform({ handle: "contact", baseUrl: origin, fetch: graphqlFetch })
 * ```
 */
import {
  craftGraphql,
  HEADLESS_MANIFEST_QUERY,
  HEADLESS_SUBMIT_MUTATION,
} from "./graphql";

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function matchManifest(url: URL): string | null {
  const match = url.pathname.match(
    /^\/freeform\/api\/forms\/([^/]+)\/manifest\/?$/,
  );
  return match ? decodeURIComponent(match[1]) : null;
}

function matchSubmit(url: URL): string | null {
  const match = url.pathname.match(
    /^\/freeform\/api\/forms\/([^/]+)\/submit\/?$/,
  );
  return match ? decodeURIComponent(match[1]) : null;
}

function toUrl(input: RequestInfo | URL, base?: string): URL {
  if (input instanceof URL) {
    return input;
  }
  if (typeof input === "string") {
    return new URL(input, base ?? window.location.origin);
  }
  return new URL(input.url, base ?? window.location.origin);
}

export const graphqlFetch: typeof fetch = async (input, init) => {
  const url = toUrl(input);
  const method = (init?.method ?? "GET").toUpperCase();

  const manifestHandle = matchManifest(url);
  if (method === "GET" && manifestHandle) {
    const data = await craftGraphql<{
      freeformHeadlessManifest: unknown;
    }>(HEADLESS_MANIFEST_QUERY, { handle: manifestHandle });

    // Core expects the REST envelope: { success, data }
    return jsonResponse({
      success: true,
      data: data.freeformHeadlessManifest,
      meta: {},
    });
  }

  const submitHandle = matchSubmit(url);
  if (method === "POST" && submitHandle) {
    // Multipart (file uploads) stays on REST — GraphQL is JSON-only.
    if (init?.body instanceof FormData) {
      return fetch(input, init);
    }

    const rawBody =
      typeof init?.body === "string"
        ? init.body
        : init?.body != null
          ? String(init.body)
          : "{}";
    const payload = JSON.parse(rawBody) as {
      intent?: string;
      values?: Record<string, unknown>;
      meta?: Record<string, unknown>;
      context?: Record<string, unknown>;
    };

    const headers = new Headers(init?.headers);
    const csrfToken = headers.get("X-CSRF-Token") ?? undefined;

    const data = await craftGraphql<{
      freeformHeadlessSubmit: unknown;
    }>(HEADLESS_SUBMIT_MUTATION, {
      handle: submitHandle,
      intent: payload.intent ?? "submit",
      values: payload.values ?? {},
      meta: payload.meta ?? {},
      context: payload.context ?? {},
      ...(csrfToken ? { csrfToken } : {}),
    });

    return jsonResponse(data.freeformHeadlessSubmit);
  }

  // CSRF tokens, file DnD, profiles, etc. — real REST
  return fetch(input, init);
};
