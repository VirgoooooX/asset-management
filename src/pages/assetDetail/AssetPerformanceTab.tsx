import React, { useEffect, useState } from 'react'
import { Alert, Box, Button, Divider, Grid, IconButton, Stack, TextField, Typography } from '@mui/material'
import DeleteIcon from '@mui/icons-material/Delete'
import AppCard from '../../components/AppCard'
import { useAppDispatch } from '../../store/hooks'
import { updateAsset } from '../../store/assetsSlice'
import type { Asset } from '../../types'
import { useI18n } from '../../i18n'

interface AssetPerformanceTabProps {
  asset?: Asset
  assetId?: string
  isAdmin: boolean
}

const AssetPerformanceTab: React.FC<AssetPerformanceTabProps> = ({ asset, assetId, isAdmin }) => {
  const dispatch = useAppDispatch()
  const { tr } = useI18n()

  const [capTempMin, setCapTempMin] = useState('')
  const [capTempMax, setCapTempMax] = useState('')
  const [capHumidityMin, setCapHumidityMin] = useState('')
  const [capHumidityMax, setCapHumidityMax] = useState('')
  const [capRampRate, setCapRampRate] = useState('')
  const [capVolume, setCapVolume] = useState('')
  const [capTempStability, setCapTempStability] = useState('')
  const [capHumidityStability, setCapHumidityStability] = useState('')
  const [capNotes, setCapNotes] = useState('')
  const [capCustomParams, setCapCustomParams] = useState<Array<{ id: string; name: string; value?: string; unit?: string }>>([])
  const [capSaving, setCapSaving] = useState(false)
  const [capSaveError, setCapSaveError] = useState<string | null>(null)

  useEffect(() => {
    if (!asset) return
    const c = asset.capabilities || {}
    const toStr = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? String(v) : '')
    setCapTempMin(toStr(c.tempMin))
    setCapTempMax(toStr(c.tempMax))
    setCapHumidityMin(toStr(c.humidityMin))
    setCapHumidityMax(toStr(c.humidityMax))
    setCapRampRate(toStr(c.rampRateCPerMin))
    setCapVolume(toStr(c.volumeLiters))
    setCapTempStability(toStr(c.tempStability))
    setCapHumidityStability(toStr(c.humidityStability))
    setCapNotes(typeof c.notes === 'string' ? c.notes : '')
    const list = Array.isArray(c.customParams) ? c.customParams : []
    setCapCustomParams(
      list
        .filter((p) => p && typeof p.name === 'string' && typeof p.id === 'string')
        .map((p) => ({
          id: p.id,
          name: p.name,
          value: typeof p.value === 'string' ? p.value : '',
          unit: typeof p.unit === 'string' ? p.unit : '',
        }))
    )
    setCapSaveError(null)
  }, [asset])

  const handleAddCustomParam = () => {
    const id =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`
    setCapCustomParams((prev) => prev.concat([{ id, name: '', value: '', unit: '' }]))
  }

  const handleSaveCapabilities = async () => {
    if (!assetId || !isAdmin) return
    setCapSaving(true)
    setCapSaveError(null)
    try {
      const toNum = (v: string) => {
        const n = Number(v)
        return Number.isFinite(n) ? n : undefined
      }
      const base = asset?.capabilities || {}
      const next = {
        ...base,
        tempMin: capTempMin.trim() ? toNum(capTempMin) : undefined,
        tempMax: capTempMax.trim() ? toNum(capTempMax) : undefined,
        humidityMin: capHumidityMin.trim() ? toNum(capHumidityMin) : undefined,
        humidityMax: capHumidityMax.trim() ? toNum(capHumidityMax) : undefined,
        rampRateCPerMin: capRampRate.trim() ? toNum(capRampRate) : undefined,
        volumeLiters: capVolume.trim() ? toNum(capVolume) : undefined,
        tempStability: capTempStability.trim() ? toNum(capTempStability) : undefined,
        humidityStability: capHumidityStability.trim() ? toNum(capHumidityStability) : undefined,
        notes: capNotes.trim() || undefined,
        customParams: capCustomParams
          .map((p) => ({
            id: p.id,
            name: p.name.trim(),
            value: p.value?.trim() || undefined,
            unit: p.unit?.trim() || undefined,
          }))
          .filter((p) => p.name.length > 0),
      }
      await dispatch(updateAsset({ id: assetId, changes: { capabilities: next } })).unwrap()
    } catch (e: any) {
      setCapSaveError(e?.message || tr('保存失败', 'Save failed'))
    } finally {
      setCapSaving(false)
    }
  }

  return (
    <Grid container spacing={2}>
      <Grid item xs={12}>
        <AppCard
          title={tr('性能参数', 'Performance')}
          actions={
            isAdmin ? (
              <Button size="small" variant="contained" onClick={handleSaveCapabilities} disabled={capSaving || !assetId}>
                {tr('保存', 'Save')}
              </Button>
            ) : undefined
          }
        >
          {capSaveError ? <Alert severity="error" sx={{ mb: 2 }}>{capSaveError}</Alert> : null}
          {!asset ? (
            <Typography color="text.secondary">{tr('暂无数据', 'No data')}</Typography>
          ) : (
            <Stack spacing={2}>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6} md={3}>
                  <TextField label={tr('温度下限 (°C)', 'Temp min (°C)')} size="small" fullWidth value={capTempMin} onChange={(e) => setCapTempMin(e.target.value)} disabled={!isAdmin || capSaving} />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <TextField label={tr('温度上限 (°C)', 'Temp max (°C)')} size="small" fullWidth value={capTempMax} onChange={(e) => setCapTempMax(e.target.value)} disabled={!isAdmin || capSaving} />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <TextField label={tr('湿度下限 (%)', 'Humidity min (%)')} size="small" fullWidth value={capHumidityMin} onChange={(e) => setCapHumidityMin(e.target.value)} disabled={!isAdmin || capSaving} />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <TextField label={tr('湿度上限 (%)', 'Humidity max (%)')} size="small" fullWidth value={capHumidityMax} onChange={(e) => setCapHumidityMax(e.target.value)} disabled={!isAdmin || capSaving} />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <TextField label={tr('升降温速率 (°C/min)', 'Ramp (°C/min)')} size="small" fullWidth value={capRampRate} onChange={(e) => setCapRampRate(e.target.value)} disabled={!isAdmin || capSaving} />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <TextField label={tr('容积 (L)', 'Volume (L)')} size="small" fullWidth value={capVolume} onChange={(e) => setCapVolume(e.target.value)} disabled={!isAdmin || capSaving} />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <TextField label={tr('温度波动度 (±°C)', 'Temp stability (±°C)')} size="small" fullWidth value={capTempStability} onChange={(e) => setCapTempStability(e.target.value)} disabled={!isAdmin || capSaving} />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <TextField label={tr('湿度波动度 (±%)', 'Humidity stability (±%)')} size="small" fullWidth value={capHumidityStability} onChange={(e) => setCapHumidityStability(e.target.value)} disabled={!isAdmin || capSaving} />
                </Grid>
                <Grid item xs={12}>
                  <TextField label={tr('备注/限制', 'Notes')} size="small" fullWidth multiline minRows={3} value={capNotes} onChange={(e) => setCapNotes(e.target.value)} disabled={!isAdmin || capSaving} />
                </Grid>
              </Grid>

              <Divider />

              <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
                <Typography sx={{ fontWeight: 900 }}>{tr('自定义参数', 'Custom params')}</Typography>
                {isAdmin ? (
                  <Button size="small" variant="outlined" onClick={handleAddCustomParam} disabled={capSaving}>
                    {tr('新增参数', 'Add')}
                  </Button>
                ) : null}
              </Stack>

              {capCustomParams.length === 0 ? (
                <Typography color="text.secondary">{tr('暂无自定义参数', 'No custom params')}</Typography>
              ) : (
                <Stack spacing={1.25}>
                  {capCustomParams.map((p) => (
                    <Box key={p.id} sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '220px 1fr 140px 44px' }, gap: 1, alignItems: 'center' }}>
                      <TextField label={tr('名称', 'Name')} size="small" value={p.name} onChange={(e) => setCapCustomParams((prev) => prev.map((x) => (x.id === p.id ? { ...x, name: e.target.value } : x)))} disabled={!isAdmin || capSaving} />
                      <TextField label={tr('值', 'Value')} size="small" value={p.value ?? ''} onChange={(e) => setCapCustomParams((prev) => prev.map((x) => (x.id === p.id ? { ...x, value: e.target.value } : x)))} disabled={!isAdmin || capSaving} />
                      <TextField label={tr('单位', 'Unit')} size="small" value={p.unit ?? ''} onChange={(e) => setCapCustomParams((prev) => prev.map((x) => (x.id === p.id ? { ...x, unit: e.target.value } : x)))} disabled={!isAdmin || capSaving} />
                      {isAdmin ? (
                        <IconButton size="small" color="error" onClick={() => setCapCustomParams((prev) => prev.filter((x) => x.id !== p.id))} disabled={capSaving}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      ) : (
                        <span />
                      )}
                    </Box>
                  ))}
                </Stack>
              )}
            </Stack>
          )}
        </AppCard>
      </Grid>
    </Grid>
  )
}

export default AssetPerformanceTab
