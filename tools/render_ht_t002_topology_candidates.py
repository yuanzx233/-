from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
import json
ROOT=Path(__file__).resolve().parents[1];TD=ROOT/'resources/house-templates/HT-T002'
img=Image.open(TD/'preview/HT_T002_V0.3_ARCHITECT_REVIEW_BASE.png').convert('RGB');d=ImageDraw.Draw(img,'RGBA')
t=json.loads((TD/'data/template.json').read_text(encoding='utf8'));r=json.loads((TD/'data/validation-report.json').read_text(encoding='utf8'))
W,H=img.size;minx,miny,maxx,maxy=r['drawingBoundsMm'];s=min((W-150)/(maxx-minx),(H-150)/(maxy-miny));pt=lambda p:(75+(p[0]-minx)*s,H-75-(p[1]-miny)*s)
font=ImageFont.truetype('C:/Windows/Fonts/msyh.ttc',18);title=ImageFont.truetype('C:/Windows/Fonts/msyh.ttc',25)
for x in t['geometry']['wallTopologyCandidates']:
    px,py=pt(x['node']);d.ellipse((px-27,py-27,px+27,py+27),outline=(145,65,190,255),width=6,fill=(145,65,190,35));d.rounded_rectangle((px+20,py-35,px+87,py-5),7,fill=(255,255,255,235));d.text((px+28,py-32),x['id'],font=font,fill=(105,35,155,255))
d.rounded_rectangle((50,125,720,275),14,fill=(255,255,255,242),outline=(80,50,110,220),width=2);d.text((72,142),'墙段连接候选点（紫圈）',font=title,fill=(75,35,100,255));yy=180
for x in t['geometry']['wallTopologyCandidates']:
    d.text((75,yy),f"{x['id']}  {x['description']}",font=font,fill=(45,45,52,255));yy+=23
out=TD/'preview/HT_T002_V0.3_WALL_TOPOLOGY_CANDIDATES.png';img.save(out);print(out)
