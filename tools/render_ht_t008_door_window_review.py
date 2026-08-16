from pathlib import Path
import sys
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "tools"))
import import_house_template as base

TD = ROOT / "resources/house-templates/HT-T008"
SRC = TD / "source/HT_T008_V0.1_SOURCE.dxf"
BASE = TD / "preview/HT_T008_V0.2_ARCHITECT_REVIEW_BASE.png"
OUT = TD / "preview/HT_T008_V0.2_DOOR_WINDOW_REVIEW.png"
entities = list(base.entities(base.read_pairs(SRC)))
lines, polylines, arcs, texts = base.all_geometry(entities)
minx, miny, maxx, maxy = base.bounds(lines, polylines, arcs)
image = Image.open(BASE).convert("RGB")
draw = ImageDraw.Draw(image, "RGBA")
W, H, margin = image.size[0], image.size[1], 75
scale = min((W - 2 * margin) / (maxx - minx), (H - 2 * margin) / (maxy - miny))
point = lambda p: (margin + (p[0] - minx) * scale, H - margin - (p[1] - miny) * scale)
font = ImageFont.truetype("C:/Windows/Fonts/msyh.ttc", 13)
small = ImageFont.truetype("C:/Windows/Fonts/msyh.ttc", 12)

doors, windows = [], []
for kind, data in entities:
    if kind != "INSERT" or base.first(data, 8, "0") != "WINDOW":
        continue
    block = base.first(data, 2, "")
    item = {
        "handle": base.first(data, 5, ""),
        "block": block,
        "position": [base.num(data, 10), base.num(data, 20)],
        "rotation": base.num(data, 50),
    }
    (doors if "DORLIB" in block.upper() else windows).append(item)

def mark(items, prefix, color, side):
    for index, item in enumerate(items, 1):
        x, y = point(item["position"])
        label = f"{prefix}-{index:03d}"
        radius = 9 if prefix == "DR" else 8
        draw.ellipse((x-radius, y-radius, x+radius, y+radius), fill=(255,255,255,235), outline=color, width=3)
        draw.line((x-radius/2, y, x+radius/2, y), fill=color, width=2)
        if prefix == "DR":
            draw.line((x, y-radius/2, x, y+radius/2), fill=color, width=2)
        offset_x = 13 if side == "right" else -13
        anchor = "lm" if side == "right" else "rm"
        draw.text((x+offset_x, y-1), label, font=font, fill=color, anchor=anchor)

mark(doors, "DR", (215, 45, 45, 255), "right")
mark(windows, "WN", (20, 115, 195, 255), "left")

draw.rounded_rectangle((45, 108, 520, 156), 10, fill=(255,255,255,242), outline=(80,95,105,200), width=2)
draw.ellipse((64,120,80,136), fill=(255,255,255,235), outline=(215,45,45,255), width=3)
draw.text((88,128), f"门 DR：{len(doors)} 樘", font=small, fill=(180,35,35,255), anchor="lm")
draw.ellipse((250,120,266,136), fill=(255,255,255,235), outline=(20,115,195,255), width=3)
draw.text((274,128), f"窗 WN：{len(windows)} 樘", font=small, fill=(15,95,170,255), anchor="lm")
image.save(OUT)
print(f"{OUT}\ndoors={len(doors)} windows={len(windows)}")

