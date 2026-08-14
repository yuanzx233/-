from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
TD = ROOT / "resources/house-templates/HT-T006"
BASE = TD / "preview/HT_T006_V0.1_INSPECTION.png"
OUT = TD / "preview/HT_T006_V0.2_ARCHITECT_REVIEW_MARKUP.png"
image = Image.open(BASE).convert("RGB")
draw = ImageDraw.Draw(image, "RGBA")
width, height = image.size
minx, miny, maxx, maxy = 37979.06, 7606.47, 58779.06, 25406.47
margin = 75
scale = min((width - 2 * margin) / (maxx - minx), (height - 2 * margin) / (maxy - miny))

def point(p):
    return margin + (p[0] - minx) * scale, height - margin - (p[1] - miny) * scale

small = ImageFont.truetype("C:/Windows/Fonts/msyh.ttc", 15)
title = ImageFont.truetype("C:/Windows/Fonts/msyh.ttc", 25)

def zone(points, fill, outline, label):
    screen = [point(p) for p in points]
    draw.polygon(screen, fill=fill)
    draw.line(screen + [screen[0]], fill=outline, width=4)
    cx = sum(p[0] for p in screen) / len(screen)
    cy = sum(p[1] for p in screen) / len(screen)
    draw.multiline_text((cx, cy), label, font=small, fill=outline, anchor="mm", align="center")

footprint = [(42879.06, 12506.47), (54679.06, 12506.47), (54679.06, 20506.47), (42879.06, 20506.47)]
screen = [point(p) for p in footprint]
draw.line(screen + [screen[0]], fill=(225, 45, 45, 255), width=7)
zones = [
    ([(43079.06, 17506.47), (46679.06, 17506.47), (46679.06, 20306.47), (43079.06, 20306.47)], (75, 195, 125, 55), (25, 135, 75, 255), "厨房\n10.08㎡"),
    ([(46879.06, 17506.47), (50679.06, 17506.47), (50679.06, 20306.47), (46879.06, 20306.47)], (255, 165, 55, 55), (210, 105, 15, 255), "餐厅\n11.40㎡"),
    ([(50879.06, 17506.47), (54479.06, 17506.47), (54479.06, 20306.47), (50879.06, 20306.47)], (255, 215, 70, 55), (190, 135, 10, 255), "卧室一\n10.08㎡"),
    ([(43079.06, 15706.47), (45379.06, 15706.47), (45379.06, 17306.47), (43079.06, 17306.47)], (75, 170, 255, 55), (25, 115, 195, 255), "卫生间一\n3.68㎡"),
    ([(52179.06, 15706.47), (54479.06, 15706.47), (54479.06, 17306.47), (52179.06, 17306.47)], (75, 170, 255, 55), (25, 115, 195, 255), "卫生间二\n3.68㎡"),
    ([(43079.06, 12706.47), (46679.06, 12706.47), (46679.06, 15506.47), (43079.06, 15506.47)], (255, 215, 70, 55), (190, 135, 10, 255), "卧室二\n10.08㎡"),
    ([(46879.06, 12706.47), (50679.06, 12706.47), (50679.06, 17306.47), (46879.06, 17306.47)], (90, 220, 110, 45), (25, 155, 65, 255), "客厅\n17.48㎡\n边界待确认"),
    ([(50879.06, 12706.47), (54479.06, 12706.47), (54479.06, 15506.47), (50879.06, 15506.47)], (255, 95, 95, 55), (210, 45, 45, 255), "卧室三\n10.08㎡"),
]
for args in zones: zone(*args)
for location, text in [((48779.06, 17406.47), "① 客厅/餐厅连接及边界"), ((42879.06, 16506.47), "② 墙段断点自动补齐"), ((54679.06, 16506.47), "③ 门窗及门联窗复核")]:
    x, y = point(location)
    draw.ellipse((x - 13, y - 13, x + 13, y + 13), fill=(235, 55, 45, 245))
    draw.text((x + 18, y - 10), text, font=small, fill=(170, 25, 20, 255))
draw.rounded_rectangle((45, 35, 760, 116), 14, fill=(255, 255, 255, 242), outline=(35, 55, 65, 220), width=2)
draw.text((65, 48), "HT-T006 建筑师复核标注图", font=title, fill=(20, 35, 45, 255))
draw.text((68, 82), "红线：候选主体外墙轮廓；彩色区域：自动识别的候选房间边界", font=small, fill=(70, 80, 88, 255))
image.save(OUT)
print(OUT)
