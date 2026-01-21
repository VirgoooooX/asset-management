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
        lineHeight: 1,
        verticalAlign: 'middle',
      }}
    >
      {React.cloneElement(icon, { fontSize: 'inherit', style: { fontSize: '1em' } })}
      <Box component="span" sx={{ lineHeight: 1 }}>
        {children}
      </Box>
    </Box>
  )
}

export default TitleWithIcon

