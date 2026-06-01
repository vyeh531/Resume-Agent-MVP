/**
 * Recalculate mentor_quality_score for all rows using new specificity-aware formula.
 *
 * New formula (max = 1.0):
 *   0.40  base
 *   0.10  confidence == "high"
 *   0.05  confidence == "medium"
 *   0.05  A_action exists
 *   0.10  A_action length > 50 chars (specific, not a stub)
 *   0.05  A_action contains a digit or known tool name (quantified / concrete)
 *   0.05  H_hook length > 30 chars (real verbatim quote)
 *   0.10  E_example exists (only for operational advice_type)
 *   0.05  HR_os exists and non-empty
 *   0.05  I_insight exists
 *   0.05  generality == "role-specific" (targeted, harder to find)
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

const OPERATIONAL_TYPES = new Set([
  '结构调整', '格式优化', '项目包装', '量化成果', '关键词匹配', '技能补强',
]);

// Signals that a field contains something concrete: digit, tool name, %
const CONCRETE_RE = /\d|python|sql|java|react|aws|docker|spring|tensorflow|pytorch|excel|tableau|gpa|%|倍|个|条|页|分|秒/i;

function calcScore(row) {
  let score = 0.40;

  const conf = (row.confidence || '').toLowerCase();
  if (conf === 'high')   score += 0.10;
  else if (conf === 'medium') score += 0.05;

  const a = (row.A_action || '').trim();
  if (a.length > 0)  score += 0.05;
  if (a.length > 50) score += 0.10;
  if (CONCRETE_RE.test(a)) score += 0.05;

  const h = (row.H_hook || '').trim();
  if (h.length > 30) score += 0.05;

  const e = (row.E_example || '').trim();
  if (e.length > 0 && OPERATIONAL_TYPES.has(row.advice_type)) score += 0.10;

  const hr = (row.HR_os || '').trim();
  if (hr.length > 0) score += 0.05;

  const ins = (row.I_insight || '').trim();
  if (ins.length > 0) score += 0.05;

  if (row.generality === 'role-specific') score += 0.05;

  return Math.round(Math.min(1.0, Math.max(0.0, score)) * 10000) / 10000;
}

async function run() {
  const client = await pool.connect();
  try {
    await client.query("SET statement_timeout = '0'");

    const { rows } = await client.query(`
      SELECT id, confidence, "A_action", "H_hook", "E_example", "HR_os",
             "I_insight", advice_type, generality
      FROM segments
    `);
    console.log(`Recalculating scores for ${rows.length} rows...`);

    const ids = [], scores = [];
    const dist = {};

    for (const r of rows) {
      const s = calcScore(r);
      ids.push(r.id);
      scores.push(s);
      const bucket = s.toFixed(2);
      dist[bucket] = (dist[bucket] || 0) + 1;
    }

    // Bulk update
    const CHUNK = 2000;
    let done = 0;
    for (let i = 0; i < ids.length; i += CHUNK) {
      await client.query(`
        UPDATE segments AS s SET mentor_quality_score = v.score
        FROM unnest(CAST($1 AS integer[]), CAST($2 AS float[])) AS v(id, score)
        WHERE s.id = v.id
      `, [ids.slice(i, i + CHUNK), scores.slice(i, i + CHUNK)]);
      done += Math.min(CHUNK, ids.length - i);
      process.stdout.write(`\r  ${done}/${ids.length}`);
    }
    console.log('\nUpdated all rows');

    // Distribution report
    console.log('\nScore distribution:');
    const sorted = Object.keys(dist).sort((a, b) => parseFloat(b) - parseFloat(a));
    let cumPct = 0;
    for (const bucket of sorted) {
      const pct = (dist[bucket] / rows.length * 100).toFixed(1);
      cumPct += parseFloat(pct);
      const bar = '█'.repeat(Math.round(dist[bucket] / rows.length * 50));
      console.log(`  ${bucket}  ${String(dist[bucket]).padStart(5)}  (${pct.padStart(4)}%)  ${bar}`);
    }

    // Before/after comparison
    const r2 = await client.query(`
      SELECT
        AVG(mentor_quality_score) avg,
        MIN(mentor_quality_score) min,
        MAX(mentor_quality_score) max,
        COUNT(*) FILTER (WHERE mentor_quality_score = 1.0) perfect,
        COUNT(*) FILTER (WHERE mentor_quality_score >= 0.85) high,
        COUNT(*) FILTER (WHERE mentor_quality_score < 0.65) low
      FROM segments
    `);
    const s = r2.rows[0];
    console.log(`\nStats: avg=${parseFloat(s.avg).toFixed(3)}  min=${s.min}  max=${s.max}`);
    console.log(`  score=1.0:   ${s.perfect} rows (${(s.perfect/rows.length*100).toFixed(1)}%)`);
    console.log(`  score≥0.85:  ${s.high} rows (${(s.high/rows.length*100).toFixed(1)}%)`);
    console.log(`  score<0.65:  ${s.low} rows (${(s.low/rows.length*100).toFixed(1)}%)`);

  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(e => { console.error(e.message); process.exit(1); });
