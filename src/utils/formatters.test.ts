import { describe, expect, it } from 'vitest'
import {
  formatBytes,
  formatDateOnly,
  formatDateTime,
  formatDateTimeShort,
  formatDays,
  formatDurationMs,
  formatMoneyYuan,
} from './formatters'

describe('formatters', () => {
  it('formats date strings with fallback and locale support', () => {
    const iso = '2026-05-12T08:30:00.000Z'
    expect(formatDateTime(undefined)).toBe('-')
    expect(formatDateTime(undefined, { fallback: 'N/A' })).toBe('N/A')
    expect(formatDateTime('not-a-date')).toBe('not-a-date')
    expect(formatDateTime(iso, { language: 'en' })).toMatch(/^2026-05-12 \d{2}:\d{2}$/)

    expect(formatDateTimeShort(undefined)).toBe('-')
    expect(formatDateTimeShort('bad')).toBe('bad')
    expect(formatDateTimeShort(iso)).toMatch(/^2026-05-12 \d{2}:\d{2}$/)

    expect(formatDateOnly(undefined, { fallback: 'None' })).toBe('None')
    expect(formatDateOnly('bad')).toBe('bad')
    expect(formatDateOnly(iso)).toBe('2026-05-12')
  })

  it('formats money cents to fixed two-decimal yuan strings', () => {
    expect(formatMoneyYuan(0)).toBe('0.00')
    expect(formatMoneyYuan(12345)).toBe('123.45')
    expect(formatMoneyYuan(99.6)).toBe('1.00')
    expect(formatMoneyYuan(Number.NaN)).toBe('0.00')
  })

  it('formats file sizes cleanly across B, KB, MB, GB', () => {
    expect(formatBytes(undefined)).toBe('-')
    expect(formatBytes(Number.POSITIVE_INFINITY)).toBe('-')
    expect(formatBytes(512)).toBe('512 B')
    expect(formatBytes(1536)).toBe('1.5 KB')
    expect(formatBytes(5 * 1024 * 1024)).toBe('5.0 MB')
    expect(formatBytes(2 * 1024 * 1024 * 1024)).toBe('2.00 GB')
  })

  it('formats durations and days handling zero/negative values', () => {
    expect(formatDurationMs(0)).toBe('0m')
    expect(formatDurationMs(-5 * 60000)).toBe('5m')
    expect(formatDurationMs(95 * 60000)).toBe('1h 35m')
    expect(formatDurationMs((26 * 60 + 15) * 60000)).toBe('1d 2h')

    expect(formatDays(-3, 'zh')).toBe('0 天')
    expect(formatDays(4.9, 'en')).toBe('4 d')
  })
})
