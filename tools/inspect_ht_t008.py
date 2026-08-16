from pathlib import Path
from collections import Counter
import json, re, sys
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "tools"))
import import_house_template as base

TD = ROOT / "resources/house-templates/HT-T008"
SRC = TD / "source/HT_T008_V0.1_SOURCE.dxf"
OUT = TD / "preview/HT_T008_V0.1_INSPECTION.png"
entities = list(base.entities(base.read_pairs(SRC)))
lines, polylines, arcs, texts = base.all_geometry(entities)
bounds = base.bounds(lines, polylines, arcs)
minx, miny, maxx, maxy = bounds
W, H, margin = 1800, 1100, 75
image = Image.new("RGB", (W, H), "white")
draw = ImageDraw.Draw(image, "RGBA")
scale = min((W - 2 * margin) / (maxx - minx), (H - 2 * margin) / (maxy - miny))
point = lambda p: (margin + (p[0] - minx) * scale, H - margin - (p[1] - miny) * scale)
for line in lines:
    color, stroke = (22, 48, 65, 255), 3
    if line["layer"] == "AXIS": color, stroke = (150, 170, 180, 175), 1
    elif line["layer"] == "WINDOW": color, stroke = (25, 135, 175, 255), 2
    elif line["layer"] == "WALL": stroke = 4
    draw.line((point(line["start"]), point(line["end"])), fill=color, width=stroke)
font = ImageFont.truetype("C:/Windows/Fonts/msyh.ttc", 16)
title = ImageFont.truetype("C:/Windows/Fonts/msyh.ttc", 26)
for item in texts:
    if item["layer"] == "SPACE" and (re.fullmatch(r"[0-9.]+m", item["value"]) or not item["value"].isdigit()):
        x, y = point(item["position"]); draw.ellipse((x-5,y-5,x+5,y+5), fill=(225,70,45,255)); draw.text((x+7,y-9), item["value"], font=font, fill=(165,35,20,255))
draw.rounded_rectangle((45,35,545,91),13,fill=(255,255,255,240),outline=(30,50,60,220),width=2)
draw.text((65,48),"HT-T008 原始几何与空间检查",font=title,fill=(20,35,45,255)); image.save(OUT)
report = {"source": str(SRC.relative_to(ROOT)), "acadVersion": "AC1032", "entityTypes": dict(Counter(k for k,_ in entities)), "layers": dict(Counter(base.first(d,8,"0") for _,d in entities)), "tchEntityCount": sum(1 for k,_ in entities if k.startswith("TCH_")), "drawingBoundsMm": bounds, "spaceTexts": [x for x in texts if x["layer"] == "SPACE"]}
(TD/"data/inspection-report.json").write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding="utf-8"); print(OUT)

