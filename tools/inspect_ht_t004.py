from pathlib import Path
from collections import Counter
import json,re,sys
from PIL import Image,ImageDraw,ImageFont
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT/'tools'));import import_house_template as base
TD=ROOT/'resources/house-templates/HT-T004';SRC=TD/'source/HT_T004_V0.1_SOURCE.dxf';OUT=TD/'preview/HT_T004_V0.1_INSPECTION.png'
ents=list(base.entities(base.read_pairs(SRC)));lines,polys,arcs,texts=base.all_geometry(ents);b=base.bounds(lines,polys,arcs)
W,H=1800,1100;margin=75;img=Image.new('RGB',(W,H),'white');d=ImageDraw.Draw(img,'RGBA');minx,miny,maxx,maxy=b;s=min((W-150)/(maxx-minx),(H-150)/(maxy-miny));pt=lambda p:(75+(p[0]-minx)*s,H-75-(p[1]-miny)*s)
for x in lines:
 col=(22,48,65,255);w=3
 if x['layer']=='AXIS':col=(150,170,180,175);w=1
 elif x['layer']=='WINDOW':col=(25,135,175,255);w=2
 elif x['layer']=='WALL':w=4
 d.line((pt(x['start']),pt(x['end'])),fill=col,width=w)
font=ImageFont.truetype('C:/Windows/Fonts/msyh.ttc',16);title=ImageFont.truetype('C:/Windows/Fonts/msyh.ttc',26)
for t in texts:
 if t['layer']=='SPACE' and (re.fullmatch(r'[0-9.]+m',t['value']) or not t['value'].isdigit()):
  x,y=pt(t['position']);d.ellipse((x-5,y-5,x+5,y+5),fill=(225,70,45,255));d.text((x+7,y-9),t['value'],font=font,fill=(165,35,20,255))
d.rounded_rectangle((45,35,545,91),13,fill=(255,255,255,240),outline=(30,50,60,220),width=2);d.text((65,48),'HT-T004 原始几何与空间检查',font=title,fill=(20,35,45,255));img.save(OUT)
report={'source':str(SRC.relative_to(ROOT)),'acadVersion':'AC1032','entityTypes':dict(Counter(t for t,_ in ents)),'layers':dict(Counter(base.first(x,8,'0') for _,x in ents)),'tchEntityCount':sum(1 for t,_ in ents if t.startswith('TCH_')),'drawingBoundsMm':b,'spaceTexts':[x for x in texts if x['layer']=='SPACE']}
(TD/'data/inspection-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf8');print(OUT)
