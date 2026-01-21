import path from 'node:path'

export const isSubPath = (baseDir: string, candidate: string) => {
  const base = path.resolve(baseDir)
  const full = path.resolve(candidate)
  const baseNorm = base.endsWith(path.sep) ? base : base + path.sep
  return full.toLowerCase().startsWith(baseNorm.toLowerCase())
}

export const normalizeSlashPath = (value: string) => {
  return value.replace(/\\/g, '/').replace(/^\/+/, '').replace(/\/{2,}/g, '/')
}

