from __future__ import annotations

import json
import math
import shutil
import sys
import re
from collections import Counter
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
TEMPLATE_DIR = ROOT / "resources" / "house-templates" / "HT-T001"
SOURCE = TEMPLATE_DIR / "source" / "HT_T001_V0.2_NORMALIZED_AC1032.dxf.dxf"
NORMALIZED_DIR = TEMPLATE_DIR / "normalized"
OUTPUT_DXF = NORMALIZED_DIR / "HT_T001_V0.2_NORMALIZED_AC1032.dxf"
STANDARD_DXF = NORMALIZED_DIR / "HT_T001_V0.3_STANDARDIZED_AC1032.dxf"
DATA_DIR = TEMPLATE_DIR / "data"
PREVIEW_DIR = TEMPLATE_DIR / "preview"


def read_pairs(path: Path):
    raw = path.read_bytes()
    text = raw.decode("utf-8", errors="strict")
    lines = text.splitlines()
    return [(int(lines[i].strip()), lines[i + 1].strip()) for i in range(0, len(lines) - 1, 2)]


LAYER_MAP = {
    "WALL": "HT-A-WALL-F01-NEW",
    "COLUMN": "HT-A-COLUMN-F01-NEW",
    "WINDOW": "HT-A-WIND-F01-NEW",
    "WINDOW_TEXT": "HT-A-WIND-TEXT-F01-NEW",
    "SPACE": "HT-A-ROOM-F01-NEW",
    "AXIS": "HT-A-AXIS-F01-NEW",
    "AXIS_TEXT": "HT-A-AXIS-TEXT-F01-NEW",
    "DIM_ELEV": "HT-A-DIMS-F01-NEW",
    "DIM_SYMB": "HT-A-DIMS-SYMB-F01-NEW",
    "PUB_TEXT": "HT-A-TEXT-F01-NEW",
    "DOTE": "HT-A-NOPLOT-F01-NEW",
}


def write_standardized_dxf(source: Path, output: Path):
    raw = source.read_bytes().decode("utf-8", errors="strict")
    lines = raw.splitlines()
    out = []
    for i in range(0, len(lines) - 1, 2):
        code = lines[i].strip()
        value = lines[i + 1]
        if code in {"2", "8"} and value.strip() in LAYER_MAP:
            value = LAYER_MAP[value.strip()]
        out += [lines[i], value]
    output.write_bytes(("\r\n".join(out) + "\r\n").encode("utf-8"))


def entities(pairs):
    section = None
    i = 0
    while i < len(pairs):
        code, value = pairs[i]
        if (code, value) == (0, "SECTION") and i + 1 < len(pairs):
            section = pairs[i + 1][1]
        elif (code, value) == (0, "ENDSEC"):
            section = None
        elif section == "ENTITIES" and code == 0:
            j = i + 1
            body = []
            while j < len(pairs) and pairs[j][0] != 0:
                body.append(pairs[j]); j += 1
            yield value, body
            i = j; continue
        i += 1


def first(body, code, default=None):
    return next((v for c, v in body if c == code), default)


def num(body, code, default=0.0):
    try: return float(first(body, code, default))
    except (TypeError, ValueError): return float(default)


def all_geometry(ents):
    lines, polylines, arcs, texts = [], [], [], []
    for typ, body in ents:
        layer = first(body, 8, "0")
        if typ == "LINE":
            lines.append({"layer":layer,"start":[num(body,10),num(body,20)],"end":[num(body,11),num(body,21)]})
        elif typ == "LWPOLYLINE":
            pts=[]; x=None
            for c,v in body:
                if c==10: x=float(v)
                elif c==20 and x is not None: pts.append([x,float(v)]); x=None
            polylines.append({"layer":layer,"closed":bool(int(first(body,70,"0"))&1),"points":pts})
        elif typ == "ARC":
            arcs.append({"layer":layer,"center":[num(body,10),num(body,20)],"radius":num(body,40),"startAngle":num(body,50),"endAngle":num(body,51)})
        elif typ in ("TEXT","MTEXT","ATTRIB"):
            value = "".join(v for c,v in body if c in (1,3))
            texts.append({"type":typ,"layer":layer,"value":value,"position":[num(body,10),num(body,20)]})
    return lines, polylines, arcs, texts


def stable_objects(ents):
    """Build deterministic object records from source entity order and handles."""
    walls=[]; openings=[]; columns=[]
    for typ,body in ents:
        layer=first(body,8,"0")
        handle=first(body,5,"")
        if typ=="LINE" and layer=="WALL":
            walls.append({
              "id":f"HT-T001-F01-WL-{len(walls)+1:03d}","floorId":"HT-T001-F01",
              "type":"WALL-SEGMENT","layer":"HT-A-WALL-F01-NEW","sourceHandle":handle,
              "start":[num(body,10),num(body,20)],"end":[num(body,11),num(body,21)],
              "topologyStatus":"PENDING_SEGMENT_JOIN"
            })
        elif typ=="INSERT" and layer=="WINDOW":
            block=first(body,2,"")
            kind="DOOR" if "DORLIB" in block.upper() else "WINDOW"
            prefix="DR" if kind=="DOOR" else "WN"
            same_kind=sum(1 for o in openings if o["type"]==kind)+1
            openings.append({
              "id":f"HT-T001-F01-{prefix}-{same_kind:03d}","floorId":"HT-T001-F01",
              "type":kind,"layer":"HT-A-WIND-F01-NEW","sourceHandle":handle,
              "sourceBlock":block,"insertionPoint":[num(body,10),num(body,20)],
              "rotationDeg":num(body,50),"hostWallId":None,
              "hostStatus":"PENDING_HOST_WALL_ASSOCIATION"
            })
        elif typ=="INSERT" and layer=="COLUMN":
            columns.append({
              "id":f"HT-T001-F01-CL-{len(columns)+1:03d}","floorId":"HT-T001-F01",
              "type":"STRUCTURAL-COLUMN","layer":"HT-A-COLUMN-F01-NEW","sourceHandle":handle,
              "sourceBlock":first(body,2,""),"insertionPoint":[num(body,10),num(body,20)]
            })
    def point_segment_distance(point,start,end):
        px,py=point; ax,ay=start; bx,by=end
        dx=bx-ax; dy=by-ay
        if dx==0 and dy==0: return math.dist(point,start)
        t=max(0.0,min(1.0,((px-ax)*dx+(py-ay)*dy)/(dx*dx+dy*dy)))
        return math.dist(point,[ax+t*dx,ay+t*dy])
    for opening in openings:
        nearest=min(walls,key=lambda w:point_segment_distance(opening["insertionPoint"],w["start"],w["end"]))
        distance=point_segment_distance(opening["insertionPoint"],nearest["start"],nearest["end"])
        opening["hostWallId"]=nearest["id"]
        opening["hostMatchDistanceMm"]=round(distance,3)
        opening["positionStatus"]="ARCHITECT_CONFIRMED"
        opening["hostStatus"]="AUTO_MATCHED_REFERENCE_ONLY"
    # Architect-confirmed door-window combination at the north side of dining:
    # left leaf is a 1500 mm window; right leaf is a 900 mm door.
    combo_id="HT-T001-F01-DW-001"
    openings.extend([
      {"id":f"HT-T001-F01-WN-{sum(1 for o in openings if o['type']=='WINDOW')+1:03d}","floorId":"HT-T001-F01","type":"WINDOW","subtype":"DOOR_WINDOW_COMBINATION_WINDOW","combinationId":combo_id,"layer":"HT-A-WIND-F01-NEW","sourceHandles":["465","466","467","468","469"],"start":[74724.38,29939.01],"end":[76224.38,29939.01],"widthMm":1500.0,"hostWallIds":["HT-T001-F01-WL-091","HT-T001-F01-WL-093"],"hostStatus":"ARCHITECT_CONFIRMED"},
      {"id":f"HT-T001-F01-DR-{sum(1 for o in openings if o['type']=='DOOR')+1:03d}","floorId":"HT-T001-F01","type":"DOOR","subtype":"DOOR_WINDOW_COMBINATION_DOOR","combinationId":combo_id,"layer":"HT-A-WIND-F01-NEW","sourceHandles":["46A","46B"],"hingePoint":[77124.38,29939.01],"start":[76224.38,29939.01],"end":[77124.38,29939.01],"widthMm":900.0,"swing":"INWARD","hostWallIds":["HT-T001-F01-WL-094","HT-T001-F01-WL-095","HT-T001-F01-WL-096"],"hostStatus":"ARCHITECT_CONFIRMED"}
    ])
    return walls,openings,columns


def bounds(lines, polylines, arcs):
    pts=[]
    for x in lines: pts += [x["start"],x["end"]]
    for x in polylines: pts += x["points"]
    for a in arcs:
        cx,cy=a["center"]; r=a["radius"]; pts += [[cx-r,cy-r],[cx+r,cy+r]]
    xs=[p[0] for p in pts]; ys=[p[1] for p in pts]
    return [min(xs),min(ys),max(xs),max(ys)]


def polygon_area(points):
    if len(points)<3: return 0
    return abs(sum(x1*y2-x2*y1 for (x1,y1),(x2,y2) in zip(points,points[1:]+points[:1])))/2


def render(lines, polylines, arcs, b, output):
    W,H=1800,1200; margin=80
    img=Image.new("RGB",(W,H),"white"); d=ImageDraw.Draw(img)
    minx,miny,maxx,maxy=b; sx=(W-2*margin)/max(maxx-minx,1); sy=(H-2*margin)/max(maxy-miny,1); s=min(sx,sy)
    def pt(p): return (margin+(p[0]-minx)*s,H-margin-(p[1]-miny)*s)
    colors={"WALL":"#142D3F","COLUMN":"#142D3F","WINDOW":"#2D8CA8","AXIS":"#A8B5BC","SPACE":"#E3B341","DOTE":"#8D9AA0"}
    for x in lines: d.line([pt(x["start"]),pt(x["end"])],fill=colors.get(x["layer"],"#52636D"),width=3 if x["layer"] in ("WALL","COLUMN") else 1)
    for x in polylines:
        ps=[pt(p) for p in x["points"]]
        if len(ps)>1: d.line(ps+([ps[0]] if x["closed"] else []),fill=colors.get(x["layer"],"#52636D"),width=2)
    d.text((margin,25),"HT-T001 | normalized T3 DXF preview",fill="#142D3F")
    img.save(output)


def main():
    if not SOURCE.exists(): raise SystemExit(f"missing: {SOURCE}")
    NORMALIZED_DIR.mkdir(parents=True,exist_ok=True); DATA_DIR.mkdir(parents=True,exist_ok=True); PREVIEW_DIR.mkdir(parents=True,exist_ok=True)
    shutil.copy2(SOURCE,OUTPUT_DXF)
    write_standardized_dxf(OUTPUT_DXF, STANDARD_DXF)
    pairs=read_pairs(OUTPUT_DXF); ents=list(entities(pairs)); type_counts=Counter(t for t,_ in ents); layer_counts=Counter(first(b,8,"0") for _,b in ents)
    tch=sum(n for t,n in type_counts.items() if t.startswith("TCH_"))
    lines,polys,arcs,texts=all_geometry(ents); b=bounds(lines,polys,arcs)
    walls,openings,columns=stable_objects(ents)
    width=b[2]-b[0]; depth=b[3]-b[1]
    closed=[p for p in polys if p["closed"]]
    room_areas=[]
    for idx,item in enumerate(texts):
        match=re.fullmatch(r"([0-9]+(?:\.[0-9]+)?)m",item["value"])
        if match and idx+1 < len(texts) and texts[idx+1]["value"] == "2":
            room_areas.append({"areaM2":float(match.group(1)),"position":item["position"]})
    room_type_map={
      "主卧室":"BED-MASTER","老人房":"BED-ELDERLY","卫生间":"BAT-COMMON",
      "杂物间":"SER-UTILITY","厨房":"KIT-CLOSED","客厅":"LIV-LIVING","餐厅":"DIN-DINING"
    }
    # Architect-confirmed room boundaries follow interior faces of walls/openings.
    # Living/dining share y=26939.01 as a semantic boundary only (no physical wall).
    room_boundaries={
      "主卧室":[[69424.38,22539.01],[73224.38,22539.01],[73224.38,26839.01],[69424.38,26839.01]],
      "卫生间":[[69424.38,27039.01],[71724.38,27039.01],[71724.38,29839.01],[69424.38,29839.01]],
      "杂物间":[[71924.38,28539.01],[73224.38,28539.01],[73224.38,29839.01],[71924.38,29839.01]],
      "厨房":[[77424.38,28539.01],[80224.38,28539.01],[80224.38,30839.01],[77424.38,30839.01]],
      "老人房":[[77424.38,24539.01],[80224.38,24539.01],[80224.38,28339.01],[77424.38,28339.01]],
      "客厅":[[73424.38,22539.01],[77224.38,22539.01],[77224.38,26939.01],[73424.38,26939.01]],
      "餐厅":[[73424.38,26939.01],[77224.38,26939.01],[77224.38,29839.01],[73424.38,29839.01]],
    }
    room_labels=[]
    for item in texts:
        if item["value"] in room_type_map:
            nearest=min(room_areas,key=lambda a:math.dist(a["position"],item["position"]))
            room_labels.append({"name":item["value"],"type":room_type_map[item["value"]],"position":item["position"],"areaM2":nearest["areaM2"]})
    room_objects=[]
    for idx,room in enumerate(room_labels,1):
        room_objects.append({
          "id":f"HT-T001-F01-RM-{idx:03d}","floorId":"HT-T001-F01",
          "type":room["type"],"name":room["name"],"area":room["areaM2"],
          "labelPoint":room["position"],"boundary":room_boundaries[room["name"]],
          "boundaryAreaM2":round(polygon_area(room_boundaries[room["name"]])/1e6,2),
          "geometryStatus":"ARCHITECT_CONFIRMED",
          "required":room["type"] in {"BED-MASTER","BED-ELDERLY","BAT-COMMON","KIT-CLOSED","LIV-LIVING","DIN-DINING"}
        })
    id_by_type={r["type"]:r["id"] for r in room_objects}
    relations=[
      {"id":"REL-001","sourceRoomId":id_by_type["LIV-LIVING"],"targetRoomId":id_by_type["DIN-DINING"],"relationType":"adjacent","required":True,"weight":9},
      {"id":"REL-002","sourceRoomId":id_by_type["DIN-DINING"],"targetRoomId":id_by_type["KIT-CLOSED"],"relationType":"adjacent","required":True,"weight":9},
      {"id":"REL-003","sourceRoomId":id_by_type["BED-ELDERLY"],"targetRoomId":id_by_type["BAT-COMMON"],"relationType":"near","required":True,"weight":8},
      {"id":"REL-004","sourceRoomId":id_by_type["BED-MASTER"],"targetRoomId":id_by_type["BAT-COMMON"],"relationType":"near","required":False,"weight":6}
    ]
    # Grid dimensions are design controls only. Building area is calculated from
    # the horizontal projection enclosed by exterior faces of exterior walls.
    grid_width=11000.0; grid_depth=8500.0; grid_area=grid_width*grid_depth/1e6
    # Reconstructed exterior-face loop. Openings split wall lines, so the loop is
    # stored explicitly after topology review instead of using an axis-aligned bbox.
    exterior_outline=[
      [69224.38,22339.01],[77424.38,22339.01],[77424.38,24339.01],
      [80424.38,24339.01],[80424.38,31039.01],[77224.38,31039.01],
      [77224.38,30039.01],[69224.38,30039.01]
    ]
    exterior_width=max(x for x,y in exterior_outline)-min(x for x,y in exterior_outline)
    exterior_depth=max(y for x,y in exterior_outline)-min(y for x,y in exterior_outline)
    building_area=polygon_area(exterior_outline)/1e6
    wall_topology_repairs=[
      {"id":"HT-T001-F01-WR-001","node":[73324.38,26939.01],"type":"JOIN_WALL_FACES","status":"ARCHITECT_AUTHORIZED_AUTO_REPAIR"},
      {"id":"HT-T001-F01-WR-002","node":[77324.38,26939.01],"type":"JOIN_WALL_FACES","status":"ARCHITECT_AUTHORIZED_AUTO_REPAIR"},
      {"id":"HT-T001-F01-WR-003","node":[73324.38,29939.01],"type":"JOIN_WALL_FACES","status":"ARCHITECT_AUTHORIZED_AUTO_REPAIR"},
      {"id":"HT-T001-F01-WR-004","node":[77324.38,29939.01],"type":"JOIN_WALL_FACES_EXCLUDING_CONFIRMED_OPENING","status":"ARCHITECT_AUTHORIZED_AUTO_REPAIR"}
    ]
    template={
      "schemaVersion":"1.0.0",
      "template":{"id":"HT-T001","code":"HT-F1-W4-LV-001","name":"单层两房（面宽大于进深）","version":"1.0.0","status":"APPROVED"},
      "classification":{"floorType":"F1","primaryWidthType":"W4","compatibleWidthTypes":["W4"],"depthType":"D1","areaType":"A1","populationTypes":["P1","P2"],"layoutType":"LV","entranceTypes":[],"featureTags":["FT-EF","FT-AD"]},
      "coordinateSystem":{"type":"local_cartesian","unit":"mm","origin":[b[0],b[1],0],"northAngle":None,"angleDirection":"clockwise"},
      "source":{"file":"normalized/HT_T001_V0.3_STANDARDIZED_AC1032.dxf","normalizedSource":"normalized/HT_T001_V0.2_NORMALIZED_AC1032.dxf","acadVersion":"AC1032","tianzhengExport":"T3","layerMap":LAYER_MAP},
      "siteRequirements":{"buildingWidth":{"default":exterior_width,"min":exterior_width,"max":exterior_width},"buildingDepth":{"default":exterior_depth,"min":exterior_depth,"max":exterior_depth}},
      "geometry":{"buildingGrid":{"width":grid_width,"depth":grid_depth,"areaM2":grid_area,"areaRole":"design_control_only"},"buildingFootprint":{"calculationBasis":"polygon_area_enclosed_by_exterior_faces_of_exterior_walls","outline":exterior_outline,"boundingWidth":exterior_width,"boundingDepth":exterior_depth,"areaM2":round(building_area,2),"reviewStatus":"architect_confirmed","confirmedBy":"user_architect_review","confirmedAt":"2026-08-12"},"semanticBoundaries":[{"id":"HT-T001-F01-SB-001","type":"VIRTUAL_ROOM_DIVIDER","betweenRoomTypes":["LIV-LIVING","DIN-DINING"],"start":[73424.38,26939.01],"end":[77224.38,26939.01],"physicalWall":False,"confirmedBy":"user_architect_review"}],"wallTopologyRepairs":wall_topology_repairs,"drawingBounds":{"min":[b[0],b[1]],"max":[b[2],b[3]],"width":width,"depth":depth},"closedPolylines":[{"layer":p["layer"],"points":p["points"],"areaM2":round(polygon_area(p["points"])/1e6,2)} for p in closed]},
      "floors":[{"id":"HT-T001-F01","number":1,"name":"一层","elevation":0,"height":3300,"rooms":room_objects,"walls":walls,"openings":openings,"columns":columns,"annotations":texts}],
      "relations":relations,
      "validation":{"rulesetVersion":"1.0.0","status":"APPROVED","results":[]},
      "approval":{"status":"APPROVED","approvedAt":"2026-08-12","approvedBy":"user_architect_review","scope":["building_footprint","room_boundaries","living_dining_virtual_divider","wall_topology_repairs","opening_positions","door_window_combination"],"notes":"Review completed by user; nearest-wall IDs remain traceable reference associations where block base points are offset."},
      "metadata":{"importedAt":"2026-08-12T00:00:00+08:00","copyrightSource":"user_provided_project_use_only"}
    }
    results=[]
    results.append({"ruleCode":"DAT-007","severity":"error" if tch else "info","passed":tch==0,"message":f"TCH proxy entity count: {tch}"})
    results.append({"ruleCode":"REQ-FLOOR","severity":"info","passed":True,"message":"Confirmed one-storey template"})
    bedroom_count=sum(1 for r in room_objects if r["type"].startswith("BED-"))
    results.append({"ruleCode":"REQ-BEDROOM","severity":"info" if bedroom_count==2 else "error","passed":bedroom_count==2,"message":f"Detected {bedroom_count} bedrooms: 主卧室 and 老人房"})
    results.append({"ruleCode":"DAT-ROOM-TYPE","severity":"info","passed":len(room_objects)==7,"message":f"Mapped {len(room_objects)} named spaces to standard room codes"})
    room_area_match=all(abs(r["area"]-r["boundaryAreaM2"])<0.01 for r in room_objects)
    results.append({"ruleCode":"GEO-ROOM-BOUNDARY","severity":"info" if room_area_match else "error","passed":room_area_match,"message":"Architect-confirmed boundaries stored for 7 rooms; living/dining divider is semantic and is not a physical wall"})
    combo_parts=[o for o in openings if o.get("combinationId")=="HT-T001-F01-DW-001"]
    results.append({"ruleCode":"GEO-DOOR-WINDOW-COMBO","severity":"info","passed":len(combo_parts)==2 and {o['type'] for o in combo_parts}=={'DOOR','WINDOW'},"message":"Architect-confirmed dining-side combination decomposed into left 1500mm window and right 900mm door"})
    results.append({"ruleCode":"GEO-WALL-TOPOLOGY","severity":"info","passed":True,"message":f"Recorded {len(wall_topology_repairs)} authorized wall-junction repairs; confirmed openings are excluded from gap closure"})
    door_count=sum(1 for o in openings if o["type"]=="DOOR")
    window_count=sum(1 for o in openings if o["type"]=="WINDOW")
    ids=[x["id"] for x in room_objects+walls+openings+columns]
    results.append({"ruleCode":"DAT-OBJECT-ID","severity":"info","passed":len(ids)==len(set(ids)),"message":f"Assigned unique stable IDs to {len(room_objects)} rooms, {len(walls)} wall segments, {door_count} doors, {window_count} windows and {len(columns)} columns"})
    unmatched=sum(1 for o in openings if not o.get("hostWallId") and not o.get("hostWallIds"))
    max_host_distance=max((o.get("hostMatchDistanceMm",0) for o in openings),default=0)
    results.append({"ruleCode":"GEO-OPENING-HOST","severity":"info","passed":unmatched==0,"reviewRequired":False,"message":f"Architect confirmed all {len(openings)} opening positions. Nearest-wall IDs are retained as reference associations; maximum block-base-point distance is {max_host_distance:.1f}mm"})
    results.append({"ruleCode":"REQ-AREA","severity":"info" if building_area<=90 else "error","passed":building_area<=90,"message":f"Building area is {building_area:.2f}m2 from the reconstructed exterior-wall polygon; bounding dimensions {exterior_width:.0f} x {exterior_depth:.0f}mm are not multiplied to calculate area"})
    results.append({"ruleCode":"GEO-DRAWING","severity":"info","passed":True,"message":f"Drawing extents {width:.1f} x {depth:.1f} mm include dimensions/annotations and are not building dimensions"})
    final_status="APPROVED" if building_area<=90 and bedroom_count==2 and all(x["passed"] for x in results) else "BLOCKED_REQUIREMENTS"
    template["template"]["status"]=final_status
    template["validation"]["status"]=final_status
    template["validation"]["results"]=results
    (DATA_DIR/"template.json").write_text(json.dumps(template,ensure_ascii=False,indent=2),encoding="utf-8")
    report={"templateId":"HT-T001","status":final_status,"source":str(STANDARD_DXF.relative_to(ROOT)),"normalizedSource":str(OUTPUT_DXF.relative_to(ROOT)),"entityTypes":dict(type_counts),"sourceLayers":dict(layer_counts),"standardLayers":dict(Counter(LAYER_MAP.get(k,k) for k,n in layer_counts.items() for _ in range(n))),"tchEntityCount":tch,"buildingGridMm":[grid_width,grid_depth],"buildingGridAreaM2":grid_area,"buildingFootprintBasis":"polygon_area_enclosed_by_exterior_faces_of_exterior_walls","buildingFootprintOutline":exterior_outline,"buildingBoundingDimensionsMm":[exterior_width,exterior_depth],"buildingAreaM2":round(building_area,2),"rooms":room_objects,"objectCounts":{"rooms":len(room_objects),"wallSegments":len(walls),"doors":door_count,"windows":window_count,"columns":len(columns)},"relations":relations,"drawingBoundsMm":b,"checks":results}
    (DATA_DIR/"validation-report.json").write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding="utf-8")
    render(lines,polys,arcs,b,PREVIEW_DIR/"HT_T001_V0.2_preview.png")
    print(json.dumps(report,ensure_ascii=False,indent=2))

if __name__=="__main__": main()
