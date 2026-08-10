/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_FREEFORM_HANDLE?: string;
  readonly VITE_CRAFT_PROXY_TARGET?: string;
  readonly VITE_GRAPHQL_PATH?: string;
  readonly VITE_GRAPHQL_TOKEN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
