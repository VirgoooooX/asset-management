import React from 'react'
import { Box } from '@mui/material'

type Props = {
  icon: React.ReactElement
  children: React.ReactNode
  gap?: number
}

const TitleWithIcon: React.FC<Props> = ({ icon, children, gap = 1 }) => {
  return (
    <Box
      component="span"
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap,
        lineHeight: 'inherit',
        verticalAlign: 'baseline',
      }}
    >
      {React.cloneElement(icon, {
        fontSize: 'inherit',
        style: {
          ...(icon.props.style || {}),
          fontSize: '1.12em',
          display: 'block',
          transform: 'translateY(1px)',
        },
      })}
      <Box component="span" sx={{ lineHeight: 'inherit' }}>
        {children}
      </Box>
    </Box>
  )
}

export default TitleWithIcon
