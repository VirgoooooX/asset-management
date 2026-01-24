export type ChangelogEntry = { hash: string; date: string; message: string }

export type BuildInfo = {
  version: string
  commit: string
  builtAt: string
  changelog: ChangelogEntry[]
}

export const buildInfo: BuildInfo = {
  version: '0.1.1',
  commit: '0f5fa4f',
  builtAt: '2026-01-24T12:13:55.176Z',
  changelog: JSON.parse(`[
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
