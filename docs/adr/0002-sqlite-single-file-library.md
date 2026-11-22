# SQLite file, not Postgres

The whole Library is one owner on one machine, so it lives in a single SQLite file (via Drizzle): FTS5 for search, a polled table as the Transcription queue shared with the Python worker, and backup is copying the file plus the media folder. Postgres (in Docker) was the scaffold default and was dropped because it added a service to run without adding anything one user needs. Going multi-user later means migrating to Postgres.
