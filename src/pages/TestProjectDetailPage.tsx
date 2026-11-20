import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import SaveIcon from '@mui/icons-material/Save'
import AddIcon from '@mui/icons-material/Add'
import PlaylistAddCheckIcon from '@mui/icons-material/PlaylistAddCheck'
import PageShell from '../components/PageShell'
import TitleWithIcon from '../components/TitleWithIcon'
import AppCard from '../components/AppCard'
import TestStageEditorTable from '../components/TestStageEditorTable'
import { useI18n } from '../i18n'
import { useNavigate, useParams } from 'react-router-dom'
import * as testProjectService from '../services/testProjectService'
import type { TestProject } from '../types'
import { useAppDispatch, useAppSelector } from '../store/hooks'
import { updateTestProject } from '../store/testProjectsSlice'
import TestProfileChart from '../components/TestProfileChart'
import { buildProfileSteps, buildStages, type StageDraft } from '../utils/testProfile'

const TestProjectDetailPage: React.FC = () => {
  const dispatch = useAppDispatch()
  const { tr } = useI18n()
  const navigate = useNavigate()
  const { testProjectId } = useParams()
  const role = useAppSelector((s) => s.auth.user?.role)
  const canManage = role === 'admin' || role === 'manager'

  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [tp, setTp] = useState<TestProject | null>(null)

  const [procedure, setProcedure] = useState('')
  const [stages, setStages] = useState<StageDraft[]>([])

  const load = useCallback(async () => {
    if (!testProjectId) return
    setLoading(true)
    setError(null)
    setSaveError(null)
    try {
      const item = await testProjectService.getTestProjectById(testProjectId)
      if (!item) {
        setTp(null)
        setError(tr('测试项目不存在', 'Test project not found'))
        return
      }
      setTp(item)
      setProcedure(item.procedure || '')
      const loadedStages = Array.isArray(item.stages) ? item.stages : []
      setStages(
        loadedStages.map((s, idx) => ({
          id: `${Date.now()}-${idx}`,
          durationMinutes: s.durationMinutes !== undefined ? String(s.durationMinutes) : '',
          targetTemp:
            (s.targetTemp ?? (s as any).endTemp ?? (s as any).startTemp) !== undefined
              ? String(s.targetTemp ?? (s as any).endTemp ?? (s as any).startTemp)
              : '',
          targetHumidity:
            (s.targetHumidity ?? (s as any).endHumidity ?? (s as any).startHumidity) !== undefined
              ? String(s.targetHumidity ?? (s as any).endHumidity ?? (s as any).startHumidity)
              : '',
        }))
      )
    } catch (e: any) {
      setError(e?.message || 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [testProjectId, tr])

  useEffect(() => {
    load()
  }, [load])

  const stageModels = useMemo(() => buildStages(stages), [stages])
  const profileDefaults = useMemo(() => ({ temp: 25, humidity: 50 }), [])
  const profileSteps = useMemo(() => buildProfileSteps(stageModels, profileDefaults), [profileDefaults, stageModels])

  const handleAddStage = useCallback(() => {
    setStages((prev) =>
      prev.concat([
        {
          id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
          durationMinutes: '60',
          targetTemp: '',
          targetHumidity: '',
        },
      ])
    )
  }, [])

  const handleUpdateStage = useCallback((id: string, patch: Partial<StageDraft>) => {
    setStages((prev) => prev.map((x) => (x.id === id ? { ...x, ...patch } : x)))
  }, [])

  const handleRemoveStage = useCallback((id: string) => {
    setStages((prev) => prev.filter((s) => s.id !== id))
  }, [])

  const handleSave = useCallback(async () => {
    if (!tp) return
    if (!canManage) return
    setSaving(true)
    setSaveError(null)
    try {
      const normalizedStages = buildStages(stages)
      const updated = await dispatch(
        updateTestProject({
          id: tp.id,
          testProject: {
            procedure: procedure.trim() || undefined,
            stages: normalizedStages.length > 0 ? normalizedStages : undefined,
          },
        })
      ).unwrap()
      setTp(updated)
      setProcedure(updated.procedure || '')
    } catch (e: any) {
      setSaveError(e?.message || tr('保存失败', 'Save failed'))
    } finally {
      setSaving(false)
    }
  }, [canManage, dispatch, procedure, stages, tp, tr])

  return (
    <PageShell
      title={<TitleWithIcon icon={<PlaylistAddCheckIcon />}>{tr('测试项目详情', 'Test project')}</TitleWithIcon>}
      actions={
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
          <Button size="small" variant="outlined" startIcon={<ArrowBackIcon />} onClick={() => navigate(-1)}>
            {tr('返回', 'Back')}
          </Button>
          {canManage ? (
            <Button size="small" variant="contained" startIcon={<SaveIcon />} onClick={handleSave} disabled={saving || loading || !tp}>
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
      ) : !tp ? (
        <Alert severity="error">{tr('测试项目不存在', 'Not found')}</Alert>
      ) : (
        <Stack spacing={1.75}>
          {saveError ? <Alert severity="error">{saveError}</Alert> : null}

          <AppCard title={tr('基础信息', 'Overview')} sx={{ p: 2 }}>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1.15fr) minmax(0, 0.85fr)' },
                gap: 2,
                alignItems: 'start',
              }}
            >
              <Box>
                <Typography sx={{ fontWeight: 900, lineHeight: 1.2 }}>{tp.name}</Typography>
                <Box sx={{ mt: 0.75, display: 'flex', flexWrap: 'wrap', gap: 1.25 }}>
                  <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1.5, px: 1.25, py: 0.75 }}>
                    <Typography variant="caption" color="text.secondary">
                      {tr('温度', 'Temperature')}
                    </Typography>
                    <Typography sx={{ fontWeight: 800, lineHeight: 1.1 }}>{tp.temperature}°C</Typography>
                  </Box>
                  <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1.5, px: 1.25, py: 0.75 }}>
                    <Typography variant="caption" color="text.secondary">
                      {tr('湿度', 'Humidity')}
                    </Typography>
                    <Typography sx={{ fontWeight: 800, lineHeight: 1.1 }}>{tp.humidity}%</Typography>
                  </Box>
                  <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1.5, px: 1.25, py: 0.75 }}>
                    <Typography variant="caption" color="text.secondary">
                      {tr('时长', 'Duration')}
                    </Typography>
                    <Typography sx={{ fontWeight: 800, lineHeight: 1.1 }}>{tp.duration} h</Typography>
                  </Box>
                </Box>
              </Box>

              <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1.5, p: 1.25 }}>
                <Typography variant="caption" color="text.secondary">
                  {tr('适用设备类型', 'Asset categories')}
                </Typography>
                <Typography sx={{ mt: 0.25, fontWeight: 700, lineHeight: 1.35 }}>
                  {tp.assetCategories && tp.assetCategories.length > 0 ? tp.assetCategories.join(' · ') : tr('全部', 'All')}
                </Typography>
              </Box>
            </Box>
          </AppCard>

          <AppCard title={tr('测试流程说明', 'Procedure')} sx={{ p: 2 }}>
            <TextField
              value={procedure}
              onChange={(e) => setProcedure(e.target.value)}
              fullWidth
              multiline
              minRows={6}
              size="small"
              placeholder={tr('输入测试流程说明（支持纯文本/Markdown）', 'Describe the procedure (plain text/markdown).')}
              disabled={!canManage || saving}
            />
          </AppCard>

          <AppCard
            title={tr('阶段参数与流程曲线', 'Stages & Curve')}
            sx={{ p: 2 }}
            actions={
              canManage ? (
                <Button size="small" variant="outlined" startIcon={<AddIcon />} onClick={handleAddStage} disabled={saving}>
                  {tr('新增阶段', 'Add stage')}
                </Button>
              ) : undefined
            }
          >
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 0.4fr) minmax(0, 0.6fr)' },
                gap: 1.75,
                alignItems: 'stretch',
              }}
            >
              <TestStageEditorTable
                stages={stages}
                canManage={canManage}
                saving={saving}
                onUpdateStage={handleUpdateStage}
                onRemoveStage={handleRemoveStage}
              />

              <Box
                sx={{
                  pl: { xs: 0, lg: 2 },
                  borderLeft: { xs: 'none', lg: '1px solid' },
                  borderColor: { xs: 'transparent', lg: 'divider' },
                  height: 440,
                  display: 'flex',
                  alignItems: 'stretch',
                }}
              >
                {stageModels.length === 0 ? (
                  <Typography color="text.secondary">{tr('填写阶段参数后将自动生成曲线', 'Add stages to generate a curve.')}</Typography>
                ) : (
                  <TestProfileChart
                    steps={profileSteps}
                    defaults={profileDefaults}
                    title={tr('测试曲线', 'Test profile')}
                    rampText={tr('升降', 'ramp')}
                    dwellText={tr('稳态', 'dwell')}
                    temperatureText={tr('温度', 'Temperature')}
                    humidityText={tr('湿度', 'Humidity')}
                    timeText={tr('时间', 'Time')}
                    minuteText={tr('分钟', 'min')}
                    hourText={tr('小时', 'hour')}
                  />
                )}
              </Box>
            </Box>
          </AppCard>
        </Stack>
      )}
    </PageShell>
  )
}

export default TestProjectDetailPage
