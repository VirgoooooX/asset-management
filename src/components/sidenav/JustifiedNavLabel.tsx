import React from 'react'
import { Box } from '@mui/material'

export interface JustifiedNavLabelProps {
  label: string
  maxJustifyChars?: number
}

const JustifiedNavLabel: React.FC<JustifiedNavLabelProps> = ({ label, maxJustifyChars = 2 }) => {
  const chars = Array.from(label)
  const isHanOnly = /^[\u4e00-\u9fff]+$/.test(label)
  const shouldJustify = isHanOnly && chars.length > 1 && chars.length <= maxJustifyChars

  if (!shouldJustify) return <>{label}</>

  return (
    <Box
      component="span"
      sx={{
        display: 'inline-flex',
        width: `${maxJustifyChars}em`,
        justifyContent: 'space-between',
      }}
    >
      {chars.map((ch, idx) => (
        <Box component="span" key={`${ch}-${idx}`}>
          {ch}
        </Box>
      ))}
    </Box>
  )
}

export default JustifiedNavLabel
