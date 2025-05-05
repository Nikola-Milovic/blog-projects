import * as schema from "../schema.js";
import { drizzle } from "drizzle-orm/pglite";
import type * as DrizzleKit from "drizzle-kit/api";
import { PGlite } from "@electric-sql/pglite";
import { promises as fs } from "fs";
import * as os from "os";
import * as path from "path";

// https://github.com/drizzle-team/drizzle-orm/issues/2853
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

const { generateDrizzleJson, generateMigration } = require("drizzle-kit/api") as typeof DrizzleKit;

export async function pushSchema(client: PGlite) {
    const db = drizzle(client, { schema });

    // https://github.com/drizzle-team/drizzle-orm/issues/3913
    const prevJson = generateDrizzleJson({});
    const curJson = generateDrizzleJson(
        schema,
        prevJson.id,
        undefined,
        "snake_case",
    );

    const statements = await generateMigration(prevJson, curJson);

    for (const statement of statements) {
        await db.execute(statement);
    }
}

export async function snapshot(client: PGlite) {
    return client.dumpDataDir("none");
}

export async function restoreSnapshot(snapshot: File | Blob): Promise<PGlite> {
    const clone = new File([Buffer.from(await snapshot.arrayBuffer())], "snapshot", { type: snapshot.type });
    return new PGlite({ loadDataDir: clone });
}