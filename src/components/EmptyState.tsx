import React from 'react'
import { Box, Typography } from '@mui/material'
import { alpha, useTheme } from '@mui/material/styles'
import InboxOutlinedIcon from '@mui/icons-material/InboxOutlined'

export interface EmptyStateProps {
  icon?: React.ReactNode
  title: string
  description?: string
  action?: React.ReactNode
  compact?: boolean
}

const EmptyState: React.FC<EmptyStateProps> = ({ icon, title, description, action, compact = false }) => {
  const theme = useTheme()

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        py: compact ? 3 : 5,
        px: 2,
        gap: 1,
      }}
    >
      <Box
        sx={{
          width: compact ? 40 : 48,
          height: compact ? 40 : 48,
          borderRadius: '50%',
          display: 'grid',
          placeItems: 'center',
          bgcolor: alpha(theme.palette.text.primary, theme.palette.mode === 'dark' ? 0.08 : 0.05),
          color: 'text.secondary',
          mb: 0.5,
        }}
      >
        {icon ?? <InboxOutlinedIcon fontSize={compact ? 'small' : 'medium'} />}
      </Box>
      <Typography variant={compact ? 'body2' : 'subtitle1'} sx={{ fontWeight: 600 }}>
        {title}
      </Typography>
      {description ? (
        <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 420 }}>
          {description}
        </Typography>
      ) : null}
      {action ? <Box sx={{ mt: 1 }}>{action}</Box> : null}
    </Box>
  )
}

export default EmptyState
