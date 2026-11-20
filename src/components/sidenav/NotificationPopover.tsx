import React from 'react'
import { Box, Button, Chip, List, ListItemButton, Popover, Typography, type PopoverOrigin } from '@mui/material'
import { alpha, useTheme } from '@mui/material/styles'
import { useI18n } from '../../i18n'
import type { DerivedAlert } from '../../store/alertsSelectors'
import { getLocalizedAlertContent } from '../../utils/alertsI18n'

export interface NotificationPopoverProps {
  open: boolean
  anchorEl: HTMLElement | null
  onClose: () => void
  unreadCount: number
  alertsCount: number
  latestAlerts: DerivedAlert[]
  readIds: Record<string, boolean>
  onMarkAllRead: () => void
  onOpenAlert: (alert: DerivedAlert) => void
  anchorOrigin: PopoverOrigin
}

const NotificationPopover: React.FC<NotificationPopoverProps> = ({
  open,
  anchorEl,
  onClose,
  unreadCount,
  alertsCount,
  latestAlerts,
  readIds,
  onMarkAllRead,
  onOpenAlert,
  anchorOrigin,
}) => {
  const theme = useTheme()
  const { tr } = useI18n()

  return (
    <Popover
      open={open}
      anchorEl={anchorEl}
      onClose={onClose}
      anchorOrigin={anchorOrigin}
      transformOrigin={{ vertical: 'top', horizontal: 'left' }}
      PaperProps={{ sx: { width: 360, maxWidth: '90vw', p: 1 } }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, px: 0.5, pb: 1 }}>
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ fontWeight: 900 }} noWrap>
            {tr('通知', 'Notifications')}
          </Typography>
          <Typography variant="caption" color="text.secondary" noWrap>
            {unreadCount > 0 ? tr(`未读 ${unreadCount} 条`, `${unreadCount} unread`) : tr('暂无未读', 'No unread')}
          </Typography>
        </Box>
        <Button
          size="small"
          variant="outlined"
          onClick={onMarkAllRead}
          disabled={alertsCount === 0 || unreadCount === 0}
        >
          {tr('全部已读', 'Mark all read')}
        </Button>
      </Box>

      {latestAlerts.length === 0 ? (
        <Box sx={{ px: 0.5, py: 1.5 }}>
          <Typography color="text.secondary">{tr('暂无通知', 'No notifications')}</Typography>
        </Box>
      ) : (
        <List sx={{ py: 0 }}>
          {latestAlerts.map((a) => {
            const isUnread = !readIds[a.id]
            const { title, detail } = getLocalizedAlertContent(a, tr)
            return (
              <ListItemButton
                key={a.id}
                onClick={() => onOpenAlert(a)}
                sx={{
                  borderRadius: 1.5,
                  mb: 0.5,
                  border: '1px solid',
                  borderColor: isUnread ? 'primary.main' : 'divider',
                  bgcolor: isUnread
                    ? alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.12 : 0.06)
                    : 'transparent',
                  alignItems: 'flex-start',
                  gap: 1,
                }}
              >
                <Chip size="small" label={a.severity} color={a.severity === 'P1' ? 'error' : 'warning'} />
                <Box sx={{ minWidth: 0 }}>
                  <Typography sx={{ fontWeight: isUnread ? 900 : 700 }} noWrap>
                    {title}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" noWrap>
                    {a.assetName}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }} noWrap>
                    {detail}
                  </Typography>
                </Box>
              </ListItemButton>
            )
          })}
        </List>
      )}
    </Popover>
  )
}

export default NotificationPopover
