import assert from "node:assert/strict";
import test, { afterEach } from "node:test";

import { useDocumentStore } from "./document-store";

afterEach(() => {
  useDocumentStore.getState().reset();
});

test("document store loads document metadata and paragraphs", async () => {
  globalThis.fetch = async (input) => {
    const url = String(input);

    if (url.endsWith("/paragraphs")) {
      return new Response(
        JSON.stringify({
          documentId: "doc-1",
          paragraphs: [
            {
              id: "p-1",
              documentId: "doc-1",
              paragraphNo: 12,
              paragraphOrder: 12,
              paragraphText: "Paragraph text.",
            },
          ],
        }),
        {
          status: 200,
          headers: {
            "content-type": "application/json",
          },
        },
      );
    }

    return new Response(
      JSON.stringify({
        documentId: "doc-1",
        title: "Mabo v Queensland (No 2)",
        neutralCitation: "[1992] HCA 23",
        parallelCitation: null,
        court: "High Court of Australia",
        jurisdiction: "Australia",
        documentType: "case",
        decisionDate: "1992-06-03",
        docketNumber: null,
        summaryText: "Canonical summary.",
        sourceUrl: null,
        parseStatus: "completed",
        indexingStatus: "indexed",
      }),
      {
        status: 200,
        headers: {
          "content-type": "application/json",
        },
      },
    );
  };

  await useDocumentStore.getState().loadDocument("doc-1");

  const state = useDocumentStore.getState();
  assert.equal(state.isLoading, false);
  assert.equal(state.error, null);
  assert.equal(state.currentDocument?.title, "Mabo v Queensland (No 2)");
  assert.equal(state.paragraphs.length, 1);
});

test("document store exposes an error when authority loading fails", async () => {
  globalThis.fetch = async () => {
    throw new Error("Network failure");
  };

  await useDocumentStore.getState().loadDocument("doc-404");

  const state = useDocumentStore.getState();
  assert.equal(state.isLoading, false);
  assert.equal(state.currentDocument, null);
  assert.equal(state.paragraphs.length, 0);
  assert.equal(state.error, "Network failure");
});
