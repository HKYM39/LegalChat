## ADDED Requirements

### Requirement: 离线流程必须读取并标准化法律 PDF 文档
系统 MUST 提供一条离线 Python 流程，能够扫描 `Data/Source/` 目录中的法律 PDF 文件，抽取文本并生成统一的标准化文档结构，至少包含文档标题、来源文件、法院、裁判日期、案号或引用以及正文内容。

#### Scenario: 从源目录发现并处理 PDF
- **WHEN** 开发者执行离线导入脚本
- **THEN** 系统会遍历 `Data/Source/` 下的 PDF 文件并为每份文件生成标准化文档对象

### Requirement: 离线流程必须保留段落级可追溯结构
系统 MUST 在标准化输出中保留段落顺序、段落编号或可推导顺序标识，并确保每段正文可以映射回所属文档与原始顺序位置，为后续 chunk 生成与证据引用提供基础。

#### Scenario: 生成段落记录
- **WHEN** 系统完成单份法律文档的文本标准化
- **THEN** 输出结果中包含按顺序排列的段落记录，并且每条记录都能关联到文档标识和段落位置

### Requirement: 离线流程必须生成与数据库兼容的 chunk 记录
系统 MUST 基于段落级结构生成适用于检索的 chunk 记录，并为每个 chunk 保留稳定 `chunk_id`、所属 `document_id` 以及段落起止范围，使其能够与 PostgreSQL 中的 canonical records 对齐。

#### Scenario: 基于相邻段落生成 chunk
- **WHEN** 系统根据标准化段落构建检索 chunk
- **THEN** 每个 chunk 都会记录 chunk 文本、段落起止范围和所属文档标识

### Requirement: 离线流程必须将标准化结果写入 PostgreSQL
系统 MUST 提供 PostgreSQL 导入能力，将标准化后的文档、段落和 chunk 数据写入现有数据库表，并在重复执行时避免为同一文档生成不可控的重复记录。

#### Scenario: 导入 canonical records
- **WHEN** 开发者在数据库连接配置有效的环境中执行导入
- **THEN** `legal_documents`、`legal_document_paragraphs` 与 `legal_document_chunks` 中会写入与标准化结果一致的记录

### Requirement: 离线流程必须提供基础校验与失败可见性
系统 MUST 在执行过程中报告解析失败、必填字段缺失、段落范围异常或数据库写入失败等问题，并输出足以定位问题的日志或校验结果，而不是静默跳过。

#### Scenario: 处理异常文档
- **WHEN** 某份 PDF 无法被正确解析或写入数据库
- **THEN** 系统会记录失败原因和对应文件信息，并继续按可配置策略终止或跳过处理
