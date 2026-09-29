/**
 * Cloudflare Worker — paste into Workers & Pages.
 * Docs: ../docs/cloudflare-freeform-headless-proxy.md (monorepo)
 * or https://github.com/solspace/freeform-headless-react-demo (see CLOUDFLARE.md)
 *
 * REPLACE the three ORIGINS with your Vercel production hostnames.
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
  async fetch(request) {
    const url = new URL(request.url);

    for (const { key, prefix } of PREFIXES) {
      if (url.pathname === prefix || url.pathname.startsWith(prefix + "/")) {
        const origin = ORIGINS[key];
        let rest = url.pathname.slice(prefix.length) || "/";
        if (!rest.startsWith("/")) rest = "/" + rest;

        const target = new URL(rest + url.search, origin);
        const headers = new Headers(request.headers);
        headers.set("Host", new URL(origin).host);
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
        out.set("X-Proxied-From", origin);
        return new Response(upstream.body, {
          status: upstream.status,
          statusText: upstream.statusText,
          headers: out,
        });
      }
    }

    return fetch(request);
  },
};
