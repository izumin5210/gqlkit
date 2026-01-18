import {
  integer,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

export const userStatusEnum = pgEnum("user_status", [
  "active",
  "inactive",
  "suspended",
]);

export const postStatusEnum = pgEnum("post_status", [
  "draft",
  "published",
  "archived",
]);

export const users = pgTable("users", {
  id: serial().primaryKey(),
  name: text().notNull(),
  email: text().notNull().unique(),
  status: userStatusEnum().notNull().default("active"),
  createdAt: timestamp().notNull().defaultNow(),
});

export const posts = pgTable("posts", {
  id: serial().primaryKey(),
  title: text().notNull(),
  content: text(),
  status: postStatusEnum().notNull().default("draft"),
  authorId: integer()
    .notNull()
    .references(() => users.id),
  createdAt: timestamp().notNull().defaultNow(),
});
