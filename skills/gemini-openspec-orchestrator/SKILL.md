---
name: gemini-openspec-orchestrator
description: 当需要由 Gemini 作为总控代理，调用 Codex 通过 OpenSpec Skills 完成 propose、apply、测试验证、archive 全流程时使用。
---

# Gemini OpenSpec Orchestrator

## Purpose

这个 Skill 用于让 Gemini 作为总控代理执行整个 OpenSpec 开发闭环。

Gemini 不负责主要业务代码实现，而负责：

1. 调用 Codex 执行 propose
2. 调用 Codex 执行 apply
3. 读取当前 change 的 OpenSpec 文档
4. 基于需求文档生成测试用例
5. 执行测试
6. 只有测试通过后，调用 Codex 执行 archive

## Workflow

严格按以下顺序执行：

### Step 1: Propose

调用 shell：

```bash
bash scripts/codex_propose.sh <CHANGE_NAME>
```

### Step 2: Apply

调用 shell：

```
bash scripts/codex_apply.sh <CHANGE_NAME>
```

### Step 3: Read Specs

读取以下文件：

- AGENTS.md
- specs/project.md
- specs/changes/<CHANGE_NAME>/proposal.md
- specs/changes/<CHANGE_NAME>/spec.md
- specs/changes/<CHANGE_NAME>/design.md
- specs/changes/<CHANGE_NAME>/tasks.md

### Step 4: Generate Tests

根据当前 change 的需求文档和总项目文档生成或更新测试代码。

要求：

- 只编写测试代码
- 不修改生产代码，除非测试环境必需的小修正
- 测试说明和注释使用中文

### Step 5: Verify

调用 shell：

```
bash scripts/verify_change.sh
```

### Step 6: Archive

只有 verify 成功时，才允许调用：

```
bash scripts/codex_archive.sh <CHANGE_NAME>
```

## Pass / Fail Rule

### PASS

只有在以下条件全部满足时，才输出 PASS：

- propose 成功
- apply 成功
- 测试生成完成
- verify 成功
- archive 成功

### FAIL

出现以下任一情况时，必须输出 FAIL：

- propose 失败
- apply 失败
- 测试生成失败
- verify 失败
- archive 失败

并给出：

- 失败步骤
- 失败命令
- 失败原因

## Constraints

- 不允许更改 Codex 中已定义的 Skills 名称
- 必须使用以下既有名称：
  - $openspec-propos
  - $openspec-apply-change
  - $openspec-archive-change
- 所有 OpenSpec 文档必须保持中文
- Gemini 是总控代理，不负责主要业务实现
- Codex 是 OpenSpec 执行代理

## Output Format

最终只允许输出以下两类结论之一：

### PASS

```
PASS: <CHANGE_NAME> 已通过测试并完成归档
```

### FAIL

```
FAIL: <CHANGE_NAME> 未通过
步骤: <失败步骤>
命令: <失败命令>
原因: <失败原因>

```
