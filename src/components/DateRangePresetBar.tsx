import React from 'react'
import { Box, Chip, Grid, ToggleButton, ToggleButtonGroup } from '@mui/material'
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker'
import { useI18n } from '../i18n'
import type { RangePreset } from '../utils/dateRange'

export type { RangePreset }

export interface DateRangePresetBarProps {
  preset: RangePreset
  onPresetChange: (preset: RangePreset) => void
  variant?: 'toggle' | 'chips'
}

export const DateRangePresetBar: React.FC<DateRangePresetBarProps> = ({
  preset,
  onPresetChange,
  variant = 'toggle',
}) => {
  const { tr } = useI18n()

  const options: ReadonlyArray<{ id: RangePreset; label: string }> = [
    { id: '7d', label: tr('7天', '7d') },
    { id: '30d', label: tr('30天', '30d') },
    { id: '90d', label: tr('90天', '90d') },
    { id: 'custom', label: tr('自定义', 'Custom') },
  ]

  if (variant === 'chips') {
    return (
      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
        {options.map((p) => (
          <Chip
            key={p.id}
            label={p.label}
            clickable
            color={preset === p.id ? 'primary' : 'default'}
            variant={preset === p.id ? 'filled' : 'outlined'}
            onClick={() => onPresetChange(p.id)}
            sx={{ fontWeight: 750 }}
          />
        ))}
      </Box>
    )
  }

  return (
    <ToggleButtonGroup
      value={preset}
      exclusive
      size="small"
      onChange={(_, value: RangePreset | null) => {
        if (value) onPresetChange(value)
      }}
    >
      {options.map((p) => (
        <ToggleButton key={p.id} value={p.id}>
          {p.label}
        </ToggleButton>
      ))}
    </ToggleButtonGroup>
  )
}

export interface CustomDateRangePickersProps {
  start: Date | null
  end: Date | null
  onStartChange: (value: Date | null) => void
  onEndChange: (value: Date | null) => void
  textFieldSize?: 'small' | 'medium'
  smCols?: number
  mdCols?: number
}

export const CustomDateRangePickers: React.FC<CustomDateRangePickersProps> = ({
  start,
  end,
  onStartChange,
  onEndChange,
  textFieldSize = 'medium',
  smCols = 12,
  mdCols = 6,
}) => {
  const { tr } = useI18n()

  return (
    <Grid container spacing={2}>
      <Grid item xs={12} sm={smCols} md={mdCols}>
        <DateTimePicker
          label={tr('开始时间', 'Start time')}
          value={start}
          onChange={onStartChange}
          slotProps={{ textField: { fullWidth: true, size: textFieldSize } }}
        />
      </Grid>
      <Grid item xs={12} sm={smCols} md={mdCols}>
        <DateTimePicker
          label={tr('结束时间', 'End time')}
          value={end}
          onChange={onEndChange}
          slotProps={{ textField: { fullWidth: true, size: textFieldSize } }}
        />
      </Grid>
    </Grid>
  )
}

export default DateRangePresetBar
