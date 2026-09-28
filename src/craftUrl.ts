/**
 * Craft / Freeform API origin.
 *
 * - Local (empty): use same-origin + Vite/Nuxt proxy via CRAFT_PROXY_TARGET
 * - Vercel / other hosts: set to your Craft site, e.g. https://demo.solspace.com
 *
 * When set, also allow this frontend’s origin in Craft `config/freeform.php`
 * `headless.allowedOrigins` (do not use `*` if you need CSRF cookies).
 */
function trimTrailingSlash(url: string): string {
  return url.replace(/\/+$/, "");
}

export function resolveCraftBaseUrl(
  configured?: string | null,
): string {
  const fromEnv = configured?.trim();
  if (fromEnv) {
    return trimTrailingSlash(fromEnv);
  }

  if (typeof window !== "undefined") {
    return window.location.origin;
  }

  return "";
}

/** Absolute GraphQL URL against the Craft base. */
export function resolveGraphqlUrl(
  baseUrl: string,
  path = "/actions/graphql/api",
): string {
  const trimmed = path.trim() || "/actions/graphql/api";
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  const normalized = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  return `${trimTrailingSlash(baseUrl)}${normalized}`;
}
