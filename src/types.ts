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

/** Çelësat AI janë vetëm në backend (Railway); asgjë nuk ruhet për API në localStorage. */
export interface AppSettings {
  model: 'gpt-4o' | 'gpt-4o-mini'
  voiceEnabled: boolean
}

export const DEFAULT_SETTINGS: AppSettings = {
  model: 'gpt-4o-mini',
  voiceEnabled: true,
}
