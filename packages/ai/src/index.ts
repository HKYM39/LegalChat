import type {
  AskResponse,
  AuthorityResult,
  QueryType,
  SearchFilters,
  SupportingExcerpt,
} from "../../shared/src/index.ts";

export type RetrievalCandidate = AuthorityResult & {
  denseRank?: number;
  lexicalRank?: number;
  fusedRank?: number;
  denseScore?: number;
  lexicalScore?: number;
  fusedScore?: number;
  rerankedScore?: number;
};

export type RetrievalPlan = {
  normalizedQuery: string;
  lexicalQuery: string;
  queryType: QueryType;
  topK: number;
  lexicalTopK: number;
  denseTopK: number;
  filters: SearchFilters;
};

export type PromptEvidence = {
  label: string;
  title: string;
  citation: string | null;
  excerpt: string;
  traceability: AuthorityResult["traceability"];
};

export type AnswerModelResult = {
  answerText: string;
  limitations: string[];
  supportingExcerpts: SupportingExcerpt[];
};

export type GeminiConfig = {
  apiKey?: string;
  model: string;
  embeddingModel: string;
  apiBaseUrl: string;
};

function compactWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function normalizeQuery(input: string): string {
  return compactWhitespace(input)
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'");
}

export function classifyQuery(input: string): QueryType {
  const normalized = normalizeQuery(input).toLowerCase();
  if (/\b\d{4}\b/.test(normalized) && normalized.includes("v")) {
    return "citation_lookup";
  }
  if (/\b(inc|corp|llc|ltd|commission|state|people|re)\b/.test(normalized)) {
    return "case_name_lookup";
  }
  if (/\b(act|code|statute|regulation|section|rule)\b/.test(normalized)) {
    return "legislation_lookup";
  }
  if (normalized.split(" ").length <= 5) {
    return "keyword_lookup";
  }
  return "natural_language_query";
}

export function buildLexicalQuery(input: string, queryType?: QueryType): string {
  const normalized = normalizeQuery(input);
  const resolvedType = queryType ?? classifyQuery(normalized);

  if (resolvedType === "case_name_lookup") {
    const caseSource = normalized.replace(
      /^(In|Regarding|About|Under|Re)\s+/,
      "",
    );
    const match = caseSource.match(
      /([A-Z][A-Za-z0-9'.&-]*(?:\s+[A-Z][A-Za-z0-9'.&-]*)*\s+v\s+[A-Z][A-Za-z0-9'.&-]*(?:\s+[A-Z][A-Za-z0-9'.&-]*)*)/,
    );
    if (match?.[1]) {
      return match[1].trim();
    }
  }

  if (resolvedType === "natural_language_query") {
    const tokens = normalized
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter(Boolean)
      .filter(
        (token) =>
          token.length > 3 &&
          !new Set([
            "what",
            "when",
            "where",
            "which",
            "about",
            "court",
            "said",
            "does",
            "this",
            "that",
            "with",
            "from",
            "have",
            "into",
          ]).has(token),
      );

    return tokens.slice(0, 8).join(" ");
  }

  return normalized;
}

export function buildRetrievalPlan(input: {
  query: string;
  topK: number;
  filters: SearchFilters;
}): RetrievalPlan {
  const normalizedQuery = normalizeQuery(input.query);
  const queryType = classifyQuery(normalizedQuery);
  const lexicalQuery = buildLexicalQuery(normalizedQuery, queryType);
  const topK = Math.max(1, Math.min(input.topK, 20));
  return {
    normalizedQuery,
    lexicalQuery,
    queryType,
    topK,
    lexicalTopK: Math.max(topK, 12),
    denseTopK: Math.max(topK, 12),
    filters: input.filters,
  };
}

export function mergeAndRerankCandidates(input: {
  lexical: RetrievalCandidate[];
  dense: RetrievalCandidate[];
  topK: number;
}): {
  results: RetrievalCandidate[];
  limitations: string[];
} {
  const merged = new Map<string, RetrievalCandidate>();

  for (const [index, candidate] of input.lexical.entries()) {
    merged.set(candidate.chunkId, {
      ...candidate,
      lexicalRank: index + 1,
      lexicalScore: candidate.score,
    });
  }

  for (const [index, candidate] of input.dense.entries()) {
    const existing = merged.get(candidate.chunkId);
    if (existing) {
      existing.denseRank = index + 1;
      existing.denseScore = candidate.score;
    } else {
      merged.set(candidate.chunkId, {
        ...candidate,
        denseRank: index + 1,
        denseScore: candidate.score,
      });
    }
  }

  const reranked = Array.from(merged.values())
    .map((candidate) => {
      const lexicalBoost =
        candidate.lexicalRank != null ? 1 / candidate.lexicalRank : 0;
      const denseBoost = candidate.denseRank != null ? 0.6 / candidate.denseRank : 0;
      const citationBoost = candidate.neutralCitation ? 0.5 : 0;
      const rerankedScore =
        (candidate.lexicalScore ?? 0) * 2 +
        (candidate.denseScore ?? 0) +
        lexicalBoost +
        denseBoost +
        citationBoost;

      return {
        ...candidate,
        fusedScore: rerankedScore,
        rerankedScore,
      };
    })
    .sort((left, right) => (right.rerankedScore ?? 0) - (left.rerankedScore ?? 0))
    .slice(0, input.topK)
    .map((candidate, index) => ({
      ...candidate,
      fusedRank: index + 1,
    }));

  const limitations =
    input.dense.length === 0
      ? ["向量检索当前不可用，结果已降级为 lexical-only。"]
      : [];

  return {
    results: reranked,
    limitations,
  };
}

export function buildPromptEvidence(candidates: RetrievalCandidate[]): PromptEvidence[] {
  return candidates.map((candidate, index) => ({
    label: `A${index + 1}`,
    title: candidate.title,
    citation: candidate.neutralCitation,
    excerpt: candidate.snippet,
    traceability: candidate.traceability,
  }));
}

export function buildGroundedPrompt(input: {
  query: string;
  evidence: PromptEvidence[];
}): string {
  const evidenceBlock = input.evidence
    .map(
      (item) =>
        `${item.label}\n标题: ${item.title}\nCitation: ${item.citation ?? "N/A"}\nTraceability: document_id=${item.traceability.documentId}, chunk_id=${item.traceability.chunkId}, paragraphs=${item.traceability.paragraphStartNo ?? "?"}-${item.traceability.paragraphEndNo ?? "?"}\nExcerpt: ${item.excerpt}`,
    )
    .join("\n\n");

  return [
    "You are a legal research assistant.",
    "Answer only from the evidence provided below.",
    "Do not invent authorities or facts.",
    "If evidence is insufficient, say so explicitly.",
    "Return strict JSON with keys: answerText, limitations, supportingExcerpts.",
    "Each supportingExcerpts item must include label and excerpt.",
    `Question: ${input.query}`,
    `Evidence:\n${evidenceBlock}`,
  ].join("\n\n");
}

export async function embedQuery(
  config: GeminiConfig,
  query: string,
): Promise<number[] | null> {
  if (!config.apiKey) {
    return null;
  }

  try {
    const response = await fetch(
      `${config.apiBaseUrl}/models/${config.embeddingModel}:embedContent?key=${config.apiKey}`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: `models/${config.embeddingModel}`,
          content: {
            parts: [{ text: query }],
          },
        }),
      },
    );

    if (!response.ok) {
      return null;
    }

    const json = (await response.json()) as {
      embedding?: { values?: number[] };
    };

    return json.embedding?.values ?? null;
  } catch {
    return null;
  }
}

function parseGeminiJson(text: string): AnswerModelResult | null {
  try {
    const parsed = JSON.parse(text) as Partial<AnswerModelResult>;
    if (!parsed || typeof parsed.answerText !== "string") {
      return null;
    }
    return {
      answerText: parsed.answerText.trim(),
      limitations: Array.isArray(parsed.limitations)
        ? parsed.limitations.filter((item): item is string => typeof item === "string")
        : [],
      supportingExcerpts: Array.isArray(parsed.supportingExcerpts)
        ? parsed.supportingExcerpts.filter(
            (item): item is SupportingExcerpt =>
              Boolean(item) &&
              typeof item === "object" &&
              typeof (item as SupportingExcerpt).label === "string" &&
              typeof (item as SupportingExcerpt).excerpt === "string" &&
              Boolean((item as SupportingExcerpt).traceability?.documentId) &&
              Boolean((item as SupportingExcerpt).traceability?.chunkId),
          )
        : [],
    };
  } catch {
    return null;
  }
}

export async function generateGroundedAnswer(input: {
  config: GeminiConfig;
  query: string;
  evidence: PromptEvidence[];
}): Promise<AnswerModelResult | null> {
  if (!input.config.apiKey || input.evidence.length === 0) {
    return null;
  }

  try {
    const response = await fetch(
      `${input.config.apiBaseUrl}/models/${input.config.model}:generateContent?key=${input.config.apiKey}`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          generationConfig: {
            responseMimeType: "application/json",
          },
          contents: [
            {
              role: "user",
              parts: [
                {
                  text: buildGroundedPrompt({
                    query: input.query,
                    evidence: input.evidence,
                  }),
                },
              ],
            },
          ],
        }),
      },
    );

    if (!response.ok) {
      return null;
    }

    const json = (await response.json()) as {
      candidates?: Array<{
        content?: {
          parts?: Array<{
            text?: string;
          }>;
        };
      }>;
    };

    const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      return null;
    }

    return parseGeminiJson(text);
  } catch {
    return null;
  }
}

export function buildConservativeAnswer(input: {
  query: string;
  authorities: RetrievalCandidate[];
  limitations: string[];
}): AskResponse {
  const authorities = input.authorities.slice(0, 5);
  const supportingExcerpts: SupportingExcerpt[] = authorities.map((authority, index) => ({
    label: `A${index + 1}`,
    excerpt: authority.snippet,
    traceability: authority.traceability,
  }));

  const answerText =
    authorities.length === 0
      ? "I could not find enough grounded authority to answer this question conservatively."
      : `I found ${authorities.length} grounded authorities, but the evidence is not strong enough to state a definitive legal conclusion. Review the cited excerpts before relying on the answer.`;

  return {
    messageId: crypto.randomUUID(),
    role: "assistant",
    query: input.query,
    normalizedQuery: normalizeQuery(input.query),
    queryType: classifyQuery(input.query),
    answerText,
    authorities,
    supportingExcerpts,
    limitations:
      input.limitations.length > 0
        ? input.limitations
        : ["证据不足，回答已降级为保守模式。"],
  };
}

export function buildAskResponse(input: {
  query: string;
  plan: RetrievalPlan;
  authorities: RetrievalCandidate[];
  answer: AnswerModelResult | null;
  limitations: string[];
}): AskResponse {
  if (!input.answer) {
    return buildConservativeAnswer({
      query: input.query,
      authorities: input.authorities,
      limitations: input.limitations,
    });
  }

  const traceabilityByChunkId = new Map(
    input.authorities.map((authority) => [authority.chunkId, authority.traceability]),
  );
  const supportingExcerpts = input.answer.supportingExcerpts.filter((item) =>
    Array.from(traceabilityByChunkId.values()).some(
      (traceability) =>
        traceability.chunkId === item.traceability.chunkId &&
        traceability.documentId === item.traceability.documentId,
    ),
  );

  if (supportingExcerpts.length === 0) {
    return buildConservativeAnswer({
      query: input.query,
      authorities: input.authorities,
      limitations: [
        ...input.limitations,
        "模型输出未通过引用校验，已降级为保守回答。",
      ],
    });
  }

  return {
    messageId: crypto.randomUUID(),
    role: "assistant",
    query: input.query,
    normalizedQuery: input.plan.normalizedQuery,
    queryType: input.plan.queryType,
    answerText: input.answer.answerText,
    authorities: input.authorities,
    supportingExcerpts,
    limitations: [...input.limitations, ...input.answer.limitations],
  };
}
