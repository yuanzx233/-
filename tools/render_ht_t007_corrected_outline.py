from pathlib import Path
import sys
from PIL import Image, ImageDraw, ImageFont

ROOT=Path(__file__).resolve().parents[1]; sys.path.insert(0,str(ROOT/"tools")); import import_house_template as base
TD=ROOT/"resources/house-templates/HT-T007"; SRC=TD/"source/HT_T007_V0.1_SOURCE.dxf"; OUT=TD/"preview/HT_T007_V0.3_CORRECTED_EXTERIOR_OUTLINE.png"
entities=list(base.entities(base.read_pairs(SRC))); lines,polys,arcs,texts=base.all_geometry(entities); minx,miny,maxx,maxy=base.bounds(lines,polys,arcs)
W,H,margin=1800,1100,75; image=Image.new("RGB",(W,H),"white"); draw=ImageDraw.Draw(image,"RGBA"); scale=min((W-2*margin)/(maxx-minx),(H-2*margin)/(maxy-miny)); point=lambda p:(margin+(p[0]-minx)*scale,H-margin-(p[1]-miny)*scale)
for line in lines:
 color,stroke=(22,48,65,255),3
 if line["layer"]=="AXIS": color,stroke=(160,178,188,155),1
 elif line["layer"]=="WINDOW": color,stroke=(26,125,165,255),2
 elif line["layer"]=="WALL": stroke=4
 draw.line((point(line["start"]),point(line["end"])),fill=color,width=stroke)

# Five connected exterior-wall projection components. Shared edges are omitted from the red exterior boundary.
segments=[
((-262.72,24632.46),(4437.28,24632.46)),((-262.72,20432.46),(-262.72,24632.46)),((-262.72,20432.46),(2537.28,20432.46)),((4437.28,20132.46),(4437.28,24632.46)),
((2537.28,17632.46),(2537.28,20432.46)),((2537.28,17632.46),(-262.72,17632.46)),
((-262.72,13432.46),(-262.72,17632.46)),((-262.72,13432.46),(4437.28,13432.46)),((4437.28,13432.46),(4437.28,14432.46)),
((4437.28,14432.46),(11237.28,14432.46)),((4437.28,19932.46),(4437.28,20132.46)),((4437.28,20132.46),(11237.28,20132.46)),
((11237.28,13432.46),(15437.28,13432.46)),((11237.28,13432.46),(11237.28,14432.46)),
((15437.28,13432.46),(15437.28,17632.46)),((14937.28,17632.46),(15437.28,17632.46)),
((14937.28,17632.46),(14937.28,20932.46)),((14937.28,20932.46),(15437.28,20932.46)),
((15437.28,20932.46),(15437.28,24632.46)),
((11237.28,24632.46),(15437.28,24632.46)),((11237.28,20132.46),(11237.28,24632.46)),
]
for a,b in segments: draw.line((point(a),point(b)),fill=(232,45,45,255),width=5)

# Clear open-air courtyard boundary used only as a separate area record.
courtyard=[(4437.28,20132.46),(11237.28,20132.46),(11237.28,24432.46),(4437.28,24432.46)]
cs=[point(p) for p in courtyard]; draw.line(cs+[cs[0]],fill=(15,145,165,210),width=3)
font=ImageFont.truetype("C:/Windows/Fonts/msyh.ttc",15); title=ImageFont.truetype("C:/Windows/Fonts/msyh.ttc",25)
draw.rounded_rectangle((45,35,850,118),14,fill=(255,255,255,242),outline=(35,55,65,220),width=2)
draw.text((65,48),"HT-T007 外墙外轮廓精校图",font=title,fill=(20,35,45,255)); draw.text((68,82),"红线：主体外墙外侧线围合面积 128.95㎡｜蓝线：露天庭院净面积 29.24㎡",font=font,fill=(70,80,88,255))
image.save(OUT); print(OUT)
