import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Grid,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import SpeedIcon from '@mui/icons-material/Speed'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import PageShell from '../components/PageShell'
import TitleWithIcon from '../components/TitleWithIcon'
import AppCard from '../components/AppCard'
import { useI18n } from '../i18n'
import { useNavigate, useParams } from 'react-router-dom'
import * as assetService from '../services/assetService'
import type { AssetCapabilities } from '../types'
import { useAppSelector } from '../store/hooks'

const AssetPerformancePage: React.FC = () => {
  const { tr } = useI18n()
  const navigate = useNavigate()
  const { assetId } = useParams()
  const role = useAppSelector((s) => s.auth.user?.role)
  const canManage = role === 'admin' || role === 'manager'

  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [assetName, setAssetName] = useState<string>('')

  const [tempMin, setTempMin] = useState<string>('')
  const [tempMax, setTempMax] = useState<string>('')
  const [humidityMin, setHumidityMin] = useState<string>('')
  const [humidityMax, setHumidityMax] = useState<string>('')
  const [rampRate, setRampRate] = useState<string>('')
  const [volume, setVolume] = useState<string>('')
  const [tempStability, setTempStability] = useState<string>('')
  const [humidityStability, setHumidityStability] = useState<string>('')
  const [notes, setNotes] = useState<string>('')

  const load = useCallback(async () => {
    if (!assetId) return
    setLoading(true)
    setError(null)
    try {
      const a = await assetService.getAssetById(assetId)
      if (!a) {
        setError(tr('设备不存在', 'Asset not found'))
        return
      }
      setAssetName(a.name)
      const c = a.capabilities || {}
      setTempMin(c.tempMin !== undefined ? String(c.tempMin) : '')
      setTempMax(c.tempMax !== undefined ? String(c.tempMax) : '')
      setHumidityMin(c.humidityMin !== undefined ? String(c.humidityMin) : '')
      setHumidityMax(c.humidityMax !== undefined ? String(c.humidityMax) : '')
      setRampRate(c.rampRateCPerMin !== undefined ? String(c.rampRateCPerMin) : '')
      setVolume(c.volumeLiters !== undefined ? String(c.volumeLiters) : '')
      setTempStability(c.tempStability !== undefined ? String(c.tempStability) : '')
      setHumidityStability(c.humidityStability !== undefined ? String(c.humidityStability) : '')
      setNotes(c.notes || '')
    } catch (e: any) {
      setError(e?.message || tr('加载失败', 'Failed to load'))
    } finally {
      setLoading(false)
    }
  }, [assetId, tr])

  useEffect(() => {
    load()
  }, [load])

  const buildCapabilities = useCallback((): AssetCapabilities | null => {
    const toNum = (v: string) => {
      const n = Number(v)
      return Number.isFinite(n) ? n : undefined
    }
    const next: AssetCapabilities = {
      tempMin: tempMin.trim() ? toNum(tempMin) : undefined,
      tempMax: tempMax.trim() ? toNum(tempMax) : undefined,
      humidityMin: humidityMin.trim() ? toNum(humidityMin) : undefined,
      humidityMax: humidityMax.trim() ? toNum(humidityMax) : undefined,
      rampRateCPerMin: rampRate.trim() ? toNum(rampRate) : undefined,
      volumeLiters: volume.trim() ? toNum(volume) : undefined,
      tempStability: tempStability.trim() ? toNum(tempStability) : undefined,
      humidityStability: humidityStability.trim() ? toNum(humidityStability) : undefined,
      notes: notes.trim() || undefined,
    }
    const hasAny = Object.values(next).some((v) => v !== undefined && v !== '')
    return hasAny ? next : null
  }, [humidityMax, humidityMin, humidityStability, notes, rampRate, tempMax, tempMin, tempStability, volume])

  const handleSave = useCallback(async () => {
    if (!assetId) return
    if (!canManage) return
    setSaving(true)
    setError(null)
    try {
      const capabilities = buildCapabilities()
      await assetService.updateAsset(assetId, { capabilities })
      await load()
    } catch (e: any) {
      setError(e?.message || tr('保存失败', 'Save failed'))
    } finally {
      setSaving(false)
    }
  }, [assetId, buildCapabilities, canManage, load, tr])

  const titleText = useMemo(() => {
    if (!assetName) return tr('设备参数性能', 'Performance')
    return tr(`${assetName} 参数性能`, `${assetName} performance`)
  }, [assetName, tr])

  return (
    <PageShell
      title={<TitleWithIcon icon={<SpeedIcon />}>{titleText}</TitleWithIcon>}
      actions={
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
          <Button size="small" variant="outlined" startIcon={<ArrowBackIcon />} onClick={() => navigate(-1)}>
            {tr('返回', 'Back')}
          </Button>
          {canManage ? (
            <Button size="small" variant="contained" onClick={handleSave} disabled={saving || loading || !assetId}>
              {tr('保存', 'Save')}
            </Button>
          ) : null}
        </Stack>
      }
    >
      {loading ? (
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', p: 3 }}>
          <CircularProgress size={22} />
          <Typography sx={{ ml: 2 }}>{tr('正在加载...', 'Loading...')}</Typography>
        </Box>
      ) : error ? (
        <Alert severity="error">{error}</Alert>
      ) : (
        <AppCard title={tr('能力参数', 'Capabilities')}>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <TextField
                label={tr('温度下限 (°C)', 'Temp min (°C)')}
                type="number"
                value={tempMin}
                onChange={(e) => setTempMin(e.target.value)}
                fullWidth
                size="small"
                disabled={!canManage || saving}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label={tr('温度上限 (°C)', 'Temp max (°C)')}
                type="number"
                value={tempMax}
                onChange={(e) => setTempMax(e.target.value)}
                fullWidth
                size="small"
                disabled={!canManage || saving}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label={tr('湿度下限 (%)', 'Humidity min (%)')}
                type="number"
                value={humidityMin}
                onChange={(e) => setHumidityMin(e.target.value)}
                fullWidth
                size="small"
                disabled={!canManage || saving}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label={tr('湿度上限 (%)', 'Humidity max (%)')}
                type="number"
                value={humidityMax}
                onChange={(e) => setHumidityMax(e.target.value)}
                fullWidth
                size="small"
                disabled={!canManage || saving}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label={tr('升降温速率 (°C/min)', 'Ramp rate (°C/min)')}
                type="number"
                value={rampRate}
                onChange={(e) => setRampRate(e.target.value)}
                fullWidth
                size="small"
                disabled={!canManage || saving}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label={tr('容积 (L)', 'Volume (L)')}
                type="number"
                value={volume}
                onChange={(e) => setVolume(e.target.value)}
                fullWidth
                size="small"
                disabled={!canManage || saving}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label={tr('温度波动度 (±°C)', 'Temp stability (±°C)')}
                type="number"
                value={tempStability}
                onChange={(e) => setTempStability(e.target.value)}
                fullWidth
                size="small"
                disabled={!canManage || saving}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label={tr('湿度波动度 (±%)', 'Humidity stability (±%)')}
                type="number"
                value={humidityStability}
                onChange={(e) => setHumidityStability(e.target.value)}
                fullWidth
                size="small"
                disabled={!canManage || saving}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                label={tr('备注/限制', 'Notes')}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                fullWidth
                size="small"
                multiline
                minRows={3}
                disabled={!canManage || saving}
              />
            </Grid>
          </Grid>
        </AppCard>
      )}
    </PageShell>
  )
}

export default AssetPerformancePage
