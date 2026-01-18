import type { GqlScalar } from "@gqlkit-ts/runtime";
import {
  customType,
  integer,
  pgEnum,
  pgTable,
  serial,
  text,
} from "drizzle-orm/pg-core";

export type DateTime = GqlScalar<"DateTime", Date>;

const dateTime = customType<{ data: DateTime; driverData: Date }>({
  dataType() {
    return "timestamp";
  },
  fromDriver(value: Date): DateTime {
    return value as DateTime;
  },
  toDriver(value: DateTime): Date {
    return value;
  },
});

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
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  status: userStatusEnum("status").notNull().default("active"),
  createdAt: dateTime("created_at").notNull().default(new Date()),
});

export const posts = pgTable("posts", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  content: text("content"),
  status: postStatusEnum("status").notNull().default("draft"),
  authorId: integer("author_id")
    .notNull()
    .references(() => users.id),
  createdAt: dateTime("created_at").notNull().default(new Date()),
});
