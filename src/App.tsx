import { Routes, Route, Navigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'

// Landing (já existente — mantidos todos)
import { Navigation } from './components/Navigation'
import { Hero } from './sections/Hero'
import { About } from './sections/About'
import { HowItWorks } from './sections/HowItWorks'
import { Features } from './sections/Features'
import { Testimonials } from './sections/Testimonials'
import { Download } from './sections/Download'
import { Footer } from './sections/Footer'

// Novas páginas
import LoginPage from './pages/LoginPage'
import CadastroPage from './pages/CadastroPage'
import AppLayout from './pages/app/AppLayout'
import Dashboard from './pages/app/Dashboard'
import Transacoes from './pages/app/Transacoes'
import ConectarBanco from './pages/app/ConectarBanco'
import Plano from './pages/app/Plano'

// Sua landing page original — intacta
function LandingPage() {
  return (
    <div className="min-h-screen bg-black text-white overflow-x-hidden">
      <Navigation />
      <main>
        <Hero />
        <About />
        <HowItWorks />
        <Features />
        <Testimonials />
        <Download />
      </main>
      <Footer />
    </div>
  )
}

// Guard: bloqueia rotas /app/* se não estiver logado
function ProtectedRoute({ session, children }: { session: Session | null; children: React.ReactNode }) {
  if (!session) return <Navigate to="/login" replace />
  return <>{children}</>
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white" />
      </div>
    )
  }

  return (
    <Routes>
      {/* Landing pública */}
      <Route path="/" element={<LandingPage />} />

      {/* Auth — redireciona pro app se já logado */}
      <Route path="/login"
        element={session ? <Navigate to="/app/dashboard" replace /> : <LoginPage />}
      />
      <Route path="/cadastro"
        element={session ? <Navigate to="/app/dashboard" replace /> : <CadastroPage />}
      />

      {/* App protegido */}
      <Route path="/app" element={
        <ProtectedRoute session={session}>
          <AppLayout session={session!} />
        </ProtectedRoute>
      }>
        <Route index element={<Navigate to="/app/dashboard" replace />} />
        <Route path="dashboard"      element={<Dashboard />} />
        <Route path="transacoes"     element={<Transacoes />} />
        <Route path="conectar-banco" element={<ConectarBanco />} />
        <Route path="plano"          element={<Plano />} />
      </Route>

      {/* Qualquer rota desconhecida volta pra home */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
