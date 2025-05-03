import express, { type Response } from "express"; // Import Response type
import { getDB } from "./db";

const app = express();
app.use(express.json());

app.post("/items", async (req, res): Promise<Response> => {
	// Use Promise<Response>
	const { name } = req.body;
	if (!name) {
		return res.status(400).send({ error: "Name is required" });
	}
	try {
		const db = getDB();
		const result = await db.query(
			"INSERT INTO items(name) VALUES($1) RETURNING *",
			[name],
		);
		return res.status(201).send(result.rows[0]); // Added return
	} catch (err) {
		console.error(err);
		return res.status(500).send({ error: "Failed to create item" }); // Added return
	}
});

app.get("/items/:id", async (req, res): Promise<Response> => {
	// Use Promise<Response>
	const { id } = req.params;
	try {
		const db = getDB();
		const result = await db.query("SELECT * FROM items WHERE id = $1", [id]);
		if (result.rows.length === 0) {
			return res.status(404).send({ error: "Item not found" });
		}
		return res.send(result.rows[0]); // Added return
	} catch (err) {
		console.error(err);
		return res.status(500).send({ error: "Failed to retrieve item" }); // Added return
	}
});

// Only start listening if the file is run directly
if (require.main === module) {
	const port = process.env.PORT || 3000;
	app.listen(port, () => {
		console.log(`Server listening on port ${port}`);
		// You'd typically run migrations here on real app startup
		// For this example, we assume the table exists or is created by tests/manually
	});
}

// Export app for testing
export default app;
