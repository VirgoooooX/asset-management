import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'
import { Alert, Snackbar } from '@mui/material'

export type ToastSeverity = 'success' | 'error' | 'warning' | 'info'

export interface ToastContextValue {
  showToast: (message: string, severity?: ToastSeverity) => void
  success: (message: string) => void
  error: (message: string) => void
  warning: (message: string) => void
  info: (message: string) => void
}

const noop = () => {}

const ToastContext = createContext<ToastContextValue>({
  showToast: noop,
  success: noop,
  error: noop,
  warning: noop,
  info: noop,
})

interface ToastItem {
  key: number
  message: string
  severity: ToastSeverity
}

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const counterRef = useRef(0)
  const [open, setOpen] = useState(false)
  const [current, setCurrent] = useState<ToastItem>({ key: 0, message: '', severity: 'info' })

  const showToast = useCallback((message: string, severity: ToastSeverity = 'info') => {
    counterRef.current += 1
    setCurrent({ key: counterRef.current, message, severity })
    setOpen(true)
  }, [])

  const success = useCallback((message: string) => showToast(message, 'success'), [showToast])
  const error = useCallback((message: string) => showToast(message, 'error'), [showToast])
  const warning = useCallback((message: string) => showToast(message, 'warning'), [showToast])
  const info = useCallback((message: string) => showToast(message, 'info'), [showToast])

  const value = useMemo<ToastContextValue>(
    () => ({ showToast, success, error, warning, info }),
    [error, info, showToast, success, warning]
  )

  const handleClose = useCallback((_event?: React.SyntheticEvent | Event, reason?: string) => {
    if (reason === 'clickaway') return
    setOpen(false)
  }, [])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <Snackbar
        key={current.key}
        open={open}
        autoHideDuration={3500}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={handleClose}
          severity={current.severity}
          variant="filled"
          elevation={6}
          sx={{ width: '100%', fontWeight: 600 }}
        >
          {current.message}
        </Alert>
      </Snackbar>
    </ToastContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export const useToast = () => useContext(ToastContext)

export default ToastProvider
