import {
	afterEach,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
	vi,
} from "vitest";
import request from "supertest";
import { getDB } from "./db.js";
import * as schema from "./schema.js";
import { pushSchema, restoreSnapshot, snapshot } from "./testing/db-helper.js";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { eq } from "drizzle-orm";
import app from "./server.js";
import { PgDatabase } from "drizzle-orm/pg-core";
import TestAgent from "supertest/lib/agent.js";

// Crucial: Mock the db module to intercept calls to getDB()
vi.mock("./db");

describe("Items API with PGLite", () => {
	let db: PgDatabase<any, typeof schema>;
	let client: PGlite;
	let agent: TestAgent;
	let snapshottedDB: File | Blob;

	beforeAll(async () => {
		client = new PGlite(
			// You might want to specify a consistent temp directory:
			// dataDir: `./.pglite-test-data/${dbName}` or `/tmp`
		);

		// Apply the schema once
		await pushSchema(client);

		// Take a snapshot
		snapshottedDB = await snapshot(client);
	});

	// Setup a fresh PGLite instance and apply schema before each test
	beforeEach(async () => {
		agent = request(app); // Create supertest agent

		client = await restoreSnapshot(snapshottedDB)

		// Create the Drizzle instance connected to PGLite
		db = drizzle(client, { schema });

		// Mock getDB() to return *this specific test's* Drizzle instance
		// Use `vi.mocked` for type safety
		vi.mocked(getDB).mockReturnValue(db as any);
	});

	// Close the PGLite client and clean up mocks after each test
	afterEach(async () => {
		await client.close(); // Release resources
		vi.clearAllMocks(); // Reset mocks
	});

	// Consider adding cleanup for the data directory if you specified one
	// afterAll

	it("POST /items should create an item", async () => {
		const newItemName = "Test Item PGLite";
		const response = await agent
			.post("/items")
			.send({ name: newItemName })
			.expect(201); // Assert HTTP status code

		expect(response.body.id).toBeDefined();
		expect(response.body.name).toBe(newItemName);

		// Verify directly in the DB for extra confidence
		// And to make sure the snapshot is working
		const dbResult = await db
			.select()
			.from(schema.items);

		expect(dbResult.length).toBe(1);
		expect(dbResult[0].name).toBe(newItemName);
	});

	it("GET /items/:id should retrieve an existing item", async () => {
		// Arrange: Insert an item directly
		const insertResult = await db
			.insert(schema.items)
			.values({ name: "Get Me PGLite" })
			.returning();
		const itemId = insertResult[0].id;

		// Act: Request the item
		const response = await agent.get(`/items/${itemId}`).expect(200);

		// Verify directly in the DB for extra confidence
		// And to make sure the snapshot is working
		const dbResult = await db
			.select()
			.from(schema.items);

		expect(dbResult.length).toBe(1);
		expect(dbResult[0].name).toBe("Get Me PGLite");

		// Assert
		expect(response.body.id).toBe(itemId);
		expect(response.body.name).toBe("Get Me PGLite");
	});

	it("GET /items/:id should return 404 for non-existent item", async () => {
		await agent.get("/items/99999").expect(404);
	});

	it("POST /items should return 400 if name is missing", async () => {
		await agent.post("/items").send({}).expect(400);
	});
});
