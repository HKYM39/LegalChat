## MODIFIED Requirements

### Requirement: 离线流程必须读取并标准化法律 PDF 文档
系统 MUST 提供一条离线 Python 流程，能够扫描 `Data/Source/` 目录中的法律 PDF 文件，抽取文本并生成统一的标准化文档结构，至少包含文档标题、来源文件、法院、裁判日期、案号或引用以及正文内容。该流程 MUST 以标准化 JSON 作为主要输出，供后续 TypeScript 离线索引管道继续处理。

#### Scenario: 从源目录发现并处理 PDF
- **WHEN** 开发者执行离线导入脚本
- **THEN** 系统会遍历 `Data/Source/` 下的 PDF 文件并为每份文件生成标准化文档对象与对应 JSON 输出

### Requirement: 离线流程必须保留段落级可追溯结构
系统 MUST 在标准化输出中保留段落顺序、段落编号或可推导顺序标识，并确保每段正文可以映射回所属文档与原始顺序位置，为后续 TypeScript chunk 生成、向量索引和证据引用提供基础。

#### Scenario: 生成段落记录
- **WHEN** 系统完成单份法律文档的文本标准化
- **THEN** 输出结果中包含按顺序排列的段落记录，并且每条记录都能关联到文档标识和段落位置

### Requirement: 离线流程必须输出供 TypeScript 索引阶段消费的稳定结构
系统 MUST 输出能够被 TypeScript 离线索引管道稳定读取的标准化 JSON 结构，至少包含文档元数据、正文段落、来源标识和可用于生成稳定标识的字段。Python 流程 MUST NOT 直接承担 chunk 生成、embedding 生成、PostgreSQL 写入或 Pinecone upsert 职责。

#### Scenario: 标准化输出交接给 TypeScript 管道
- **WHEN** Python 标准化流程成功完成
- **THEN** 产物可被后续 TypeScript 索引命令直接读取，并且无需 Python 额外执行数据库或向量写入步骤

### Requirement: 离线流程必须提供基础校验与失败可见性
系统 MUST 在执行过程中报告解析失败、必填字段缺失、段落范围异常或标准化输出生成失败等问题，并输出足以定位问题的日志或校验结果，而不是静默跳过。

#### Scenario: 处理异常文档
- **WHEN** 某份 PDF 无法被正确解析或生成标准化输出
- **THEN** 系统会记录失败原因和对应文件信息，并继续按可配置策略终止或跳过处理
