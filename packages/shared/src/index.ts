export type QueryType =
  | "citation_lookup"
  | "case_name_lookup"
  | "legislation_lookup"
  | "keyword_lookup"
  | "natural_language_query";

export type SearchFilters = {
  court?: string;
  jurisdiction?: string;
  documentType?: string;
  dateFrom?: string;
  dateTo?: string;
};

export type SearchRequest = {
  query: string;
  topK: number;
  filters: SearchFilters;
};

export type AskRequest = SearchRequest & {
  conversationId?: string;
  messageId?: string;
};

export type TraceabilityRef = {
  documentId: string;
  chunkId: string;
  paragraphStartNo: number | null;
  paragraphEndNo: number | null;
};

export type AuthorityResult = {
  documentId: string;
  chunkId: string;
  title: string;
  neutralCitation: string | null;
  court: string | null;
  jurisdiction: string | null;
  documentType: string;
  decisionDate: string | null;
  snippet: string;
  score: number;
  traceability: TraceabilityRef;
};

export type SupportingExcerpt = {
  label: string;
  excerpt: string;
  traceability: TraceabilityRef;
};

export type SearchResponse = {
  query: string;
  normalizedQuery: string;
  queryType: QueryType;
  topK: number;
  limitations: string[];
  results: AuthorityResult[];
};

export type AskResponse = {
  messageId: string;
  role: "assistant";
  query: string;
  normalizedQuery: string;
  queryType: QueryType;
  answerText: string;
  authorities: AuthorityResult[];
  supportingExcerpts: SupportingExcerpt[];
  limitations: string[];
};

export type HealthResponse = {
  status: "ok" | "degraded";
  service: "legalchat-api";
  timestamp: string;
  checks: {
    database: boolean;
    pinecone: boolean;
    gemini: boolean;
  };
};

export type DocumentResponse = {
  documentId: string;
  title: string;
  neutralCitation: string | null;
  parallelCitation: string | null;
  court: string | null;
  jurisdiction: string | null;
  documentType: string;
  decisionDate: string | null;
  docketNumber: string | null;
  summaryText: string | null;
  sourceUrl: string | null;
  parseStatus: string;
  indexingStatus: string;
};

export type ParagraphRecord = {
  id: string;
  documentId: string;
  paragraphNo: number | null;
  paragraphOrder: number;
  paragraphText: string;
};

export type DocumentParagraphsResponse = {
  documentId: string;
  paragraphs: ParagraphRecord[];
};

const DEFAULT_TOP_K = 8;
const MAX_TOP_K = 20;

function readRecord(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} 必须是对象`);
  }
  return value as Record<string, unknown>;
}

function readString(
  record: Record<string, unknown>,
  key: string,
  required = false,
): string | undefined {
  const value = record[key];
  if (value == null || value === "") {
    if (required) {
      throw new Error(`${key} 是必填字段`);
    }
    return undefined;
  }
  if (typeof value !== "string") {
    throw new Error(`${key} 必须是字符串`);
  }
  return value.trim();
}

function readNumber(
  record: Record<string, unknown>,
  key: string,
  fallback: number,
): number {
  const value = record[key];
  if (value == null || value === "") {
    return fallback;
  }
  const parsed =
    typeof value === "number" ? value : Number.parseInt(String(value), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${key} 必须是正整数`);
  }
  return Math.min(parsed, MAX_TOP_K);
}

export function parseSearchFilters(value: unknown): SearchFilters {
  const record = value ? readRecord(value, "filters") : {};
  return {
    court: readString(record, "court"),
    jurisdiction: readString(record, "jurisdiction"),
    documentType: readString(record, "documentType"),
    dateFrom: readString(record, "dateFrom"),
    dateTo: readString(record, "dateTo"),
  };
}

export function parseSearchQuery(value: unknown): SearchRequest {
  const record = readRecord(value, "query");
  return {
    query: readString(record, "query", true) ?? "",
    topK: readNumber(record, "topK", DEFAULT_TOP_K),
    filters: parseSearchFilters(record.filters),
  };
}

export function parseSearchFromUrl(url: URL): SearchRequest {
  return {
    query: (url.searchParams.get("q") ?? "").trim(),
    topK: readNumber(
      {
        topK: url.searchParams.get("top_k"),
      },
      "topK",
      DEFAULT_TOP_K,
    ),
    filters: parseSearchFilters({
      court: url.searchParams.get("court"),
      jurisdiction: url.searchParams.get("jurisdiction"),
      documentType: url.searchParams.get("document_type"),
      dateFrom: url.searchParams.get("date_from"),
      dateTo: url.searchParams.get("date_to"),
    }),
  };
}

export function parseAskBody(value: unknown): AskRequest {
  const record = readRecord(value, "body");
  return {
    query: readString(record, "query", true) ?? "",
    topK: readNumber(record, "topK", DEFAULT_TOP_K),
    filters: parseSearchFilters(record.filters),
    conversationId: readString(record, "conversationId"),
    messageId: readString(record, "messageId"),
  };
}
