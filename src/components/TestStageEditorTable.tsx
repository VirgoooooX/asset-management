import React from 'react'
import {
  Box,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material'
import DeleteIcon from '@mui/icons-material/Delete'
import { useI18n } from '../i18n'
import type { StageDraft } from '../utils/testProfile'

export interface TestStageEditorTableProps {
  stages: StageDraft[]
  canManage: boolean
  saving: boolean
  onUpdateStage: (id: string, patch: Partial<StageDraft>) => void
  onRemoveStage: (id: string) => void
}

const TestStageEditorTable: React.FC<TestStageEditorTableProps> = ({
  stages,
  canManage,
  saving,
  onUpdateStage,
  onRemoveStage,
}) => {
  const { tr } = useI18n()

  return (
    <Box sx={{ height: 440, overflow: 'auto' }}>
      <Table
        size="small"
        sx={{
          minWidth: 480,
          '& .MuiTableCell-root': { py: 0.4, px: 1.25, verticalAlign: 'middle' },
          '& .MuiTableCell-head': { py: 0.6 },
        }}
      >
        <TableHead sx={{ backgroundColor: 'action.hover' }}>
          <TableRow>
            <TableCell sx={{ fontWeight: 650, width: 72 }} align="center">
              {tr('阶段', 'Stage')}
            </TableCell>
            <TableCell sx={{ fontWeight: 650, width: 104 }} align="center">
              {tr('时长(min)', 'Minutes')}
            </TableCell>
            <TableCell sx={{ fontWeight: 650, width: 126 }} align="center">
              {tr('目标温度(°C)', 'Temp (°C)')}
            </TableCell>
            <TableCell sx={{ fontWeight: 650, width: 126 }} align="center">
              {tr('目标湿度(%)', 'Humidity (%)')}
            </TableCell>
            {canManage ? (
              <TableCell sx={{ fontWeight: 650, width: 64 }} align="center">
                {tr('操作', 'Actions')}
              </TableCell>
            ) : null}
          </TableRow>
        </TableHead>
        <TableBody>
          {stages.length === 0 ? (
            <TableRow>
              <TableCell colSpan={canManage ? 5 : 4} align="center">
                <Typography variant="body2" color="text.secondary">
                  {tr('暂无阶段（可新增）', 'No stages')}
                </Typography>
              </TableCell>
            </TableRow>
          ) : (
            stages.map((s, idx) => (
              <TableRow key={s.id} hover>
                <TableCell align="center">
                  <Box
                    sx={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: 26,
                      height: 26,
                      borderRadius: 99,
                      border: '1px solid',
                      borderColor: 'divider',
                      fontWeight: 800,
                      fontSize: 12,
                    }}
                  >
                    {idx + 1}
                  </Box>
                </TableCell>
                <TableCell align="center">
                  <TextField
                    value={s.durationMinutes}
                    onChange={(e) => onUpdateStage(s.id, { durationMinutes: e.target.value })}
                    size="small"
                    type="number"
                    fullWidth
                    inputProps={{ min: 0, step: 1, style: { textAlign: 'center' } }}
                    sx={{
                      minWidth: 92,
                      '& .MuiInputBase-root': { minHeight: 30 },
                      '& .MuiInputBase-input': { py: 0.55, textAlign: 'center' },
                    }}
                    disabled={!canManage || saving}
                  />
                </TableCell>
                <TableCell align="center">
                  <TextField
                    value={s.targetTemp}
                    onChange={(e) => onUpdateStage(s.id, { targetTemp: e.target.value })}
                    size="small"
                    type="number"
                    fullWidth
                    inputProps={{ style: { textAlign: 'center' } }}
                    sx={{
                      minWidth: 106,
                      '& .MuiInputBase-root': { minHeight: 30 },
                      '& .MuiInputBase-input': { py: 0.55, textAlign: 'center' },
                    }}
                    disabled={!canManage || saving}
                  />
                </TableCell>
                <TableCell align="center">
                  <TextField
                    value={s.targetHumidity}
                    onChange={(e) => onUpdateStage(s.id, { targetHumidity: e.target.value })}
                    size="small"
                    type="number"
                    fullWidth
                    inputProps={{ min: 0, max: 100, style: { textAlign: 'center' } }}
                    sx={{
                      minWidth: 106,
                      '& .MuiInputBase-root': { minHeight: 30 },
                      '& .MuiInputBase-input': { py: 0.55, textAlign: 'center' },
                    }}
                    disabled={!canManage || saving}
                  />
                </TableCell>
                {canManage ? (
                  <TableCell align="center">
                    <IconButton onClick={() => onRemoveStage(s.id)} size="small" color="error" disabled={saving} sx={{ p: 0.5 }}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                ) : null}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </Box>
  )
}

export default TestStageEditorTable
