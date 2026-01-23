import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  LinearProgress,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material'
import BuildCircleIcon from '@mui/icons-material/BuildCircle'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import DeleteIcon from '@mui/icons-material/Delete'
import LocalOfferIcon from '@mui/icons-material/LocalOffer'
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline'
import RefreshIcon from '@mui/icons-material/Refresh'
import AttachFileIcon from '@mui/icons-material/AttachFile'
import ImageIcon from '@mui/icons-material/Image'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import PageShell from '../components/PageShell'
import AppCard from '../components/AppCard'
import TitleWithIcon from '../components/TitleWithIcon'
import ConfirmDialog from '../components/ConfirmDialog'
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns'
import { DateTimePicker, LocalizationProvider } from '@mui/x-date-pickers'
import { useI18n } from '../i18n'
import { useNavigate, useParams } from 'react-router-dom'
import type { Asset, RepairStatus, RepairTicket } from '../types'
import * as repairTicketService from '../services/repairTicketService'
import * as assetService from '../services/assetService'
import { deleteFile, normalizeFileUrlForDisplay, uploadFile } from '../services/storageService'
import { useAppSelector } from '../store/hooks'

const statusColor: Record<RepairStatus, 'warning' | 'info' | 'success'> = {
  'quote-pending': 'warning',
  'repair-pending': 'info',
  completed: 'success',
}

const sanitizeFileName = (name: string) =>
  name
    .replace(/[^\w.\-() ]+/g, '_')
    .replace(/\s+/g, '_')
    .slice(0, 120)

const createObjectKey = (fileName: string) => {
  const id =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`
  return `${id}-${sanitizeFileName(fileName)}`
}

const formatBytes = (value?: number) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '-'
  if (value < 1024) return `${value} B`
  const kb = value / 1024
  if (kb < 1024) return `${kb.toFixed(1)} KB`
  const mb = kb / 1024
  if (mb < 1024) return `${mb.toFixed(1)} MB`
  const gb = mb / 1024
  return `${gb.toFixed(2)} GB`
}

const isImageAttachment = (a: { name?: string; contentType?: string }) => {
  if (a.contentType && a.contentType.startsWith('image/')) return true
  const name = (a.name ?? '').toLowerCase()
  return /\.(png|jpg|jpeg|gif|webp|bmp|svg)$/.test(name)
}

const RepairTicketDetailPage: React.FC = () => {
  const { tr, language, dateFnsLocale } = useI18n()
  const navigate = useNavigate()
  const params = useParams()
  const ticketId = typeof params.ticketId === 'string' ? params.ticketId : ''

  const role = useAppSelector((s) => s.auth.user?.role)
  const canManage = role === 'admin' || role === 'manager'

  const [ticket, setTicket] = useState<RepairTicket | null>(null)
  const [asset, setAsset] = useState<Asset | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [editProblemDesc, setEditProblemDesc] = useState('')
  const [editVendorName, setEditVendorName] = useState('')
  const [editQuoteAmount, setEditQuoteAmount] = useState<string>('')
  const [editExpectedReturnAt, setEditExpectedReturnAt] = useState<Date | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const [attachmentsUploading, setAttachmentsUploading] = useState(false)
  const [attachmentsError, setAttachmentsError] = useState<string | null>(null)
  const [pendingRemoveAttachment, setPendingRemoveAttachment] = useState<{ id: string; name?: string } | null>(null)

  const [confirmDeleteTicketOpen, setConfirmDeleteTicketOpen] = useState(false)
  const [imagePreview, setImagePreview] = useState<{ url: string; name?: string } | null>(null)

  const statusLabel = useMemo<Record<RepairStatus, string>>(
    () => ({
      'quote-pending': tr('未询价', 'Quote pending'),
      'repair-pending': tr('待维修', 'Repair pending'),
      completed: tr('已完成', 'Completed'),
    }),
    [tr]
  )

  const formatDays = useMemo(() => {
    return (value: number) => {
      const v = Math.max(0, Math.floor(value))
      return language === 'en' ? `${v} d` : `${v} 天`
    }
  }, [language])

  const calcDaysFrom = useCallback((iso: string) => {
    const t = new Date(iso).getTime()
    if (Number.isNaN(t)) return 0
    return (Date.now() - t) / (24 * 60 * 60 * 1000)
  }, [])

  const load = useCallback(
    async (mode: 'initial' | 'refresh') => {
      if (!ticketId) return
      try {
        setError(null)
        setSaveError(null)
        if (mode === 'initial') setLoading(true)
        else setRefreshing(true)

        const t = await repairTicketService.getRepairTicketById(ticketId)
        if (!t) {
          setTicket(null)
          setError(tr('工单不存在', 'Ticket not found'))
          return
        }
        setTicket(t)
        setEditProblemDesc(t.problemDesc || '')
        setEditVendorName(t.vendorName || '')
        setEditQuoteAmount(t.quoteAmount !== undefined ? String(t.quoteAmount) : '')
        setEditExpectedReturnAt(t.expectedReturnAt ? new Date(t.expectedReturnAt) : null)

        const a = await assetService.getAssetById(t.assetId).catch(() => null)
        setAsset(a)
      } catch (e: any) {
        setError(e?.message || tr('加载工单失败', 'Failed to load ticket'))
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [ticketId, tr]
  )

  useEffect(() => {
    load('initial')
  }, [load])

  const handleSave = useCallback(async () => {
    if (!ticket) return
    if (!canManage) return
    setSaving(true)
    setSaveError(null)
    try {
      await repairTicketService.updateRepairTicket(ticket.id, {
        problemDesc: editProblemDesc.trim(),
        vendorName: editVendorName.trim() || undefined,
        quoteAmount: editQuoteAmount ? Number(editQuoteAmount) : undefined,
        expectedReturnAt: editExpectedReturnAt ? editExpectedReturnAt.toISOString() : undefined,
      })
      const updated = await repairTicketService.getRepairTicketById(ticket.id)
      if (updated) setTicket(updated)
    } catch (e: any) {
      setSaveError(e?.message || tr('保存失败', 'Failed to save'))
    } finally {
      setSaving(false)
    }
  }, [canManage, editExpectedReturnAt, editProblemDesc, editQuoteAmount, editVendorName, ticket, tr])

  const handleMarkQuoted = useCallback(async () => {
    if (!ticket) return
    if (!canManage) return
    const vendor = editVendorName.trim()
    const quote = editQuoteAmount ? Number(editQuoteAmount) : NaN
    if (!vendor || Number.isNaN(quote)) return
    setSaving(true)
    setSaveError(null)
    try {
      await repairTicketService.transitionRepairTicketStatus({
        id: ticket.id,
        to: 'repair-pending',
        vendorName: vendor,
        quoteAmount: quote,
      })
      const updated = await repairTicketService.getRepairTicketById(ticket.id)
      if (updated) setTicket(updated)
    } catch (e: any) {
      setSaveError(e?.message || tr('更新状态失败', 'Failed to update status'))
    } finally {
      setSaving(false)
    }
  }, [canManage, editQuoteAmount, editVendorName, ticket, tr])

  const handleMarkCompleted = useCallback(async () => {
    if (!ticket) return
    if (!canManage) return
    setSaving(true)
    setSaveError(null)
    try {
      await repairTicketService.transitionRepairTicketStatus({ id: ticket.id, to: 'completed' })
      const updated = await repairTicketService.getRepairTicketById(ticket.id)
      if (updated) setTicket(updated)
    } catch (e: any) {
      setSaveError(e?.message || tr('更新状态失败', 'Failed to update status'))
    } finally {
      setSaving(false)
    }
  }, [canManage, ticket, tr])

  const handleDeleteTicket = useCallback(async () => {
    if (!ticket) return
    if (!canManage) return
    setSaving(true)
    setSaveError(null)
    try {
      await repairTicketService.deleteRepairTicket(ticket.id)
      navigate('/repairs', { replace: true })
    } catch (e: any) {
      setSaveError(e?.message || tr('删除失败', 'Delete failed'))
    } finally {
      setSaving(false)
    }
  }, [canManage, navigate, ticket, tr])

  const handleUploadAttachments = useCallback(
    async (files: File[]) => {
      if (!ticket) return
      if (!canManage) return
      if (files.length === 0) return
      setAttachmentsError(null)
      setAttachmentsUploading(true)
      try {
        const existing = ticket.attachments ?? []
        const newItems = await Promise.all(
          files.map(async (file) => {
            const objectKey = createObjectKey(file.name)
            const path = `assets/${ticket.assetId}/repairs/${ticket.id}/attachments/${objectKey}`
            const url = await uploadFile(file, path)
            return {
              id: objectKey,
              name: file.name,
              url,
              path,
              contentType: file.type || undefined,
              size: typeof file.size === 'number' ? file.size : undefined,
              uploadedAt: new Date().toISOString(),
            }
          })
        )
        const merged = existing.concat(newItems)
        await repairTicketService.updateRepairTicket(ticket.id, { attachments: merged })
        const updated = await repairTicketService.getRepairTicketById(ticket.id)
        if (updated) setTicket(updated)
      } catch (e: any) {
        setAttachmentsError(e?.message || tr('上传失败', 'Upload failed'))
      } finally {
        setAttachmentsUploading(false)
      }
    },
    [canManage, ticket, tr]
  )

  const handleConfirmRemoveAttachment = useCallback(async () => {
    if (!ticket) return
    if (!canManage) return
    if (!pendingRemoveAttachment) return
    const existing = ticket.attachments ?? []
    const target = existing.find((a) => a.id === pendingRemoveAttachment.id)
    if (!target) {
      setPendingRemoveAttachment(null)
      return
    }
    setAttachmentsError(null)
    setAttachmentsUploading(true)
    try {
      await deleteFile(target.path || target.url)
      const next = existing.filter((a) => a.id !== target.id)
      await repairTicketService.updateRepairTicket(ticket.id, { attachments: next })
      const updated = await repairTicketService.getRepairTicketById(ticket.id)
      if (updated) setTicket(updated)
      setPendingRemoveAttachment(null)
    } catch (e: any) {
      setAttachmentsError(e?.message || tr('删除失败', 'Delete failed'))
    } finally {
      setAttachmentsUploading(false)
    }
  }, [canManage, pendingRemoveAttachment, ticket, tr])

  const downtimeLabel = ticket?.createdAt ? formatDays(calcDaysFrom(ticket.createdAt)) : '-'

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={dateFnsLocale}>
      <PageShell
        title={<TitleWithIcon icon={<BuildCircleIcon />}>{tr('工单详情', 'Ticket details')}</TitleWithIcon>}
        maxWidth="xl"
        actions={
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
            <Button size="small" variant="outlined" startIcon={<ArrowBackIcon />} onClick={() => navigate('/repairs')}>
              {tr('返回', 'Back')}
            </Button>
            <Tooltip title={tr('刷新', 'Refresh')}>
              <span>
                <IconButton onClick={() => load('refresh')} disabled={loading || refreshing} size="small" color="primary">
                  <RefreshIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
            {canManage ? (
              <Button
                size="small"
                color="error"
                variant="outlined"
                startIcon={<DeleteIcon />}
                onClick={() => setConfirmDeleteTicketOpen(true)}
                disabled={!ticket || saving}
              >
                {tr('删除工单', 'Delete')}
              </Button>
            ) : null}
          </Stack>
        }
      >
        {loading ? (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', p: 3 }}>
            <CircularProgress size={22} />
            <Typography sx={{ ml: 2 }}>{tr('正在加载...', 'Loading...')}</Typography>
          </Box>
        ) : error ? (
          <Alert severity="error">{error}</Alert>
        ) : !ticket ? (
          <Alert severity="error">{tr('工单不存在', 'Ticket not found')}</Alert>
        ) : (
          <Stack spacing={2}>
            {refreshing ? <LinearProgress /> : null}
            {saveError ? <Alert severity="error">{saveError}</Alert> : null}

            <AppCard
              title={tr('基本信息', 'Overview')}
              actions={
                <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                  <Chip size="small" label={statusLabel[ticket.status]} color={statusColor[ticket.status]} />
                  <Chip size="small" variant="outlined" label={tr(`停机: ${downtimeLabel}`, `Downtime: ${downtimeLabel}`)} />
                  {asset && canManage ? (
                    <Button
                      size="small"
                      variant="outlined"
                      endIcon={<OpenInNewIcon fontSize="small" />}
                      onClick={() => navigate(`/assets/${encodeURIComponent(asset.id)}`)}
                    >
                      {tr('打开设备', 'Open asset')}
                    </Button>
                  ) : null}
                </Stack>
              }
            >
              <Stack spacing={2}>
                <Stack spacing={0.25}>
                  <Typography variant="body2" color="text.secondary">
                    {tr('设备', 'Asset')}
                  </Typography>
                  <Typography sx={{ fontWeight: 850 }}>
                    {asset?.name || tr(`设备 ${ticket.assetId.slice(0, 8)}`, `Asset ${ticket.assetId.slice(0, 8)}`)}
                  </Typography>
                </Stack>

                <TextField
                  label={tr('故障/需求描述', 'Issue / request')}
                  value={editProblemDesc}
                  onChange={(e) => setEditProblemDesc(e.target.value)}
                  fullWidth
                  size="small"
                  multiline
                  minRows={3}
                  disabled={!canManage || saving}
                />

                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                  <TextField
                    label={tr('供应商（可选）', 'Vendor (optional)')}
                    value={editVendorName}
                    onChange={(e) => setEditVendorName(e.target.value)}
                    fullWidth
                    size="small"
                    disabled={!canManage || saving}
                  />
                  <TextField
                    label={tr('报价（可选）', 'Quote (optional)')}
                    value={editQuoteAmount}
                    onChange={(e) => setEditQuoteAmount(e.target.value)}
                    fullWidth
                    size="small"
                    inputProps={{ inputMode: 'decimal' }}
                    disabled={!canManage || saving}
                  />
                </Stack>

                <DateTimePicker
                  label={tr('预计回归时间（可选）', 'Expected return time (optional)')}
                  value={editExpectedReturnAt}
                  onChange={(v) => setEditExpectedReturnAt(v)}
                  slotProps={{ textField: { fullWidth: true, size: 'small', disabled: !canManage || saving } }}
                />

                {canManage ? (
                  <Stack direction="row" spacing={1} justifyContent="flex-end" flexWrap="wrap">
                    <Button variant="outlined" onClick={handleSave} disabled={saving}>
                      {saving ? tr('保存中...', 'Saving...') : tr('保存', 'Save')}
                    </Button>
                    {ticket.status === 'quote-pending' ? (
                      <Button
                        variant="contained"
                        startIcon={<LocalOfferIcon />}
                        onClick={handleMarkQuoted}
                        disabled={saving || !editVendorName.trim() || !editQuoteAmount}
                      >
                        {tr('标记已询价', 'Mark quoted')}
                      </Button>
                    ) : null}
                    {ticket.status === 'repair-pending' ? (
                      <Button
                        variant="contained"
                        color="success"
                        startIcon={<CheckCircleOutlineIcon />}
                        onClick={handleMarkCompleted}
                        disabled={saving}
                      >
                        {tr('维修完成', 'Mark completed')}
                      </Button>
                    ) : null}
                  </Stack>
                ) : null}
              </Stack>
            </AppCard>

            {canManage ? (
              <AppCard
                title={<TitleWithIcon icon={<AttachFileIcon />}>{tr('图片与附件', 'Evidence & attachments')}</TitleWithIcon>}
                actions={
                  <Button component="label" size="small" variant="outlined" disabled={attachmentsUploading}>
                    {attachmentsUploading ? tr('上传中…', 'Uploading…') : tr('上传', 'Upload')}
                    <input
                      hidden
                      type="file"
                      multiple
                      onChange={(e) => {
                        const selectedFiles = Array.from(e.currentTarget.files ?? [])
                        e.currentTarget.value = ''
                        handleUploadAttachments(selectedFiles)
                      }}
                    />
                  </Button>
                }
              >
                <Stack spacing={1}>
                  {attachmentsError ? <Alert severity="error">{attachmentsError}</Alert> : null}
                  {ticket.attachments?.length ? (
                    <Stack spacing={1}>
                      {ticket.attachments.slice(0, 24).map((a) => (
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
                            backgroundColor: (theme) => (theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)'),
                          }}
                        >
                          <Box sx={{ minWidth: 0 }}>
                            <Stack direction="row" spacing={1} alignItems="center">
                              {isImageAttachment(a) ? <ImageIcon fontSize="small" /> : <AttachFileIcon fontSize="small" />}
                              <Typography sx={{ fontWeight: 850 }} noWrap>
                                {a.name || tr('未命名文件', 'Untitled')}
                              </Typography>
                            </Stack>
                            <Typography variant="body2" color="text.secondary" noWrap>
                              {formatBytes(a.size)} · {a.uploadedAt ? new Date(a.uploadedAt).toLocaleString() : '-'}
                            </Typography>
                          </Box>
                          <Box sx={{ display: 'flex', gap: 1, flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                            {isImageAttachment(a) ? (
                              <Button
                                size="small"
                                variant="outlined"
                                onClick={() => setImagePreview({ url: normalizeFileUrlForDisplay(a.url), name: a.name })}
                              >
                                {tr('查看', 'Preview')}
                              </Button>
                            ) : null}
                            <Button
                              size="small"
                              variant="outlined"
                              component="a"
                              href={normalizeFileUrlForDisplay(a.url)}
                              target="_blank"
                              rel="noreferrer"
                            >
                              {tr('下载', 'Download')}
                            </Button>
                            <Button
                              size="small"
                              variant="outlined"
                              color="error"
                              onClick={() => setPendingRemoveAttachment({ id: a.id, name: a.name })}
                              disabled={attachmentsUploading}
                            >
                              {tr('删除', 'Delete')}
                            </Button>
                          </Box>
                        </Box>
                      ))}
                    </Stack>
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      {tr('暂无附件', 'No attachments')}
                    </Typography>
                  )}
                </Stack>
              </AppCard>
            ) : null}

            <AppCard title={tr('流转记录', 'Timeline')}>
              {ticket.timeline && ticket.timeline.length > 0 ? (
                <Stack spacing={0.5}>
                  {ticket.timeline
                    .slice()
                    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
                    .slice(0, 12)
                    .map((e, idx) => (
                      <Typography key={`${e.at}-${idx}`} variant="body2" color="text.secondary" noWrap>
                        {new Date(e.at).toLocaleString()} · {e.from ? statusLabel[e.from] : tr('创建', 'Created')} → {statusLabel[e.to]}
                        {e.note ? ` · ${e.note}` : ''}
                      </Typography>
                    ))}
                </Stack>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  {tr('暂无流转记录', 'No timeline')}
                </Typography>
              )}
            </AppCard>
          </Stack>
        )}

        <ConfirmDialog
          open={Boolean(pendingRemoveAttachment)}
          title={tr('确认删除', 'Confirm deletion')}
          description={tr(
            `确定要删除附件${pendingRemoveAttachment?.name ? `：${pendingRemoveAttachment.name}` : ''}吗？此操作无法撤销。`,
            `Delete this attachment${pendingRemoveAttachment?.name ? `: ${pendingRemoveAttachment.name}` : ''}? This action cannot be undone.`
          )}
          confirmText={tr('删除', 'Delete')}
          confirmColor="error"
          onClose={() => setPendingRemoveAttachment(null)}
          onConfirm={handleConfirmRemoveAttachment}
        />

        <ConfirmDialog
          open={confirmDeleteTicketOpen}
          title={tr('确认删除', 'Confirm deletion')}
          description={tr('确定要删除该维修工单吗？删除后将尝试把设备状态恢复为“可用”。', 'Delete this repair ticket? After deletion, the asset status will be restored to “available” if possible.')}
          confirmText={tr('删除', 'Delete')}
          confirmColor="error"
          onClose={() => setConfirmDeleteTicketOpen(false)}
          onConfirm={handleDeleteTicket}
        />

        <Dialog open={Boolean(imagePreview)} onClose={() => setImagePreview(null)} fullWidth maxWidth="md">
          <DialogTitle>{imagePreview?.name || tr('图片预览', 'Image preview')}</DialogTitle>
          <DialogContent dividers>
            {!imagePreview?.url ? null : (
              <Box
                component="img"
                src={imagePreview.url}
                alt={imagePreview?.name || 'image'}
                sx={{
                  width: '100%',
                  height: 'auto',
                  borderRadius: 2,
                  border: '1px solid',
                  borderColor: 'divider',
                }}
              />
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setImagePreview(null)}>{tr('关闭', 'Close')}</Button>
          </DialogActions>
        </Dialog>
      </PageShell>
    </LocalizationProvider>
  )
}

export default RepairTicketDetailPage
