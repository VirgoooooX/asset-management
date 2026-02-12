import React, { useEffect, useMemo, useState } from 'react'
import {
  Box,
  Button,
  Checkbox,
  Chip,
  FormControlLabel,
  Grid,
  LinearProgress,
  MenuItem,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  Collapse,
  IconButton,
  TextField,
} from '@mui/material'
import AssessmentIcon from '@mui/icons-material/Assessment'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import DownloadIcon from '@mui/icons-material/Download'
import { LocalizationProvider, DateTimePicker } from '@mui/x-date-pickers'
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns'
import { startOfDay, subDays } from 'date-fns'
import AppCard from '../components/AppCard'
import PageShell from '../components/PageShell'
import TitleWithIcon from '../components/TitleWithIcon'
import { useAppDispatch, useAppSelector } from '../store/hooks'
import { fetchAssetsByType } from '../store/assetsSlice'
import { fetchProjects } from '../store/projectsSlice'
import { useI18n } from '../i18n'
import { exportProjectCostToXlsx } from '../utils/exportProjectCostToXlsx'
import type { ProjectCostLine } from '../utils/exportProjectCostToXlsx'
import {
  fetchProjectCostGroupLines,
  fetchProjectCostLines,
  fetchProjectCostReport,
  type ProjectCostReportGroup,
  type ProjectCostReportGroupBy,
  type ProjectCostReportLine,
  type ProjectCostReportSeriesPoint,
} from '../services/reportService'
import EChart from '../components/EChart'

type RangePreset = '7d' | '30d' | '90d' | 'custom'

const formatMoneyYuan = (cents: number) => {
  const safe = Number.isFinite(cents) ? cents : 0
  return (Math.round(safe) / 100).toFixed(2)
}

const formatDateTime = (value?: string) => {
  if (!value) return '-'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleString()
}

const TrendChart: React.FC<{ series: ProjectCostReportSeriesPoint[]; title: string; emptyText: string }> = ({
  series,
  title,
  emptyText,
}) => {
  const { tr } = useI18n()
  const maxCostCents = Math.max(0, ...series.map((p) => (Number.isFinite(p.costCents) ? p.costCents : 0)))

  return (
    <Box>
      <Stack direction="row" spacing={1} alignItems="baseline" justifyContent="space-between" sx={{ mb: 1 }}>
        <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 750 }}>
          {title}
        </Typography>
        {series.length ? (
          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 650 }}>
            {series[0].day} → {series[series.length - 1].day}
          </Typography>
        ) : null}
      </Stack>
      {series.length <= 1 || maxCostCents <= 0 ? (
        <Typography color="text.secondary">{emptyText}</Typography>
      ) : (
        <EChart
          height={260}
          option={{
            grid: { top: 18, left: 58, right: 22, bottom: 48 },
            tooltip: {
              trigger: 'axis',
              axisPointer: { type: 'line' },
              valueFormatter: (v: any) => `¥${(Number(v) || 0).toFixed(2)}`,
            },
            xAxis: {
              type: 'category',
              data: series.map((p) => p.day),
              axisLabel: {
                formatter: (v: string) => String(v).slice(5),
              },
              name: tr('日期', 'Date'),
              nameLocation: 'middle',
              nameGap: 34,
            },
            yAxis: {
              type: 'value',
              axisLabel: { formatter: (v: number) => `¥${Number(v).toFixed(0)}` },
              name: tr('费用', 'Cost'),
              nameLocation: 'middle',
              nameGap: 44,
            },
            series: [
              {
                type: 'line',
                smooth: 0.35,
                showSymbol: false,
                lineStyle: { width: 3 },
                areaStyle: { opacity: 0.18 },
                emphasis: { focus: 'series' },
                data: series.map((p) => (Number.isFinite(p.costCents) ? p.costCents : 0) / 100),
              },
            ],
          }}
        />
      )}
    </Box>
  )
}

const ProjectCostReportPage: React.FC = () => {
  const dispatch = useAppDispatch()
  const { tr, dateFnsLocale } = useI18n()

  const assetsLoading = useAppSelector((s) => s.assets.loading)
  const projectsLoading = useAppSelector((s) => s.projects.loading)
  const settings = useAppSelector((s) => s.settings)

  const assets = useAppSelector((s) => s.assets.assets)
  const projects = useAppSelector((s) => s.projects.projects)

  const [preset, setPreset] = useState<RangePreset>('30d')
  const [customStart, setCustomStart] = useState<Date | null>(startOfDay(subDays(new Date(), 30)))
  const [customEnd, setCustomEnd] = useState<Date | null>(new Date())
  const [projectId, setProjectId] = useState<string>('all')
  const [includeUnlinked, setIncludeUnlinked] = useState(false)
  const [includeInProgress, setIncludeInProgress] = useState(false)
  const [groupBy, setGroupBy] = useState<ProjectCostReportGroupBy>('asset')
  const [expandedKey, setExpandedKey] = useState<string | null>(null)
  const [reportLoading, setReportLoading] = useState(false)
  const [reportError, setReportError] = useState<string | null>(null)
  const [groups, setGroups] = useState<ProjectCostReportGroup[]>([])
  const [series, setSeries] = useState<ProjectCostReportSeriesPoint[]>([])
  const [totals, setTotals] = useState<{ totalCostCents: number; totalBillableHours: number; groupCount: number; logCount: number }>({
    totalCostCents: 0,
    totalBillableHours: 0,
    groupCount: 0,
    logCount: 0,
  })
  const [groupLinesByKey, setGroupLinesByKey] = useState<Record<string, ProjectCostReportLine[]>>({})
  const [groupLinesLoadingKey, setGroupLinesLoadingKey] = useState<string | null>(null)

  useEffect(() => {
    dispatch(fetchAssetsByType({ type: 'chamber' }))
    dispatch(fetchProjects())
  }, [dispatch])

  const isLoading = assetsLoading || projectsLoading || reportLoading

  const { rangeStartMs, rangeEndMs, rangeLabel } = useMemo(() => {
    const now = new Date()
    if (preset === '7d') {
      const start = startOfDay(subDays(now, 7))
      return {
        rangeStartMs: start.getTime(),
        rangeEndMs: now.getTime(),
        rangeLabel: tr('最近7天', 'Last 7 days'),
      }
    }
    if (preset === '30d') {
      const start = startOfDay(subDays(now, 30))
      return {
        rangeStartMs: start.getTime(),
        rangeEndMs: now.getTime(),
        rangeLabel: tr('最近30天', 'Last 30 days'),
      }
    }
    if (preset === '90d') {
      const start = startOfDay(subDays(now, 90))
      return {
        rangeStartMs: start.getTime(),
        rangeEndMs: now.getTime(),
        rangeLabel: tr('最近90天', 'Last 90 days'),
      }
    }
    const start = customStart ?? startOfDay(subDays(now, 30))
    const end = customEnd ?? now
    return {
      rangeStartMs: start.getTime(),
      rangeEndMs: end.getTime(),
      rangeLabel: tr('自定义', 'Custom'),
    }
  }, [customEnd, customStart, preset, tr])

  const projectById = useMemo(() => new Map(projects.map((p) => [p.id, p] as const)), [projects])

  const summary = useMemo(() => {
    const targetProjectName =
      projectId === 'all' ? tr('全部项目', 'All projects') : projectById.get(projectId)?.name ?? projectId
    return {
      projectName: targetProjectName,
      range: { start: new Date(rangeStartMs).toISOString(), end: new Date(rangeEndMs).toISOString() },
      totalCostCents: totals.totalCostCents,
      totalBillableHours: totals.totalBillableHours,
      assetCount: totals.groupCount,
      logCount: totals.logCount,
    }
  }, [projectById, projectId, rangeEndMs, rangeStartMs, totals.groupCount, totals.logCount, totals.totalBillableHours, totals.totalCostCents, tr])

  useEffect(() => {
    let cancelled = false
    setReportLoading(true)
    setReportError(null)
    fetchProjectCostReport({
      rangeStartMs,
      rangeEndMs,
      projectId,
      groupBy,
      includeUnlinked,
      includeInProgress,
    })
      .then((data) => {
        if (cancelled) return
        setGroups(Array.isArray(data.groups) ? data.groups : [])
        setSeries(Array.isArray(data.series) ? data.series : [])
        setTotals({
          totalCostCents: Number(data.summary?.totalCostCents ?? 0),
          totalBillableHours: Number(data.summary?.totalBillableHours ?? 0),
          groupCount: Number(data.summary?.groupCount ?? 0),
          logCount: Number(data.summary?.logCount ?? 0),
        })
      })
      .catch((e: any) => {
        if (cancelled) return
        setGroups([])
        setSeries([])
        setTotals({ totalCostCents: 0, totalBillableHours: 0, groupCount: 0, logCount: 0 })
        setReportError(String(e?.message || e || 'error'))
      })
      .finally(() => {
        if (cancelled) return
        setReportLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [groupBy, includeInProgress, includeUnlinked, projectId, rangeEndMs, rangeStartMs])

  useEffect(() => {
    setExpandedKey(null)
    setGroupLinesByKey({})
    setGroupLinesLoadingKey(null)
  }, [groupBy, includeInProgress, includeUnlinked, projectId, rangeEndMs, rangeStartMs])

  const handleExport = async () => {
    const lines = await fetchProjectCostLines({
      rangeStartMs,
      rangeEndMs,
      projectId,
      groupBy,
      includeUnlinked,
      includeInProgress,
    }).catch(() => [])

    const exportLines: ProjectCostLine[] = lines.map((l) => ({
      logId: l.logId,
      projectName: l.projectName,
      assetName: l.assetName,
      startTime: l.startTime,
      endTime: l.endTime,
      billableHours: l.billableHours,
      hourlyRateYuan: Math.round(l.hourlyRateCents) / 100,
      costYuan: Math.round(l.costCents) / 100,
      rateSource: l.rateSource,
      estimated: l.estimated,
      user: l.user,
      notes: l.notes ?? undefined,
    }))

    exportProjectCostToXlsx({
      summary: {
        projectName: summary.projectName,
        range: summary.range,
        totalCostYuan: Math.round(summary.totalCostCents) / 100,
        totalBillableHours: summary.totalBillableHours,
        assetCount: summary.assetCount,
        logCount: summary.logCount,
      },
      lines: exportLines,
      language: settings.language,
      fileNamePrefix: projectId === 'all' ? 'project-cost' : `project-cost_${projectId.slice(0, 8)}`,
    })
  }

  const groupLabel =
    groupBy === 'asset'
      ? tr('设备', 'Asset')
      : groupBy === 'project'
        ? tr('项目', 'Project')
        : groupBy === 'user'
          ? tr('使用人', 'User')
          : tr('类别', 'Category')
  const groupCountLabel =
    groupBy === 'asset'
      ? tr('涉及设备', 'Assets')
      : groupBy === 'project'
        ? tr('涉及项目', 'Projects')
        : groupBy === 'user'
          ? tr('涉及使用人', 'Users')
          : tr('涉及类别', 'Categories')

  return (
    <PageShell
      title={<TitleWithIcon icon={<AssessmentIcon />}>{tr('项目成本报表', 'Project cost report')}</TitleWithIcon>}
      actions={
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
          <Chip
            label={tr(`口径：按小时计费（向上取整）`, 'Rule: hourly billing (ceil)')}
            size="small"
            sx={{ fontWeight: 650 }}
          />
          <Button
            size="small"
            variant="outlined"
            startIcon={<DownloadIcon />}
            onClick={handleExport}
            disabled={reportLoading || totals.logCount === 0}
          >
            {tr('导出', 'Export')}
          </Button>
        </Stack>
      }
    >
      {isLoading ? <LinearProgress sx={{ mb: 2 }} /> : null}
      {reportError ? (
        <Typography color="error" sx={{ mb: 2 }}>
          {tr('报表加载失败：', 'Report failed: ')}
          {reportError}
        </Typography>
      ) : null}

      <AppCard title={tr('筛选', 'Filters')} sx={{ mb: 2 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={4}>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              {([
                { id: '7d', label: tr('7天', '7d') },
                { id: '30d', label: tr('30天', '30d') },
                { id: '90d', label: tr('90天', '90d') },
                { id: 'custom', label: tr('自定义', 'Custom') },
              ] as const).map((p) => (
                <Chip
                  key={p.id}
                  label={p.label}
                  clickable
                  color={preset === p.id ? 'primary' : 'default'}
                  variant={preset === p.id ? 'filled' : 'outlined'}
                  onClick={() => setPreset(p.id)}
                  sx={{ fontWeight: 750 }}
                />
              ))}
            </Box>
          </Grid>
          <Grid item xs={12} md={4}>
            <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 700 }}>
              {tr('时间范围', 'Time range')}: {rangeLabel}
            </Typography>
          </Grid>
          <Grid item xs={12} md={4}>
            <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
              <FormControlLabel
                control={<Checkbox checked={includeUnlinked} onChange={(e) => setIncludeUnlinked(e.target.checked)} />}
                label={tr('包含未关联项目', 'Include unlinked')}
              />
              <FormControlLabel
                control={<Checkbox checked={includeInProgress} onChange={(e) => setIncludeInProgress(e.target.checked)} />}
                label={tr('包含进行中（估算）', 'Include in-progress (estimated)')}
              />
            </Stack>
          </Grid>
          <Grid item xs={12} md={6}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 700, flexShrink: 0 }}>
                {tr('项目', 'Project')}
              </Typography>
              <TextField
                select
                size="small"
                fullWidth
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
              >
                <MenuItem value="all">{tr('全部项目', 'All projects')}</MenuItem>
                {projects.map((p) => (
                  <MenuItem key={p.id} value={p.id}>
                    {p.name}
                  </MenuItem>
                ))}
              </TextField>
            </Box>
          </Grid>
          <Grid item xs={12} md={6}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 700, flexShrink: 0 }}>
                {tr('维度', 'Group')}
              </Typography>
              <TextField
                select
                size="small"
                fullWidth
                value={groupBy}
                onChange={(e) => setGroupBy(e.target.value as ProjectCostReportGroupBy)}
              >
                <MenuItem value="asset">{tr('按设备', 'By asset')}</MenuItem>
                <MenuItem value="project">{tr('按项目', 'By project')}</MenuItem>
                <MenuItem value="user">{tr('按使用人', 'By user')}</MenuItem>
                <MenuItem value="category">{tr('按类别', 'By category')}</MenuItem>
              </TextField>
            </Box>
          </Grid>

          {preset === 'custom' ? (
            <Grid item xs={12} md={6}>
              <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={dateFnsLocale}>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}>
                    <DateTimePicker
                      label={tr('开始时间', 'Start time')}
                      value={customStart}
                      onChange={(v) => setCustomStart(v)}
                      slotProps={{ textField: { fullWidth: true, size: 'small' } }}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <DateTimePicker
                      label={tr('结束时间', 'End time')}
                      value={customEnd}
                      onChange={(v) => setCustomEnd(v)}
                      slotProps={{ textField: { fullWidth: true, size: 'small' } }}
                    />
                  </Grid>
                </Grid>
              </LocalizationProvider>
            </Grid>
          ) : null}
        </Grid>
      </AppCard>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', md: 'repeat(4, minmax(0, 1fr))' },
          gap: 2,
          mb: 2,
        }}
      >
        <AppCard title={tr('总费用', 'Total cost')}>
          <Typography variant="h5" sx={{ fontWeight: 950 }}>
            ¥ {formatMoneyYuan(summary.totalCostCents)}
          </Typography>
        </AppCard>
        <AppCard title={tr('计费小时', 'Billable hours')}>
          <Typography variant="h5" sx={{ fontWeight: 950 }}>
            {summary.totalBillableHours}
          </Typography>
        </AppCard>
        <AppCard title={groupCountLabel}>
          <Typography variant="h5" sx={{ fontWeight: 950 }}>
            {summary.assetCount}
          </Typography>
        </AppCard>
        <AppCard title={tr('涉及记录', 'Logs')}>
          <Typography variant="h5" sx={{ fontWeight: 950 }}>
            {summary.logCount}
          </Typography>
        </AppCard>
      </Box>

      <AppCard title={tr('费用趋势', 'Cost trend')} sx={{ mb: 2 }}>
        <TrendChart
          series={series}
          title={tr('按天汇总（费用）', 'Daily total (cost)')}
          emptyText={tr('暂无趋势数据', 'No trend data')}
        />
      </AppCard>

      <AppCard title={`${tr('汇总', 'Summary')} · ${groupLabel}`}>
        <TableContainer component={Box} sx={{ border: 'none', boxShadow: 'none', borderRadius: 0 }}>
          <Table size="small">
            <TableHead sx={{ backgroundColor: 'action.hover' }}>
              <TableRow>
                <TableCell sx={{ width: 40 }} />
                <TableCell sx={{ fontWeight: 700 }}>{groupLabel}</TableCell>
                {groupBy === 'asset' ? (
                  <TableCell sx={{ fontWeight: 700, width: 180 }} align="right">
                    {tr('小时费率', 'Rate')}
                  </TableCell>
                ) : null}
                <TableCell sx={{ fontWeight: 700, width: 110 }} align="right">
                  {tr('计费小时', 'Hours')}
                </TableCell>
                <TableCell sx={{ fontWeight: 700, width: 140 }} align="right">
                  {tr('费用', 'Cost')}
                </TableCell>
                <TableCell sx={{ fontWeight: 700, width: 90 }} align="right">
                  {tr('记录数', 'Logs')}
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {groups.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={groupBy === 'asset' ? 6 : 5} align="center">
                    <Typography color="text.secondary">{tr('暂无数据', 'No data')}</Typography>
                  </TableCell>
                </TableRow>
              ) : (
                groups.map((r) => {
                  const isOpen = expandedKey === r.key
                  const showProjectCol = groupBy !== 'project'
                  const showAssetCol = groupBy !== 'asset'
                  const showUserCol = groupBy !== 'user'
                  return (
                    <React.Fragment key={r.key}>
                      <TableRow hover>
                        <TableCell>
                          <IconButton
                            size="small"
                            onClick={() => {
                              const willOpen = expandedKey !== r.key
                              setExpandedKey(willOpen ? r.key : null)
                              if (!willOpen) return
                              if (groupLinesByKey[r.key]) return
                              if (groupLinesLoadingKey) return
                              setGroupLinesLoadingKey(r.key)
                              fetchProjectCostGroupLines({
                                rangeStartMs,
                                rangeEndMs,
                                projectId,
                                groupBy,
                                key: r.key,
                                includeUnlinked,
                                includeInProgress,
                              })
                                .then((lines) => {
                                  setGroupLinesByKey((prev) => ({ ...prev, [r.key]: lines }))
                                })
                                .catch(() => undefined)
                                .finally(() => {
                                  setGroupLinesLoadingKey((prev) => (prev === r.key ? null : prev))
                                })
                            }}
                          >
                            {isOpen ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
                          </IconButton>
                        </TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>
                          <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between" flexWrap="wrap">
                            <Typography sx={{ fontWeight: 850 }}>{r.label}</Typography>
                            {groupBy !== 'asset' ? (
                              r.hasSnapshot && r.hasFallback ? (
                                <Chip size="small" label={tr('混合来源', 'Mixed source')} variant="outlined" />
                              ) : r.hasSnapshot ? (
                                <Chip size="small" label={tr('快照', 'Snapshot')} color="success" variant="outlined" />
                              ) : r.hasCategory ? (
                                <Chip size="small" label={tr('类型', 'Category')} color="info" variant="outlined" />
                              ) : (
                                <Chip size="small" label={tr('回退', 'Fallback')} color="warning" variant="outlined" />
                              )
                            ) : null}
                          </Stack>
                        </TableCell>
                        {groupBy === 'asset' ? (
                          <TableCell align="right">
                            <Stack direction="row" spacing={1} alignItems="center" justifyContent="flex-end" flexWrap="nowrap" sx={{ whiteSpace: 'nowrap' }}>
                              <Typography sx={{ fontWeight: 750 }} noWrap>
                                {r.hourlyRateCents === null
                                  ? tr('混合', 'Mixed')
                                  : `¥ ${formatMoneyYuan(r.hourlyRateCents)}/${tr('小时', 'h')}`}
                              </Typography>
                              {r.hasSnapshot && r.hasFallback ? (
                                <Chip size="small" label={tr('混合来源', 'Mixed source')} variant="outlined" sx={{ flexShrink: 0 }} />
                              ) : r.hasSnapshot ? (
                                <Chip size="small" label={tr('快照', 'Snapshot')} color="success" variant="outlined" sx={{ flexShrink: 0 }} />
                              ) : r.hasCategory ? (
                                <Chip size="small" label={tr('类型', 'Category')} color="info" variant="outlined" sx={{ flexShrink: 0 }} />
                              ) : (
                                <Chip size="small" label={tr('回退', 'Fallback')} color="warning" variant="outlined" sx={{ flexShrink: 0 }} />
                              )}
                            </Stack>
                          </TableCell>
                        ) : null}
                        <TableCell align="right">{r.billableHours}</TableCell>
                        <TableCell align="right">¥ {formatMoneyYuan(r.costCents)}</TableCell>
                        <TableCell align="right">{r.logCount}</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell colSpan={groupBy === 'asset' ? 6 : 5} sx={{ p: 0, border: 'none' }}>
                          <Collapse in={isOpen} timeout="auto" unmountOnExit>
                            <Box sx={{ p: 1.5, pt: 0.5 }}>
                              <Typography variant="subtitle2" sx={{ fontWeight: 850, mb: 1 }}>
                                {tr('使用记录明细', 'Log details')}
                              </Typography>
                              <Table size="small">
                                <TableHead>
                                  <TableRow>
                                    {showProjectCol ? (
                                      <TableCell sx={{ fontWeight: 700, width: 140 }}>{tr('项目', 'Project')}</TableCell>
                                    ) : null}
                                    {showAssetCol ? (
                                      <TableCell sx={{ fontWeight: 700, width: 130 }}>{tr('设备', 'Asset')}</TableCell>
                                    ) : null}
                                    <TableCell sx={{ fontWeight: 700, width: 110 }}>{tr('开始', 'Start')}</TableCell>
                                    <TableCell sx={{ fontWeight: 700, width: 110 }}>{tr('结束', 'End')}</TableCell>
                                    <TableCell sx={{ fontWeight: 700, width: 90 }}>{tr('计费小时', 'Hours')}</TableCell>
                                    <TableCell sx={{ fontWeight: 700, width: 90 }}>{tr('费率来源', 'Rate')}</TableCell>
                                    <TableCell sx={{ fontWeight: 700, width: 110 }} align="right">
                                      {tr('费用', 'Cost')}
                                    </TableCell>
                                    {showUserCol ? (
                                      <TableCell sx={{ fontWeight: 700, width: 110 }}>{tr('使用人', 'User')}</TableCell>
                                    ) : null}
                                    <TableCell sx={{ fontWeight: 700 }}>{tr('备注', 'Notes')}</TableCell>
                                  </TableRow>
                                </TableHead>
                                <TableBody>
                                  {groupLinesLoadingKey === r.key ? (
                                    <TableRow>
                                      <TableCell
                                        colSpan={(showProjectCol ? 1 : 0) + (showAssetCol ? 1 : 0) + (showUserCol ? 1 : 0) + 6}
                                        sx={{ py: 1 }}
                                      >
                                        <LinearProgress />
                                      </TableCell>
                                    </TableRow>
                                  ) : (groupLinesByKey[r.key] ?? []).length === 0 ? (
                                    <TableRow>
                                      <TableCell
                                        colSpan={(showProjectCol ? 1 : 0) + (showAssetCol ? 1 : 0) + (showUserCol ? 1 : 0) + 6}
                                        align="center"
                                      >
                                        <Typography color="text.secondary">{tr('暂无数据', 'No data')}</Typography>
                                      </TableCell>
                                    </TableRow>
                                  ) : (
                                    (groupLinesByKey[r.key] ?? []).map((l) => (
                                      <TableRow key={l.logId}>
                                        {showProjectCol ? <TableCell>{l.projectName}</TableCell> : null}
                                        {showAssetCol ? <TableCell>{l.assetName}</TableCell> : null}
                                        <TableCell>{formatDateTime(l.startTime)}</TableCell>
                                        <TableCell>{formatDateTime(l.endTime)}</TableCell>
                                        <TableCell>{l.billableHours}</TableCell>
                                        <TableCell>
                                          <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap">
                                            <Chip
                                              size="small"
                                              label={
                                                l.rateSource === 'snapshot'
                                                  ? tr('快照', 'Snapshot')
                                                  : l.rateSource === 'category'
                                                    ? tr('类型', 'Category')
                                                    : tr('回退', 'Fallback')
                                              }
                                              color={
                                                l.rateSource === 'snapshot' ? 'success' : l.rateSource === 'category' ? 'info' : 'warning'
                                              }
                                              variant="outlined"
                                            />
                                            {l.estimated ? (
                                              <Chip size="small" label={tr('估算', 'Estimated')} variant="outlined" />
                                            ) : null}
                                          </Stack>
                                        </TableCell>
                                        <TableCell align="right">¥ {formatMoneyYuan(l.costCents)}</TableCell>
                                        {showUserCol ? <TableCell>{l.user || '-'}</TableCell> : null}
                                        <TableCell>{l.notes || '-'}</TableCell>
                                      </TableRow>
                                    ))
                                  )}
                                </TableBody>
                              </Table>
                            </Box>
                          </Collapse>
                        </TableCell>
                      </TableRow>
                    </React.Fragment>
                  )
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </AppCard>
    </PageShell>
  )
}

export default ProjectCostReportPage
