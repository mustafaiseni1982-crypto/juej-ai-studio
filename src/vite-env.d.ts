/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** P.sh. https://juej-ai-studio-production.up.railway.app — pa slash në fund */
  readonly VITE_API_BASE_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
