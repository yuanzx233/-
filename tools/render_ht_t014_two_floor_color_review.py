from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
TD = ROOT / "resources/house-templates/HT-T014"
OUT = TD / "preview/HT_T014_V0.2_TWO_FLOOR_COLOR_REVIEW.png"
im = Image.open(TD / "preview/HT_T014_V0.1_TWO_FLOOR_REVIEW_BASE.png").convert("RGB")
d = ImageDraw.Draw(im, "RGBA")
font = ImageFont.truetype("C:/Windows/Fonts/msyh.ttc", 13)
panels = [(45,115,30000,-2500,45500,10500),(920,115,63700,-2500,79200,10500)]
pw, ph = 830, 690
def mapper(p):
    x0,y0,minx,miny,maxx,maxy=p; s=min((pw-50)/(maxx-minx),(ph-70)/(maxy-miny))
    return lambda q:(x0+25+(q[0]-minx)*s,y0+ph-35-(q[1]-miny)*s)
colors=[(35,125,210,255),(225,145,45,255),(115,70,190,255),(35,155,85,255),(220,70,75,255),(25,150,180,255),(165,115,55,255)]
def zone(mp,name,area,poly,c):
    p=[mp(x) for x in poly]; d.polygon(p,fill=c[:3]+(52,)); d.line(p+[p[0]],fill=c,width=4)
    cx=sum(x for x,y in p)/len(p); cy=sum(y for x,y in p)/len(p)
    label=name if area is None else f"{name}\n{area:.2f}㎡"
    d.multiline_text((cx,cy),label,font=font,fill=c,anchor="mm",align="center")
mp=mapper(panels[0])
f1=[
 ("楼梯间",8.97,[(31806.44,5330.62),(34106.44,5330.62),(34106.44,9230.62),(31806.44,9230.62)]),
 ("卫生间一",5.55,[(34306.44,5530.62),(35806.44,5530.62),(35806.44,9230.62),(34306.44,9230.62)]),
 ("客厅",21.00,[(36006.44,4230.62),(40206.44,4230.62),(40206.44,9230.62),(36006.44,9230.62)]),
 ("卧室一",18.50,[(40406.44,4230.62),(44106.44,4230.62),(44106.44,9230.62),(40406.44,9230.62)]),
 ("餐厅",12.40,[(31806.44,930.62),(35806.44,930.62),(35806.44,4030.62),(31806.44,4030.62)]),
 ("厨房",9.20,[(31806.44,-1569.38),(35806.44,-1569.38),(35806.44,730.62),(31806.44,730.62)])]
for i,x in enumerate(f1): zone(mp,*x,colors[i])
outer=[mp(x) for x in [(31606.44,9430.62),(44306.44,9430.62),(44306.44,4030.62),(36006.44,4030.62),(36006.44,-1769.38),(31606.44,-1769.38)]]
d.line(outer+[outer[0]],fill=(230,35,35,255),width=6)
porch=[mp(x) for x in [(36006.44,2530.62),(44106.44,2530.62),(44106.44,4030.62),(36006.44,4030.62)]]
d.polygon(porch,fill=(165,115,55,35)); d.line(porch+[porch[0]],fill=(165,115,55,255),width=4)
d.multiline_text(mp((40056.44,3280.62)),"门廊\n不计入主体",font=font,fill=(150,80,25,255),anchor="mm",align="center")
mp=mapper(panels[1])
f2=[
 ("楼梯间",9.11,[(65546.02,5330.62),(67846.02,5330.62),(67846.02,9230.62),(65546.02,9230.62)]),
 ("卫生间二",5.55,[(68046.02,5530.62),(69546.02,5530.62),(69546.02,9230.62),(68046.02,9230.62)]),
 ("卧室二",21.00,[(69746.02,4230.62),(73946.02,4230.62),(73946.02,9230.62),(69746.02,9230.62)]),
 ("卧室三",18.50,[(74146.02,4230.62),(77846.02,4230.62),(77846.02,9230.62),(74146.02,9230.62)]),
 ("过厅",10.40,[(65546.02,2730.62),(69546.02,2730.62),(69546.02,5330.62),(65546.02,5330.62)])]
for i,x in enumerate(f2): zone(mp,*x,colors[i])
outer=[mp(x) for x in [(65346.02,9430.62),(78046.02,9430.62),(78046.02,2530.62),(65346.02,2530.62)]]
d.line(outer+[outer[0]],fill=(230,35,35,255),width=6)
terr=[mp(x) for x in [(65546.02,-1569.38),(69546.02,-1569.38),(69546.02,2530.62),(65546.02,2530.62)]]
d.polygon(terr,fill=(165,115,55,35)); d.line(terr+[terr[0]],fill=(165,115,55,255),width=4)
d.multiline_text(mp((67546.02,480.62)),"露台\n不计入主体",font=font,fill=(150,80,25,255),anchor="mm",align="center")
im.save(OUT)
print(OUT)
