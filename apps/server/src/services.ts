import { createDb } from "@notebook/db";

import { ENV } from "./env.server";

export const db = createDb(ENV);
