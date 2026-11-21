import React, { useEffect, useMemo, useState } from 'react'
import {
  Box,
  Button,
  Chip,
  IconButton,
  MenuItem,
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
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline'
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import RefreshIcon from '@mui/icons-material/Refresh'
import { useNavigate } from 'react-router-dom'
import PageShell from '../components/PageShell'
import AppCard from '../components/AppCard'
import EmptyState from '../components/EmptyState'
import TableSkeleton from '../components/TableSkeleton'
import TitleWithIcon from '../components/TitleWithIcon'
import UsageLogDetails from '../components/UsageLogDetails'
import { useAppDispatch, useAppSelector } from '../store/hooks'
import { fetchAssetsByType } from '../store/assetsSlice'
import { fetchUsageLogs } from '../store/usageLogsSlice'
import { AlertSeverity, AlertType, selectDerivedAlerts } from '../store/alertsSelectors'
import { useI18n } from '../i18n'
import { useMinuteClock } from '../hooks/useMinuteClock'
import { getLocalizedAlertContent } from '../utils/alertsI18n'

const severityColor: Record<AlertSeverity, 'error' | 'warning'> = {
  P1: 'error',
  P2: 'warning',
}

const AlertsPage: React.FC = () => {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const refreshSeconds = useAppSelector((s) => s.settings.refreshSeconds)
  const assetsLoading = useAppSelector((s) => s.assets.loading)
  const usageLogsLoading = useAppSelector((s) => s.usageLogs.loading)
  const role = useAppSelector((s) => s.auth.user?.role)
  const canManage = role === 'admin' || role === 'manager'
  const { tr } = useI18n()

  const [severityFilter, setSeverityFilter] = useState<AlertSeverity | 'all'>('all')
  const [typeFilter, setTypeFilter] = useState<AlertType | 'all'>('all')
  const [searchText, setSearchText] = useState('')
  const [selectedLogId, setSelectedLogId] = useState<string | null>(null)

  useEffect(() => {
    dispatch(fetchAssetsByType({ type: 'chamber' }))
    dispatch(fetchUsageLogs())
  }, [dispatch])

  useEffect(() => {
    if (!refreshSeconds || refreshSeconds <= 0) return
    const id = window.setInterval(() => {
      dispatch(fetchAssetsByType({ type: 'chamber', force: true }))
      dispatch(fetchUsageLogs({ force: true }))
    }, refreshSeconds * 1000)
    return () => window.clearInterval(id)
  }, [dispatch, refreshSeconds])

  const nowMs = useMinuteClock()
  const alerts = useAppSelector((state) => selectDerivedAlerts(state, nowMs))
  const typeLabel = useMemo<Record<AlertType, string>>(
    () => ({
      'calibration-due': tr('校准到期', 'Calibration due'),
      'usage-overdue': tr('逾期', 'Overdue'),
      'usage-long': tr('长占用', 'Long occupancy'),
    }),
    [tr]
  )

  const filtered = useMemo(() => {
    const q = searchText.trim().toLowerCase()
    return alerts.filter((a) => {
      if (severityFilter !== 'all' && a.severity !== severityFilter) return false
      if (typeFilter !== 'all' && a.type !== typeFilter) return false
      if (!q) return true
      const localized = getLocalizedAlertContent(a, tr)
      return [a.assetName, localized.title, localized.detail].join(' ').toLowerCase().includes(q)
    })
  }, [alerts, searchText, severityFilter, tr, typeFilter])

  const isLoading = assetsLoading || usageLogsLoading
  const hasFilters = severityFilter !== 'all' || typeFilter !== 'all' || Boolean(searchText.trim())

  const handleRefresh = () => {
    dispatch(fetchAssetsByType({ type: 'chamber', force: true }))
    dispatch(fetchUsageLogs({ force: true }))
  }

  return (
    <PageShell
      title={<TitleWithIcon icon={<NotificationsActiveIcon />}>{tr('异常监控', 'Exceptions')}</TitleWithIcon>}
      actions={
        <Stack direction="row" spacing={1} alignItems="center">
          <Tooltip title={tr('刷新', 'Refresh')}>
            <IconButton onClick={handleRefresh} size="small" color="primary" aria-label={tr('刷新', 'Refresh')}>
              <RefreshIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>
      }
    >
      <AppCard
        title={
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography component="span" sx={{ fontWeight: 700 }}>
              {tr('当前异常', 'Current exceptions')}
            </Typography>
            <Chip size="small" label={tr(`${filtered.length} 条`, `${filtered.length}`)} sx={{ fontWeight: 600 }} />
          </Stack>
        }
        contentSx={{ mx: -2.5, mb: -2.5 }}
      >
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          spacing={1.25}
          alignItems={{ xs: 'stretch', md: 'center' }}
          justifyContent="space-between"
          sx={{ px: 2.5, pb: 1.5 }}
        >
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25} alignItems={{ xs: 'stretch', sm: 'center' }} flexWrap="wrap" useFlexGap>
            <ToggleButtonGroup
              value={severityFilter}
              exclusive
              size="small"
              onChange={(_, v) => {
                if (v) setSeverityFilter(v)
              }}
            >
              <ToggleButton value="all">{tr('全部级别', 'All')}</ToggleButton>
              <ToggleButton value="P1">P1</ToggleButton>
              <ToggleButton value="P2">P2</ToggleButton>
            </ToggleButtonGroup>

            <TextField
              select
              size="small"
              margin="none"
              label={tr('异常类型', 'Type')}
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as AlertType | 'all')}
              sx={{ minWidth: 150 }}
            >
              <MenuItem value="all">{tr('全部类型', 'All types')}</MenuItem>
              <MenuItem value="usage-overdue">{tr('逾期', 'Overdue')}</MenuItem>
              <MenuItem value="usage-long">{tr('长占用', 'Long occupancy')}</MenuItem>
              <MenuItem value="calibration-due">{tr('校准到期', 'Calibration due')}</MenuItem>
            </TextField>

            <TextField
              size="small"
              margin="none"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder={tr('搜索设备 / 标题 / 详情', 'Search asset / title / detail')}
              sx={{ minWidth: { sm: 220 } }}
            />
          </Stack>
        </Stack>

        <TableContainer component={Box} sx={{ border: 'none', boxShadow: 'none', borderRadius: 0 }}>
          <Table size="small">
            <TableHead sx={{ backgroundColor: 'action.hover' }}>
              <TableRow>
                <TableCell sx={{ fontWeight: 600, width: 90 }}>{tr('级别', 'Severity')}</TableCell>
                <TableCell sx={{ fontWeight: 600, width: 120 }}>{tr('类型', 'Type')}</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>{tr('设备', 'Asset')}</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>{tr('标题', 'Title')}</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>{tr('详情', 'Detail')}</TableCell>
                <TableCell sx={{ fontWeight: 600, width: 140 }}>{tr('关联操作', 'Related')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {isLoading && alerts.length === 0 ? (
                <TableSkeleton rows={5} columns={6} />
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6}>
                    <EmptyState
                      compact
                      icon={<CheckCircleOutlineIcon color="success" />}
                      title={hasFilters ? tr('没有匹配的异常', 'No matching exceptions') : tr('当前一切正常，暂无异常', 'All clear — no active exceptions')}
                      action={
                        hasFilters ? (
                          <Button
                            size="small"
                            variant="outlined"
                            onClick={() => {
                              setSeverityFilter('all')
                              setTypeFilter('all')
                              setSearchText('')
                            }}
                          >
                            {tr('重置筛选', 'Reset filters')}
                          </Button>
                        ) : undefined
                      }
                    />
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((a) => {
                  const localized = getLocalizedAlertContent(a, tr)
                  return (
                    <TableRow key={a.id} hover>
                      <TableCell>
                        <Chip size="small" label={a.severity} color={severityColor[a.severity]} />
                      </TableCell>
                      <TableCell>{typeLabel[a.type]}</TableCell>
                      <TableCell>
                        {canManage ? (
                          <Button
                            size="small"
                            variant="text"
                            endIcon={<OpenInNewIcon sx={{ fontSize: 14 }} />}
                            onClick={() => navigate(`/assets/${encodeURIComponent(a.assetId)}`)}
                            sx={{ px: 0.5, minHeight: 28, fontWeight: 600, justifyContent: 'flex-start', textAlign: 'left' }}
                          >
                            {a.assetName}
                          </Button>
                        ) : (
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            {a.assetName}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>{localized.title}</TableCell>
                      <TableCell>{localized.detail}</TableCell>
                      <TableCell>
                        {a.relatedLogId ? (
                          <Chip
                            size="small"
                            variant="outlined"
                            color="primary"
                            clickable
                            label={a.relatedLogId.slice(0, 8)}
                            onClick={() => setSelectedLogId(a.relatedLogId!)}
                          />
                        ) : a.type === 'calibration-due' && canManage ? (
                          <Button size="small" variant="text" onClick={() => navigate('/calibrations')} sx={{ minHeight: 28, px: 0.75 }}>
                            {tr('去校准', 'Manage')}
                          </Button>
                        ) : (
                          '-'
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </AppCard>

      <UsageLogDetails
        open={Boolean(selectedLogId)}
        onClose={() => setSelectedLogId(null)}
        logId={selectedLogId}
      />
    </PageShell>
  )
}

export default AlertsPage
