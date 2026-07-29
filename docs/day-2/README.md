# Day 2 - 项目骨架与数据模型

## 已完成

- 登录页、项目工作台、项目列表和新建项目表单。
- D1 用户、项目、版本、文件、上传会话和生成任务数据表。
- 项目及版本 CRUD API。
- R2 短效上传凭证与文件写入接口。
- D1 持久化异步任务队列，支持幂等入队和任务领取。
- DXF `LINE`、`LWPOLYLINE`、图层及单位解析。
- 统一二维坐标模型：原点平移到 `(0,0)`，内部统一使用毫米。

## API

| 方法 | 路径 | 用途 |
|---|---|---|
| GET/POST | `/api/projects` | 项目列表、创建项目 |
| GET/PATCH/DELETE | `/api/projects/:id` | 项目详情、更新、归档 |
| GET/POST | `/api/projects/:id/versions` | 版本列表、创建版本 |
| POST | `/api/uploads/credentials` | 创建 15 分钟上传凭证 |
| PUT | `/api/uploads/:token` | 上传 DXF 到 R2 |
| POST | `/api/files/:id/parse` | 读取 R2 DXF 并生成统一二维模型 |
| GET/POST | `/api/tasks` | 查询和创建异步任务 |
| POST | `/api/tasks/dispatch` | 领取下一个待执行任务 |
| GET | `/api/health` | 基础服务状态 |

## DXF MVP 约束

- ASCII DXF。
- 支持 `LINE` 和 `LWPOLYLINE`。
- 读取 `$INSUNITS` 中的毫米与米。
- 文件最大 50 MB。
- 首期要求用户确认单位、目标边界、道路和入口。

## 数据一致性

项目创建时同步建立首个版本。文件、任务和后续版本均关联项目及用户；异步任务通过 `idempotency_key` 防止重复创建。
