import { useCallback, useEffect, useRef, useState } from 'react'
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
  autoOpen?: boolean
  onSuccess: (data: { item: { id: string } }) => void
  onError: (error: { message: string }) => void
  onClose?: () => void
}

const SDK_URLS = [
  'https://cdn.pluggy.ai/pluggy-connect/v2/pluggy-connect.js',
  'https://cdn.pluggy.ai/pluggy-connect.js',
  'https://cdn.pluggy.ai/pluggy-connect/v1/pluggy-connect.js',
]

async function loadPluggySdk(): Promise<void> {
  if (window.PluggyConnect) return

  for (const sdkUrl of SDK_URLS) {
    try {
      await new Promise<void>((resolve, reject) => {
        const existing = document.querySelector(`script[src="${sdkUrl}"]`)
        if (existing) {
          if (window.PluggyConnect) return resolve()
          return reject(new Error(`SDK ${sdkUrl} já carregado mas indisponível`))
        }

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

  throw new Error('Não foi possível carregar o widget Pluggy no momento. Tente novamente em alguns segundos.')
}

export function PluggyConnect({ connectToken, onSuccess, onError, onClose, disabled, autoOpen = false }: PluggyConnectProps) {
  const [opening, setOpening] = useState(false)
  const hasAutoOpened = useRef(false)

  const handleOpen = useCallback(async () => {
    if (!connectToken) {
      onError({ message: 'Connect token inválido para abrir o Pluggy.' })
      return
    }

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

  useEffect(() => {
    if (autoOpen && !hasAutoOpened.current && !disabled) {
      hasAutoOpened.current = true
      handleOpen()
    }
  }, [autoOpen, disabled, handleOpen])

  return (
    <Button onClick={handleOpen} disabled={disabled || opening} size="lg" className="w-full">
      {opening ? 'Abrindo Pluggy...' : '🏦 Abrir conexão Pluggy'}
    </Button>
  )
}
