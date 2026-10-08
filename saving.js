/* Durable saves are authoritative; browser storage is only a recovery copy. */
window.GameSave = (() => {
  let revision = null,
    pending = null,
    saved = null,
    timer = null,
    inflight = null,
    conflict = false,
    ready = false;
  const status = (text) => {
    const e = document.getElementById("saveStatus");
    if (e) e.textContent = text;
  };
  const localRead = () => {
    try {
      return localStorage.getItem("idleMastersV2");
    } catch {
      return null;
    }
  };
  const localWrite = (text) => {
    try {
      localStorage.setItem("idleMastersV2", text);
      return true;
    } catch {
      return false;
    }
  };
  async function api(method, body) {
    const controller = new AbortController(),
      timeout = setTimeout(() => controller.abort(), 8000);
    try {
      const response = await fetch("/api/save", {
        method,
        credentials: "same-origin",
        cache: "no-store",
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body,
        signal: controller.signal,
        keepalive: !!body && body.length < 60000,
      });
      if (!response.ok) {
        const error = new Error("Sauvegarde HTTP " + response.status);
        error.status = response.status;
        throw error;
      }
      return await response.json();
    } finally {
      clearTimeout(timeout);
    }
  }
  async function initialize() {
    const local = localRead();
    status("Chargement de la sauvegarde…");
    try {
      const cloud = await api("GET");
      revision = cloud.revision;
      saved = cloud.state ? JSON.stringify(cloud.state) : null;
      if (saved) localWrite(saved);
      ready = true;
      status(saved ? "Sauvegarde retrouvée" : "Nouvelle partie");
      return saved || local;
    } catch {
      ready = true;
      status(
        "Sauvegarde en ligne indisponible. Nouvelle tentative avec Sauvegarder.",
      );
      return local;
    }
  }
  function queue(state) {
    if (!ready) return;
    const { hp, eh, rd, tr, end, ...progress } = state;
    const text = JSON.stringify(progress);
    localWrite(text);
    if (text === saved && !pending) return;
    pending = text;
    clearTimeout(timer);
    if (!conflict) {
      status("Sauvegarde en cours…");
      timer = setTimeout(flush, 250);
    }
  }
  async function send() {
    const snapshot = pending;
    if (!snapshot || conflict) return;
    try {
      if (revision === null) {
        const cloud = await api("GET");
        if (cloud.state && JSON.stringify(cloud.state) !== snapshot) {
          conflict = true;
          status("Une sauvegarde existe en ligne. Recharge pour la retrouver.");
          return;
        }
        revision = cloud.revision;
      }
      const result = await api(
        "PUT",
        JSON.stringify({ revision, state: JSON.parse(snapshot) }),
      );
      revision = result.revision;
      saved = snapshot;
      if (pending === snapshot) pending = null;
      status(
        "Sauvegardé · " +
          new Date(result.updatedAt).toLocaleTimeString("fr-FR", {
            hour: "2-digit",
            minute: "2-digit",
          }),
      );
    } catch (error) {
      // Resolve a lost successful response before retrying, without overwriting another tab.
      try {
        const cloud = await api("GET");
        if (cloud.state && JSON.stringify(cloud.state) === snapshot) {
          revision = cloud.revision;
          saved = snapshot;
          if (pending === snapshot) pending = null;
          status("Sauvegardé");
          return;
        }
      } catch {}
      if (error.status === 409) {
        conflict = true;
        status(
          "Partie modifiée dans un autre onglet. Recharge pour la retrouver.",
        );
      } else status("Sauvegarde non confirmée. Réessaie avec Sauvegarder.");
    }
  }
  async function flush() {
    clearTimeout(timer);
    if (inflight) {
      await inflight;
      if (pending && pending !== saved && !conflict) return flush();
      return;
    }
    if (!pending) {
      status(saved ? "Sauvegardé" : "Aucune modification à sauvegarder");
      return;
    }
    inflight = send();
    try {
      await inflight;
    } finally {
      inflight = null;
    }

  }
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flush();
  });
  window.addEventListener("pagehide", () => flush());
  return { initialize, queue, flush, localRead, localWrite };
})();
