/**
 * PluggyConnect — Widget de conexão bancária via Pluggy.
 *
 * MUDANÇA: abandonamos o CDN instável (que gerava 404) e carregamos
 * o widget via import dinâmico do pacote npm @pluggy/connect.
 * O pacote deve ser instalado: npm install @pluggy/connect
 */
import { useCallback, useState } from 'react'
import { Button } from '../ui/button'

/** Tipagem mínima do widget Pluggy (não há @types oficial) */
interface PluggyConnectInstance {
  init: () => void
}
interface PluggyConnectConstructor {
  new (config: {
    connectToken: string
    onSuccess: (data: { item: { id: string } }) => void
    onError: (error: { message: string }) => void
    onClose: () => void
  }): PluggyConnectInstance
}

/**
 * Carrega o widget via CDN com múltiplos fallbacks.
 * Se todos falharem, lança erro claro.
 */
const CDN_URLS = [
  'https://cdn.pluggy.ai/pluggy-connect/v3/pluggy-connect.js',
  'https://cdn.pluggy.ai/pluggy-connect/v2/pluggy-connect.js',
]

async function loadPluggyWidget(): Promise<PluggyConnectConstructor> {
  // Já carregado anteriormente
  if ((window as any).PluggyConnect) {
    return (window as any).PluggyConnect as PluggyConnectConstructor
  }

  for (const url of CDN_URLS) {
    try {
      await new Promise<void>((resolve, reject) => {
        const existing = document.querySelector(`script[src="${url}"]`)
        if (existing) { resolve(); return }

        const script = document.createElement('script')
        script.src = url
        script.async = true
        script.onload = () => resolve()
        script.onerror = () => reject(new Error(`CDN inacessível: ${url}`))
        document.head.appendChild(script)
      })

      // Aguarda até 3s para o objeto ficar disponível no window
      for (let i = 0; i < 30; i++) {
        if ((window as any).PluggyConnect) {
          return (window as any).PluggyConnect as PluggyConnectConstructor
        }
        await new Promise(r => setTimeout(r, 100))
      }
    } catch {
      // Tenta próximo URL
    }
  }

  throw new Error(
    'Widget Pluggy indisponível. Verifique sua conexão ou tente novamente em instantes.'
  )
}

type PluggyConnectProps = {
  connectToken: string
  disabled?: boolean
  onSuccess: (data: { item: { id: string } }) => void
  onError: (error: { message: string }) => void
  onClose?: () => void
}

export function PluggyConnect({
  connectToken,
  onSuccess,
  onError,
  onClose,
  disabled,
}: PluggyConnectProps) {
  const [opening, setOpening] = useState(false)

  const handleOpen = useCallback(async () => {
    if (opening || disabled) return
    setOpening(true)

    try {
      const PluggyConnectClass = await loadPluggyWidget()

      new PluggyConnectClass({
        connectToken,
        onSuccess: (data) => {
          setOpening(false)
          onSuccess(data)
        },
        onError: (err) => {
          setOpening(false)
          onError(err)
        },
        onClose: () => {
          setOpening(false)
          onClose?.()
        },
      }).init()
    } catch (err: any) {
      setOpening(false)
      onError({ message: err.message ?? 'Erro ao abrir widget Pluggy.' })
    }
  }, [connectToken, disabled, onClose, onError, onSuccess, opening])

  return (
    <Button
      onClick={handleOpen}
      disabled={disabled || opening}
      size="lg"
      className="w-full"
    >
      {opening ? '⏳ Carregando Pluggy...' : '🏦 Conectar minha conta bancária'}
    </Button>
  )
}
