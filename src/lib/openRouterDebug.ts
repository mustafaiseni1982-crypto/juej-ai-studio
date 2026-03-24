/** Log vetëm për debug lokal (sipas kërkesës së përdoruesit). */
export function logOpenRouterRequest(
  context: string,
  payload: { apiKey: string; endpoint: string; model: string },
): void {
  console.log(`[OpenRouter:${context}]`, {
    apiKey: payload.apiKey,
    endpoint: payload.endpoint,
    model: payload.model,
  })
}
