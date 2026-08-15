from pathlib import Path
import sys
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "tools"))
import import_house_template as base

TD = ROOT / "resources/house-templates/HT-T007"
SRC = TD / "source/HT_T007_V0.1_SOURCE.dxf"
OUT = TD / "preview/HT_T007_V0.4_ROOM_BOUNDARY_REVIEW.png"
entities = list(base.entities(base.read_pairs(SRC)))
lines, polys, arcs, texts = base.all_geometry(entities)
minx, miny, maxx, maxy = base.bounds(lines, polys, arcs)
W, H, margin = 2000, 1250, 85
image = Image.new("RGB", (W, H), "white")
draw = ImageDraw.Draw(image, "RGBA")
scale = min((W-2*margin)/(maxx-minx), (H-2*margin)/(maxy-miny))
point = lambda p: (margin+(p[0]-minx)*scale, H-margin-(p[1]-miny)*scale)

for line in lines:
    color, width = (28, 50, 63, 255), 3
    if line["layer"] == "AXIS": color, width = (165, 180, 188, 125), 1
    elif line["layer"] == "WINDOW": color, width = (25, 130, 170, 255), 2
    elif line["layer"] == "WALL": width = 4
    draw.line((point(line["start"]), point(line["end"])), fill=color, width=width)

font = ImageFont.truetype("C:/Windows/Fonts/msyh.ttc", 17)
small = ImageFont.truetype("C:/Windows/Fonts/msyh.ttc", 14)
title = ImageFont.truetype("C:/Windows/Fonts/msyh.ttc", 27)

def room(name, area, bounds, fill, stroke):
    x1,y1,x2,y2=bounds
    pts=[point((x1,y1)),point((x2,y1)),point((x2,y2)),point((x1,y2))]
    draw.polygon(pts, fill=fill)
    draw.line(pts+[pts[0]], fill=stroke, width=4)
    cx,cy=point(((x1+x2)/2,(y1+y2)/2))
    label=f"{name}\n{area:.2f}㎡"
    draw.multiline_text((cx,cy),label,font=font,fill=stroke,anchor="mm",align="center",spacing=3)

# All bounds use the room-side face of WALL lines and reproduce the source area labels.
room("健身房",9.88,(-62.72,20632.46,2537.28,24432.46),(150,105,225,48),(100,55,175,255))
room("卫生间一",3.75,(2737.28,21932.46,4237.28,24432.46),(70,165,245,52),(20,105,185,255))
room("卧室一",12.54,(11437.28,21132.46,15237.28,24432.46),(250,190,70,48),(180,120,10,255))
room("卫生间二",5.94,(12937.28,17632.46,14737.28,20932.46),(70,165,245,52),(20,105,185,255))
room("卧室二",14.44,(11437.28,13632.46,15237.28,17432.46),(245,105,90,48),(195,45,35,255))
room("卧室三",9.88,(-62.72,13632.46,2537.28,17432.46),(250,190,70,48),(180,120,10,255))
room("书房",5.70,(2737.28,13632.46,4237.28,17432.46),(105,195,205,52),(15,125,140,255))
room("玄关",4.20,(2737.28,17632.46,4237.28,20432.46),(215,165,85,52),(145,90,15,255))
room("厨房",7.00,(9237.28,14632.46,11237.28,18132.46),(95,190,120,52),(20,125,60,255))
room("餐客厅",24.38,(4437.28,14632.46,9037.28,19932.46),(100,215,115,52),(20,145,55,255))
room("露天庭院",29.24,(4437.28,20132.46,11237.28,24432.46),(65,195,215,48),(5,125,150,255))

# Confirmed principal-building exterior boundary; courtyard is excluded.
outer=[(-262.72,24632.46),(4437.28,24632.46),(4437.28,20132.46),(11237.28,20132.46),(11237.28,24632.46),(15437.28,24632.46),(15437.28,20932.46),(14937.28,20932.46),(14937.28,17632.46),(15437.28,17632.46),(15437.28,13432.46),(11237.28,13432.46),(11237.28,14432.46),(4437.28,14432.46),(4437.28,13432.46),(-262.72,13432.46),(-262.72,17632.46),(2537.28,17632.46),(2537.28,20432.46),(-262.72,20432.46)]
op=[point(p) for p in outer]
draw.line(op+[op[0]],fill=(230,38,38,255),width=6)

draw.rounded_rectangle((45,32,1010,127),14,fill=(255,255,255,244),outline=(35,55,65,220),width=2)
draw.text((66,45),"HT-T007 房间范围与建筑面积校对图",font=title,fill=(20,35,45,255))
draw.text((68,82),"红线：已确认主体外墙轮廓 128.95㎡｜彩色框：房间净边界｜露天庭院 29.24㎡不计建筑面积",font=small,fill=(65,75,83,255))
draw.text((68,104),"房间边界依据墙体内侧线闭合；门窗洞口按所在墙线连续处理。",font=small,fill=(65,75,83,255))
image.save(OUT)
print(OUT)
