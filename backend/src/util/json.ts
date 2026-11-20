export const parseJson = <T>(value: unknown): T | undefined => {
  if (typeof value !== 'string' || !value) return undefined
  try {
    return JSON.parse(value) as T
  } catch {
    return undefined
  }
}

export const parseJsonOr = <T>(value: unknown, fallback: T): T => {
  const parsed = parseJson<T>(value)
  return parsed === undefined ? fallback : parsed
}
