# Freeform Headless React Demo (`dev` branch)

**This branch develops against your local Craft Freeform checkout**, not npm.

Expected layout:

```text
craft/plugins/
  freeform/packages/frontend/   ← local @solspace/freeform-* sources
  frontend-library/
    freeform-headless-react-demo/
```

## Quick start

```bash
cp .env.example .env
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

`pnpm dev` always sets `FREEFORM_PACKAGES=local` and Vite aliases every `@solspace/freeform-*` import to `../../freeform/packages/frontend/...`.

| Branch | Packages |
| --- | --- |
| `main` | Published npm packages — public demo |
| `dev` (this branch) | Sibling Freeform packages — local development |

Point `CRAFT_PROXY_TARGET` at your Craft site. See `main` README for full Craft headless setup.
