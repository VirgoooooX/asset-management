import React, { useCallback, useEffect, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
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
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import PageShell from '../components/PageShell'
import AppCard from '../components/AppCard'
import TitleWithIcon from '../components/TitleWithIcon'
import ConfirmDialog from '../components/ConfirmDialog'
import StatusChip from '../components/StatusChip'
import AttachmentManagerCard from '../components/AttachmentManagerCard'
import { useToast } from '../components/ToastProvider'
import ImageLightboxDialog, { type LightboxImageState } from '../components/ImageLightboxDialog'
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker'
import { useI18n } from '../i18n'
import { useNavigate, useParams } from 'react-router-dom'
import type { Asset, AssetAttachment, RepairTicket } from '../types'
import * as repairTicketService from '../services/repairTicketService'
import * as assetService from '../services/assetService'
import { deleteFile } from '../services/storageService'
import {
  deleteRepairTicket,
  transitionRepairTicketStatus,
  updateRepairTicket,
} from '../store/repairTicketsSlice'
import { useAppDispatch, useAppSelector } from '../store/hooks'
import { calcDaysFrom, formatDateTime, formatDays } from '../utils/formatters'
import { getRepairStatusMeta } from '../utils/statusMeta'
import { uploadAssetAttachments } from '../utils/fileUpload'

const RepairTicketDetailPage: React.FC = () => {
  const { tr, language } = useI18n()
  const toast = useToast()
  const dispatch = useAppDispatch()
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
  const [pendingRemoveAttachment, setPendingRemoveAttachment] = useState<AssetAttachment | null>(null)

  const [confirmDeleteTicketOpen, setConfirmDeleteTicketOpen] = useState(false)
  const [imagePreview, setImagePreview] = useState<LightboxImageState | null>(null)

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
          setError('Ticket not found')
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
        setError(e?.message || 'Failed to load ticket')
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [ticketId]
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
      const updated = await dispatch(
        updateRepairTicket({
          id: ticket.id,
          changes: {
            problemDesc: editProblemDesc.trim(),
            vendorName: editVendorName.trim() || undefined,
            quoteAmount: editQuoteAmount ? Number(editQuoteAmount) : undefined,
            expectedReturnAt: editExpectedReturnAt ? editExpectedReturnAt.toISOString() : undefined,
          },
        })
      ).unwrap()
      setTicket(updated)
      toast.success(tr('工单信息已保存', 'Ticket saved.'))
    } catch (e: any) {
      const msg = e?.message || tr('保存失败', 'Failed to save')
      setSaveError(msg)
      toast.error(msg)
    } finally {
      setSaving(false)
    }
  }, [canManage, dispatch, editExpectedReturnAt, editProblemDesc, editQuoteAmount, editVendorName, ticket, toast, tr])

  const handleMarkQuoted = useCallback(async () => {
    if (!ticket) return
    if (!canManage) return
    const vendor = editVendorName.trim()
    const quote = editQuoteAmount ? Number(editQuoteAmount) : NaN
    if (!vendor || Number.isNaN(quote)) return
    setSaving(true)
    setSaveError(null)
    try {
      const updated = await dispatch(
        transitionRepairTicketStatus({
          id: ticket.id,
          to: 'repair-pending',
          vendorName: vendor,
          quoteAmount: quote,
        })
      ).unwrap()
      setTicket(updated)
      toast.success(tr('已标记为待维修', 'Marked as quoted.'))
    } catch (e: any) {
      const msg = e?.message || tr('更新状态失败', 'Failed to update status')
      setSaveError(msg)
      toast.error(msg)
    } finally {
      setSaving(false)
    }
  }, [canManage, dispatch, editQuoteAmount, editVendorName, ticket, toast, tr])

  const handleMarkCompleted = useCallback(async () => {
    if (!ticket) return
    if (!canManage) return
    setSaving(true)
    setSaveError(null)
    try {
      const updated = await dispatch(transitionRepairTicketStatus({ id: ticket.id, to: 'completed' })).unwrap()
      setTicket(updated)
      toast.success(tr('工单已完成', 'Ticket marked completed.'))
    } catch (e: any) {
      const msg = e?.message || tr('更新状态失败', 'Failed to update status')
      setSaveError(msg)
      toast.error(msg)
    } finally {
      setSaving(false)
    }
  }, [canManage, dispatch, ticket, toast, tr])

  const handleDeleteTicket = useCallback(async () => {
    if (!ticket) return
    if (!canManage) return
    setSaving(true)
    setSaveError(null)
    try {
      await dispatch(deleteRepairTicket(ticket.id)).unwrap()
      toast.success(tr('维修工单已删除', 'Repair ticket deleted.'))
      navigate('/repairs', { replace: true })
    } catch (e: any) {
      const msg = e?.message || tr('删除失败', 'Delete failed')
      setSaveError(msg)
      toast.error(msg)
    } finally {
      setSaving(false)
    }
  }, [canManage, dispatch, navigate, ticket, toast, tr])

  const handleUploadAttachments = useCallback(
    async (files: File[]) => {
      if (!ticket || !canManage || files.length === 0) return
      setAttachmentsError(null)
      setAttachmentsUploading(true)
      try {
        const existing = ticket.attachments ?? []
        const newItems = await uploadAssetAttachments(ticket.assetId, `repairs/${ticket.id}/attachments`, files)
        const updated = await dispatch(
          updateRepairTicket({ id: ticket.id, changes: { attachments: existing.concat(newItems) } })
        ).unwrap()
        setTicket(updated)
        toast.success(tr('附件已上传', 'Attachment uploaded.'))
      } catch (e: any) {
        const msg = e?.message || tr('上传失败', 'Upload failed')
        setAttachmentsError(msg)
        toast.error(msg)
      } finally {
        setAttachmentsUploading(false)
      }
    },
    [canManage, dispatch, ticket, toast, tr]
  )

  const handleConfirmRemoveAttachment = useCallback(async () => {
    if (!ticket || !canManage || !pendingRemoveAttachment) return
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
      const updated = await dispatch(updateRepairTicket({ id: ticket.id, changes: { attachments: next } })).unwrap()
      setTicket(updated)
      setPendingRemoveAttachment(null)
      toast.success(tr('附件已删除', 'Attachment deleted.'))
    } catch (e: any) {
      const msg = e?.message || tr('删除失败', 'Delete failed')
      setAttachmentsError(msg)
      toast.error(msg)
    } finally {
      setAttachmentsUploading(false)
    }
  }, [canManage, dispatch, pendingRemoveAttachment, ticket, toast, tr])

  const downtimeLabel = ticket?.createdAt ? formatDays(calcDaysFrom(ticket.startedAt ?? ticket.createdAt), language) : '-'

  return (
    <PageShell
      title={<TitleWithIcon icon={<BuildCircleIcon />}>{tr('工单详情', 'Ticket details')}</TitleWithIcon>}
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
                <StatusChip kind="repair" status={ticket.status} />
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
                <Typography sx={{ fontWeight: 700 }}>
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
            <AttachmentManagerCard
              title={<TitleWithIcon icon={<AttachFileIcon />}>{tr('图片与附件', 'Evidence & attachments')}</TitleWithIcon>}
              attachments={ticket.attachments ?? []}
              canManage={canManage}
              uploading={attachmentsUploading}
              error={attachmentsError}
              maxItems={24}
              showImagePreview
              onUpload={handleUploadAttachments}
              onDelete={(a) => setPendingRemoveAttachment(a)}
              onPreviewImage={(a) =>
                setImagePreview({
                  title: a.name || tr('图片预览', 'Image preview'),
                  urls: [a.url],
                  index: 0,
                })
              }
            />
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
                      {formatDateTime(e.at)} · {e.from ? getRepairStatusMeta(e.from, tr).label : tr('创建', 'Created')} →{' '}
                      {getRepairStatusMeta(e.to, tr).label}
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
        description={tr(
          '确定要删除该维修工单吗？删除后将尝试把设备状态恢复为“可用”。',
          'Delete this repair ticket? After deletion, the asset status will be restored to “available” if possible.'
        )}
        confirmText={tr('删除', 'Delete')}
        confirmColor="error"
        onClose={() => setConfirmDeleteTicketOpen(false)}
        onConfirm={handleDeleteTicket}
      />

      <ImageLightboxDialog value={imagePreview} onChange={setImagePreview} />
    </PageShell>
  )
}

export default RepairTicketDetailPage
