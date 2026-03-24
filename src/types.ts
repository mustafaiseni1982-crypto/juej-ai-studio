export type NavId =
  | 'chat'
  | 'editor'
  | 'explain'
  | 'debug'
  | 'design'
  | 'imageToUi'
  | 'compare'
  | 'history'
  | 'settings'

/** ID të plota për krahasim shumë-furnizues (përputhen me specifikimin e API). */
export type CompareModelId =
  | 'openai/gpt-4o'
  | 'openai/gpt-4o-mini'
  | 'anthropic/claude-3.5-sonnet'
  | 'deepseek/deepseek-chat'

export type EditorLanguage =
  | 'html'
  | 'css'
  | 'javascript'
  | 'python'
  | 'php'
  | 'sql'

export type ChatRole = 'user' | 'assistant' | 'system'

export interface ChatMessage {
  id: string
  role: ChatRole
  content: string
  createdAt: number
}

export interface Conversation {
  id: string
  title: string
  messages: ChatMessage[]
  updatedAt: number
}

export interface AppSettings {
  apiKey: string
  model: 'gpt-4o' | 'gpt-4o-mini'
  voiceEnabled: boolean
  /** Një çelës për OpenRouter (GPT, Claude, DeepSeek etj.) — pa proxy. */
  useOpenRouter: boolean
  openRouterApiKey: string
  /** Për krahasim Claude kur nuk përdoret proxy dhe nuk përdoret OpenRouter. */
  anthropicApiKey: string
  /** Për krahasim DeepSeek kur nuk përdoret proxy dhe nuk përdoret OpenRouter. */
  deepseekApiKey: string
}

export const DEFAULT_SETTINGS: AppSettings = {
  apiKey: '',
  model: 'gpt-4o-mini',
  voiceEnabled: true,
  useOpenRouter: false,
  openRouterApiKey: '',
  anthropicApiKey: '',
  deepseekApiKey: '',
}
