# 自建房智能方案生成小程序

本仓库用于实现两周可演示 MVP：

`DXF 场地分析 -> 户型需求 -> 平面方案 -> 效果图 -> 三维简模 -> PPT/PDF`

当前已完成 Day 1：需求冻结与技术验证。

## Day 1 交付

- [MVP 冻结说明](docs/day-1/MVP_FREEZE.md)
- [业务流程与系统架构](docs/day-1/ARCHITECTURE.md)
- [技术验证结论](docs/day-1/TECH_VALIDATION.md)
- [数据结构初稿](docs/day-1/DATA_MODEL.md)
- [OpenAPI 接口草案](api/openapi.yaml)
- `tests/fixtures/dxf/`：8 份标准 DXF 与 2 份异常输入
- `output/tech-spike/`：PNG、OBJ、PPTX、PDF 和验证报告

## 复现技术验证

```powershell
python tools/tech_spike.py
python -m unittest tests/test_tech_spike.py -v
```

技术探针只用于确认工具链和数据路径，不是生产级 CAD 解析器。

## 目录

```text
api/                  接口契约
docs/day-1/           Day 1 产品与技术交付
tests/fixtures/dxf/   DXF 测试集
tools/                可重复运行的技术探针
output/tech-spike/    技术验证产物
app/, worker/, db/    后续应用、任务与数据实现骨架
```

## 重要声明

系统输出是前期概念方案，不可直接用于施工、报建或结构安全判断。
