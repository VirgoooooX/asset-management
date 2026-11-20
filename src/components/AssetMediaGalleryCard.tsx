import React from 'react'
import { Box, Button, Typography } from '@mui/material'
import { alpha, useTheme } from '@mui/material/styles'
import AppCard from './AppCard'
import { normalizeFileUrlForDisplay } from '../services/storageService'
import { useI18n } from '../i18n'

interface AssetMediaGalleryCardProps {
  title: React.ReactNode
  urls: string[]
  altText: string
  emptyText: string
  canUpload?: boolean
  canDelete?: boolean
  uploading?: boolean
  maxItems?: number
  onUpload?: (files: File[]) => void
  onDelete?: (url: string) => void
  onPreview?: (index: number) => void
}

const AssetMediaGalleryCard: React.FC<AssetMediaGalleryCardProps> = ({
  title,
  urls,
  altText,
  emptyText,
  canUpload = false,
  canDelete = false,
  uploading = false,
  maxItems = 12,
  onUpload,
  onDelete,
  onPreview,
}) => {
  const theme = useTheme()
  const { tr } = useI18n()

  const actions =
    canUpload && onUpload ? (
      <Button component="label" size="small" variant="outlined" disabled={uploading}>
        {uploading ? tr('上传中…', 'Uploading…') : tr('上传', 'Upload')}
        <input
          hidden
          type="file"
          accept="image/*"
          multiple
          onChange={(e) => {
            const selectedFiles = Array.from(e.currentTarget.files ?? [])
            e.currentTarget.value = ''
            onUpload(selectedFiles)
          }}
        />
      </Button>
    ) : undefined

  return (
    <AppCard title={title} actions={actions}>
      {urls.length ? (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          {urls.slice(0, maxItems).map((url, index) => (
            <Box
              key={`${url}-${index}`}
              sx={{
                position: 'relative',
                height: { xs: 88, sm: 110, md: 130 },
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 1.5,
                border: '1px solid',
                borderColor: 'divider',
                overflow: 'hidden',
                cursor: onPreview ? 'zoom-in' : 'default',
              }}
              onClick={() => onPreview?.(index)}
            >
              <Box
                component="img"
                src={normalizeFileUrlForDisplay(url)}
                alt={altText}
                loading="lazy"
                sx={{
                  height: '100%',
                  width: 'auto',
                  objectFit: 'contain',
                  display: 'block',
                }}
              />
              {canDelete && onDelete ? (
                <Button
                  size="small"
                  color="error"
                  variant="contained"
                  onClick={(e) => {
                    e.stopPropagation()
                    onDelete(url)
                  }}
                  sx={{
                    position: 'absolute',
                    top: 6,
                    right: 6,
                    minWidth: 0,
                    px: 1,
                    py: 0.5,
                    fontWeight: 850,
                  }}
                >
                  {tr('删', 'Del')}
                </Button>
              ) : null}
            </Box>
          ))}
        </Box>
      ) : (
        <Box
          sx={{
            border: '1px dashed',
            borderColor: alpha(theme.palette.text.primary, theme.palette.mode === 'dark' ? 0.22 : 0.18),
            borderRadius: 2,
            p: 2.25,
            textAlign: 'center',
            backgroundColor: alpha(theme.palette.background.paper, theme.palette.mode === 'dark' ? 0.25 : 0.35),
          }}
        >
          <Typography sx={{ fontWeight: 850 }}>{emptyText}</Typography>
        </Box>
      )}
    </AppCard>
  )
}

export default AssetMediaGalleryCard
