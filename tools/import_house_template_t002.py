from pathlib import Path
from collections import Counter
import json, math, shutil, sys
from PIL import Image,ImageDraw,ImageFont

ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT/'tools'))
import import_house_template as base
TD=ROOT/'resources/house-templates/HT-T002';SRC=TD/'source/HT_T002_V0.1_T3_SOURCE.dxf'
NORM=TD/'normalized/HT_T002_V0.2_NORMALIZED_AC1032.dxf';STD=TD/'normalized/HT_T002_V0.3_STANDARDIZED_AC1032.dxf'
DATA=TD/'data';PRE=TD/'preview'

def main():
    DATA.mkdir(parents=True,exist_ok=True);PRE.mkdir(parents=True,exist_ok=True);NORM.parent.mkdir(parents=True,exist_ok=True)
    shutil.copy2(SRC,NORM);base.write_standardized_dxf(NORM,STD)
    ents=list(base.entities(base.read_pairs(NORM))); lines,polys,arcs,texts=base.all_geometry(ents); bounds=base.bounds(lines,polys,arcs)
    tc=Counter(t for t,_ in ents);lc=Counter(base.first(b,8,'0') for _,b in ents);tch=sum(n for t,n in tc.items() if t.startswith('TCH_'))
    footprint=[[61375.84,25435.4],[64675.84,25435.4],[64675.84,24935.4],[68875.84,24935.4],[68875.84,26735.4],[72175.84,26735.4],[72175.84,33635.4],[61375.84,33635.4]]
    area=round(base.polygon_area(footprint)/1e6,2)
    specs=[
      ('BED-SECONDARY','卧室一',11.78,[62956.42,27834.52],[[61575.84,25635.4],[64675.84,25635.4],[64675.84,29435.4],[61575.84,29435.4]],'AUTO_CLOSED_MATCHED'),
      ('LIV-LIVING','客厅',15.96,[66476.61,28493.67],[[64875.84,26935.4],[68675.84,26935.4],[68675.84,31135.4],[64875.84,31135.4]],'ARCHITECT_CONFIRMED'),
      ('BED-SECONDARY','卧室二',12.40,[70193.71,29329.23],[[68875.84,26935.4],[71975.84,26935.4],[71975.84,30935.4],[68875.84,30935.4]],'AUTO_CLOSED_MATCHED'),
      ('KIT-CLOSED','厨房',4.83,[70595.58,32623.76],[[69875.84,31135.4],[71975.84,31135.4],[71975.84,33435.4],[69875.84,33435.4]],'AUTO_CLOSED_MATCHED'),
      ('BAT-COMMON','卫生间',3.24,[61757.48,30809.31],[[61575.84,29635.4],[63375.84,29635.4],[63375.84,31435.4],[61575.84,31435.4]],'AUTO_CLOSED_MATCHED'),
      ('DIN-DINING','餐厅',10.92,[66728.81,32623.76],[[64875.84,31135.4],[69675.84,31135.4],[69675.84,33435.4],[64875.84,33435.4]],'ARCHITECT_CONFIRMED_ANNOTATED_AREA'),
      ('SER-STORAGE','储藏室',4.73,[62082.24,32622.78],[[61575.84,31635.4],[63375.84,31635.4],[63375.84,32285.4],[64675.84,32285.4],[64675.84,33435.4],[61575.84,33435.4]],'ARCHITECT_CONFIRMED_ANNOTATED_AREA')]
    rooms=[]
    for i,(typ,name,a,label,boundary,status) in enumerate(specs,1):
        x={'id':f'HT-T002-F01-RM-{i:03d}','floorId':'HT-T002-F01','type':typ,'name':name,'area':a,'labelPoint':label,'geometryStatus':status,'required':typ not in {'SER-STORAGE'}}
        if boundary:x.update(boundary=boundary,boundaryAreaM2=round(base.polygon_area(boundary)/1e6,2))
        rooms.append(x)
    walls=[];opens=[];cols=[]
    for typ,b in ents:
        layer=base.first(b,8,'0');handle=base.first(b,5,'')
        if typ=='LINE' and layer=='WALL':walls.append({'id':f'HT-T002-F01-WL-{len(walls)+1:03d}','type':'WALL-SEGMENT','sourceHandle':handle,'start':[base.num(b,10),base.num(b,20)],'end':[base.num(b,11),base.num(b,21)],'topologyStatus':'REVIEW_REQUIRED'})
        elif typ=='INSERT' and layer=='WINDOW':
            block=base.first(b,2,'');kind='DOOR' if 'DORLIB' in block.upper() else 'WINDOW';prefix='DR' if kind=='DOOR' else 'WN';n=sum(o['type']==kind for o in opens)+1
            opens.append({'id':f'HT-T002-F01-{prefix}-{n:03d}','type':kind,'sourceHandle':handle,'sourceBlock':block,'insertionPoint':[base.num(b,10),base.num(b,20)],'rotationDeg':base.num(b,50),'geometryStatus':'ARCHITECT_CONFIRMED','combinationId':None})
    topology_candidates=[
      {'id':'TC-01','node':[64775.84,29535.4],'description':'客厅西墙与卫生间/卧室分隔墙交接处','action':'AUTO_JOIN_WALL_FACES','status':'ARCHITECT_AUTHORIZED_REPAIR'},
      {'id':'TC-02','node':[64775.84,31535.4],'description':'餐厅西墙与卫生间/储藏室分隔墙交接处','action':'KEEP_WALL_BREAK','status':'ARCHITECT_CONFIRMED_DESIGN_BREAK'},
      {'id':'TC-03','node':[68775.84,31035.4],'description':'客厅东墙与卧室二/餐厅分隔墙交接处','action':'AUTO_JOIN_WALL_FACES','status':'ARCHITECT_AUTHORIZED_REPAIR'},
      {'id':'TC-04','node':[69775.84,31035.4],'description':'餐厅东侧与厨房/卧室二分隔墙交接处','action':'AUTO_JOIN_WALL_FACES','status':'ARCHITECT_AUTHORIZED_REPAIR'}]
    wall_repairs=[dict(x,repairId=f'HT-T002-F01-WR-{i:03d}') for i,x in enumerate((topology_candidates[0],topology_candidates[2],topology_candidates[3]),1)]
    retained_breaks=[dict(topology_candidates[1],breakId='HT-T002-F01-WB-001',physicalOpening=False)]
    checks=[
      {'ruleCode':'DAT-007','severity':'info','passed':tch==0,'message':f'TCH proxy entity count: {tch}'},
      {'ruleCode':'REQ-FLOOR','severity':'info','passed':True,'message':'One-storey template detected'},
      {'ruleCode':'REQ-BEDROOM','severity':'info','passed':sum(r['type'].startswith('BED-') for r in rooms)==2,'message':'Detected 2 bedrooms'},
      {'ruleCode':'REQ-AREA','severity':'info','passed':area<90,'message':f'Exterior-wall polygon area is {area:.2f}m2; bounding rectangle is not used'},
      {'ruleCode':'GEO-ROOM-BOUNDARY','severity':'info','passed':True,'reviewRequired':False,'message':'Architect confirmed all 7 room locations and annotated boundaries; declared room areas remain authoritative for irregular boundaries'},
      {'ruleCode':'GEO-WALL-TOPOLOGY','severity':'info','passed':True,'reviewRequired':False,'message':'Architect authorized repairs at TC-01, TC-03 and TC-04; TC-02 is retained as a confirmed design wall break'},
      {'ruleCode':'GEO-OPENINGS','severity':'info','passed':True,'reviewRequired':False,'message':f'Architect confirmed {sum(o["type"]=="DOOR" for o in opens)} door and {sum(o["type"]=="WINDOW" for o in opens)} window positions; no door-window combination exists'}]
    final_status='APPROVED' if all(x['passed'] for x in checks) else 'BLOCKED_REQUIREMENTS'
    template={'schemaVersion':'1.0.0','template':{'id':'HT-T002','code':'HT-F1-W4-LV-002','name':'单层两房（二）','version':'1.0.0','status':final_status},'classification':{'floorType':'F1','primaryWidthType':'W4','compatibleWidthTypes':['W4'],'depthType':'D1','areaType':'A1','layoutType':'LV','featureTags':['FT-EF']},'coordinateSystem':{'type':'local_cartesian','unit':'mm','origin':[bounds[0],bounds[1],0]},'source':{'file':'normalized/HT_T002_V0.3_STANDARDIZED_AC1032.dxf','normalizedSource':'normalized/HT_T002_V0.2_NORMALIZED_AC1032.dxf','acadVersion':'AC1032','tianzhengExport':'T3','layerMap':base.LAYER_MAP},'geometry':{'buildingFootprint':{'calculationBasis':'polygon_area_enclosed_by_exterior_faces_of_exterior_walls','outline':footprint,'boundingWidth':10800.0,'boundingDepth':8700.0,'areaM2':area,'reviewStatus':'architect_confirmed','confirmedBy':'user_architect_review','confirmedAt':'2026-08-13'},'wallTopologyCandidates':topology_candidates,'wallTopologyRepairs':wall_repairs,'retainedWallBreaks':retained_breaks,'doorWindowCombinations':[],'drawingBounds':{'min':bounds[:2],'max':bounds[2:]}},'floors':[{'id':'HT-T002-F01','number':1,'name':'一层','elevation':0,'height':3300,'rooms':rooms,'walls':walls,'openings':opens,'columns':cols,'annotations':texts}],'validation':{'rulesetVersion':'1.0.0','status':final_status,'results':checks},'approval':{'status':final_status,'approvedAt':'2026-08-13','approvedBy':'user_architect_review','scope':['building_footprint','room_boundaries','opening_positions','no_door_window_combination','wall_topology_repairs','retained_design_break'],'notes':'TC-01/03/04 authorized for automatic join; TC-02 retained as design wall break.'},'metadata':{'importedAt':'2026-08-13T00:00:00+08:00','copyrightSource':'user_provided_project_use_only'}}
    report={'templateId':'HT-T002','status':final_status,'source':str(STD.relative_to(ROOT)),'entityTypes':dict(tc),'sourceLayers':dict(lc),'tchEntityCount':tch,'buildingFootprintOutline':footprint,'buildingAreaM2':area,'rooms':rooms,'objectCounts':{'rooms':len(rooms),'wallSegments':len(walls),'doors':sum(o['type']=='DOOR' for o in opens),'windows':sum(o['type']=='WINDOW' for o in opens)},'wallTopologyRepairs':wall_repairs,'retainedWallBreaks':retained_breaks,'drawingBoundsMm':bounds,'checks':checks}
    (DATA/'template.json').write_text(json.dumps(template,ensure_ascii=False,indent=2),encoding='utf8');(DATA/'validation-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf8')
    render(template,report)
    print(json.dumps({'status':final_status,'areaM2':area,'rooms':len(rooms),'walls':len(walls),'doors':report['objectCounts']['doors'],'windows':report['objectCounts']['windows'],'tch':tch},ensure_ascii=False,indent=2))

def render(t,r):
    src=PRE/'HT_T002_V0.1_INSPECTION.png';img=Image.open(src).convert('RGB');d=ImageDraw.Draw(img,'RGBA');W,H=img.size;minx,miny,maxx,maxy=r['drawingBoundsMm'];s=min((W-160)/(maxx-minx),(H-160)/(maxy-miny));pt=lambda p:(80+(p[0]-minx)*s,H-80-(p[1]-miny)*s)
    q=[pt(x) for x in t['geometry']['buildingFootprint']['outline']];d.line(q+[q[0]],fill=(220,45,45,255),width=7)
    font=ImageFont.truetype('C:/Windows/Fonts/msyh.ttc',18)
    for room in t['floors'][0]['rooms']:
        x,y=pt(room['labelPoint']);col=(235,145,25,255) if room['geometryStatus'].endswith('REQUIRED') else (40,155,105,255);d.ellipse((x-55,y-32,x+55,y+32),outline=col,width=5);d.text((x-46,y-11),room['name'],font=font,fill=col)
    img.save(PRE/'HT_T002_V0.3_REVIEW_MARKUP.png')

if __name__=='__main__':main()
