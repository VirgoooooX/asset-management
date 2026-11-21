import React from 'react'
import { Box, Grid, LinearProgress, Stack, Typography } from '@mui/material'
import { alpha, useTheme } from '@mui/material/styles'
import ListAltIcon from '@mui/icons-material/ListAlt'
import AppCard from '../../components/AppCard'
import TitleWithIcon from '../../components/TitleWithIcon'
import StatusChip from '../../components/StatusChip'
import type { UsageLog } from '../../types'
import { getEffectiveUsageLogStatus } from '../../utils/statusHelpers'
import { formatDateTime } from '../../utils/formatters'
import { useI18n } from '../../i18n'

interface AssetUsageTabProps {
  loading: boolean
  usageLogs: UsageLog[]
  projectNameById: Map<string, string>
  testProjectNameById: Map<string, string>
  onSelectLog: (logId: string) => void
}

const AssetUsageTab: React.FC<AssetUsageTabProps> = ({
  loading,
  usageLogs,
  projectNameById,
  testProjectNameById,
  onSelectLog,
}) => {
  const theme = useTheme()
  const { tr } = useI18n()

  return (
    <Grid container spacing={2}>
      <Grid item xs={12}>
        <AppCard title={<TitleWithIcon icon={<ListAltIcon />}>{tr('使用记录', 'Usage logs')}</TitleWithIcon>}>
          {loading ? (
            <LinearProgress />
          ) : usageLogs.length === 0 ? (
            <Typography color="text.secondary">{tr('暂无使用记录', 'No usage logs')}</Typography>
          ) : (
            <Stack spacing={1.25}>
              {usageLogs.slice(0, 12).map((log) => {
                const effectiveStatus = getEffectiveUsageLogStatus(log)
                const projectName = log.projectId ? projectNameById.get(log.projectId) : undefined
                const testProjectName = log.testProjectId ? testProjectNameById.get(log.testProjectId) : undefined

                return (
                  <Box
                    key={log.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => onSelectLog(log.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        onSelectLog(log.id)
                      }
                    }}
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
                      '&:focus-visible': {
                        outline: `2px solid ${theme.palette.primary.main}`,
                        outlineOffset: 2,
                      },
                    }}
                  >
                    <Box sx={{ minWidth: 0 }}>
                      <Typography sx={{ fontWeight: 700 }} noWrap>
                        {projectName ?? testProjectName ?? tr('未关联项目', 'Unlinked')}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" noWrap>
                        {formatDateTime(log.startTime)} → {formatDateTime(log.endTime)}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" noWrap>
                        {tr('使用人：', 'User: ')}
                        {log.user || '-'}
                      </Typography>
                    </Box>
                    <StatusChip kind="usage" status={effectiveStatus} />
                  </Box>
                )
              })}
            </Stack>
          )}
        </AppCard>
      </Grid>
    </Grid>
  )
}

export default AssetUsageTab
