import React from 'react'
import { Chip, type ChipProps } from '@mui/material'
import { useI18n } from '../i18n'
import type { AssetStatus, RepairStatus, UsageLog } from '../types'
import { getAssetStatusMeta, getRepairStatusMeta, getUsageLogStatusMeta } from '../utils/statusMeta'

type StatusChipProps =
  | ({ kind: 'asset'; status: AssetStatus } & Omit<ChipProps, 'label' | 'color'>)
  | ({ kind: 'usage'; status: UsageLog['status'] } & Omit<ChipProps, 'label' | 'color'>)
  | ({ kind: 'repair'; status: RepairStatus } & Omit<ChipProps, 'label' | 'color'>)

const StatusChip: React.FC<StatusChipProps> = ({ kind, status, size = 'small', ...rest }) => {
  const { tr } = useI18n()
  const meta =
    kind === 'asset'
      ? getAssetStatusMeta(status, tr)
      : kind === 'usage'
        ? getUsageLogStatusMeta(status, tr)
        : getRepairStatusMeta(status, tr)

  return <Chip size={size} label={meta.label} color={meta.color} {...rest} />
}

export default StatusChip
