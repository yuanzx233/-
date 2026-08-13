from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import json

ROOT=Path(__file__).resolve().parents[1]
TD=ROOT/'resources/house-templates/HT-T003'
BASE=TD/'preview/HT_T003_V0.3_ARCHITECT_REVIEW_BASE.png'
OUT=TD/'preview/HT_T003_V0.3_ARCHITECT_REVIEW_MARKUP.png'
t=json.loads((TD/'data/template.json').read_text(encoding='utf8'))
r=json.loads((TD/'data/validation-report.json').read_text(encoding='utf8'))
img=Image.open(BASE).convert('RGB');d=ImageDraw.Draw(img,'RGBA')
W,H=img.size;minx,miny,maxx,maxy=r['drawingBoundsMm'];s=min((W-150)/(maxx-minx),(H-150)/(maxy-miny))
def pt(p):return (75+(p[0]-minx)*s,H-75-(p[1]-miny)*s)
font=ImageFont.truetype('C:/Windows/Fonts/msyh.ttc',17)
small=ImageFont.truetype('C:/Windows/Fonts/msyh.ttc',15)
title=ImageFont.truetype('C:/Windows/Fonts/msyh.ttc',24)

# 1 Exterior footprint.
outline=t['geometry']['buildingFootprint']['outline'];q=[pt(x) for x in outline]
d.line(q+[q[0]],fill=(220,45,45,255),width=7)
for x,y in q:d.ellipse((x-9,y-9,x+9,y+9),fill=(255,255,255,220),outline=(220,45,45,255),width=4)

# 2 Room boundaries.
for room in t['floors'][0]['rooms']:
    q=[pt(x) for x in room['boundary']]
    d.line(q+[q[0]],fill=(235,145,25,255),width=4)

# 3 Candidate wall junctions; openings are deliberately excluded.
candidates=[
 ('TC-01',[73796.75,-12312.43],'客厅/餐厅西墙与卧室一、卫生间分隔墙交接'),
 ('TC-02',[73796.75,-10112.43],'餐厅/厨房西墙与卧室二、卫生间分隔墙交接'),
 ('TC-03',[69796.75,-12312.43],'卧室一外墙与卫生间分隔墙交接'),
 ('TC-04',[69796.75,-10112.43],'卧室二外墙与卫生间分隔墙交接')]
for ident,p,desc in candidates:
    x,y=pt(p);d.ellipse((x-24,y-24,x+24,y+24),outline=(135,65,190,255),width=6,fill=(135,65,190,35));d.text((x+25,y-13),ident,font=small,fill=(100,35,150,255))

# 4 Door/window block insertion points.
for opening in t['floors'][0]['openings']:
    x,y=pt(opening['insertionPoint']);col=(0,160,100,255) if opening['type']=='DOOR' else (0,120,205,255)
    d.ellipse((x-17,y-17,x+17,y+17),outline=col,width=5)

# 5 Entrance canopy outside footprint.
canopy=[[73696.75,-16412.43],[77896.75,-16412.43],[77896.75,-18412.43],[73696.75,-18412.43]]
cq=[pt(x) for x in canopy];d.polygon(cq,fill=(70,140,210,35));d.line(cq+[cq[0]],fill=(70,140,210,210),width=4)
cx=sum(x for x,y in cq)/4;cy=sum(y for x,y in cq)/4;d.text((cx-72,cy-10),'入口雨棚（不计面积）',font=small,fill=(35,95,155,255))

# Legend.
d.rounded_rectangle((42,112,690,302),14,fill=(255,255,255,242),outline=(35,55,65,220),width=2)
d.text((62,128),'HT-T003 建筑师复核项目',font=title,fill=(25,40,50,255))
items=[((220,45,45),'① 外墙围合轮廓及85.28㎡建筑面积'),((235,145,25),'② 6个房间位置、边界和面积'),((135,65,190),'③ TC-01～TC-04墙段连接候选点'),((0,160,100),'④ 门：4樘，确认位置及类型'),((0,120,205),'⑤ 窗：5樘，确认位置及类型'),((70,140,210),'⑥ 入口雨棚不计入建筑面积')]
yy=166
for col,text in items:
    d.ellipse((65,yy+3,81,yy+19),fill=col+(255,));d.text((92,yy),text,font=font,fill=(42,47,52,255));yy+=24
img.save(OUT)
(TD/'data/review-candidates.json').write_text(json.dumps({'templateId':'HT-T003','wallTopologyCandidates':[{'id':i,'node':p,'description':x,'status':'REVIEW_REQUIRED'} for i,p,x in candidates],'openingReview':{'doors':4,'windows':5,'doorWindowCombination':'REVIEW_REQUIRED'},'canopyAreaRule':'EXCLUDED_FROM_BUILDING_AREA_REVIEW_REQUIRED'},ensure_ascii=False,indent=2),encoding='utf8')
print(OUT)
