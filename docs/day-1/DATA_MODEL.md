# 数据结构初稿

## 1. 核心实体

| 实体 | 关键字段 |
|---|---|
| User | id, mobileHash, wechatOpenId, role, status, createdAt |
| Project | id, ownerId, name, address, status, currentVersionId, archivedAt |
| ProjectVersion | id, projectId, sequence, parentId, stage, status, createdBy |
| FileAsset | id, projectId, versionId, kind, objectKey, mime, size, sha256 |
| SiteVersion | id, projectVersionId, unit, boundary, areaMm2, perimeterMm, northAngle, roads, entrances, risks |
| RequirementVersion | id, projectVersionId, floors, targetAreaMm2, residents, rooms, relations, priorities, validation |
| PlanVersion | id, projectVersionId, requirementVersionId, geometry, metrics, scores, validation, selected |
| RenderVersion | id, projectVersionId, planVersionId, style, materials, views, promptParams, status |
| ModelVersion | id, projectVersionId, planVersionId, renderVersionId, lod, format, components, qa |
| DocumentVersion | id, projectVersionId, templateId, sourceVersionMap, pages, pptxAssetId, pdfAssetId |
| GenerationTask | id, projectId, type, inputVersionId, idempotencyKey, status, progress, errorCode, retries |
| AuditLog | id, actorId, projectId, action, targetType, targetId, metadata, createdAt |

## 2. 场地 JSON 示例

```json
{
  "schemaVersion": "0.1",
  "unit": "mm",
  "boundary": {
    "type": "Polygon",
    "coordinates": [[[0, 0], [18000, 0], [18000, 24000], [0, 24000], [0, 0]]]
  },
  "areaMm2": 432000000,
  "perimeterMm": 84000,
  "northAngleDeg": 0,
  "roads": [{"side": "south", "widthMm": 6000, "source": "cad"}],
  "entrances": [{"point": [9000, 0], "source": "user"}],
  "provenance": {
    "boundary": "cad",
    "northAngleDeg": "user",
    "entrances": "user"
  },
  "validation": {
    "isClosed": true,
    "isSimple": true,
    "warnings": []
  }
}
```

## 3. 平面方案 JSON 示例

```json
{
  "schemaVersion": "0.1",
  "siteVersionId": "site_01",
  "requirementVersionId": "req_01",
  "strategy": "daylight_first",
  "floors": [{
    "level": 1,
    "elevationMm": 0,
    "spaces": [{
      "id": "space_living",
      "type": "living_room",
      "polygon": [[0, 0], [4800, 0], [4800, 6000], [0, 6000], [0, 0]],
      "areaMm2": 28800000
    }],
    "openings": [],
    "stairs": []
  }],
  "metrics": {
    "grossFloorAreaMm2": 180000000,
    "efficiency": 0.82,
    "requirementSatisfaction": 0.93
  },
  "validation": {
    "insideBuildableArea": true,
    "reachableSpaces": true,
    "warnings": []
  }
}
```

## 4. 版本失效规则

| 变更对象 | 必须失效的下游成果 |
|---|---|
| 场地边界/单位 | 需求校验、平面、效果图、模型、文档 |
| 户型需求 | 平面、效果图、模型、文档 |
| 已确认平面 | 效果图、模型、文档 |
| 已确认效果图/风格 | 模型材质、文档 |
| 文档模板 | 仅文档 |

失效只改变可用性，不删除历史文件；历史版本仍可审计和对比。
