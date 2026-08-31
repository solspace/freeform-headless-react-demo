/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_FREEFORM_PACKAGES?: "local" | "npm";
  readonly VITE_FREEFORM_HANDLE?: string;
  readonly VITE_CRAFT_PROXY_TARGET?: string;
  readonly VITE_GRAPHQL_PATH?: string;
  readonly VITE_GRAPHQL_TOKEN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module "@solspace/freeform-react-theme-tailwind" {
  import type { FreeformReactTheme } from "@solspace/freeform-react";
  export const tailwindTheme: FreeformReactTheme;
  export const tailwindDarkTheme: FreeformReactTheme;
  export const tailwindLightTheme: FreeformReactTheme;
}

declare module "@solspace/freeform-react-theme-bootstrap" {
  import type { FreeformReactTheme } from "@solspace/freeform-react";
  export const bootstrapTheme: FreeformReactTheme;
  export const bootstrapDarkTheme: FreeformReactTheme;
  export const bootstrapLightTheme: FreeformReactTheme;
  export function createTheme(
    overrides?: Partial<FreeformReactTheme>,
  ): FreeformReactTheme;
}
