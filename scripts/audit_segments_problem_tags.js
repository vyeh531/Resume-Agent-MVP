"use strict";

require("dotenv").config({ path: ".env.local" });
require("dotenv").config({ path: ".env" });

const fs = require("fs");
const path = require("path");
const db = require("../database");

const APPLY = process.argv.includes("--apply");
const INCLUDE_NON_RESUME = process.argv.includes("--include-non-resume");
const PRECISE_ADD_TAGS = new Set([
  "uploaded_non_pdf_format",
  "file_naming_issue",
  "inconsistent_date_format",
  "missing_section_dates",
  "missing_portfolio",
  "missing_linkedin",
  "missing_github_link",
  "education_details_missing",
  "missing_exact_job_title",
  "weak_summary_role_alignment",
]);

function splitCsv(value) {
  if (Array.isArray(value)) return value.flatMap(splitCsv);
  return String(value || "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

function uniq(items) {
  return [...new Set(items.filter(Boolean))];
}

function textOf(row) {
  return [
    row.topic,
    row.L1,
    row.L2,
    row.P_mentor,
    row.A_action,
    row.I_insight,
    row.E_example,
    row.HR_os,
    row.advice_card_title,
    row.user_problem_summary,
    row.action_summary,
  ].filter(Boolean).join(" ").toLowerCase();
}

function has(text, pattern) {
  return pattern.test(text);
}

function addIf(tags, condition, tag) {
  if (condition) tags.push(tag);
}

function inferPreciseProblemTags(row) {
  const text = textOf(row);
  const tags = [];

  const fileSubmissionFormat = has(text, /\bword\b|\.docx?\b|word\s*(document|file)|word文档|word文件|word檔|word档|以word|不要以word|submit.+pdf|pdf格式|pdf 格式|一页pdf|一頁pdf/);
  const fileNaming = has(text, /file\s*name|filename|文件名|檔名|档名|resume\.pdf|_resume/);
  const portfolio = has(text, /portfolio|作品集|behance|dribbble|personal\s*site|personal\s*website|个人网站|個人網站|项目链接|展示链接|作品链接|可点击.*链接|clickable.*portfolio/);
  const linkedin = has(text, /linkedin|领英|領英/);
  const github = has(text, /github|gitlab|repo|repository|代码仓库|程式碼|代码链接/);
  const contact = has(text, /email|phone|联系方式|聯繫方式|联系信息|聯絡資訊|contact\s+info|contact\s+information|邮箱|郵箱|电话|電話/);
  const gpaCoursework = has(text, /\bgpa\b|coursework|relevant coursework|课程|課程|成绩|成績|education section|教育背景/);

  addIf(tags, fileSubmissionFormat, "uploaded_non_pdf_format");
  addIf(tags, fileNaming, "file_naming_issue");
  addIf(tags, has(text, /formatting issue|ats.*(parse|parser)|parser.*(fail|error)|乱码|亂碼|格式错乱|格式錯亂|无法解析|無法解析/), "formatting_penalty_triggered");
  addIf(tags, has(text, /date format|日期格式|时间格式|時間格式|chronological|reverse chronological|倒序|时间线|時間線/), "inconsistent_date_format");
  addIf(tags, has(text, /section.+date|date.+section|missing.+date|缺少.*(日期|年份|时间|時間)/), "missing_section_dates");
  addIf(tags, portfolio, "missing_portfolio");
  addIf(tags, linkedin, "missing_linkedin");
  addIf(tags, github && !portfolio, "missing_github_link");
  addIf(tags, contact, "missing_contact_info");
  addIf(tags, gpaCoursework, "education_details_missing");

  addIf(tags, has(text, /exact\s*(job\s*)?title|target title|岗位原词|職位原詞|职位原词|目标岗位名称|目標崗位名稱|精确职位|精準職位/), "missing_exact_job_title");
  addIf(tags, has(text, /professional summary|summary section|profile section|objective section|个人简介|個人簡介|求职目标|求職目標/), "weak_summary_role_alignment");
  addIf(tags, has(text, /target role|role alignment|role fit|role positioning|目标岗位|目標崗位|岗位定位|職位定位|方向不清|定位不清|不匹配岗位|不符合岗位/), "weak_target_role_alignment");
  addIf(tags, has(text, /generic resume|one resume|same resume|通用简历|通用履歷|万能简历|萬能履歷|一份简历|一份履歷|所有岗位|所有職位/), "generic_resume_positioning");
  addIf(tags, has(text, /tailor|tailored|customi[sz]e|according to jd|按jd|针对jd|針對jd|对应jd|對應jd|定制简历|定制履歷/), "resume_not_tailored_to_jd");

  addIf(tags, has(text, /keyword match|jd match|关键词匹配|關鍵詞匹配|关键词覆盖|關鍵詞覆蓋|机筛.*关键词|機篩.*關鍵詞|匹配率/), "low_jd_keyword_match");
  addIf(tags, has(text, /missing keyword|priority keyword|core keyword|high[- ]frequency|缺少.*关键词|缺少.*關鍵詞|核心技能词|核心技能詞|高频词|高頻詞/), "missing_priority_keywords");
  addIf(tags, has(text, /hard skill|technical skill|tool|tools|skills section|技能|工具|技术栈|技術棧|硬技能/), "low_hard_skill_match");
  addIf(tags, has(text, /soft skill|communication|leadership|teamwork|collaboration|沟通|溝通|领导力|領導力|团队|團隊|协作|協作/), "low_soft_skill_match");

  addIf(tags, has(text, /experience.*keyword|keyword.*experience|project.*keyword|keyword.*project|经历.*关键词|經歷.*關鍵詞|项目.*关键词|項目.*關鍵詞/), "weak_experience_keyword_evidence");
  addIf(tags, has(text, /skills section|skills list|only.*skills|只.*skills|只在技能|技能列表|技能栏|技能欄|堆关键词|堆關鍵詞/), "keywords_only_in_skills");
  addIf(tags, has(text, /metric|quantif|measurable|number|percentage|impact|result|achievement|成果|结果|結果|量化|数字|數字|百分比|指标|指標/), "low_measurable_results");
  addIf(tags, has(text, /action verb|strong verb|weak verb|responsible for|participated|负责|負責|参与|參與|动词|動詞/), "weak_action_verbs");
  addIf(tags, has(text, /result[- ]oriented|outcome|impact|business value|效果|成效|贡献|貢獻|业务价值|業務價值/), "weak_result_orientation");

  addIf(tags, has(text, /short tenure|gap|employment gap|短期|空窗|跳槽|工作时间短|工作時間短/), "short_tenure_unclear");
  addIf(tags, has(text, /outdated|old resume|update.+resume|过时|過時|旧简历|舊履歷|没有更新|沒有更新/), "outdated_resume");
  addIf(tags, has(text, /relocat|location|work authorization|visa|opt|cpt|h-?1b|地点|地點|签证|簽證|工卡|工作许可|工作許可/), "missing_relocation_signal");

  return uniq(tags);
}

function cleanTags(row) {
  const current = splitCsv(row.problem_tags);
  const inferred = inferPreciseProblemTags(row);
  const text = textOf(row);

  let next = uniq([...current, ...inferred.filter((tag) => PRECISE_ADD_TAGS.has(tag))]);

  // Avoid the Graphic Designer failure mode: a row that mainly warns about Word/PDF
  // submission should not be treated as pure portfolio/contact advice.
  if (next.includes("missing_portfolio") && /word\s*(document|file)|word文档|word文件|word檔|word档|不要以word|以word/.test(text)) {
    next = uniq(["uploaded_non_pdf_format", ...next]);
  }

  if (!/portfolio|作品集|behance|dribbble|personal\s*(site|website)|项目链接|展示链接|作品链接/.test(text)) {
    next = next.filter((tag) => tag !== "missing_portfolio");
  }
  if (!/linkedin|领英|領英/.test(text)) {
    next = next.filter((tag) => tag !== "missing_linkedin");
  }
  if (!/\bword\b|\.docx?\b|word文档|word文件|word檔|word档|以word|不要以word|pdf格式|pdf 格式|submit.+pdf/.test(text)) {
    next = next.filter((tag) => tag !== "uploaded_non_pdf_format");
  }
  if (!/summary|professional summary|profile|objective|个人简介|個人簡介|概要|求职目标|求職目標/.test(text)) {
    next = next.filter((tag) => tag !== "weak_summary_role_alignment");
  }
  if (!/exact\s*(job\s*)?title|target title|岗位原词|職位原詞|职位原词|目标岗位名称|目標崗位名稱|精确职位|精準職位/.test(text)) {
    next = next.filter((tag) => tag !== "missing_exact_job_title");
  }
  if (!/\bgpa\b|coursework|relevant coursework|课程|課程|成绩|成績|education section|教育背景|学历|學歷/.test(text)) {
    next = next.filter((tag) => tag !== "education_details_missing");
  }
  if (!/code review|distributed systems|microservices|documentation|代码审查|代碼審查|分布式|微服务|微服務|文档|文件/.test(text)) {
    next = next.filter((tag) => ![
      "missing_code_review_documentation",
      "missing_distributed_systems",
      "missing_microservices",
    ].includes(tag));
  }
  if (next.includes("low_role_specificity")) {
    next = next.filter((tag) => tag !== "low_role_specificity");
  }
  next = next.filter((tag) => tag !== "universal_resume_problem");

  next = uniq(next);
  return next.length ? next : current;
}

function diffTags(current, next) {
  const c = new Set(current);
  const n = new Set(next);
  return {
    added: [...n].filter((tag) => !c.has(tag)),
    removed: [...c].filter((tag) => !n.has(tag)),
  };
}

function sampleText(row) {
  return String(row.P_mentor || row.user_problem_summary || row.A_action || row.topic || "")
    .replace(/\s+/g, " ")
    .slice(0, 180);
}

async function main() {
  const pool = db.getPool();
  await pool.query("SET statement_timeout = '10min'");

  const { rows } = await pool.query(`
    SELECT id, chunk_id, topic, "L1", "L2", "P_mentor", "A_action", "I_insight",
           "E_example", "HR_os", keywords, retrieval_text, advice_card_title,
           user_problem_summary, action_summary, role_family, target_roles,
           problem_tags, ats_dimensions, retrieval_scope
      FROM segments
     ${INCLUDE_NON_RESUME ? "" : "WHERE retrieval_scope IS NULL OR retrieval_scope = 'resume_edit'"}
     ORDER BY id
  `);

  const changes = rows.map((row) => {
    const current = splitCsv(row.problem_tags);
    const next = cleanTags(row);
    const diff = diffTags(current, next);
    return {
      id: row.id,
      chunk_id: row.chunk_id,
      retrieval_scope: row.retrieval_scope,
      topic: row.topic,
      current,
      next,
      added: diff.added,
      removed: diff.removed,
      text: sampleText(row),
    };
  }).filter((row) => row.added.length || row.removed.length);

  const counts = {
    totalRows: rows.length,
    changedRows: changes.length,
    apply: APPLY,
    includeNonResume: INCLUDE_NON_RESUME,
  };
  console.log(JSON.stringify(counts, null, 2));

  const addedCounts = new Map();
  const removedCounts = new Map();
  for (const change of changes) {
    for (const tag of change.added) addedCounts.set(tag, (addedCounts.get(tag) || 0) + 1);
    for (const tag of change.removed) removedCounts.set(tag, (removedCounts.get(tag) || 0) + 1);
  }

  console.log("\n# added_tags");
  for (const [tag, count] of [...addedCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 40)) {
    console.log(`${tag}: ${count}`);
  }

  console.log("\n# removed_tags");
  for (const [tag, count] of [...removedCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 40)) {
    console.log(`${tag}: ${count}`);
  }

  const highRisk = changes.filter((row) =>
    row.added.includes("uploaded_non_pdf_format") ||
    row.removed.includes("missing_portfolio") ||
    row.removed.includes("weak_summary_role_alignment") ||
    row.removed.includes("missing_linkedin")
  );
  console.log("\n# high_risk_samples");
  for (const row of highRisk.slice(0, 30)) {
    console.log(`- id=${row.id} add=[${row.added.join(",")}] remove=[${row.removed.join(",")}] old=[${row.current.join(",")}] new=[${row.next.join(",")}] :: ${row.text}`);
  }

  console.log("\n# changed_samples");
  for (const row of changes.slice(0, 30)) {
    console.log(`- id=${row.id} add=[${row.added.join(",")}] remove=[${row.removed.join(",")}] old=[${row.current.join(",")}] new=[${row.next.join(",")}] :: ${row.text}`);
  }

  if (!APPLY) {
    console.log("\nDry run only. Re-run with --apply after reviewing samples.");
    return;
  }

  const backupDir = path.join(process.cwd(), "data", "backups");
  fs.mkdirSync(backupDir, { recursive: true });
  const backupPath = path.join(backupDir, `segments_problem_tags_${Date.now()}.json`);
  fs.writeFileSync(backupPath, JSON.stringify(changes.map((row) => ({
    id: row.id,
    chunk_id: row.chunk_id,
    problem_tags: row.current.join(","),
    next_problem_tags: row.next.join(","),
  })), null, 2));
  console.log(`backup=${backupPath}`);

  await pool.query("BEGIN");
  try {
    await pool.query("CREATE TEMP TABLE segment_problem_tag_updates (id integer PRIMARY KEY, problem_tags text) ON COMMIT DROP");
    for (let start = 0; start < changes.length; start += 1000) {
      const chunk = changes.slice(start, start + 1000);
      const params = [];
      const values = chunk.map((row, index) => {
        params.push(row.id, row.next.join(","));
        return `($${index * 2 + 1}, $${index * 2 + 2})`;
      });
      await pool.query(
        `INSERT INTO segment_problem_tag_updates (id, problem_tags) VALUES ${values.join(",")}`,
        params
      );
    }
    await pool.query(`
      UPDATE segments AS target
         SET problem_tags = updates.problem_tags
        FROM segment_problem_tag_updates AS updates
       WHERE target.id = updates.id
    `);
    await pool.query("COMMIT");
  } catch (error) {
    await pool.query("ROLLBACK");
    throw error;
  } finally {
    // database.js owns pool shutdown on process exit.
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
