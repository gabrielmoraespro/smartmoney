import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnon = import.meta.env.VITE_SUPABASE_ANON_KEY as string

// Proteção contra configuração insegura no frontend
if (supabaseAnon?.includes('service_role')) {
  throw new Error('VITE_SUPABASE_ANON_KEY está com token service_role. Use APENAS a chave anon no frontend.')
}

export const supabase = createClient(supabaseUrl, supabaseAnon)

export async function getUserAuthHeaders() {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) throw new Error('Sessão inválida para chamada autenticada ao Supabase.')

  return {
    apikey: supabaseAnon,
    Authorization: `Bearer ${session.access_token}`,
    'Content-Type': 'application/json',
  }
}

export const createAdminClient = () => {
  const serverSupabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!serverSupabaseUrl || !serviceRoleKey) {
    throw new Error('SUPABASE_URL/VITE_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórios no backend.')
  }

  return createClient(
    serverSupabaseUrl,
    serviceRoleKey,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}
