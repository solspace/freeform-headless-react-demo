# Cloudflare: Freeform headless demos on demo.solspace.com

**Audience:** whoever manages Cloudflare for `demo.solspace.com`  
**Goal:** Serve the three Vercel SPAs under path prefixes while Craft stays on the same hostname.

| Public URL | Backend |
| --- | --- |
| `https://demo.solspace.com/freeform-headless` | **Craft** landing page (links to the three demos) |
| `https://demo.solspace.com/freeform-headless/react/` | React demo Vercel deployment |
| `https://demo.solspace.com/freeform-headless/vue/` | Vue demo Vercel deployment |
| `https://demo.solspace.com/freeform-headless/nuxt/` | Nuxt demo Vercel deployment |
| Everything else (`/`, `/admin`, `/freeform`, …) | Existing Craft origin (Arcustech) |

The Worker **must strip** the `/freeform-headless/{react\|vue\|nuxt}` prefix before forwarding to Vercel. Do **not** proxy bare `/freeform-headless` — that page is served by Craft.

---

## 1. Gather Vercel production URLs

From each Vercel project → **Domains** (use the `*.vercel.app` production URL, or a custom Vercel domain):

```text
REACT_ORIGIN=https://freeform-headless-react-demo.vercel.app
VUE_ORIGIN=https://freeform-headless-vue-demo.vercel.app
NUXT_ORIGIN=https://freeform-headless-nuxt-demo.vercel.app
```

Replace with the real production hostnames (no trailing slash).

---

## 2. Create a Cloudflare Worker

1. Cloudflare Dashboard → **Workers & Pages** → **Create** → **Create Worker**.
2. Name e.g. `demo-solspace-freeform-headless`.
3. Paste the script below (update the three origins).
4. **Deploy**.

### Worker script (copy-paste)

```js
/**
 * Path proxy: demo.solspace.com/freeform-headless/{react|vue|nuxt}/* → Vercel
 * Strip the public prefix so Vite/Nuxt assets resolve on Vercel’s root.
 */
const ORIGINS = {
  react: "https://REPLACE-ME-react.vercel.app",
  vue: "https://REPLACE-ME-vue.vercel.app",
  nuxt: "https://REPLACE-ME-nuxt.vercel.app",
};

const PREFIXES = [
  { key: "react", prefix: "/freeform-headless/react" },
  { key: "vue", prefix: "/freeform-headless/vue" },
  { key: "nuxt", prefix: "/freeform-headless/nuxt" },
];

export default {
  async fetch(request, _env, _ctx) {
    const url = new URL(request.url);

    for (const { key, prefix } of PREFIXES) {
      if (url.pathname === prefix || url.pathname.startsWith(prefix + "/")) {
        const origin = ORIGINS[key];
        let rest = url.pathname.slice(prefix.length) || "/";
        if (!rest.startsWith("/")) rest = "/" + rest;

        const target = new URL(rest + url.search, origin);
        const headers = new Headers(request.headers);
        headers.set("Host", new URL(origin).host);
        // Avoid Cloudflare → Vercel compression mismatches
        headers.delete("accept-encoding");

        const upstream = await fetch(
          new Request(target.toString(), {
            method: request.method,
            headers,
            body:
              request.method === "GET" || request.method === "HEAD"
                ? undefined
                : request.body,
            redirect: "manual",
          }),
        );

        const out = new Headers(upstream.headers);
        // Optional: help browsers cache under the public host
        out.set("X-Proxied-From", origin);
        return new Response(upstream.body, {
          status: upstream.status,
          statusText: upstream.statusText,
          headers: out,
        });
      }
    }

    // Not a headless demo path — fall through to Craft (see route setup).
    return fetch(request);
  },
};
```

---

## 3. Attach the Worker to the hostname

**Workers Routes** (zone `solspace.com` or the `demo.solspace.com` zone):

| Route | Worker |
| --- | --- |
| `demo.solspace.com/freeform-headless/*` | `demo-solspace-freeform-headless` |

Leave Craft DNS as today (orange-cloud / proxied to Arcustech).  
Do **not** proxy `/freeform` or `/actions` through this Worker — those stay on Craft.

If the zone uses **Workers → Routes** and “fail open” is off, only matching paths hit the Worker; other paths continue to the origin.

---

## 4. Vercel env (each of the 3 projects)

Already expected by the apps (production Craft API):

| Variable | Value |
| --- | --- |
| `VITE_FREEFORM_BASE_URL` (React + Vue) | `https://demo.solspace.com` |
| `NUXT_PUBLIC_FREEFORM_BASE_URL` (Nuxt) | `https://demo.solspace.com` |
| GraphQL tokens (optional) | same as today |

Base paths are baked into production builds (`/freeform-headless/react/` etc.). Override only if needed:

| Variable | When |
| --- | --- |
| `VITE_BASE_PATH` | React/Vue — override public base (must end with `/`) |
| `NUXT_APP_BASE_URL` | Nuxt — override public base |

After env changes: **Redeploy** each Vercel project.

---

## 5. Craft / Freeform CORS

In `config/freeform.php` `headless.allowedOrigins`, keep at least:

- `https://demo.solspace.com`

(Same-origin browser calls to `/freeform` on `demo.solspace.com` — preferred.)  
You do **not** need to allow the `*.vercel.app` origins for the public demos if users only open the Cloudflare URLs.

---

## 6. Smoke test checklist

1. Open `https://demo.solspace.com/freeform-headless/react/` → app shell loads (no 404 on JS/CSS).
2. Same for `/vue/` and `/nuxt/`.
3. Load form `contact` over REST — manifest succeeds.
4. `https://demo.solspace.com/admin` and Craft still work.
5. `https://demo.solspace.com/freeform/...` still hits Craft (not Vercel).

---

## Troubleshooting

| Symptom | Likely cause |
| --- | --- |
| Blank page, 404 on `/assets/...` under demo.solspace.com | Worker not stripping prefix, or wrong Vercel origin |
| Blank page, assets requested at `/assets/...` (missing prefix) | Old deploy without production `base` — redeploy apps |
| CORS errors calling Freeform | `VITE_FREEFORM_BASE_URL` / Nuxt public URL wrong, or `allowedOrigins` |
| Craft admin broken | Worker route too broad — restrict to `/freeform-headless/*` |

---

## Local vs production

| Environment | Base path |
| --- | --- |
| `pnpm dev` (local) | `/` |
| Vercel production build | `/freeform-headless/{react\|vue\|nuxt}/` |

No Cloudflare changes are required for local development.
