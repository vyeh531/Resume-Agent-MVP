require("dotenv").config({ path: ".env.local" });
require("dotenv").config({ path: ".env" });

const db = require("../database");

const NON_RESUME_TERMS = [
  "\u7533\u7814", "\u5347\u5b66", "\u5f55\u53d6\u4fa7\u91cd", "\u5f55\u53d6\u6807\u51c6",
  "admission", "\u7533\u8bf7\u6587\u4e66", "\u63a8\u8350\u4fe1", "\u786c\u4ef6.*onsite",
  "\u786c\u4ef6.*on-site", "lab\u76f8\u5173", "\u5b9e\u9a8c\u5ba4\u5c97\u4f4d",
  "\u6295\u9012\u7a97\u53e3", "\u7a97\u53e3\u671f", "10\u6708\u4efd", "\u5341\u6708\u4efd",
  "\u6625\u5b63/\u6691\u671f", "\u5b9e\u4e60\u4f5c\u4e3aentry point", "\u8ffd\u52a0\u7ea6?\\d+",
  "\u5148\u8ffd\u52a0", "\u6295\u9012\u91cf\u4e0d\u8db3", "\u4e27\u5931\u4fe1\u5fc3",
  "full-time job offer", "internship\u987a\u5229\u5b8c\u6210",
];
const NON_RESUME_RE = new RegExp(NON_RESUME_TERMS.join("|"), "i");

const NON_RESUME_TOPIC_TERMS = [
  "\u9762\u8bd5", "interview", "behavioral", "technical interview", "mock interview",
  "\u6295\u9012\u6e20\u9053", "\u6c42\u804c\u6e20\u9053", "\u5185\u63a8", "networking",
  "\u804c\u4e1a\u65b9\u5411\u9009\u62e9", "\u804c\u4e1a\u89c4\u5212",
  "\u6c42\u804c\u65f6\u95f4\u89c4\u5212", "\u65f6\u95f4\u89c4\u5212",
  "\u5e02\u573a\u7ade\u4e89\u5206\u6790", "\u7ade\u4e89\u5206\u6790",
  "\u80cc\u666f\u5dee\u8ddd\u5206\u6790", "gap\u5206\u6790", "\u7533\u8bf7\u5b66\u6821",
  "\u7533\u7814", "\u5347\u5b66", "\u5f55\u53d6", "\u6587\u4e66", "\u63a8\u8350\u4fe1",
];
const NON_RESUME_TOPIC_RE = new RegExp(NON_RESUME_TOPIC_TERMS.join("|"), "i");

const RESUME_EDIT_TERMS = [
  "summary", "skills?", "experience", "projects?", "education", "coursework",
  "relevant coursework", "word", "ruler", "tab", "bullet", "jd", "ats",
  "keyword", "keywords", "\u5173\u952e\u8bcd", "\u7b80\u5386", "\u5c65\u5386",
  "\u6539\u5199", "\u91cd\u5199", "\u7cbe\u4fee", "\u91cf\u5316", "\u6210\u679c",
  "\u683c\u5f0f", "\u7248\u5757", "\u677f\u5757", "\u5c97\u4f4d\u539f\u8bcd",
  "\u76ee\u6807\u5c97\u4f4d", "portfolio", "github", "linkedin", "\u8bfe\u7a0b",
  "\u6392\u7248", "\u6bb5\u843d", "\u884c\u8ddd", "\u9875\u8fb9\u8ddd", "\u5bf9\u9f50",
  "\u5c55\u793a", "\u4f53\u73b0", "\u5217\u51fa", "\u8865\u5145", "\u52a0\u5165",
  "\u5199\u5165", "\u5199\u8fdb", "\u5220\u9664", "\u5220\u6389", "\u79fb\u9664",
  "\u5220\u53bb", "\u66ff\u6362", "\u6dfb\u52a0", "\u5f3a\u8c03", "\u8bf4\u660e",
  "\u660e\u786e\u8bf4\u660e", "\u7ec6\u5316", "\u5c55\u5f00", "\u91cd\u65b0\u6846\u67b6",
  "\u91cd\u6784", "\u4fdd\u7559",
];
const RESUME_EDIT_RE = new RegExp(RESUME_EDIT_TERMS.join("|"), "i");

const KEEP_EVEN_WITH_NON_RESUME_RE = /\u5220\u9664|\u5220\u6389|\u79fb\u9664|remove|\u4e0d\u8981\u5199|\u4e0d\u9700\u8981|\u6c42\u804c\u7b80\u5386|\u4e1a\u754c\u6c42\u804c\u7b80\u5386/i;

function classify(row) {
  const text = [
    row.topic, row.L1, row.L2, row.P_mentor, row.A_action, row.I_insight,
    row.E_example, row.HR_os, row.keywords, row.retrieval_text,
    row.advice_card_title, row.user_problem_summary, row.action_summary,
    row.role_family, row.target_roles,
  ].filter(Boolean).join(" ");
  const topicText = [row.topic, row.L1, row.L2].filter(Boolean).join(" ");
  const actionText = [row.A_action, row.action_summary].filter(Boolean).join(" ");
  const resumeEdit = RESUME_EDIT_RE.test(text);
  const resumeEditAction = RESUME_EDIT_RE.test(actionText);

  if (NON_RESUME_TOPIC_RE.test(topicText)) return "exclude_non_resume_topic";
  if (!resumeEdit) return "exclude_not_resume_edit";
  if (!resumeEditAction) return "exclude_non_resume_action";

  const nonResumeMatch = actionText.match(NON_RESUME_RE);
  if (nonResumeMatch && !KEEP_EVEN_WITH_NON_RESUME_RE.test(actionText)) {
    return `exclude_non_resume:${nonResumeMatch[0]}`;
  }

  return "keep_resume_edit";
}

(async () => {
  const apply = process.argv.includes("--apply");
  const pool = db.getPool();
  const { rows } = await pool.query(`
    SELECT id, chunk_id, topic, "L1", "L2", "P_mentor", "A_action", "I_insight",
           "E_example", "HR_os", keywords, retrieval_text, advice_card_title,
           user_problem_summary, action_summary, role_family, target_roles, topic_slug
      FROM segments
     WHERE COALESCE(role_family, '') ILIKE '%universal%'
        OR COALESCE(target_roles, '') ILIKE '%universal%'
     LIMIT 5000
  `);

  const buckets = new Map();
  for (const row of rows) {
    const decision = classify(row);
    if (!buckets.has(decision)) buckets.set(decision, []);
    buckets.get(decision).push(row);
  }

  for (const [decision, items] of buckets.entries()) {
    console.log(`\n## ${decision}: ${items.length}`);
    for (const row of items.slice(0, 12)) {
      const text = String(row.P_mentor || row.advice_card_title || row.topic || "").replace(/\s+/g, " ").slice(0, 120);
      console.log(`- id=${row.id} topic=${row.topic || ""} L2=${row.L2 || ""} role=${row.role_family || ""} :: ${text}`);
    }
  }

  if (apply) {
    console.log("\n--apply is intentionally not implemented yet. Review the audit buckets first, then decide the update mapping.");
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
