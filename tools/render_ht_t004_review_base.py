from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
import json,sys
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT/'tools'));import import_house_template as base
TD=ROOT/'resources/house-templates/HT-T004';SRC=TD/'normalized/HT_T004_V0.3_STANDARDIZED_AC1032.dxf';OUT=TD/'preview/HT_T004_V0.3_ARCHITECT_REVIEW_BASE.png'
ents=list(base.entities(base.read_pairs(SRC)));lines,polys,arcs,texts=base.all_geometry(ents);b=base.bounds(lines,polys,arcs);r=json.loads((TD/'data/validation-report.json').read_text(encoding='utf8'))
W,H=1800,1100;margin=75;img=Image.new('RGB',(W,H),'white');d=ImageDraw.Draw(img,'RGBA');minx,miny,maxx,maxy=b;s=min((W-150)/(maxx-minx),(H-150)/(maxy-miny));pt=lambda p:(75+(p[0]-minx)*s,H-75-(p[1]-miny)*s)
for x in lines:
 col=(22,48,65,255);w=3
 if 'AXIS' in x['layer']:col=(155,172,182,175);w=1
 elif 'WIND' in x['layer']:col=(25,135,175,255);w=2
 elif 'WALL' in x['layer']:w=4
 d.line((pt(x['start']),pt(x['end'])),fill=col,width=w)
font=ImageFont.truetype('C:/Windows/Fonts/msyh.ttc',15);small=ImageFont.truetype('C:/Windows/Fonts/msyh.ttc',14);title=ImageFont.truetype('C:/Windows/Fonts/msyh.ttc',25)
for room in r['rooms']:
 x,y=pt(room['labelPoint']);area='' if room['area'] is None else f"\n{room['area']:.2f}㎡";label=room['name']+area;bb=d.multiline_textbbox((0,0),label,font=font,spacing=2,align='center');tw=bb[2]-bb[0];th=bb[3]-bb[1];d.rounded_rectangle((x-tw/2-6,y-th/2-5,x+tw/2+6,y+th/2+5),7,fill=(255,255,255,225));d.multiline_text((x-tw/2,y-th/2),label,font=font,fill=(35,42,48,255),spacing=2,align='center')
d.rounded_rectangle((45,35,650,104),14,fill=(255,255,255,240),outline=(35,55,65,210),width=2);d.text((65,48),'HT-T004 建筑师复核底图',font=title,fill=(20,35,45,255));d.text((68,78),'单位：mm　建筑面积待复核：136.80㎡',font=small,fill=(70,80,88,255));img.save(OUT);print(OUT)
