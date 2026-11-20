import React, { useEffect } from 'react'
import { Box, Dialog, IconButton, Typography } from '@mui/material'
import { alpha, useTheme } from '@mui/material/styles'
import CloseIcon from '@mui/icons-material/Close'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import { normalizeFileUrlForDisplay } from '../services/storageService'
import { useI18n } from '../i18n'

export type LightboxImageState = {
  title: string
  urls: string[]
  index: number
}

interface ImageLightboxDialogProps {
  value: LightboxImageState | null
  onChange: React.Dispatch<React.SetStateAction<LightboxImageState | null>>
}

const ImageLightboxDialog: React.FC<ImageLightboxDialogProps> = ({ value, onChange }) => {
  const theme = useTheme()
  const { tr } = useI18n()

  const previewCount = value?.urls.length ?? 0
  const previewIndex = value ? Math.min(Math.max(0, value.index), Math.max(0, previewCount - 1)) : 0
  const previewUrl = value && previewCount > 0 ? value.urls[previewIndex] : undefined

  useEffect(() => {
    if (!value) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onChange(null)
        return
      }
      if (e.key === 'ArrowLeft') {
        onChange((prev) => {
          if (!prev || prev.urls.length <= 1) return prev
          const len = prev.urls.length
          return { ...prev, index: (prev.index - 1 + len) % len }
        })
      } else if (e.key === 'ArrowRight') {
        onChange((prev) => {
          if (!prev || prev.urls.length <= 1) return prev
          const len = prev.urls.length
          return { ...prev, index: (prev.index + 1) % len }
        })
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [value, onChange])

  const stepIndex = (delta: number) => {
    onChange((prev) => {
      if (!prev || prev.urls.length === 0) return prev
      const len = prev.urls.length
      return { ...prev, index: (prev.index + delta + len) % len }
    })
  }

  return (
    <Dialog
      open={Boolean(value)}
      onClose={() => onChange(null)}
      maxWidth={false}
      fullScreen
      PaperProps={{ sx: { backgroundColor: 'transparent', boxShadow: 'none', m: 0, overflow: 'hidden' } }}
      BackdropProps={{ sx: { backgroundColor: alpha('#000', theme.palette.mode === 'dark' ? 0.78 : 0.72) } }}
    >
      <Box
        sx={{
          width: '100dvw',
          height: '100dvh',
          p: { xs: 1.5, sm: 2.5 },
          boxSizing: 'border-box',
          display: 'grid',
          gridTemplateRows: 'auto 1fr',
          gap: 1,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, px: 1, color: '#fff' }}>
          <Typography sx={{ fontWeight: 900 }} noWrap>
            {value?.title || tr('图片预览', 'Preview')}
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {previewUrl ? (
              <IconButton
                component="a"
                href={normalizeFileUrlForDisplay(previewUrl)}
                target="_blank"
                rel="noreferrer"
                sx={{ color: '#fff', backgroundColor: alpha('#000', 0.22), '&:hover': { backgroundColor: alpha('#000', 0.32) } }}
              >
                <OpenInNewIcon fontSize="small" />
              </IconButton>
            ) : null}
            <IconButton
              onClick={() => onChange(null)}
              sx={{ color: '#fff', backgroundColor: alpha('#000', 0.22), '&:hover': { backgroundColor: alpha('#000', 0.32) } }}
            >
              <CloseIcon fontSize="small" />
            </IconButton>
          </Box>
        </Box>

        <Box
          sx={{
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: 0,
            overflow: 'hidden',
          }}
        >
          {previewCount > 1 ? (
            <IconButton
              onClick={() => stepIndex(-1)}
              sx={{
                position: 'absolute',
                left: 12,
                top: '50%',
                transform: 'translateY(-50%)',
                color: '#fff',
                backgroundColor: alpha('#000', 0.28),
                '&:hover': { backgroundColor: alpha('#000', 0.38) },
              }}
            >
              <ChevronLeftIcon />
            </IconButton>
          ) : null}

          {previewUrl ? (
            <Box
              component="img"
              src={normalizeFileUrlForDisplay(previewUrl)}
              alt={value?.title || tr('图片预览', 'Preview')}
              sx={{ maxWidth: '100%', maxHeight: '100%', width: 'auto', height: 'auto', objectFit: 'contain', display: 'block' }}
            />
          ) : null}

          {previewCount > 1 ? (
            <IconButton
              onClick={() => stepIndex(1)}
              sx={{
                position: 'absolute',
                right: 12,
                top: '50%',
                transform: 'translateY(-50%)',
                color: '#fff',
                backgroundColor: alpha('#000', 0.28),
                '&:hover': { backgroundColor: alpha('#000', 0.38) },
              }}
            >
              <ChevronRightIcon />
            </IconButton>
          ) : null}
        </Box>
      </Box>
    </Dialog>
  )
}

export default ImageLightboxDialog
