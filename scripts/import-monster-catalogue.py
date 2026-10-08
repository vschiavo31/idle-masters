"""Build the complete catalogue from the pinned dofusdude 3.7.4.4 raw snapshot.
Usage: python scripts/import-monster-catalogue.py /path/to/raw/files
Required files: monsters.json, subareas.json, areas.json, fr.json, monster_races.json, monsters_super_races.json.
"""
import hashlib,json,pathlib,sys
source=pathlib.Path(sys.argv[1]);root=pathlib.Path(__file__).resolve().parent.parent
files=['monsters.json','subareas.json','areas.json','fr.json','monster_races.json','monsters_super_races.json']
def rows(name):return [r['data'] for r in json.loads((source/name).read_text())['references']['RefIds']]
translations=json.loads((source/'fr.json').read_text())['entries']
def name(row):return translations[str(row['nameId'])]
def array(row,key):return row.get(key,{}).get('Array',[])
monsters=rows('monsters.json');subareas=rows('subareas.json');areas={a['id']:name(a) for a in rows('areas.json')}
source_count=len(monsters)
races={r['id']:r for r in rows('monster_races.json')}
excluded={}; category_counts={'archimonstre':0,'invocation':0,'quete':0}
for m in monsters:
 race=races[m['race']]; super_race=race['superRaceId']; flags=m['m_flags']; reasons=[]
 # DofusDB exposes flag bit 3 as isMiniBoss and bit 4 as isQuestMonster.
 # Super-race 28 contains summons; race 334 adds Infinite Dreams summons.
 if super_race==20 or flags & (1<<3): reasons.append('archimonstre')
 if super_race==28 or m['race']==334: reasons.append('invocation')
 if super_race==27 or flags & (1<<4): reasons.append('quete')
 for reason in reasons:category_counts[reason]+=1
 if reasons:excluded[m['id']]=reasons
monsters=[m for m in monsters if m['id'] not in excluded]
by_id={m['id']:m for m in monsters}; memberships={m['id']:set(array(m,'subareas')) for m in monsters}
# Keep both declarations from this same snapshot, including subarea-only associations.
for z in subareas:
 for mid in array(z,'monsters'):
  if mid in memberships:memberships[mid].add(z['id'])
records=[]
for m in monsters:
 levels=[g['level'] for g in array(m,'grades')]
 records.append({'id':m['id'],'name':name(m),'minLevel':min(levels) if levels else None,'maxLevel':max(levels) if levels else None,'zones':sorted(memberships[m['id']])})
known={z['id'] for z in subareas};zones=[]
for z in subareas:
 ids=[m['id'] for m in records if z['id'] in m['zones']]
 if ids:zones.append({'id':z['id'],'name':name(z),'area':areas.get(z['areaId'],''),'level':z['level'],'monsters':ids})
for zid in sorted(set().union(*memberships.values())-known):
 zones.append({'id':zid,'name':f'Zone sans libellé · ID {zid}','area':'','level':None,'monsters':[m['id'] for m in records if zid in m['zones']]})
unplaced=[m['id'] for m in records if not m['zones']]
if unplaced:zones.append({'id':-1,'name':'Sans zone renseignée','area':'Monstres sans localisation dans la base','level':None,'monsters':unplaced})
indexed={m['id']:m for m in records}
def sort_monster(mid):return (indexed[mid]['minLevel'] or float('inf'),indexed[mid]['name'],mid)
for z in zones:
 z['monsters'].sort(key=sort_monster)
 levels=[indexed[mid]['minLevel'] for mid in z['monsters'] if indexed[mid]['minLevel'] is not None]
 z['minLevel']=min(levels) if levels else None;z['maxLevel']=max(indexed[mid]['maxLevel'] or 0 for mid in z['monsters'])
zones.sort(key=lambda z:(z['id']==-1,z['minLevel'] or float('inf'),z['level'] or float('inf'),z['name'],z['id']))
records.sort(key=lambda m:(m['minLevel'] or float('inf'),m['name'],m['id']))
result={'sourceMonsterCount':source_count,'exclusionPolicy':'no-archmonsters-summons-quests-v1','excludedMonsterIds':sorted(excluded),'excludedCategoryCounts':category_counts,'sourceVersion':'3.7.4.4','sourceUrl':'https://github.com/dofusdude/dofus3-main/releases/tag/3.7.4.4','sourceHashes':{f:hashlib.sha256((source/f).read_bytes()).hexdigest() for f in files},'monsters':records,'zones':zones}
(root/'monster-catalogue.json').write_text(json.dumps(result,ensure_ascii=False,separators=(',',':'))+'\n')
assert len(records)==len(by_id)
assert len(records)+len(excluded)==source_count==5129
assert not set(by_id)&set(excluded)
assert set(by_id)=={mid for z in zones for mid in z['monsters']}
print(f'{len(excluded)} excluded ({category_counts}), {len(records)} monsters, {len(zones)} non-empty zone groups, maximum level {max(m["maxLevel"] or 0 for m in records)}')
