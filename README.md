# 筑想家：自建房智能方案生成 MVP

筑想家是一套面向自建房业主和设计人员的前期概念方案工具。项目以标准 DXF 场地文件为起点，逐步形成场地分析、户型需求、平面方案、建筑效果、三维简模和方案文档。

> 当前版本用于验证流程和技术路径，不提供施工图、结构安全计算或报建合规承诺。

## 当前进度

已完成两周计划中的 Day 1–4：

- Day 1：MVP 需求冻结、系统架构、接口草案、数据结构初稿及工具链验证。
- Day 2：登录与项目工作台、项目和版本 CRUD、D1 数据模型、R2 文件上传、持久化任务队列及 DXF 基础解析。
- Day 3：DXF 上传进度与失败重试、单位及场地信息采集、闭合地块识别、面积/周长/边长计算，以及 SVG/PNG 预览。
- Day 4：场地边界、北向、入口和临路确认，结构化户型需求，以及面积、房间、老人房、卧卫和楼梯基础校验。

当前主链路：

```text
创建项目
  → 选择单位并填写场地信息
  → 申请短效上传凭证
  → 显示进度并上传标准 ASCII DXF
  → 校验文件类型、大小、结构和比例
  → 识别唯一闭合场地边界
  → 转换为统一毫米坐标
  → 查看轮廓、面积、周长、主尺寸和逐边长度
  → 确认边界、北向、入口和临路方向
  → 填写户型规模、房间面积与需求优先级
  → 通过基础规则校验并保存确认版本
```

## 已实现能力

### 用户端

- ChatGPT 登录入口与本地演示模式。
- 项目首页、项目列表和新建项目。
- 项目状态、当前阶段和更新时间展示。
- DXF 文件选择、上传进度和失败重试；多面临路时以最宽道路作为表单中的主要道路宽度。
- 单位、道路方向、道路宽度及场地备注采集。
- 场地 SVG 预览、PNG 下载及面积、周长和尺寸展示。
- 场地边界、北向、入口和多面临路确认。
- 户型层数、家庭人数、面积范围、卧卫楼梯及老人房表单。
- 房间最小面积和最多三项需求优先级。
- 可理解的面积超限、老人房楼层及数量配比校验提示。
- 响应式桌面与移动端界面。

### 数据与接口

- 用户、项目、项目版本、文件、上传会话和生成任务数据表。
- 项目及版本 CRUD API。
- 场地确认和户型需求合并提交 API，保存为可追溯的确认版本。
- 15 分钟短效上传凭证。
- R2 私有对象存储。
- 基于 D1 的持久化异步任务队列。
- 幂等任务键、任务领取和完成状态更新。

### DXF

- 支持 ASCII DXF。
- 支持 `LINE`、`LWPOLYLINE` 和旧式 `POLYLINE/VERTEX/SEQEND`。
- 读取实体图层及闭合状态，优先识别 `SITE_BOUNDARY` 图层。
- 默认自动读取 `$INSUNITS` 中的毫米、厘米和米；文件未声明单位时要求用户确认，也允许用户显式覆盖并重新计算。
- 校验文件类型、文件大小、二进制或损坏内容、坐标范围及比例。
- 拒绝无闭合边界或存在多个闭合地块的文件，并返回可理解的中文原因。
- 坐标原点归一化，内部统一使用毫米。
- 计算面积、周长、整体总长/总宽、逐边长度及各边角度，保留梯形和斜边的原始几何；页面与场地图中的米、平方米数值统一显示一位小数。
- 识别闭合 `BUILDABLE_AREA` 建筑控制线，计算控制线以内的可建设面积与周长，并在预览中以虚线叠加显示。
- 从 `ROAD`、`ENTRANCE`、`NORTH` 图层识别临路方向、道路宽度、入口方向与宽度，以及北向角度。
- 北向按图纸正上方为 0°显示顺时针角度；自动化用例以 ±2° 作为识别精度容差，不把合法的旋转北向标记为错误。
- 服务端生成包含地块轮廓、道路带、入口缺口、北向箭头和尺寸线的 SVG 场地图；L 型及凹凸地块逐边标注真实长度，多面临路分别显示方向和宽度，道路、入口与尺寸标签自动避让，客户端支持下载一致的 PNG。
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
| `GET/POST` | `/api/projects/:id/requirements` | 读取或提交场地确认与户型需求 |
| `POST` | `/api/uploads/credentials` | 创建 DXF 上传凭证 |
| `PUT` | `/api/uploads/:token` | 上传文件到 R2 |
| `POST` | `/api/files/:id/parse` | 读取并解析 DXF |
| `GET/POST` | `/api/tasks` | 查询和创建异步任务 |
| `POST` | `/api/tasks/dispatch` | 领取下一个待处理任务 |
| `GET` | `/api/health` | 服务健康状态 |

接口草案见 [api/openapi.yaml](api/openapi.yaml)，Day 2 实现说明见 [docs/day-2/README.md](docs/day-2/README.md)。Day 3 的上传和场地解析由现有上传、文件解析接口串联完成。

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

Day 3–4 已通过 DXF、需求规则、页面结构和生产构建测试。测试覆盖新旧多段线、DXF-01 规则矩形、道路/入口/北向语义、未闭合边界、多闭合边界、面积超限、最小房间面积、老人房首层、卧卫和楼梯数量等场景。

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

下一阶段（Day 5）将继续实现：

1. 根据场地和结构化户型需求生成候选平面方案。
2. 输出房间轮廓、面积、门窗和交通关系。
3. 展示方案差异、规则命中与可调整参数。
4. 保存候选方案版本并进入人工选择。

完整范围见：

- [MVP 冻结说明](docs/day-1/MVP_FREEZE.md)
- [系统架构](docs/day-1/ARCHITECTURE.md)
- [技术验证结论](docs/day-1/TECH_VALIDATION.md)
- [数据结构初稿](docs/day-1/DATA_MODEL.md)

## 免责声明

筑想家生成的内容属于前期概念方案，不可直接作为施工、报建或结构安全依据。实际项目应委托具备相应资质的设计、勘察和施工单位完成专业深化与复核。
