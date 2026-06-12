"use strict";

const assert = require("assert");

const governance = require("../services/actionGovernance");
const titleGovernance = require("../services/titleGovernance");
const {
  canAddToTwelveAdviceBundle,
  canonicalActionFamilyOf,
  actionDepthOf,
  isGovernedAdviceDisplayable,
  selectFreeAdvice,
  selectTopAdviceForMentor,
} = require("../services/mentorAdviceRetrieval");

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ok ${name}`);
    passed += 1;
  } catch (error) {
    console.error(`  fail ${name}`);
    console.error(`       ${error.message}`);
    failed += 1;
  }
}

console.log("\nAction governance policy");

test("Risk Consulting raw action is allowed for matching risk context", () => {
  const card = {
    A_action: "针对Risk Consulting方向，将Python、statistical modeling等技术描述弱化，突出internal control、RCSA、control framework、process improvement、governance、regulatory compliance等关键词。",
    display_action_mode: "grounded_raw",
    activation_role_family: "risk_consulting",
    activation_keywords: "Risk Consulting,RCSA,internal control",
    generalized_action: "根据目标岗位重新分配简历叙事重点。",
  };
  const result = governance.resolveDisplayAction(card, {
    roleFamily: "risk_consulting",
    targetRole: "Risk Consulting Analyst",
    jdText: "Risk Consulting work includes RCSA and internal control testing.",
  });
  assert.strictEqual(result.allowed, true);
  assert.strictEqual(result.usedMode, "raw");
  assert.ok(result.action.includes("RCSA"));
});

test("Risk Consulting raw action falls back to generalized for Management Trainee", () => {
  const card = {
    A_action: "针对Risk Consulting方向，将Python、statistical modeling等技术描述弱化，突出internal control、RCSA、control framework、process improvement、governance、regulatory compliance等关键词。",
    display_action_mode: "grounded_raw",
    activation_role_family: "risk_consulting",
    activation_keywords: "Risk Consulting,RCSA,internal control",
    generalized_action: "根据目标岗位重新分配简历叙事重点，把经历改写为目标 JD 的核心职责和结果证据。",
  };
  const result = governance.resolveDisplayAction(card, {
    roleFamily: "business",
    targetRole: "Management Trainee",
    jdText: "Rotate through departments and assist managers with process improvement.",
  });
  assert.strictEqual(result.allowed, true);
  assert.strictEqual(result.usedMode, "generalized");
  assert.ok(!result.action.includes("RCSA"));
});

test("Management Trainee context blocks role-specific raw actions from unrelated finance tracks", () => {
  const context = {
    roleFamily: "business",
    targetRole: "Management Trainee",
    jdText: "Rotate through operations, sales, finance, and customer service. Assist managers, analyze data, create reports, and suggest process improvements.",
    resumeText: "Biostatistics graduate with CDISC data mapping, SDTM and ADaM datasets, reporting, teamwork, and communication experience.",
  };
  const cards = [
    {
      A_action: "针对Risk Consulting方向，将经历改为突出internal control、RCSA、control framework、governance、regulatory compliance等关键词。",
      display_action_mode: "grounded_raw",
      activation_role_family: "risk_consulting",
      activation_keywords: "Risk Consulting,RCSA,internal control,control framework",
      generalized_action: "根据目标岗位重新分配简历叙事重点，把经历改写为目标 JD 的核心职责、协作对象和结果证据。",
    },
    {
      A_action: "针对FA岗位，保留简历内容真实，不必过度夸大成就，聚焦Financial Advisor要求即可。",
      display_action_mode: "grounded_raw",
      activation_role_family: "finance",
      activation_keywords: "Financial Advisor,FA,Financial Analyst",
      generalized_action: "围绕目标岗位保持真实匹配，把最相关的分析、沟通、报告或客户协作经验写清楚。",
    },
    {
      A_action: "阅读JD时重点提取trading book、limits monitoring、risk profile等风险岗位关键词。",
      display_action_mode: "grounded_raw",
      activation_role_family: "trading_quant",
      activation_keywords: "trading book,limits monitoring,risk profile",
      generalized_action: "阅读 JD 时优先提取具体职责和高频能力词，再把真实掌握的关键词写进对应经历证据中。",
    },
  ];
  for (const card of cards) {
    const result = governance.resolveDisplayAction(card, context);
    assert.strictEqual(result.allowed, true);
    assert.strictEqual(result.usedMode, "generalized");
    assert.ok(!/RCSA|control framework|Financial Advisor|trading book|limits monitoring|risk profile/i.test(result.action), result.action);
  }
});

test("Alpha Research case-specific action is excluded without generalized action", () => {
  const card = {
    A_action: "将Alpha Research项目拆分为两段，第一段专写NLP pipeline，用VADER生成compound sentiment scores，第二段写MACD与NLP的结合。",
    display_action_mode: "grounded_raw",
    grounding_terms: "Alpha Research,VADER,MACD",
  };
  const result = governance.resolveDisplayAction(card, {
    resumeText: "CDISC Data Mapping Project. Converted SDTM datasets into ADaM datasets.",
    jdText: "Management Trainee role.",
  });
  assert.strictEqual(result.allowed, false);
});

test("Management Trainee context does not show Alpha Research / VADER / MACD raw action", () => {
  const result = governance.resolveDisplayAction({
    A_action: "将Alpha Research项目拆分为两段：第一段专写NLP pipeline，用VADER生成compound sentiment scores；第二段写MACD与NLP的结合。",
    display_action_mode: "grounded_raw",
    grounding_terms: "Alpha Research,NLP,VADER,MACD",
    generalized_action: "选择最贴近目标岗位的一段项目经历，按任务背景、方法工具、分析过程和结果意义重写，避免只列工具名。",
  }, {
    roleFamily: "business",
    targetRole: "Management Trainee",
    jdText: "Rotate through departments, assist managers, analyze data, create reports, and suggest process improvements.",
    resumeText: "CDISC Data Mapping Project. Converted SDTM datasets into ADaM datasets and prepared validation reports.",
  });
  assert.strictEqual(result.allowed, true);
  assert.strictEqual(result.usedMode, "generalized");
  assert.ok(!/Alpha Research|VADER|MACD/i.test(result.action), result.action);
});

test("same canonical family can appear twice only with different action depth", () => {
  const existing = [{
    canonicalActionFamily: "summary_positioning",
    actionDepth: "diagnose",
    title: "Let Summary point to target role",
  }];
  assert.strictEqual(canAddToTwelveAdviceBundle({
    canonicalActionFamily: "summary_positioning",
    actionDepth: "diagnose",
  }, existing), false);
  assert.strictEqual(canAddToTwelveAdviceBundle({
    canonicalActionFamily: "summary_positioning",
    actionDepth: "rewrite",
  }, existing), true);
  assert.strictEqual(canAddToTwelveAdviceBundle({
    canonicalActionFamily: "summary_positioning",
    actionDepth: "proof",
  }, [...existing, { canonicalActionFamily: "summary_positioning", actionDepth: "rewrite" }]), false);
});

test("legacy free selector rejects governance-excluded cards", () => {
  const candidates = [
    {
      adviceId: "seg_alpha",
      unlockTier: "free",
      safeToShowFree: true,
      adviceScope: "resume_edit",
      adviceIntent: "experience_evidence",
      A_action: "将Alpha Research项目拆分为两段，用VADER生成compound sentiment scores，再写MACD与NLP的结合。",
      display_action_mode: "exclude",
      relatedProblemTags: ["weak_experience_keyword_evidence"],
    },
    {
      adviceId: "seg_safe",
      unlockTier: "free",
      safeToShowFree: true,
      adviceScope: "resume_edit",
      adviceIntent: "experience_evidence",
      actionSummary: "挑选一段最相关经历，把 bullet 改成任务、方法和结果三部分。",
      display_action_mode: "raw",
      relatedProblemTags: ["weak_experience_keyword_evidence"],
    },
  ];
  const selected = selectFreeAdvice(candidates, {
    targetRole: "Management Trainee",
    queryText: "Rotate through departments and assist managers.",
  });
  assert.strictEqual(selected.adviceId, "seg_safe");
});

test("case-specific generalized cards use safe mentor and HR perspectives", () => {
  const bucket = {
    cards: [{
      adviceId: "seg_alpha_generalized",
      adviceScope: "resume_edit",
      adviceIntent: "experience_evidence",
      action_specificity: "case_specific",
      display_action_mode: "generalized",
      generalized_action: "把项目经历按任务、方法和结果重写，确保每条 bullet 都能证明一个岗位相关能力。",
      canonical_action_family: "experience_evidence",
      action_depth: "evidence",
      relatedProblemTags: ["weak_experience_keyword_evidence"],
      P_mentor: "Alpha Research 项目要展开 VADER 和 MACD，否则技术深度不够。",
      I_insight: "VADER sentiment score 和 MACD 结合能体现 NLP finance 项目深度。",
      HR_os: "我会追问 Alpha Research 里的 VADER 和 MACD。",
    }],
  };
  const [item] = selectTopAdviceForMentor(
    bucket,
    [{ tag: "weak_experience_keyword_evidence", severity: "high" }],
    1,
    new Set(),
    { resumeText: "Management Trainee project experience.", jdText: "Assist managers and analyze reports." }
  );
  const rendered = [item.action, item.mentorLens, item.reason, item.hrPerspective].join(" ");
  assert.ok(item.action.includes("任务"));
  assert.ok(!/Alpha|VADER|MACD/i.test(rendered), rendered);
});

test("role-specific generalized fallback also suppresses raw mentor and HR perspectives", () => {
  const bucket = {
    cards: [{
      adviceId: "seg_risk_generalized",
      adviceScope: "resume_edit",
      adviceIntent: "jd_keyword_alignment",
      action_specificity: "role_specific",
      display_action_mode: "grounded_raw",
      activation_role_family: "risk_consulting",
      activation_keywords: "Risk Consulting,RCSA,internal control",
      generalized_action: "根据目标岗位重新分配简历叙事重点，把经历改写为目标 JD 的核心职责和结果证据。",
      canonical_action_family: "jd_keyword_alignment",
      action_depth: "evidence",
      relatedProblemTags: ["low_jd_keyword_match"],
      A_action: "针对Risk Consulting方向突出RCSA、internal control和control framework。",
      P_mentor: "Risk Consulting 与 Quantitative Risk 岗位招聘逻辑不同，RCSA 和 internal control 是重点。",
      I_insight: "Risk Consulting 会看 control framework、governance 和 regulatory compliance。",
      HR_os: "我会先找 RCSA 和 internal control 这些风险咨询关键词。",
    }],
  };
  const [item] = selectTopAdviceForMentor(
    bucket,
    [{ tag: "low_jd_keyword_match", severity: "high" }],
    1,
    new Set(),
    { resumeText: "Management Trainee resume with reports and communication.", jdText: "Rotate through departments and improve business processes.", targetRole: "Management Trainee" }
  );
  const rendered = [item.action, item.mentorLens, item.reason, item.hrPerspective].join(" ");
  assert.ok(item.action.includes("目标岗位"));
  assert.ok(!/Risk Consulting|Quantitative Risk|RCSA|internal control|control framework|governance|regulatory compliance/i.test(rendered), rendered);
});

test("generalized fallback ignores approved raw mentor and HR perspectives", () => {
  const bucket = {
    cards: [{
      adviceId: "seg_hardware_approved_generalized",
      adviceScope: "resume_edit",
      adviceIntent: "experience_evidence",
      action_specificity: "role_specific",
      display_action_mode: "grounded_raw",
      activation_role_family: "hardware_electrical",
      generalized_action: "Pick the most relevant experience and rewrite it around task, method, and result evidence for the target role.",
      canonical_action_family: "experience_evidence",
      action_depth: "evidence",
      relatedProblemTags: ["weak_experience_keyword_evidence"],
      A_action: "For hardware roles, add PCB, circuit design, and debug experience.",
      I_insight: "Hardware or medical-device roles care about hands-on proof. Add test, debug, and prototype evidence.",
      HR_os: "For hardware or medical-device roles I look for test, debug, and prototype evidence.",
      humanized_mentor_insight: "Hardware or medical-device roles care about hands-on proof. Add test, debug, and prototype evidence.",
      humanized_hr_perspective: "For hardware or medical-device roles I look for test, debug, and prototype evidence.",
      perspective_review_status: "approved",
    }],
  };
  const [item] = selectTopAdviceForMentor(
    bucket,
    [{ tag: "weak_experience_keyword_evidence", severity: "high" }],
    1,
    new Set(),
    { resumeText: "Software Engineer resume.", jdText: "Backend services and APIs.", targetRole: "Software Engineer" }
  );
  const rendered = [item.action, item.mentorLens, item.reason, item.hrPerspective].join(" ");
  assert.strictEqual(item.actionDisplayModeUsed, "generalized");
  assert.ok(!/hardware|medical-device|medical device|PCB|circuit|test|debug|prototype/i.test(rendered), rendered);
  assert.ok(/target role|JD|keyword|任务|方法|结果|目标岗位|关键词/i.test(rendered), rendered);
});

test("semantic blocked action rows are not displayable", () => {
  const card = {
    A_action: "将Alpha Research项目拆分为两段，用VADER和MACD体现技术深度。",
    display_action_mode: "grounded_raw",
    generalized_action: "选择最贴近目标岗位的一段项目经历，按任务、方法和结果重写。",
    action_semantic_review_status: "blocked",
    role_family: "data_scientist",
  };
  assert.strictEqual(isGovernedAdviceDisplayable(card, {
    profile: { roleFamily: "data_scientist", targetRole: "Data Scientist" },
    jobTitle: "Data Scientist",
    resumeText: "Alpha Research project with VADER and MACD.",
    jdText: "Data scientist role.",
  }), false);
});

test("family and depth inference are stable for common actions", () => {
  const card = { actionSummary: "Rewrite Summary to include the exact target job title and strongest role fit evidence." };
  assert.strictEqual(canonicalActionFamilyOf(card), "summary_positioning");
  assert.strictEqual(actionDepthOf(card), "rewrite");
});

test("display action uses one primary action source instead of concatenating duplicates", () => {
  const repeated = "将每条经历的bullet point扩充为2-3条，包含具体行动、使用工具和量化成果，同时嵌入目标岗位JD中的核心关键词，提升简历信息量与ATS通过率。";
  const resolved = governance.resolveDisplayAction({
    display_action_mode: "raw",
    A_action: repeated,
    action_summary: repeated,
    rawActionSummary: repeated,
    actionSummary: repeated,
  }, {});
  assert.strictEqual(resolved.action, repeated);
});

test("canonical title rules produce action titles and avoid system placeholders", () => {
  const proposed = titleGovernance.classifyTitleGovernance({
    canonical_action_family: "experience_evidence",
    action_depth: "rewrite",
    A_action: "将经历 bullet 改写为任务、方法和结果结构。",
  });
  assert.strictEqual(proposed.canonical_title, "把经历改成任务-方法-结果");
  assert.ok(!titleGovernance.isBadVisibleTitle(proposed.canonical_title));
});

test("canonical title does not leak case-specific action terms", () => {
  const proposed = titleGovernance.classifyTitleGovernance({
    canonical_action_family: "experience_evidence",
    action_depth: "evidence",
    A_action: "将Alpha Research项目拆分为两段，用VADER和MACD体现技术深度。",
  });
  assert.ok(!/Alpha Research|VADER|MACD/i.test(proposed.canonical_title));
  assert.strictEqual(proposed.title_review_status, "needs_review");
});

test("display title falls back to canonical title instead of numbered placeholder", () => {
  const title = titleGovernance.bestDisplayTitle(
    { canonicalTitle: "补齐 JD 关键词证据" },
    "简历优化建议 11"
  );
  assert.strictEqual(title, "补齐 JD 关键词证据");
});

console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
