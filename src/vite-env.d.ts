/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_BAB_SYNC_URL: string | undefined;
  readonly VITE_BAB_SYNC_SECRET: string | undefined;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
