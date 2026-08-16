from pathlib import Path
from collections import Counter
import json,sys
from PIL import Image,ImageDraw,ImageFont
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT/'tools'))
import import_house_template as base
TD=ROOT/'resources/house-templates/HT-T012';SRC=TD/'source/HT_T012_V0.1_SOURCE.dxf';OUT=TD/'preview/HT_T012_V0.1_TWO_FLOOR_REVIEW_BASE.png'
ents=list(base.entities(base.read_pairs(SRC)));lines,polys,arcs,texts=base.all_geometry(ents);bounds=base.bounds(lines,polys,arcs)
panels=[('一层平面图',(20500,-1000,40500,12000)),('二层平面图',(74600,-1000,94600,12000))]
W,H=1800,900;im=Image.new('RGB',(W,H),'white');d=ImageDraw.Draw(im,'RGBA');font=ImageFont.truetype('C:/Windows/Fonts/msyh.ttc',20);title=ImageFont.truetype('C:/Windows/Fonts/msyh.ttc',30);small=ImageFont.truetype('C:/Windows/Fonts/msyh.ttc',15)
d.text((45,25),'HT-T012 二层六房｜一层、二层独立复核底图',font=title,fill=(20,35,45));d.text((48,66),'深蓝=墙体｜青色=门窗｜紫色=楼梯｜灰色=轴线；两层须分别确认外墙、房间与楼梯关系',font=small,fill=(70,80,88))
for idx,(name,(minx,miny,maxx,maxy)) in enumerate(panels):
 x0=45+idx*875;y0=115;pw=830;ph=690;s=min((pw-50)/(maxx-minx),(ph-70)/(maxy-miny));pt=lambda p:(x0+25+(p[0]-minx)*s,y0+ph-35-(p[1]-miny)*s)
 d.rounded_rectangle((x0,y0,x0+pw,y0+ph),12,fill=(250,252,253),outline=(95,115,125),width=2);d.text((x0+22,y0+15),name,font=font,fill=(20,45,60))
 for ln in lines:
  sx,sy=ln['start'];ex,ey=ln['end'];
  if max(sx,ex)<minx or min(sx,ex)>maxx or max(sy,ey)<miny or min(sy,ey)>maxy: continue
  layer=ln['layer'];color=(20,48,65,255);width=3
  if layer=='AXIS':color,width=(155,170,180,150),1
  elif layer=='WINDOW':color,width=(20,145,180,255),2
  elif layer=='STAIR':color,width=(120,60,165,255),2
  elif layer=='COLUMN':color,width=(80,80,80,255),3
  d.line((pt((sx,sy)),pt((ex,ey))),fill=color,width=width)
 for kind,data in ents:
  if kind!='INSERT' or base.first(data,8,'')!='WINDOW':continue
  x,y=base.num(data,10),base.num(data,20)
  if minx<=x<=maxx and miny<=y<=maxy:
   q=pt((x,y));d.ellipse((q[0]-4,q[1]-4,q[0]+4,q[1]+4),fill=(235,65,45,255))
report={'source':str(SRC.relative_to(ROOT)),'acadVersion':'AC1032','entityTypes':dict(Counter(k for k,_ in ents)),'layers':dict(Counter(base.first(x,8,'0') for _,x in ents)),'tchEntityCount':sum(1 for k,_ in ents if k.startswith('TCH_')),'drawingBoundsMm':bounds,'floorRegions':[{'floor':n,'bounds':list(b)} for n,b in panels]}
(TD/'data/inspection-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8');im.save(OUT);print(OUT)

