/**
 * 离线索引流水线 (Offline Indexing Pipeline)
 * 
 * 职责：
 * 1. 读取由 Python 脚本生成的标准化 JSON 文档。
 * 2. 执行法律感知的文档分块 (Legal-aware Chunking)。
 * 3. 调用 Gemini API 生成文本嵌入向量 (Embeddings)。
 * 4. 将结构化数据导入 PostgreSQL (Drizzle)。
 * 5. 将向量数据同步到 Pinecone 向量数据库。
 * 
 * 符合 PRD 第 9 章节定义的离线索引流程。
 */
import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { legalDocuments, legalDocumentChunks, legalDocumentParagraphs } from "../../../packages/db/src/schema/documents.ts";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const apiDir = path.resolve(scriptDir, "..");
const repoRoot = path.resolve(apiDir, "../..");

/**
 * 标准化段落类型定义
 */
type NormalizedParagraph = {
  id: string;
  document_id: string;
  paragraph_order: number;
  paragraph_text: string;
  paragraph_no: number | null;
  char_start: number | null;
  char_end: number | null;
  token_count: number | null;
  heading_path: string | null;
  section_id: string | null;
};

/**
 * 标准化文档类型定义
 */
type NormalizedDocument = {
  id: string;
  source_path: string;
  source_type: string;
  source_url: string | null;
  external_source_id: string | null;
  title: string;
  neutral_citation: string | null;
  parallel_citation: string | null;
  court: string | null;
  jurisdiction: string | null;
  decision_date: string | null;
  judges: string | null;
  parties: string | null;
  document_type: string;
  language: string;
  docket_number: string | null;
  summary_text: string | null;
  full_text: string;
  raw_text: string;
  text_checksum: string;
  parse_status: string;
  indexing_status: string;
  paragraphs: NormalizedParagraph[];
  warnings?: string[];
};

/**
 * 索引块类型定义
 */
type IndexedChunk = {
  id: string;
  documentId: string;
  chunkIndex: number;
  chunkType: string;
  chunkText: string;
  paragraphStartNo: number | null;
  paragraphEndNo: number | null;
  headingPath: string | null;
  tokenCount: number;
  paragraphIds: string[];
  paragraphOrders: number[];
  sectionId: string | null;
  vectorId: string | null;
  embeddingModelName: string | null;
  embeddingModelVersion: string | null;
  vectorProvider: string | null;
};

type ExistingChunkRow = {
  id: string;
  vectorId: string | null;
  embeddingModelName: string | null;
  embeddingModelVersion: string | null;
  vectorProvider: string | null;
};

/**
 * 命令行选项
 */
type CliOptions = {
  inputDir: string;
  chunkOutputDir: string;
  documentId?: string;
  limit?: number;
  verbose: boolean;
  dryRun: boolean;
  skipEmbeddings: boolean;
  skipPinecone: boolean;
  onlyMissingVectors: boolean;
  forceReembed: boolean;
};

/**
 * 运行时环境配置
 */
type RuntimeConfig = {
  databaseUrl?: string;
  pineconeApiKey?: string;
  pineconeIndexHost?: string;
  pineconeNamespace?: string;
  geminiApiKey?: string;
  geminiEmbeddingModel: string;
  geminiEmbeddingOutputDimensionality?: number;
  geminiApiBaseUrl: string;
};

type PineconeVector = {
  id: string;
  values: number[];
  metadata: Record<string, string | number | boolean | null>;
};

/**
 * 规范化嵌入模型名称
 */
function normalizeGeminiEmbeddingModel(value?: string): string {
  if (!value || value === "text-embedding-004") {
    return "gemini-embedding-001";
  }
  return value;
}

// 分块策略参数
const CHUNK_PARAGRAPH_TARGET = 3;      // 目标分块包含的段落数
const CHUNK_PARAGRAPH_MAX = 5;         // 最大段落数
const CHUNK_CHAR_SOFT_LIMIT = 3500;    // 字符数软限制
const HEADING_TEXT_MAX_LENGTH = 80;    // 标题最大长度判定
const PINECONE_API_VERSION = "2025-10";

/**
 * 解析命令行参数
 */
function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    inputDir: path.join(repoRoot, "tools/output/normalized"),
    chunkOutputDir: path.join(repoRoot, "tools/output/chunks"),
    verbose: false,
    dryRun: false,
    skipEmbeddings: false,
    skipPinecone: false,
    onlyMissingVectors: false,
    forceReembed: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];

    switch (arg) {
      case "--input-dir":
        options.inputDir = path.resolve(repoRoot, next ?? "");
        index += 1;
        break;
      case "--chunk-output-dir":
        options.chunkOutputDir = path.resolve(repoRoot, next ?? "");
        index += 1;
        break;
      case "--document-id":
        options.documentId = next;
        index += 1;
        break;
      case "--limit":
        options.limit = Number.parseInt(next ?? "", 10);
        index += 1;
        break;
      case "--verbose":
        options.verbose = true;
        break;
      case "--dry-run":
        options.dryRun = true;
        break;
      case "--skip-embeddings":
        options.skipEmbeddings = true;
        break;
      case "--skip-pinecone":
        options.skipPinecone = true;
        break;
      case "--only-missing-vectors":
        options.onlyMissingVectors = true;
        break;
      case "--force-reembed":
        options.forceReembed = true;
        break;
      default:
        if (arg.startsWith("--")) {
          throw new Error(`Unknown argument: ${arg}`);
        }
    }
  }

  return options;
}

/**
 * 加载脚本运行所需的配置
 */
function loadRuntimeConfig(): RuntimeConfig {
  return {
    databaseUrl: readEnv("DATABASE_URL"),
    pineconeApiKey: readEnv("PINECONE_API_KEY"),
    pineconeIndexHost: readEnv("PINECONE_INDEX_HOST"),
    pineconeNamespace: readEnv("PINECONE_NAMESPACE"),
    geminiApiKey: readEnv("GEMINI_API_KEY"),
    geminiEmbeddingModel: normalizeGeminiEmbeddingModel(
      readEnv("GEMINI_EMBEDDING_MODEL"),
    ),
    geminiEmbeddingOutputDimensionality: readNumberEnv(
      "GEMINI_EMBEDDING_OUTPUT_DIMENSIONALITY",
      1024,
    ),
    geminiApiBaseUrl:
      readEnv("GEMINI_API_BASE_URL") ??
      "https://generativelanguage.googleapis.com/v1beta",
  };
}

function readEnv(name: string): string | undefined {
  const value = process.env[name];
  return value && value.trim() ? value.trim() : undefined;
}

function readNumberEnv(name: string, fallback: number): number {
  const value = readEnv(name);
  if (!value) {
    return fallback;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

/**
 * 手动加载本地 .env 文件
 */
async function loadLocalEnvFile() {
  const envPath = path.join(apiDir, ".env");
  try {
    const raw = await readFile(envPath, "utf-8");
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) {
        continue;
      }
      const separatorIndex = trimmed.indexOf("=");
      if (separatorIndex <= 0) {
        continue;
      }
      const key = trimmed.slice(0, separatorIndex).trim();
      const value = trimmed.slice(separatorIndex + 1).trim();
      if (!(key in process.env)) {
        process.env[key] = value;
      }
    }
  } catch {
    // 忽略缺失的本地环境文件
  }
}

function log(message: string, verbose = true, options?: CliOptions) {
  if (!options || options.verbose || verbose) {
    console.log(message);
  }
}

/**
 * 粗略估算 Token 数量
 */
function estimateTokens(value: string): number {
  return Math.max(1, Math.round(value.split(/\s+/).filter(Boolean).length * 1.3));
}

/**
 * 生成 SHA256 哈希
 */
function sha256Hex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

/**
 * 基于种子生成稳定的 UUID
 */
function stableUuid(seed: string): string {
  const hash = createHash("sha1").update(seed).digest();
  const bytes = Uint8Array.from(hash.subarray(0, 16));
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Buffer.from(bytes).toString("hex");
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join("-");
}

/**
 * 生成向量 ID，确保同一内容对应同一 ID
 */
function chunkVectorId(chunkId: string, embeddingModel: string): string {
  return `chunk_${sha256Hex(`${chunkId}:${embeddingModel}`).slice(0, 24)}`;
}

/**
 * 判定一段文本是否看起来像标题
 */
function isHeadingLike(text: string): boolean {
  const compact = text.replace(/\s+/g, " ").trim();
  if (!compact) {
    return false;
  }
  if (compact.length <= HEADING_TEXT_MAX_LENGTH && compact === compact.toUpperCase()) {
    return true;
  }
  return new Set(["Representation", "ORDER", "CATCHWORDS", "This appeal"]).has(compact);
}

/**
 * 格式化段落内容用于分块展示
 */
function formatParagraphForChunk(paragraph: NormalizedParagraph): string {
  if (paragraph.paragraph_no == null) {
    return paragraph.paragraph_text.trim();
  }
  return `[${paragraph.paragraph_no}] ${paragraph.paragraph_text.trim()}`;
}

/**
 * 执行文档分块逻辑 (Chunking)
 * 
 * 策略：按段落合并，考虑字符长度限制与标题变化。
 */
function buildChunks(
  document: NormalizedDocument,
  existingById: Map<string, ExistingChunkRow>,
  options: CliOptions,
  config: RuntimeConfig,
): IndexedChunk[] {
  const chunks: IndexedChunk[] = [];
  let currentGroup: NormalizedParagraph[] = [];
  let currentHeadingPath: string | null = null;

  const flush = () => {
    if (currentGroup.length === 0) {
      return;
    }
    const chunkIndex = chunks.length;
    const chunkText = currentGroup.map(formatParagraphForChunk).join("\n\n");
    const paragraphNumbers = currentGroup
      .map((paragraph) => paragraph.paragraph_no)
      .filter((value): value is number => value != null);
    const paragraphStartNo = paragraphNumbers[0] ?? currentGroup[0]?.paragraph_order ?? null;
    const paragraphEndNo =
      paragraphNumbers.at(-1) ?? currentGroup.at(-1)?.paragraph_order ?? null;
    
    // 生成基于内容稳定的 ID
    const chunkId = stableUuid(
      `chunk:${document.id}:${chunkIndex}:${paragraphStartNo ?? "na"}:${paragraphEndNo ?? "na"}:${chunkText}`,
    );
    const existing = existingById.get(chunkId);
    
    chunks.push({
      id: chunkId,
      documentId: document.id,
      chunkIndex,
      chunkType: "paragraph_group",
      chunkText,
      paragraphStartNo,
      paragraphEndNo,
      headingPath: currentHeadingPath,
      tokenCount: estimateTokens(chunkText),
      paragraphIds: currentGroup.map((paragraph) => paragraph.id),
      paragraphOrders: currentGroup.map((paragraph) => paragraph.paragraph_order),
      sectionId: currentGroup.find((paragraph) => paragraph.section_id)?.section_id ?? null,
      // 如果已存在向量且未强制重新生成，则保留旧状态
      vectorId:
        !options.forceReembed && existing?.vectorId
          ? existing.vectorId
          : null,
      embeddingModelName:
        !options.forceReembed && existing?.embeddingModelName
          ? existing.embeddingModelName
          : null,
      embeddingModelVersion:
        !options.forceReembed && existing?.embeddingModelVersion
          ? existing.embeddingModelVersion
          : null,
      vectorProvider:
        !options.forceReembed && existing?.vectorProvider
          ? existing.vectorProvider
          : null,
    });
    currentGroup = [];
  };

  for (const paragraph of document.paragraphs) {
    const paragraphText = paragraph.paragraph_text.trim();
    const paragraphHeading = paragraph.heading_path ?? (isHeadingLike(paragraphText) ? paragraphText : null);

    if (currentGroup.length > 0) {
      const currentChars = currentGroup.reduce(
        (sum, item) => sum + item.paragraph_text.length,
        0,
      );
      const headingChanged =
        paragraphHeading != null &&
        currentHeadingPath != null &&
        paragraphHeading !== currentHeadingPath &&
        currentGroup.length >= 1;

      // 如果遇到新标题或达到字数上限，则切分
      if (
        headingChanged ||
        currentChars + paragraphText.length > CHUNK_CHAR_SOFT_LIMIT
      ) {
        flush();
      }
    }

    if (currentGroup.length === 0) {
      currentHeadingPath = paragraphHeading ?? currentHeadingPath;
    }

    currentGroup.push(paragraph);

    const groupChars = currentGroup.reduce(
      (sum, item) => sum + item.paragraph_text.length,
      0,
    );
    const isSingleLongParagraph =
      currentGroup.length === 1 && currentGroup[0].paragraph_text.length >= 1800;
    const reachedMaxParagraphs = currentGroup.length >= CHUNK_PARAGRAPH_MAX;
    const reachedSoftTarget =
      currentGroup.length >= CHUNK_PARAGRAPH_TARGET &&
      groupChars >= CHUNK_CHAR_SOFT_LIMIT;

    if (isSingleLongParagraph || reachedMaxParagraphs || reachedSoftTarget) {
      flush();
      currentHeadingPath = paragraphHeading ?? currentHeadingPath;
    }
  }

  flush();
  return chunks;
}

/**
 * 发现待处理的标准化 JSON 文件
 */
async function discoverNormalizedFiles(options: CliOptions): Promise<string[]> {
  const entries = await readdir(options.inputDir, { withFileTypes: true });
  const files = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
    .map((entry) => path.join(options.inputDir, entry.name))
    .sort();

  const filtered = options.documentId
    ? files.filter((file) => path.basename(file, ".json") === options.documentId)
    : files;

  if (options.limit && options.limit > 0) {
    return filtered.slice(0, options.limit);
  }

  return filtered;
}

/**
 * 读取并解析标准化文档
 */
async function readNormalizedDocument(filePath: string): Promise<NormalizedDocument> {
  const raw = await readFile(filePath, "utf-8");
  const parsed = JSON.parse(raw) as NormalizedDocument;
  validateNormalizedDocument(parsed, filePath);
  return parsed;
}

/**
 * 基础校验标准化文档格式
 */
function validateNormalizedDocument(document: NormalizedDocument, filePath: string) {
  if (!document.id) {
    throw new Error(`Normalized document missing id: ${filePath}`);
  }
  if (!document.title) {
    throw new Error(`Normalized document missing title: ${filePath}`);
  }
  if (!Array.isArray(document.paragraphs) || document.paragraphs.length === 0) {
    throw new Error(`Normalized document missing paragraphs: ${filePath}`);
  }
  for (const paragraph of document.paragraphs) {
    if (!paragraph.id || !paragraph.paragraph_text) {
      throw new Error(`Invalid paragraph detected in ${filePath}`);
    }
  }
}

/**
 * 将分块结果保存为快照 JSON
 */
async function writeChunkSnapshot(
  document: NormalizedDocument,
  chunks: IndexedChunk[],
  outputDir: string,
) {
  await mkdir(outputDir, { recursive: true });
  const outputPath = path.join(outputDir, `${document.id}.json`);
  await writeFile(
    outputPath,
    JSON.stringify(
      {
        document_id: document.id,
        title: document.title,
        chunks: chunks.map((chunk) => ({
          id: chunk.id,
          document_id: chunk.documentId,
          chunk_index: chunk.chunkIndex,
          chunk_type: chunk.chunkType,
          chunk_text: chunk.chunkText,
          paragraph_start_no: chunk.paragraphStartNo,
          paragraph_end_no: chunk.paragraphEndNo,
          heading_path: chunk.headingPath,
          token_count: chunk.tokenCount,
          paragraph_ids: chunk.paragraphIds,
          chunk_metadata: {
            paragraph_orders: chunk.paragraphOrders,
            paragraph_count: chunk.paragraphIds.length,
          },
        })),
      },
      null,
      2,
    ),
    "utf-8",
  );
}

/**
 * 从数据库获取已存在的分块记录，用于增量索引
 */
async function fetchExistingChunks(
  database: ReturnType<typeof drizzle>,
  documentId: string,
): Promise<Map<string, ExistingChunkRow>> {
  const rows = await database
    .select({
      id: legalDocumentChunks.id,
      vectorId: legalDocumentChunks.vectorId,
      embeddingModelName: legalDocumentChunks.embeddingModelName,
      embeddingModelVersion: legalDocumentChunks.embeddingModelVersion,
      vectorProvider: legalDocumentChunks.vectorProvider,
    })
    .from(legalDocumentChunks)
    .where(eq(legalDocumentChunks.documentId, documentId));

  return new Map(rows.map((row) => [row.id, row]));
}

/**
 * 将文档与分块同步到关系数据库 (Drizzle)
 */
async function syncCanonicalRecords(input: {
  database: ReturnType<typeof drizzle>;
  document: NormalizedDocument;
  chunks: IndexedChunk[];
}) {
  const { database, document, chunks } = input;

  await database.transaction(async (tx) => {
    // 插入或更新文档记录
    await tx
      .insert(legalDocuments)
      .values({
        id: document.id,
        sourceType: document.source_type,
        sourceUrl: document.source_url,
        externalSourceId: document.external_source_id,
        title: document.title,
        neutralCitation: document.neutral_citation,
        parallelCitation: document.parallel_citation,
        court: document.court,
        jurisdiction: document.jurisdiction,
        decisionDate: document.decision_date,
        judges: document.judges,
        parties: document.parties,
        documentType: document.document_type,
        language: document.language,
        docketNumber: document.docket_number,
        summaryText: document.summary_text,
        fullText: document.full_text,
        rawText: document.raw_text,
        textChecksum: document.text_checksum,
        parseStatus: document.parse_status,
        indexingStatus: "chunked",
        isActive: true,
        importedAt: new Date().toISOString(),
      })
      .onConflictDoUpdate({
        target: legalDocuments.id,
        set: {
          sourceType: document.source_type,
          sourceUrl: document.source_url,
          externalSourceId: document.external_source_id,
          title: document.title,
          neutralCitation: document.neutral_citation,
          parallelCitation: document.parallel_citation,
          court: document.court,
          jurisdiction: document.jurisdiction,
          decisionDate: document.decision_date,
          judges: document.judges,
          parties: document.parties,
          documentType: document.document_type,
          language: document.language,
          docketNumber: document.docket_number,
          summaryText: document.summary_text,
          fullText: document.full_text,
          rawText: document.raw_text,
          textChecksum: document.text_checksum,
          parseStatus: document.parse_status,
          indexingStatus: "chunked",
          isActive: true,
          importedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      });

    // 清理旧的段落与分块记录
    await tx
      .delete(legalDocumentParagraphs)
      .where(eq(legalDocumentParagraphs.documentId, document.id));

    await tx
      .delete(legalDocumentChunks)
      .where(eq(legalDocumentChunks.documentId, document.id));

    // 批量插入段落
    await tx.insert(legalDocumentParagraphs).values(
      document.paragraphs.map((paragraph) => ({
        id: paragraph.id,
        documentId: document.id,
        sectionId: paragraph.section_id,
        paragraphNo: paragraph.paragraph_no,
        paragraphOrder: paragraph.paragraph_order,
        paragraphText: paragraph.paragraph_text,
        charStart: paragraph.char_start,
        charEnd: paragraph.char_end,
        tokenCount: paragraph.token_count ?? estimateTokens(paragraph.paragraph_text),
      })),
    );

    // 批量插入分块
    await tx.insert(legalDocumentChunks).values(
      chunks.map((chunk) => ({
        id: chunk.id,
        documentId: chunk.documentId,
        sectionId: chunk.sectionId,
        chunkIndex: chunk.chunkIndex,
        chunkType: chunk.chunkType,
        chunkText: chunk.chunkText,
        paragraphStartNo: chunk.paragraphStartNo,
        paragraphEndNo: chunk.paragraphEndNo,
        headingPath: chunk.headingPath,
        tokenCount: chunk.tokenCount,
        embeddingModelName: chunk.embeddingModelName,
        embeddingModelVersion: chunk.embeddingModelVersion,
        vectorProvider: chunk.vectorProvider,
        vectorId: chunk.vectorId,
        chunkMetadata: {
          paragraph_ids: chunk.paragraphIds,
          paragraph_orders: chunk.paragraphOrders,
          paragraph_count: chunk.paragraphIds.length,
        },
        isActive: true,
      })),
    );
  });
}

/**
 * 请求 API 生成文本嵌入
 */
async function requestEmbedding(
  config: RuntimeConfig,
  model: string,
  text: string,
): Promise<number[]> {
  if (!config.geminiApiKey) {
    throw new Error("GEMINI_API_KEY is required for embedding generation");
  }

  const response = await fetch(
    `${config.geminiApiBaseUrl}/models/${model}:embedContent`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-goog-api-key": config.geminiApiKey,
      },
      body: JSON.stringify({
        model: `models/${model}`,
        content: {
          parts: [{ text }],
        },
        ...(config.geminiEmbeddingOutputDimensionality
          ? {
              outputDimensionality:
                config.geminiEmbeddingOutputDimensionality,
            }
          : {}),
      }),
    },
  );

  if (!response.ok) {
    const textBody = await response.text();
    throw new Error(
      `Embedding request failed for model ${model} with status ${response.status}: ${textBody}`,
    );
  }

  const json = (await response.json()) as {
    embedding?: { values?: number[] };
  };
  const values = json.embedding?.values ?? [];
  if (values.length === 0) {
    throw new Error("Embedding response did not include values");
  }
  return values;
}

/**
 * 封装嵌入请求，包含模型回退逻辑
 */
async function embedText(
  config: RuntimeConfig,
  text: string,
): Promise<{ values: number[]; modelName: string }> {
  try {
    return {
      values: await requestEmbedding(config, config.geminiEmbeddingModel, text),
      modelName: config.geminiEmbeddingModel,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (
      config.geminiEmbeddingModel !== "gemini-embedding-001" &&
      message.includes("status 404")
    ) {
      return {
        values: await requestEmbedding(config, "gemini-embedding-001", text),
        modelName: "gemini-embedding-001",
      };
    }
    throw error;
  }
}

function pineconeBaseUrl(indexHost: string): string {
  if (indexHost.startsWith("http://") || indexHost.startsWith("https://")) {
    return indexHost.replace(/\/$/, "");
  }
  return `https://${indexHost.replace(/\/$/, "")}`;
}

/**
 * 构建 Pinecone 向量元数据
 */
function buildPineconeMetadata(document: NormalizedDocument, chunk: IndexedChunk) {
  return Object.fromEntries(
    Object.entries({
      chunk_id: chunk.id,
      document_id: document.id,
      title: document.title,
      neutral_citation: document.neutral_citation,
      court: document.court,
    jurisdiction: document.jurisdiction,
    decision_date: document.decision_date,
    document_type: document.document_type,
    paragraph_start_no: chunk.paragraphStartNo,
      paragraph_end_no: chunk.paragraphEndNo,
      heading_path: chunk.headingPath,
      source_path: document.source_path,
    }).filter(([, value]) => value !== null),
  );
}

/**
 * 将向量批量上传到 Pinecone
 */
async function upsertPineconeVectors(input: {
  config: RuntimeConfig;
  vectors: PineconeVector[];
}) {
  if (!input.config.pineconeApiKey) {
    throw new Error("PINECONE_API_KEY is required for Pinecone upsert");
  }
  if (!input.config.pineconeIndexHost) {
    throw new Error("PINECONE_INDEX_HOST is required for Pinecone upsert");
  }

  const response = await fetch(`${pineconeBaseUrl(input.config.pineconeIndexHost)}/vectors/upsert`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "api-key": input.config.pineconeApiKey,
      "x-pinecone-api-version": PINECONE_API_VERSION,
    },
    body: JSON.stringify({
      vectors: input.vectors,
      namespace: input.config.pineconeNamespace,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Pinecone upsert failed with status ${response.status}: ${text}`);
  }

  return (await response.json()) as { upsertedCount?: number };
}

/**
 * 更新数据库中分块的向量状态与索引状态
 */
async function updateChunkVectorState(input: {
  database: ReturnType<typeof drizzle>;
  documentId: string;
  chunks: IndexedChunk[];
  indexingStatus: "chunked" | "embedded" | "indexed";
}) {
  const { database, documentId, chunks, indexingStatus } = input;
  await database.transaction(async (tx) => {
    for (const chunk of chunks) {
      await tx
        .update(legalDocumentChunks)
        .set({
          vectorId: chunk.vectorId,
          embeddingModelName: chunk.embeddingModelName,
          embeddingModelVersion: chunk.embeddingModelVersion,
          vectorProvider: chunk.vectorProvider,
          updatedAt: new Date().toISOString(),
        })
        .where(
          and(
            eq(legalDocumentChunks.documentId, documentId),
            eq(legalDocumentChunks.id, chunk.id),
          ),
        );
    }

    await tx
      .update(legalDocuments)
      .set({
        indexingStatus,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(legalDocuments.id, documentId));
  });
}

/**
 * 处理单个文档的索引全流程
 */
async function processDocument(input: {
  database: ReturnType<typeof drizzle> | null;
  document: NormalizedDocument;
  options: CliOptions;
  config: RuntimeConfig;
}) {
  const { database, document, options, config } = input;
  
  // 1. 分块
  const existingById =
    database && !options.dryRun
      ? await fetchExistingChunks(database, document.id)
      : new Map<string, ExistingChunkRow>();
  const chunks = buildChunks(document, existingById, options, config);

  await writeChunkSnapshot(document, chunks, options.chunkOutputDir);
  log(
    `Built ${chunks.length} chunks for ${document.id} (${document.title})`,
    true,
    options,
  );

  if (!database || options.dryRun) {
    return {
      chunks,
      embeddedCount: 0,
      indexed: false,
    };
  }

  // 2. 同步关系数据库记录
  await syncCanonicalRecords({ database, document, chunks });

  // 3. 筛选需要生成向量的分块
  const chunksNeedingVectors = chunks.filter((chunk) => {
    if (options.skipEmbeddings || options.skipPinecone) {
      return false;
    }
    if (options.forceReembed) {
      return true;
    }
    if (options.onlyMissingVectors) {
      return !chunk.vectorId;
    }
    return !chunk.vectorId;
  });

  if (chunksNeedingVectors.length === 0) {
    const indexed = chunks.every((chunk) => Boolean(chunk.vectorId));
    await updateChunkVectorState({
      database,
      documentId: document.id,
      chunks,
      indexingStatus: indexed ? "indexed" : "chunked",
    });
    return {
      chunks,
      embeddedCount: 0,
      indexed,
    };
  }

  // 4. 生成嵌入向量并同步 Pinecone
  const vectors: PineconeVector[] = [];
  for (const chunk of chunksNeedingVectors) {
    const embedding = await embedText(config, chunk.chunkText);
    chunk.vectorId = chunkVectorId(chunk.id, embedding.modelName);
    chunk.embeddingModelName = embedding.modelName;
    chunk.embeddingModelVersion = "v1";
    chunk.vectorProvider = "pinecone";
    vectors.push({
      id: chunk.vectorId,
      values: embedding.values,
      metadata: buildPineconeMetadata(document, chunk),
    });
  }

  const upsertResponse = await upsertPineconeVectors({ config, vectors });
  log(
    `Upserted ${upsertResponse.upsertedCount ?? vectors.length} vectors for ${document.id}`,
    true,
    options,
  );

  // 5. 更新索引状态为已完成
  const indexed = chunks.every((chunk) => Boolean(chunk.vectorId));
  await updateChunkVectorState({
    database,
    documentId: document.id,
    chunks,
    indexingStatus: indexed ? "indexed" : "embedded",
  });

  return {
    chunks,
    embeddedCount: vectors.length,
    indexed,
  };
}

/**
 * 脚本主函数入口
 */
async function main() {
  await loadLocalEnvFile();
  const options = parseArgs(process.argv.slice(2));
  const config = loadRuntimeConfig();
  
  // 1. 扫描文件
  const files = await discoverNormalizedFiles(options);

  if (files.length === 0) {
    throw new Error(`No normalized JSON files found under ${options.inputDir}`);
  }

  // 2. 环境预检
  const requiresDatabase = !options.dryRun;
  if (requiresDatabase && !config.databaseUrl) {
    throw new Error("DATABASE_URL is required unless --dry-run is used");
  }

  if (!options.skipEmbeddings && !options.skipPinecone && !config.geminiApiKey) {
    throw new Error("GEMINI_API_KEY is required unless --skip-embeddings or --skip-pinecone is used");
  }
  if (!options.skipPinecone && !config.pineconeApiKey) {
    throw new Error("PINECONE_API_KEY is required unless --skip-pinecone is used");
  }
  if (!options.skipPinecone && !config.pineconeIndexHost) {
    throw new Error("PINECONE_INDEX_HOST is required unless --skip-pinecone is used");
  }

  const sql = config.databaseUrl && !options.dryRun ? postgres(config.databaseUrl, { max: 1 }) : null;
  const database = sql ? drizzle(sql) : null;

  let processed = 0;
  let failures = 0;
  let totalChunks = 0;
  let embeddedChunks = 0;

  try {
    // 3. 循环处理每个文档
    for (const filePath of files) {
      try {
        const document = await readNormalizedDocument(filePath);
        log(`Indexing ${path.basename(filePath)}`, true, options);
        const result = await processDocument({
          database,
          document,
          options,
          config,
        });
        processed += 1;
        totalChunks += result.chunks.length;
        embeddedChunks += result.embeddedCount;
        log(
          `Completed ${document.id}: chunks=${result.chunks.length} embedded=${result.embeddedCount} indexed=${result.indexed}`,
          true,
          options,
        );
      } catch (error) {
        failures += 1;
        const message = error instanceof Error ? error.message : String(error);
        console.error(`Failed to index ${filePath}: ${message}`);
      }
    }
  } finally {
    await sql?.end();
  }

  log(
    `Finished offline indexing: processed=${processed} failures=${failures} chunks=${totalChunks} embedded=${embeddedChunks}`,
    true,
    options,
  );

  if (failures > 0) {
    process.exitCode = 1;
  }
}

void main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});
