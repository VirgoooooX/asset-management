import React, { useEffect, useMemo, useState } from 'react'
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
  FormControl,
  IconButton,
  InputLabel,
  LinearProgress,
  MenuItem,
  Select,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from '@mui/material'
import BuildCircleIcon from '@mui/icons-material/BuildCircle'
import AddIcon from '@mui/icons-material/Add'
import RefreshIcon from '@mui/icons-material/Refresh'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import PageShell from '../components/PageShell'
import AppCard from '../components/AppCard'
import TitleWithIcon from '../components/TitleWithIcon'
import { alpha } from '@mui/material/styles'
import { useAppDispatch, useAppSelector } from '../store/hooks'
import { fetchAssetsByType } from '../store/assetsSlice'
import { addRepairTicket, fetchRepairTickets } from '../store/repairTicketsSlice'
import type { Asset, RepairStatus, RepairTicket } from '../types'
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns'
import { DateTimePicker, LocalizationProvider } from '@mui/x-date-pickers'
import { zhCN } from 'date-fns/locale'
import { useI18n } from '../i18n'
import { useNavigate } from 'react-router-dom'

type StatusFilter = RepairStatus | 'all' | 'open'

const statusColor: Record<RepairStatus, 'warning' | 'info' | 'success'> = {
  'quote-pending': 'warning',
  'repair-pending': 'info',
  completed: 'success',
}

const calcDaysFrom = (iso: string) => {
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return 0
  return (Date.now() - t) / (24 * 60 * 60 * 1000)
}

const RepairsPage: React.FC = () => {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const assetsState = useAppSelector((s) => s.assets)
  const ticketsState = useAppSelector((s) => s.repairTickets)
  const role = useAppSelector((s) => s.auth.user?.role)
  const { tr, language } = useI18n()
  const canManage = role === 'admin' || role === 'manager'
  const isRefreshing = ticketsState.refreshing || assetsState.refreshing

  const [filter, setFilter] = useState<StatusFilter>('open')
  const [createOpen, setCreateOpen] = useState(false)

  const [createAssetId, setCreateAssetId] = useState('')
  const [createProblemDesc, setCreateProblemDesc] = useState('')
  const [createExpectedReturnAt, setCreateExpectedReturnAt] = useState<Date | null>(null)

  useEffect(() => {
    dispatch(fetchAssetsByType({ type: 'chamber' }))
    dispatch(fetchRepairTickets(undefined))
  }, [dispatch])

  const assetById = useMemo(() => {
    const map = new Map<string, Asset>()
    assetsState.assets.forEach((a) => map.set(a.id, a))
    return map
  }, [assetsState.assets])

  const sortedAssets = useMemo(() => {
    return assetsState.assets
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name, language === 'en' ? 'en' : 'zh-Hans-CN', { sensitivity: 'base' }))
  }, [assetsState.assets, language])

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

  const filteredTickets = useMemo(() => {
    if (filter === 'all') return ticketsState.tickets
    if (filter === 'open') return ticketsState.tickets.filter((t) => t.status !== 'completed')
    return ticketsState.tickets.filter((t) => t.status === filter)
  }, [filter, ticketsState.tickets])

  const counts = useMemo(() => {
    const all = ticketsState.tickets
    const quotePending = all.filter((t) => t.status === 'quote-pending').length
    const repairPending = all.filter((t) => t.status === 'repair-pending').length
    const completed = all.filter((t) => t.status === 'completed').length
    const open = quotePending + repairPending
    return { quotePending, repairPending, completed, open }
  }, [ticketsState.tickets])

  const openProgress = useMemo(() => {
    const total = Math.max(1, ticketsState.tickets.length)
    return Math.min(100, Math.round((counts.open / total) * 100))
  }, [counts.open, ticketsState.tickets.length])

  const openCreate = () => {
    setCreateAssetId('')
    setCreateProblemDesc('')
    setCreateExpectedReturnAt(null)
    setCreateOpen(true)
  }

  const handleRefresh = () => {
    dispatch(fetchAssetsByType({ type: 'chamber', force: true }))
    dispatch(fetchRepairTickets({ force: true }))
  }

  const handleSubmitCreate = async () => {
    if (!createAssetId || !createProblemDesc.trim()) return
    const action = await dispatch(
      addRepairTicket({
        assetId: createAssetId,
        problemDesc: createProblemDesc.trim(),
        expectedReturnAt: createExpectedReturnAt ? createExpectedReturnAt.toISOString() : undefined,
      })
    )
    setCreateOpen(false)
    if (addRepairTicket.fulfilled.match(action)) {
      navigate(`/repairs/${encodeURIComponent(action.payload.id)}`)
    }
  }


  return (
    <PageShell
      title={
        <TitleWithIcon icon={<BuildCircleIcon />}>{tr('维修管理', 'Repairs')}</TitleWithIcon>
      }
      actions={
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
          <Chip
            label={`Open: ${counts.open}`}
            color={counts.open > 0 ? 'warning' : 'default'}
            sx={{ fontWeight: 650 }}
          />
          <Chip label={language === 'en' ? `Quote pending: ${counts.quotePending}` : `未询价: ${counts.quotePending}`} variant="outlined" sx={{ fontWeight: 650 }} />
          <Chip label={language === 'en' ? `Repair pending: ${counts.repairPending}` : `待维修: ${counts.repairPending}`} variant="outlined" sx={{ fontWeight: 650 }} />
          <Chip label={language === 'en' ? `Completed: ${counts.completed}` : `已完成: ${counts.completed}`} variant="outlined" sx={{ fontWeight: 650 }} />
          <Tooltip title={tr('刷新', 'Refresh')}>
            <IconButton onClick={handleRefresh} size="small" color="primary" disabled={isRefreshing}>
              {isRefreshing ? <CircularProgress size={16} /> : <RefreshIcon fontSize="small" />}
            </IconButton>
          </Tooltip>
          <Button variant="contained" size="small" startIcon={<AddIcon />} onClick={openCreate}>
            {tr('新建工单', 'New ticket')}
          </Button>
        </Stack>
      }
    >
      <AppCard
        title={tr('维修状态追踪', 'Repair status tracking')}
        actions={
          <ToggleButtonGroup
            value={filter}
            exclusive
            size="small"
            onChange={(_, v) => {
              if (!v) return
              setFilter(v)
            }}
          >
            <ToggleButton value="open">{tr('Open', 'Open')}</ToggleButton>
            <ToggleButton value="quote-pending">{tr('未询价', 'Quote pending')}</ToggleButton>
            <ToggleButton value="repair-pending">{tr('待维修', 'Repair pending')}</ToggleButton>
            <ToggleButton value="completed">{tr('已完成', 'Completed')}</ToggleButton>
            <ToggleButton value="all">{tr('全部', 'All')}</ToggleButton>
          </ToggleButtonGroup>
        }
      >
        {ticketsState.loading ? (
          <Box sx={{ mb: 1 }}>
            <LinearProgress />
          </Box>
        ) : null}

        {ticketsState.error ? (
          <Alert severity="error" sx={{ mb: 2 }}>
            {ticketsState.error}
          </Alert>
        ) : null}

        <Box sx={{ mb: 2 }}>
          <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
            <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 650 }}>
              {tr('Open 占比', 'Open ratio')}
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 800 }}>
              {openProgress}%
            </Typography>
          </Stack>
          <LinearProgress variant="determinate" value={openProgress} sx={{ mt: 0.75, height: 8, borderRadius: 999 }} />
        </Box>

        <Stack spacing={1}>
          {filteredTickets.length === 0 ? (
            <Typography color="text.secondary">{tr('暂无工单', 'No tickets')}</Typography>
          ) : (
            filteredTickets.map((t) => {
              const asset = assetById.get(t.assetId)
              const days = calcDaysFrom(t.createdAt)
              return (
                <Box
                  key={t.id}
                  sx={{
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: 2,
                    p: 1.25,
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', md: '1fr 320px' },
                    gap: 1.25,
                    alignItems: 'center',
                    backgroundColor: (theme) =>
                      alpha(theme.palette.background.paper, theme.palette.mode === 'dark' ? 0.35 : 0.6),
                  cursor: 'pointer',
                    transition: 'background-color 150ms ease, border-color 150ms ease',
                    '&:hover': {
                      backgroundColor: (theme) =>
                        alpha(theme.palette.background.paper, theme.palette.mode === 'dark' ? 0.45 : 0.75),
                      borderColor: (theme) => alpha(theme.palette.primary.main, 0.25),
                    },
                  }}
                  onClick={() => navigate(`/repairs/${encodeURIComponent(t.id)}`)}
                >
                  <Box sx={{ minWidth: 0 }}>
                    <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
                      <Typography sx={{ fontWeight: 850 }} noWrap>
                        {asset?.name || tr(`设备 ${t.assetId.slice(0, 8)}`, `Asset ${t.assetId.slice(0, 8)}`)}
                      </Typography>
                      <Chip size="small" label={statusLabel[t.status]} color={statusColor[t.status]} />
                    </Stack>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }} noWrap>
                      {t.problemDesc || '-'}
                    </Typography>
                    {canManage && (t.vendorName || t.quoteAmount !== undefined) ? (
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }} noWrap>
                        {t.vendorName ? `${tr('供应商', 'Vendor')}: ${t.vendorName}` : tr('供应商: -', 'Vendor: -')}
                        {' · '}
                        {t.quoteAmount !== undefined ? `${tr('报价', 'Quote')}: ${t.quoteAmount}` : tr('报价: -', 'Quote: -')}
                      </Typography>
                    ) : null}
                  </Box>
                  <Stack direction="row" spacing={1} alignItems="center" justifyContent="flex-end" flexWrap="wrap">
                    <Chip size="small" variant="outlined" label={tr(`停机: ${formatDays(days)}`, `Downtime: ${formatDays(days)}`)} />
                    <IconButton size="small" color="primary" onClick={() => navigate(`/repairs/${encodeURIComponent(t.id)}`)}>
                      <OpenInNewIcon fontSize="small" />
                    </IconButton>
                  </Stack>
                </Box>
              )
            })
          )}
        </Stack>
      </AppCard>

      <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={zhCN}>
        <Dialog open={createOpen} onClose={() => setCreateOpen(false)} fullWidth maxWidth="sm">
          <DialogTitle>{tr('新建维修工单', 'New repair ticket')}</DialogTitle>
          <DialogContent dividers>
            <Stack spacing={2} sx={{ pt: 1 }}>
              <FormControl fullWidth size="small">
                <InputLabel id="repair-asset-label">{tr('设备', 'Asset')}</InputLabel>
                <Select
                  labelId="repair-asset-label"
                  label={tr('设备', 'Asset')}
                  value={createAssetId}
                  onChange={(e) => setCreateAssetId(e.target.value)}
                >
                  {sortedAssets.map((a) => (
                    <MenuItem key={a.id} value={a.id} disabled={a.status === 'in-use'}>
                      {a.name} {a.status === 'in-use' ? tr('(使用中)', '(In use)') : ''}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <TextField
                label={tr('故障/需求描述', 'Issue / request')}
                value={createProblemDesc}
                onChange={(e) => setCreateProblemDesc(e.target.value)}
                fullWidth
                size="small"
                multiline
                minRows={2}
              />
              <DateTimePicker
                label={tr('预计回归时间（可选）', 'Expected return time (optional)')}
                value={createExpectedReturnAt}
                onChange={(v) => setCreateExpectedReturnAt(v)}
                slotProps={{ textField: { fullWidth: true, size: 'small' } }}
              />
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setCreateOpen(false)}>{tr('取消', 'Cancel')}</Button>
            <Button
              variant="contained"
              onClick={handleSubmitCreate}
              disabled={!createAssetId || !createProblemDesc.trim() || ticketsState.loading}
            >
              {tr('创建', 'Create')}
            </Button>
          </DialogActions>
        </Dialog>

      </LocalizationProvider>
    </PageShell>
  )
}

export default RepairsPage
