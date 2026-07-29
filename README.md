# 筑想家：自建房智能方案生成 MVP

筑想家是一套面向自建房业主和设计人员的前期概念方案工具。项目以标准 DXF 场地文件为起点，逐步形成场地分析、户型需求、平面方案、建筑效果、三维简模和方案文档。

> 当前版本用于验证流程和技术路径，不提供施工图、结构安全计算或报建合规承诺。

## 当前进度

已完成两周计划中的 Day 1–2：

- Day 1：MVP 需求冻结、系统架构、接口草案、数据结构初稿及工具链验证。
- Day 2：登录与项目工作台、项目和版本 CRUD、D1 数据模型、R2 文件上传、持久化任务队列及 DXF 基础解析。

当前主链路：

```text
创建项目
  → 申请短效上传凭证
  → 上传标准 DXF
  → 解析图层、线段与多段线
  → 转换为统一毫米坐标
  → 建立后续场地确认和方案生成任务
```

## 已实现能力

### 用户端

- ChatGPT 登录入口与本地演示模式。
- 项目首页、项目列表和新建项目。
- 项目状态、当前阶段和更新时间展示。
- 响应式桌面与移动端界面。

### 数据与接口

- 用户、项目、项目版本、文件、上传会话和生成任务数据表。
- 项目及版本 CRUD API。
- 15 分钟短效上传凭证。
- R2 私有对象存储。
- 基于 D1 的持久化异步任务队列。
- 幂等任务键、任务领取和完成状态更新。

### DXF

- 支持 ASCII DXF。
- 支持 `LINE` 和 `LWPOLYLINE`。
- 读取实体图层及闭合状态。
- 识别 `$INSUNITS` 中的毫米和米。
- 坐标原点归一化，内部统一使用毫米。
- MVP 文件上限 50 MB。

## 技术架构

| 层级 | 技术 |
|---|---|
| Web 应用 | React 19、Next.js 16、Vinext、TypeScript |
| 样式 | Tailwind CSS 4、产品级响应式 CSS |
| 数据库 | Cloudflare D1、Drizzle ORM |
| 文件存储 | Cloudflare R2 |
| 后台任务 | D1 持久任务队列 |
| 运行环境 | Cloudflare Workers |
| 测试 | Node Test Runner、TSX、Python unittest |

## 本地运行

环境要求：

- Node.js 22.13 或更高版本
- pnpm
- Python 3.12（仅用于 Day 1 技术探针）

安装依赖：

```powershell
pnpm install
```

启动开发环境：

```powershell
pnpm dev
```

生产构建：

```powershell
pnpm build
```

运行测试：

```powershell
pnpm test
```

生成数据库迁移：

```powershell
pnpm db:generate
```

## API 概览

| 方法 | 路径 | 用途 |
|---|---|---|
| `GET/POST` | `/api/projects` | 查询和创建项目 |
| `GET/PATCH/DELETE` | `/api/projects/:id` | 项目详情、修改和归档 |
| `GET/POST` | `/api/projects/:id/versions` | 查询和创建项目版本 |
| `POST` | `/api/uploads/credentials` | 创建 DXF 上传凭证 |
| `PUT` | `/api/uploads/:token` | 上传文件到 R2 |
| `POST` | `/api/files/:id/parse` | 读取并解析 DXF |
| `GET/POST` | `/api/tasks` | 查询和创建异步任务 |
| `POST` | `/api/tasks/dispatch` | 领取下一个待处理任务 |
| `GET` | `/api/health` | 服务健康状态 |

接口草案见 [api/openapi.yaml](api/openapi.yaml)，Day 2 实现说明见 [docs/day-2/README.md](docs/day-2/README.md)。

## DXF 测试集

`tests/fixtures/dxf/` 包含：

- 8 份标准正向样本：矩形、长条形、梯形、L 形、五边形、角地和不规则地块。
- 2 份异常样本：未闭合边界和多地块边界。

运行 Day 1 技术探针：

```powershell
python tools/tech_spike.py
python -m unittest tests/test_tech_spike.py -v
```

验证产物位于 `output/tech-spike/`，包括 PNG 场地预览、OBJ 体块模型、PPTX、PDF 和 JSON 报告。

## 项目结构

```text
app/                  页面与 API 路由
db/                   D1 数据表和运行时访问
drizzle/              数据库迁移
lib/                  DXF、认证与任务队列
worker/               Cloudflare Worker 入口
tests/                Web、DXF 与技术探针测试
tests/fixtures/dxf/   DXF 测试文件
docs/day-1/           需求冻结与技术验证
docs/day-2/           项目骨架与数据模型
tools/                可重复运行的技术探针
output/tech-spike/    Day 1 验证产物
```

## 开发计划

下一阶段将继续实现：

1. DXF 上传进度、校验和失败重试。
2. 单一闭合地块识别及面积、周长、边长计算。
3. 场地 SVG/PNG 预览和可理解的错误提示。
4. 北向、道路、入口及边界人工确认。

完整范围见：

- [MVP 冻结说明](docs/day-1/MVP_FREEZE.md)
- [系统架构](docs/day-1/ARCHITECTURE.md)
- [技术验证结论](docs/day-1/TECH_VALIDATION.md)
- [数据结构初稿](docs/day-1/DATA_MODEL.md)

## 免责声明

筑想家生成的内容属于前期概念方案，不可直接作为施工、报建或结构安全依据。实际项目应委托具备相应资质的设计、勘察和施工单位完成专业深化与复核。
