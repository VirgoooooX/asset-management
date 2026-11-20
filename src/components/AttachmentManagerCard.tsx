import React from 'react'
import { Alert, Box, Button, Stack, Typography } from '@mui/material'
import { alpha, useTheme } from '@mui/material/styles'
import AttachFileIcon from '@mui/icons-material/AttachFile'
import ImageIcon from '@mui/icons-material/Image'
import AppCard from './AppCard'
import type { AssetAttachment } from '../types'
import { normalizeFileUrlForDisplay } from '../services/storageService'
import { formatBytes, formatDateTime } from '../utils/formatters'
import { isImageAttachment } from '../utils/fileUpload'
import { useI18n } from '../i18n'

interface AttachmentManagerCardProps {
  title?: React.ReactNode
  variant?: 'card' | 'section'
  attachments: AssetAttachment[]
  canManage?: boolean
  uploading?: boolean
  uploadDisabled?: boolean
  error?: string | null
  maxItems?: number
  openLabel?: string
  showImagePreview?: boolean
  onUpload?: (files: File[]) => void
  onDelete?: (attachment: AssetAttachment) => void
  onPreviewImage?: (attachment: AssetAttachment) => void
}

const AttachmentManagerCard: React.FC<AttachmentManagerCardProps> = ({
  title,
  variant = 'card',
  attachments,
  canManage = false,
  uploading = false,
  uploadDisabled = false,
  error = null,
  maxItems = 8,
  openLabel,
  showImagePreview = false,
  onUpload,
  onDelete,
  onPreviewImage,
}) => {
  const theme = useTheme()
  const { tr } = useI18n()

  const uploadButton =
    canManage && onUpload ? (
      <Button
        component="label"
        size="small"
        variant="outlined"
        disabled={uploadDisabled || uploading}
      >
        {uploading
          ? tr('上传中…', 'Uploading…')
          : variant === 'section'
            ? tr('上传附件', 'Upload')
            : tr('上传', 'Upload')}
        <input
          hidden
          type="file"
          multiple
          onChange={(e) => {
            const selectedFiles = Array.from(e.currentTarget.files ?? [])
            e.currentTarget.value = ''
            onUpload(selectedFiles)
          }}
        />
      </Button>
    ) : undefined

  const content = (
    <Stack spacing={1}>
      {error ? <Alert severity="error">{error}</Alert> : null}
      {attachments.length > 0 ? (
        <Stack spacing={1}>
          {attachments.slice(0, maxItems).map((a) => {
            const displayUrl = normalizeFileUrlForDisplay(a.url)
            const isImg = showImagePreview && isImageAttachment(a)
            return (
              <Box
                key={a.id}
                sx={{
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: 2,
                  p: 1.25,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 1.25,
                  backgroundColor: alpha(theme.palette.background.paper, theme.palette.mode === 'dark' ? 0.35 : 0.6),
                }}
              >
                <Box sx={{ minWidth: 0 }}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    {showImagePreview ? (
                      isImg ? <ImageIcon fontSize="small" /> : <AttachFileIcon fontSize="small" />
                    ) : null}
                    <Typography sx={{ fontWeight: 850 }} noWrap>
                      {a.name || tr('未命名文件', 'Untitled')}
                    </Typography>
                  </Stack>
                  <Typography variant="body2" color="text.secondary" noWrap>
                    {formatBytes(a.size)} · {formatDateTime(a.uploadedAt)}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', gap: 1, flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                  {isImg && onPreviewImage ? (
                    <Button size="small" variant="outlined" onClick={() => onPreviewImage(a)}>
                      {tr('查看', 'Preview')}
                    </Button>
                  ) : null}
                  <Button
                    size="small"
                    variant="outlined"
                    component="a"
                    href={displayUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {openLabel ?? tr('下载', 'Download')}
                  </Button>
                  {canManage && onDelete ? (
                    <Button
                      size="small"
                      variant="outlined"
                      color="error"
                      disabled={uploading}
                      onClick={() => onDelete(a)}
                    >
                      {tr('删除', 'Delete')}
                    </Button>
                  ) : null}
                </Box>
              </Box>
            )
          })}
        </Stack>
      ) : (
        <Box
          sx={{
            border: '1px dashed',
            borderColor: alpha(theme.palette.text.primary, theme.palette.mode === 'dark' ? 0.22 : 0.18),
            borderRadius: 2,
            p: variant === 'section' ? 2 : 2.25,
            textAlign: 'center',
            backgroundColor:
              variant === 'card'
                ? alpha(theme.palette.background.paper, theme.palette.mode === 'dark' ? 0.25 : 0.35)
                : undefined,
          }}
        >
          <Typography sx={{ fontWeight: 850 }}>{tr('暂无附件', 'No attachments')}</Typography>
        </Box>
      )}
    </Stack>
  )

  if (variant === 'section') {
    return (
      <Stack spacing={1}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1 }}>
          <Typography variant="body2" sx={{ fontWeight: 850 }}>
            {title ?? tr('技术档案', 'Attachments')}
          </Typography>
          {uploadButton}
        </Box>
        {content}
      </Stack>
    )
  }

  return (
    <AppCard title={title ?? tr('技术档案', 'Attachments')} actions={uploadButton}>
      {content}
    </AppCard>
  )
}

export default AttachmentManagerCard
