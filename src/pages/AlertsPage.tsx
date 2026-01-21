import React, { useEffect, useMemo, useState } from 'react'
import {
  Box,
  Chip,
  IconButton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from '@mui/material'
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive'
import RefreshIcon from '@mui/icons-material/Refresh'
import PageShell from '../components/PageShell'
import AppCard from '../components/AppCard'
import TitleWithIcon from '../components/TitleWithIcon'
import { useAppDispatch, useAppSelector } from '../store/hooks'
import { fetchAssetsByType } from '../store/assetsSlice'
import { fetchUsageLogs } from '../store/usageLogsSlice'
import { AlertSeverity, AlertType, selectDerivedAlerts } from '../store/alertsSelectors'
import { useI18n } from '../i18n'

const severityColor: Record<AlertSeverity, 'error' | 'warning'> = {
  P1: 'error',
  P2: 'warning',
}

const AlertsPage: React.FC = () => {
  const dispatch = useAppDispatch()
  const settings = useAppSelector((s) => s.settings)
  const { tr } = useI18n()

  const [severityFilter, setSeverityFilter] = useState<AlertSeverity | 'all'>('all')
  const [typeFilter, setTypeFilter] = useState<AlertType | 'all'>('all')

  useEffect(() => {
    dispatch(fetchAssetsByType('chamber'))
    dispatch(fetchUsageLogs())
  }, [dispatch])

  useEffect(() => {
    if (!settings.refreshSeconds || settings.refreshSeconds <= 0) return
    const id = window.setInterval(() => {
      dispatch(fetchAssetsByType('chamber'))
      dispatch(fetchUsageLogs())
    }, settings.refreshSeconds * 1000)
    return () => window.clearInterval(id)
  }, [dispatch, settings.refreshSeconds])

  const nowMs = useMemo(() => Date.now(), [settings.alerts.calibrationDaysThreshold, settings.alerts.longOccupancyHoursThreshold])
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
    return alerts.filter((a) => {
      if (severityFilter !== 'all' && a.severity !== severityFilter) return false
      if (typeFilter !== 'all' && a.type !== typeFilter) return false
      return true
    })
  }, [alerts, severityFilter, typeFilter])

  const handleRefresh = () => {
    dispatch(fetchAssetsByType('chamber'))
    dispatch(fetchUsageLogs())
  }

  return (
    <PageShell
      title={
        <TitleWithIcon icon={<NotificationsActiveIcon />}>{tr('告警中心', 'Alerts')}</TitleWithIcon>
      }
      maxWidth="xl"
      actions={
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
          <Chip
            label={severityFilter === 'all' ? tr('严重级别: 全部', 'Severity: All') : tr(`严重级别: ${severityFilter}`, `Severity: ${severityFilter}`)}
            onClick={() => setSeverityFilter((v) => (v === 'all' ? 'P1' : v === 'P1' ? 'P2' : 'all'))}
            sx={{ fontWeight: 650 }}
          />
          <Chip
            label={typeFilter === 'all' ? tr('类型: 全部', 'Type: All') : tr(`类型: ${typeLabel[typeFilter]}`, `Type: ${typeLabel[typeFilter]}`)}
            onClick={() =>
              setTypeFilter((v) =>
                v === 'all' ? 'usage-overdue' : v === 'usage-overdue' ? 'usage-long' : v === 'usage-long' ? 'calibration-due' : 'all'
              )
            }
            sx={{ fontWeight: 650 }}
          />
          <Tooltip title={tr('刷新', 'Refresh')}>
            <IconButton onClick={handleRefresh} size="small" color="primary">
              <RefreshIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>
      }
    >
      <AppCard
        title={
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography component="span" sx={{ fontWeight: 750 }}>
              {tr('当前告警', 'Current alerts')}
            </Typography>
            <Chip size="small" label={settings.language === 'en' ? `${filtered.length}` : `${filtered.length} 条`} sx={{ fontWeight: 650 }} />
          </Stack>
        }
      >
        <TableContainer component={Box} sx={{ border: 'none', boxShadow: 'none', borderRadius: 0 }}>
          <Table size="small">
            <TableHead sx={{ backgroundColor: 'action.hover' }}>
              <TableRow>
                <TableCell sx={{ fontWeight: 650, width: 90 }}>{tr('级别', 'Severity')}</TableCell>
                <TableCell sx={{ fontWeight: 650, width: 120 }}>{tr('类型', 'Type')}</TableCell>
                <TableCell sx={{ fontWeight: 650 }}>{tr('设备', 'Asset')}</TableCell>
                <TableCell sx={{ fontWeight: 650 }}>{tr('标题', 'Title')}</TableCell>
                <TableCell sx={{ fontWeight: 650 }}>{tr('详情', 'Detail')}</TableCell>
                <TableCell sx={{ fontWeight: 650, width: 140 }}>{tr('关联记录', 'Related log')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center">
                    <Typography color="text.secondary">{tr('暂无告警', 'No alerts')}</Typography>
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((a) => (
                  <TableRow key={a.id} hover>
                    <TableCell>
                      <Chip size="small" label={a.severity} color={severityColor[a.severity]} />
                    </TableCell>
                    <TableCell>{typeLabel[a.type]}</TableCell>
                    <TableCell sx={{ fontWeight: 650 }}>{a.assetName}</TableCell>
                    <TableCell>{a.title}</TableCell>
                    <TableCell>{a.detail}</TableCell>
                    <TableCell>{a.relatedLogId ? a.relatedLogId.slice(0, 8) : '-'}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </AppCard>
    </PageShell>
  )
}

export default AlertsPage
