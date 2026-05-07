import DogAvatar from '@/components/DogAvatar'

export default function OfflinePage() {
  return (
    <div className="min-h-dvh flex flex-col items-center justify-center gap-6 px-4 text-center">
      <DogAvatar size={80} />
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight mb-2">You&apos;re offline</h1>
        <p className="text-sm text-foreground/60">
          GoofyScoops needs a connection to sync.<br />
          Come back when you&apos;ve got signal.
        </p>
      </div>
    </div>
  )
}
