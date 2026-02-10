import React, { useEffect, useMemo } from 'react'
import { Box, Chip, LinearProgress, Stack, Typography } from '@mui/material'
import InsightsIcon from '@mui/icons-material/Insights'
import PageShell from '../components/PageShell'
import TitleWithIcon from '../components/TitleWithIcon'
import AppCard from '../components/AppCard'
import { useI18n } from '../i18n'
import { useAppDispatch, useAppSelector } from '../store/hooks'
import { fetchAssetsByType } from '../store/assetsSlice'
import type { Asset } from '../types'

type Range = { min: number; max: number }
type Summary = {
  category: string
  total: number
  definedCount: number
  tempRange: Range | null
  humidityRange: Range | null
  rampMax: number | null
  volumeMax: number | null
}

const mergeRange = (prev: Range | null, next: Range | null): Range | null => {
  if (!next) return prev
  if (!prev) return next
  return { min: Math.min(prev.min, next.min), max: Math.max(prev.max, next.max) }
}

const toRange = (min?: number, max?: number): Range | null => {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return null
  return { min: min as number, max: max as number }
}

const CapabilitiesSummaryPage: React.FC = () => {
  const dispatch = useAppDispatch()
  const { tr, language } = useI18n()
  const { assets, loading, error } = useAppSelector((s) => s.assets)

  useEffect(() => {
    dispatch(fetchAssetsByType({ type: 'chamber' }))
  }, [dispatch])

  const grouped = useMemo(() => {
    const locale = language === 'en' ? 'en' : 'zh-Hans-CN'
    const map = new Map<string, Asset[]>()
    assets.forEach((a) => {
      const key = a.category?.trim() || tr('未分类', 'Uncategorized')
      const list = map.get(key) ?? []
      list.push(a)
      map.set(key, list)
    })
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0], locale))
  }, [assets, language, tr])

  const summaries = useMemo<Summary[]>(() => {
    return grouped.map(([category, list]) => {
      let tempRange: Range | null = null
      let humidityRange: Range | null = null
      let rampMax: number | null = null
      let volumeMax: number | null = null
      let definedCount = 0

      list.forEach((a) => {
        const c = a.capabilities
        if (!c) return
        const hasAny = Object.values(c).some((v) => v !== undefined && v !== '')
        if (!hasAny) return
        definedCount += 1
        tempRange = mergeRange(tempRange, toRange(c.tempMin, c.tempMax))
        humidityRange = mergeRange(humidityRange, toRange(c.humidityMin, c.humidityMax))
        if (Number.isFinite(c.rampRateCPerMin)) rampMax = rampMax === null ? c.rampRateCPerMin! : Math.max(rampMax, c.rampRateCPerMin!)
        if (Number.isFinite(c.volumeLiters)) volumeMax = volumeMax === null ? c.volumeLiters! : Math.max(volumeMax, c.volumeLiters!)
      })

      return {
        category,
        total: list.length,
        definedCount,
        tempRange,
        humidityRange,
        rampMax,
        volumeMax,
      }
    })
  }, [grouped])

  return (
    <PageShell
      title={<TitleWithIcon icon={<InsightsIcon />}>{tr('设备能力汇总', 'Capabilities summary')}</TitleWithIcon>}
    >
      {loading ? (
        <LinearProgress />
      ) : error ? (
        <Typography color="error">{error}</Typography>
      ) : summaries.length === 0 ? (
        <Typography color="text.secondary">{tr('暂无设备', 'No assets')}</Typography>
      ) : (
        <Stack spacing={2}>
          {summaries.map((s) => (
            <AppCard key={s.category} title={s.category}>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                <Chip label={tr(`设备数：${s.total}`, `Total: ${s.total}`)} sx={{ fontWeight: 650 }} />
                <Chip
                  label={tr(`已填写参数：${s.definedCount}`, `With specs: ${s.definedCount}`)}
                  variant="outlined"
                  sx={{ fontWeight: 650 }}
                />
                <Chip
                  label={
                    s.tempRange
                      ? tr(`温度范围：${s.tempRange.min}~${s.tempRange.max}°C`, `Temp: ${s.tempRange.min}~${s.tempRange.max}°C`)
                      : tr('温度范围：-', 'Temp: -')
                  }
                  variant="outlined"
                />
                <Chip
                  label={
                    s.humidityRange
                      ? tr(`湿度范围：${s.humidityRange.min}~${s.humidityRange.max}%`, `Humidity: ${s.humidityRange.min}~${s.humidityRange.max}%`)
                      : tr('湿度范围：-', 'Humidity: -')
                  }
                  variant="outlined"
                />
                <Chip
                  label={
                    s.rampMax !== null
                      ? tr(`最大升降温：${s.rampMax}°C/min`, `Max ramp: ${s.rampMax}°C/min`)
                      : tr('最大升降温：-', 'Max ramp: -')
                  }
                  variant="outlined"
                />
                <Chip
                  label={
                    s.volumeMax !== null
                      ? tr(`最大容积：${s.volumeMax}L`, `Max volume: ${s.volumeMax}L`)
                      : tr('最大容积：-', 'Max volume: -')
                  }
                  variant="outlined"
                />
              </Box>
            </AppCard>
          ))}
        </Stack>
      )}
    </PageShell>
  )
}

export default CapabilitiesSummaryPage
