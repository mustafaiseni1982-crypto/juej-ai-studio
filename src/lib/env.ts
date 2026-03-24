/** Kur është true, kërkesat OpenAI kalojnë përmes serverit lokal (/api/chat) dhe çelësi mbetet në OPENAI_API_KEY të serverit. */
export const openAiProxyEnabled =
  import.meta.env.VITE_OPENAI_PROXY === 'true'
