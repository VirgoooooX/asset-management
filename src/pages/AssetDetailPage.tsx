import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  Alert,
  Box,
  Button,
  Chip,
  Grid,
  LinearProgress,
  Stack,
  Typography,
} from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
import PhotoIcon from '@mui/icons-material/Photo'
import QrCode2Icon from '@mui/icons-material/QrCode2'
import BadgeIcon from '@mui/icons-material/Badge'
import AttachFileIcon from '@mui/icons-material/AttachFile'
import BuildCircleIcon from '@mui/icons-material/BuildCircle'
import ListAltIcon from '@mui/icons-material/ListAlt'
import { alpha, useTheme } from '@mui/material/styles'
import PageShell from '../components/PageShell'
import TitleWithIcon from '../components/TitleWithIcon'
import AppCard from '../components/AppCard'
import ConfirmDialog from '../components/ConfirmDialog'
import ChamberForm from '../components/ChamberForm'
import UsageLogDetails from '../components/UsageLogDetails'
import { useAppDispatch, useAppSelector } from '../store/hooks'
import { fetchAssetsByType, deleteAsset, updateAsset } from '../store/assetsSlice'
import { fetchUsageLogs } from '../store/usageLogsSlice'
import { fetchRepairTickets } from '../store/repairTicketsSlice'
import { fetchProjects } from '../store/projectsSlice'
import { fetchTestProjects } from '../store/testProjectsSlice'
import { getEffectiveUsageLogStatus } from '../utils/statusHelpers'
import type { UsageLog } from '../types'
import { useI18n } from '../i18n'
import { deleteFile, uploadFile } from '../services/storageService'

type Props = {
  mode: 'create' | 'view'
}

const getStatusColor = (status: string): 'default' | 'success' | 'warning' | 'error' => {
  if (status === 'available') return 'success'
  if (status === 'in-use') return 'warning'
  if (status === 'maintenance') return 'error'
  return 'default'
}

const formatDateTime = (value?: string) => {
  if (!value) return '-'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleString()
}

const AssetDetailPage: React.FC<Props> = ({ mode }) => {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const theme = useTheme()
  const { assetId } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const { tr, language } = useI18n()

  const role = useAppSelector((s) => s.auth.user?.role)
  const isAdmin = role === 'admin'

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
  const [selectedLogId, setSelectedLogId] = useState<string | null>(null)
  const [photoUploading, setPhotoUploading] = useState(false)
  const [nameplateUploading, setNameplateUploading] = useState(false)
  const [attachmentsUploading, setAttachmentsUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)

  useEffect(() => {
    dispatch(fetchAssetsByType('chamber'))
    dispatch(fetchUsageLogs())
    dispatch(fetchRepairTickets(undefined))
    dispatch(fetchProjects())
    dispatch(fetchTestProjects())
  }, [dispatch])

  useEffect(() => {
    if (mode !== 'view') return
    if (!isAdmin) return
    const shouldOpen = searchParams.get('edit') === '1'
    setEditOpen(shouldOpen)
  }, [isAdmin, mode, searchParams])

  const asset = useMemo(() => {
    if (mode === 'create') return undefined
    if (!assetId) return undefined
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

  const handleUploadImages = async (kind: 'photo' | 'nameplate', files: FileList | null) => {
    if (!assetId) return
    if (!files || files.length === 0) return
    if (!isAdmin) return

    setUploadError(null)
    if (kind === 'photo') setPhotoUploading(true)
    if (kind === 'nameplate') setNameplateUploading(true)

    try {
      const list = Array.from(files)
      const urls = await Promise.all(
        list.map((file) => {
          const objectKey = createObjectKey(file.name)
          const folder = kind === 'photo' ? 'photos' : 'nameplates'
          const path = `assets/${assetId}/${folder}/${objectKey}`
          return uploadFile(file, path)
        })
      )

      const existing = kind === 'photo' ? asset?.photoUrls ?? [] : asset?.nameplateUrls ?? []
      const merged = existing.concat(urls)
      await dispatch(
        updateAsset({
          id: assetId,
          changes: kind === 'photo' ? { photoUrls: merged } : { nameplateUrls: merged },
        })
      ).unwrap()
    } catch (e: any) {
      setUploadError(e?.message || tr('上传失败', 'Upload failed'))
    } finally {
      if (kind === 'photo') setPhotoUploading(false)
      if (kind === 'nameplate') setNameplateUploading(false)
    }
  }

  const handleDeleteImage = async (kind: 'photo' | 'nameplate', url: string) => {
    if (!assetId) return
    if (!isAdmin) return

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
    } catch (e: any) {
      setUploadError(e?.message || tr('删除失败', 'Delete failed'))
    }
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

  const handleUploadAttachments = async (files: FileList | null) => {
    if (!assetId) return
    if (!files || files.length === 0) return
    if (!isAdmin) return

    setUploadError(null)
    setAttachmentsUploading(true)
    try {
      const list = Array.from(files)
      const newItems = await Promise.all(
        list.map(async (file) => {
          const objectKey = createObjectKey(file.name)
          const path = `assets/${assetId}/attachments/${objectKey}`
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

      const existing = asset?.attachments ?? []
      const merged = existing.concat(newItems)
      await dispatch(updateAsset({ id: assetId, changes: { attachments: merged } })).unwrap()
    } catch (e: any) {
      setUploadError(e?.message || tr('上传失败', 'Upload failed'))
    } finally {
      setAttachmentsUploading(false)
    }
  }

  const handleDeleteAttachment = async (attachmentId: string) => {
    if (!assetId) return
    if (!isAdmin) return
    const existing = asset?.attachments ?? []
    const target = existing.find((a) => a.id === attachmentId)
    if (!target) return

    setUploadError(null)
    try {
      await deleteFile(target.path || target.url)
      const next = existing.filter((a) => a.id !== attachmentId)
      await dispatch(updateAsset({ id: assetId, changes: { attachments: next } })).unwrap()
    } catch (e: any) {
      setUploadError(e?.message || tr('删除失败', 'Delete failed'))
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
      navigate(`/assets/${savedId}`, { replace: true })
      setEditOpen(false)
      return
    }
    handleCloseEdit()
  }

  const handleDelete = async () => {
    if (!assetId) return
    await dispatch(deleteAsset(assetId))
    navigate('/chambers')
  }

  const titleText =
    mode === 'create'
      ? tr('新增设备', 'New asset')
      : asset?.name ?? (assetId ? tr(`设备 ${assetId.slice(0, 8)}`, `Asset ${assetId.slice(0, 8)}`) : tr('设备详情', 'Asset details'))

  return (
    <PageShell
      title={<TitleWithIcon icon={<BadgeIcon />}>{titleText}</TitleWithIcon>}
      maxWidth="xl"
      actions={
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
          <Button size="small" variant="outlined" startIcon={<ArrowBackIcon />} onClick={() => navigate(-1)}>
            {tr('返回', 'Back')}
          </Button>
          {mode === 'view' ? (
            <>
              <Chip
                size="small"
                label={
                  asset
                    ? asset.status === 'available'
                      ? tr('可用', 'Available')
                      : asset.status === 'in-use'
                        ? tr('使用中', 'In use')
                        : asset.status === 'maintenance'
                          ? tr('维护中', 'Maintenance')
                          : asset.status
                    : tr('加载中', 'Loading')
                }
                color={asset ? getStatusColor(asset.status) : 'default'}
                variant={asset ? 'filled' : 'outlined'}
                sx={{ fontWeight: 800 }}
              />
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

      <Grid container spacing={2}>
        <Grid item xs={12} lg={7}>
          <AppCard title={tr('基础信息', 'Basic info')}>
            {!asset && mode === 'view' ? (
              <Typography color="text.secondary">{tr('暂无数据', 'No data')}</Typography>
            ) : (
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <Typography variant="body2" color="text.secondary">
                    {tr('设备种类', 'Category')}
                  </Typography>
                  <Typography sx={{ fontWeight: 850 }}>{asset?.category || tr('环境箱', 'Chamber')}</Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="body2" color="text.secondary">
                    {tr('资产号', 'Asset code')}
                  </Typography>
                  <Typography sx={{ fontWeight: 850 }}>{asset?.assetCode || '-'}</Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="body2" color="text.secondary">
                    SN
                  </Typography>
                  <Typography sx={{ fontWeight: 850 }}>{asset?.serialNumber || '-'}</Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="body2" color="text.secondary">
                    {tr('位置', 'Location')}
                  </Typography>
                  <Typography>{asset?.location || '-'}</Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="body2" color="text.secondary">
                    {tr('厂商 / 型号', 'Manufacturer / Model')}
                  </Typography>
                  <Typography>{`${asset?.manufacturer || '-'} / ${asset?.model || '-'}`}</Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="body2" color="text.secondary">
                    {tr('负责人', 'Owner')}
                  </Typography>
                  <Typography>{asset?.owner || '-'}</Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="body2" color="text.secondary">
                    {tr('标签', 'Tags')}
                  </Typography>
                  <Typography>{asset?.tags?.length ? asset.tags.join(language === 'en' ? ', ' : '，') : '-'}</Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="body2" color="text.secondary">
                    {tr('校验日期', 'Calibration date')}
                  </Typography>
                  <Typography>{formatDateTime(asset?.calibrationDate)}</Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="body2" color="text.secondary">
                    {tr('更新时间', 'Updated')}
                  </Typography>
                  <Typography>{formatDateTime(asset?.updatedAt)}</Typography>
                </Grid>
                <Grid item xs={12}>
                  <Typography variant="body2" color="text.secondary">
                    {tr('描述', 'Description')}
                  </Typography>
                  <Typography>{asset?.description || '-'}</Typography>
                </Grid>
              </Grid>
            )}
          </AppCard>
        </Grid>

        <Grid item xs={12} lg={5}>
          <Stack spacing={2}>
            <AppCard
              title={<TitleWithIcon icon={<PhotoIcon />}>{tr('设备照片', 'Photos')}</TitleWithIcon>}
              actions={
                isAdmin && mode === 'view' && assetId ? (
                  <Button component="label" size="small" variant="outlined" disabled={photoUploading}>
                    {photoUploading ? tr('上传中…', 'Uploading…') : tr('上传', 'Upload')}
                    <input
                      hidden
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={(e) => {
                        const files = e.target.files
                        e.target.value = ''
                        handleUploadImages('photo', files)
                      }}
                    />
                  </Button>
                ) : null
              }
            >
              {asset?.photoUrls?.length ? (
                <Grid container spacing={1}>
                  {asset.photoUrls.slice(0, 6).map((url) => (
                    <Grid item xs={6} key={url}>
                      <Box
                        sx={{
                          position: 'relative',
                          width: '100%',
                          aspectRatio: '4 / 3',
                          borderRadius: 2,
                          border: '1px solid',
                          borderColor: 'divider',
                          backgroundColor: alpha(theme.palette.background.paper, theme.palette.mode === 'dark' ? 0.35 : 0.8),
                        }}
                      >
                        <Box
                          component="img"
                          src={url}
                          alt={tr('设备照片', 'Asset photo')}
                          sx={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                            borderRadius: 2,
                            display: 'block',
                          }}
                        />
                        {isAdmin ? (
                          <Button
                            size="small"
                            color="error"
                            variant="contained"
                            onClick={() => handleDeleteImage('photo', url)}
                            sx={{
                              position: 'absolute',
                              top: 8,
                              right: 8,
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
                    </Grid>
                  ))}
                </Grid>
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
                  <Typography sx={{ fontWeight: 850 }}>{tr('暂无照片', 'No photos')}</Typography>
                </Box>
              )}
            </AppCard>

            <AppCard
              title={<TitleWithIcon icon={<QrCode2Icon />}>{tr('铭牌', 'Nameplate')}</TitleWithIcon>}
              actions={
                isAdmin && mode === 'view' && assetId ? (
                  <Button component="label" size="small" variant="outlined" disabled={nameplateUploading}>
                    {nameplateUploading ? tr('上传中…', 'Uploading…') : tr('上传', 'Upload')}
                    <input
                      hidden
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={(e) => {
                        const files = e.target.files
                        e.target.value = ''
                        handleUploadImages('nameplate', files)
                      }}
                    />
                  </Button>
                ) : null
              }
            >
              {asset?.nameplateUrls?.length ? (
                <Grid container spacing={1}>
                  {asset.nameplateUrls.slice(0, 6).map((url) => (
                    <Grid item xs={6} key={url}>
                      <Box
                        sx={{
                          position: 'relative',
                          width: '100%',
                          aspectRatio: '4 / 3',
                          borderRadius: 2,
                          border: '1px solid',
                          borderColor: 'divider',
                          backgroundColor: alpha(theme.palette.background.paper, theme.palette.mode === 'dark' ? 0.35 : 0.8),
                        }}
                      >
                        <Box
                          component="img"
                          src={url}
                          alt={tr('铭牌', 'Nameplate')}
                          sx={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                            borderRadius: 2,
                            display: 'block',
                          }}
                        />
                        {isAdmin ? (
                          <Button
                            size="small"
                            color="error"
                            variant="contained"
                            onClick={() => handleDeleteImage('nameplate', url)}
                            sx={{
                              position: 'absolute',
                              top: 8,
                              right: 8,
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
                    </Grid>
                  ))}
                </Grid>
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
                  <Typography sx={{ fontWeight: 850 }}>{tr('暂无铭牌信息', 'No nameplate')}</Typography>
                </Box>
              )}
            </AppCard>

            <AppCard
              title={<TitleWithIcon icon={<AttachFileIcon />}>{tr('技术档案', 'Attachments')}</TitleWithIcon>}
              actions={
                isAdmin && mode === 'view' && assetId ? (
                  <Button component="label" size="small" variant="outlined" disabled={attachmentsUploading}>
                    {attachmentsUploading ? tr('上传中…', 'Uploading…') : tr('上传', 'Upload')}
                    <input
                      hidden
                      type="file"
                      multiple
                      onChange={(e) => {
                        const files = e.target.files
                        e.target.value = ''
                        handleUploadAttachments(files)
                      }}
                    />
                  </Button>
                ) : null
              }
            >
              {asset?.attachments?.length ? (
                <Stack spacing={1}>
                  {asset.attachments.slice(0, 8).map((a) => (
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
                        backgroundColor: (theme) => alpha(theme.palette.background.paper, theme.palette.mode === 'dark' ? 0.35 : 0.6),
                      }}
                    >
                      <Box sx={{ minWidth: 0 }}>
                        <Typography sx={{ fontWeight: 850 }} noWrap>
                          {a.name || tr('未命名文件', 'Untitled')}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" noWrap>
                          {formatBytes(a.size)} · {formatDateTime(a.uploadedAt)}
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', gap: 1, flexShrink: 0 }}>
                        <Button size="small" variant="outlined" component="a" href={a.url} target="_blank" rel="noreferrer">
                          {tr('下载', 'Download')}
                        </Button>
                        {isAdmin ? (
                          <Button size="small" variant="outlined" color="error" onClick={() => handleDeleteAttachment(a.id)}>
                            {tr('删除', 'Delete')}
                          </Button>
                        ) : null}
                      </Box>
                    </Box>
                  ))}
                </Stack>
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
                  <Typography sx={{ fontWeight: 850 }}>{tr('暂无附件', 'No attachments')}</Typography>
                </Box>
              )}
            </AppCard>
          </Stack>
        </Grid>

        <Grid item xs={12} lg={6}>
          <AppCard
            title={<TitleWithIcon icon={<BuildCircleIcon />}>{tr('维修记录', 'Repairs')}</TitleWithIcon>}
            actions={
              <Button size="small" variant="outlined" onClick={() => navigate('/repairs')} sx={{ whiteSpace: 'nowrap' }}>
                {tr('打开维修管理', 'Open repairs')}
              </Button>
            }
          >
            {repairLoading ? (
              <LinearProgress />
            ) : relatedRepairTickets.length === 0 ? (
              <Typography color="text.secondary">{tr('暂无维修记录', 'No repair tickets')}</Typography>
            ) : (
              <Stack spacing={1.25}>
                {relatedRepairTickets.slice(0, 8).map((t) => (
                  <Box
                    key={t.id}
                    sx={{
                      border: '1px solid',
                      borderColor: 'divider',
                      borderRadius: 2,
                      p: 1.25,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 1.5,
                      backgroundColor: (theme) => alpha(theme.palette.background.paper, theme.palette.mode === 'dark' ? 0.35 : 0.6),
                    }}
                  >
                    <Box sx={{ minWidth: 0 }}>
                      <Typography sx={{ fontWeight: 850 }} noWrap>
                        {t.problemDesc || tr('维修工单', 'Repair ticket')}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" noWrap>
                        {tr('更新时间：', 'Updated: ')}{formatDateTime(t.updatedAt ?? t.createdAt)}
                      </Typography>
                    </Box>
                    <Chip
                      size="small"
                      label={
                        t.status === 'quote-pending'
                          ? tr('未询价', 'Quote pending')
                          : t.status === 'repair-pending'
                            ? tr('待维修', 'Repair pending')
                            : tr('已完成', 'Completed')
                      }
                      color={t.status === 'completed' ? 'success' : t.status === 'quote-pending' ? 'warning' : 'info'}
                    />
                  </Box>
                ))}
              </Stack>
            )}
          </AppCard>
        </Grid>

        <Grid item xs={12} lg={6}>
          <AppCard title={<TitleWithIcon icon={<ListAltIcon />}>{tr('使用记录', 'Usage logs')}</TitleWithIcon>}>
            {usageLogsLoading ? (
              <LinearProgress />
            ) : relatedUsageLogs.length === 0 ? (
              <Typography color="text.secondary">{tr('暂无使用记录', 'No usage logs')}</Typography>
            ) : (
              <Stack spacing={1.25}>
                {relatedUsageLogs.slice(0, 8).map((log) => {
                  const effectiveStatus = getEffectiveUsageLogStatus(log)
                  const projectName = log.projectId ? projectNameById.get(log.projectId) : undefined
                  const testProjectName = log.testProjectId ? testProjectNameById.get(log.testProjectId) : undefined
                  const label =
                    effectiveStatus === 'completed'
                      ? tr('已完成', 'Completed')
                      : effectiveStatus === 'in-progress'
                        ? tr('使用中', 'In use')
                        : effectiveStatus === 'overdue'
                          ? tr('逾期', 'Overdue')
                          : tr('未开始', 'Not started')

                  const color =
                    effectiveStatus === 'completed'
                      ? 'success'
                      : effectiveStatus === 'in-progress'
                        ? 'warning'
                        : effectiveStatus === 'overdue'
                          ? 'error'
                          : 'info'

                  return (
                    <Box
                      key={log.id}
                      onClick={() => setSelectedLogId(log.id)}
                      sx={{
                        border: '1px solid',
                        borderColor: 'divider',
                        borderRadius: 2,
                        p: 1.25,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 1.5,
                        '&:hover': {
                          backgroundColor: alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.10 : 0.06),
                          borderColor: alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.32 : 0.22),
                        },
                      }}
                    >
                      <Box sx={{ minWidth: 0 }}>
                        <Typography sx={{ fontWeight: 850 }} noWrap>
                          {projectName ?? testProjectName ?? tr('未关联项目', 'Unlinked')}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" noWrap>
                          {formatDateTime(log.startTime)} → {formatDateTime(log.endTime)}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" noWrap>
                          {tr('使用人：', 'User: ')}{log.user || '-'}
                        </Typography>
                      </Box>
                      <Chip size="small" label={label} color={color as any} />
                    </Box>
                  )
                })}
              </Stack>
            )}
          </AppCard>
        </Grid>
      </Grid>

      <ChamberForm
        open={editOpen}
        onClose={handleCloseEdit}
        chamber={asset}
        onSaved={(saved) => handleSaved(saved.id)}
      />

      <UsageLogDetails open={Boolean(selectedLogId)} onClose={() => setSelectedLogId(null)} logId={selectedLogId} />

      <ConfirmDialog
        open={pendingDelete}
        title={tr('确认删除', 'Confirm deletion')}
        description={tr('您确定要删除这个设备吗？此操作无法撤销。', 'Delete this asset? This action cannot be undone.')}
        onClose={() => setPendingDelete(false)}
        onConfirm={handleDelete}
      />
    </PageShell>
  )
}

export default AssetDetailPage
