"""Import the validated monster selection and exact 3.7.4.4 source drops.
Usage: python scripts/import-selected-world.py SOURCE_DIR SELECTION_JSON
"""
import json,pathlib,sys,hashlib,collections
p=pathlib.Path(sys.argv[1]);selection=pathlib.Path(sys.argv[2]);root=pathlib.Path(__file__).resolve().parent.parent
s=json.loads(selection.read_text());assert s['validated'] and len(set(s['selectedIds']))==len(s['selectedIds'])==688
catalogue=json.loads((root/'monster-catalogue.json').read_text());allowed={m['id'] for m in catalogue['monsters']};assert set(s['selectedIds'])<=allowed
tr=json.loads((p/'fr.json').read_text())['entries']
def records(f,classes=None):return [r['data'] for r in json.loads((p/f).read_text())['references']['RefIds'] if not classes or r['type']['class'] in classes]
def arr(m,k):return m.get(k,{}).get('Array',[])
raw={m['id']:m for m in records('monsters.json')};raw_items={i['id']:i for i in records('items.json',{'ItemData','WeaponData'})}
items=json.loads((p/'MAPPED_ITEMS.json').read_text());mapped={i['ankama_id']:i for i in items};sets=json.loads((p/'MAPPED_SETS.json').read_text())
slots={'Chapeau':'Coiffe','Cape':'Cape','Anneau':'Anneau','Amulette':'Amulette','Ceinture':'Ceinture','Bottes':'Bottes'}
def effects(es):
 result=[]
 for e in es or []:
  if e.get('is_meta') or e.get('active'):continue
  name=e['type']['fr'];a=e['min'];b=e['max'] or a
  if name.startswith('-'):
   name=name.lstrip('- ');a=-abs(a);b=-abs(b)
  result.append({'stat':name,'min':min(a,b),'max':max(a,b)})
 return result
gear=[{'id':i['ankama_id'],'name':i['name']['fr'],'level':i['level'],'slot':slots[i['type']['name']['fr']],'setId':i['parentSet']['id'] or None,'effects':effects(i['effects'])} for i in items if i['type']['name']['fr'] in slots and i['level']<=200 and effects(i['effects'])]
# Retain the previously supported equipment metadata exactly for existing saves.
old=json.loads((root/'dofus-equipment-1-40.json').read_text())['items'];gearmap={i['id']:i for i in gear};gearmap.update({i['id']:i for i in old});gear=list(gearmap.values())
set_ids={i['setId'] for i in gear if i['setId']};newsets=[{'id':x['ankama_id'],'name':x['name']['fr'],'bonuses':[{'pieces':int(n),'effects':effects(es)} for n,es in x['effects'].items()]} for x in sets if x['ankama_id'] in set_ids]
oldsets=json.loads((root/'dofus-item-sets.json').read_text())['sets'];setmap={x['id']:x for x in newsets};setmap.update({x['id']:x for x in oldsets})
selected=set(s['selectedIds']);zones=[]
for z in catalogue['zones']:
 ids=[mid for mid in z['monsters'] if mid in selected]
 if not ids:continue
 zones.append({'id':1000+z['id'] if z['id']>=0 else 999,'sourceId':z['id'],'name':z['name'],'area':z['area'],'level':min(min(g['level'] for g in arr(raw[mid],'grades')) for mid in ids),'monsters':ids})
zones.sort(key=lambda z:(z['sourceId']==-1,z['level'],z['name'],z['id']))
world=[];drop_items={};conditional=0
for mid in s['selectedIds']:
 m=raw[mid];gs=arr(m,'grades');g=min(gs,key=lambda x:(x['level'],x['grade']));drops=[]
 for d in arr(m,'drops'):
  iid=d['objectId'];item=raw_items.get(iid)
  if item is None:raise ValueError(f'Unresolved drop item {iid}')
  rates=[d.get(f'percentDropForGrade{i}',0) for i in range(1,6)]
  drops.append({'itemId':iid,'rates':rates,'rate':rates[min(4,g['grade']-1)],'criterion':d.get('criterions',''),'count':d.get('count',1)})
  conditional+=bool(d.get('criterions'))
  drop_items[iid]={'id':iid,'name':tr[str(item['nameId'])],'level':item['level'],'type':mapped.get(iid,{}).get('type',{}).get('name',{}).get('fr','Objet'),'equipment':iid in gearmap}
 memberships=[z['id'] for z in zones if mid in z['monsters']];assert memberships
 element=max([('Terre',g['strength']),('Feu',g['intelligence']),('Eau',g['chance']),('Air',g['agility'])],key=lambda x:x[1])[0]
 world.append({'id':mid,'name':tr[str(m['nameId'])],'minLevel':g['level'],'maxLevel':max(x['level'] for x in gs),'hpMin':max(1,g['lifePoints']),'hpMax':max(x['lifePoints'] for x in gs),'pa':g['actionPoints'],'pm':g['movementPoints'],'raceId':m['race'],'boss':bool(m['m_flags']&4),'xp':max(0,g['xp']),'element':element,'zones':memberships,'drops':drops})
# XP references are indexed by level through the source key/value dictionary.
xp=json.loads((p/'char_xp_mappings.json').read_text());refs={r['rid']:r['data']['experiencePoints'] for r in xp['references']['RefIds']};values=xp['objectsById']['m_values']['Array'];keys=xp['objectsById']['m_keys']['Array'];totals={int(k):int(refs[v['rid']]) for k,v in zip(keys,values)}
result={'version':'3.7.4.4','selectionHash':hashlib.sha256(selection.read_bytes()).hexdigest(),'selectedIds':s['selectedIds'],'monsters':world,'zones':zones,'dropItems':list(drop_items.values()),'equipment':{'items':gear},'sets':{'sets':list(setmap.values())},'xpNeeds':[totals[l+1]-totals[l] for l in range(1,200)]}
(root/'game-world.json').write_text(json.dumps(result,ensure_ascii=False,separators=(',',':'))+'\n')
(root/'selected-monsters.json').write_text(json.dumps(s,ensure_ascii=False,separators=(',',':'))+'\n')
print({'monsters':len(world),'zones':len(zones),'dropEntries':sum(len(m['drops']) for m in world),'conditionalDrops':conditional,'dropItems':len(drop_items),'equipment':len(gear),'sets':len(setmap),'noDrops':sum(not m['drops'] for m in world)},flush=True)
