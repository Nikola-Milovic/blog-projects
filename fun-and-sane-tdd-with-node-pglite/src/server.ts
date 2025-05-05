import express, { type Response, type Request } from "express"; // Import Response type
import { getDB } from "./db.js";
import * as schema from "./schema.js";
import { eq } from "drizzle-orm";
const app = express();
app.use(express.json());

app.post("/items", async (req: Request, res: Response)=> {
	const { name } = req.body;
	if (!name) {
		res.status(400).send({ error: "Name is required" });
		return;
	}
	try {
		const db = getDB();
		const result = await db.insert(schema.items).values({ name }).returning();
		res.status(201).send(result[0]); 
	} catch (err) {
		console.error(err);
		res.status(500).send({ error: "Failed to create item" }); 
	}
});

app.get("/items/:id", async (req: Request, res: Response) => {
	const { id } = req.params;
	try {
		const db = getDB();
		const result = await db.select().from(schema.items).where(eq(schema.items.id, parseInt(id)));
		if (result.length === 0) {
			res.status(404).send({ error: "Item not found" });
			return;
		}

		res.send(result[0]); 
	} catch (err) {
		console.error(err);
		res.status(500).send({ error: "Failed to retrieve item" }); 
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

export default app;
