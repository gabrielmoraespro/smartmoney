/**
 * Wrapper estilo SDK para Pluggy (fallback com fetch HTTP).
 * Mantém interface centralizada para auth e connect token.
 */
export class PluggyClient {
  private clientId: string
  private clientSecret: string

  constructor(clientId: string, clientSecret: string) {
    this.clientId = clientId
    this.clientSecret = clientSecret
  }

  async getApiKey(): Promise<string> {
    const res = await fetch('https://api.pluggy.ai/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId: this.clientId, clientSecret: this.clientSecret }),
    })

    if (!res.ok) throw new Error(`Pluggy auth failed: ${res.status}`)
    const data = await res.json()
    return data.apiKey as string
  }

  async createConnectToken(clientUserId: string): Promise<string> {
    const apiKey = await this.getApiKey()

    const tokenRes = await fetch('https://api.pluggy.ai/connect_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-KEY': apiKey,
      },
      body: JSON.stringify({ clientUserId }),
    })

    if (!tokenRes.ok) throw new Error(`Token generation failed: ${tokenRes.status}`)
    const { accessToken } = await tokenRes.json()
    return accessToken as string
  }
}
