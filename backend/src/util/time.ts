export const parseIsoMs = (value: string | null | undefined) => {
  if (!value) return null
  const ms = Date.parse(value)
  if (!Number.isFinite(ms)) return null
  return ms
}

