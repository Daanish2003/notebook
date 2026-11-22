import type { Session } from "@notebook/auth";
import type { Database } from "@notebook/db";

export type Context = {
  session: Session | null;
  db: Database;
};
