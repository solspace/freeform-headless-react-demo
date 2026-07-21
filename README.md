# Freeform Headless React Demo

Public example app: **Vite + React** rendering Craft Freeform forms with Solspace’s official packages from the **[npm registry](https://www.npmjs.com/search?q=%40solspace%2Ffreeform)** (not linked from a local Freeform checkout).

| Package | Role |
| --- | --- |
| [`@solspace/freeform-core`](https://www.npmjs.com/package/@solspace/freeform-core) | Manifest, state, submit |
| [`@solspace/freeform-react`](https://www.npmjs.com/package/@solspace/freeform-react) | `<Freeform />` and `useFreeform()` |
| [`@solspace/freeform-extensions`](https://www.npmjs.com/package/@solspace/freeform-extensions) | Captchas, datetime, file drag & drop |
| [`@solspace/freeform-react-theme-default`](https://www.npmjs.com/package/@solspace/freeform-react-theme-default) | Default light / dark theme |

Clone this repo, connect it to your Craft site, and load any headless-enabled Freeform form by **handle**.

## Prerequisites

1. Craft CMS with Freeform (including the headless REST API)
2. Headless enabled for the form you want to use
3. Node.js **20+**

## Quick start

```bash
git clone https://github.com/solspace/freeform-headless-react-demo.git
cd freeform-headless-react-demo

cp .env.example .env
```

Edit `.env`:

```bash
# Your Craft site (Vite proxies /freeform here)
CRAFT_PROXY_TARGET=https://your-site.example

# Default Freeform form handle
VITE_FREEFORM_HANDLE=contact
```

Install and run:

```bash
npm install
npm run dev
```

Or with pnpm / yarn:

```bash
pnpm install && pnpm dev
# yarn && yarn dev
```

Open [http://localhost:3000](http://localhost:3000).

The app talks to Freeform on the **same origin** (`/freeform/...`). Vite proxies those requests to `CRAFT_PROXY_TARGET` so CSRF cookies work without awkward cross-origin setup.

## How to use a form in this app

### 1. Enable the form in Freeform

In Craft / Freeform, turn on headless for your form (global + per-form). Example shape (see Freeform docs for the full config):

```php
// config/freeform.php
return [
    'headless' => [
        'enabled' => true,
        'forms' => [
            'contact' => [
                'exposeManifest' => true,
                'allowSubmit' => true,
            ],
        ],
    ],
];
```

### 2. Point the demo at that handle

**In the UI:** Form settings → enter the handle → **Load form**.

**Or in `.env`:**

```bash
VITE_FREEFORM_HANDLE=contact
```

Restart the dev server after changing `VITE_*` variables.

### 3. Copy the pattern into your own app

```tsx
import { Freeform } from "@solspace/freeform-react";
import { recommendedExtensions } from "@solspace/freeform-extensions";
import "@solspace/freeform-react-theme-default/styles.css";

export function ContactForm() {
  return (
    <Freeform
      handle="contact"
      baseUrl={window.location.origin}
      extensions={recommendedExtensions}
    />
  );
}
```

Use your app’s origin as `baseUrl` when `/freeform` is proxied (or served) on the same host.

## What the demo tabs show

| Tab | Purpose |
| --- | --- |
| `<Freeform />` | Full rendered form with the default theme |
| `useFreeform()` | Headless hook — you control the markup |
| Manifest JSON | Raw REST manifest for debugging |

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Dev server (port `3000` by default) |
| `npm run build` | Production build → `dist/` |
| `npm run preview` | Preview the production build |

Custom port: `PORT=3001 npm run dev`

## Next.js

The same npm packages work in Next.js. Use a Client Component and rewrite `/freeform` to your Craft site in `next.config.js` (same idea as this Vite proxy). See Solspace Freeform → Headless docs.

## Docs

- [Solspace Freeform documentation](https://docs.solspace.com/craft/freeform/) → Headless
- Package pages on [npm](https://www.npmjs.com/search?q=%40solspace%2Ffreeform)

## Troubleshooting

| Issue | Fix |
| --- | --- |
| CSRF / session errors | Keep using the Vite proxy; don’t call Craft from the browser on another origin without CORS + credentials. |
| CORS errors | Prefer the proxy, or add `http://localhost:3000` to `headless.allowedOrigins`. |
| 404 on manifest | Wrong handle, or the form is not exposed for headless. |
| Captcha / file upload missing | Enable those integrations in Freeform; this demo already loads `recommendedExtensions`. |
| pnpm complains about “minimum release age” | Fresh `@solspace/freeform-*` publishes can trip pnpm’s supply-chain delay. This repo lists those packages in `pnpm-workspace.yaml` → `minimumReleaseAgeExclude` (**npm registry only** — not a local monorepo). Or use `npm install`. |

## License

This demo is MIT. The Freeform Craft plugin is licensed separately — see [Solspace Freeform](https://docs.solspace.com/craft/freeform/).
# freeform-headless-react-demo
