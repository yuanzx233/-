from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
import json
ROOT=Path(__file__).resolve().parents[1];TD=ROOT/'resources/house-templates/HT-T002'
img=Image.open(TD/'preview/HT_T002_V0.3_ARCHITECT_REVIEW_BASE.png').convert('RGB');d=ImageDraw.Draw(img,'RGBA')
t=json.loads((TD/'data/template.json').read_text(encoding='utf8'));r=json.loads((TD/'data/validation-report.json').read_text(encoding='utf8'))
W,H=img.size;minx,miny,maxx,maxy=r['drawingBoundsMm'];s=min((W-150)/(maxx-minx),(H-150)/(maxy-miny));pt=lambda p:(75+(p[0]-minx)*s,H-75-(p[1]-miny)*s)
font=ImageFont.truetype('C:/Windows/Fonts/msyh.ttc',18);title=ImageFont.truetype('C:/Windows/Fonts/msyh.ttc',25)
for x in t['geometry']['wallTopologyRepairs']:
    px,py=pt(x['node']);d.ellipse((px-25,py-25,px+25,py+25),outline=(30,160,95,255),width=6,fill=(30,160,95,35));d.text((px+27,py-14),x['id'],font=font,fill=(15,120,70,255))
for x in t['geometry']['retainedWallBreaks']:
    px,py=pt(x['node']);d.rectangle((px-24,py-24,px+24,py+24),outline=(225,135,25,255),width=6);d.text((px+27,py-14),x['id'],font=font,fill=(170,90,0,255))
d.rounded_rectangle((50,125,690,240),14,fill=(255,255,255,242),outline=(45,75,65,220),width=2);d.text((72,142),'墙段拓扑处理结果',font=title,fill=(30,55,45,255));d.text((75,180),'绿圈：TC-01、TC-03、TC-04 自动补齐',font=font,fill=(15,120,70,255));d.text((75,207),'橙框：TC-02 保留设计断点，不补齐',font=font,fill=(170,90,0,255))
out=TD/'preview/HT_T002_V1.0_WALL_TOPOLOGY_RESULT.png';img.save(out);print(out)
