from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
TD = ROOT / "resources/house-templates/HT-T005"
BASE = TD / "preview/HT_T005_V0.1_INSPECTION.png"
OUT = TD / "preview/HT_T005_V0.2_ARCHITECT_REVIEW_MARKUP.png"

image = Image.open(BASE).convert("RGB")
draw = ImageDraw.Draw(image, "RGBA")
width, height = image.size
minx, miny, maxx, maxy = 117884.48, -8021.54, 145384.48, 14478.46
margin = 75
scale = min((width - 2 * margin) / (maxx - minx), (height - 2 * margin) / (maxy - miny))


def point(p):
    return margin + (p[0] - minx) * scale, height - margin - (p[1] - miny) * scale


def polygon(points, fill, outline, label):
    screen = [point(p) for p in points]
    draw.polygon(screen, fill=fill)
    draw.line(screen + [screen[0]], fill=outline, width=4)
    cx = sum(p[0] for p in screen) / len(screen)
    cy = sum(p[1] for p in screen) / len(screen)
    draw.text((cx, cy), label, font=small, fill=outline, anchor="mm")


font = ImageFont.truetype("C:/Windows/Fonts/msyh.ttc", 22)
small = ImageFont.truetype("C:/Windows/Fonts/msyh.ttc", 15)
tiny = ImageFont.truetype("C:/Windows/Fonts/msyh.ttc", 13)

outline = [(126284.48, -3121.54), (137484.48, -3121.54), (137484.48, 9578.46), (126284.48, 9578.46)]
screen_outline = [point(p) for p in outline]
draw.line(screen_outline + [screen_outline[0]], fill=(225, 45, 45, 255), width=7)

zones = [
    ([(126484.48, 6778.46), (130484.48, 6778.46), (130484.48, 9378.46), (126484.48, 9378.46)], (255, 215, 70, 55), (190, 135, 10, 255), "卧室 10.40㎡"),
    ([(130684.48, 6778.46), (132284.48, 6778.46), (132284.48, 9378.46), (130684.48, 9378.46)], (75, 170, 255, 55), (25, 115, 195, 255), "卫生间 4.16㎡"),
    ([(132484.48, 5078.46), (137284.48, 5078.46), (137284.48, 9378.46), (132484.48, 9378.46)], (255, 95, 95, 55), (210, 45, 45, 255), "主卧 20.64㎡"),
    ([(126484.48, 5078.46), (129084.48, 5078.46), (129084.48, 6578.46), (126484.48, 6578.46)], (75, 170, 255, 55), (25, 115, 195, 255), "卫生间 3.90㎡"),
    ([(126484.48, 1878.46), (130284.48, 1878.46), (130284.48, 4878.46), (126484.48, 4878.46)], (255, 215, 70, 55), (190, 135, 10, 255), "卧室 11.40㎡"),
    ([(126484.48, 578.46), (130284.48, 578.46), (130284.48, 1678.46), (126484.48, 1678.46)], (135, 105, 220, 55), (105, 60, 180, 255), "储藏室 4.18㎡"),
    ([(126484.48, -2921.54), (130284.48, -2921.54), (130284.48, 378.46), (126484.48, 378.46)], (75, 195, 125, 55), (25, 135, 75, 255), "厨房 12.54㎡"),
    ([(130684.48, -2921.54), (134484.48, -2921.54), (134484.48, 378.46), (130684.48, 378.46)], (255, 165, 55, 55), (210, 105, 15, 255), "餐厅 12.60㎡"),
    ([(134484.48, -2921.54), (137284.48, -2921.54), (137284.48, 378.46), (134484.48, 378.46)], (95, 205, 205, 55), (15, 135, 145, 255), "书房 9.24㎡"),
    ([(130684.48, 578.46), (137284.48, 578.46), (137284.48, 4878.46), (130684.48, 4878.46)], (90, 220, 110, 45), (25, 155, 65, 255), "客厅 26.23㎡\n边界待确认"),
]
for args in zones:
    polygon(*args)

callouts = [
    ((137484.48, 2588.46), "① 门廊是否不计建筑面积"),
    ((130584.48, 478.46), "② 客厅/餐厅边界"),
    ((126384.48, 4878.46), "③ 墙段断点处理原则"),
    ((137384.48, 378.46), "④ 门窗及门联窗复核"),
]
for location, text in callouts:
    x, y = point(location)
    draw.ellipse((x - 13, y - 13, x + 13, y + 13), fill=(235, 55, 45, 245))
    draw.text((x + 18, y - 10), text, font=tiny, fill=(170, 25, 20, 255))

draw.rounded_rectangle((45, 35, 760, 116), 14, fill=(255, 255, 255, 242), outline=(35, 55, 65, 220), width=2)
draw.text((65, 48), "HT-T005 建筑师复核标注图", font=font, fill=(20, 35, 45, 255))
draw.text((68, 82), "红线：候选外墙围合轮廓；彩色区域：自动识别的候选房间边界", font=small, fill=(70, 80, 88, 255))
image.save(OUT)
print(OUT)
