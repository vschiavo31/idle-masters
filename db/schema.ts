import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
export const gameSaves = sqliteTable("game_saves", {
  userId: text("user_id").primaryKey(),
  revision: integer("revision").notNull(),
  payload: text("payload").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export const characters = sqliteTable("characters", {
  userId: text("user_id").primaryKey(),
  nickname: text("nickname").notNull(),
  nicknameKey: text("nickname_key").notNull().unique(),
  createdAt: integer("created_at").notNull(),
});
