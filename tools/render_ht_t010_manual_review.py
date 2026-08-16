from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
ROOT=Path(__file__).resolve().parents[1];TD=ROOT/'resources/house-templates/HT-T010';OUT=TD/'preview/HT_T010_V0.2_TWO_FLOOR_COLOR_REVIEW.png'
im=Image.open(TD/'preview/HT_T010_V0.1_TWO_FLOOR_REVIEW_BASE.png').convert('RGB');d=ImageDraw.Draw(im,'RGBA');font=ImageFont.truetype('C:/Windows/Fonts/msyh.ttc',14)
# Must exactly match inspect_ht_t010.py's two panel viewports; otherwise CAD overlays drift.
panels=[(45,115,20500,-500,40500,10500),(920,115,53200,-500,73200,10500)];pw,ph=830,690
def mapper(p):
 x0,y0,minx,miny,maxx,maxy=p;s=min((pw-50)/(maxx-minx),(ph-70)/(maxy-miny));return lambda q:(x0+25+(q[0]-minx)*s,y0+ph-35-(q[1]-miny)*s)
colors=[(35,125,210,255),(225,145,45,255),(115,70,190,255),(35,155,85,255),(220,70,75,255),(25,150,180,255),(165,115,55,255)]
def zone(mp,name,area,poly,c):
 p=[mp(x) for x in poly];d.polygon(p,fill=c[:3]+(52,));d.line(p+[p[0]],fill=c,width=4);cx=sum(x for x,y in p)/len(p);cy=sum(y for x,y in p)/len(p);d.multiline_text((cx,cy),f'{name}\n{area:.2f}㎡',font=font,fill=c,anchor='mm',align='center')
mp=mapper(panels[0]);f1=[('卫生间一',4.12,[(22973,5050),(25523,5050),(25523,6650),(22973,6650)]),('老人房',17.58,[(22973,850),(26773,850),(26773,6650),(25623,6650),(25623,4850),(22973,4850)]),('卧室一',20.90,[(31773,-650),(35573,-650),(35573,4850),(31773,4850)]),('卫生间二',4.16,[(32973,5050),(35573,5050),(35573,6650),(32973,6650)]),('厨房',8.36,[(31773,6850),(35573,6850),(35573,9050),(31773,9050)]),('餐客厅',38.18,[(26973,850),(31573,850),(31573,9050),(26973,9050)])]
for i,x in enumerate(f1):zone(mp,*x,colors[i])
outer=[mp(x) for x in [(22773,9250),(35773,9250),(35773,-850),(31573,-850),(31573,650),(22773,650)]];d.line(outer+[outer[0]],fill=(230,35,35,255),width=6)
mp=mapper(panels[1]);f2=[('卫生间三',4.12,[(55637,5050),(58187,5050),(58187,6650),(55637,6650)]),('卧室二',15.20,[(55637,850),(59437,850),(59437,4850),(55637,4850)]),('卧室三',20.90,[(64437,-650),(68237,-650),(68237,4850),(64437,4850)]),('卫生间四',4.16,[(65637,5050),(68237,5050),(68237,6650),(65637,6650)]),('衣帽间',8.36,[(64437,6850),(68237,6850),(68237,9050),(64437,9050)]),('卧室四',18.40,[(59637,850),(64237,850),(64237,4850),(59637,4850)]),('多功能房',18.40,[(59637,5050),(64237,5050),(64237,9050),(59637,9050)])]
for i,x in enumerate(f2):zone(mp,*x,colors[i])
outer=[mp(x) for x in [(55437,9250),(68437,9250),(68437,-850),(64237,-850),(64237,650),(55437,650)]];d.line(outer+[outer[0]],fill=(230,35,35,255),width=6)
im.save(OUT);print(OUT)
