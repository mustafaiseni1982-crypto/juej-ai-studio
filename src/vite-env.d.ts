/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_OPENAI_PROXY?: string
  /** P.sh. https://api.example.com — pa slash në fund */
  readonly VITE_API_BASE_URL?: string
}
