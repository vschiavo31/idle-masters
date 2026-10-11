/* Presentation only: never rolls damage, awards rewards or changes turn timing. */
(() => {
 const queue=[];let frame=null,serial=0;
 const motions=new Set();
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');
 const colors={Feu:'#ff964f',Air:'#c2f0ff',Terre:'#dfbd76',Eau:'#62caff',Neutre:'#fff0ce',Soin:'#85efab'};
 const layer=()=>document.getElementById('combatFx');
 function resetCombatVisuals(){serial++;queue.length=0;if(frame!==null)cancelAnimationFrame(frame);frame=null;for(const a of motions)a.cancel();motions.clear();layer()?.replaceChildren();}
 function motion(el,frames,options){if(!el||reduced.matches)return;const a=el.animate(frames,options);motions.add(a);a.finished.catch(()=>{}).finally(()=>motions.delete(a));}
 function point(el){const r=el?.getBoundingClientRect(),base=layer()?.getBoundingClientRect();return r&&base?{x:r.left+r.width/2-base.left,y:r.top+r.height*.4-base.top}:null;}
 function sprite(actor,index){if(typeof tactics!=='undefined'&&tactics){const cell=document.querySelector(actor==='player'?'#tacticalBoard [data-actor="player"] .art':'#tacticalBoard [data-enemy-index="'+index+'"] .art');if(cell)return cell;const pos=actor==="player"?tactics.player:tactics.enemies[index];return pos?document.querySelector("#tacticalBoard [data-x=\""+pos.x+"\"][data-y=\""+pos.y+"\"]"):null;}if(actor==='player')return document.getElementById('fightPlayerArt');return index===targetIndex||index===enemyActingIndex?document.getElementById('combatArtwork'):document.querySelector('#enemyGroup [data-enemy-index="'+index+'"] .art');}
 function node(className,p,text,color){const root=layer();if(!root||!p)return;const n=document.createElement('span');n.className=className;n.textContent=text||'';n.style.left=p.x+'px';n.style.top=p.y+'px';if(color)n.style.setProperty('--fx-color',color);root.append(n);return n;}
 function removeLater(n,ms){if(!n)return;const generation=serial;setTimeout(()=>{if(generation===serial)n.remove()},ms);}
 function number(actor,index,value,heal=false){const p=point(sprite(actor,index));const n=node('fxNumber'+(heal?' healing':''),p,(heal?'+':'−')+value,heal?colors.Soin:colors.Neutre);removeLater(n,reduced.matches?700:1000);}
 function burst(p,color,label){const n=node('fxBurst',p,label,color);removeLater(n,650);}
 function attack(actor,index,element,kind){const own=sprite(actor,index),opponent=sprite(actor==='player'?'enemy':'player',index),from=point(own),to=point(opponent);if(!from||!to)return;
  const color=colors[element]||colors.Neutre;
  if(reduced.matches){burst(to,color,'');return;}
  if(kind==='weapon'){
   motion(document.querySelector(actor==='player'?'.playerFocus':'.enemyFocus'),[{transform:'translate(0,0)'},{transform:'translate('+((to.x-from.x)*.18)+'px,'+((to.y-from.y)*.12)+'px)'},{transform:'translate(0,0)'}],{duration:360,easing:'ease-out'});
   const slash=node('fxSlash',to,'',color);removeLater(slash,450);
  }else{
   const orb=node('fxProjectile',from,'',color);
   if(orb){motion(orb,[{transform:'translate(-50%,-50%) scale(.6)',opacity:0},{opacity:1,offset:.15},{transform:'translate('+(to.x-from.x-10)+'px,'+(to.y-from.y-10)+'px) scale(1)',opacity:0}],{duration:340,easing:'ease-in'});removeLater(orb,400);}
  }
  burst(to,color,'');
 }
 function flush(){frame=null;const events=queue.splice(0);if(!layer()||!document.body.classList.contains('arenaMode'))return;
  for(const e of events){
   if(e.type==='cast'){
    if(['heal','regen','shield','buff','focus','recover','summon','bomb'].includes(e.kind))burst(point(sprite('player')),colors[e.element]||colors.Soin,e.kind==='shield'?'Bouclier':e.kind==='recover'?'+ PA':'');
    else attack('player',e.index,e.element,e.kind);
   }else if(e.type==='hit'){
    const target=sprite('enemy',e.index);number('enemy',e.index,e.amount);
    motion(target,[{filter:'brightness(2)',transform:'translateX(0)'},{filter:'brightness(1.3)',transform:'translateX(7px)'},{filter:'brightness(1)',transform:'translateX(-4px)'},{transform:'translateX(0)'}],{duration:300});
    if(e.dead){const card=document.querySelector('#enemyGroup [data-enemy-index="'+e.index+'"] .art');motion(card,[{opacity:1,transform:'scale(1)'},{opacity:0,transform:'scale(.7)'}],{duration:500});}
   }else if(e.type==='enemy'){
    attack('enemy',e.index,e.element,'dmg');number('player',null,e.amount);
    motion(document.querySelector('.playerFocus'),[{transform:'translateX(0)',filter:'brightness(1.8)'},{transform:'translateX(-6px)'},{transform:'translateX(4px)'},{transform:'translateX(0)',filter:'brightness(1)'}],{duration:280});
   }else if(e.type==='heal'){number('player',null,e.amount,true);burst(point(sprite('player')),colors.Soin,'');}
   else if(e.type==='critical'){const n=node('fxCritical',point(sprite(e.actor,e.index)),'CRITIQUE !','#ffe381');removeLater(n,950);}
   else if(e.type==='radiant'){const n=node('fxCritical radiantFx',{x:layer().clientWidth/2,y:layer().clientHeight*.38},'Butin rayonnant !','#ffe381');removeLater(n,1500);}
  }
 }
 window.combatVisual=(type,data={})=>{if(queue.length<60)queue.push({type,...data});if(frame===null)frame=requestAnimationFrame(flush);};
 window.resetCombatVisuals=resetCombatVisuals;
 document.addEventListener('visibilitychange',()=>{if(document.hidden)resetCombatVisuals()});
})();
