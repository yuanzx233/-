from pathlib import Path
import json, sys
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "tools"))
import import_house_template as base
TD = ROOT / "resources/house-templates/HT-T006"
SRC = TD / "normalized/HT_T006_V0.3_STANDARDIZED_AC1032.dxf"
OUT = TD / "preview/HT_T006_V1.0_APPROVED_BASE.png"
template = json.loads((TD / "data/template.json").read_text(encoding="utf-8"))
entities = list(base.entities(base.read_pairs(SRC)))
lines, polylines, arcs, texts = base.all_geometry(entities)
minx, miny, maxx, maxy = base.bounds(lines, polylines, arcs)
width, height, margin = 1800, 1100, 75
image = Image.new("RGB", (width, height), "white")
draw = ImageDraw.Draw(image, "RGBA")
scale = min((width - 2 * margin) / (maxx - minx), (height - 2 * margin) / (maxy - miny))
def point(p): return margin + (p[0] - minx) * scale, height - margin - (p[1] - miny) * scale
for line in lines:
    color, stroke = (22, 48, 65, 255), 3
    if "AXIS" in line["layer"]: color, stroke = (155, 172, 182, 175), 1
    elif "WIND" in line["layer"]: color, stroke = (25, 135, 175, 255), 2
    elif "WALL" in line["layer"]: stroke = 4
    draw.line((point(line["start"]), point(line["end"])), fill=color, width=stroke)
outline = [point(p) for p in template["geometry"]["buildingFootprint"]["outline"]]
draw.line(outline + [outline[0]], fill=(220, 45, 45, 255), width=6)
font = ImageFont.truetype("C:/Windows/Fonts/msyh.ttc", 15)
small = ImageFont.truetype("C:/Windows/Fonts/msyh.ttc", 14)
title = ImageFont.truetype("C:/Windows/Fonts/msyh.ttc", 25)
for room in template["floors"][0]["rooms"]:
    x, y = point(room["labelPoint"]); label = f'{room["name"]}\n{room["area"]:.2f}㎡'
    box = draw.multiline_textbbox((0, 0), label, font=font, spacing=2, align="center"); tw, th = box[2]-box[0], box[3]-box[1]
    draw.rounded_rectangle((x-tw/2-6, y-th/2-5, x+tw/2+6, y+th/2+5), 7, fill=(255,255,255,225))
    draw.multiline_text((x-tw/2, y-th/2), label, font=font, fill=(35,42,48,255), spacing=2, align="center")
draw.rounded_rectangle((45,35,720,112),14,fill=(255,255,255,242),outline=(35,55,65,220),width=2)
draw.text((65,48),"HT-T006 建筑师复核定稿底图",font=title,fill=(20,35,45,255))
draw.text((68,80),"主体建筑面积 94.40㎡；无附属建筑面积",font=small,fill=(70,80,88,255))
image.save(OUT); print(OUT)
