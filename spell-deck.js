/* Collectible spells are shared across classes. Counts include the equipped copy. */
const DECK_SIZE=6;
const BASIC_SPELL={id:'basic',n:'Attaque de base',e:'Neutre',pa:3,lo:6,hi:8,kind:'dmg',level:1,cd:0,turns:0,originClass:'iop',originIndex:0};
const DROP_SPELLS=CLASSES.flatMap(c=>c.spells.map((s,i)=>({...s,originClass:c.id,originIndex:i})));
const DROP_SPELL_MAP=new Map(DROP_SPELLS.map(s=>[s.id,s]));
let spellDropPools=new Map(),spellDropSources=new Map(),deckSearch='',deckOwnedOnly=true,deckMessage='';
function collectibleSpell(id){return id==='basic'?BASIC_SPELL:DROP_SPELL_MAP.get(id);}
function spellCopies(id,rank,state=D){return state.spellCollection?.[id]?.[rank-1]||0;}
function bestSpellRank(id,state=D){if(id==='basic')return 1;for(let r=6;r>=1;r--)if(spellCopies(id,r,state)>0)return r;return 0;}
function migrateSpellDeck(state=D){
 if(!state.spellDeckMigration){
  state.spellCollection={};
  const current=CLASSES.find(c=>c.id===state.classId);
  for(const s of DROP_SPELLS){
   const trained=Number(state.spellRanks?.[s.id])||1;
   if((s.originClass===state.classId&&s.level<=state.lv)||trained>1){const counts=[0,0,0,0,0,0];counts[Math.min(6,Math.max(1,Math.floor(trained)))-1]=1;state.spellCollection[s.id]=counts;}
  }
  state.spellDeck=(current?.spells.filter(s=>bestSpellRank(s.id,state)>0).slice(0,DECK_SIZE).map(s=>s.id)||[]);
  state.retiredSpellPoints=state.spellPts||0;state.spellPts=0;state.spellDeckMigration=1;
 }
 const collection={};
 for(const [id,counts] of Object.entries(state.spellCollection||{}))if(DROP_SPELL_MAP.has(id)&&Array.isArray(counts)){
  const valid=Array.from({length:6},(_,i)=>Number.isSafeInteger(counts[i])&&counts[i]>0?counts[i]:0);if(valid.some(Boolean))collection[id]=valid;
 }
 state.spellCollection=collection;
 const used=new Set();state.spellDeck=Array.from({length:DECK_SIZE},(_,i)=>{const id=state.spellDeck?.[i];if(!DROP_SPELL_MAP.has(id)||used.has(id)||!bestSpellRank(id,state))return null;used.add(id);return id;});
 state.spellPts=0;
}
function deckEditable(){return mode!=='fight'&&!auto;}
function setDeckSpell(slot,id){
 if(!deckEditable()||!Number.isInteger(slot)||slot<0||slot>=DECK_SIZE||id!==null&&(!DROP_SPELL_MAP.has(id)||!bestSpellRank(id)||D.spellDeck.includes(id)))return false;
 D.spellDeck[slot]=id;deckMessage=id?'Sort ajouté au deck.':'Emplacement libéré.';render();return true;
}
function fuseSpell(id,rank){
 if(!deckEditable()||!Number.isInteger(rank)||rank<1||rank>=6||spellCopies(id,rank)<3)return false;
 const counts=D.spellCollection[id];counts[rank-1]-=3;counts[rank]=(counts[rank]||0)+1;
 deckMessage=collectibleSpell(id).n+' évolue au rang '+(rank+1)+' !';render();return true;
}
function buildSpellDropPools(monsters=M){
 spellDropPools=new Map();spellDropSources=new Map();if(!monsters.length)return;
 // A family keeps the same spell lineage; higher monsters add higher tier spells.
 const races=[...new Set(monsters.map(m=>m.raceId??m.family??m.sourceId))].sort((a,b)=>String(a).localeCompare(String(b),'fr',{numeric:true}));
 const groupFor=m=>CLASSES[races.indexOf(m.raceId??m.family??m.sourceId)%CLASSES.length];
 for(const m of monsters){const group=groupFor(m);spellDropPools.set(m.id,DROP_SPELLS.filter(s=>s.originClass===group.id&&s.level<=Math.max(1,m.l)));}
 // Every spell has a source, including small or old catalogues with fewer families.
 for(const s of DROP_SPELLS)if(![...spellDropPools.values()].some(pool=>pool.some(x=>x.id===s.id))){
  const candidates=monsters.filter(m=>m.l>=s.level),source=[...(candidates.length?candidates:monsters)].sort((a,b)=>Math.abs(a.l-s.level)-Math.abs(b.l-s.level)||a.sourceId-b.sourceId)[0];spellDropPools.get(source.id).push(s);
 }
 for(const m of monsters)for(const s of spellDropPools.get(m.id)){if(!spellDropSources.has(s.id))spellDropSources.set(s.id,[]);spellDropSources.get(s.id).push({name:m.n,rate:12/spellDropPools.get(m.id).length});}
}
function spellDropsFor(m){return spellDropPools.get(m.id)||[];}
function spellDropRate(id,m){const pool=spellDropsFor(m);return pool.some(s=>s.id===id)?12/pool.length:0;}
function addSpellCopy(id,rank=1){if(!DROP_SPELL_MAP.has(id)||!Number.isInteger(rank)||rank<1||rank>6)return false;D.spellCollection[id]||=[0,0,0,0,0,0];D.spellCollection[id][rank-1]++;return true;}
function rollSpellDrop(m){
 if(!D.spellDeckMigration)return [];
 const pool=spellDropsFor(m);if(!pool.length||Math.random()*100>=12)return [];
 const s=pool[R(0,pool.length-1)];addSpellCopy(s.id);return [{spellId:s.id,rank:1}];
}
function spellSourceText(id){return (spellDropSources.get(id)||[]).map(m=>m.name+' ('+m.rate.toLocaleString('fr',{maximumFractionDigits:2})+' %)').join(', ');}
function spellToken(s,rank=1){return '<span class="spellToken" aria-hidden="true">'+({Terre:'◆',Feu:'✦',Eau:'●',Air:'≋',Soin:'✚',Neutre:'✧'}[s.e]||'✧')+'<small>'+rank+'</small></span>';}
function spellDropButton(q){
 const s=collectibleSpell(q.spellId),button=document.createElement('button');button.type='button';button.className='lootCard spellLoot';button.dataset.spellId=q.spellId;
 button.innerHTML=spellToken(s,q.rank)+'<span><b>'+esc(s.n)+'</b><br><small>Sort · rang '+q.rank+' · voir la collection</small></span>';
 button.onclick=()=>{document.querySelectorAll('dialog[open]').forEach(d=>d.close());deckSearch=s.n;deckOwnedOnly=true;$('spellSearch').value=deckSearch;$('spellOwnedOnly').checked=true;show('spellsPage');};return button;
}
function renderSpellDeck(){
 const root=$('spellDeck');root.replaceChildren();const locked=!deckEditable();
 $('deckLock').textContent=locked?'Deck et évolutions verrouillés pendant le combat.':'6 sorts au choix · modifications hors combat · attaque de base toujours disponible';
 $('deckStatus').textContent=deckMessage;
 D.spellDeck.forEach((id,index)=>{const s=collectibleSpell(id),card=document.createElement('div');card.className='deckSlot';card.dataset.deckSlot=index;
 card.innerHTML='<b>Emplacement '+(index+1)+'</b>'+(s?spellToken(s,bestSpellRank(id))+'<span>'+esc(s.n)+' · rang '+bestSpellRank(id)+'</span>':'<span class="mut">Libre</span>');
 if(s){const b=document.createElement('button');b.textContent='Retirer';b.disabled=locked;b.onclick=()=>setDeckSpell(index,null);card.append(b);}root.append(card);});
 $('spPtsTop').textContent=Object.keys(D.spellCollection).length+' / '+DROP_SPELLS.length+' sorts';
 const list=$('spellList');list.replaceChildren();const query=deckSearch.toLocaleLowerCase('fr');
 for(const s of DROP_SPELLS.filter(s=>(!deckOwnedOnly||bestSpellRank(s.id))&&(!query||s.n.toLocaleLowerCase('fr').includes(query)||s.e.toLocaleLowerCase('fr').includes(query)))){
  const rank=bestSpellRank(s.id),card=document.createElement('div');card.className='card collectibleSpell'+(!rank?' locked':'');card.dataset.spellId=s.id;
  card.innerHTML='<div class="row">'+spellToken(s,rank||1)+'<b>'+esc(s.n)+'</b></div><div class="mut">'+s.e+' · '+s.pa+' PA · '+(rank?'Rang '+rank+'/6':'À découvrir')+'</div><p>'+spellEffectText(s,spellValues(s,rank||1))+'</p><p class="mut">'+tacticalRuleTextFor(s)+' · '+(s.cd?'Relance '+s.cd+' tours':'3 lancers maximum par tour')+'</p>';
  if(['summon','bomb','detonate'].includes(s.kind)){const note=document.createElement('p');note.className='mut';note.textContent='Utilisable en combat classique. Pas encore disponible sur le terrain tactique.';card.append(note);}
  if(rank){
   const counts=document.createElement('div');counts.className='copyCounts';
   for(let r=1;r<=6;r++)if(spellCopies(s.id,r)){const row=document.createElement('div');row.textContent='Rang '+r+' : '+spellCopies(s.id,r)+' exemplaire(s) ';if(r<6){const b=document.createElement('button');b.textContent='Évoluer · 3 copies → rang '+(r+1);b.dataset.fuseRank=r;b.disabled=locked||spellCopies(s.id,r)<3;b.onclick=()=>fuseSpell(s.id,r);row.append(b);}counts.append(row);}card.append(counts);
   const b=document.createElement('button'),equipped=D.spellDeck.includes(s.id),free=D.spellDeck.indexOf(null);b.textContent=equipped?'Dans le deck':free<0?'Deck plein · retire un sort':'Ajouter au deck';b.disabled=locked||equipped||free<0;b.dataset.addSpell=s.id;b.onclick=()=>setDeckSpell(free,s.id);card.append(b);
  }
  const details=document.createElement('details'),summary=document.createElement('summary'),text=document.createElement('p');summary.textContent='Monstres et taux de drop';text.className='mut';text.textContent=spellSourceText(s.id)||'Sources en cours de chargement';details.append(summary,text);card.append(details);list.append(card);
 }
 if(!list.children.length)list.textContent=deckOwnedOnly?'Aucun sort ne correspond. Décoche « Possédés uniquement » pour voir les sorts à trouver.':'Aucun sort ne correspond à la recherche.';
}
