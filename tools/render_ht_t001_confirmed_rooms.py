from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import json

ROOT=Path(__file__).resolve().parents[1]; TD=ROOT/'resources/house-templates/HT-T001'
img=Image.open(TD/'preview/HT_T001_V0.2_preview.png').convert('RGB'); d=ImageDraw.Draw(img,'RGBA')
data=json.loads((TD/'data/template.json').read_text(encoding='utf-8'))
report=json.loads((TD/'data/validation-report.json').read_text(encoding='utf-8'))
W,H=img.size; margin=80; minx,miny,maxx,maxy=report['drawingBoundsMm']
s=min((W-2*margin)/(maxx-minx),(H-2*margin)/(maxy-miny))
def pt(p): return (margin+(p[0]-minx)*s,H-margin-(p[1]-miny)*s)
font=ImageFont.truetype('C:/Windows/Fonts/msyh.ttc',18); title=ImageFont.truetype('C:/Windows/Fonts/msyh.ttc',27)
colors={'主卧室':(86,145,210),'卫生间':(83,181,170),'杂物间':(150,150,160),'厨房':(240,155,65),'老人房':(130,175,95),'客厅':(238,80,90),'餐厅':(245,190,45)}
for room in data['floors'][0]['rooms']:
    ps=[pt(p) for p in room['boundary']]; col=colors[room['name']]
    d.polygon(ps,fill=col+(45,)); d.line(ps+[ps[0]],fill=col+(255,),width=5)
    cx=sum(x for x,y in ps)/4; cy=sum(y for x,y in ps)/4
    label=f"{room['name']}  {room['boundaryAreaM2']:.2f}㎡"
    box=d.textbbox((0,0),label,font=font); d.rounded_rectangle((cx-(box[2]-box[0])/2-8,cy-15,cx+(box[2]-box[0])/2+8,cy+15),8,fill=(255,255,255,220))
    d.text((cx-(box[2]-box[0])/2,cy-12),label,font=font,fill=(35,40,45,255))
sb=data['geometry']['semanticBoundaries'][0]; a,b=pt(sb['start']),pt(sb['end'])
for i in range(0,20,2):
    x1=a[0]+(b[0]-a[0])*i/20; x2=a[0]+(b[0]-a[0])*(i+1)/20
    y1=a[1]+(b[1]-a[1])*i/20; y2=a[1]+(b[1]-a[1])*(i+1)/20
    d.line((x1,y1,x2,y2),fill=(210,80,20,255),width=5)
d.rounded_rectangle((55,45,690,130),16,fill=(255,255,255,240),outline=(40,60,70,220),width=2)
d.text((78,62),'HT-T001 已确认房间边界图',font=title,fill=(20,35,45,255))
d.text((80,100),'客厅—餐厅虚线为功能分界，不是实体墙',font=font,fill=(180,65,15,255))
out=TD/'preview/HT_T001_V0.3_CONFIRMED_ROOM_BOUNDARIES.png'; img.save(out); print(out)
