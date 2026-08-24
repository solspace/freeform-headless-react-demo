import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

const rootDir = path.dirname(fileURLToPath(import.meta.url));
const frontendRoot = path.resolve(
  rootDir,
  "../../freeform/packages/frontend",
);
const useLocalPackages = fs.existsSync(
  path.join(frontendRoot, "core/package.json"),
);

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, rootDir, "");
  const craftTarget =
    env.CRAFT_PROXY_TARGET ||
    process.env.CRAFT_PROXY_TARGET ||
    "https://site.ddev.site";

  return {
    plugins: [react()],
    resolve: useLocalPackages
      ? {
          alias: {
            "@solspace/freeform-core": path.join(frontendRoot, "core"),
            "@solspace/freeform-react": path.join(frontendRoot, "react"),
            "@solspace/freeform-extensions": path.join(
              frontendRoot,
              "extensions",
            ),
            "@solspace/freeform-react-theme-default": path.join(
              frontendRoot,
              "themes/react-default",
            ),
          },
        }
      : undefined,
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
        // Craft GraphQL (freeformHeadlessManifest / freeformHeadlessSubmit)
        "/actions": {
          target: craftTarget,
          changeOrigin: true,
          secure: false,
        },
      },
    },
  };
});
