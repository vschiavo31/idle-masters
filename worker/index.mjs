const json = (value, status = 200) =>
  Response.json(value, { status, headers: { "Cache-Control": "no-store" } });
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/api/save") {
      const user = request.headers.get("oai-authenticated-user-id");
      if (!user) return json({ error: "Connexion requise" }, 401);
      if (!env.DB) return json({ error: "Sauvegarde indisponible" }, 503);
      try {
        if (request.method === "GET") {
          const row = await env.DB.prepare(
            "SELECT revision, payload, updated_at FROM game_saves WHERE user_id = ?",
          )
            .bind(user)
            .first();
          return json(
            row
              ? {
                  revision: row.revision,
                  state: JSON.parse(row.payload),
                  updatedAt: row.updated_at,
                }
              : { revision: 0, state: null },
          );
        }
        if (request.method !== "PUT")
          return json({ error: "Méthode refusée" }, 405);
        const origin = request.headers.get("origin");
        if (origin && origin !== url.origin)
          return json({ error: "Origine refusée" }, 403);
        if (
          !request.headers.get("content-type")?.startsWith("application/json")
        )
          return json({ error: "Format refusé" }, 415);
        const body = await request.text();
        if (body.length > 2000000)
          return json({ error: "Sauvegarde trop volumineuse" }, 413);
        const { revision, state } = JSON.parse(body);
        if (
          !Number.isSafeInteger(revision) ||
          revision < 0 ||
          !state ||
          !Number.isSafeInteger(state.lv) ||
          state.lv < 1 ||
          !Array.isArray(state.bag) ||
          typeof state.w !== "object" ||
          !state.w
        )
          return json({ error: "Sauvegarde invalide" }, 400);
        const payload = JSON.stringify(state),
          now = Date.now();
        let result;
        if (revision === 0)
          result = await env.DB.prepare(
            "INSERT INTO game_saves (user_id, revision, payload, updated_at) VALUES (?, 1, ?, ?) ON CONFLICT(user_id) DO NOTHING RETURNING revision",
          )
            .bind(user, payload, now)
            .first();
        else
          result = await env.DB.prepare(
            "UPDATE game_saves SET revision = revision + 1, payload = ?, updated_at = ? WHERE user_id = ? AND revision = ? RETURNING revision",
          )
            .bind(payload, now, user, revision)
            .first();
        return result
          ? json({ revision: result.revision, updatedAt: now })
          : json(
              {
                error:
                  "Une autre partie a été sauvegardée. Recharge pour la retrouver.",
              },
              409,
            );
      } catch (error) {
        console.error("Save storage failure", error);
        return json({ error: "Sauvegarde indisponible" }, 503);
      }
    }
    const pathname = url.pathname === "/" ? "/index.html" : url.pathname;
    const asset = SITE_ASSETS[pathname];
    if (!asset) return new Response("Introuvable", { status: 404 });
    return new Response(request.method === "HEAD" ? null : asset.body, {
      headers: { "Content-Type": asset.type, "Cache-Control": "no-cache" },
    });
  },
};
