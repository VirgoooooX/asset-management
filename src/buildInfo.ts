export type ChangelogEntry = { hash: string; date: string; message: string }

export type BuildInfo = {
  version: string
  commit: string
  builtAt: string
  changelog: ChangelogEntry[]
}

export const buildInfo: BuildInfo = {
  version: '0.1.9',
  commit: 'bb5b35a',
  builtAt: '2026-02-12T11:59:13.074Z',
  changelog: JSON.parse(`[
  {
    "hash": "bb5b35a",
    "date": "2026-02-11",
    "message": "Merge branch 'main' of https://github.com/VirgoooooX/asset-management"
  },
  {
    "hash": "641cdf9",
    "date": "2026-02-11",
    "message": "docs: 将截图占位符替换为实际的Markdown图片链接"
  },
  {
    "hash": "776c7a9",
    "date": "2026-02-11",
    "message": "Update README.md"
  },
  {
    "hash": "5d1db11",
    "date": "2026-02-11",
    "message": "docs: 添加仪表盘和时间线预览图片"
  },
  {
    "hash": "7197da8",
    "date": "2026-02-10",
    "message": "docs: 更新 README 并增强 Docker 工作流"
  },
  {
    "hash": "3e6d068",
    "date": "2026-02-10",
    "message": "chore: 更新项目版本至0.1.8并调整发布配置"
  },
  {
    "hash": "8208e72",
    "date": "2026-02-10",
    "message": "chore: 重构发布脚本并添加Docker CI工作流"
  },
  {
    "hash": "9b59880",
    "date": "2026-02-10",
    "message": "feat: 扩展设备能力参数并优化仪表板分组功能"
  },
  {
    "hash": "2b04d50",
    "date": "2026-01-31",
    "message": "feat: 扩展实时事件系统并优化仪表板UI"
  },
  {
    "hash": "dc62da7",
    "date": "2026-01-29",
    "message": "chore: 更新版本号至0.1.3并修正导航标签文本"
  },
  {
    "hash": "0b6dec0",
    "date": "2026-01-26",
    "message": "fix: 处理未来时间日志的时钟偏移并同步资产状态"
  },
  {
    "hash": "b9a9dfe",
    "date": "2026-01-26",
    "message": "refactor(ui): 统一页面布局并改进时间轴组件"
  },
  {
    "hash": "1b09bad",
    "date": "2026-01-25",
    "message": "Merge branch 'main' of https://github.com/VirgoooooX/asset-management"
  },
  {
    "hash": "6d67dd3",
    "date": "2026-01-25",
    "message": "feat(timeline): 优化时间轴记录条布局、间距及样式，修复 CSS 警告"
  },
  {
    "hash": "4b85bce",
    "date": "2026-01-25",
    "message": "style(ScrollingTimeline): 移除未使用的CSS类并简化样式"
  },
  {
    "hash": "7e4456a",
    "date": "2026-01-25",
    "message": "feat(timeline): 优化时间轴项目条样式并增加配置项显示"
  },
  {
    "hash": "db01084",
    "date": "2026-01-25",
    "message": "feat: 优化滚动条布局、时间线配置删除和仪表盘卡片信息"
  },
  {
    "hash": "a519523",
    "date": "2026-01-24",
    "message": "chore: 更新版本至0.1.2并修复release脚本参数"
  },
  {
    "hash": "0f5fa4f",
    "date": "2026-01-23",
    "message": "feat(维修工单): 支持附件上传并新增校验管理页面"
  },
  {
    "hash": "909608a",
    "date": "2026-01-23",
    "message": "feat: 添加资产状态实时更新和测试基础设施"
  },
  {
    "hash": "5136efc",
    "date": "2026-01-22",
    "message": "feat(数据加载): 优化数据加载逻辑并添加防抖机制"
  },
  {
    "hash": "f0fa49f",
    "date": "2026-01-22",
    "message": "feat(用户管理): 增强用户管理功能并更新版本号至0.0.5"
  },
  {
    "hash": "cbd14d2",
    "date": "2026-01-22",
    "message": "feat(布局): 重构应用布局并添加新的侧边栏导航组件"
  },
  {
    "hash": "ff6b6b3",
    "date": "2026-01-21",
    "message": "feat(release): 支持多架构镜像构建并更新版本号至0.0.4"
  },
  {
    "hash": "f573263",
    "date": "2026-01-21",
    "message": "feat: 添加版本发布脚本并更新版本号至0.0.3"
  },
  {
    "hash": "2636d9b",
    "date": "2026-01-21",
    "message": "feat: 添加用户管理功能与角色权限系统"
  },
  {
    "hash": "921bc6b",
    "date": "2026-01-21",
    "message": "first commit"
  }
]`) as ChangelogEntry[],
}
