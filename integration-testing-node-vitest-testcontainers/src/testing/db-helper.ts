import {
	PostgreSqlContainer,
	type StartedPostgreSqlContainer,
} from "@testcontainers/postgresql";
import { Client, Pool, type PoolClient } from "pg";

// Interface for what setupTestDatabase will return
export interface TestDatabase {
	db: PoolClient; // Test should use this client
	container: StartedPostgreSqlContainer; // Reference to the container
	cleanup: () => Promise<void>; // Function to release the client/pool
}

// Manages the PostgreSQL container lifecycle for tests
export class PostgresContainerManager {
	private static instance: PostgresContainerManager | null = null;
	private container: StartedPostgreSqlContainer | null = null;
	private snapshotName = "clean-db-snapshot"; // Name for our baseline snapshot

	// Singleton pattern to potentially share container across test suites (though we scope it per-file here)
	private constructor() {}

	public static getInstance(): PostgresContainerManager {
		if (!PostgresContainerManager.instance) {
			PostgresContainerManager.instance = new PostgresContainerManager();
		}
		return PostgresContainerManager.instance;
	}

	// Starts container, runs migrations *in* the container DB, takes snapshot
	async initialize(): Promise<void> {
		if (this.container) {
			console.log("Container already initialized.");
			return;
		}

		console.log("Starting PostgreSQL container...");
		this.container = await new PostgreSqlContainer("postgres:17")
			.withDatabase("test") // Use a specific DB name for testing
			.withUsername("test-user")
			.withPassword("test-password")
			.withExposedPorts(5432)
			.start();
		console.log(
			`Container started on port ${this.container.getMappedPort(5432)}`,
		);

		// Connect directly to the containerized database to run migrations
		const migrationClient = new Client({
			connectionString: this.container.getConnectionUri(),
		});
		await migrationClient.connect();
		try {
			console.log("Running migrations...");
			// In a real app, use your migration tool (node-pg-migrate, TypeORM migrations, etc.)
			// For this example, we create the table directly:
			await migrationClient.query(`
                CREATE TABLE items (
                    id SERIAL PRIMARY KEY,
                    name VARCHAR(100) NOT NULL
                );
            `);
			console.log("Migrations complete.");
		} catch (error) {
			console.error("Migration failed:", error);
			throw error; // Fail fast if migrations don't work
		} finally {
			await migrationClient.end();
		}

		// Take a snapshot of the database state *after* migrations
		console.log(`Taking snapshot '${this.snapshotName}'...`);
		await this.container.snapshot(this.snapshotName);
		console.log("Snapshot taken.");
	}

	// Restores the 'clean' snapshot and provides a connection pool/client
	async setupTestDatabase(): Promise<TestDatabase> {
		if (!this.container) {
			throw new Error("Container not initialized. Call initialize() first.");
		}

		try {
			// Restore the database to the state captured in the snapshot
			console.log(`Restoring snapshot '${this.snapshotName}'...`);
			await this.container.restoreSnapshot(this.snapshotName);
			console.log("Snapshot restored.");

			// Create a *new pool* connecting to the restored database for this test
			// This ensures connection isolation if tests run concurrently within the same file (though less common)
			const testPool = new Pool({
				connectionString: this.container.getConnectionUri(),
			});
			const testClient = await testPool.connect(); // Get a client for the test

			// Cleanup function specific to this test's pool/client
			const cleanup = async () => {
				try {
					await testClient.release(); // Release client back to pool
					await testPool.end(); // Close the pool
				} catch (error) {
					console.error("Error during test DB cleanup:", error);
				}
			};

			return {
				db: testClient, // Provide the client to the test
				container: this.container,
				cleanup,
			};
		} catch (error) {
			console.error("Error setting up test database:", error);
			throw error;
		}
	}

	// Stops and removes the container
	async teardown(): Promise<void> {
		if (this.container) {
			console.log("Stopping PostgreSQL container...");
			await this.container.stop();
			this.container = null;
			console.log("Container stopped.");
		}
		PostgresContainerManager.instance = null; // Reset singleton state
	}
}
