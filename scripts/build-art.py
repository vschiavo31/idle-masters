"""Map pinned Dofus 3.7.4.4 icon IDs to local transparent WebP sheets."""
import json,math
from pathlib import Path
from PIL import Image
root=Path(__file__).resolve().parents[1]
source=root.parent/'dofus-full-source'
assets=root.parent/'art-source'
out=root/'art';out.mkdir(exist_ok=True)
items=json.loads((source/'MAPPED_ITEMS.json').read_text())
monsters=[r['data'] for r in json.loads((source/'monsters.json').read_text())['references']['RefIds'] if 'id' in r['data']]
world=json.loads((root/'game-world.json').read_text())
extra=json.loads((root/'extra-equipment.json').read_text())
item_ids={x['id'] for x in world['equipment']['items']+extra['items']}
# Include retained older bestiary entries so old saves still have images.
monster_ids=set(world['selectedIds'])|{x['id'] for x in json.loads((root/'dofus-bestiary-1-40.json').read_text())['monsters']}
manifest={};report={}
for kind,rows,wanted,key,size,folder in [
 ('item',items,item_ids,'iconId',64,'items_images_64/data/img/item/1x'),
 ('monster',monsters,monster_ids,'gfxId',128,'monster_images_128/data/img/monster/2x')]:
 id_key='ankama_id' if kind=='item' else 'id'
 refs={r[id_key]:r[key] for r in rows if r[id_key] in wanted}
 unique=sorted(set(refs.values()));available=[];missing=[]
 for icon in unique:
  f=assets/folder/f'{icon}-{size}.png'
  (available if f.exists() else missing).append(icon)
 locations={}
 for sheetno in range(math.ceil(len(available)/256)):
  sheet=Image.new('RGBA',(16*size,16*size))
  name=f'{kind}-{sheetno}.webp'
  for i,icon in enumerate(available[sheetno*256:(sheetno+1)*256]):
   image=Image.open(assets/folder/f'{icon}-{size}.png').convert('RGBA');image.thumbnail((size-4,size-4))
   x,y=i%16,i//16
   sheet.alpha_composite(image,(x*size+(size-image.width)//2,y*size+(size-image.height)//2))
   locations[icon]=[name,x,y]
  sheet.save(out/name,'WEBP',quality=88,method=6)
 manifest[kind]={str(id):locations[icon] for id,icon in refs.items() if icon in locations}
 report[kind]={'requested':len(wanted),'covered':len(manifest[kind]),'missingIcons':missing,'missingIds':sorted(wanted-set(map(int,manifest[kind])))}
(root/'game-art.js').write_text('/* Artwork: Ankama, extracted from dofusdude/dofus3-main 3.7.4.4. */\nconst GAME_ART='+json.dumps(manifest,separators=(',',':'))+';\n'+'''function art(kind,id,label="",size="") {
 const sprite=GAME_ART[kind]?.[String(id)];
 if(!sprite) return '<span class="art artMissing '+size+'" aria-hidden="true">'+(kind==='item'?'◇':'?')+'</span>';
 return '<span class="art '+size+'" role="img" aria-label="'+esc(label)+'" data-art="'+kind+':'+id+'" style="--sheet:url(art/'+sprite[0]+');--sx:'+(sprite[1]*100/15)+'%;--sy:'+(sprite[2]*100/15)+'%"></span>';
}
function itemArt(id,size="") {const item=meta(id);return art('item',item?.ankamaId,item?.n||"Équipement",size)}
function monsterArt(m,size="") {return art('monster',m.sourceId??m.id,m.n??m.name,size)}
''')
(out/'coverage.json').write_text(json.dumps(report,indent=2))
print(json.dumps(report));print('WebP bytes:',sum(f.stat().st_size for f in out.glob('*.webp')))
