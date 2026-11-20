import { useEffect, useState } from 'react'

const getCurrentMinuteMs = () => Math.floor(Date.now() / 60_000) * 60_000

export const useMinuteClock = (enabled = true): number => {
  const [minuteMs, setMinuteMs] = useState<number>(getCurrentMinuteMs)

  useEffect(() => {
    if (!enabled) return
    const sync = () => setMinuteMs(getCurrentMinuteMs())
    sync()
    const id = window.setInterval(sync, 60_000)
    return () => window.clearInterval(id)
  }, [enabled])

  return minuteMs
}
