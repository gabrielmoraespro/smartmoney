import { fetchJson } from './http'
import { supabase } from './supabase'

export async function syncPluggyItems(itemIds: string[], functionsBaseUrl: string): Promise<number> {
  const unique = [...new Set(itemIds.filter(Boolean))]
  if (unique.length === 0) return 0

  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Sessão expirada. Faça login novamente.')

  let total = 0
  for (const itemId of unique) {
    const res = await fetchJson<{ totalUpserted?: number; error?: string }>(`${functionsBaseUrl}/sync-pluggy`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ item_id: itemId }),
    })

    if (!res.ok) throw new Error(res.data.error ?? `Falha ao sincronizar item ${itemId}`)
    total += Number(res.data.totalUpserted ?? 0)
  }

  return total
}
