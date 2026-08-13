from pathlib import Path
from collections import Counter
import json, re, sys
from PIL import Image, ImageDraw, ImageFont

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'tools'))
import import_house_template as base

TD=ROOT/'resources/house-templates/HT-T002'
SRC=TD/'source/HT_T002_V0.1_T3_SOURCE.dxf'
OUT=TD/'preview/HT_T002_V0.1_INSPECTION.png'
pairs=base.read_pairs(SRC); ents=list(base.entities(pairs))
lines,polys,arcs,texts=base.all_geometry(ents); b=base.bounds(lines,polys,arcs)
W,H=1800,1200; margin=80; img=Image.new('RGB',(W,H),'white');d=ImageDraw.Draw(img,'RGBA')
minx,miny,maxx,maxy=b;s=min((W-160)/(maxx-minx),(H-160)/(maxy-miny))
def pt(p):return (80+(p[0]-minx)*s,H-80-(p[1]-miny)*s)
colors={'WALL':(20,45,63,255),'WINDOW':(30,145,180,255),'AXIS':(160,175,185,180)}
for x in lines:d.line((pt(x['start']),pt(x['end'])),fill=colors.get(x['layer'],(80,100,110,255)),width=4 if x['layer']=='WALL' else 2)
for p in polys:
    q=[pt(x) for x in p['points']]
    if len(q)>1:d.line(q+([q[0]] if p['closed'] else []),fill=colors.get(p['layer'],(80,100,110,255)),width=3)
font=ImageFont.truetype('C:/Windows/Fonts/msyh.ttc',19);title=ImageFont.truetype('C:/Windows/Fonts/msyh.ttc',28)
for t in texts:
    if t['layer']=='SPACE' and (re.fullmatch(r'[0-9.]+m',t['value']) or (not t['value'].isdigit())):
        x,y=pt(t['position']);d.ellipse((x-7,y-7,x+7,y+7),fill=(230,80,50,255));d.text((x+9,y-12),t['value'],font=font,fill=(170,35,20,255))
d.rounded_rectangle((45,35,560,95),14,fill=(255,255,255,240),outline=(30,50,60,220),width=2);d.text((65,50),'HT-T002 原始几何与空间文字检查',font=title,fill=(20,35,45,255))
img.save(OUT)
report={'source':str(SRC.relative_to(ROOT)),'acadVersion':'AC1032','entityTypes':dict(Counter(t for t,_ in ents)),'layers':dict(Counter(base.first(x,8,'0') for _,x in ents)),'tchEntityCount':sum(1 for t,_ in ents if t.startswith('TCH_')),'drawingBoundsMm':b,'spaceTexts':[x for x in texts if x['layer']=='SPACE']}
(TD/'data/inspection-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf8')
print(OUT)
