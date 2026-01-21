export type ChangelogEntry = { hash: string; date: string; message: string }

export type BuildInfo = {
  version: string
  commit: string
  builtAt: string
  changelog: ChangelogEntry[]
}

export const buildInfo: BuildInfo = {
  version: '0.0.2',
  commit: '2636d9b',
  builtAt: '2026-01-21T10:07:45.665Z',
  changelog: JSON.parse(`[
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
