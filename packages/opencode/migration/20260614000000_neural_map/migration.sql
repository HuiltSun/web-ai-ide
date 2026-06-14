CREATE TABLE IF NOT EXISTS `neural_map_progress` (
  `session_id` text NOT NULL,
  `node_id` text NOT NULL,
  `understood_at` integer,
  `notes` text NOT NULL DEFAULT '',
  PRIMARY KEY (`session_id`, `node_id`)
);
