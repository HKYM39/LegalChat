import { db, schema } from "db";
import { Hono } from "hono";

const app = new Hono();

app.get("/", (c) => {
  return c.json({
    ok: true,
    dbLinked: Boolean(db),
    schemaLinked:
      Boolean(schema.legalDocuments) &&
      Boolean(schema.retrievalRuns) &&
      Boolean(schema.legalDocumentsRelations),
  });
});

export default app;
