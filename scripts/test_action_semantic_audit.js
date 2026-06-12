"use strict";

const assert = require("assert");
const audit = require("../services/actionSemanticAudit");

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`ok ${name}`);
    passed += 1;
  } catch (error) {
    console.error(`fail ${name}`);
    console.error(error.message);
    failed += 1;
  }
}

test("generalized action rejects domain and tool leakage", () => {
  const result = audit.finalAudit({
    A_action: "For hardware roles, add PCB and debug evidence.",
    generalized_action: "Add PCB, circuit design, and debug evidence for hardware roles.",
    display_action_mode: "generalized",
    role_family: "hardware_electrical",
  }, { safe: false, confidence: 0.9, issues: ["generalized_domain_leak"] });
  assert.strictEqual(result.generalized_safe, false);
  assert.ok(result.action_semantic_review_issues.includes("generalized_domain_leak"));
  assert.strictEqual(result.action_semantic_review_status, "needs_manual_review");
});

test("raw action with domain terms is allowed when role scoped", () => {
  const result = audit.finalAudit({
    A_action: "For data analyst roles, keep SQL and Tableau evidence near the project bullet.",
    generalized_action: "Put target-role keywords next to concrete experience evidence.",
    display_action_mode: "grounded_raw",
    role_family: "data_analyst",
    target_roles: "data_analyst,business_analyst",
  }, { safe: true, confidence: 0.92, issues: [] });
  assert.strictEqual(result.raw_safe, true);
  assert.strictEqual(result.role_scope_valid, true);
  assert.strictEqual(result.action_semantic_review_status, "approved");
});

test("raw action with domain terms needs role scope", () => {
  const result = audit.finalAudit({
    A_action: "Add SQL and Tableau evidence near the project bullet.",
    generalized_action: "Put target-role keywords next to concrete experience evidence.",
    display_action_mode: "raw",
    role_family: "universal",
    target_roles: "universal",
  }, { safe: false, confidence: 0.86, issues: ["raw_domain_without_role_scope"] });
  assert.strictEqual(result.role_scope_valid, false);
  assert.ok(result.action_semantic_review_issues.includes("raw_domain_without_role_scope"));
});

test("case-specific raw action cannot stay raw mode", () => {
  const result = audit.finalAudit({
    A_action: "将Alpha Research项目拆分为两段，用VADER生成compound sentiment scores，再写MACD与NLP的结合。",
    generalized_action: "选择最贴近目标岗位的一段项目经历，按任务、方法和结果重写。",
    display_action_mode: "raw",
    role_family: "data_scientist",
  }, { safe: false, confidence: 0.95, issues: ["raw_case_specific_in_raw_mode"] });
  assert.strictEqual(result.case_leak_risk, true);
  assert.ok(result.action_semantic_review_issues.includes("raw_case_specific_in_raw_mode"));
});

test("section reorder and LinkedIn actions are precondition sensitive", () => {
  const reorder = audit.finalAudit({
    A_action: "调整简历结构顺序：Summary、Technical Skills、Work Experience，Education 往后放。",
    generalized_action: "根据目标岗位和已有经历，调整简历 section 顺序，让最相关的信息更靠前。",
    display_action_mode: "grounded_raw",
    role_family: "software_engineer",
  }, { safe: false, confidence: 0.76, issues: ["precondition_sensitive_action"] });
  assert.strictEqual(reorder.precondition_needed, true);
  assert.ok(reorder.precondition_types.includes("section_order"));

  const linkedIn = audit.finalAudit({
    A_action: "在简历头部补齐 LinkedIn 链接。",
    generalized_action: "补齐可验证资料入口，并确保链接可点击。",
    display_action_mode: "grounded_raw",
    role_family: "universal",
  }, { safe: false, confidence: 0.75, issues: ["precondition_sensitive_action"] });
  assert.strictEqual(linkedIn.precondition_needed, true);
  assert.ok(linkedIn.precondition_types.includes("profile_link_missing"));
});

console.log(`${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
