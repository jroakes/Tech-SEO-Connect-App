/// <reference types="astro/client" />

interface ImportMetaEnv {
  /** Set in astro.config.mjs: true when PUBLIC_CLERK_PUBLISHABLE_KEY is present. */
  readonly PUBLIC_CLERK_ENABLED: boolean;
  readonly PUBLIC_CLERK_PUBLISHABLE_KEY?: string;
  readonly PUBLIC_MAPTILER_API_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
