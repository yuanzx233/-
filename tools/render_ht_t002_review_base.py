from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
import json,sys

ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT/'tools'))
import import_house_template as base
TD=ROOT/'resources/house-templates/HT-T002'
SRC=TD/'normalized/HT_T002_V0.3_STANDARDIZED_AC1032.dxf'
OUT=TD/'preview/HT_T002_V0.3_ARCHITECT_REVIEW_BASE.png'
ents=list(base.entities(base.read_pairs(SRC)));lines,polys,arcs,texts=base.all_geometry(ents);b=base.bounds(lines,polys,arcs)
report=json.loads((TD/'data/validation-report.json').read_text(encoding='utf8'))
W,H=1800,1200;margin=75;img=Image.new('RGB',(W,H),'white');d=ImageDraw.Draw(img,'RGBA')
minx,miny,maxx,maxy=b;s=min((W-2*margin)/(maxx-minx),(H-2*margin)/(maxy-miny))
def pt(p):return (margin+(p[0]-minx)*s,H-margin-(p[1]-miny)*s)
for x in lines:
    layer=x['layer'];col=(22,48,65,255);width=3
    if 'AXIS' in layer:col=(155,172,182,175);width=1
    elif 'WIND' in layer:col=(25,135,175,255);width=2
    elif 'WALL' in layer:width=4
    d.line((pt(x['start']),pt(x['end'])),fill=col,width=width)
for p in polys:
    q=[pt(x) for x in p['points']]
    if len(q)>1:d.line(q+([q[0]] if p['closed'] else []),fill=(35,85,105,255),width=2)
# Curved door swing geometry, if present.
for a in arcs:
    cx,cy=pt(a['center']);rr=a['radius']*s
    d.arc((cx-rr,cy-rr,cx+rr,cy+rr),start=360-a['endAngle'],end=360-a['startAngle'],fill=(35,85,105,255),width=2)
font=ImageFont.truetype('C:/Windows/Fonts/msyh.ttc',19);small=ImageFont.truetype('C:/Windows/Fonts/msyh.ttc',15);title=ImageFont.truetype('C:/Windows/Fonts/msyh.ttc',27)
for room in report['rooms']:
    x,y=pt(room['labelPoint']);label=f"{room['name']}\n{room['area']:.2f}㎡";bb=d.multiline_textbbox((0,0),label,font=font,spacing=4,align='center');tw=bb[2]-bb[0];th=bb[3]-bb[1]
    d.rounded_rectangle((x-tw/2-9,y-th/2-7,x+tw/2+9,y+th/2+7),8,fill=(255,255,255,225));d.multiline_text((x-tw/2,y-th/2),label,font=font,fill=(35,42,48,255),spacing=4,align='center')
d.rounded_rectangle((50,38,615,112),14,fill=(255,255,255,240),outline=(35,55,65,210),width=2)
d.text((72,55),'HT-T002 建筑师复核底图',font=title,fill=(20,35,45,255));d.text((74,88),'单位：mm　建筑面积待复核：86.37㎡',font=small,fill=(70,80,88,255))
img.save(OUT);print(OUT)
