# 系统架构与流程初稿

## 1. 业务流程

```mermaid
flowchart LR
  A["创建项目"] --> B["上传标准 DXF"]
  B --> C["解析与场地预览"]
  C --> D{"用户确认边界?"}
  D -- 否 --> E["人工修正/复核"]
  E --> D
  D -- 是 --> F["填写户型需求"]
  F --> G["规则校验与模板匹配"]
  G --> H["对比并确认平面"]
  H --> I["选择风格并生成效果图"]
  I --> J["确认造型"]
  J --> K["生成 GLB/OBJ 简模"]
  K --> L["生成 PPTX/PDF"]
  L --> M["下载与分享成果"]
```

## 2. 逻辑架构

```mermaid
flowchart TB
  subgraph Client["客户端"]
    MP["微信小程序"]
    WEB["Web 管理/专业端"]
  end
  subgraph Edge["接入层"]
    API["HTTP API / 鉴权 / 限流"]
    FILE["上传凭证与短效下载"]
  end
  subgraph Core["核心服务"]
    PROJECT["项目与版本服务"]
    SITE["CAD/场地服务"]
    PLAN["需求规则与平面服务"]
    ORCH["生成任务编排器"]
    DOC["文档服务"]
  end
  subgraph Workers["异步工作节点"]
    CAD["DXF 解析 Worker"]
    IMAGE["效果图 Adapter"]
    MODEL["三维生成 Worker"]
    PPT["PPT/PDF Worker"]
  end
  subgraph Data["数据层"]
    DB[("关系数据库")]
    OBJ[("对象存储")]
    QUEUE[("任务队列")]
    LOG[("日志/指标")]
  end
  MP --> API
  WEB --> API
  API --> PROJECT
  API --> SITE
  API --> PLAN
  API --> ORCH
  FILE --> OBJ
  PROJECT --> DB
  SITE --> DB
  PLAN --> DB
  ORCH --> QUEUE
  QUEUE --> CAD
  QUEUE --> IMAGE
  QUEUE --> MODEL
  QUEUE --> PPT
  CAD --> OBJ
  IMAGE --> OBJ
  MODEL --> OBJ
  PPT --> OBJ
  DOC --> DB
  Core --> LOG
  Workers --> LOG
```

## 3. 统一结构化模型

所有成果必须由同一项目版本树派生：

`Project -> SiteVersion -> RequirementVersion -> PlanVersion -> RenderVersion -> ModelVersion -> DocumentVersion`

每个下游版本保存直接上游版本 ID、生成参数哈希和状态。这样可以判断成果是否过期、追溯生成输入，并安全重试。

二维几何统一使用右手笛卡尔坐标和项目单位；入库时归一化为毫米。多边形使用逆时针外环、顺时针洞口。展示层再进行坐标平移、缩放和 Y 轴翻转。

## 4. 建议技术基线

- 客户端：微信小程序原生或 Taro；Web 使用 React + TypeScript。
- API：TypeScript/Node.js；REST 作为 MVP 边界，异步任务通过队列解耦。
- 数据：PostgreSQL；JSONB 保存演进中的空间/生成参数，对象存储保存 DXF、图片、模型和文档。
- DXF：生产候选采用 `ezdxf`；MVP 只接受约定实体与图层，解析后转换为内部 JSON。
- 二维预览：服务端 SVG/PNG，客户端 Canvas/SVG。
- 三维：结构化平面 -> GLB/OBJ；SKP 作为后续转换或插件能力。
- 文档：`python-pptx` 生成 PPTX，LibreOffice/服务转换 PDF；ReportLab 可生成降级 PDF。
- 任务：显式幂等键、指数退避、最大重试、死信队列、阶段性中间成果。

## 5. 部署单元

MVP 初期可使用模块化单体 API 加独立 Worker，避免过早微服务化：

1. `web`：小程序 API 与管理端。
2. `worker-cad`：DXF 解析、场地预览。
3. `worker-generation`：效果图供应商适配、三维和文档生成。
4. `postgres`、对象存储、队列。

接口与数据模型保持模块边界，后续可按负载拆分。

## 6. 关键安全约束

- 文件扩展名、MIME、文件头与大小联合校验；原文件私有存储。
- 下载使用短效签名 URL；项目级权限校验不可依赖前端。
- 用户素材默认不用于训练；删除项目进入可审计的异步清理。
- 生成日志不记录手机号、地址全文或原始文件内容。
- 概念方案免责声明在场地确认、成果预览和导出文档中可见。
