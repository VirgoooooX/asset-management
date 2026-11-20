export interface HolidayDetail {
  holiday: boolean
  name: string
  wage?: number
  date: string
  rest?: number
  after?: boolean
  target?: string
}

export interface ApiHolidayResponse {
  code: number
  holiday?: {
    [monthDayOrFullDate: string]: HolidayDetail
  }
}

export const parseHolidayCalendar = (data: ApiHolidayResponse, year: number): Map<string, HolidayDetail> => {
  const entries = data?.holiday
  if (data?.code !== 0 || !entries || typeof entries !== 'object' || Array.isArray(entries)) {
    throw new Error(`Invalid holiday calendar for ${year}`)
  }

  const holidays = new Map<string, HolidayDetail>()
  const datePattern = new RegExp(`^${year}-\\d{2}-\\d{2}$`)
  for (const detail of Object.values(entries)) {
    if (
      !detail ||
      typeof detail.date !== 'string' ||
      !datePattern.test(detail.date) ||
      typeof detail.holiday !== 'boolean' ||
      typeof detail.name !== 'string' ||
      typeof detail.wage !== 'number'
    ) {
      throw new Error(`Invalid holiday entry for ${year}`)
    }
    holidays.set(detail.date, detail)
  }
  return holidays
}

export const fetchHolidayCnDays = async (year: number): Promise<HolidayDetail[]> => {
  const response = await fetch(`https://cdn.jsdelivr.net/gh/NateScarlet/holiday-cn@master/${year}.json`, {
    signal: AbortSignal.timeout(5000),
  })
  if (response.status === 404) return []
  if (!response.ok) throw new Error(`holiday-cn returned HTTP ${response.status}`)

  const data: { year: number; days: Array<{ name: string; date: string; isOffDay: boolean }> } = await response.json()
  if (data?.year !== year || !Array.isArray(data.days)) {
    throw new Error(`Invalid holiday-cn calendar for ${year}`)
  }

  return data.days.map((day): HolidayDetail => {
    if (
      !day ||
      typeof day.name !== 'string' ||
      typeof day.isOffDay !== 'boolean' ||
      typeof day.date !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}$/.test(day.date)
    ) {
      throw new Error(`Invalid holiday-cn entry for ${year}`)
    }
    return { date: day.date, holiday: day.isOffDay, name: day.isOffDay ? day.name : `${day.name}补班` }
  })
}

const FALLBACK_2025_CN: ApiHolidayResponse = {
  code: 0,
  holiday: {
    '01-01': { holiday: true, name: '元旦', wage: 3, date: '2025-01-01', rest: 17 },
    '01-26': { holiday: false, name: '春节前补班', wage: 1, after: false, target: '春节', date: '2025-01-26', rest: 7 },
    '01-28': { holiday: true, name: '除夕', wage: 2, date: '2025-01-28', rest: 9 },
    '01-29': { holiday: true, name: '初一', wage: 3, date: '2025-01-29', rest: 1 },
    '01-30': { holiday: true, name: '初二', wage: 3, date: '2025-01-30', rest: 1 },
    '01-31': { holiday: true, name: '初三', wage: 3, date: '2025-01-31', rest: 1 },
    '02-01': { holiday: true, name: '初四', wage: 2, date: '2025-02-01', rest: 1 },
    '02-02': { holiday: true, name: '初五', wage: 2, date: '2025-02-02', rest: 1 },
    '02-03': { holiday: true, name: '初六', wage: 2, date: '2025-02-03', rest: 1 },
    '02-04': { holiday: true, name: '初七', wage: 2, date: '2025-02-04', rest: 1 },
    '02-08': { holiday: false, name: '春节后补班', wage: 1, target: '春节', after: true, date: '2025-02-08', rest: 4 },
    '04-04': { holiday: true, name: '清明节', wage: 3, date: '2025-04-04', rest: 19 },
    '04-05': { holiday: true, name: '清明节', wage: 2, date: '2025-04-05', rest: 1 },
    '04-06': { holiday: true, name: '清明节', wage: 2, date: '2025-04-06', rest: 1 },
    '04-27': { holiday: false, name: '劳动节前补班', wage: 1, target: '劳动节', after: false, date: '2025-04-27', rest: 17 },
    '05-01': { holiday: true, name: '劳动节', wage: 3, date: '2025-05-01', rest: 4 },
    '05-02': { holiday: true, name: '劳动节', wage: 2, date: '2025-05-02', rest: 1 },
    '05-03': { holiday: true, name: '劳动节', wage: 3, date: '2025-05-03', rest: 1 },
    '05-04': { holiday: true, name: '劳动节', wage: 3, date: '2025-05-04', rest: 1 },
    '05-05': { holiday: true, name: '劳动节', wage: 3, date: '2025-05-05', rest: 1 },
    '05-31': { holiday: true, name: '端午节', wage: 3, date: '2025-05-31', rest: 23 },
    '06-01': { holiday: true, name: '端午节', wage: 2, date: '2025-06-01', rest: 1 },
    '06-02': { holiday: true, name: '端午节', wage: 2, date: '2025-06-02', rest: 1 },
    '09-28': { holiday: false, name: '国庆节前补班', after: false, wage: 1, target: '国庆节', date: '2025-09-28', rest: 89 },
    '10-01': { holiday: true, name: '国庆节', wage: 3, date: '2025-10-01', rest: 92 },
    '10-02': { holiday: true, name: '国庆节', wage: 3, date: '2025-10-02', rest: 1 },
    '10-03': { holiday: true, name: '国庆节', wage: 3, date: '2025-10-03', rest: 1 },
    '10-04': { holiday: true, name: '国庆节', wage: 2, date: '2025-10-04', rest: 1 },
    '10-05': { holiday: true, name: '国庆节', wage: 2, date: '2025-10-05', rest: 1 },
    '10-06': { holiday: true, name: '中秋节', wage: 2, date: '2025-10-06', rest: 1 },
    '10-07': { holiday: true, name: '国庆节', wage: 2, date: '2025-10-07', rest: 1 },
    '10-08': { holiday: true, name: '国庆节', wage: 2, date: '2025-10-08', rest: 1 },
    '10-11': { holiday: false, after: true, wage: 1, name: '国庆节后补班', target: '国庆节', date: '2025-10-11' },
  },
}

export const loadHolidayCalendar = async (year: number, region: string): Promise<Map<string, HolidayDetail>> => {
  if (region === 'cn') {
    const cacheKey = `chamber-tracker:cn-holidays:${year}`
    try {
      const response = await fetch(`https://timor.tech/api/holiday/year/${year}/`, {
        signal: AbortSignal.timeout(5000),
      })
      if (!response.ok) throw new Error(`Timor returned HTTP ${response.status}`)
      const data = await response.json()
      const holidays = parseHolidayCalendar(data, year)
      if (holidays.size > 0) {
        try {
          localStorage.setItem(cacheKey, JSON.stringify(data))
        } catch {
          // Live result is still usable if browser storage is unavailable.
        }
        return holidays
      }
    } catch (error) {
      console.warn(`Could not load Timor holiday data for ${year}:`, error)
    }

    try {
      const cached = localStorage.getItem(cacheKey)
      if (cached) {
        const holidays = parseHolidayCalendar(JSON.parse(cached), year)
        if (holidays.size > 0) return holidays
      }
    } catch {
      // Fall back to bundled/CDN sources below.
    }
  }

  try {
    const response = await fetch(`/holidays/${region.toLowerCase()}/${year}.json`)
    if (response.ok) {
      const holidays = parseHolidayCalendar(await response.json(), year)
      if (holidays.size > 0) return holidays
    } else if (response.status !== 404) {
      throw new Error(`Holiday file returned HTTP ${response.status}`)
    }
  } catch (error) {
    console.warn(`Could not load local holiday data for ${year} (${region}):`, error)
  }

  if (region === 'cn') {
    try {
      const [days, nextYearDays] = await Promise.all([
        fetchHolidayCnDays(year),
        fetchHolidayCnDays(year + 1).catch(() => []),
      ])
      const holidays = new Map<string, HolidayDetail>()
      for (const day of [...days, ...nextYearDays]) {
        if (day.date.startsWith(`${year}-`)) holidays.set(day.date, day)
      }
      if (holidays.size > 0) return holidays
    } catch (error) {
      console.warn(`Could not load holiday-cn data for ${year}:`, error)
    }
  }

  if (year === 2025 && region === 'cn') {
    return parseHolidayCalendar(FALLBACK_2025_CN, year)
  }

  return new Map()
}
