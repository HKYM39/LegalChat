import assert from "node:assert/strict";
import test from "node:test";

import {
  INPUT_SECURITY_ERROR_CODE,
  MAX_CHAT_INPUT_LENGTH,
  isInputSecurityViolation,
  validateUserInputSecurity,
} from "./index.ts";

test("允许正常法律研究问题通过输入安全校验", () => {
  const result = validateUserInputSecurity(
    "在加拿大侵权法中，duty of care 的两步测试是什么？",
  );

  assert.equal(result.allowed, true);
  assert.equal(result.normalizedInput, "在加拿大侵权法中，duty of care 的两步测试是什么？");
  assert.deepEqual(result.matchedSignals, []);
});

test("拒绝空白输入", () => {
  const result = validateUserInputSecurity("  \n\t  ");

  assert.equal(result.allowed, false);
  assert.equal(result.violation.reasonCode, "blank_input");
  assert.equal(result.violation.code, INPUT_SECURITY_ERROR_CODE);
});

test("允许边界长度输入并拒绝超长输入", () => {
  const allowed = validateUserInputSecurity("a".repeat(MAX_CHAT_INPUT_LENGTH));
  const rejected = validateUserInputSecurity("a".repeat(MAX_CHAT_INPUT_LENGTH + 1));

  assert.equal(allowed.allowed, true);
  assert.equal(rejected.allowed, false);
  assert.equal(rejected.violation.reasonCode, "input_too_long");
});

test("拒绝包含控制字符的输入", () => {
  const result = validateUserInputSecurity("What is duty of care?\u0000");

  assert.equal(result.allowed, false);
  assert.equal(result.violation.reasonCode, "control_characters_detected");
});

test("拒绝明显的脚本注入片段", () => {
  const result = validateUserInputSecurity(
    "<script>alert('xss')</script> 请总结这个案例",
  );

  assert.equal(result.allowed, false);
  assert.equal(result.violation.reasonCode, "script_injection_detected");
  assert.ok(result.matchedSignals.includes("script_tag"));
});

test("拒绝明显的协议探测载荷", () => {
  const result = validateUserInputSecurity(
    "GET /admin HTTP/1.1\nHost: localhost\nUser-Agent: curl/8.0",
  );

  assert.equal(result.allowed, false);
  assert.equal(result.violation.reasonCode, "protocol_probe_detected");
  assert.ok(result.matchedSignals.includes("http_request_line"));
});

test("拒绝明显的注入或路径探测片段", () => {
  const sqlProbe = validateUserInputSecurity(
    "' UNION SELECT password FROM users --",
  );
  const pathProbe = validateUserInputSecurity("../../../../etc/passwd");
  const templateProbe = validateUserInputSecurity("{{7*7}}");

  assert.equal(sqlProbe.allowed, false);
  assert.equal(sqlProbe.violation.reasonCode, "injection_probe_detected");
  assert.equal(pathProbe.allowed, false);
  assert.equal(templateProbe.allowed, false);
  assert.ok(isInputSecurityViolation(templateProbe.violation));
});
