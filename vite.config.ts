import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const rootDir = path.dirname(fileURLToPath(import.meta.url));
const frontendRoot = path.resolve(
  rootDir,
  "../../freeform/packages/frontend",
);

function readPackageSource(env: Record<string, string>): "local" | "npm" {
  const value = (
    process.env.FREEFORM_PACKAGES ||
    env.FREEFORM_PACKAGES ||
    "npm"
  )
    .trim()
    .toLowerCase();

  if (value === "local" || value === "1" || value === "true") {
    return "local";
  }

  return "npm";
}

function localPackagesExist(): boolean {
  return fs.existsSync(path.join(frontendRoot, "core/package.json"));
}

function nodeModulesHas(pkg: string): boolean {
  return fs.existsSync(path.join(rootDir, "node_modules", pkg, "package.json"));
}

function localAlias(subdir: string, file = "src/index.ts"): string {
  return path.join(frontendRoot, subdir, file);
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, rootDir, "");
  const craftTarget =
    env.CRAFT_PROXY_TARGET ||
    process.env.CRAFT_PROXY_TARGET ||
    "https://site.ddev.site";
  const requestedLocal = readPackageSource(env) === "local";
  const useLocalPackages = requestedLocal && localPackagesExist();
  const packageSource = useLocalPackages ? "local" : "npm";
  const unpublishedTailwind =
    !useLocalPackages &&
    !nodeModulesHas("@solspace/freeform-react-theme-tailwind") &&
    fs.existsSync(path.join(frontendRoot, "themes/react-tailwind/package.json"));

  if (requestedLocal && !useLocalPackages) {
    console.warn(
      "[freeform-demo] FREEFORM_PACKAGES=local but ../../freeform/packages/frontend was not found. Using npm.",
    );
  }

  if (unpublishedTailwind) {
    console.warn(
      "[freeform-demo] @solspace/freeform-react-theme-tailwind is not installed from npm yet; using the local Craft package.",
    );
  }

  console.warn(`[freeform-demo] packages: ${packageSource}`);

  const alias = useLocalPackages
    ? [
        {
          find: "@solspace/freeform-react-theme-default/styles.css",
          replacement: localAlias("themes/react-default", "src/styles.css"),
        },
        {
          find: "@solspace/freeform-core",
          replacement: localAlias("core"),
        },
        {
          find: "@solspace/freeform-react",
          replacement: localAlias("react"),
        },
        {
          find: "@solspace/freeform-extensions",
          replacement: localAlias("extensions"),
        },
        {
          find: "@solspace/freeform-react-theme-default",
          replacement: path.join(frontendRoot, "themes/react-default"),
        },
        {
          find: "@solspace/freeform-react-theme-tailwind",
          replacement: localAlias("themes/react-tailwind"),
        },
      ]
    : unpublishedTailwind
      ? [
          {
            find: "@solspace/freeform-react-theme-tailwind",
            replacement: localAlias("themes/react-tailwind"),
          },
        ]
      : [];

  const exclude = [
    ...(useLocalPackages
      ? [
          "@solspace/freeform-core",
          "@solspace/freeform-react",
          "@solspace/freeform-extensions",
          "@solspace/freeform-react-theme-default",
        ]
      : []),
    ...(useLocalPackages || unpublishedTailwind
      ? ["@solspace/freeform-react-theme-tailwind"]
      : []),
  ];

  return {
    plugins: [react(), tailwindcss()],
    define: {
      "import.meta.env.VITE_FREEFORM_PACKAGES": JSON.stringify(packageSource),
    },
    resolve: alias.length ? { alias } : undefined,
    optimizeDeps: exclude.length ? { exclude } : undefined,
    server: {
      port: Number(env.PORT || process.env.PORT || 3000),
      strictPort: true,
      fs: {
        allow: [rootDir, ...(localPackagesExist() ? [frontendRoot] : [])],
      },
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
        "/actions": {
          target: craftTarget,
          changeOrigin: true,
          secure: false,
        },
      },
    },
  };
});
