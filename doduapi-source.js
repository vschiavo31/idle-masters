/* Idle Masters — DofusDude/DoduAPI content source
   Source: https://api.dofusdu.de — Dofus 3, French locale.
   This module deliberately keeps gameplay/drop balancing in Idle Masters while
   using DoduAPI as the canonical encyclopedia for equipment and sets. */
window.DODU_SOURCE={
  base:'https://api.dofusdu.de/dofus3/v1/fr',
  equipment:'/items/equipment',
  equipmentAll:'/items/equipment/all',
  sets:'/sets',
  setsAll:'/sets/all',
  equipmentSearch:q=>'/items/equipment/search?query='+encodeURIComponent(q),
  setSearch:q=>'/sets/search?query='+encodeURIComponent(q),
  async get(path){const r=await fetch(this.base+path);if(!r.ok)throw new Error('DoduAPI '+r.status);return r.json()},
  async findEquipment(q){return this.get(this.equipmentSearch(q))},
  async findSets(q){return this.get(this.setSearch(q))}
};
