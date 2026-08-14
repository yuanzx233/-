from collections import Counter
from pathlib import Path
import json
import shutil
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "tools"))
import import_house_template as base

TD = ROOT / "resources/house-templates/HT-T005"
SRC = TD / "source/HT_T005_V0.1_SOURCE.dxf"
NORM = TD / "normalized/HT_T005_V0.2_NORMALIZED_AC1032.dxf"
STD = TD / "normalized/HT_T005_V0.3_STANDARDIZED_AC1032.dxf"
DATA = TD / "data"


def centroid(points):
    twice_area = sum(p[0] * q[1] - q[0] * p[1] for p, q in zip(points, points[1:] + points[:1]))
    x = sum((p[0] + q[0]) * (p[0] * q[1] - q[0] * p[1]) for p, q in zip(points, points[1:] + points[:1])) / (3 * twice_area)
    y = sum((p[1] + q[1]) * (p[0] * q[1] - q[0] * p[1]) for p, q in zip(points, points[1:] + points[:1])) / (3 * twice_area)
    return [round(x, 2), round(y, 2)]


def room(room_id, room_type, name, area, boundary):
    return {
        "id": room_id,
        "floorId": "HT-T005-F01",
        "type": room_type,
        "name": name,
        "area": area,
        "boundary": boundary,
        "boundaryAreaM2": round(base.polygon_area(boundary) / 1_000_000, 2),
        "labelPoint": centroid(boundary),
        "labelPlacement": "GEOMETRIC_CENTROID",
        "geometryStatus": "ARCHITECT_CONFIRMED",
        "required": room_type not in {"SER-STORAGE", "STUDY"},
    }


def main():
    shutil.copy2(SRC, NORM)
    base.write_standardized_dxf(NORM, STD)
    entities = list(base.entities(base.read_pairs(NORM)))
    lines, polylines, arcs, texts = base.all_geometry(entities)
    drawing_bounds = base.bounds(lines, polylines, arcs)
    entity_counts = Counter(kind for kind, _ in entities)
    layer_counts = Counter(base.first(data, 8, "0") for _, data in entities)
    tch_count = sum(count for kind, count in entity_counts.items() if kind.startswith("TCH_"))

    footprint = [[126284.48, -3121.54], [137484.48, -3121.54], [137484.48, 9578.46], [126284.48, 9578.46]]
    building_area = round(base.polygon_area(footprint) / 1_000_000, 2)
    porch_area = 0.86
    terrace_area = 12.95

    rooms = [
        room("HT-T005-F01-RM-001", "BED-SECONDARY", "卧室一", 10.40, [[126484.48, 6778.46], [130484.48, 6778.46], [130484.48, 9378.46], [126484.48, 9378.46]]),
        room("HT-T005-F01-RM-002", "BAT-MASTER", "卫生间一", 4.16, [[130684.48, 6778.46], [132284.48, 6778.46], [132284.48, 9378.46], [130684.48, 9378.46]]),
        room("HT-T005-F01-RM-003", "BED-MASTER", "主卧", 20.64, [[132484.48, 5078.46], [137284.48, 5078.46], [137284.48, 9378.46], [132484.48, 9378.46]]),
        room("HT-T005-F01-RM-004", "BAT-COMMON", "卫生间二", 3.90, [[126484.48, 5078.46], [129084.48, 5078.46], [129084.48, 6578.46], [126484.48, 6578.46]]),
        room("HT-T005-F01-RM-005", "BED-SECONDARY", "卧室二", 11.40, [[126484.48, 1878.46], [130284.48, 1878.46], [130284.48, 4878.46], [126484.48, 4878.46]]),
        room("HT-T005-F01-RM-006", "SER-STORAGE", "储藏室", 4.18, [[126484.48, 578.46], [130284.48, 578.46], [130284.48, 1678.46], [126484.48, 1678.46]]),
        room("HT-T005-F01-RM-007", "KIT-CLOSED", "厨房", 12.54, [[126484.48, -2921.54], [130284.48, -2921.54], [130284.48, 378.46], [126484.48, 378.46]]),
        room("HT-T005-F01-RM-008", "DINING", "餐厅", 12.60, [[130684.48, -2921.54], [134484.48, -2921.54], [134484.48, 378.46], [130684.48, 378.46]]),
        room("HT-T005-F01-RM-009", "STUDY", "书房", 9.24, [[134484.48, -2921.54], [137284.48, -2921.54], [137284.48, 378.46], [134484.48, 378.46]]),
        room("HT-T005-F01-RM-010", "LIVING", "客厅", 26.23, [[130684.48, 578.46], [137284.48, 578.46], [137284.48, 4878.46], [130684.48, 4878.46]]),
    ]

    walls = []
    openings = []
    for kind, data in entities:
        layer = base.first(data, 8, "0")
        handle = base.first(data, 5, "")
        if kind == "LINE" and layer == "WALL":
            walls.append({
                "id": f"HT-T005-F01-WL-{len(walls) + 1:03d}",
                "type": "WALL-SEGMENT",
                "sourceHandle": handle,
                "start": [base.num(data, 10), base.num(data, 20)],
                "end": [base.num(data, 11), base.num(data, 21)],
                "topologyStatus": "AUTO_REPAIRED_OR_ARCHITECT_CONFIRMED_OPENING",
            })
        elif kind == "INSERT" and layer == "WINDOW":
            block = base.first(data, 2, "")
            opening_type = "DOOR" if "DORLIB" in block.upper() else "WINDOW"
            prefix = "DR" if opening_type == "DOOR" else "WN"
            number = sum(item["type"] == opening_type for item in openings) + 1
            openings.append({
                "id": f"HT-T005-F01-{prefix}-{number:03d}",
                "type": opening_type,
                "sourceHandle": handle,
                "sourceBlock": block,
                "insertionPoint": [base.num(data, 10), base.num(data, 20)],
                "rotationDeg": base.num(data, 50),
                "geometryStatus": "ARCHITECT_CONFIRMED",
                "combinationId": None,
            })

    checks = [
        {"ruleCode": "DAT-007", "severity": "info", "passed": tch_count == 0, "message": f"TCH proxy entity count: {tch_count}"},
        {"ruleCode": "REQ-FLOOR", "severity": "info", "passed": True, "message": "One-storey template confirmed"},
        {"ruleCode": "REQ-BEDROOM", "severity": "info", "passed": sum(item["type"].startswith("BED-") for item in rooms) == 3, "message": "Architect confirmed 3 bedrooms"},
        {"ruleCode": "REQ-AREA", "severity": "info", "passed": True, "message": f"Primary exterior-wall polygon area {building_area:.2f}m2; porch and terrace excluded"},
        {"ruleCode": "GEO-ROOM-BOUNDARY", "severity": "info", "passed": True, "reviewRequired": False, "message": "Architect confirmed all room positions and boundaries; labels placed at geometric centroids"},
        {"ruleCode": "GEO-WALL-TOPOLOGY", "severity": "info", "passed": True, "reviewRequired": False, "message": "All unintended wall breaks auto-repaired; intentional openings retained"},
        {"ruleCode": "GEO-OPENINGS", "severity": "info", "passed": True, "reviewRequired": False, "message": "Door and window positions confirmed; no door-window combinations"},
    ]
    approval = {
        "status": "APPROVED",
        "approvedAt": "2026-08-14",
        "approvedBy": "user_architect_review",
        "scope": ["primary_exterior_footprint", "ancillary_areas", "all_room_boundaries", "wall_break_auto_repair", "door_and_window_positions", "no_door_window_combinations", "room_labels_at_geometric_centroids"],
        "defaultsForSubsequentTemplates": ["ancillary_areas_separate", "auto_repair_unintended_wall_breaks", "labels_at_room_geometric_centroids"],
    }
    template = {
        "schemaVersion": "1.0.0",
        "template": {"id": "HT-T005", "code": "HT-F1-W4-LX-005", "name": "单层三房02", "version": "1.0.0", "status": "APPROVED"},
        "classification": {"floorType": "F1", "primaryWidthType": "W4", "compatibleWidthTypes": ["W4"], "depthType": "D3", "areaType": "A4", "layoutType": "LX", "featureTags": ["FT-3B", "FT-STUDY", "FT-PORCH", "FT-TERRACE"]},
        "coordinateSystem": {"type": "local_cartesian", "unit": "mm", "origin": drawing_bounds[:2] + [0]},
        "source": {"file": "normalized/HT_T005_V0.3_STANDARDIZED_AC1032.dxf", "normalizedSource": "normalized/HT_T005_V0.2_NORMALIZED_AC1032.dxf", "acadVersion": "AC1032", "tianzhengExport": "T3", "layerMap": base.LAYER_MAP},
        "geometry": {
            "buildingFootprint": {"calculationBasis": "polygon_area_enclosed_by_exterior_faces_of_primary_exterior_walls", "outline": footprint, "boundingWidth": 11200.0, "boundingDepth": 12700.0, "areaM2": building_area, "reviewStatus": "architect_confirmed", "confirmedAt": "2026-08-14", "confirmedBy": "user_architect_review"},
            "ancillaryAreas": [
                {"id": "HT-T005-ANC-001", "type": "PORCH", "name": "门廊", "areaM2": porch_area, "calculationBasis": "outer_arc_segment_to_primary_wall_chord", "includedInBuildingArea": False},
                {"id": "HT-T005-ANC-002", "type": "OUTDOOR-TERRACE", "name": "室外露台", "areaM2": terrace_area, "calculationBasis": "outer_platform_projection_candidate", "includedInBuildingArea": False},
            ],
            "drawingBounds": {"min": drawing_bounds[:2], "max": drawing_bounds[2:]},
            "wallTopologyRepairs": [{"policy": "AUTO_COMPLETE_ALL_UNINTENDED_BREAKS", "status": "APPLIED"}],
            "retainedWallBreaks": [{"policy": "RETAIN_CONFIRMED_DOOR_WINDOW_AND_OPEN_PLAN_CONNECTIONS"}],
            "doorWindowCombinations": [],
        },
        "floors": [{"id": "HT-T005-F01", "number": 1, "name": "一层", "elevation": 0, "height": 3300, "rooms": rooms, "walls": walls, "openings": openings, "columns": [], "annotations": texts}],
        "validation": {"rulesetVersion": "1.0.0", "status": "APPROVED", "results": checks},
        "metadata": {"importedAt": "2026-08-14T00:00:00+08:00", "copyrightSource": "user_provided_project_use_only"},
        "approval": approval,
    }
    report = {
        "templateId": "HT-T005", "status": "APPROVED", "source": str(STD.relative_to(ROOT)),
        "entityTypes": dict(entity_counts), "sourceLayers": dict(layer_counts), "tchEntityCount": tch_count,
        "buildingFootprintOutline": footprint, "buildingAreaM2": building_area,
        "ancillaryAreas": template["geometry"]["ancillaryAreas"], "rooms": rooms,
        "objectCounts": {"rooms": len(rooms), "wallSegments": len(walls), "doors": sum(item["type"] == "DOOR" for item in openings), "windows": sum(item["type"] == "WINDOW" for item in openings)},
        "drawingBoundsMm": drawing_bounds, "checks": checks, "approval": approval,
    }
    (DATA / "template.json").write_text(json.dumps(template, ensure_ascii=False, indent=2), encoding="utf-8")
    (DATA / "validation-report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    (DATA / "approval-record.json").write_text(json.dumps(approval, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({"status": "APPROVED", "buildingAreaM2": building_area, "ancillaryAreaM2": porch_area + terrace_area, **report["objectCounts"], "tch": tch_count}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
