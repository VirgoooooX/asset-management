import React from 'react'
import { useNavigate } from 'react-router-dom'
import { Box, Button, Grid, LinearProgress, Stack, Typography } from '@mui/material'
import { alpha } from '@mui/material/styles'
import BuildCircleIcon from '@mui/icons-material/BuildCircle'
import AppCard from '../../components/AppCard'
import TitleWithIcon from '../../components/TitleWithIcon'
import StatusChip from '../../components/StatusChip'
import type { RepairTicket } from '../../types'
import { formatDateTime } from '../../utils/formatters'
import { useI18n } from '../../i18n'

interface AssetRepairsTabProps {
  loading: boolean
  canManage: boolean
  tickets: RepairTicket[]
}

const AssetRepairsTab: React.FC<AssetRepairsTabProps> = ({ loading, canManage, tickets }) => {
  const navigate = useNavigate()
  const { tr } = useI18n()

  return (
    <Grid container spacing={2}>
      <Grid item xs={12}>
        <AppCard
          title={<TitleWithIcon icon={<BuildCircleIcon />}>{tr('维修记录', 'Repairs')}</TitleWithIcon>}
          actions={
            <Button size="small" variant="outlined" onClick={() => navigate('/repairs')} sx={{ whiteSpace: 'nowrap' }}>
              {tr('打开维修管理', 'Open repairs')}
            </Button>
          }
        >
          {loading ? (
            <LinearProgress />
          ) : tickets.length === 0 ? (
            <Typography color="text.secondary">{tr('暂无维修记录', 'No repair tickets')}</Typography>
          ) : (
            <Stack spacing={1.25}>
              {tickets.slice(0, 12).map((t) => (
                <Box
                  key={t.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => navigate(`/repairs/${encodeURIComponent(t.id)}`)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      navigate(`/repairs/${encodeURIComponent(t.id)}`)
                    }
                  }}
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
                    cursor: 'pointer',
                    transition: 'background-color 150ms ease, border-color 150ms ease',
                    '&:hover': {
                      backgroundColor: (theme) => alpha(theme.palette.background.paper, theme.palette.mode === 'dark' ? 0.45 : 0.75),
                      borderColor: (theme) => alpha(theme.palette.primary.main, 0.25),
                    },
                    '&:focus-visible': {
                      outline: (theme) => `2px solid ${theme.palette.primary.main}`,
                      outlineOffset: 2,
                    },
                  }}
                >
                  <Box sx={{ minWidth: 0 }}>
                    <Typography sx={{ fontWeight: 700 }} noWrap>
                      {t.problemDesc || tr('维修工单', 'Repair ticket')}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" noWrap>
                      {tr('更新时间：', 'Updated: ')}
                      {formatDateTime(t.updatedAt ?? t.createdAt)}
                    </Typography>
                    {canManage && (t.vendorName || t.quoteAmount !== undefined) ? (
                      <Typography variant="body2" color="text.secondary" noWrap>
                        {t.vendorName ? `${tr('供应商', 'Vendor')}: ${t.vendorName}` : tr('供应商: -', 'Vendor: -')}
                        {' · '}
                        {t.quoteAmount !== undefined ? `${tr('报价', 'Quote')}: ${t.quoteAmount}` : tr('报价: -', 'Quote: -')}
                      </Typography>
                    ) : null}
                  </Box>
                  <StatusChip kind="repair" status={t.status} />
                </Box>
              ))}
            </Stack>
          )}
        </AppCard>
      </Grid>
    </Grid>
  )
}

export default AssetRepairsTab
