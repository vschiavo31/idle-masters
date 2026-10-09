import json,unicodedata
from pathlib import Path
from PIL import Image
root=Path(__file__).resolve().parents[1]
source=root.parent/'art-source'
texts=json.loads((root.parent/'dofus-full-source/fr.json').read_text())['entries']
breeds=[r['data'] for r in json.loads((source/'breeds.json').read_text())['references']['RefIds'] if 'id' in r['data']]
sheet=Image.new('RGBA',(1024,1024));mapping={}
for i,breed in enumerate(breeds):
 name=texts[str(breed['shortNameId'])]
 key=''.join(c for c in unicodedata.normalize('NFD',name).lower() if not unicodedata.combining(c))
 file=source/'class_head_images_64/data/img/class_head/2x'/f"Head_{breed['id']*10}-64.png"
 image=Image.open(file).convert('RGBA');image.thumbnail((60,60));x,y=i%16,i//16
 sheet.alpha_composite(image,(x*64+(64-image.width)//2,y*64+(64-image.height)//2))
 mapping[key]=['class.webp',x,y]
sheet.save(root/'art/class.webp','WEBP',quality=88,method=4)
with (root/'game-art.js').open('a') as f:
 f.write('\nGAME_ART.class='+json.dumps(mapping,separators=(',',':'))+';\nfunction classArt(id,size="") {return art("class",id,CLASSES.find(c=>c.id===id)?.name||"Personnage",size)}\n')
print(mapping)
