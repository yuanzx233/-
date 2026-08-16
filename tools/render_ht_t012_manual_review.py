from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
ROOT=Path(__file__).resolve().parents[1];TD=ROOT/'resources/house-templates/HT-T012';OUT=TD/'preview/HT_T012_V0.2_TWO_FLOOR_COLOR_REVIEW.png'
im=Image.open(TD/'preview/HT_T012_V0.1_TWO_FLOOR_REVIEW_BASE.png').convert('RGB');d=ImageDraw.Draw(im,'RGBA');font=ImageFont.truetype('C:/Windows/Fonts/msyh.ttc',14)
# Must exactly match inspect_ht_t010.py's two panel viewports; otherwise CAD overlays drift.
panels=[(45,115,20500,-1000,40500,12000),(920,115,74600,-1000,94600,12000)];pw,ph=830,690
def mapper(p):
 x0,y0,minx,miny,maxx,maxy=p;s=min((pw-50)/(maxx-minx),(ph-70)/(maxy-miny));return lambda q:(x0+25+(q[0]-minx)*s,y0+ph-35-(q[1]-miny)*s)
colors=[(35,125,210,255),(225,145,45,255),(115,70,190,255),(35,155,85,255),(220,70,75,255),(25,150,180,255),(165,115,55,255)]
def zone(mp,name,area,poly,c):
 p=[mp(x) for x in poly];d.polygon(p,fill=c[:3]+(52,));d.line(p+[p[0]],fill=c,width=4);cx=sum(x for x,y in p)/len(p);cy=sum(y for x,y in p)/len(p);d.multiline_text((cx,cy),f'{name}\n{area:.2f}㎡',font=font,fill=c,anchor='mm',align='center')
mp=mapper(panels[0]);f1=[('卫生间一',4.12,[(22973,5050),(25523,5050),(25523,6650),(22973,6650)]),('老人房',17.58,[(22973,850),(26773,850),(26773,6650),(25623,6650),(25623,4850),(22973,4850)]),('卧室一',20.90,[(31773,-650),(35573,-650),(35573,4850),(31773,4850)]),('卫生间二',4.16,[(32973,5050),(35573,5050),(35573,6650),(32973,6650)]),('厨房',12.92,[(31773,6850),(35573,6850),(35573,10250),(31773,10250)]),('餐客厅',43.24,[(26973,850),(31573,850),(31573,10250),(26973,10250)])]
for i,x in enumerate(f1):zone(mp,*x,colors[i])
outer=[mp(x) for x in [(22773,10450),(35773,10450),(35773,-850),(31573,-850),(31573,650),(22773,650)]];d.line(outer+[outer[0]],fill=(230,35,35,255),width=6)
mp=mapper(panels[1]);f2=[('卫生间三',4.12,[(77097,5050),(79647,5050),(79647,6650),(77097,6650)]),('卧室二',15.20,[(77097,850),(80897,850),(80897,4850),(77097,4850)]),('主卧',20.90,[(85897,-650),(89697,-650),(89697,4850),(85897,4850)]),('卫生间四',4.16,[(87097,5050),(89697,5050),(89697,6650),(87097,6650)]),('卧室三',12.92,[(85897,6850),(89697,6850),(89697,10250),(85897,10250)]),('卧室四',18.40,[(81097,850),(85697,850),(85697,4850),(81097,4850)]),('多功能厅',23.92,[(81097,5050),(85697,5050),(85697,10250),(81097,10250)])]
for i,x in enumerate(f2):zone(mp,*x,colors[i])
outer=[mp(x) for x in [(76897,10450),(89897,10450),(89897,-850),(85697,-850),(85697,650),(76897,650)]];d.line(outer+[outer[0]],fill=(230,35,35,255),width=6)
d.text(mp((80696.54,107.57)),'阳台 11.18㎡（不计入主体）',font=font,fill=(180,70,20,255),anchor='mm')
im.save(OUT);print(OUT)

