# Freeform Headless React Demo

Example **Vite + React** app that renders [Solspace Freeform](https://docs.solspace.com/craft/freeform/) forms using the official npm packages:

| Package | Role |
| --- | --- |
| [`@solspace/freeform-core`](https://www.npmjs.com/package/@solspace/freeform-core) | Manifest, state, submit |
| [`@solspace/freeform-react`](https://www.npmjs.com/package/@solspace/freeform-react) | `<Freeform />` and `useFreeform()` |
| [`@solspace/freeform-extensions`](https://www.npmjs.com/package/@solspace/freeform-extensions) | Captchas, datetime, file drag & drop |
| [`@solspace/freeform-react-theme-default`](https://www.npmjs.com/package/@solspace/freeform-react-theme-default) | Default light / dark theme |

## What you need

Before running this app:

1. A **Craft CMS** site with **Freeform** installed (version that includes the headless REST API)
2. A Freeform form you want to display (you’ll use its **handle**, e.g. `contact`)
3. **Node.js 20+**

## 1. Enable headless Freeform (Craft)

Headless must be turned on in Freeform **before** this React app can load a form.

In `config/freeform.php` (see Freeform docs for the full options):

```php
return [
    'headless' => [
        'enabled' => true,
        'forms' => [
            'contact' => [          // ← your form handle
                'exposeManifest' => true,
                'allowSubmit' => true,
            ],
        ],
    ],
];
```

Tips:

- Replace `contact` with your real form handle.
- For public forms, enable a **captcha** in Freeform.
- Keep your Craft site running (e.g. DDEV at `https://site.ddev.site`).

## 2. Clone and configure this app

```bash
git clone https://github.com/solspace/freeform-headless-react-demo.git
cd freeform-headless-react-demo

cp .env.example .env
```

Edit `.env`:

```bash
# Craft site URL (Vite proxies /freeform here)
CRAFT_PROXY_TARGET=https://your-site.example

# Form handle from Freeform (same as in step 1)
VITE_FREEFORM_HANDLE=contact
```

| Variable | Purpose |
| --- | --- |
| `CRAFT_PROXY_TARGET` | Your Craft / Freeform site URL |
| `VITE_FREEFORM_HANDLE` | Default form handle shown when the app starts |

## 3. Install and run

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

How it connects: the React app calls `/freeform/...` on **localhost**. Vite proxies those requests to `CRAFT_PROXY_TARGET`, so CSRF cookies work on the same origin.

You can also use `pnpm` or `yarn` if you prefer.

## How to use a form in this app

### Load your form

1. Make sure the form is headless-enabled (step 1).
2. In the app **Form settings**, enter the form handle → **Load form**.  
   Or set `VITE_FREEFORM_HANDLE` in `.env` and restart `npm run dev`.

### Try the demo modes

| Tab | What it shows |
| --- | --- |
| `<Freeform />` | Full form with the default theme (easiest) |
| `useFreeform()` | Headless hook — you own the markup |
| Manifest JSON | Raw API response (useful for debugging) |

### Use the same pattern in your own project

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

When `/freeform` is proxied (or served) on the same host as your frontend, keep `baseUrl` as your app’s origin.

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Dev server (port `3000` by default) |
| `npm run build` | Production build → `dist/` |
| `npm run preview` | Preview the production build |

Custom port: `PORT=3001 npm run dev`

## Next.js

The same packages work in Next.js. Use a Client Component and rewrite `/freeform` to your Craft site (same idea as this Vite proxy). See Solspace Freeform → **Headless** docs.

## Docs

- [Solspace Freeform documentation](https://docs.solspace.com/craft/freeform/) → Headless
- Packages on [npm](https://www.npmjs.com/org/solspace)

## Troubleshooting

| Issue | Fix |
| --- | --- |
| Form won’t load / 404 | Wrong handle, or headless not enabled for that form (step 1). |
| CSRF / session errors | Keep using the Vite proxy; don’t call Craft from another origin without CORS + credentials. |
| CORS errors | Prefer the proxy, or add `http://localhost:3000` to `headless.allowedOrigins`. |
| Captcha / file upload missing | Enable those integrations in Freeform; this demo already loads `recommendedExtensions`. |

## License

This demo is MIT. The Freeform Craft plugin is licensed separately — see [Solspace Freeform](https://docs.solspace.com/craft/freeform/).
