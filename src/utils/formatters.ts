import { format, isValid, parseISO } from 'date-fns'
import type { Locale } from 'date-fns'
import { enUS, zhCN } from 'date-fns/locale'
import type { Language } from '../store/settingsSlice'

export const parseMs = (value?: string): number | null => {
  if (!value) return null
  const ms = Date.parse(value)
  return Number.isFinite(ms) ? ms : null
}

const getLocale = (language?: Language, locale?: Locale) => locale ?? (language === 'en' ? enUS : zhCN)

export const formatDateTime = (
  value?: string,
  options?: { fallback?: string; language?: Language; locale?: Locale }
): string => {
  if (!value) return options?.fallback ?? '-'
  const parsed = parseISO(value)
  const d = isValid(parsed) ? parsed : new Date(value)
  if (!isValid(d)) return value
  if (options?.locale || options?.language) {
    return format(d, 'yyyy-MM-dd HH:mm', { locale: getLocale(options.language, options.locale) })
  }
  return d.toLocaleString()
}

export const formatDateTimeShort = (
  value?: string,
  options?: { fallback?: string; language?: Language; locale?: Locale }
): string => {
  if (!value) return options?.fallback ?? '-'
  const d = parseISO(value)
  if (!isValid(d)) return value
  return format(d, 'yyyy-MM-dd HH:mm', { locale: getLocale(options?.language, options?.locale) })
}

export const formatDateOnly = (
  value?: string,
  options?: { fallback?: string; language?: Language; locale?: Locale }
): string => {
  if (!value) return options?.fallback ?? '-'
  const d = parseISO(value)
  if (!isValid(d)) return value
  return format(d, 'yyyy-MM-dd', { locale: getLocale(options?.language, options?.locale) })
}

export const formatMoneyYuan = (cents: number): string => {
  const safe = Number.isFinite(cents) ? cents : 0
  return (Math.round(safe) / 100).toFixed(2)
}

export const formatBytes = (value?: number): string => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '-'
  if (value < 1024) return `${value} B`
  const kb = value / 1024
  if (kb < 1024) return `${kb.toFixed(1)} KB`
  const mb = kb / 1024
  if (mb < 1024) return `${mb.toFixed(1)} MB`
  const gb = mb / 1024
  return `${gb.toFixed(2)} GB`
}

export const formatDurationMs = (ms: number): string => {
  const abs = Math.max(0, Math.round(Math.abs(ms)))
  const totalMinutes = Math.floor(abs / 60000)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  const days = Math.floor(hours / 24)
  if (days > 0) return `${days}d ${hours % 24}h`
  if (hours > 0) return `${hours}h ${minutes}m`
  return `${minutes}m`
}

export const calcDaysFrom = (iso?: string): number => {
  const t = parseMs(iso)
  if (t === null) return 0
  return (Date.now() - t) / (24 * 60 * 60 * 1000)
}

export const formatDays = (value: number, language: Language = 'zh'): string => {
  const v = Math.max(0, Math.floor(value))
  return language === 'en' ? `${v} d` : `${v} 天`
}
