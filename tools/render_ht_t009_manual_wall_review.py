from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
ROOT=Path(__file__).resolve().parents[1];TD=ROOT/'resources/house-templates/HT-T009';OUT=TD/'preview/HT_T009_V0.3_FOOTPRINT_ROOM_REVIEW.png'
im=Image.open(TD/'preview/HT_T009_V0.1_INSPECTION.png').convert('RGB');d=ImageDraw.Draw(im,'RGBA')
font=ImageFont.truetype('C:/Windows/Fonts/msyh.ttc',14);title=ImageFont.truetype('C:/Windows/Fonts/msyh.ttc',25);small=ImageFont.truetype('C:/Windows/Fonts/msyh.ttc',13)
def z(name,area,p,c):
 d.polygon(p,fill=c[:3]+(58,));d.line(p+[p[0]],fill=c,width=4);x=sum(a for a,b in p)/len(p);y=sum(b for a,b in p)/len(p);d.multiline_text((x,y),f'{name}\n{area:.2f}㎡',font=font,fill=c,anchor='mm',align='center')
blue=(20,105,185,255);gold=(180,120,10,255);red=(195,45,35,255);green=(20,145,55,255);purple=(100,55,175,255)
# Pixel paths are snapped to the visible room-side faces in the source review raster.
z('卫生间一',5.04,[(305,442),(389,442),(389,568),(305,568)],blue)
z('主卧',12.20,[(396,442),(568,442),(568,596),(505,596),(505,568),(451,568),(451,576),(396,576)],gold)
z('卫生间二',5.40,[(305,578),(441,578),(441,655),(451,655),(451,664),(305,664)],red)
z('卧室一',12.04,[(305,666),(500,666),(500,794),(305,794)],green)
z('厨房',9.24,[(578,442),(727,442),(727,568),(688,568),(688,577),(616,577),(616,568),(578,568)],purple)
z('餐客厅',23.04,[(578,666),(797,666),(797,794),(578,794),(578,727),(568,727),(568,666)],blue)
# 卧室二仅包含门洞内侧凹位；边界到门洞为止，不跨入外侧交通空间。
z('卧室二',12.20,[(803,305),(974,305),(974,434),(863,434),(863,459),(803,459)],gold)
z('卫生间三',5.04,[(982,305),(1067,305),(1067,434),(982,434)],red)
z('卫生间四',5.40,[(930,442),(1067,442),(1067,522),(930,522),(920,522),(920,483),(930,483)],green)
z('卧室三',12.04,[(870,531),(1067,531),(1067,658),(870,658)],purple)
# Candidate principal footprint, excluding the outdoor terrace.
outer=[(298,437),(799,437),(799,300),(1071,300),(1071,664),(870,664),(870,594),(799,594),(799,802),(568,802),(568,727),(500,727),(500,802),(298,802)]
d.line(outer+[outer[0]],fill=(230,38,38,255),width=7)
d.rounded_rectangle((45,35,1030,120),14,fill=(255,255,255,245),outline=(35,55,65,220),width=2);d.text((65,48),'HT-T009 沿围合墙体房间范围复核图',font=title,fill=(20,35,45,255));d.text((68,83),'彩色边界沿房间侧墙面描绘；门窗洞口按所在墙线闭合；室外露台已排除',font=small,fill=(65,75,83,255));im.save(OUT);print(OUT)
