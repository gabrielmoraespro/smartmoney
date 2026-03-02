import { createClient } from '@supabase/supabase-js'

// Cliente público — roda no browser via Vite
const supabaseUrl  = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnon = import.meta.env.VITE_SUPABASE_ANON_KEY as string

export const supabase = createClient(supabaseUrl, supabaseAnon)

// Admin client — APENAS para Netlify Functions (Node.js)
// NÃO usa import.meta.env (Vite) — usa process.env (Node.js)
// NÃO tem prefixo VITE_ — nunca expor service role key no browser
export const createAdminClient = () =>
  createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
