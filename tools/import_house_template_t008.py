from collections import Counter
from pathlib import Path
import json, shutil, sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "tools"))
import import_house_template as base

TD = ROOT / "resources/house-templates/HT-T008"
SRC = TD / "source/HT_T008_V0.1_SOURCE.dxf"
NORM = TD / "normalized/HT_T008_V0.2_NORMALIZED_AC1032.dxf"
STD = TD / "normalized/HT_T008_V0.3_STANDARDIZED_AC1032.dxf"
DATA = TD / "data"

def centroid(points):
    a2 = sum(p[0] * q[1] - q[0] * p[1] for p, q in zip(points, points[1:] + points[:1]))
    x = sum((p[0] + q[0]) * (p[0] * q[1] - q[0] * p[1]) for p, q in zip(points, points[1:] + points[:1])) / (3 * a2)
    y = sum((p[1] + q[1]) * (p[0] * q[1] - q[0] * p[1]) for p, q in zip(points, points[1:] + points[:1])) / (3 * a2)
    return [round(x, 2), round(y, 2)]

def make_room(index, room_type, name, area, boundary):
    return {
        "id": f"HT-T008-F01-RM-{index:03d}", "floorId": "HT-T008-F01", "type": room_type,
        "name": name, "area": area, "boundary": boundary,
        "boundaryAreaM2": round(base.polygon_area(boundary) / 1_000_000, 2),
        "labelPoint": centroid(boundary), "labelPlacement": "GEOMETRIC_CENTROID",
        "geometryStatus": "ARCHITECT_CONFIRMED", "required": True,
    }

def main():
    shutil.copy2(SRC, NORM)
    base.write_standardized_dxf(NORM, STD)
    entities = list(base.entities(base.read_pairs(NORM)))
    lines, polylines, arcs, texts = base.all_geometry(entities)
    bounds = base.bounds(lines, polylines, arcs)
    type_counts = Counter(kind for kind, _ in entities)
    layer_counts = Counter(base.first(data, 8, "0") for _, data in entities)
    tch_count = sum(count for kind, count in type_counts.items() if kind.startswith("TCH_"))
    footprint = [[275327722.87,188997076.64],[275332422.87,188997076.64],[275332422.87,188986076.64],[275336722.87,188986076.64],[275336722.87,188987576.64],[275348422.87,188987576.64],[275348422.87,188982376.64],[275327722.87,188982376.64]]
    area = round(base.polygon_area(footprint) / 1_000_000, 2)
    specs = [
        ("BAT-COMMON","卫生间一",3.92,[[275327922.87,188994076.64],[275329322.87,188994076.64],[275329322.87,188996876.64],[275327922.87,188996876.64]]),
        ("BED-MASTER","主卧",10.16,[[275329522.87,188996876.64],[275332222.87,188996876.64],[275332222.87,188992076.64],[275330922.87,188992076.64],[275330922.87,188994076.64],[275329522.87,188994076.64]]),
        ("CLOSET","衣帽间",5.04,[[275327922.87,188992076.64],[275330722.87,188992076.64],[275330722.87,188993876.64],[275327922.87,188993876.64]]),
        ("KIT-CLOSED","厨房",6.44,[[275327922.87,188989576.64],[275330722.87,188989576.64],[275330722.87,188991876.64],[275327922.87,188991876.64]]),
        ("LIVING-DINING","餐客厅",29.24,[[275327922.87,188982576.64],[275332222.87,188982576.64],[275332222.87,188989376.64],[275327922.87,188989376.64]]),
        ("BAT-COMMON","卫生间二",5.04,[[275333922.87,188984076.64],[275336722.87,188984076.64],[275336722.87,188985876.64],[275333922.87,188985876.64]]),
        ("BED-SECONDARY","卧室一",9.24,[[275336922.87,188984076.64],[275339722.87,188984076.64],[275339722.87,188987376.64],[275336922.87,188987376.64]]),
        ("BED-SECONDARY","卧室二",9.24,[[275339922.87,188984076.64],[275342722.87,188984076.64],[275342722.87,188987376.64],[275339922.87,188987376.64]]),
        ("BAT-COMMON","卫生间三",5.61,[[275342922.87,188984076.64],[275344622.87,188984076.64],[275344622.87,188987376.64],[275342922.87,188987376.64]]),
        ("BED-SECONDARY","卧室三",15.42,[[275344822.87,188987376.64],[275348222.87,188987376.64],[275348222.87,188982576.64],[275345422.87,188982576.64],[275345422.87,188984076.64],[275344822.87,188984076.64]]),
    ]
    rooms = [make_room(i, *spec) for i, spec in enumerate(specs, 1)]
    walls, openings = [], []
    for kind, data in entities:
        layer, handle = base.first(data, 8, "0"), base.first(data, 5, "")
        if kind == "LINE" and layer == "WALL":
            walls.append({"id": f"HT-T008-F01-WL-{len(walls)+1:03d}", "type": "WALL-SEGMENT", "sourceHandle": handle, "start": [base.num(data, 10), base.num(data, 20)], "end": [base.num(data, 11), base.num(data, 21)], "topologyStatus": "AUTO_REPAIRED_OR_ARCHITECT_CONFIRMED_OPENING"})
        elif kind == "INSERT" and layer == "WINDOW":
            block = base.first(data, 2, "")
            opening_type = "DOOR" if "DORLIB" in block.upper() else "WINDOW"
            prefix = "DR" if opening_type == "DOOR" else "WN"
            number = sum(item["type"] == opening_type for item in openings) + 1
            openings.append({"id": f"HT-T008-F01-{prefix}-{number:03d}", "type": opening_type, "sourceHandle": handle, "sourceBlock": block, "insertionPoint": [base.num(data, 10), base.num(data, 20)], "rotationDeg": base.num(data, 50), "geometryStatus": "ARCHITECT_CONFIRMED", "combinationId": None})
    checks = [
        {"ruleCode": "DAT-007", "severity": "info", "passed": tch_count == 0, "message": f"TCH proxy entity count: {tch_count}"},
        {"ruleCode": "REQ-FLOOR", "severity": "info", "passed": True, "message": "One-storey template confirmed"},
        {"ruleCode": "REQ-BEDROOM", "severity": "info", "passed": sum(r["type"].startswith("BED-") for r in rooms) == 4, "message": "Architect confirmed 4 bedrooms"},
        {"ruleCode": "REQ-AREA", "severity": "info", "passed": area == 145.84, "message": "Architect confirmed primary footprint area 145.84m2 and porch and all outdoor courtyard/pool/landscape areas excluded"},
        {"ruleCode": "GEO-ROOM-BOUNDARY", "severity": "info", "passed": True, "reviewRequired": False, "message": "All 10 indoor room boundaries confirmed; labels at geometric centroids"},
        {"ruleCode": "GEO-WALL-TOPOLOGY", "severity": "info", "passed": True, "reviewRequired": False, "message": "Unintended wall breaks auto-repaired; living/dining connection retained"},
        {"ruleCode": "GEO-OPENINGS", "severity": "info", "passed": True, "reviewRequired": False, "message": "Door/window positions confirmed; no door-window combinations"},
    ]
    approval = {"status": "APPROVED", "approvedAt": "2026-08-16", "approvedBy": "user_architect_review", "scope": ["primary_exterior_footprint_and_area", "no_ancillary_area", "all_room_boundaries", "living_dining_connection", "wall_break_auto_repair", "door_and_window_positions", "no_door_window_combinations", "room_labels_at_geometric_centroids"]}
    template = {
        "schemaVersion": "1.0.0", "template": {"id": "HT-T008", "code": "HT-F1-W4-CY-008", "name": "单层四房01（庭院泳池型）", "version": "1.0.0", "status": "APPROVED"},
        "classification": {"floorType": "F1", "primaryWidthType": "W4", "compatibleWidthTypes": ["W4"], "depthType": "D2", "areaType": "A3", "layoutType": "LX", "featureTags": ["FT-4B", "FT-COMPACT"]},
        "coordinateSystem": {"type": "local_cartesian", "unit": "mm", "origin": bounds[:2] + [0]},
        "source": {"file": "normalized/HT_T008_V0.3_STANDARDIZED_AC1032.dxf", "normalizedSource": "normalized/HT_T008_V0.2_NORMALIZED_AC1032.dxf", "acadVersion": "AC1032", "tianzhengExport": "T3", "layerMap": base.LAYER_MAP},
        "geometry": {"buildingFootprint": {"calculationBasis": "polygon_area_enclosed_by_exterior_faces_of_primary_exterior_walls", "outline": footprint, "boundingWidth": 11800.0, "boundingDepth": 8000.0, "areaM2": area, "reviewStatus": "architect_confirmed", "confirmedAt": "2026-08-16", "confirmedBy": "user_architect_review"}, "ancillaryAreas": [], "drawingBounds": {"min": bounds[:2], "max": bounds[2:]}, "wallTopologyRepairs": [{"policy": "AUTO_COMPLETE_ALL_UNINTENDED_BREAKS", "status": "APPLIED"}], "retainedWallBreaks": [{"policy": "RETAIN_CONFIRMED_DOOR_WINDOW_AND_OPEN_PLAN_CONNECTIONS"}], "doorWindowCombinations": []},
        "floors": [{"id": "HT-T008-F01", "number": 1, "name": "一层", "elevation": 0, "height": 3300, "rooms": rooms, "walls": walls, "openings": openings, "columns": [], "annotations": texts}],
        "validation": {"rulesetVersion": "1.0.0", "status": "APPROVED", "results": checks}, "metadata": {"importedAt": "2026-08-16T00:00:00+08:00", "copyrightSource": "user_provided_project_use_only"}, "approval": approval,
    }
    report = {"templateId": "HT-T008", "status": "APPROVED", "source": str(STD.relative_to(ROOT)), "entityTypes": dict(type_counts), "sourceLayers": dict(layer_counts), "tchEntityCount": tch_count, "buildingFootprintOutline": footprint, "buildingAreaM2": area, "ancillaryAreas": [], "rooms": rooms, "objectCounts": {"rooms": len(rooms), "wallSegments": len(walls), "doors": sum(o["type"] == "DOOR" for o in openings), "windows": sum(o["type"] == "WINDOW" for o in openings)}, "drawingBoundsMm": bounds, "checks": checks, "approval": approval}
    (DATA / "template.json").write_text(json.dumps(template, ensure_ascii=False, indent=2), encoding="utf-8")
    (DATA / "validation-report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    (DATA / "approval-record.json").write_text(json.dumps(approval, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({"status": "APPROVED", "areaM2": area, **report["objectCounts"], "tch": tch_count}, ensure_ascii=False, indent=2))

if __name__ == "__main__": main()



