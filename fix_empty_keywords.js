/**
 * Fix 1,391 rows with empty keywords.
 * Type A (pure strategy topics): assign 'job search strategy'
 * Type B (has content, patterns missed): expand patterns and re-run
 */
const { Pool } = require('pg');
const fs = require('fs');

fs.readFileSync('.env', 'utf8').split('\n').forEach(l => {
  const [k, ...v] = l.split('=');
  if (k && v.length) process.env[k.trim()] = v.join('=').trim();
});

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  options: '-c search_path=vibe_offer',
});

// Type A topics — pure strategy, no technical keywords expected
const STRATEGY_TOPICS = new Set([
  '职业方向选择', '投递渠道规划', '求职时间规划', '市场竞争分析',
  '求职综合策略', '职业发展规划', '背景差距分析', '转行路径规划',
  '面试综合策略', '面试复盘改进', '软技能发展',
]);

// Type B — expanded patterns to catch colloquial Chinese
const EXTRA_KW_PATTERNS = [
  ['technical interview', ['面筋','刷题','leetcode','力扣','算法题','coding题','live coding','oa','online assessment','笔试','机考','技术轮','系统设计','design题']],
  ['behavioral interview', ['追问','bq题','behaviour','star法则','讲故事','故事框架','背故事','行为题','情景题','scenario']],
  ['targeted resume',      ['排序','前列','靠前','针对岗位','根据jd','按jd','岗位定制','有针对','匹配度','关键词匹配','一份简历','多版本']],
  ['job search strategy',  ['投递','渠道','内推','referral','linkedin','猎头','headhunter','冷邮件','cold email','一亩三分地','找工作','求职','offer','拿offer']],
  ['career switch',        ['转行','跨行','转型','背景转换','可迁移','transferable','换方向','career change']],
  ['new grad',             ['应届','毕业','fresh grad','entry level','校招','campus recruit','毕业生','在校']],
  ['networking',           ['人脉','内推','referral','社交','coffee chat','linkedin','校友','学长','学姐','前辈']],
  ['quantified results',   ['量化','数字','百分比','指标','kpi','数据','提升了','降低了','增加了','减少了','多少倍','x%']],
  ['work authorization',   ['签证','opt','h1b','身份','工作许可','work permit','绿卡','抽签','身份问题']],
  ['software engineer',    ['大厂','big name','faang','google','amazon','meta','apple','microsoft','字节','腾讯','阿里','华为','软件工程','sde','swe']],
  ['data analyst',         ['da岗','data analyst','数据分析','数据岗','analyst岗','ba岗','business analyst']],
  ['SQL',                  ['sql','数据库查询','写sql','sql题','数据库']],
  ['Python',               ['python','写python','py脚本','pandas','numpy','sklearn']],
  ['GPA',                  ['gpa','成绩','绩点','学分','grade','学业']],
  ['portfolio',            ['作品集','portfolio','展示作品','design portfolio','ux portfolio','ui作品']],
  ['LinkedIn',             ['linkedin','领英','linkedin profile','领英优化']],
];

function inferExtraKw(textLower) {
  return EXTRA_KW_PATTERNS
    .filter(([, pats]) => pats.some(p => textLower.includes(p)))
    .map(([kw]) => kw);
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
    await client.query("SET statement_timeout = '0'");

    const { rows } = await client.query(`
      SELECT id, topic, advice_type, "L1", "L2",
             "P_mentor", "A_action", "I_insight", "H_hook", "HR_os",
             keywords
      FROM segments
      WHERE keywords = '' OR keywords IS NULL
    `);
    console.log(`Empty keywords rows: ${rows.length}`);

    const ids = [], kwsArr = [];
    let typeA = 0, typeB = 0;

    for (const r of rows) {
      const isStrategyTopic = STRATEGY_TOPICS.has(r.topic);
      const textLower = [r.topic, r.L1, r.L2, r.P_mentor, r.A_action,
                         r.I_insight, r.H_hook, r.HR_os, r.advice_type]
        .filter(Boolean).join(' ').toLowerCase();

      let finalKw;
      if (isStrategyTopic) {
        // Type A: pure strategy → baseline keyword
        finalKw = merge(r.keywords, 'job search strategy');
        typeA++;
      } else {
        // Type B: run expanded patterns
        const extra = inferExtraKw(textLower);
        finalKw = merge(r.keywords, ...extra);
        // If still empty after expansion, fallback to job search strategy
        if (!finalKw) finalKw = 'job search strategy';
        typeB++;
      }

      ids.push(r.id);
      kwsArr.push(finalKw);
    }

    // Bulk update via unnest
    const CHUNK = 2000;
    let done = 0;
    for (let i = 0; i < ids.length; i += CHUNK) {
      await client.query(`
        UPDATE segments AS s SET keywords = v.kw
        FROM unnest(CAST($1 AS integer[]), CAST($2 AS text[])) AS v(id, kw)
        WHERE s.id = v.id
      `, [ids.slice(i, i + CHUNK), kwsArr.slice(i, i + CHUNK)]);
      done += Math.min(CHUNK, ids.length - i);
      console.log(`  ${done}/${ids.length}`);
    }

    console.log(`\nType A (strategy → 'job search strategy'): ${typeA}`);
    console.log(`Type B (expanded patterns): ${typeB}`);

    // Verify
    const r1 = await client.query(`SELECT COUNT(*) c FROM segments WHERE keywords = '' OR keywords IS NULL`);
    console.log(`\nStill empty keywords: ${r1.rows[0].c}`);

    // Show new keyword distribution for previously-empty rows
    const r2 = await client.query(`
      SELECT kw, COUNT(*) n
      FROM segments, unnest(string_to_array(keywords, ',')) AS kw
      WHERE id = ANY($1) AND kw != ''
      GROUP BY kw ORDER BY n DESC LIMIT 15
    `, [ids]);
    console.log('\nTop new keywords assigned:');
    r2.rows.forEach(r => console.log(`  ${String(r.n).padStart(5)}  ${r.kw}`));

  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(e => { console.error(e.message); process.exit(1); });
