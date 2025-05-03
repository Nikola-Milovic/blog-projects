import { Pool } from "pg";

// Default connection for manual running or real deployment
const pool = new Pool({
	connectionString:
		process.env.DATABASE_URL ||
		"postgresql://postgres:postgres@localhost:5432/postgres",
});

// We export a function to get the pool. This allows us to easily mock
// it in tests to point to our Testcontainers-managed database instead.
export const getDB = () => pool;
