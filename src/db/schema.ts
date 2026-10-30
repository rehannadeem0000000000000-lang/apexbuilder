import { integer, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export interface AppConfig {
  name: string;
  packageSuffix: string;
  platform: "apk" | "aab";
  iconBase64: string | null;
  iconMime: string | null;
  appLinksDomain: string | null;
  googleEnabled: boolean;
  googleServicesJson: string | null;
  googleClientId: string | null;
  permissions: string[];
  dex2c: boolean;
  stringProtection: boolean;
  offlineCache: boolean;
  startupMode: "off" | "none" | "custom";
  startupMediaBase64: string | null;
  startupMediaName: string | null;
  signRelease: boolean;
  ownerKey: string | null;
  url: string | null;
}

export const projects = pgTable("projects", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  sourceType: text("source_type").notNull().default("upload"), // upload | website
  fileType: text("file_type").notNull().default("html"), // html | zip | url
  fileName: text("file_name"),
  fileSize: integer("file_size"),
  filePath: text("file_path"),
  platform: text("platform").notNull().default("apk"),
  config: jsonb("config").$type<AppConfig>().notNull(),
  status: text("status").notNull().default("draft"), // draft|queued|building|ready|failed
  githubRunId: text("github_run_id"),
  githubArtifactId: text("github_artifact_id"),
  githubArtifactName: text("github_artifact_name"),
  error: text("error"),
  startedAt: timestamp("started_at", { withTimezone: true }),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

export type ProjectRow = typeof projects.$inferSelect;
export type SettingRow = typeof settings.$inferSelect;
