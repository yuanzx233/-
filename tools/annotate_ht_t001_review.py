from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import json

ROOT=Path(__file__).resolve().parents[1]
TD=ROOT/'resources/house-templates/HT-T001'
SRC=TD/'preview/HT_T001_V0.2_preview.png'
OUT=TD/'preview/HT_T001_V0.3_ARCHITECT_REVIEW_MARKUP.png'
data=json.loads((TD/'data/template.json').read_text(encoding='utf-8'))
report=json.loads((TD/'data/validation-report.json').read_text(encoding='utf-8'))
img=Image.open(SRC).convert('RGB'); d=ImageDraw.Draw(img,'RGBA')
W,H=img.size; margin=80
b=report['drawingBoundsMm']; minx,miny,maxx,maxy=b
s=min((W-2*margin)/(maxx-minx),(H-2*margin)/(maxy-miny))
def pt(p): return (margin+(p[0]-minx)*s,H-margin-(p[1]-miny)*s)
font_path=Path('C:/Windows/Fonts/msyh.ttc')
font=ImageFont.truetype(str(font_path),22); small=ImageFont.truetype(str(font_path),17); title=ImageFont.truetype(str(font_path),28)

# 1 exterior outline and vertices
outline=data['geometry']['buildingFootprint']['outline']; poly=[pt(p) for p in outline]
d.line(poly+[poly[0]],fill=(220,45,45,255),width=7)
for p in poly: d.ellipse((p[0]-11,p[1]-11,p[0]+11,p[1]+11),outline=(220,45,45,255),width=4,fill=(255,255,255,210))

# 2 room-boundary review zones around labels
for room in data['floors'][0]['rooms']:
    x,y=pt(room['labelPoint']); rx,ry=68,42
    d.ellipse((x-rx,y-ry,x+rx,y+ry),outline=(245,145,25,255),width=5,fill=(245,145,25,28))
    d.text((x-rx,y-12),room['name'],font=small,fill=(120,65,0,255))

# 3 likely wall topology junctions: exterior concave/step corners and central intersections
junctions=[[77424.38,24339.01],[77224.38,30039.01],[73324.38,26939.01],[77324.38,26939.01],[73324.38,29939.01],[77324.38,29939.01]]
for p in junctions:
    x,y=pt(p); d.ellipse((x-25,y-25,x+25,y+25),outline=(135,70,190,255),width=5)

# 4 opening candidate host associations, circle block insertion points
for opening in data['floors'][0]['openings']:
    x,y=pt(opening['insertionPoint']); col=(0,125,210,255) if opening['type']=='WINDOW' else (0,165,110,255)
    d.ellipse((x-19,y-19,x+19,y+19),outline=col,width=5)

# header and legend
d.rounded_rectangle((55,45,760,220),radius=16,fill=(255,255,255,238),outline=(30,45,55,200),width=2)
d.text((78,62),'HT-T001 建筑师复核标注图',font=title,fill=(20,35,45,255))
items=[((220,45,45),'① 外墙围合轮廓与转折点（面积83.44㎡）'),((245,145,25),'② 房间边界多边形/面积归属'),((135,70,190),'③ 墙段连接与拓扑拼接'),((0,165,110),'④ 门（候选宿主墙）'),((0,125,210),'⑤ 窗（候选宿主墙）')]
yy=105
for col,text in items:
    d.ellipse((80,yy+4,96,yy+20),fill=col+(255,)); d.text((108,yy),text,font=small,fill=(30,35,40,255)); yy+=24

d.rounded_rectangle((55,H-92,1040,H-38),radius=12,fill=(255,248,225,240),outline=(210,150,30,220),width=2)
d.text((75,H-78),'注意：门窗圈为图块基点位置，最近墙段匹配最大偏移1200mm，仅作候选，须结合原CAD人工复核。',font=small,fill=(100,65,0,255))
img.save(OUT,quality=95)
print(OUT)
