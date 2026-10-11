/* First manual tactical arena. All positions and PM are transient. */
let tactics=null,tacticalNext=false;
const TACTICAL_WIDTH=9,TACTICAL_HEIGHT=7;
const tacticalKey=p=>p.x+','+p.y;
const tacticalDistance=(a,b)=>Math.abs(a.x-b.x)+Math.abs(a.y-b.y);
function tacticalInit(){
 if(!tacticalNext){tactics=null;return;}tacticalNext=false;
 tactics={player:{x:1,y:5},enemies:encounter.members.map((_,i)=>({x:7,y:1+i*2})),rocks:new Set(['4,1','4,2','4,4','4,5','2,2','6,4']),pm:Math.max(1,3+st('PM')),armed:null,message:'Clique sur une case verte pour te déplacer.'};
}
function startTactical(){if(!playerClass()||!GameSave.profile)return;tacticalNext=true;startEncounter(D.z,2);}
function tacticalOccupied(p,skip=null){
 return tacticalKey(p)===tacticalKey(tactics.player)||tactics.enemies.some((e,i)=>i!==skip&&encounter.members[i].hp>0&&tacticalKey(e)===tacticalKey(p));
}
function tacticalPaths(start,skip=null){
 const paths=new Map([[tacticalKey(start),[]]]),queue=[start];
 for(let head=0;head<queue.length;head++){
  const p=queue[head];
  for(const [dx,dy] of [[0,-1],[1,0],[0,1],[-1,0]]){
   const next={x:p.x+dx,y:p.y+dy},key=tacticalKey(next);
   if(next.x<0||next.x>=TACTICAL_WIDTH||next.y<0||next.y>=TACTICAL_HEIGHT||paths.has(key)||tactics.rocks.has(key)||tacticalOccupied(next,skip))continue;
   paths.set(key,[...paths.get(tacticalKey(p)),next]);queue.push(next);
  }
 }return paths;
}
function tacticalSight(a,b){
 // Supercover ray: diagonal corner gaps do not bypass an obstacle.
 let x=a.x,y=a.y,dx=b.x-a.x,dy=b.y-a.y;
 const sx=Math.sign(dx),sy=Math.sign(dy),stepX=dx?1/Math.abs(dx):Infinity,stepY=dy?1/Math.abs(dy):Infinity;
 let tx=stepX/2,ty=stepY/2;
 const blocked=p=>tactics.rocks.has(tacticalKey(p));
 while(x!==b.x||y!==b.y){
  if(Math.abs(tx-ty)<1e-9){if(blocked({x:x+sx,y})||blocked({x,y:y+sy}))return false;x+=sx;y+=sy;tx+=stepX;ty+=stepY;}
  else if(tx<ty){x+=sx;tx+=stepX;}else{y+=sy;ty+=stepY;}
  if(blocked({x,y}))return false;
 }return true;
}
// Curated rules for Idle Masters spells, not official Dofus spell tables.
const TACTICAL_SPELL_RANGES={
 iop:[2,3,0,2,4,0,4,1],cra:[6,5,0,6,5,4,6,7],
 eniripsa:[4,0,0,3,0,3,0,4],sadida:[5,4,0,4,0,5,3,5],
 feca:[3,0,5,4,0,3,0,4],osamodas:[3,4,0,0,3,0,4,0],
 enutrof:[5,4,0,5,4,0,5,6],sram:[2,3,0,2,3,0,2,1],
 xelor:[4,3,0,4,0,3,4,5],ecaflip:[4,3,0,3,0,4,0,5],
 sacrieur:[2,2,0,2,1,0,2,1],pandawa:[3,2,0,3,0,4,2,4],
 roublard:[5,4,0,0,5,0,0,6],zobal:[2,3,0,2,0,3,0,2],
 steamer:[5,4,0,0,4,0,5,5],eliotrope:[5,4,0,5,0,4,3,6],
 huppermage:[4,5,0,3,0,4,5,4],ouginak:[2,3,0,2,1,0,3,1],
 forgelance:[3,4,0,3,0,4,3,5]
};
function tacticalRule(i){
 if(i===-2){const type=D.w.Arme&&meta(D.w.Arme.id)?.subtype;return {min:1,max:type==='Arc'?6:type==='Baguette'?4:1,line:type==='Arc',shape:'point',radius:0};}
 const s=spellBook()[i],targeted=['dmg','drain','aoe','poison','mark','weaken'].includes(s?.kind);
 const max=targeted?Math.max(1,TACTICAL_SPELL_RANGES[D.classId]?.[i]||3):0;
 const area=s?.kind==='aoe',shape=area?(['cra','sadida','feca','huppermage'].includes(D.classId)?'circle':'cross'):'point';
 return {min:targeted?1:0,max,line:targeted&&D.classId==='cra'&&[1,7].includes(i),shape,radius:area?(i>=6?2:1):0};
}
function tacticalRange(i){return tacticalRule(i).max;}
function tacticalRuleText(i){const r=tacticalRule(i);return r.max?'PO '+r.min+'–'+r.max+(r.line?' · en ligne':'')+(r.radius?' · '+(r.shape==='cross'?'croix':'cercle')+' '+r.radius:''):'Sur soi';}
function tacticalTargeted(i){return (i===-2?!!D.w.Arme&&meta(D.w.Arme.id)?.weapon?.lines.some(line=>line.kind!=='heal'):false)||['dmg','drain','aoe','poison','mark','weaken'].includes(spellBook()[i]?.kind);}
function tacticalValidTarget(i,p){const r=tacticalRule(i),d=tacticalDistance(tactics.player,p);return d>=r.min&&d<=r.max&&(!r.line||p.x===tactics.player.x||p.y===tactics.player.y)&&tacticalSight(tactics.player,p);}
function tacticalCanCast(i){if(!tactics)return true;if(['summon','bomb','detonate'].includes(spellBook()[i]?.kind))return false;if(!tacticalTargeted(i))return true;const target=tactics.enemies[targetIndex];return !!target&&encounter.members[targetIndex].hp>0&&tacticalValidTarget(i,target);}
function tacticalInArea(center,p,r){return tacticalDistance(center,p)<=r.radius&&(r.shape!=='cross'||p.x===center.x||p.y===center.y)&&tacticalSight(center,p);}
function tacticalAreaTargets(i=3){if(!tactics)return livingTargets();const center=tactics.enemies[targetIndex],r=tacticalRule(i);return livingTargets().filter(j=>tacticalInArea(center,tactics.enemies[j],r));}
function tacticalSplash(primary,other){return !tactics||tacticalDistance(tactics.enemies[primary],tactics.enemies[other])<=1&&tacticalSight(tactics.enemies[primary],tactics.enemies[other]);}
function tacticalMove(x,y){
 if(!tactics||!D.tr||D.end||mode!=='fight'||auto||tactics.armed!==null)return false;
 const path=tacticalPaths(tactics.player).get(x+','+y);
 if(!path?.length||path.length>tactics.pm)return false;
 tactics.player={x,y};tactics.pm-=path.length;tactics.message='Déplacement : '+path.length+' PM.';render();return true;
}
function tacticalChoose(i){
 if(!tactics)return i===-2?useWeapon():cast(i);
 if(i===-2?!canUseWeapon(true):!canCast(i,true))return;
 if(!tacticalTargeted(i)){i===-2?useWeapon():cast(i);return;}
 tactics.armed=i;tactics.message=(i===-2?'Corps à corps':spellBook()[i].n)+' · '+tacticalRuleText(i)+'. Clique sur un monstre rouge.';render();
}
function tacticalClickEnemy(index){
 if(!D.tr||D.end||auto)return;
 selectTarget(index,true);
 if(tactics.armed!==null){const i=tactics.armed;if(tacticalCanCast(i)){tactics.armed=null;i===-2?useWeapon():cast(i);}else{tactics.message='Cible hors de portée ou derrière un obstacle.';render();}}
 else{const m=M.find(m=>m.id===encounter.members[index].id),a=tacticalMonsterSpell(m);tactics.message=m.n+' · '+a.name+' · PO '+a.range+(a.line?' en ligne':'')+' · '+a.pm+' PM. Sélectionne un sort.';render();}
}
function tacticalEnemyAction(index){
 if(!tactics)return true;
 const m=M.find(m=>m.id===encounter.members[index].id),attack=tacticalMonsterSpell(m),range=attack.range;
 tactics.enemySpell=attack;
 let origin=tactics.enemies[index];
 const inRange=p=>tacticalDistance(p,tactics.player)<=range&&(!attack.line||p.x===tactics.player.x||p.y===tactics.player.y)&&tacticalSight(p,tactics.player);
 if(!inRange(origin)){
  const paths=tacticalPaths(origin,index),candidates=[...paths].map(([key,path])=>({p:{x:Number(key.split(',')[0]),y:Number(key.split(',')[1])},path}));
  candidates.sort((a,b)=>Number(inRange(b.p))-Number(inRange(a.p))|| (inRange(a.p)&&inRange(b.p)?a.path.length-b.path.length:tacticalDistance(a.p,tactics.player)-tacticalDistance(b.p,tactics.player)||a.path.length-b.path.length));
  const path=candidates[0]?.path||[],steps=path.slice(0,attack.pm);
  if(steps.length){tactics.enemies[index]={...steps.at(-1)};lg(m.n+' se déplace de '+steps.length+' case(s).');}
 }
 return inRange(tactics.enemies[index]);
}
function tacticalNewRound(){if(tactics){tactics.pm=Math.max(1,3+st('PM'));tactics.armed=null;tactics.message='À toi : déplace-toi ou choisis un sort.';}}
function renderTactical(){
 const root=$('tacticalBoard');document.querySelector('.arenaShell').classList.toggle('tacticalArena',!!tactics);root.hidden=!tactics;
 if(!tactics)return;
 $('tacticalStats').textContent=D.hp+'/'+mh()+' PV · '+PA+'/'+maxpa()+' PA · '+tactics.pm+'/'+Math.max(1,3+st('PM'))+' PM';
 $('tacticalHint').textContent=D.tr?tactics.message:'Les monstres jouent chacun leur tour.';
 root.replaceChildren();const paths=D.tr&&tactics.armed===null?tacticalPaths(tactics.player):new Map();
 for(let y=0;y<TACTICAL_HEIGHT;y++)for(let x=0;x<TACTICAL_WIDTH;x++){
  const p={x,y},key=tacticalKey(p),player=key===tacticalKey(tactics.player),index=tactics.enemies.findIndex((e,i)=>encounter.members[i].hp>0&&key===tacticalKey(e)),rock=tactics.rocks.has(key),path=paths.get(key),reachable=path?.length>0&&path.length<=tactics.pm;
  const cell=document.createElement('button');cell.type='button';cell.className='tacticalCell';cell.dataset.x=x;cell.dataset.y=y;cell.setAttribute('role','gridcell');
  cell.classList.toggle('rock',rock);cell.classList.toggle('reachable',reachable);cell.classList.toggle('player',player);
  if(tactics.armed!==null&&tacticalRule(tactics.armed).radius&&tacticalCanCast(tactics.armed))cell.classList.toggle('areaPreview',tacticalInArea(tactics.enemies[targetIndex],p,tacticalRule(tactics.armed)));
  cell.disabled=!D.tr||D.end||rock||(!player&&index<0&&!reachable);
  let label='Case '+(x+1)+', '+(y+1);
  if(player){cell.innerHTML=classArt(D.classId);cell.dataset.actor='player';label+=' · Ton personnage';}
  else if(index>=0){const m=M.find(m=>m.id===encounter.members[index].id);cell.innerHTML=monsterArt(m);cell.dataset.enemyIndex=index;cell.classList.toggle('selected',index===targetIndex);cell.classList.toggle('acting',index===enemyActingIndex);cell.classList.toggle('attackable',tactics.armed!==null&&tacticalValidTarget(tactics.armed,p));const attack=tacticalMonsterSpell(m);label+=' · '+m.n+' · '+encounter.members[index].hp+' PV · '+attack.name+' · PO '+attack.range+' · '+attack.pm+' PM'+(attack.line?' · en ligne':'');cell.onclick=()=>tacticalClickEnemy(index);}
  else if(rock){cell.textContent='◆';label+=' · Obstacle';}
  else{label+=reachable?' · '+path.length+' PM':'';cell.onclick=()=>tacticalMove(x,y);}
  cell.setAttribute('aria-label',label);cell.title=label;root.append(cell);
 }
}

// One adapted offensive spell per monster; preserves existing damage/resistance math.
function tacticalMonsterSpell(m){
 const ranged=['Feu','Air','Eau'].includes(m.e);
 return {name:ranged?'Projection '+(m.e||'Neutre').toLowerCase():'Frappe '+(m.e||'Neutre').toLowerCase(),range:ranged?2:1,line:ranged&&m.e==='Feu',pm:3};
}
