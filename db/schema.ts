import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const shifts = sqliteTable("demo_shifts", {
  room: text().primaryKey(),
  stage: integer().notNull(),
});
