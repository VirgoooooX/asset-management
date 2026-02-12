import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  FormControlLabel,
  Grid,
  Stack,
  TextField,
  Typography,
  Checkbox,
} from '@mui/material'
import CategoryIcon from '@mui/icons-material/Category'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import PageShell from '../components/PageShell'
import TitleWithIcon from '../components/TitleWithIcon'
import AppCard from '../components/AppCard'
import { useI18n } from '../i18n'
import { useNavigate, useParams } from 'react-router-dom'
import { useAppDispatch, useAppSelector } from '../store/hooks'
import { fetchAssetsByType } from '../store/assetsSlice'
import { fetchAssetCategoryRates, upsertAssetCategoryRate } from '../services/assetCategoryRateService'
import { fetchProjectCostReport } from '../services/reportService'

const formatMoneyYuan = (cents: number) => {
  const safe = Number.isFinite(cents) ? cents : 0
  return (Math.round(safe) / 100).toFixed(2)
}

const normalizeCategory = (v: string | undefined) => (v ?? '').trim()

const AssetCategoryPage: React.FC = () => {
  const { tr } = useI18n()
  const navigate = useNavigate()
  const { categoryKey } = useParams()
  const dispatch = useAppDispatch()
  const role = useAppSelector((s) => s.auth.user?.role)
  const canEditRate = role === 'admin'

  const assetsLoading = useAppSelector((s) => s.assets.loading)
  const assetsError = useAppSelector((s) => s.assets.error)
  const assets = useAppSelector((s) => s.assets.assets)

  const category = useMemo(() => {
    const raw = decodeURIComponent(String(categoryKey ?? ''))
    return raw === '__uncategorized__' ? '' : raw
  }, [categoryKey])

  const categoryLabel = useMemo(() => {
    return category ? category : tr('未分类', 'Uncategorized')
  }, [category, tr])

  const categoryAssets = useMemo(() => {
    const key = normalizeCategory(category)
    return assets
      .filter((a) => normalizeCategory(a.category) === key)
      .slice()
      .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'zh-Hans-CN', { sensitivity: 'base' }))
  }, [assets, category])

  const counts = useMemo(() => {
    const total = categoryAssets.length
    let available = 0
    let inUse = 0
    let maintenance = 0
    categoryAssets.forEach((a) => {
      if (a.status === 'available') available += 1
      else if (a.status === 'in-use') inUse += 1
      else maintenance += 1
    })
    return { total, available, inUse, maintenance }
  }, [categoryAssets])

  const currentUtilizationPct = useMemo(() => {
    if (!counts.total) return 0
    return (counts.inUse / counts.total) * 100
  }, [counts.inUse, counts.total])

  const [rateLoading, setRateLoading] = useState(false)
  const [rateError, setRateError] = useState<string | null>(null)
  const [rateSaving, setRateSaving] = useState(false)
  const [rateInput, setRateInput] = useState<string>('0.00')

  const loadRate = useCallback(async () => {
    setRateLoading(true)
    setRateError(null)
    try {
      const items = await fetchAssetCategoryRates()
      const hit = items.find((it) => normalizeCategory(it.category) === normalizeCategory(category))
      const cents = typeof hit?.hourlyRateCents === 'number' && Number.isFinite(hit.hourlyRateCents) ? hit.hourlyRateCents : 0
      setRateInput((Math.round(cents) / 100).toFixed(2))
    } catch (e: any) {
      setRateError(e?.message || tr('加载费率失败', 'Failed to load rates'))
    } finally {
      setRateLoading(false)
    }
  }, [category, tr])

  const [rangePresetDays, setRangePresetDays] = useState<number>(30)
  const [includeInProgress, setIncludeInProgress] = useState(false)
  const [metricLoading, setMetricLoading] = useState(false)
  const [metricError, setMetricError] = useState<string | null>(null)
  const [rangeTotalBillableHours, setRangeTotalBillableHours] = useState<number>(0)
  const [rangeTotalCostCents, setRangeTotalCostCents] = useState<number>(0)
  const [rangeLogCount, setRangeLogCount] = useState<number>(0)
  const [rangeHours, setRangeHours] = useState<number>(0)

  const loadMetrics = useCallback(async () => {
    const endMs = Date.now()
    const startMs = endMs - rangePresetDays * 24 * 60 * 60 * 1000
    setRangeHours(Math.max(0, (endMs - startMs) / 3600000))
    setMetricLoading(true)
    setMetricError(null)
    try {
      const data = await fetchProjectCostReport({
        rangeStartMs: startMs,
        rangeEndMs: endMs,
        projectId: 'all',
        groupBy: 'category',
        includeUnlinked: true,
        includeInProgress,
      })
      const key = normalizeCategory(category)
      const hit = (data.groups || []).find((g) => normalizeCategory(g.key) === key || normalizeCategory(g.label) === key)
      setRangeTotalBillableHours(typeof hit?.billableHours === 'number' ? hit.billableHours : 0)
      setRangeTotalCostCents(typeof hit?.costCents === 'number' ? hit.costCents : 0)
      setRangeLogCount(typeof hit?.logCount === 'number' ? hit.logCount : 0)
    } catch (e: any) {
      setMetricError(e?.message || tr('加载统计失败', 'Failed to load metrics'))
      setRangeTotalBillableHours(0)
      setRangeTotalCostCents(0)
      setRangeLogCount(0)
    } finally {
      setMetricLoading(false)
    }
  }, [category, includeInProgress, rangePresetDays, tr])

  const rangeUtilizationPct = useMemo(() => {
    if (!counts.total || !rangeHours) return 0
    const cap = counts.total * rangeHours
    if (cap <= 0) return 0
    return (rangeTotalBillableHours / cap) * 100
  }, [counts.total, rangeHours, rangeTotalBillableHours])

  useEffect(() => {
    dispatch(fetchAssetsByType({ type: 'chamber' }))
  }, [dispatch])

  useEffect(() => {
    loadRate()
  }, [loadRate])

  useEffect(() => {
    loadMetrics()
  }, [loadMetrics])

  const title = useMemo(() => tr(`设备类型：${categoryLabel}`, `Category: ${categoryLabel}`), [categoryLabel, tr])

  return (
    <PageShell
      title={<TitleWithIcon icon={<CategoryIcon />}>{title}</TitleWithIcon>}
      actions={
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
          <Button size="small" variant="outlined" startIcon={<ArrowBackIcon />} onClick={() => navigate(-1)}>
            {tr('返回', 'Back')}
          </Button>
        </Stack>
      }
    >
      {assetsError ? (
        <Alert severity="error" sx={{ mb: 2 }}>
          {tr(`加载设备失败: ${assetsError}`, `Failed to load assets: ${assetsError}`)}
        </Alert>
      ) : null}

      <Grid container spacing={2}>
        <Grid item xs={12} lg={7}>
          <AppCard title={tr('概览', 'Overview')} sx={{ mb: 2 }}>
            {assetsLoading ? (
              <Stack direction="row" spacing={2} alignItems="center">
                <CircularProgress size={18} />
                <Typography color="text.secondary">{tr('正在加载...', 'Loading...')}</Typography>
              </Stack>
            ) : (
              <Stack spacing={1.25}>
                <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                  <Chip size="small" label={tr(`总数 ${counts.total}`, `Total ${counts.total}`)} variant="outlined" />
                  <Chip size="small" color="success" label={tr(`可用 ${counts.available}`, `Available ${counts.available}`)} variant="outlined" />
                  <Chip size="small" color="warning" label={tr(`使用中 ${counts.inUse}`, `In use ${counts.inUse}`)} variant="outlined" />
                  <Chip size="small" color="error" label={tr(`维护 ${counts.maintenance}`, `Maintenance ${counts.maintenance}`)} variant="outlined" />
                </Stack>
                <Divider />
                <Grid container spacing={1.25}>
                  <Grid item xs={12} sm={6}>
                    <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 700 }}>
                      {tr('当前使用率（设备状态）', 'Current utilization (by status)')}
                    </Typography>
                    <Typography sx={{ fontWeight: 950, fontSize: 20 }}>{currentUtilizationPct.toFixed(1)}%</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {tr('使用中/总数', 'in-use / total')}
                    </Typography>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 700 }}>
                      {tr(`近 ${rangePresetDays} 天使用率（按工时）`, `${rangePresetDays}d utilization (by billable hours)`)}
                    </Typography>
                    <Typography sx={{ fontWeight: 950, fontSize: 20 }}>{rangeUtilizationPct.toFixed(1)}%</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {tr('计费工时 /（设备数 × 时间范围）', 'billableHours / (assetCount × rangeHours)')}
                    </Typography>
                  </Grid>
                </Grid>
              </Stack>
            )}
          </AppCard>

          <AppCard title={tr('设备列表', 'Assets')} contentSx={{ mx: -2.5, mb: -2.5 }}>
            {categoryAssets.length === 0 ? (
              <Box sx={{ p: 2.5 }}>
                <Typography color="text.secondary">{tr('该类型暂无设备', 'No assets in this category')}</Typography>
              </Box>
            ) : (
              <Box sx={{ p: 2.5, pt: 1.5, display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1 }}>
                {categoryAssets.map((a) => (
                  <Box
                    key={a.id}
                    sx={{
                      border: '1px solid',
                      borderColor: 'divider',
                      borderRadius: 2,
                      p: 1.25,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1,
                      cursor: 'pointer',
                      '&:hover': { borderColor: 'text.secondary', bgcolor: 'action.hover' },
                    }}
                    onClick={() => navigate(`/assets/${a.id}`)}
                  >
                    <Box sx={{ minWidth: 0, flex: 1 }}>
                      <Typography sx={{ fontWeight: 850 }} noWrap>
                        {a.name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" noWrap>
                        {a.assetCode || a.id}
                      </Typography>
                    </Box>
                    <Chip
                      size="small"
                      label={
                        a.status === 'available'
                          ? tr('可用', 'Available')
                          : a.status === 'in-use'
                            ? tr('使用中', 'In use')
                            : tr('维护中', 'Maintenance')
                      }
                      color={a.status === 'available' ? 'success' : a.status === 'in-use' ? 'warning' : 'error'}
                    />
                    <OpenInNewIcon fontSize="small" />
                  </Box>
                ))}
              </Box>
            )}
          </AppCard>
        </Grid>

        <Grid item xs={12} lg={5}>
          <AppCard title={tr('费用设置', 'Cost settings')} sx={{ mb: 2 }}>
            {rateError ? (
              <Alert severity="error" sx={{ mb: 1.5 }}>
                {rateError}
              </Alert>
            ) : null}

            {rateLoading ? (
              <Stack direction="row" spacing={2} alignItems="center">
                <CircularProgress size={18} />
                <Typography color="text.secondary">{tr('正在加载费率...', 'Loading rate...')}</Typography>
              </Stack>
            ) : (
              <Stack spacing={1.25}>
                <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 650 }}>
                  {tr('同一设备类型共用一个小时费率（元/小时）', 'All assets in the same category share one hourly rate (CNY/h)')}
                </Typography>
                <TextField
                  size="small"
                  label={tr('小时费率（元/小时）', 'Hourly rate (CNY/h)')}
                  value={rateInput}
                  onChange={(e) => setRateInput(e.target.value)}
                  disabled={!canEditRate || rateSaving}
                  inputProps={{ inputMode: 'decimal' }}
                />
                {canEditRate ? (
                  <Button
                    size="small"
                    variant="contained"
                    disabled={rateSaving}
                    onClick={async () => {
                      const n = Number(rateInput)
                      if (!Number.isFinite(n) || n < 0) {
                        setRateError(tr('请输入有效费率（>=0）', 'Please enter a valid rate (>=0)'))
                        return
                      }
                      setRateSaving(true)
                      setRateError(null)
                      try {
                        await upsertAssetCategoryRate({ category, hourlyRateCents: Math.round(n * 100) })
                        await loadRate()
                      } catch (e: any) {
                        setRateError(e?.message || tr('保存失败', 'Save failed'))
                      } finally {
                        setRateSaving(false)
                      }
                    }}
                  >
                    {rateSaving ? tr('保存中…', 'Saving…') : tr('保存', 'Save')}
                  </Button>
                ) : (
                  <Typography variant="caption" color="text.secondary">
                    {tr('仅管理员可修改', 'Only admin can edit')}
                  </Typography>
                )}
              </Stack>
            )}
          </AppCard>

          <AppCard title={tr('近期开销与工时', 'Recent cost & hours')}>
            {metricError ? (
              <Alert severity="error" sx={{ mb: 1.5 }}>
                {metricError}
              </Alert>
            ) : null}

            <Stack spacing={1.25}>
              <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                <Button size="small" variant={rangePresetDays === 7 ? 'contained' : 'outlined'} onClick={() => setRangePresetDays(7)}>
                  {tr('7天', '7d')}
                </Button>
                <Button size="small" variant={rangePresetDays === 30 ? 'contained' : 'outlined'} onClick={() => setRangePresetDays(30)}>
                  {tr('30天', '30d')}
                </Button>
                <Button size="small" variant={rangePresetDays === 90 ? 'contained' : 'outlined'} onClick={() => setRangePresetDays(90)}>
                  {tr('90天', '90d')}
                </Button>
                <Box sx={{ flex: 1 }} />
                <FormControlLabel
                  control={<Checkbox checked={includeInProgress} onChange={(e) => setIncludeInProgress(e.target.checked)} />}
                  label={tr('含进行中估算', 'Include in-progress')}
                />
              </Stack>

              {metricLoading ? (
                <Stack direction="row" spacing={2} alignItems="center">
                  <CircularProgress size={18} />
                  <Typography color="text.secondary">{tr('正在加载统计...', 'Loading metrics...')}</Typography>
                </Stack>
              ) : (
                <Grid container spacing={1.25}>
                  <Grid item xs={12} sm={4}>
                    <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 700 }}>
                      {tr('费用', 'Cost')}
                    </Typography>
                    <Typography sx={{ fontWeight: 950, fontSize: 20 }}>¥ {formatMoneyYuan(rangeTotalCostCents)}</Typography>
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 700 }}>
                      {tr('计费工时', 'Billable hours')}
                    </Typography>
                    <Typography sx={{ fontWeight: 950, fontSize: 20 }}>{rangeTotalBillableHours.toFixed(2)}</Typography>
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 700 }}>
                      {tr('记录数', 'Logs')}
                    </Typography>
                    <Typography sx={{ fontWeight: 950, fontSize: 20 }}>{rangeLogCount}</Typography>
                  </Grid>
                </Grid>
              )}
            </Stack>
          </AppCard>
        </Grid>
      </Grid>
    </PageShell>
  )
}

export default AssetCategoryPage

