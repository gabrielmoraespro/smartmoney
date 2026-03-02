import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnon = import.meta.env.VITE_SUPABASE_ANON_KEY as string

// Guard explícito — falha rápido com mensagem clara durante dev
if (!supabaseUrl || !supabaseAnon) {
  throw new Error(
    '[SmartMoney] VITE_SUPABASE_URL ou VITE_SUPABASE_ANON_KEY não encontrados.\n' +
    'Crie o arquivo .env.local na raiz do projeto com as variáveis corretas e reinicie o Vite.'
  )
}

export const supabase = createClient(supabaseUrl, supabaseAnon)

/**
 * Headers autenticados para chamadas diretas à REST API do Supabase.
 * CORREÇÃO: inclui "Accept: application/json" — sem ele, PostgREST retorna 406.
 */
export async function getUserAuthHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) {
    throw new Error('Sessão inválida. Faça login novamente.')
  }

  return {
    'apikey': supabaseAnon,
    'Authorization': `Bearer ${session.access_token}`,
    'Content-Type': 'application/json',
    'Accept': 'application/json', // ← FIX: necessário para PostgREST não retornar 406
  }
}

/**
 * Cliente admin (service role) — APENAS para Netlify Functions (Node.js).
 * Nunca importar este export em código de frontend.
 */
export const createAdminClient = () =>
  createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
