export async function fetchJson<T = any>(input: RequestInfo | URL, init?: RequestInit): Promise<{ ok: boolean; status: number; data: T }> {
  const res = await fetch(input, init)
  const raw = await res.text()

  let data: any = {}
  try {
    data = raw ? JSON.parse(raw) : {}
  } catch {
    data = { error: raw || `Resposta inválida (${res.status})` }
  }

  return { ok: res.ok, status: res.status, data }
}
