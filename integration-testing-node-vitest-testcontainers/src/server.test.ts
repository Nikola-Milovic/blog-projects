import {
	afterAll,
	afterEach,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
	vi,
} from "vitest";
import request from "supertest"; // For making HTTP requests
import type TestAgent from "supertest/lib/agent"; // Type for supertest agent
import app from "./server"; // Our Express app
import { getDB } from "./db"; // The function we need to mock
import {
	PostgresContainerManager,
	type TestDatabase,
} from "./testing/db-helper"; // Our helper

// This is crucial: tell Vitest to replace the real './db' module
// with our mock, so we can control what getDB() returns in tests.
vi.mock("./db");

describe("Items API", () => {
	const containerManager = PostgresContainerManager.getInstance();
	let testDb: TestDatabase; // Will hold the connection/cleanup func for each test
	let agent: TestAgent; // Supertest agent for making requests

	// Start the single container ONCE before all tests in this file
	beforeAll(async () => {
		await containerManager.initialize();
		agent = request(app); // Create supertest agent targeting our app
	}, 60000); // Increase timeout for container init

	// Restore snapshot and get a fresh DB connection BEFORE EACH test
	beforeEach(async () => {
		testDb = await containerManager.setupTestDatabase();
		// Point the mocked getDB function to return our test database client
		vi.mocked(getDB).mockReturnValue(testDb.db);
	});

	// Clean up the test database connection AFTER EACH test
	afterEach(async () => {
		await testDb.cleanup(); // Release pool client and end pool
		vi.clearAllMocks(); // Reset mocks between tests
	});

	// Stop the single container ONCE after all tests in this file are done
	afterAll(async () => {
		await containerManager.teardown();
	}, 60000); // Increase timeout for container teardown

	it("POST /items should create an item", async () => {
		const newItemName = "Test Item 1";
		const response = await agent
			.post("/items")
			.send({ name: newItemName })
			.expect(201); // Assert HTTP status code

		// Assert response body
		expect(response.body.id).toBeDefined();
		expect(response.body.name).toBe(newItemName);

		// Optional but recommended: Verify directly in the DB
		const dbResult = await testDb.db.query(
			"SELECT * FROM items WHERE id = $1",
			[response.body.id],
		);
		expect(dbResult.rows.length).toBe(1);
		expect(dbResult.rows[0].name).toBe(newItemName);
	});

	it("GET /items/:id should retrieve an existing item", async () => {
		// Arrange: Insert an item directly using the test DB client
		const insertResult = await testDb.db.query(
			"INSERT INTO items(name) VALUES('Get Me') RETURNING id",
		);
		const itemId = insertResult.rows[0].id;

		// Act: Make request to the API endpoint
		const response = await agent.get(`/items/${itemId}`).expect(200);

		// Assert
		expect(response.body.id).toBe(itemId);
		expect(response.body.name).toBe("Get Me");
	});

	it("GET /items/:id should return 404 for non-existent item", async () => {
		await agent
			.get("/items/99999") // Use an ID that almost certainly won't exist
			.expect(404);
	});

	it("POST /items should return 400 if name is missing", async () => {
		await agent
			.post("/items")
			.send({}) // Send empty body
			.expect(400);
	});
});
