"""Build extra-equipment.json from the pinned 3.7.4.4 source.
Usage: python scripts/import-extra-equipment.py SOURCE_DIR
"""
import json, pathlib, sys, collections, re, unicodedata
source = pathlib.Path(sys.argv[1]); root = pathlib.Path(__file__).resolve().parent.parent
mapped = json.loads((source / 'MAPPED_ITEMS.json').read_text())
refs = json.loads((source / 'items.json').read_text())['references']['RefIds']
raw_weapons = {r['data']['id']: r['data'] for r in refs if r['type']['class'] == 'WeaponData'}
raw_effects = {r['rid']: r['data'] for r in refs if r['type']['class'] == 'EffectInstanceDice'}
weapon_types = {'Pelle','Arc','Bâton','Épée','Dague','Baguette','Marteau','Hache','Faux','Lance','Pioche','Arme magique'}
def folded(text):
    return ''.join(c for c in unicodedata.normalize('NFD', text).lower() if not unicodedata.combining(c))
def stats(effects):
    result = []
    for e in effects or []:
        if e.get('is_meta') or e.get('active') or not e.get('element_id'): continue
        name = e['type']['fr']; a = e['min']; b = e['max'] or a
        if name.startswith('-'): name = name.lstrip('- '); a = -abs(a); b = -abs(b)
        result.append({'stat': name, 'min': min(a,b), 'max': max(a,b)})
    return result
# Keep the playable version when a Dofus also has a quest-bound duplicate.
dofus = {}
for item in mapped:
    if item['type']['name']['fr'] != 'Dofus' or item['level'] > 200: continue
    score = (sum(abs(e['min']) + abs(e['max']) for e in stats(item['effects'])), sum(bool(e.get('is_meta')) for e in item['effects'] or []))
    name = item['name']['fr']
    if name not in dofus or score > dofus[name][0]: dofus[name] = (score, item['ankama_id'])
dofus_ids = {row[1] for row in dofus.values()}
items = []; excluded = []
for item in mapped:
    typ = item['type']['name']['fr']; iid = item['ankama_id']
    if item['level'] > 200 or typ not in weapon_types | {'Dofus','Trophée','Familier'}: continue
    if typ == 'Dofus' and iid not in dofus_ids: continue
    raw = raw_weapons.get(iid)
    if typ in weapon_types:
        if not raw: continue
        durability = any(raw_effects.get(e['rid'],{}).get('actionId') == 812 for e in raw['possibleEffects']['Array'])
        if 'ethere' in folded(item['name']['fr']) or durability:
            excluded.append(iid); continue
    row = {'id': iid, 'name': item['name']['fr'], 'level': item['level'], 'slot': 'Arme' if raw else typ, 'subtype': typ, 'setId': item['parentSet']['id'] or None, 'effects': stats(item['effects']), 'allowNoStats': True}
    if any(e.get('is_meta') for e in item['effects'] or []): row['specialEffects'] = True
    if raw:
        lines = []; unsupported = []
        for e in item['effects'] or []:
            if not e.get('active'): continue
            match = re.fullmatch(r'(dommages|vol|soins) (Neutre|Feu|Air|Terre|Eau|du meilleur élément)', e['type']['fr'])
            if not match: unsupported.append(e['type']['fr']); continue
            kind, element = match.groups(); lo = e['min']; hi = e['max'] or lo
            lines.append({'kind': {'dommages':'damage','vol':'drain','soins':'heal'}[kind], 'element': 'Best' if element == 'du meilleur élément' else element, 'min': min(lo,hi), 'max': max(lo,hi)})
        row['weapon'] = {'ap': raw['apCost'], 'casts': raw['maxCastPerTurn'], 'criticalChance': raw['criticalHitProbability'], 'criticalBonus': raw['criticalHitBonus'], 'lines': lines}
        if unsupported: row['weapon']['unsupported'] = sorted(set(unsupported))
    items.append(row)
set_ids = {i['setId'] for i in items if i['setId']}
sets = [{'id': s['ankama_id'], 'name': s['name']['fr'], 'bonuses': [{'pieces': int(n), 'effects': stats(es)} for n,es in s['effects'].items()]} for s in json.loads((source/'MAPPED_SETS.json').read_text()) if s['ankama_id'] in set_ids]
result = {'version':'3.7.4.4', 'excludedEtherealOrDurabilityIds': sorted(excluded), 'items': items, 'sets': sets}
(root/'extra-equipment.json').write_text(json.dumps(result, ensure_ascii=False, separators=(',',':'))+'\n')
print({'counts':dict(collections.Counter(i['slot'] for i in items)), 'excludedDurability':excluded, 'weaponsWithAttack':sum(bool(i.get('weapon',{}).get('lines')) for i in items), 'bytes':(root/'extra-equipment.json').stat().st_size})
