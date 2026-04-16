## 背景与动机

当前项目已经具备 Hono 在线服务、Drizzle 数据库模型与 PostgreSQL 初始化脚本，但离线侧还缺少一条可复用的 Python 文档处理与导入链路。`Data/Source/` 下已经存在一批澳洲高院 PDF 判例，如果不能把它们稳定转换为结构化记录并导入数据库，在线检索、证据引用与答案溯源能力就无法形成可验证的数据基线。

## 变更内容

- 新增一套离线 Python 处理流程，读取 `Data/Source/` 下的法律 PDF，抽取文本并输出标准化中间结果。
- 基于法律文档结构保留标题、案号、法院、裁判日期、段落编号、正文内容等元数据，并为后续 chunk 生成保留稳定标识。
- 新增 PostgreSQL 导入能力，将标准化结果写入 `legal_documents`、`legal_document_paragraphs`、`legal_document_chunks` 等核心表。
- 为离线处理增加基础校验与执行入口，确保导入结果可追溯到 `document_id`、`chunk_id` 与段落范围。

## 能力范围

### 新增能力
- `offline-legal-document-import`: 定义离线 Python 对法律 PDF 的标准化处理、分段分块与 PostgreSQL 导入能力。

### 变更能力

无

## 影响范围

- 影响代码：`tools/` 下新增或扩展 Python 脚本、配置与示例输出目录。
- 影响数据：`Data/Source/` 中的 PDF 将被转换为标准化结构，并写入 PostgreSQL。
- 影响系统：离线导入链路将成为在线 Hono 检索与回答能力的语料准备前置步骤。
- 影响依赖：可能需要引入 PDF 解析与 PostgreSQL 连接的 Python 依赖，但不引入任何在线 Python API。
