import { randomUUID } from "node:crypto";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: text()
    .primaryKey()
    .$defaultFn(() => randomUUID()),
  name: text().notNull(),
  email: text().notNull().unique(),
  status: text({
    enum: ["active", "inactive", "suspended"],
  })
    .notNull()
    .default("active"),
  createdAt: integer({ mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const posts = sqliteTable("posts", {
  id: text()
    .primaryKey()
    .$defaultFn(() => randomUUID()),
  title: text().notNull(),
  content: text(),
  priority: text({ enum: ["low", "medium", "high"] })
    .notNull()
    .default("medium"),
  authorId: text()
    .notNull()
    .references(() => users.id),
  createdAt: integer({ mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});
