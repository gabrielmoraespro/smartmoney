import { useCallback, useState } from 'react'
import { Button } from '../ui/button'

declare global {
  interface Window {
    PluggyConnect: new (config: {
      connectToken: string
      onSuccess: (data: { item: { id: string } }) => void
      onError: (error: { message: string }) => void
      onClose: () => void
    }) => { init: () => void }
  }
}

type PluggyConnectProps = {
  connectToken: string
  disabled?: boolean
  onSuccess: (data: { item: { id: string } }) => void
  onError: (error: { message: string }) => void
  onClose?: () => void
}

const SDK_URLS = [
  'https://cdn.pluggy.ai/pluggy-connect/v2/pluggy-connect.js',
  'https://cdn.pluggy.ai/pluggy-connect.js',
]

async function loadPluggySdk(): Promise<void> {
  if (window.PluggyConnect) return

  for (const sdkUrl of SDK_URLS) {
    try {
      await new Promise<void>((resolve, reject) => {
        const script = document.createElement('script')
        script.src = sdkUrl
        script.async = true
        script.onload = () => resolve()
        script.onerror = () => reject(new Error(`Falha ao carregar SDK ${sdkUrl}`))
        document.head.appendChild(script)
      })

      if (window.PluggyConnect) return
    } catch {
      // tenta próximo endpoint
    }
  }

  throw new Error('Não foi possível carregar o widget Pluggy no momento.')
}

export function PluggyConnect({ connectToken, onSuccess, onError, onClose, disabled }: PluggyConnectProps) {
  const [opening, setOpening] = useState(false)

  const handleOpen = useCallback(async () => {
    setOpening(true)
    try {
      await loadPluggySdk()
      if (!window.PluggyConnect) throw new Error('Widget Pluggy indisponível.')

      new window.PluggyConnect({
        connectToken,
        onSuccess,
        onError,
        onClose: () => {
          setOpening(false)
          onClose?.()
        },
      }).init()
    } catch (error: any) {
      onError({ message: error.message })
      setOpening(false)
    }
  }, [connectToken, onClose, onError, onSuccess])

  return (
    <Button onClick={handleOpen} disabled={disabled || opening} size="lg" className="w-full">
      {opening ? 'Abrindo Pluggy...' : '🏦 Conectar minha conta bancária'}
    </Button>
  )
}
