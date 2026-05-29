import db from '../../../database';

// Generic words that appear in many job titles — don't use as standalone search terms
const GENERIC_TITLE_WORDS = new Set([
  'intern','interns','internship','senior','junior','lead','staff','principal',
  'associate','manager','analyst','engineer','specialist','coordinator','director',
  'officer','executive','assistant','advisor','consultant','developer','designer',
  'architect','head','vp','president','entry','level','mid','remote','full','part',
]);

async function fuzzyRow(pool, table, cols, jobTitle) {
  const sel = 'SELECT ' + cols + ' FROM ' + table;

  // 1. Exact match (case-insensitive)
  let r = await pool.query(sel + ' WHERE LOWER(position_title) = LOWER($1) LIMIT 1', [jobTitle]);
  if (r.rows[0]) return r.rows[0];

  // 2. LIKE both ways
  r = await pool.query(
    sel + " WHERE LOWER(position_title) LIKE LOWER($1) OR LOWER($2) LIKE LOWER('%' || position_title || '%') LIMIT 1",
    ['%' + jobTitle + '%', jobTitle]
  );
  if (r.rows[0]) return r.rows[0];

  // 3. Word-level — only use words that are ≥5 chars AND not generic title words
  //    To avoid "Intern" matching "Intern Coordinator" or "Manager" matching anything
  const meaningful = jobTitle
    .split(/[\s\-\/]+/)
    .filter(w => w.length >= 5 && !GENERIC_TITLE_WORDS.has(w.toLowerCase()));

  for (const w of meaningful.slice(0, 3)) {
    r = await pool.query(sel + ' WHERE LOWER(position_title) LIKE LOWER($1) LIMIT 1', ['%' + w + '%']);
    if (r.rows[0]) return r.rows[0];
  }

  return null;
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const jobTitle   = (searchParams.get('jobTitle') || '').trim();
    const resumeText = (searchParams.get('resumeText') || '').toLowerCase();
    if (!jobTitle) return Response.json({ error: 'jobTitle is required' }, { status: 400 });

    const pool = db.getPool();
    const row  = await fuzzyRow(pool, 'position_skills', '*', jobTitle);
    if (!row)  return Response.json({ success: true, found: false, skills: [] });

    const keys = [
      'top1_skill','top2_skill','top3_skill','top4_skill','top5_skill',
      'top6_skill','top7_skill','top8_skill','top9_skill','top10_skill',
    ];
    const skills = keys
      .map((k, i) => ({ priority: i + 1, name: row[k] }))
      .filter(s => s.name && s.name.trim())
      .map(s => ({
        priority: s.priority,
        name: s.name,
        // Whole-word match to avoid "Python" matching "Python3" as missing
        status: new RegExp('\\b' + s.name.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b').test(resumeText)
          ? 'have' : 'weak',
      }));

    return Response.json({ success: true, found: true, position_title: row.position_title, skills });
  } catch (error) {
    console.error('[position-skills]', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
