## Context

当前仓库已经存在一条 Python 离线导入流程，能够从 `Data/Source/` 读取 PDF，输出标准化 JSON，并将部分 canonical records 写入 PostgreSQL。`tools/README.md` 也明确说明当前实现“不写 embeddings 或 Pinecone records”。这与 `Doc/ProjectPRD.md` 中定义的目标数据流存在职责偏差：PRD 要求 Python 仅负责 PDF 提取与标准化，后续 chunking、embedding、PostgreSQL 写入与 Pinecone upsert 由 TypeScript 离线管道承担。

数据库现状进一步说明问题仍未闭环：`legal_documents` 与 `legal_document_chunks` 已有记录，但 `indexing_status` 仍停留在待处理状态，chunk 也没有对应向量标识。在线 Hono 后端已经把 Pinecone dense retrieval 视为 query-time 能力前提，因此离线索引链路必须独立、稳定、可重跑地补齐。

这个变更横跨标准化产物、离线索引脚本、数据库状态约定和 Pinecone 数据契约，属于典型的跨模块离线架构调整，需要先明确职责边界和幂等策略，再进入实现。

## Goals / Non-Goals

**Goals:**
- 建立一条独立的 TypeScript 离线索引管道，读取 Python 标准化 JSON 作为输入。
- 在 TypeScript 管道内完成 chunk 生成、canonical records 写入、embedding 生成和 Pinecone upsert。
- 定义文档与 chunk 的索引状态推进规则，保证数据库与 Pinecone 的状态一致性。
- 支持重复执行、部分失败恢复和最小可见性日志，避免“库里有 chunk 但不可检索”的半完成状态。
- 将 Python 离线流程职责收敛为标准化，不再继续扩张为在线服务或索引服务。

**Non-Goals:**
- 不在本变更中引入在线 ingestion、后台任务队列或异步调度系统。
- 不改变 Hono 在线检索接口的产品行为，只补齐其依赖的离线索引前置条件。
- 不在本变更中重做 PDF 解析算法、OCR 能力或复杂 section hierarchy 提取。
- 不要求在本变更中切换数据库主 schema，只基于现有 `legal_documents` 与 `legal_document_chunks` 结构扩展状态使用方式。

## Decisions

### 决策一：采用“Python 标准化 + TypeScript 索引”两阶段离线架构
选择将 Python 输出的标准化 JSON 作为阶段边界，TypeScript 管道只消费文件产物，不直接调用 Python 运行时。

原因：
- 这与 PRD 的职责划分完全一致，避免 Python 和 TypeScript 之间再次出现索引职责重叠。
- JSON 产物天然适合作为可检查、可复跑、可比对的中间层，便于问题定位。
- 在线系统已经以 TypeScript 为主，embedding、Pinecone、Drizzle/数据库契约在 TypeScript 中复用成本更低。

备选方案：
- 继续扩展 Python 管道直到包含 embedding 与 Pinecone upsert。未采用，因为这会继续违背 PRD 的边界，并让索引逻辑分散在两种语言栈中。
- 由 Hono 后端在运行时补建索引。未采用，因为 PRD 明确排除了在线 ingestion，且这会把一次性离线工作变成请求路径风险。

### 决策二：TypeScript 管道以标准化 JSON 为源，重新生成检索 chunk
TypeScript 管道不依赖 Python 预先生成的 chunk 快照作为唯一真源，而是以标准化 JSON 中的段落结构重新执行 chunking，并将结果写入数据库与快照产物。

原因：
- chunking 规则属于检索层能力，应和 embedding 与 Pinecone 数据契约放在同一条 TypeScript 管道内统一维护。
- 这样可以确保 chunk 规则变化时，只需重跑 TypeScript 索引，不必重新解析 PDF。
- 标准化 JSON 的稳定性高于下游 chunk 快照，适合作为离线重建输入。

备选方案：
- 直接消费 Python 已输出的 chunk JSON。未作为主方案，因为这会把 chunk 规则继续绑定在 Python 侧，无法彻底完成职责迁移。

### 决策三：以稳定标识和状态推进支持幂等与恢复
文档与 chunk 的主键或稳定标识必须从标准化输入中可确定地推导，TypeScript 管道对 PostgreSQL 写入使用 upsert，对 Pinecone upsert 使用稳定 `vector_id` 或可重建的命名规则，并在数据库中维护可识别的索引状态。

原因：
- 当前问题不是“能否跑一次”，而是“失败后能否不制造脏数据地重跑”。
- 稳定标识是避免重复 chunk、重复向量、错配引用的基础。
- 状态推进能让排障直接回答“还没做”“做了一半”“已完成”这三类问题。

建议状态模型：
- 文档级：`pending` -> `chunked` -> `embedded` -> `indexed`，失败时进入受控失败状态或保留上一步成功状态并记录错误。
- chunk 级：至少能区分“已写入数据库但未生成向量”和“已 upsert Pinecone”。

备选方案：
- 仅依赖是否存在 `vector_id` 推断状态。未采用，因为这不足以表达部分失败、重试中或受控覆盖等场景。

### 决策四：将 Pinecone 元数据设计为在线检索直连契约
Pinecone 记录中必须带上 `document_id`、`chunk_id`、`paragraph_start_no`、`paragraph_end_no`、`title`、`neutral_citation` 等最小检索与回显字段，使在线混合检索无需依赖额外不可追踪的映射层。

原因：
- AGENTS 与 PRD 都要求每个答案可追溯到 `document_id`、`chunk_id` 和 paragraph range。
- Pinecone 召回后的 merge/rerank 需要足够元数据，才能与 PostgreSQL lexical 结果对齐。
- 明确元数据契约可以减少后续在线后端改动。

备选方案：
- Pinecone 只存 `chunk_id`，其余信息全部在线回表查询。未完全采用，因为虽然回表仍然需要，但只有 `chunk_id` 会让检索调试和异常排查成本过高。

### 决策五：离线索引命令必须支持分阶段执行与失败摘要
TypeScript CLI 至少应支持完整执行模式，并保留按阶段调试的扩展空间，例如仅 chunk、仅 embedding、仅 Pinecone upsert 或从失败项恢复。

原因：
- 索引链路涉及外部依赖，最常见问题不是逻辑错误，而是配置、限流和网络失败。
- 分阶段执行能缩短调试回路，也方便在数据已经写入 PostgreSQL 时只补 Pinecone。

备选方案：
- 只提供单一全量命令。未完全采用，因为它对首版最简单，但不利于恢复和运维。

## Risks / Trade-offs

- [风险] Python 现有导入流程已经把 chunk 写入 PostgreSQL，迁移期间可能出现双源 chunk 规则不一致
  → 缓解：以标准化 JSON 为唯一上游输入，明确 TypeScript 产物为后续唯一索引来源，并在实现时收敛 Python 对 chunk/PostgreSQL 的职责

- [风险] 现有库表字段对状态表达不足，可能难以准确标记 embedding 与 Pinecone upsert 的中间态
  → 缓解：优先复用现有 `indexing_status`、`vector_id`、`is_active` 字段；若不足，再通过小范围 schema 对齐变更补充

- [风险] embedding 模型或 Pinecone 配置变更会导致历史向量与新向量混用
  → 缓解：在 chunk 记录中保存 `embedding_model_name`、`embedding_model_version`、`vector_provider`，并在重跑时显式比较

- [风险] Pinecone upsert 成功但数据库状态更新失败，会形成“向量已存在、数据库未完成”的不一致
  → 缓解：日志中输出逐项结果，优先使用可重建的 `vector_id`，允许重跑时做幂等覆盖并修正状态

- [风险] 为了幂等而增加状态与校验，会提高实现复杂度
  → 缓解：首版先定义最小状态推进和错误摘要，避免一开始引入过度复杂的调度系统

## Migration Plan

1. 保留现有 Python 标准化能力，确认其输出 JSON 结构可被 TypeScript 稳定消费。
2. 新增 TypeScript 离线索引命令，先在单文档样本上完成 chunking、数据库写入与 Pinecone upsert。
3. 为现有文档重跑离线索引，修复 `indexing_status` 与 `vector_id` 缺失问题。
4. 验证在线 Hono 检索链路可以消费新索引结果，并检查回答中的 `document_id`、`chunk_id` 和段落范围可回溯。
5. 收敛 Python 导入脚本职责，移除或停用其中与 chunk/PostgreSQL 写入重复的部分。

回滚策略：
- 若 TypeScript 索引实现不稳定，可暂时保留 Python 标准化输出作为唯一完成阶段，不启用新的 Pinecone 写入步骤。
- 若 Pinecone 元数据契约有误，可通过稳定 `vector_id` 对同批数据执行覆盖 upsert，而无需重新解析 PDF。

## Open Questions

- 现有数据库 schema 是否已经足够表达 chunk 级索引状态，还是需要补充专用状态字段。
- TypeScript 索引脚本应放在 `tools/` 还是 `packages/` 中，以便最大化复用数据库与 AI 客户端代码。
- embedding 提供方在 MVP 中是否固定为单一模型，还是需要在离线索引阶段支持可配置切换。
- 对历史由 Python 写入的 chunk 数据，是原地覆盖、增量迁移，还是先清理后重建更稳妥。
