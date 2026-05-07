'use client'
import { useEffect, useState } from 'react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export function InstallPrompt() {
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault()
      setPrompt(e as BeforeInstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  if (!prompt || dismissed) return null

  return (
    <div className="bg-white rounded-2xl px-4 py-3 border border-[#E8DCC8] flex items-center gap-3">
      <p className="text-xs font-medium text-foreground flex-1">
        Add GoofyScoops to your home screen
      </p>
      <button
        onClick={async () => {
          await prompt.prompt()
          const { outcome } = await prompt.userChoice
          if (outcome === 'accepted' || outcome === 'dismissed') setDismissed(true)
        }}
        className="bg-goofy-teal text-white text-xs font-bold px-4 py-2 rounded-full shrink-0 active:scale-[0.98] transition-all"
      >
        Install
      </button>
      <button
        onClick={() => setDismissed(true)}
        className="text-sm text-foreground/60 hover:text-foreground/80 transition-colors leading-none shrink-0"
        aria-label="Dismiss"
      >
        ✕
      </button>
    </div>
  )
}
