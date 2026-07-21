import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, rootDir, "");
  const craftTarget =
    env.CRAFT_PROXY_TARGET ||
    process.env.CRAFT_PROXY_TARGET ||
    "https://site.ddev.site";

  return {
    plugins: [react()],
    server: {
      port: Number(env.PORT || process.env.PORT || 3000),
      strictPort: true,
      proxy: {
        "/freeform": {
          target: craftTarget,
          changeOrigin: true,
          secure: false,
          configure(proxy) {
            proxy.on("proxyRes", (proxyRes) => {
              const cookies = proxyRes.headers["set-cookie"];
              if (!cookies) {
                return;
              }

              proxyRes.headers["set-cookie"] = cookies.map((cookie) =>
                cookie
                  .replace(/;?\s*Domain=[^;]+/gi, "")
                  .replace(/;?\s*Secure/gi, ""),
              );
            });
          },
        },
      },
    },
  };
});
