# 演示项目与操作说明

## 推荐演示项目

- 项目名：南村 18×24m 自建房演示
- 场地文件：`tests/fixtures/dxf/09_legacy_rectangular_site.dxf`
- 场地：432.0㎡，周长 84.0m，南侧 6.0m 道路，南侧 4.0m 入口，北向 0°。
- 户型需求：2 层、4 间卧室、3 个卫生间、1 部楼梯、老人房位于首层，总建筑面积 180–240㎡。
- 优先级：采光、动静分区、适老。
- 建筑风格：新中式；米白真石漆 + 暖色木饰面；双坡屋顶。
- 效果图视角：主入口、鸟瞰、庭院。

## 8 分钟演示流程

1. 登录并创建“南村 18×24m 自建房演示”。
2. 上传演示 DXF，展示进度、单位自动识别和场地解析。
3. 核对面积、周长、逐边尺寸、道路、入口和北向。
4. 确认场地并提交结构化户型需求。
5. 从成熟 DXF 模板库生成 2–3 套候选，说明场地硬约束先于评分。
6. 对比面积、房间数量、满足度、住宅优点与不足，锁定方案。
7. 选择建筑风格并生成三个预置视角，确认最终图。
8. 从项目列表预览或下载 14 章方案 HTML。

## 异常演示

- 上传 `invalid_open_boundary.dxf`：展示“边界未闭合”。
- 上传 `invalid_multiple_boundaries.dxf`：展示“多个疑似地块”。
- 上传 `16_ambiguous_invalid_geometry.dxf`：展示人工复核提示和下游阻断。
- 模拟效果图超时：展示安全重试且不覆盖锁定平面版本。

## 模板初始化

资源库目录 `resources/house-templates/` 已初始化 HT-T001～HT-T015。每套模板必须具备：

- `source/*.dxf`
- `normalized/*.dxf`
- `data/template.json`
- `data/validation-report.json`
- `data/approval-record.json`
- `preview/*.png`

上线前确认 `resources/house-templates/catalog.json` 中仅包含审核通过模板，并确保模板 ID、版本和文件路径可追溯。
