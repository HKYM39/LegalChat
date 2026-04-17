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
export const INPUT_SECURITY_ERROR_CODE = "input_security_rejected";
export const INPUT_SECURITY_ERROR_TYPE = "input_security_violation";
export const MAX_CHAT_INPUT_LENGTH = 4000;

export type ChatRateLimitWindow = "minute" | "day";
export type InputSecurityReasonCode =
  | "blank_input"
  | "input_too_long"
  | "control_characters_detected"
  | "script_injection_detected"
  | "protocol_probe_detected"
  | "injection_probe_detected";

export type InputSecuritySignal =
  | "blank_input"
  | "length_limit_exceeded"
  | "control_characters"
  | "script_tag"
  | "script_protocol"
  | "event_handler_attribute"
  | "http_request_line"
  | "header_block"
  | "sql_probe"
  | "path_traversal"
  | "template_injection";

export type InputSecurityViolation = {
  type: typeof INPUT_SECURITY_ERROR_TYPE;
  code: typeof INPUT_SECURITY_ERROR_CODE;
  reasonCode: InputSecurityReasonCode;
  message: string;
};

export type InputSecurityValidationResult =
  | {
      allowed: true;
      normalizedInput: string;
      matchedSignals: InputSecuritySignal[];
      violation: null;
    }
  | {
      allowed: false;
      normalizedInput: string;
      matchedSignals: InputSecuritySignal[];
      violation: InputSecurityViolation;
    };

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
const CONTROL_CHARACTER_PATTERN = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;
const SCRIPT_TAG_PATTERN = /<\s*\/?\s*script\b|<\s*iframe\b|<\s*svg\b[^>]*\bonload\s*=|<\s*img\b[^>]*\bonerror\s*=/i;
const SCRIPT_PROTOCOL_PATTERN = /\b(?:javascript:|data:\s*text\/html)/i;
const EVENT_HANDLER_PATTERN = /\bon[a-z]{3,}\s*=/i;
const HTTP_REQUEST_LINE_PATTERN =
  /(?:^|[\r\n])\s*(?:GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS)\s+\S+\s+HTTP\/1\.[01]\b/i;
const HEADER_BLOCK_PATTERN =
  /(?:^|[\r\n])\s*(?:Host|User-Agent|Accept|Content-Length|Transfer-Encoding|X-Forwarded-For)\s*:/i;
const SQL_PROBE_PATTERN =
  /\b(?:union\s+select|drop\s+table|insert\s+into|delete\s+from|update\s+\w+\s+set|or\s+1\s*=\s*1|information_schema|xp_cmdshell|sleep\s*\(|benchmark\s*\()/i;
const PATH_TRAVERSAL_PATTERN =
  /(?:\.\.\/|\/etc\/passwd|\/proc\/self|file:\/\/|[a-z]:\\(?:windows\\system32|users\\))/i;
const TEMPLATE_INJECTION_PATTERN = /(?:\$\{[^}]+\}|{{[^}]+}}|<%=?[\s\S]*?%>)/i;

const INPUT_SECURITY_MESSAGES: Record<InputSecurityReasonCode, string> = {
  blank_input: "请输入明确的法律研究问题后再提交。",
  input_too_long: `输入内容过长，请控制在 ${MAX_CHAT_INPUT_LENGTH} 个字符以内。`,
  control_characters_detected: "输入包含异常控制字符，请删除不可见字符后重试。",
  script_injection_detected: "输入包含脚本或可执行标记，请改为纯文本法律问题。",
  protocol_probe_detected: "输入包含协议探测或原始请求片段，请改为纯文本法律问题。",
  injection_probe_detected: "输入包含明显的注入或路径探测片段，请改为纯文本法律问题。",
};

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

function normalizeUserInput(value: string): string {
  return value.replace(/\r\n?/g, "\n").trim();
}

export function createInputSecurityViolation(
  reasonCode: InputSecurityReasonCode,
): InputSecurityViolation {
  return {
    type: INPUT_SECURITY_ERROR_TYPE,
    code: INPUT_SECURITY_ERROR_CODE,
    reasonCode,
    message: INPUT_SECURITY_MESSAGES[reasonCode],
  };
}

export function isInputSecurityViolation(
  value: unknown,
): value is InputSecurityViolation {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const record = value as Record<string, unknown>;
  return (
    record.type === INPUT_SECURITY_ERROR_TYPE &&
    record.code === INPUT_SECURITY_ERROR_CODE &&
    typeof record.reasonCode === "string" &&
    typeof record.message === "string"
  );
}

export function validateUserInputSecurity(
  value: string,
): InputSecurityValidationResult {
  const normalizedInput = normalizeUserInput(value);

  if (normalizedInput.length === 0) {
    return {
      allowed: false,
      normalizedInput,
      matchedSignals: ["blank_input"],
      violation: createInputSecurityViolation("blank_input"),
    };
  }

  if (normalizedInput.length > MAX_CHAT_INPUT_LENGTH) {
    return {
      allowed: false,
      normalizedInput,
      matchedSignals: ["length_limit_exceeded"],
      violation: createInputSecurityViolation("input_too_long"),
    };
  }

  if (CONTROL_CHARACTER_PATTERN.test(normalizedInput)) {
    return {
      allowed: false,
      normalizedInput,
      matchedSignals: ["control_characters"],
      violation: createInputSecurityViolation("control_characters_detected"),
    };
  }

  const scriptSignals: InputSecuritySignal[] = [];
  if (SCRIPT_TAG_PATTERN.test(normalizedInput)) {
    scriptSignals.push("script_tag");
  }
  if (SCRIPT_PROTOCOL_PATTERN.test(normalizedInput)) {
    scriptSignals.push("script_protocol");
  }
  if (EVENT_HANDLER_PATTERN.test(normalizedInput)) {
    scriptSignals.push("event_handler_attribute");
  }
  if (scriptSignals.length > 0) {
    return {
      allowed: false,
      normalizedInput,
      matchedSignals: scriptSignals,
      violation: createInputSecurityViolation("script_injection_detected"),
    };
  }

  const protocolSignals: InputSecuritySignal[] = [];
  if (HTTP_REQUEST_LINE_PATTERN.test(normalizedInput)) {
    protocolSignals.push("http_request_line");
  }
  if (HEADER_BLOCK_PATTERN.test(normalizedInput)) {
    protocolSignals.push("header_block");
  }
  if (protocolSignals.length > 0) {
    return {
      allowed: false,
      normalizedInput,
      matchedSignals: protocolSignals,
      violation: createInputSecurityViolation("protocol_probe_detected"),
    };
  }

  const injectionSignals: InputSecuritySignal[] = [];
  if (SQL_PROBE_PATTERN.test(normalizedInput)) {
    injectionSignals.push("sql_probe");
  }
  if (PATH_TRAVERSAL_PATTERN.test(normalizedInput)) {
    injectionSignals.push("path_traversal");
  }
  if (TEMPLATE_INJECTION_PATTERN.test(normalizedInput)) {
    injectionSignals.push("template_injection");
  }
  if (injectionSignals.length > 0) {
    return {
      allowed: false,
      normalizedInput,
      matchedSignals: injectionSignals,
      violation: createInputSecurityViolation("injection_probe_detected"),
    };
  }

  return {
    allowed: true,
    normalizedInput,
    matchedSignals: [],
    violation: null,
  };
}
