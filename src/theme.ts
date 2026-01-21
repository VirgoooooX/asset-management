import { alpha, createTheme, darken, lighten } from '@mui/material/styles'
import type { SettingsState } from './store/settingsSlice'

export const createAppTheme = (settings: Pick<SettingsState, 'themeMode' | 'density' | 'primaryColor'>) => {
  const primaryMain = settings.primaryColor || '#155EEF'
  const mode = settings.themeMode || 'light'
  const isDark = mode === 'dark'

  const lightPrimary = lighten(primaryMain, 0.15)
  const darkPrimary = darken(primaryMain, 0.15)

  const backgroundDefault = isDark ? '#0b1220' : '#f6f8fc'
  const backgroundPaper = isDark ? '#0f172a' : '#ffffff'
  const textPrimary = isDark ? '#e2e8f0' : '#0f172a'
  const textSecondary = isDark ? alpha('#e2e8f0', 0.72) : alpha('#0f172a', 0.68)

  const isCompact = settings.density === 'compact'
  const controlHeight = isCompact ? 34 : 36

  return createTheme({
    palette: {
      mode,
      primary: {
        main: primaryMain,
        light: lightPrimary,
        dark: darkPrimary,
        contrastText: '#ffffff',
      },
      secondary: {
        main: isDark ? '#94a3b8' : '#5b6b7a',
      },
      background: {
        default: backgroundDefault,
        paper: backgroundPaper,
      },
      divider: isDark ? alpha('#e2e8f0', 0.14) : alpha('#0f172a', 0.12),
      text: {
        primary: textPrimary,
        secondary: textSecondary,
      },
    },
    shape: {
      borderRadius: 10,
    },
    typography: {
      fontFamily:
        "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif",
      button: {
        textTransform: 'none',
        fontWeight: 600,
      },
      h4: {
        fontWeight: 700,
        letterSpacing: '-0.02em',
      },
      h5: {
        fontWeight: 700,
        letterSpacing: '-0.02em',
      },
      h6: {
        fontWeight: 700,
      },
    },
    components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundColor: backgroundDefault,
          backgroundImage: isDark
            ? `radial-gradient(900px circle at 10% 0%, ${alpha(primaryMain, 0.22)} 0%, transparent 58%), radial-gradient(700px circle at 85% 15%, ${alpha(lightPrimary, 0.14)} 0%, transparent 55%)`
            : `radial-gradient(900px circle at 10% 0%, ${alpha(primaryMain, 0.16)} 0%, transparent 58%), radial-gradient(700px circle at 85% 15%, ${alpha(lightPrimary, 0.10)} 0%, transparent 55%)`,
          backgroundAttachment: 'fixed',
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: ({ theme }) => ({
          borderRadius: theme.shape.borderRadius,
          backgroundImage: 'none',
        }),
      },
    },
    MuiButton: {
      defaultProps: {
        disableElevation: true,
      },
      styleOverrides: {
        root: ({ theme }) => ({
          borderRadius: theme.shape.borderRadius,
          minHeight: isCompact ? 34 : 36,
          paddingInline: theme.spacing(1.5),
          gap: theme.spacing(0.75),
        }),
        containedPrimary: ({ theme }) => ({
          boxShadow: `0 10px 22px ${alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.24 : 0.20)}`,
          '&:hover': {
            boxShadow: `0 14px 30px ${alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.30 : 0.26)}`,
          },
        }),
      },
    },
    MuiTextField: {
      defaultProps: {
        variant: 'outlined',
        size: isCompact ? 'small' : 'medium',
        margin: isCompact ? 'dense' : 'normal',
      },
    },
    MuiInputBase: {
      styleOverrides: {
        root: {
          alignItems: 'center',
          minHeight: controlHeight,
          '&.MuiInputBase-multiline': {
            minHeight: 'auto',
          },
        },
      },
    },
    MuiOutlinedInput: {
      defaultProps: {
        size: isCompact ? 'small' : 'medium',
      },
      styleOverrides: {
        root: ({ theme }) => ({
          minHeight: controlHeight,
          borderRadius: theme.shape.borderRadius,
          backgroundColor: theme.palette.background.paper,
          transition: 'border-color 150ms ease, box-shadow 150ms ease, background-color 150ms ease',
          '&:hover .MuiOutlinedInput-notchedOutline': {
            borderColor: alpha(theme.palette.text.primary, 0.32),
          },
          '&.Mui-focused': {
            boxShadow: `0 0 0 4px ${alpha(theme.palette.primary.main, 0.18)}`,
          },
        }),
        notchedOutline: ({ theme }) => ({
          borderColor: alpha(theme.palette.text.primary, 0.18),
        }),
        input: ({ theme }) => ({
          lineHeight: 1.2,
          padding: isCompact ? `${theme.spacing(0.9)} ${theme.spacing(1.75)}` : `${theme.spacing(1.05)} ${theme.spacing(1.75)}`,
        }),
      },
    },
    MuiInputLabel: {
      styleOverrides: {
        root: ({ theme }) => ({
          color: alpha(theme.palette.text.primary, 0.68),
          '&.MuiInputLabel-outlined:not(.MuiInputLabel-shrink)': {
            transform: `translate(${theme.spacing(1.75)}, ${isCompact ? theme.spacing(1.1) : theme.spacing(1.25)}) scale(1)`,
          },
          '&.MuiInputLabel-outlined.MuiInputLabel-sizeSmall:not(.MuiInputLabel-shrink)': {
            transform: `translate(${theme.spacing(1.75)}, ${isCompact ? theme.spacing(1.05) : theme.spacing(1.15)}) scale(1)`,
          },
        }),
      },
    },
    MuiFormHelperText: {
      styleOverrides: {
        root: ({ theme }) => ({
          marginLeft: theme.spacing(0.25),
          marginRight: theme.spacing(0.25),
        }),
      },
    },
    MuiSelect: {
      defaultProps: {
        size: isCompact ? 'small' : 'medium',
      },
      styleOverrides: {
        select: ({ theme }) => ({
          display: 'flex',
          alignItems: 'center',
          lineHeight: 1.2,
          minHeight: 'auto',
          paddingTop: isCompact ? theme.spacing(0.9) : theme.spacing(1.05),
          paddingBottom: isCompact ? theme.spacing(0.9) : theme.spacing(1.05),
          paddingLeft: theme.spacing(1.75),
        }),
      },
    },
    MuiMenuItem: {
      styleOverrides: {
        root: ({ theme }) => ({
          borderRadius: theme.shape.borderRadius,
        }),
      },
    },
    MuiTableContainer: {
      styleOverrides: {
        root: ({ theme }) => ({
          border: `1px solid ${theme.palette.divider}`,
          borderRadius: theme.shape.borderRadius,
          boxShadow: `0 1px 2px ${alpha(theme.palette.text.primary, theme.palette.mode === 'dark' ? 0.18 : 0.06)}`,
        }),
      },
    },
    MuiTableHead: {
      styleOverrides: {
        root: ({ theme }) => ({
          backgroundColor: alpha(theme.palette.text.primary, theme.palette.mode === 'dark' ? 0.06 : 0.04),
        }),
      },
    },
    MuiTableCell: {
      styleOverrides: {
        head: ({ theme }) => ({
          fontWeight: 700,
          color: theme.palette.text.secondary,
          borderBottom: `1px solid ${theme.palette.divider}`,
        }),
        body: ({ theme }) => ({
          borderBottom: `1px solid ${alpha(theme.palette.text.primary, 0.06)}`,
        }),
      },
    },
    MuiDialogTitle: {
      styleOverrides: {
        root: ({ theme }) => ({
          padding: theme.spacing(2, 2.5),
          fontWeight: 800,
        }),
      },
    },
    MuiDialogContent: {
      styleOverrides: {
        root: ({ theme }) => ({
          padding: theme.spacing(2, 2.5),
        }),
        dividers: ({ theme }) => ({
          borderTop: `1px solid ${theme.palette.divider}`,
          borderBottom: `1px solid ${theme.palette.divider}`,
        }),
      },
    },
    MuiDialogActions: {
      styleOverrides: {
        root: ({ theme }) => ({
          padding: theme.spacing(1.5, 2.5, 2, 2.5),
          gap: theme.spacing(1),
        }),
      },
    },
    MuiAlert: {
      styleOverrides: {
        root: ({ theme }) => ({
          borderRadius: theme.shape.borderRadius,
        }),
      },
    },
    MuiChip: {
      defaultProps: {
        size: isCompact ? 'small' : 'medium',
      },
      styleOverrides: {
        root: ({ theme }) => ({
          borderRadius: theme.shape.borderRadius,
          height: controlHeight,
          paddingInline: theme.spacing(0.25),
          '& .MuiChip-label': {
            paddingInline: theme.spacing(1),
            fontWeight: 650,
            lineHeight: 1,
          },
        }),
      },
    },
    MuiToggleButtonGroup: {
      styleOverrides: {
        root: ({ theme }) => ({
          borderRadius: theme.shape.borderRadius,
          overflow: 'hidden',
          '& .MuiToggleButtonGroup-grouped': {
            margin: 0,
            border: `1px solid ${theme.palette.divider}`,
            borderRadius: 0,
          },
          '& .MuiToggleButtonGroup-grouped:not(:first-of-type)': {
            borderLeft: 0,
            marginLeft: -1,
          },
          '& .MuiToggleButtonGroup-grouped:first-of-type': {
            borderTopLeftRadius: theme.shape.borderRadius,
            borderBottomLeftRadius: theme.shape.borderRadius,
          },
          '& .MuiToggleButtonGroup-grouped:last-of-type': {
            borderTopRightRadius: theme.shape.borderRadius,
            borderBottomRightRadius: theme.shape.borderRadius,
          },
        }),
      },
    },
    MuiToggleButton: {
      styleOverrides: {
        root: ({ theme }) => ({
          minHeight: controlHeight,
          borderRadius: 0,
          paddingInline: theme.spacing(1.25),
          fontWeight: 650,
          textTransform: 'none',
          '&.Mui-selected': {
            backgroundColor: alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.20 : 0.12),
            borderColor: alpha(theme.palette.primary.main, 0.35),
          },
          '&.Mui-selected:hover': {
            backgroundColor: alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.26 : 0.18),
          },
        }),
      },
    },
    },
  })
}
