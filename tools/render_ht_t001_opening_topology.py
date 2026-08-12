from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
import json
ROOT=Path(__file__).resolve().parents[1]; TD=ROOT/'resources/house-templates/HT-T001'
img=Image.open(TD/'preview/HT_T001_V0.2_preview.png').convert('RGB'); d=ImageDraw.Draw(img,'RGBA')
t=json.loads((TD/'data/template.json').read_text(encoding='utf8')); r=json.loads((TD/'data/validation-report.json').read_text(encoding='utf8'))
W,H=img.size; margin=80; minx,miny,maxx,maxy=r['drawingBoundsMm']; s=min((W-160)/(maxx-minx),(H-160)/(maxy-miny))
def pt(p):return (80+(p[0]-minx)*s,H-80-(p[1]-miny)*s)
font=ImageFont.truetype('C:/Windows/Fonts/msyh.ttc',19); title=ImageFont.truetype('C:/Windows/Fonts/msyh.ttc',27)
for x in t['geometry']['wallTopologyRepairs']:
    px,py=pt(x['node']); d.ellipse((px-25,py-25,px+25,py+25),outline=(145,70,190,255),width=6,fill=(145,70,190,40))
combo=[o for o in t['floors'][0]['openings'] if o.get('combinationId')]
win=next(o for o in combo if o['type']=='WINDOW'); door=next(o for o in combo if o['type']=='DOOR')
wa,wb=pt(win['start']),pt(win['end']); da,db=pt(door['start']),pt(door['end'])
d.line((wa,wb),fill=(0,125,210,255),width=12); d.line((da,db),fill=(0,165,110,255),width=12)
d.text((wa[0]+20,wa[1]-42),'左：窗 1500mm',font=font,fill=(0,95,180,255)); d.text((da[0]-15,da[1]+16),'右：门 900mm',font=font,fill=(0,130,80,255))
d.rounded_rectangle((55,45,720,145),16,fill=(255,255,255,240),outline=(35,55,65,220),width=2)
d.text((78,62),'HT-T001 墙段及门联窗处理结果',font=title,fill=(20,35,45,255))
d.text((80,105),'紫圈：墙段拓扑补齐节点　蓝：窗　绿：门',font=font,fill=(50,55,60,255))
out=TD/'preview/HT_T001_V0.3_WALL_REPAIR_DOOR_WINDOW.png';img.save(out);print(out)
