import React from 'react'
import { ThemeProvider } from '@mui/material/styles'
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider'
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns'
import App from './App'
import { createAppTheme } from './theme'
import { useAppSelector } from './store/hooks'
import { getDateFnsLocale } from './i18n'

const ThemedApp: React.FC = () => {
  const themeMode = useAppSelector((s) => s.settings.themeMode)
  const density = useAppSelector((s) => s.settings.density)
  const primaryColor = useAppSelector((s) => s.settings.primaryColor)
  const language = useAppSelector((s) => s.settings.language ?? 'zh')

  const theme = React.useMemo(
    () => createAppTheme({ themeMode, density, primaryColor }),
    [density, primaryColor, themeMode]
  )
  const dateFnsLocale = React.useMemo(() => getDateFnsLocale(language), [language])

  return (
    <ThemeProvider theme={theme}>
      <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={dateFnsLocale}>
        <App />
      </LocalizationProvider>
    </ThemeProvider>
  )
}

export default ThemedApp
