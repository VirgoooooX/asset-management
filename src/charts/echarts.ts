import * as echarts from 'echarts/core'
import { LineChart, CustomChart } from 'echarts/charts'
import {
  GridComponent,
  TooltipComponent,
  LegendComponent,
  TitleComponent,
  MarkAreaComponent,
} from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'

echarts.use([LineChart, CustomChart, GridComponent, TooltipComponent, LegendComponent, TitleComponent, MarkAreaComponent, CanvasRenderer])

export type { EChartsOption } from 'echarts'
export { echarts }

