/**
 * AI 逻辑与 RAG 核心处理模块
 * 
 * 本模块负责查询分类、检索计划构建、混合检索结果融合 (Reranking)、
 * 以及基于 Google Gemini 的 Grounded 答案生成。
 * 它实现了 RAG 流程中“检索之后、生成之前”的关键逻辑。
 */
import type {
  AskResponse,
  AuthorityResult,
  QueryType,
  SearchFilters,
  SupportingExcerpt,
} from "../../shared/src/index.ts";

/**
 * 检索候选对象扩展类型
 * 包含各维度的排名和评分信息，用于 Rerank。
 */
export type RetrievalCandidate = AuthorityResult & {
  denseRank?: number;
  lexicalRank?: number;
  fusedRank?: number;
  denseScore?: number;
  lexicalScore?: number;
  fusedScore?: number;
  rerankedScore?: number;
};

/**
 * 检索计划
 * 定义如何针对特定查询执行召回。
 */
export type RetrievalPlan = {
  normalizedQuery: string; // 标准化后的查询
  lexicalQuery: string;    // 词法搜索关键字
  queryType: QueryType;    // 查询分类
  topK: number;            // 最终需要的 K 值
  lexicalTopK: number;     // 词法召回 K 值
  denseTopK: number;       // 向量召回 K 值
  filters: SearchFilters;  // 元数据过滤器
};

/**
 * 提示词中的证据项格式
 */
export type PromptEvidence = {
  label: string;
  title: string;
  citation: string | null;
  excerpt: string;
  traceability: AuthorityResult["traceability"];
};

/**
 * 模型生成的答案结果结构
 */
export type AnswerModelResult = {
  answerText: string;
  limitations: string[];
  supportingExcerpts: Array<{
    label: string;
    excerpt: string;
  }>;
};

/**
 * Gemini 模型配置
 */
export type GeminiConfig = {
  apiKey?: string;
  model: string;
  embeddingModel: string;
  embeddingOutputDimensionality?: number;
  apiBaseUrl: string;
};

/**
 * 压缩空白字符
 */
function compactWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

/**
 * 标准化用户查询文本
 */
export function normalizeQuery(input: string): string {
  return compactWhitespace(input)
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'");
}

/**
 * 对用户查询进行分类
 * 识别出是引用查找、案件名查找、法条查找还是通用自然语言问题。
 */
export function classifyQuery(input: string): QueryType {
  const normalized = normalizeQuery(input).toLowerCase();
  // 匹配类似 [2025] HCA 2 的引用格式
  if (/\b\d{4}\b/.test(normalized) && normalized.includes("v")) {
    return "citation_lookup";
  }
  // 匹配包含法律主体后缀的词
  if (/\b(inc|corp|llc|ltd|commission|state|people|re)\b/.test(normalized)) {
    return "case_name_lookup";
  }
  // 匹配法律文档类型关键字
  if (/\b(act|code|statute|regulation|section|rule)\b/.test(normalized)) {
    return "legislation_lookup";
  }
  // 短查询视为关键词查找
  if (normalized.split(" ").length <= 5) {
    return "keyword_lookup";
  }
  return "natural_language_query";
}

/**
 * 构建用于全文检索的词法查询字符串
 */
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
    // 提取关键词并过滤停用词
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

/**
 * 根据输入构建检索计划
 */
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

/**
 * 融合词法检索与向量检索的结果并进行重排 (RRF 变体或加权融合)
 */
export function mergeAndRerankCandidates(input: {
  lexical: RetrievalCandidate[];
  dense: RetrievalCandidate[];
  topK: number;
}): {
  results: RetrievalCandidate[];
  limitations: string[];
} {
  const merged = new Map<string, RetrievalCandidate>();

  // 记录词法搜索结果
  for (const [index, candidate] of input.lexical.entries()) {
    merged.set(candidate.chunkId, {
      ...candidate,
      lexicalRank: index + 1,
      lexicalScore: candidate.score,
    });
  }

  // 合并向量搜索结果
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

  // 综合评分逻辑
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

/**
 * 将检索候选转化为 LLM 提示词中的证据项
 */
export function buildPromptEvidence(candidates: RetrievalCandidate[]): PromptEvidence[] {
  return candidates.map((candidate, index) => ({
    label: `A${index + 1}`,
    title: candidate.title,
    citation: candidate.neutralCitation,
    excerpt: candidate.snippet,
    traceability: candidate.traceability,
  }));
}

/**
 * 构建用于 Grounded 生成的系统提示词
 */
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

/**
 * 调用 Gemini 模型生成向量嵌入
 */
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
          ...(config.embeddingOutputDimensionality
            ? {
                outputDimensionality: config.embeddingOutputDimensionality,
              }
            : {}),
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

/**
 * 解析 Gemini 返回的 JSON 格式内容
 */
function parseGeminiJson(text: string): AnswerModelResult | null {
  const normalizedText = text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  try {
    const parsed = JSON.parse(normalizedText) as
      | Partial<AnswerModelResult>
      | {
          answerText?: unknown;
          limitations?: unknown;
          supportingExcerpts?: unknown;
        };
    if (!parsed || typeof parsed.answerText !== "string") {
      return null;
    }
    return {
      answerText: parsed.answerText.trim(),
      limitations: Array.isArray(parsed.limitations)
        ? parsed.limitations.filter((item): item is string => typeof item === "string")
        : typeof parsed.limitations === "string" && parsed.limitations.trim()
          ? [parsed.limitations.trim()]
          : [],
      supportingExcerpts: Array.isArray(parsed.supportingExcerpts)
        ? parsed.supportingExcerpts.flatMap((item) => {
            if (
              item &&
              typeof item === "object" &&
              typeof (item as { label?: unknown }).label === "string" &&
              typeof (item as { excerpt?: unknown }).excerpt === "string"
            ) {
              return [
                {
                  label: (item as { label: string }).label,
                  excerpt: (item as { excerpt: string }).excerpt,
                },
              ];
            }
            return [];
          })
        : [],
    };
  } catch {
    return null;
  }
}

/**
 * 调用 Gemini 生成基于证据的 Grounded 回答
 */
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

/**
 * 当模型生成失败或证据不足时构建保守回答
 */
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

/**
 * 组装最终的 /ask 接口响应
 */
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

  // 构建标签到元数据的映射
  const traceabilityByLabel = new Map(
    input.authorities.map((authority, index) => [
      `A${index + 1}`,
      authority.traceability,
    ]),
  );
  // 注入可追溯性信息到支持性片段中
  const supportingExcerpts = input.answer.supportingExcerpts.flatMap((item) => {
    const traceability = traceabilityByLabel.get(item.label);
    if (!traceability) {
      return [];
    }
    return [
      {
        label: item.label,
        excerpt: item.excerpt,
        traceability,
      },
    ];
  });

  // 如果生成的答案中一个有效引用都没有，降级为保守回答
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
