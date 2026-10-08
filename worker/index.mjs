const json = (value, status = 200) =>
  Response.json(value, { status, headers: { "Cache-Control": "no-store" } });
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const user = request.headers.get("oai-authenticated-user-id");
    if (url.pathname === "/api/character" || url.pathname === "/api/ladder") {
      if (!env.DB) return json({ error: "Classement indisponible" }, 503);
      try {
        if (url.pathname === "/api/ladder") {
          if (request.method !== "GET")
            return json({ error: "Méthode refusée" }, 405);
          const rows = await env.DB.prepare(
            `WITH ranked AS (
            SELECT c.nickname, c.user_id,
              json_extract(s.payload, '$.classId') AS classId,
              CAST(json_extract(s.payload, '$.lv') AS INTEGER) AS level,
              COALESCE(json_extract(s.payload, '$.xp'), 0) AS xp,
              ROW_NUMBER() OVER (ORDER BY CAST(json_extract(s.payload, '$.lv') AS INTEGER) DESC,
                COALESCE(json_extract(s.payload, '$.xp'), 0) DESC, c.created_at, c.nickname_key) AS rank
            FROM characters c JOIN game_saves s ON s.user_id = c.user_id
            WHERE json_extract(s.payload, '$.classId') IS NOT NULL)
            SELECT * FROM ranked WHERE rank <= 100 OR user_id = ? ORDER BY rank`,
          )
            .bind(user || "")
            .all();
          return json({
            entries: rows.results.map(({ user_id, ...row }) => ({
              ...row,
              own: !!user && user_id === user,
            })),
          });
        }
        if (!user) return json({ error: "Connexion requise" }, 401);
        if (request.method !== "POST")
          return json({ error: "Méthode refusée" }, 405);
        if (
          request.headers.get("origin") &&
          request.headers.get("origin") !== url.origin
        )
          return json({ error: "Origine refusée" }, 403);
        if (
          !request.headers.get("content-type")?.startsWith("application/json")
        )
          return json({ error: "Format refusé" }, 415);
        const body = await request.text();
        if (body.length > 1000) return json({ error: "Pseudo invalide" }, 400);
        let input;
        try {
          input = JSON.parse(body);
        } catch {
          return json({ error: "Format invalide" }, 400);
        }
        const nickname =
          typeof input.nickname === "string"
            ? input.nickname.normalize("NFKC").trim()
            : "";
        if (!/^[\p{L}\p{N}][\p{L}\p{N}_-]{2,19}$/u.test(nickname))
          return json(
            {
              error:
                "Pseudo : 3 à 20 lettres ou chiffres, tirets et _ autorisés.",
            },
            400,
          );
        const existing = await env.DB.prepare(
          "SELECT nickname FROM characters WHERE user_id = ?",
        )
          .bind(user)
          .first();
        if (existing) return json({ profile: existing });
        const result = await env.DB.prepare(
          "INSERT INTO characters (user_id, nickname, nickname_key, created_at) VALUES (?, ?, ?, ?) ON CONFLICT DO NOTHING RETURNING nickname",
        )
          .bind(user, nickname, nickname.toLocaleLowerCase("fr-FR"), Date.now())
          .first();
        if (result) return json({ profile: result });
        const raced = await env.DB.prepare(
          "SELECT nickname FROM characters WHERE user_id = ?",
        )
          .bind(user)
          .first();
        return raced
          ? json({ profile: raced })
          : json(
              { error: "Ce pseudo est déjà pris. Choisis-en un autre." },
              409,
            );
      } catch (error) {
        console.error("Character storage failure", error);
        return json({ error: "Classement indisponible. Réessaie." }, 503);
      }
    }
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
          const profile = await env.DB.prepare(
            "SELECT nickname FROM characters WHERE user_id = ?",
          )
            .bind(user)
            .first();
          return json({
            accountKey: user,
            profile,
            ...(row
              ? {
                  revision: row.revision,
                  state: JSON.parse(row.payload),
                  updatedAt: row.updated_at,
                }
              : { revision: 0, state: null }),
          });
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
        const { revision, state, accountKey } = JSON.parse(body);
        if (accountKey && accountKey !== user)
          return json({ error: "Compte changé. Recharge la page." }, 409);
        if (
          !Number.isSafeInteger(revision) ||
          revision < 0 ||
          !state ||
          !Number.isSafeInteger(state.lv) ||
          state.lv < 1 ||
          (state.xp !== undefined &&
            (!Number.isSafeInteger(state.xp) || state.xp < 0)) ||
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
