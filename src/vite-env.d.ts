/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_FREEFORM_HANDLE?: string;
  readonly VITE_CRAFT_PROXY_TARGET?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
