import process from "node:process";

import { createApp } from "./app";

type SmokeResult = {
  label: string;
  status: number;
  body: unknown;
};

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function main() {
  const documentId = process.argv[2];
  if (!documentId) {
    throw new Error("请传入 documentId，例如: tsx src/integration-smoke.ts <documentId>");
  }

  const app = createApp();
  const requests: Array<[string, string, RequestInit?]> = [
    ["health", "/health"],
    ["search", "/search?q=Birketu&top_k=3"],
    [
      "ask",
      "/ask",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          query: "What did the court say about proportionality?",
          topK: 3,
          filters: {},
        }),
      },
    ],
    ["document", `/documents/${documentId}`],
    ["paragraphs", `/documents/${documentId}/paragraphs`],
  ];

  const results: SmokeResult[] = [];
  for (const [label, path, init] of requests) {
    const response = await app.request(path, init);
    results.push({
      label,
      status: response.status,
      body: await readJson(response),
    });
  }

  console.log(JSON.stringify(results, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
