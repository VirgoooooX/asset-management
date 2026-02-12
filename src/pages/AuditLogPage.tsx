import React, { useEffect, useMemo, useState } from 'react'
import {
  Box,
  Button,
  Collapse,
  IconButton,
  LinearProgress,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material'
import ListAltIcon from '@mui/icons-material/ListAlt'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import PageShell from '../components/PageShell'
import TitleWithIcon from '../components/TitleWithIcon'
import AppCard from '../components/AppCard'
import { useI18n } from '../i18n'
import { exportAuditLogsCsv, getAuditLogs, type AuditLogItem } from '../services/auditLogService'

const formatDateTime = (value: string) => {
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleString()
}

const toPrettyJson = (value: any) => {
  if (value === undefined) return ''
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

const diffTopLevelKeys = (before: any, after: any) => {
  const a = before && typeof before === 'object' ? before : {}
  const b = after && typeof after === 'object' ? after : {}
  const keys = new Set<string>([...Object.keys(a), ...Object.keys(b)])
  return Array.from(keys).filter((k) => {
    try {
      return JSON.stringify((a as any)[k]) !== JSON.stringify((b as any)[k])
    } catch {
      return (a as any)[k] !== (b as any)[k]
    }
  })
}

const PAGE_SIZE = 50

const AuditLogPage: React.FC = () => {
  const { tr } = useI18n()
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [items, setItems] = useState<AuditLogItem[]>([])
  const [total, setTotal] = useState(0)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [filterFrom, setFilterFrom] = useState('')
  const [filterTo, setFilterTo] = useState('')
  const [filterActorUsername, setFilterActorUsername] = useState('')
  const [filterAction, setFilterAction] = useState('')
  const [filterEntityType, setFilterEntityType] = useState('')
  const [filterEntityId, setFilterEntityId] = useState('')
  const [filterRequestId, setFilterRequestId] = useState('')
  const [applied, setApplied] = useState({
    from: '',
    to: '',
    actorUsername: '',
    action: '',
    entityType: '',
    entityId: '',
    requestId: '',
  })

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    getAuditLogs({
      page,
      pageSize: PAGE_SIZE,
      from: applied.from || undefined,
      to: applied.to || undefined,
      actorUsername: applied.actorUsername || undefined,
      action: applied.action || undefined,
      entityType: applied.entityType || undefined,
      entityId: applied.entityId || undefined,
      requestId: applied.requestId || undefined,
    })
      .then((data) => {
        if (cancelled) return
        setItems(data.items)
        setTotal(data.total)
      })
      .catch((e: any) => {
        if (cancelled) return
        setError(e?.message || tr('加载失败', 'Failed to load'))
      })
      .finally(() => {
        if (cancelled) return
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [applied.action, applied.actorUsername, applied.entityId, applied.entityType, applied.from, applied.requestId, applied.to, page, tr])

  const pageCount = useMemo(() => Math.max(1, Math.ceil(total / PAGE_SIZE)), [total])
  const hasPrev = page > 0
  const hasNext = page + 1 < pageCount

  return (
    <PageShell
      title={<TitleWithIcon icon={<ListAltIcon />}>{tr('操作日志', 'Audit logs')}</TitleWithIcon>}
      actions={
        <Stack direction="row" spacing={1} alignItems="center">
          <Button
            size="small"
            variant="outlined"
            onClick={async () => {
              try {
                await exportAuditLogsCsv({
                  from: applied.from || undefined,
                  to: applied.to || undefined,
                  actorUsername: applied.actorUsername || undefined,
                  action: applied.action || undefined,
                  entityType: applied.entityType || undefined,
                  entityId: applied.entityId || undefined,
                  requestId: applied.requestId || undefined,
                })
              } catch (e: any) {
                setError(e?.message || tr('导出失败', 'Export failed'))
              }
            }}
            disabled={loading}
          >
            {tr('导出CSV', 'Export CSV')}
          </Button>
          <Button size="small" variant="outlined" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={!hasPrev || loading}>
            {tr('上一页', 'Prev')}
          </Button>
          <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 700 }}>
            {tr(`第 ${page + 1} / ${pageCount} 页`, `Page ${page + 1} / ${pageCount}`)}
          </Typography>
          <Button size="small" variant="outlined" onClick={() => setPage((p) => p + 1)} disabled={!hasNext || loading}>
            {tr('下一页', 'Next')}
          </Button>
        </Stack>
      }
    >
      {loading ? <LinearProgress sx={{ mb: 2 }} /> : null}
      {error ? (
        <AppCard sx={{ mb: 2 }}>
          <Typography color="error">{error}</Typography>
        </AppCard>
      ) : null}

      <AppCard title={tr('筛选', 'Filters')} sx={{ mb: 2 }}>
        <Stack spacing={1.25}>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={1}>
            <TextField
              size="small"
              label={tr('开始时间（ISO）', 'From (ISO)')}
              value={filterFrom}
              onChange={(e) => setFilterFrom(e.target.value)}
              fullWidth
            />
            <TextField
              size="small"
              label={tr('结束时间（ISO）', 'To (ISO)')}
              value={filterTo}
              onChange={(e) => setFilterTo(e.target.value)}
              fullWidth
            />
          </Stack>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={1}>
            <TextField
              size="small"
              label={tr('操作人（用户名）', 'Actor (username)')}
              value={filterActorUsername}
              onChange={(e) => setFilterActorUsername(e.target.value)}
              fullWidth
            />
            <TextField
              size="small"
              label={tr('动作', 'Action')}
              value={filterAction}
              onChange={(e) => setFilterAction(e.target.value)}
              fullWidth
            />
          </Stack>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={1}>
            <TextField
              size="small"
              label={tr('实体类型', 'Entity type')}
              value={filterEntityType}
              onChange={(e) => setFilterEntityType(e.target.value)}
              fullWidth
            />
            <TextField
              size="small"
              label={tr('实体ID', 'Entity ID')}
              value={filterEntityId}
              onChange={(e) => setFilterEntityId(e.target.value)}
              fullWidth
            />
            <TextField
              size="small"
              label={tr('Request ID', 'Request ID')}
              value={filterRequestId}
              onChange={(e) => setFilterRequestId(e.target.value)}
              fullWidth
            />
          </Stack>
          <Stack direction="row" spacing={1}>
            <Button
              size="small"
              variant="contained"
              disabled={loading}
              onClick={() => {
                setPage(0)
                setApplied({
                  from: filterFrom.trim(),
                  to: filterTo.trim(),
                  actorUsername: filterActorUsername.trim(),
                  action: filterAction.trim(),
                  entityType: filterEntityType.trim(),
                  entityId: filterEntityId.trim(),
                  requestId: filterRequestId.trim(),
                })
              }}
            >
              {tr('查询', 'Apply')}
            </Button>
            <Button
              size="small"
              variant="outlined"
              disabled={loading}
              onClick={() => {
                setFilterFrom('')
                setFilterTo('')
                setFilterActorUsername('')
                setFilterAction('')
                setFilterEntityType('')
                setFilterEntityId('')
                setFilterRequestId('')
                setPage(0)
                setApplied({ from: '', to: '', actorUsername: '', action: '', entityType: '', entityId: '', requestId: '' })
              }}
            >
              {tr('重置', 'Reset')}
            </Button>
          </Stack>
        </Stack>
      </AppCard>

      <AppCard title={tr(`最新记录（共 ${total} 条）`, `Latest logs (Total ${total})`)}>
        <TableContainer component={Box} sx={{ border: 'none', boxShadow: 'none', borderRadius: 0 }}>
          <Table size="small">
            <TableHead sx={{ backgroundColor: 'action.hover' }}>
              <TableRow>
                <TableCell sx={{ width: 40 }} />
                <TableCell sx={{ fontWeight: 700, width: 170 }}>{tr('时间', 'Time')}</TableCell>
                <TableCell sx={{ fontWeight: 700, width: 140 }}>{tr('操作人', 'Actor')}</TableCell>
                <TableCell sx={{ fontWeight: 700, width: 180 }}>{tr('动作', 'Action')}</TableCell>
                <TableCell sx={{ fontWeight: 700, width: 120 }}>{tr('实体', 'Entity')}</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>{tr('实体ID', 'Entity ID')}</TableCell>
                <TableCell sx={{ fontWeight: 700, width: 160 }}>{tr('Request ID', 'Request ID')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {items.length === 0 && !loading ? (
                <TableRow>
                  <TableCell colSpan={7} align="center">
                    <Typography color="text.secondary">{tr('暂无数据', 'No data')}</Typography>
                  </TableCell>
                </TableRow>
              ) : (
                items.map((it) => {
                  const open = expandedId === it.id
                  const changedKeys = diffTopLevelKeys(it.before, it.after)
                  return (
                    <React.Fragment key={it.id}>
                      <TableRow hover>
                        <TableCell>
                          <IconButton size="small" onClick={() => setExpandedId((prev) => (prev === it.id ? null : it.id))}>
                            {open ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
                          </IconButton>
                        </TableCell>
                        <TableCell>{formatDateTime(it.at)}</TableCell>
                        <TableCell>{it.actorUsername || it.actorUserId}</TableCell>
                        <TableCell>{it.action}</TableCell>
                        <TableCell>{it.entityType}</TableCell>
                        <TableCell sx={{ fontFamily: 'monospace' }}>{it.entityId}</TableCell>
                        <TableCell sx={{ fontFamily: 'monospace' }}>{it.requestId || '-'}</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell colSpan={7} sx={{ p: 0, border: 'none' }}>
                          <Collapse in={open} timeout="auto" unmountOnExit>
                            <Box sx={{ p: 1.5, pt: 0.75, display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 1.5 }}>
                              <Box sx={{ minWidth: 0 }}>
                                <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between" sx={{ mb: 0.5 }}>
                                  <Typography variant="subtitle2" sx={{ fontWeight: 850 }}>
                                    {tr('变更前', 'Before')}
                                  </Typography>
                                  <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
                                    {it.ip || '-'}
                                  </Typography>
                                </Stack>
                                <Typography variant="subtitle2" sx={{ fontWeight: 850, mb: 0.5 }}>
                                  {changedKeys.length ? tr(`变更字段：${changedKeys.join(', ')}`, `Changed: ${changedKeys.join(', ')}`) : tr('无字段变更', 'No field changes')}
                                </Typography>
                                <Box
                                  component="pre"
                                  sx={{
                                    m: 0,
                                    p: 1,
                                    borderRadius: 1.5,
                                    border: '1px solid',
                                    borderColor: 'divider',
                                    bgcolor: 'background.default',
                                    overflow: 'auto',
                                    fontSize: 12,
                                  }}
                                >
                                  {toPrettyJson(it.before)}
                                </Box>
                              </Box>
                              <Box sx={{ minWidth: 0 }}>
                                <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between" sx={{ mb: 0.5 }}>
                                  <Typography variant="subtitle2" sx={{ fontWeight: 850 }}>
                                    {tr('变更后', 'After')}
                                  </Typography>
                                  <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
                                    {it.requestId || '-'}
                                  </Typography>
                                </Stack>
                                <Box
                                  component="pre"
                                  sx={{
                                    m: 0,
                                    p: 1,
                                    borderRadius: 1.5,
                                    border: '1px solid',
                                    borderColor: 'divider',
                                    bgcolor: 'background.default',
                                    overflow: 'auto',
                                    fontSize: 12,
                                  }}
                                >
                                  {toPrettyJson(it.after)}
                                </Box>
                              </Box>
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

export default AuditLogPage
