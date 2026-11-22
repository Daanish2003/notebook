import { createAuth } from "@notebook/auth";
import { createDb } from "@notebook/db";

import { ENV } from "./env.server";

export const db = createDb(ENV);
export const auth = createAuth(ENV, db);
