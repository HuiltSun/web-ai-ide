import { sqliteTable, text, integer, primaryKey } from "drizzle-orm/sqlite-core"

export const NeuralMapSnapshotTable = sqliteTable(
  "neural_map_snapshot",
  {
    directory: text().notNull(),
    src: text().notNull(),
    snapshot_json: text().notNull(),
    saved_at: integer().notNull(),
  },
  (table) => [primaryKey({ columns: [table.directory, table.src] })],
)

export const NeuralMapProgressTable = sqliteTable(
  "neural_map_progress",
  {
    session_id: text().notNull(),
    node_id: text().notNull(),
    understood_at: integer(),
    notes: text().notNull().default(""),
  },
  (table) => [primaryKey({ columns: [table.session_id, table.node_id] })],
)
