/**
 * 共享类型定义与实用工具
 * 
 * 定义了整个 Monorepo 共用的领域模型、API 请求/响应结构、
 * 以及通用的数据解析逻辑。
 * 确保了前端、后端与 AI 包之间的数据契约一致性。
 */

/**
 * 法律查询类型
 */
export type QueryType =
  | "citation_lookup"      // 引用查找
  | "case_name_lookup"     // 案件名查找
  | "legislation_lookup"   // 法条查找
  | "keyword_lookup"       // 关键字搜索
  | "natural_language_query"; // 自然语言问题

// 速率限制配置
export const DEFAULT_CHAT_RATE_LIMIT_PER_MINUTE = 10;
export const DEFAULT_CHAT_RATE_LIMIT_PER_DAY = 100;
export const CHAT_RATE_LIMIT_ERROR_CODE = "chat_rate_limit_exceeded";

export type ChatRateLimitWindow = "minute" | "day";

/**
 * 速率限制详情
 */
export type ChatRateLimitDetails = {
  window: ChatRateLimitWindow;
  limit: number;
  retryAfterSeconds: number;
  resetAt: string;
};

/**
 * 搜索过滤器
 */
export type SearchFilters = {
  court?: string;        // 法院
  jurisdiction?: string; // 管辖权
  documentType?: string; // 文档类型
  dateFrom?: string;     // 起始日期
  dateTo?: string;       // 结束日期
};

/**
 * /search 接口请求结构
 */
export type SearchRequest = {
  query: string;
  topK: number;
  filters: SearchFilters;
};

/**
 * /ask 接口请求结构
 */
export type AskRequest = SearchRequest & {
  conversationId?: string;
  messageId?: string;
};

/**
 * 可追溯性引用
 * 用于将检索到的片段映射回原始文档的特定位置。
 */
export type TraceabilityRef = {
  documentId: string;
  chunkId: string;
  paragraphStartNo: number | null;
  paragraphEndNo: number | null;
};

/**
 * 权威检索结果项
 */
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

/**
 * 支撑答案的文本片段
 */
export type SupportingExcerpt = {
  label: string; // 标识符 (如 A1, A2)
  excerpt: string;
  traceability: TraceabilityRef;
};

/**
 * /search 接口响应结构
 */
export type SearchResponse = {
  query: string;
  normalizedQuery: string;
  queryType: QueryType;
  topK: number;
  limitations: string[];
  results: AuthorityResult[];
};

/**
 * /ask 接口响应结构
 */
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

/**
 * 健康检查响应结构
 */
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

/**
 * 文档详情响应结构
 */
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

/**
 * 单个段落记录结构
 */
export type ParagraphRecord = {
  id: string;
  documentId: string;
  paragraphNo: number | null;
  paragraphOrder: number;
  paragraphText: string;
};

/**
 * 文档全文段落响应结构
 */
export type DocumentParagraphsResponse = {
  documentId: string;
  paragraphs: ParagraphRecord[];
};

const DEFAULT_TOP_K = 8;
const MAX_TOP_K = 20;

/**
 * 内部工具：验证对象类型
 */
function readRecord(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} 必须是对象`);
  }
  return value as Record<string, unknown>;
}

/**
 * 内部工具：安全读取字符串
 */
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

/**
 * 内部工具：安全读取数字并限制范围
 */
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

/**
 * 解析搜索过滤器
 */
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

/**
 * 解析搜索查询请求体
 */
export function parseSearchQuery(value: unknown): SearchRequest {
  const record = readRecord(value, "query");
  return {
    query: readString(record, "query", true) ?? "",
    topK: readNumber(record, "topK", DEFAULT_TOP_K),
    filters: parseSearchFilters(record.filters),
  };
}

/**
 * 从 URL 查询参数中解析搜索请求
 */
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

/**
 * 解析问答接口请求体
 */
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
