import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Alert, Button, Chip, LinearProgress, Stack, Tab, Tabs } from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
import BadgeIcon from '@mui/icons-material/Badge'
import PageShell from '../components/PageShell'
import TitleWithIcon from '../components/TitleWithIcon'
import AppCard from '../components/AppCard'
import ConfirmDialog from '../components/ConfirmDialog'
import ChamberForm from '../components/ChamberForm'
import UsageLogDetails from '../components/UsageLogDetails'
import StatusChip from '../components/StatusChip'
import { useToast } from '../components/ToastProvider'
import ImageLightboxDialog, { type LightboxImageState } from '../components/ImageLightboxDialog'
import AssetInfoTab from './assetDetail/AssetInfoTab'
import AssetPerformanceTab from './assetDetail/AssetPerformanceTab'
import AssetRepairsTab from './assetDetail/AssetRepairsTab'
import AssetUsageTab from './assetDetail/AssetUsageTab'
import { useAppDispatch, useAppSelector } from '../store/hooks'
import { fetchAssetsByType, deleteAsset, updateAsset } from '../store/assetsSlice'
import { fetchUsageLogs } from '../store/usageLogsSlice'
import { fetchRepairTickets } from '../store/repairTicketsSlice'
import { fetchProjects } from '../store/projectsSlice'
import { fetchTestProjects } from '../store/testProjectsSlice'
import type { AssetAttachment } from '../types'
import { useI18n } from '../i18n'
import { deleteFile } from '../services/storageService'
import { uploadAssetAttachments, uploadAssetFiles } from '../utils/fileUpload'

type Props = {
  mode: 'create' | 'view'
}

type PendingRemoveState =
  | { kind: 'photo' | 'nameplate'; url: string }
  | { kind: 'attachment'; attachmentId: string; attachmentName?: string }

const AssetDetailPage: React.FC<Props> = ({ mode }) => {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const { assetId } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const { tr } = useI18n()
  const toast = useToast()

  const role = useAppSelector((s) => s.auth.user?.role)
  const isAdmin = role === 'admin'
  const canManage = role === 'admin' || role === 'manager'

  const assetsLoading = useAppSelector((s) => s.assets.loading)
  const assetsError = useAppSelector((s) => s.assets.error)
  const assets = useAppSelector((s) => s.assets.assets)

  const usageLogs = useAppSelector((s) => s.usageLogs.usageLogs)
  const usageLogsLoading = useAppSelector((s) => s.usageLogs.loading)
  const repairTickets = useAppSelector((s) => s.repairTickets.tickets)
  const repairLoading = useAppSelector((s) => s.repairTickets.loading)

  const projects = useAppSelector((s) => s.projects.projects)
  const testProjects = useAppSelector((s) => s.testProjects.testProjects)

  const [editOpen, setEditOpen] = useState(mode === 'create')
  const [pendingDelete, setPendingDelete] = useState(false)
  const [pendingRemove, setPendingRemove] = useState<PendingRemoveState | null>(null)
  const [selectedLogId, setSelectedLogId] = useState<string | null>(null)
  const [mainTab, setMainTab] = useState<'info' | 'performance' | 'repairs' | 'usage'>('info')
  const [imagePreview, setImagePreview] = useState<LightboxImageState | null>(null)
  const [photoUploading, setPhotoUploading] = useState(false)
  const [nameplateUploading, setNameplateUploading] = useState(false)
  const [attachmentsUploading, setAttachmentsUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)

  useEffect(() => {
    dispatch(fetchAssetsByType({ type: 'chamber' }))
    if (mode === 'create') return
    dispatch(fetchUsageLogs())
    dispatch(fetchRepairTickets(undefined))
    dispatch(fetchProjects())
    dispatch(fetchTestProjects())
  }, [dispatch, mode])

  useEffect(() => {
    if (mode !== 'view' || !isAdmin) return
    setEditOpen(searchParams.get('edit') === '1')
  }, [isAdmin, mode, searchParams])

  const asset = useMemo(() => {
    if (mode === 'create' || !assetId) return undefined
    return assets.find((a) => a.id === assetId)
  }, [assetId, assets, mode])

  const projectNameById = useMemo(() => {
    const map = new Map<string, string>()
    projects.forEach((p) => map.set(p.id, p.name))
    return map
  }, [projects])

  const testProjectNameById = useMemo(() => {
    const map = new Map<string, string>()
    testProjects.forEach((p) => map.set(p.id, p.name))
    return map
  }, [testProjects])

  const relatedUsageLogs = useMemo(() => {
    if (!assetId || mode === 'create') return []
    return usageLogs
      .filter((l) => l.chamberId === assetId)
      .slice()
      .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())
  }, [assetId, mode, usageLogs])

  const relatedRepairTickets = useMemo(() => {
    if (!assetId || mode === 'create') return []
    return repairTickets
      .filter((t) => t.assetId === assetId)
      .slice()
      .sort((a, b) => {
        const aTime = new Date(a.updatedAt ?? a.createdAt).getTime()
        const bTime = new Date(b.updatedAt ?? b.createdAt).getTime()
        return bTime - aTime
      })
  }, [assetId, mode, repairTickets])

  const handleUploadImages = async (kind: 'photo' | 'nameplate', files: File[]) => {
    if (!assetId || files.length === 0 || !isAdmin) return
    setUploadError(null)
    if (kind === 'photo') setPhotoUploading(true)
    if (kind === 'nameplate') setNameplateUploading(true)
    try {
      const folder = kind === 'photo' ? 'photos' : 'nameplates'
      const urls = await uploadAssetFiles(assetId, folder, files)
      const existing = kind === 'photo' ? asset?.photoUrls ?? [] : asset?.nameplateUrls ?? []
      const merged = existing.concat(urls)
      await dispatch(
        updateAsset({
          id: assetId,
          changes: kind === 'photo' ? { photoUrls: merged } : { nameplateUrls: merged },
        })
      ).unwrap()
      toast.success(tr('图片已上传', 'Image uploaded.'))
    } catch (e: any) {
      const msg = e?.message || tr('上传失败', 'Upload failed')
      setUploadError(msg)
      toast.error(msg)
    } finally {
      if (kind === 'photo') setPhotoUploading(false)
      if (kind === 'nameplate') setNameplateUploading(false)
    }
  }

  const handleDeleteImage = async (kind: 'photo' | 'nameplate', url: string) => {
    if (!assetId || !isAdmin) return
    setUploadError(null)
    try {
      await deleteFile(url)
      const existing = kind === 'photo' ? asset?.photoUrls ?? [] : asset?.nameplateUrls ?? []
      const next = existing.filter((u) => u !== url)
      await dispatch(
        updateAsset({
          id: assetId,
          changes: kind === 'photo' ? { photoUrls: next } : { nameplateUrls: next },
        })
      ).unwrap()
      toast.success(tr('图片已删除', 'Image deleted.'))
    } catch (e: any) {
      const msg = e?.message || tr('删除失败', 'Delete failed')
      setUploadError(msg)
      toast.error(msg)
    }
  }

  const handleUploadAttachments = async (files: File[]) => {
    if (!assetId || files.length === 0 || !isAdmin) return
    setUploadError(null)
    setAttachmentsUploading(true)
    try {
      const newItems = await uploadAssetAttachments(assetId, 'attachments', files)
      const existing = asset?.attachments ?? []
      const merged = existing.concat(newItems)
      await dispatch(updateAsset({ id: assetId, changes: { attachments: merged } })).unwrap()
      toast.success(tr('附件已上传', 'Attachment uploaded.'))
    } catch (e: any) {
      const msg = e?.message || tr('上传失败', 'Upload failed')
      setUploadError(msg)
      toast.error(msg)
    } finally {
      setAttachmentsUploading(false)
    }
  }

  const handleDeleteAttachment = async (attachmentId: string) => {
    if (!assetId || !isAdmin) return
    const existing = asset?.attachments ?? []
    const target = existing.find((a) => a.id === attachmentId)
    if (!target) return
    setUploadError(null)
    try {
      await deleteFile(target.path || target.url)
      const next = existing.filter((a) => a.id !== attachmentId)
      await dispatch(updateAsset({ id: assetId, changes: { attachments: next } })).unwrap()
      toast.success(tr('附件已删除', 'Attachment deleted.'))
    } catch (e: any) {
      const msg = e?.message || tr('删除失败', 'Delete failed')
      setUploadError(msg)
      toast.error(msg)
    }
  }

  const handleCloseEdit = () => {
    setEditOpen(false)
    if (mode === 'view') {
      const next = new URLSearchParams(searchParams)
      next.delete('edit')
      setSearchParams(next, { replace: true })
    }
  }

  const handleSaved = (savedId: string) => {
    if (mode === 'create') {
      toast.success(tr('设备已创建', 'Asset created.'))
      navigate(`/assets/${savedId}`, { replace: true })
      setEditOpen(false)
      return
    }
    toast.success(tr('设备信息已更新', 'Asset updated.'))
    handleCloseEdit()
  }

  const handleDelete = async () => {
    if (!assetId) return
    try {
      await dispatch(deleteAsset(assetId)).unwrap()
      toast.success(tr('设备已删除', 'Asset deleted.'))
      navigate('/chambers')
    } catch (e: any) {
      toast.error(e?.message || tr('删除失败', 'Delete failed'))
    }
  }

  const titleText =
    mode === 'create'
      ? tr('新增设备', 'New asset')
      : asset?.name ?? (assetId ? tr(`设备 ${assetId.slice(0, 8)}`, `Asset ${assetId.slice(0, 8)}`) : tr('设备详情', 'Asset details'))

  return (
    <PageShell
      title={<TitleWithIcon icon={<BadgeIcon />}>{titleText}</TitleWithIcon>}
      actions={
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
          <Button size="small" variant="outlined" startIcon={<ArrowBackIcon />} onClick={() => navigate(-1)}>
            {tr('返回', 'Back')}
          </Button>
          {mode === 'view' ? (
            <>
              {asset ? (
                <StatusChip kind="asset" status={asset.status} sx={{ fontWeight: 800 }} />
              ) : (
                <Chip size="small" label={tr('加载中', 'Loading')} variant="outlined" sx={{ fontWeight: 800 }} />
              )}
              {isAdmin ? (
                <>
                  <Button
                    size="small"
                    variant="contained"
                    startIcon={<EditIcon />}
                    onClick={() => {
                      const next = new URLSearchParams(searchParams)
                      next.set('edit', '1')
                      setSearchParams(next, { replace: true })
                      setEditOpen(true)
                    }}
                    disabled={!asset}
                  >
                    {tr('编辑', 'Edit')}
                  </Button>
                  <Button
                    size="small"
                    variant="outlined"
                    color="error"
                    startIcon={<DeleteIcon />}
                    onClick={() => setPendingDelete(true)}
                    disabled={!asset}
                  >
                    {tr('删除', 'Delete')}
                  </Button>
                </>
              ) : null}
            </>
          ) : null}
        </Stack>
      }
    >
      {assetsLoading ? <LinearProgress sx={{ mb: 2 }} /> : null}
      {assetsError ? (
        <Alert severity="error" sx={{ mb: 2 }}>
          {tr(`加载设备失败：${assetsError}`, `Failed to load asset: ${assetsError}`)}
        </Alert>
      ) : null}

      {mode === 'view' && !asset && !assetsLoading ? (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {tr('未找到该设备，可能已被删除或无权限访问。', 'Asset not found. It may be deleted or you may not have access.')}
        </Alert>
      ) : null}

      {uploadError ? (
        <Alert severity="error" sx={{ mb: 2 }}>
          {uploadError}
        </Alert>
      ) : null}

      <AppCard sx={{ p: 0, overflow: 'hidden', mb: 2 }}>
        <Tabs value={mainTab} onChange={(_e, v) => setMainTab(v)} variant="scrollable" allowScrollButtonsMobile sx={{ px: 1, py: 0.25 }}>
          <Tab value="info" label={tr('设备信息', 'Info')} />
          <Tab value="performance" label={tr('参数性能', 'Performance')} />
          <Tab
            value="repairs"
            label={
              <Stack direction="row" spacing={1} alignItems="center">
                <span>{tr('维修记录', 'Repairs')}</span>
                <Chip size="small" label={relatedRepairTickets.length} />
              </Stack>
            }
          />
          <Tab
            value="usage"
            label={
              <Stack direction="row" spacing={1} alignItems="center">
                <span>{tr('使用记录', 'Usage')}</span>
                <Chip size="small" label={relatedUsageLogs.length} />
              </Stack>
            }
          />
        </Tabs>
      </AppCard>

      {mainTab === 'info' ? (
        <AssetInfoTab
          mode={mode}
          asset={asset}
          assetId={assetId}
          isAdmin={isAdmin}
          latestUsageLog={relatedUsageLogs[0]}
          latestRepairTicket={relatedRepairTickets[0]}
          projectNameById={projectNameById}
          testProjectNameById={testProjectNameById}
          photoUploading={photoUploading}
          nameplateUploading={nameplateUploading}
          attachmentsUploading={attachmentsUploading}
          onUploadImages={handleUploadImages}
          onRequestDeleteImage={(kind, url) => setPendingRemove({ kind, url })}
          onPreviewImage={setImagePreview}
          onUploadAttachments={handleUploadAttachments}
          onRequestDeleteAttachment={(a: AssetAttachment) =>
            setPendingRemove({ kind: 'attachment', attachmentId: a.id, attachmentName: a.name })
          }
        />
      ) : mainTab === 'performance' ? (
        <AssetPerformanceTab asset={asset} assetId={assetId} isAdmin={isAdmin} />
      ) : mainTab === 'repairs' ? (
        <AssetRepairsTab loading={repairLoading} canManage={canManage} tickets={relatedRepairTickets} />
      ) : (
        <AssetUsageTab
          loading={usageLogsLoading}
          usageLogs={relatedUsageLogs}
          projectNameById={projectNameById}
          testProjectNameById={testProjectNameById}
          onSelectLog={setSelectedLogId}
        />
      )}

      <ChamberForm
        open={editOpen}
        onClose={handleCloseEdit}
        chamber={asset}
        onSaved={(saved) => handleSaved(saved.id)}
      />

      <UsageLogDetails open={Boolean(selectedLogId)} onClose={() => setSelectedLogId(null)} logId={selectedLogId} />

      <ImageLightboxDialog value={imagePreview} onChange={setImagePreview} />

      <ConfirmDialog
        open={pendingDelete}
        title={tr('确认删除', 'Confirm deletion')}
        description={tr('您确定要删除这个设备吗？此操作无法撤销。', 'Delete this asset? This action cannot be undone.')}
        onClose={() => setPendingDelete(false)}
        onConfirm={handleDelete}
      />

      <ConfirmDialog
        open={Boolean(pendingRemove)}
        title={tr('确认删除', 'Confirm deletion')}
        description={
          pendingRemove?.kind === 'attachment'
            ? tr(
                `确认删除附件「${pendingRemove.attachmentName || tr('未命名文件', 'Untitled')}」？此操作无法撤销。`,
                `Delete attachment "${pendingRemove.attachmentName || tr('Untitled', 'Untitled')}"? This action cannot be undone.`
              )
            : tr('确认删除这张图片？此操作无法撤销。', 'Delete this image? This action cannot be undone.')
        }
        onClose={() => setPendingRemove(null)}
        onConfirm={async () => {
          const cur = pendingRemove
          setPendingRemove(null)
          if (!cur) return
          if (cur.kind === 'attachment') {
            await handleDeleteAttachment(cur.attachmentId)
            return
          }
          await handleDeleteImage(cur.kind, cur.url)
        }}
      />
    </PageShell>
  )
}

export default AssetDetailPage
