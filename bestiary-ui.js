/* One bestiary view, sharing the same local records as combat. */
function esc(v) {
  return String(v ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
}
function familyName(ms) {
  // raceId groups sometimes mix species; use a representative name rather than an inferred species.
  const names = [...new Set(ms.map((m) => m.name))];
  return names.slice(0, 2).join(" / ") + (names.length > 2 ? "…" : "");
}
let bestiarySignature = "";
function equipmentSearchText(value) {
  return String(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("fr");
}
let equipmentSearchSignature = "";
function renderEquipmentSearch(combat) {
  const input = document.getElementById("equipmentSearch"),
    root = document.getElementById("equipmentSearchResults");
  if (!input || !root) return;
  input.oninput = () => renderEquipmentSearch(combat);
  const q = equipmentSearchText(input.value.trim());
  const signature = JSON.stringify([q, st("Prospection"), combat.map(m => m.id)]);
  if (signature === equipmentSearchSignature) return;
  equipmentSearchSignature = signature;
  root.replaceChildren();
  const status = document.createElement("p");
  status.className = "mut";
  root.append(status);
  if (!q) {
    status.textContent = "Saisis un nom pour chercher parmi tous les équipements du jeu.";
    return;
  }
  const items = Object.keys(I).map(id => ({id, item: meta(id)}))
    .filter(({item}) => equipmentSearchText(item.n).includes(q))
    .sort((a, b) => a.item.l - b.item.l || a.item.n.localeCompare(b.item.n, "fr"));
  status.textContent = items.length ? items.length + " équipement(s) trouvé(s)" : "Aucun équipement trouvé.";
  for (const {id, item} of items) {
    const details = document.createElement("details"), summary = document.createElement("summary");
    details.className = "card";
    details.dataset.itemId = id;
    summary.textContent = item.n + " · niv. " + item.l;
    details.append(summary);
    let loaded = false;
    details.addEventListener("toggle", () => {
      if (!details.open || loaded) return;
      loaded = true;
      details.insertAdjacentHTML("beforeend", equipmentExtraInfo(id));
      const heading = document.createElement("p");
      heading.textContent = item.s + " · Caractéristiques (jets possibles)";
      details.append(heading);
      const stats = document.createElement("div");
      stats.className = "itemStats encyclopediaStats";
      for (const [name, bounds] of Object.entries(item.x)) {
        const row = document.createElement("span"), value = document.createElement("b");
        const label = {Vitalite: "Vitalité", Agilite: "Agilité"}[name] || name;
        const [low, high] = [Math.min(...bounds), Math.max(...bounds)];
        const signed = n => (n > 0 ? "+" : "") + n;
        row.append(document.createTextNode(label + " "));
        value.textContent = low === high ? signed(low) : signed(low) + " à " + signed(high);
        row.append(value);
        stats.append(row);
      }
      details.append(stats);
      const monsters = combat.map(m => ({m, rate: dropRate(id, m)}))
        .filter(({rate}) => rate > 0)
        .sort((a, b) => b.rate - a.rate || a.m.l - b.m.l || a.m.n.localeCompare(b.m.n, "fr"));
      const count = document.createElement("p");
      count.className = "mut";
      count.textContent = monsters.length ? monsters.length + " monstre(s) peuvent dropper cet équipement" : "Aucun monstre jouable ne droppe cet équipement.";
      details.append(count);
      for (const {m, rate} of monsters) {
        const row = document.createElement("div");
        row.className = "dropRow";
        row.dataset.monsterId = m.id;
        const label = document.createElement("span"), chance = document.createElement("span");
        const zones = [...new Set((m.zones || [m.z]).map(z => Z[z]?.[0]).filter(Boolean))];
        label.textContent = m.n + " · niv. " + m.l + " · " + zones.join(" / ");
        chance.className = "dropRate";
        chance.textContent = rate.toFixed(3) + " %";
        row.append(label, chance);
        details.append(row);
      }
    });
    root.append(details);
  }
}
function renderLocalBestiary(source, combat) {
  const input = document.getElementById("bestiarySearch");
  if (!input.oninput)
    input.oninput = () => {
      bestiarySignature = "";
      renderLocalBestiary(source, combat);
    };
  const q = input.value.trim().toLocaleLowerCase("fr");
  const signature = JSON.stringify([q, D.master, D.seen, st("Prospection")]);
  if (signature === bestiarySignature) return;
  bestiarySignature = signature;
  const playable = new Map(combat.map((m) => [m.sourceId, m]));
  const families = new Map();
  for (const m of source) {
    const key = m.raceId;
    if (!families.has(key)) families.set(key, []);
    families.get(key).push(m);
  }
  let count = 0;
  const root = document.getElementById("bestiary");
  root.innerHTML = "";
  const status = document.createElement("div");
  status.className = "mut";
  root.append(status);
  [...families.entries()]
    .sort(
      (a, b) =>
        Math.min(...a[1].map((m) => m.minLevel)) -
        Math.min(...b[1].map((m) => m.minLevel)),
    )
    .forEach(([id, ms]) => {
      const label = familyName(ms);
      const shown = ms.filter(
        (m) =>
          !q ||
          (label + " " + id + " " + m.name).toLocaleLowerCase("fr").includes(q),
      );
      if (!shown.length) return;
      count += shown.length;
      const family = document.createElement("details");
      family.className = "card";
      const summary = document.createElement("summary");
      summary.textContent = label + " · " + shown.length + " entrées";
      family.append(summary);
      // Render cards only when expanded, so 817 records do not slow each combat action on mobile.
      let populated = false;
      family.addEventListener("toggle", () => {
        if (!family.open || populated) return;
        populated = true;
        shown
          .sort(
            (a, b) =>
              a.minLevel - b.minLevel || a.name.localeCompare(b.name, "fr"),
          )
          .forEach((m) => {
            const live = playable.get(m.id),
              card = document.createElement("div");
            card.className = "card";
            card.innerHTML =
              "<b>" +
              esc(m.name) +
              '</b><div class="mut">Niv. ' +
              m.minLevel +
              "–" +
              m.maxLevel +
              " · " +
              m.hpMin +
              "–" +
              m.hpMax +
              " PV · " +
              m.pa +
              " PA / " +
              m.pm +
              " PM</div>";
            if (live) {
              const n = D.master[live.id] || 0;
              card.insertAdjacentHTML(
                "beforeend",
                '<div class="gold">' +
                  esc(Z[live.z][0]) +
                  " · " +
                  n +
                  " victoire(s)" +
                  (live.boss ? " · Boss Idle Masters" : "") +
                  "</div>",
              );
              if (live.sourceDrops) {
                card.append(sourceDropDetails(live));
                family.append(card);
                return;
              }
              const drops = document.createElement("details");
              const ds = document.createElement("summary");
              ds.textContent =
                lootLabel(live) +
                " · " +
                equipmentChance().toFixed(1) +
                " % par monstre · " +
                lootPool(live).length +
                " équipement(s)";
              drops.append(ds);
              const info = document.createElement("div");
              info.className = "mut";
              info.textContent =
                (FAMILY_LOOT[live.sourceId]?.levelRange
                  ? "Aucun équipement de cette famille dans les données niveau 1–40 : sélection par niveau. "
                  : "") +
                "Un équipement maximum par monstre vaincu, choisi parmi les objets affichés. La chance totale est identique pour tous les monstres à prospection égale. Les taux sont propres à Idle Masters.";
              drops.append(info);
              for (const item of lootPool(live)) {
                const row = document.createElement("div");
                row.className = "dropRow";
                row.innerHTML =
                  "<span>" +
                  esc(item.name) +
                  " · niv. " +
                  item.level +
                  '</span><span class="dropRate">' +
                  dropRate("d" + item.id, live).toFixed(2) +
                  " %</span>";
                drops.append(row);
              }
              card.append(drops);
            } else {
              const note = document.createElement("div");
              note.className = "mut";
              note.textContent =
                "Fiche encyclopédique · rencontre non intégrée au jeu.";
              card.append(note);
            }
            family.append(card);
          });
      });
      root.append(family);
    });
  status.textContent =
    count + " entrées locales · " + combat.length + " rencontres jouables";
}
