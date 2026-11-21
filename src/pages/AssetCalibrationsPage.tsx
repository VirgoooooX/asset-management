import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from '@mui/material'
import FactCheckIcon from '@mui/icons-material/FactCheck'
import EditIcon from '@mui/icons-material/Edit'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import RefreshIcon from '@mui/icons-material/Refresh'
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker'
import PageShell from '../components/PageShell'
import AppCard from '../components/AppCard'
import EmptyState from '../components/EmptyState'
import TableSkeleton from '../components/TableSkeleton'
import TitleWithIcon from '../components/TitleWithIcon'
import StatusChip from '../components/StatusChip'
import { useToast } from '../components/ToastProvider'
import type { Asset } from '../types'
import * as assetService from '../services/assetService'
import { updateAsset } from '../store/assetsSlice'
import { useAppDispatch, useAppSelector } from '../store/hooks'
import { useI18n } from '../i18n'
import { useNavigate } from 'react-router-dom'

type CalibrationFilter = 'attention' | 'all' | 'due' | 'overdue' | 'missing'

type CalibrationState = 'ok' | 'due' | 'overdue' | 'missing'

const DAY_MS = 24 * 60 * 60 * 1000

const getCalibrationState = (calibrationDate: string | undefined, daysThreshold: number): { state: CalibrationState; days: number | null } => {
  if (!calibrationDate) return { state: 'missing', days: null }
  const t = new Date(calibrationDate).getTime()
  if (Number.isNaN(t)) return { state: 'missing', days: null }
  const days = (t - Date.now()) / DAY_MS
  if (days < 0) return { state: 'overdue', days }
  if (days <= daysThreshold) return { state: 'due', days }
  return { state: 'ok', days }
}

const AssetCalibrationsPage: React.FC = () => {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const { tr, language } = useI18n()
  const toast = useToast()
  const role = useAppSelector((s) => s.auth.user?.role)
  const canManage = role === 'admin' || role === 'manager'
  const daysThreshold = useAppSelector((s) => s.settings.alerts.calibrationDaysThreshold) ?? 30

  const [assets, setAssets] = useState<Asset[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<CalibrationFilter>('attention')
  const [query, setQuery] = useState('')

  const [editOpen, setEditOpen] = useState(false)
  const [editing, setEditing] = useState<Asset | null>(null)
  const [editValue, setEditValue] = useState<Date | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const fetchAll = useCallback(
    async (mode: 'initial' | 'refresh') => {
      try {
        setError(null)
        if (mode === 'initial') setLoading(true)
        else setRefreshing(true)
        const items = await assetService.getAssets()
        setAssets(items)
      } catch (e: any) {
        setError(e?.message || 'Failed to load assets')
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    []
  )

  useEffect(() => {
    fetchAll('initial')
  }, [fetchAll])

  const sorted = useMemo(() => {
    return assets
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name, language === 'en' ? 'en' : 'zh-Hans-CN', { sensitivity: 'base' }))
  }, [assets, language])

  const normalizedQuery = query.trim().toLowerCase()

  const derived = useMemo(() => {
    const matchesQuery = (a: Asset) => {
      if (!normalizedQuery) return true
      const fields = [a.name, a.assetCode ?? ''].join(' ').toLowerCase()
      return fields.includes(normalizedQuery)
    }

    const list = sorted.filter(matchesQuery).map((a) => {
      const info = getCalibrationState(a.calibrationDate, daysThreshold)
      return { asset: a, ...info }
    })

    const filtered = list.filter((item) => {
      if (filter === 'all') return true
      if (filter === 'attention') return item.state === 'due' || item.state === 'overdue'
      if (filter === 'missing') return item.state === 'missing'
      if (filter === 'overdue') return item.state === 'overdue'
      if (filter === 'due') return item.state === 'due'
      return true
    })

    const counts = list.reduce(
      (acc, item) => {
        acc.all += 1
        if (item.state === 'missing') acc.missing += 1
        if (item.state === 'overdue') acc.overdue += 1
        if (item.state === 'due') acc.due += 1
        return acc
      },
      { all: 0, due: 0, overdue: 0, missing: 0 }
    )

    return { list: filtered, counts: { ...counts, attention: counts.due + counts.overdue } }
  }, [daysThreshold, filter, normalizedQuery, sorted])

  const openEdit = useCallback(
    (asset: Asset) => {
      setEditing(asset)
      setSaveError(null)
      if (asset.calibrationDate) {
        const d = new Date(asset.calibrationDate)
        setEditValue(Number.isNaN(d.getTime()) ? null : d)
      } else {
        setEditValue(null)
      }
      setEditOpen(true)
    },
    []
  )

  const closeEdit = useCallback(() => {
    if (saving) return
    setEditOpen(false)
    setEditing(null)
    setEditValue(null)
    setSaveError(null)
  }, [saving])

  const save = useCallback(async () => {
    if (!editing) return
    setSaving(true)
    setSaveError(null)
    try {
      const next = await dispatch(
        updateAsset({ id: editing.id, changes: { calibrationDate: editValue ? editValue.toISOString() : null } })
      ).unwrap()
      setAssets((prev) => prev.map((a) => (a.id === next.id ? next : a)))
      setEditOpen(false)
      setEditing(null)
      setEditValue(null)
      toast.success(tr('校验日期已更新', 'Calibration date updated.'))
    } catch (e: any) {
      const msg = e?.message || tr('保存失败', 'Failed to save')
      setSaveError(msg)
      toast.error(msg)
    } finally {
      setSaving(false)
    }
  }, [dispatch, editValue, editing, toast, tr])

  if (!canManage) {
    return (
      <PageShell title={<TitleWithIcon icon={<FactCheckIcon />}>{tr('校验管理', 'Calibration')}</TitleWithIcon>}>
        <Alert severity="error">{tr('没有权限访问该页面', 'You are not allowed to access this page')}</Alert>
      </PageShell>
    )
  }

  return (
      <PageShell
        title={<TitleWithIcon icon={<FactCheckIcon />}>{tr('校验管理', 'Calibration')}</TitleWithIcon>}
        actions={
          <Stack direction="row" spacing={1} alignItems="center">
            <Tooltip title={tr('刷新', 'Refresh')}>
              <span>
                <IconButton onClick={() => fetchAll('refresh')} disabled={loading || refreshing}>
                  <RefreshIcon />
                </IconButton>
              </span>
            </Tooltip>
          </Stack>
        }
      >
        <Stack spacing={2.5}>
          {error ? <Alert severity="error">{error}</Alert> : null}

          <AppCard
            title={tr('筛选与搜索', 'Filters')}
            actions={
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ xs: 'stretch', sm: 'center' }}>
                <ToggleButtonGroup
                  value={filter}
                  exclusive
                  onChange={(_, v) => {
                    if (!v) return
                    setFilter(v)
                  }}
                  size="small"
                >
                  <ToggleButton value="attention">{tr('到期/逾期', 'Due/Overdue')} ({derived.counts.attention})</ToggleButton>
                  <ToggleButton value="all">{tr('全部', 'All')} ({derived.counts.all})</ToggleButton>
                  <ToggleButton value="due">{tr('即将到期', 'Due')} ({derived.counts.due})</ToggleButton>
                  <ToggleButton value="overdue">{tr('已逾期', 'Overdue')} ({derived.counts.overdue})</ToggleButton>
                  <ToggleButton value="missing">{tr('未填写', 'Missing')} ({derived.counts.missing})</ToggleButton>
                </ToggleButtonGroup>
                <TextField
                  size="small"
                  margin="none"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={tr('搜索名称/资产号', 'Search name/code')}
                />
              </Stack>
            }
            contentSx={{ mx: -2.5, mb: -2.5 }}
          >
              <TableContainer component={Box} sx={{ border: 'none', boxShadow: 'none', borderRadius: 0 }}>
                <Table size="small">
                  <TableHead sx={{ backgroundColor: 'action.hover' }}>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 600 }}>{tr('资产号', 'Asset code')}</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>{tr('名称', 'Name')}</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>{tr('状态', 'Status')}</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>{tr('校验日期', 'Calibration date')}</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>{tr(`到期状态（≤${daysThreshold}天为即将到期）`, `Due status (≤${daysThreshold}d)` )}</TableCell>
                      <TableCell sx={{ fontWeight: 600 }} align="center">
                        {tr('操作', 'Actions')}
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {loading ? (
                      <TableSkeleton rows={6} columns={6} />
                    ) : derived.list.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6}>
                          <EmptyState
                            compact
                            title={tr('暂无校验记录', 'No calibration items')}
                            action={
                              query || filter !== 'all' ? (
                                <Button
                                  size="small"
                                  variant="outlined"
                                  onClick={() => {
                                    setQuery('')
                                    setFilter('all')
                                  }}
                                >
                                  {tr('查看全部设备', 'Show all assets')}
                                </Button>
                              ) : undefined
                            }
                          />
                        </TableCell>
                      </TableRow>
                    ) : (
                      derived.list.map(({ asset, state, days }) => {
                        let dateLabel = '-'
                        if (asset.calibrationDate) {
                          const d = new Date(asset.calibrationDate)
                          dateLabel = Number.isNaN(d.getTime()) ? '-' : d.toLocaleString()
                        }
                        const statusChip =
                          state === 'missing' ? (
                            <Chip size="small" label={tr('未填写', 'Missing')} />
                          ) : state === 'overdue' ? (
                            <Chip
                              size="small"
                              color="error"
                              label={
                                days === null
                                  ? tr('已逾期', 'Overdue')
                                  : tr(`已逾期 ${Math.ceil(Math.abs(days))} 天`, `Overdue ${Math.ceil(Math.abs(days))} d`)
                              }
                            />
                          ) : state === 'due' ? (
                            <Chip
                              size="small"
                              color="warning"
                              label={
                                days === null
                                  ? tr('即将到期', 'Due soon')
                                  : tr(`还有 ${Math.ceil(days)} 天`, `${Math.ceil(days)} d left`)
                              }
                            />
                          ) : (
                            <Chip
                              size="small"
                              color="success"
                              label={
                                days === null ? tr('正常', 'OK') : tr(`还有 ${Math.ceil(days)} 天`, `${Math.ceil(days)} d left`)
                              }
                            />
                          )

                        return (
                          <TableRow
                            key={asset.id}
                            hover
                            onClick={() => navigate(`/assets/${encodeURIComponent(asset.id)}`)}
                            sx={{ cursor: 'pointer' }}
                          >
                            <TableCell sx={{ fontWeight: 600 }}>{asset.assetCode || '-'}</TableCell>
                            <TableCell>
                              <Stack direction="row" spacing={1} alignItems="center">
                                <Typography sx={{ fontWeight: 600 }} noWrap>
                                  {asset.name}
                                </Typography>
                                <OpenInNewIcon fontSize="inherit" style={{ opacity: 0.55 }} />
                              </Stack>
                            </TableCell>
                            <TableCell>
                              <StatusChip kind="asset" status={asset.status} />
                            </TableCell>
                            <TableCell>{dateLabel}</TableCell>
                            <TableCell>{statusChip}</TableCell>
                            <TableCell align="center">
                              <Tooltip title={tr('修改校验日期', 'Edit calibration date')}>
                                <span>
                                  <IconButton
                                    size="small"
                                    color="primary"
                                    aria-label={tr('修改校验日期', 'Edit calibration date')}
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      openEdit(asset)
                                    }}
                                  >
                                    <EditIcon fontSize="small" />
                                  </IconButton>
                                </span>
                              </Tooltip>
                            </TableCell>
                          </TableRow>
                        )
                      })
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
          </AppCard>
        </Stack>

        <Dialog open={editOpen} onClose={closeEdit} fullWidth maxWidth="sm">
          <DialogTitle>{tr('修改校验日期', 'Edit calibration date')}</DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ pt: 1 }}>
              {editing ? (
                <Alert severity="info">
                  {tr('设备：', 'Asset: ')}
                  <strong>{editing.name}</strong>
                </Alert>
              ) : null}
              {saveError ? <Alert severity="error">{saveError}</Alert> : null}
              <DateTimePicker
                label={tr('校验日期', 'Calibration date')}
                value={editValue}
                onChange={(v) => setEditValue(v)}
                slotProps={{ textField: { fullWidth: true } }}
              />
              <Typography variant="caption" color="text.secondary">
                {tr('留空表示清空校验日期。', 'Leave empty to clear the calibration date.')}
              </Typography>
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={closeEdit} disabled={saving}>
              {tr('取消', 'Cancel')}
            </Button>
            <Button onClick={save} variant="contained" disabled={saving || !editing}>
              {saving ? tr('保存中...', 'Saving...') : tr('保存', 'Save')}
            </Button>
          </DialogActions>
        </Dialog>
      </PageShell>
  )
}

export default AssetCalibrationsPage
