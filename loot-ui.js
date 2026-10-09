/* Shared owned-item inspection for the bag, combat rewards and auto session. */
let inspectedUid=null, inspectedSnapshot=null;
function lootButton(q) {
 const button=document.createElement('button');
 button.type='button';button.className='lootCard'+(q.rayonnant?' radiant':'');button.dataset.uid=q.uid;
 const owned=itemByUid(q.uid), worn=Object.values(D.w).some(item=>item?.uid===q.uid);
 button.innerHTML=itemArt(q.id)+'<span><b>'+esc(meta(q.id)?.n||'Équipement')+'</b><br><small>'+(worn?'Équipé':owned?'Voir, équiper ou vendre':'Vendu ou retiré du sac')+(q.rayonnant?' · Rayonnant':'')+'</small></span>';
 button.onclick=()=>openItemInspector(q);return button;
}
function openItemInspector(q) {
 inspectedUid=q.uid;inspectedSnapshot=q;
 refreshItemInspector();
 const dialog=$('itemInspector');if(!dialog.open) dialog.showModal();
}
function refreshItemInspector() {
 if(inspectedUid===null)return;
 const live=itemByUid(inspectedUid),q=live||inspectedSnapshot,x=meta(q.id),root=$('itemInspectorBody');
 if(!x){root.textContent='Objet indisponible dans cette version.';return;}
 const inBag=D.bag.some(item=>item.uid===q.uid),worn=Object.entries(D.w).find(([,item])=>item?.uid===q.uid);
 $('itemInspectorTitle').textContent=x.n;
 root.innerHTML='<div class="inspectHero">'+itemArt(q.id,'itemIcon')+'<div>'+esc(x.s)+' · Niv. '+x.l+'<br><b>'+(q.rayonnant?'Rayonnant · ×1,5':q.st?'Jet '+jet(q)+' %':'')+'</b></div></div>'+equipmentExtraInfo(q.id,q)+
 '<div class="itemStats">'+Object.entries(q.st||{}).map(([key,value])=>'<span>'+esc(key)+' <b>'+(value>=0?'+':'')+value+'</b></span>').join('')+'</div>'+
 (live?comparison(q):'<p class="mut">Cet objet a été vendu ou retiré du sac.</p>')+'<p class="inspectStatus">'+(worn?'Équipé : '+esc(worn[0]):inBag?'Dans le sac':'')+'</p>';
 if(!inBag)return;
 const controls=document.createElement('div');controls.className='itemActions inspectActions';
 const select=document.createElement('select');select.setAttribute('aria-label','Emplacement');
 for(const target of compatibleSlots(x)) {
  const option=document.createElement('option');option.value=target;
  option.textContent=target+(D.w[target]?' · '+meta(D.w[target].id)?.n:' · libre');select.append(option);
 }
 select.value=slot(q)||compatibleSlots(x)[0];
 const equipButton=document.createElement('button');equipButton.textContent='Équiper';
 const update=()=>equipButton.disabled=D.lv<x.l||duplicateAccessory(q,select.value);
 update();select.onchange=update;equipButton.onclick=()=>{equip(q.uid,select.value);save();refreshLootUI()};
 const sellButton=document.createElement('button');sellButton.textContent='Vendre · 5 K';sellButton.disabled=!!q.locked;
 sellButton.onclick=()=>showInlineSale(q,controls);
 controls.append(select,equipButton,sellButton);root.append(controls);
}
function showInlineSale(q,container) {
 container.querySelector('.inlineSale')?.remove();
 const review=document.createElement('div');review.className='inlineSale';review.setAttribute('role','group');review.setAttribute('aria-label','Confirmer la vente');
 const message=document.createElement('span');message.textContent='Vendre cet objet pour 5 kamas ?';
 const confirm=document.createElement('button');confirm.textContent='Confirmer la vente';
 const cancel=document.createElement('button');cancel.textContent='Annuler';
 confirm.onclick=()=>{const scroll=scrollY;confirmSingleSale(q.uid,q.id);save();refreshLootUI();if(!$('itemInspector').open)requestAnimationFrame(()=>scrollTo({top:scroll,behavior:'instant'}))};
 cancel.onclick=()=>review.remove();review.append(message,confirm,cancel);container.append(review);
}
function refreshLootUI() {
 if($('itemInspector').open)refreshItemInspector();
 if($('autoRecap').open)renderAutoRecap();
}
function openAutoRecap() {
 if(!D.autoSession)return;
 if(auto){auto=false;clearTimeout(autoTimer);if(D.end&&lastResult)mode='result';render();}
 renderAutoRecap();if(!$('autoRecap').open)$('autoRecap').showModal();
}
function renderAutoRecap() {
 const session=D.autoSession;if(!session)return;
 $('autoRecapTotals').textContent=session.battles+' combat(s) terminé(s) · '+(session.wins??session.battles)+' victoire(s) · '+(session.losses||0)+' défaite(s) · '+session.xp.toLocaleString('fr')+' XP · '+session.k.toLocaleString('fr')+' kamas · '+session.drops.length+' drop(s)';
 const root=$('autoRecapDrops');root.replaceChildren();
 const groups=new Map();for(const q of session.drops){if(!groups.has(q.id))groups.set(q.id,[]);groups.get(q.id).push(q)}
 if(!groups.size)root.textContent='Aucun équipement obtenu pour le moment.';
 for(const [id,items] of groups){
  const section=document.createElement('details');section.className='card';
  const summary=document.createElement('summary');summary.innerHTML=itemArt(id,'artSmall')+'<span>'+esc(meta(id)?.n||id)+' <b>× '+items.length+'</b></span>';section.append(summary);
  section.addEventListener('toggle',()=>{if(!section.open||section.dataset.loaded)return;section.dataset.loaded='1';for(const q of items)section.append(lootButton(itemByUid(q.uid)||q))});root.append(section);
 }
}
$('itemInspectorClose').onclick=()=>$('itemInspector').close();
$('itemInspector').addEventListener('close',()=>{inspectedUid=null;inspectedSnapshot=null;if(mode==='result')$('again').focus({preventScroll:true})});
$('autoRecapClose').onclick=()=>$('autoRecap').close();
$('autoRecap').addEventListener('close',()=>{if(mode==='result')$('again').focus({preventScroll:true})});
$('autoRecapBtn').onclick=openAutoRecap;
$('inventoryView').onchange=()=>{D.inventoryView=$('inventoryView').value;inventory();save()};

$('autoRecapHistory').onclick=openAutoRecap;
$('resultAutoRecapBtn').onclick=openAutoRecap;
