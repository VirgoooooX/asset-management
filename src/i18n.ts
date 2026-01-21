import { useCallback } from 'react'
import { enUS, zhCN } from 'date-fns/locale'
import { useAppSelector } from './store/hooks'
import type { Language } from './store/settingsSlice'

export const getDateFnsLocale = (language: Language) => (language === 'en' ? enUS : zhCN)

export const useI18n = () => {
  const language = useAppSelector((s) => s.settings.language ?? 'zh')
  const tr = useCallback((zh: string, en: string) => (language === 'en' ? en : zh), [language])

  return {
    language,
    tr,
    dateFnsLocale: getDateFnsLocale(language),
  }
}

