export type ChangelogEntry = { hash: string; date: string; message: string }

export type BuildInfo = {
  version: string
  commit: string
  builtAt: string
  changelog: ChangelogEntry[]
}

export const buildInfo: BuildInfo = {
  version: '2.1.1',
  commit: '00c719d',
  builtAt: '2026-11-21T06:06:41.514Z',
  changelog: [
    {
      "hash": "00c719d",
      "date": "2026-11-21",
      "message": "fix: restore 2.0.0 dashboard and schedule"
    },
    {
      "hash": "597aa2d",
      "date": "2026-11-21",
      "message": "chore: release 2.1.0"
    },
    {
      "hash": "e2f7c3e",
      "date": "2026-11-21",
      "message": "feat: complete 12-point UI optimization upgrade"
    },
    {
      "hash": "74a07c8",
      "date": "2026-11-20",
      "message": "chore: release 2.0.0"
    },
    {
      "hash": "2041744",
      "date": "2026-11-20",
      "message": "refactor: complete 4-phase security, performance, architecture, and CI upgrades"
    },
    {
      "hash": "9c545dd",
      "date": "2026-07-17",
      "message": "Merge remote-tracking branch 'origin/main'"
    },
    {
      "hash": "b13dfae",
      "date": "2026-07-17",
      "message": "chore: release 0.2.0"
    },
    {
      "hash": "ce5f94d",
      "date": "2026-07-17",
      "message": "chore: release 0.1.19"
    },
    {
      "hash": "d5e7f0b",
      "date": "2026-07-17",
      "message": "docs: add vibe coding disclaimer"
    },
    {
      "hash": "d07f98b",
      "date": "2026-07-08",
      "message": "chore: release 0.1.18"
    },
    {
      "hash": "4178a21",
      "date": "2026-04-02",
      "message": "feat: implement backend service for chamber usage logs with cost snapshotting and validation"
    },
    {
      "hash": "53a0dc2",
      "date": "2026-03-20",
      "message": "build: 更新版本号至0.1.16并添加测试配置"
    },
    {
      "hash": "4ad9c8c",
      "date": "2026-03-20",
      "message": "build: 更新版本号至 0.1.15"
    },
    {
      "hash": "dbd779a",
      "date": "2026-03-20",
      "message": "build: 在 tsconfig.json 中排除测试文件"
    },
    {
      "hash": "8a6cbfb",
      "date": "2026-03-20",
      "message": "feat: Introduce a new backend project with its own TypeScript configuration and dependencies, and increment the root package version."
    },
    {
      "hash": "c20f621",
      "date": "2026-03-20",
      "message": "feat: Initialize backend project with dedicated package and TypeScript configurations."
    },
    {
      "hash": "409aa49",
      "date": "2026-03-20",
      "message": "feat: Add new ScrollingTimeline component with its styles."
    },
    {
      "hash": "058c316",
      "date": "2026-02-12",
      "message": "feat: Introduce a new backend service with dedicated package and TypeScript configurations."
    },
    {
      "hash": "25cf090",
      "date": "2026-02-12",
      "message": "chore: 更新版本号至0.1.10"
    },
    {
      "hash": "1c7a46b",
      "date": "2026-02-12",
      "message": "feat: 实现报表、通知与审计功能并升级至版本0.1.9"
    },
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
    }
  ],
}
