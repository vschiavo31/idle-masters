/* Exact source catalogue; account-owned draft, separate from the live combat roster. */
const RosterSelection = (() => {
  let catalogue, byId, zoneLabels, draft, onSave, currentZone, loading;
  const el = (id) => document.getElementById(id);
  const esc = (text) =>
    String(text).replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
  const level = (m) =>
    m.minLevel == null
      ? "Niveau non renseigné"
      : "Niv. " +
        m.minLevel +
        (m.maxLevel !== m.minLevel ? "–" + m.maxLevel : "");
  const normalize = (s) =>
    s
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  function selected() {
    return new Set(draft.selectedIds);
  }
  function persist() {
    draft.updatedAt = new Date().toISOString();
    draft.validated = false;
    onSave();
    render();
  }
  function render() {
    const chosen = selected(),
      query = normalize(el("rosterSearch").value.trim());
    const onlySelected = el("rosterOnlySelected").checked;
    const zone =
      catalogue.zones.find((z) => z.id === currentZone) || catalogue.zones[0];
    const ids = query ? catalogue.monsters.map((m) => m.id) : zone.monsters;
    const list = ids
      .map((id) => byId.get(id))
      .filter(
        (m) =>
          (!query ||
            normalize(m.name).includes(query) ||
            String(m.id) === query) &&
          (!onlySelected || chosen.has(m.id)),
      );
    el("rosterCount").textContent =
      chosen.size + " / " + catalogue.monsters.length + " monstres retenus";
    el("rosterStatus").textContent = draft.validated
      ? GameSave.confirmed
        ? "Choix validés et sauvegardés pour la prochaine extension."
        : "Choix validés localement. Synchronisation en attente : vérifie le statut de sauvegarde du jeu."
      : "Brouillon enregistré automatiquement avec ton personnage. Valide quand tu as terminé.";
    el("rosterHeading").textContent = query
      ? "Résultats dans toutes les zones · " + list.length
      : zone.name + " · " + list.length + " monstres";
    el("rosterZoneInfo").textContent = query
      ? "Tri par niveau croissant. Un même ID est sélectionné dans toutes ses zones."
      : [
          zone.area,
          zone.level ? "Niveau de zone : " + zone.level : "",
          "Tri des monstres par niveau croissant",
        ]
          .filter(Boolean)
          .join(" · ");
    el("rosterList").innerHTML =
      list
        .map(
          (m) =>
            '<label class="rosterMonster"><input type="checkbox" data-monster="' +
            m.id +
            '" ' +
            (chosen.has(m.id) ? "checked" : "") +
            "><span><b>" +
            esc(m.name) +
            '</b><br><span class="mut">' +
            esc(level(m)) +
            " · ID " +
            m.id +
            "</span>" +
            (query
              ? '<br><small class="mut">' +
                esc((zoneLabels.get(m.id) || []).join(" · ")) +
                "</small>"
              : "") +
            "</span></label>",
        )
        .join("") || '<p class="mut">Aucun monstre pour ce filtre.</p>';
    el("rosterList")
      .querySelectorAll("input")
      .forEach(
        (input) =>
          (input.onchange = () => {
            const ids = selected(),
              id = Number(input.dataset.monster);
            input.checked ? ids.add(id) : ids.delete(id);
            draft.selectedIds = Array.from(ids).sort((a, b) => a - b);
            persist();
          }),
      );
    el("rosterPrevious").disabled = catalogue.zones.indexOf(zone) === 0;
    el("rosterNext").disabled =
      catalogue.zones.indexOf(zone) === catalogue.zones.length - 1;
    el("rosterValidate").disabled = !chosen.size;
  }
  async function open(state, initialIds, save) {
    onSave = save;
    try {
      if (!catalogue) {
        el("rosterStatus").textContent = "Chargement de la liste complète…";
        loading ||= fetch("monster-catalogue.json?v=3.10.1")
          .then((r) => {
            if (!r.ok) throw Error("HTTP " + r.status);
            return r.json();
          })
          .catch((e) => {
            loading = null;
            throw e;
          });
        catalogue = await loading;
        byId = new Map(catalogue.monsters.map((m) => [m.id, m]));
        zoneLabels = new Map();
        for (const z of catalogue.zones)
          for (const id of z.monsters) {
            if (!zoneLabels.has(id)) zoneLabels.set(id, []);
            zoneLabels.get(id).push(z.name);
          }
      }
      if (!state.rosterDraft || !Array.isArray(state.rosterDraft.selectedIds)) {
        state.rosterDraft = {
          sourceVersion: catalogue.sourceVersion,
          selectedIds: initialIds.filter((id) => byId.has(id)),
          validated: false,
        };
        save();
      }
      draft = state.rosterDraft;
      const beforeFiltering = JSON.stringify(draft.selectedIds);
      draft.selectedIds = Array.from(
        new Set(draft.selectedIds.filter((id) => byId.has(id))),
      );
      const policyChanged = draft.exclusionPolicy !== catalogue.exclusionPolicy;
      draft.exclusionPolicy = catalogue.exclusionPolicy;
      if (JSON.stringify(draft.selectedIds) !== beforeFiltering) {
        draft.validated = false;
        draft.updatedAt = new Date().toISOString();
        save();
      } else if (policyChanged) save();
      currentZone ??= catalogue.zones[0].id;
      el("rosterZone").innerHTML = catalogue.zones
        .map(
          (z) =>
            '<option value="' +
            z.id +
            '">' +
            esc(z.name) +
            (z.id === -1 ? "" : " · niv. " + z.minLevel + "–" + z.maxLevel) +
            "</option>",
        )
        .join("");
      el("rosterZone").value = String(currentZone);
      el("rosterZone").onchange = () => {
        currentZone = Number(el("rosterZone").value);
        el("rosterSearch").value = "";
        render();
      };
      el("rosterSearch").oninput = render;
      el("rosterOnlySelected").onchange = render;
      for (const [id, step] of [
        ["rosterPrevious", -1],
        ["rosterNext", 1],
      ])
        el(id).onclick = () => {
          const idx = catalogue.zones.findIndex((z) => z.id === currentZone),
            next = catalogue.zones[idx + step];
          if (next) {
            currentZone = next.id;
            el("rosterZone").value = String(currentZone);
            el("rosterSearch").value = "";
            render();
          }
        };
      el("rosterValidate").onclick = async () => {
        draft.validated = true;
        draft.validatedAt = new Date().toISOString();
        save();
        el("rosterStatus").textContent = "Enregistrement de tes choix…";
        await GameSave.flush();
        render();
      };
      el("rosterExport").onclick = () => {
        const content = {
          ...draft,
          monsters: draft.selectedIds.map((id) => byId.get(id)),
          sourceUrl: catalogue.sourceUrl,
        };
        const url = URL.createObjectURL(
            new Blob([JSON.stringify(content, null, 2)], {
              type: "application/json",
            }),
          ),
          a = document.createElement("a");
        a.href = url;
        a.download = "idle-masters-selection-monstres.json";
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      };
      render();
    } catch (e) {
      el("rosterStatus").textContent =
        "La liste n’a pas pu être chargée. Reviens sur cette page pour réessayer.";
      console.error(e);
    }
  }
  return { open };
})();
