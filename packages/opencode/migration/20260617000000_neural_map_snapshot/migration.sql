CREATE TABLE IF NOT EXISTS `neural_map_snapshot` (
  `directory` text NOT NULL,
  `src` text NOT NULL,
  `snapshot_json` text NOT NULL,
  `saved_at` integer NOT NULL,
  PRIMARY KEY (`directory`, `src`)
);
