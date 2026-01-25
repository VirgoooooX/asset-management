# 设备资产管理平台（Chamber Tracker）

这是一个前后端一体的设备资产管理平台：前端基于 React + TypeScript + Vite，后端基于 Express，默认使用 SQLite 持久化，并将上传文件落盘到本地数据目录。前端通过 Redux Toolkit 进行状态管理，并支持导出使用记录为 Excel。

## 核心功能

- 设备列表：设备信息维护、状态（可用/使用中/维护中）、校准日期管理（管理员）
- 使用记录：登记/编辑/完成/删除、详情查看、导出 Excel
- 时间线：按设备展示占用条形图，支持从时间线发起新建/查看/删除某配置维度记录
- 异常监控：校准到期提醒、逾期使用、长占用告警（阈值可配置）
- 维修管理：工单创建、状态流转（询价/待维修/完成），并联动资产状态（管理员）
- 设置：主题/密度/主色，Dashboard 默认时间窗，异常阈值，自动刷新，数据迁移
- 数据迁移：旧 `chambers` 集合一键迁移到新 `assets` 集合（管理员）

## 技术栈

- 前端：React 18 + TypeScript
- 构建：Vite 5
- UI：Material UI（@mui/material + @mui/icons-material + @mui/x-date-pickers）
- 状态管理：Redux Toolkit + react-redux
- 数据：自部署后端 API + SQLite
- 导出：xlsx（使用记录导出）

## 本地开发

### 安装依赖

```bash
npm install
```

### 启动开发环境

```bash
npm run dev
```

### 类型检查 / 构建 / 测试

```bash
npm run typecheck
npm run build
npm run test
```

## 配置说明

- 自部署与环境变量说明见 [self-hosting.md](file:///l:/Web/Chamber%20tracker/docs/self-hosting.md)。

## 项目结构（简要）

- `src/pages/`：各业务页面（Dashboard、Timeline、Alerts、UsageLogs、Chambers、Repairs、Settings…）
- `src/components/`：可复用组件（表单、列表、时间线渲染、导航中心等）
- `src/store/`：Redux slices、selectors（KPI/告警派生）、store 配置
- `src/services/`：对后端 API 的读写封装、对账等服务
- `src/utils/`：状态判定、导出等工具函数

## 前端布局规则（避免“页面左右抖动”）

项目的滚动区域不在 `html/body`，而是在 Layout 的主内容容器内（右侧内容区）。为了保证“有滚动条的页面”和“无滚动条的页面”在同一视口宽度下内容起始位置一致，需要遵循：

- 统一由 Layout 控制纵向滚动：主内容容器使用 `.app-scroll`（不要在页面级再造一个全页滚动容器）
  - 参考：[Layout.tsx](file:///l:/Web/Chamber%20tracker/src/components/Layout.tsx)
- 为滚动容器预留稳定的滚动条槽位：`.app-scroll` 使用 `scrollbar-gutter: stable`，并提供 `overflow-y: scroll` 的兼容性回退
  - 参考：[index.css](file:///l:/Web/Chamber%20tracker/src/index.css)

## 重要业务口径（避免“状态不同步”）

项目中“使用记录是否占用设备”的判定统一复用：
- `isUsageLogOccupyingAsset`：[statusHelpers.ts](file:///l:/Web/Chamber%20tracker/src/utils/statusHelpers.ts)

并在拉取使用记录后自动对账回填资产状态：
- `reconcileAssetStatusesFromUsageLogs`：[assetStatusReconcileService.ts](file:///l:/Web/Chamber%20tracker/src/services/assetStatusReconcileService.ts)
