import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./schema.js"; 

// Default connection for manual running or real deployment
const pool = new Pool({
	connectionString:
		process.env.DATABASE_URL ||
		"postgresql://postgres:postgres@localhost:5432/postgres",
});

const db = drizzle(pool, { schema })

// We export a function to get drizzle to make it easier to mock in tests
export const getDB = () => db;