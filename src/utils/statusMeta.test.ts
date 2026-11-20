import { describe, expect, it } from 'vitest'
import { getAssetStatusMeta, getRepairStatusMeta, getUsageLogStatusMeta } from './statusMeta'

const trZh = (zh: string, _en: string) => zh
const trEn = (_zh: string, en: string) => en

describe('statusMeta', () => {
  it('maps asset statuses in zh and en with unknown fallback', () => {
    expect(getAssetStatusMeta('available', trZh)).toEqual({ label: '可用', color: 'success', tone: 'success' })
    expect(getAssetStatusMeta('in-use', trEn)).toEqual({ label: 'In use', color: 'warning', tone: 'warning' })
    expect(getAssetStatusMeta('maintenance', trEn)).toEqual({ label: 'Maintenance', color: 'error', tone: 'error' })
    expect(getAssetStatusMeta('custom-state', trEn)).toEqual({ label: 'custom-state', color: 'default', tone: 'default' })
  })

  it('maps usage log statuses in zh and en with unknown fallback', () => {
    expect(getUsageLogStatusMeta('completed', trEn)).toEqual({ label: 'Completed', color: 'success', tone: 'success' })
    expect(getUsageLogStatusMeta('in-progress', trZh)).toEqual({ label: '进行中', color: 'warning', tone: 'warning' })
    expect(getUsageLogStatusMeta('not-started', trEn)).toEqual({ label: 'Not started', color: 'primary', tone: 'info' })
    expect(getUsageLogStatusMeta('overdue', trEn)).toEqual({ label: 'Overdue', color: 'error', tone: 'error' })
    expect(getUsageLogStatusMeta('other', trZh)).toEqual({ label: '未知', color: 'default', tone: 'default' })
  })

  it('maps repair ticket statuses in zh and en with unknown fallback', () => {
    expect(getRepairStatusMeta('quote-pending', trEn)).toEqual({ label: 'Quote pending', color: 'warning', tone: 'warning' })
    expect(getRepairStatusMeta('repair-pending', trZh)).toEqual({ label: '待维修', color: 'info', tone: 'info' })
    expect(getRepairStatusMeta('completed', trEn)).toEqual({ label: 'Completed', color: 'success', tone: 'success' })
    expect(getRepairStatusMeta('archived', trEn)).toEqual({ label: 'archived', color: 'default', tone: 'default' })
  })
})
