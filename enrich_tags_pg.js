/**
 * Enrich problem_tags and keywords for vibe_offer.segments.
 * Runs batched updates with per-row timeout protection.
 */
const { Pool } = require('pg');
const fs = require('fs');

// Load .env
fs.readFileSync('.env', 'utf8').split('\n').forEach(l => {
  const [k, ...v] = l.split('=');
  if (k && v.length) process.env[k.trim()] = v.join('=').trim();
});

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  options: '-c search_path=vibe_offer',
});

// ── Topic → problem_tags baseline ────────────────────────────────────────────
const TOPIC_TAGS = {
  '工作经历描述':   'weak_result_orientation,weak_action_verbs,low_measurable_results',
  '项目经历描述':   'weak_experience_keyword_evidence,missing_portfolio',
  '技能栏优化':     'low_hard_skill_match,keywords_only_in_skills',
  '教育背景优化':   'education_details_missing',
  '简历格式规范':   'formatting_penalty_triggered',
  '多版本简历策略': 'generic_resume_positioning,resume_not_tailored_to_jd,low_role_specificity',
  '个人总结撰写':   'weak_summary_role_alignment,missing_exact_job_title',
  '关键词布局':     'low_jd_keyword_match,missing_priority_keywords,weak_experience_keyword_evidence',
  'ATS机筛策略':    'low_jd_keyword_match,missing_priority_keywords',
  '简历量化成果':   'low_measurable_results,weak_result_orientation',
  '简历结构调整':   'formatting_penalty_triggered,weak_action_verbs',
  '简历定向策略':   'generic_resume_positioning,low_role_specificity,weak_target_role_alignment',
  '简历内容优化':   'low_jd_keyword_match',
  '目标岗位定位':   'weak_target_role_alignment,low_role_specificity,missing_exact_job_title',
  '投递渠道规划':   'generic_resume_positioning',
  '市场竞争分析':   'low_role_specificity,weak_target_role_alignment',
  '求职时间规划':   'generic_resume_positioning',
  '背景差距分析':   'low_hard_skill_match,low_role_specificity,weak_target_role_alignment',
  '求职综合策略':   'low_role_specificity',
  '行为面试备考':   'low_soft_skill_match',
  '技术面试备考':   'low_hard_skill_match',
  '面试复盘改进':   'low_soft_skill_match',
  '面试综合策略':   'low_soft_skill_match',
  '职业方向选择':   'weak_target_role_alignment,low_role_specificity',
  '转行路径规划':   'weak_target_role_alignment,low_role_specificity',
  '职业发展规划':   'weak_target_role_alignment',
  '技术技能补强':   'low_hard_skill_match',
  '软技能发展':     'low_soft_skill_match',
  '证书资质规划':   'education_details_missing',
  '技能综合提升':   'low_hard_skill_match',
};

const TOPIC_KW = {
  '工作经历描述':   'quantified results,action verbs',
  '项目经历描述':   'portfolio,GitHub',
  '技能栏优化':     'keyword match,ATS',
  '关键词布局':     'ATS,keyword match,JD match',
  'ATS机筛策略':    'ATS,keyword match,JD match,targeted resume',
  '多版本简历策略': 'targeted resume,resume version,resume tailoring',
  '简历格式规范':   'ATS',
  '简历量化成果':   'quantified results',
  '行为面试备考':   'behavioral interview',
  '技术面试备考':   'system design',
  '背景差距分析':   'new grad',
  '转行路径规划':   'career switch',
  '技术技能补强':   'keyword match',
  '个人总结撰写':   'targeted resume',
  '目标岗位定位':   'targeted resume',
  '简历定向策略':   'targeted resume,resume tailoring',
};

// ── Content pattern matching ──────────────────────────────────────────────────
const PROBLEM_PATTERNS = [
  ['low_jd_keyword_match',          ['jd关键词','jd匹配','ats匹配','关键词命中','keyword match','命中率','机筛','关键词不够','关键词不足']],
  ['missing_priority_keywords',     ['关键词缺失','优先关键词','高频词','必要关键词','核心技能词','缺少关键词','priority keyword']],
  ['low_hard_skill_match',          ['技术栈','hard skill','技术技能','technical skill','硬技能','缺技术','skill match','编程','框架','算法','数据库']],
  ['low_soft_skill_match',          ['soft skill','软技能','沟通','communication','leadership','领导力','teamwork','团队协作']],
  ['weak_summary_role_alignment',   ['summary','个人简介','概述','profile','求职目标','定位不明','自我介绍']],
  ['low_measurable_results',        ['缺量化','没有数字','no metrics','量化结果','缺少数字','没有量化','数字','百分比','指标','kpi']],
  ['weak_action_verbs',             ['弱动词','weak verb','动词不强','负责','responsible for','动词选择','参与了','协助了']],
  ['weak_result_orientation',       ['结果导向','无结果','缺结果','成效不明','没有结果','贡献','contribution']],
  ['generic_resume_positioning',    ['通用简历','一份简历','简历走天下','万能简历','通用版本']],
  ['low_role_specificity',          ['针对性','岗位针对性','缺乏针对性','不够针对','针对岗位','定向']],
  ['weak_target_role_alignment',    ['目标岗位匹配','岗位对齐','role alignment','简历不匹配','方向','目标岗位','目标职位']],
  ['resume_not_tailored_to_jd',     ['针对jd','tailored','定制简历','按jd修改','根据jd','jd定制']],
  ['weak_experience_keyword_evidence', ['项目里','经历里','工作经历中','关键词在项目','项目描述中','经历中体现']],
  ['keywords_only_in_skills',       ['技能列表','skills section','技能区','只在技能栏','技能版块']],
  ['formatting_penalty_triggered',  ['格式问题','ats不识别','格式错误','格式','排版','字体','边距']],
  ['education_details_missing',     ['学历','education','degree','gpa','课程','教育背景','学位','毕业','专业']],
  ['missing_portfolio',             ['portfolio','作品集','github link','展示链接','github','demo']],
  ['missing_exact_job_title',       ['exact title','精准职位','job title','职位名称','岗位名称','title']],
];

const KEYWORD_PATTERNS = [
  ['ATS',                 ['ats','机筛','applicant tracking','机器筛选']],
  ['JD match',            ['jd match','jd匹配','job description match']],
  ['keyword match',       ['keyword match','关键词匹配','关键词命中','关键词']],
  ['targeted resume',     ['targeted resume','针对性简历','定向简历','定制简历']],
  ['resume version',      ['resume version','简历版本','多版本简历']],
  ['quantified results',  ['量化','quantified','measurable','数字','指标','百分比']],
  ['action verbs',        ['action verb','动词','主动动词']],
  ['LinkedIn',            ['linkedin','领英']],
  ['GitHub',              ['github']],
  ['portfolio',           ['portfolio','作品集']],
  ['career switch',       ['转行','career switch','职业转型','跨行']],
  ['new grad',            ['new grad','应届','应届生','毕业生']],
  ['internship',          ['internship','实习']],
  ['work authorization',  ['work authorization','签证','opt','h1b']],
  ['system design',       ['system design','系统设计']],
  ['behavioral interview',['behavioral','行为面试','bq','star法则','star框架']],
  ['technical interview', ['technical interview','技术面试','代码面试']],
  ['SQL',                 [' sql',' sql查询']],
  ['Python',              ['python']],
  ['machine learning',    ['machine learning','机器学习']],
  ['data science',        ['data science','数据科学']],
  ['GPA',                 [' gpa']],
  ['networking',          ['networking','人脉','内推','referral']],
];

function inferFromContent(textLower, patterns) {
  return patterns
    .filter(([, pats]) => pats.some(p => textLower.includes(p)))
    .map(([tag]) => tag);
}

function merge(...csvStrings) {
  const seen = new Set();
  for (const s of csvStrings) {
    for (const t of (s || '').split(',')) {
      const tt = t.trim();
      if (tt) seen.add(tt);
    }
  }
  return [...seen].join(',');
}

async function run() {
  const client = await pool.connect();
  try {
    await client.query("SET statement_timeout = '0'"); // disable for this session

    const { rows } = await client.query(`
      SELECT id, topic, "L1", "L2", "P_mentor", "A_action", "I_insight",
             "H_hook", "E_example", "HR_os", advice_type, problem_tags, keywords
      FROM segments
      WHERE problem_tags = '' OR keywords = ''
         OR problem_tags IS NULL OR keywords IS NULL
    `);
    console.log(`Rows to enrich: ${rows.length}`);

    // Build all updates in JS, then send in one bulk query via unnest()
    const ids = [], tags = [], kws = [];
    for (const r of rows) {
      const textLower = [r.topic, r.L1, r.L2, r.P_mentor, r.A_action, r.I_insight,
                         r.H_hook, r.E_example, r.HR_os, r.advice_type]
        .filter(Boolean).join(' ').toLowerCase();

      const finalTags = merge(r.problem_tags, TOPIC_TAGS[r.topic], inferFromContent(textLower, PROBLEM_PATTERNS).join(','));
      const finalKws  = merge(r.keywords,     TOPIC_KW[r.topic],   inferFromContent(textLower, KEYWORD_PATTERNS).join(','));

      ids.push(r.id);
      tags.push(finalTags);
      kws.push(finalKws);
    }

    // Chunk into 2000-row batches to avoid query size limits
    const CHUNK = 2000;
    let done = 0;
    for (let i = 0; i < ids.length; i += CHUNK) {
      const sliceIds  = ids.slice(i, i + CHUNK);
      const sliceTags = tags.slice(i, i + CHUNK);
      const sliceKws  = kws.slice(i, i + CHUNK);
      await client.query(`
        UPDATE segments AS s
        SET problem_tags = v.tags, keywords = v.kws
        FROM unnest(
          CAST($1 AS integer[]),
          CAST($2 AS text[]),
          CAST($3 AS text[])
        ) AS v(id, tags, kws)
        WHERE s.id = v.id
      `, [sliceIds, sliceTags, sliceKws]);
      done += sliceIds.length;
      console.log(`  ${done}/${ids.length}`);
    }
    console.log(`Updated ${done} rows`);

    // HR_os placeholder cleanup
    console.log('\n── HR_os cleanup ──');
    for (const placeholder of ['暂无', '暂无HR视角', '（无）', '(无)', '暂无hr视角', '无']) {
      const r = await client.query(
        'UPDATE segments SET "HR_os" = NULL WHERE "HR_os" = $1', [placeholder]
      );
      if (r.rowCount) console.log(`  "${placeholder}" → NULL: ${r.rowCount} rows`);
    }
    const r2 = await client.query(
      `UPDATE segments SET "HR_os" = NULL WHERE "HR_os" IS NOT NULL AND LENGTH(TRIM("HR_os")) < 5`
    );
    if (r2.rowCount) console.log(`  Too short → NULL: ${r2.rowCount} rows`);

    // Final stats
    const s1 = await client.query(`SELECT COUNT(*) c FROM segments WHERE problem_tags = '' OR problem_tags IS NULL`);
    const s2 = await client.query(`SELECT COUNT(*) c FROM segments WHERE keywords = '' OR keywords IS NULL`);
    const s3 = await client.query(`SELECT COUNT(*) c FROM segments WHERE "HR_os" IS NULL OR "HR_os" = ''`);
    console.log(`\nEmpty problem_tags: ${s1.rows[0].c}`);
    console.log(`Empty keywords:     ${s2.rows[0].c}`);
    console.log(`HR_os empty/null:   ${s3.rows[0].c}`);
    console.log('\nDone.');
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(e => { console.error(e.message); process.exit(1); });
