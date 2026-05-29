import db from '../../../database';

const GENERIC_TITLE_WORDS = new Set([
  'intern','interns','internship','senior','junior','lead','staff','principal',
  'associate','manager','analyst','engineer','specialist','coordinator','director',
  'officer','executive','assistant','advisor','consultant','developer','designer',
  'architect','head','vp','president','entry','level','mid','remote','full','part',
]);

async function fuzzyRow(pool, table, cols, jobTitle) {
  const sel = 'SELECT ' + cols + ' FROM ' + table;

  // 1. Exact match
  let r = await pool.query(sel + ' WHERE LOWER(position_title) = LOWER($1) LIMIT 1', [jobTitle]);
  if (r.rows[0]) return r.rows[0];

  // 2. LIKE both ways
  r = await pool.query(
    sel + " WHERE LOWER(position_title) LIKE LOWER($1) OR LOWER($2) LIKE LOWER('%' || position_title || '%') LIMIT 1",
    ['%' + jobTitle + '%', jobTitle]
  );
  if (r.rows[0]) return r.rows[0];

  // 3. Word-level — skip generic words to avoid misfires
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
    const jobTitle = (searchParams.get('jobTitle') || '').trim();
    if (!jobTitle) return Response.json({ error: 'jobTitle is required' }, { status: 400 });

    const pool = db.getPool();
    const row  = await fuzzyRow(pool, 'position_skills', 'position_title, salary_range', jobTitle);
    if (!row || !row.salary_range) {
      return Response.json({ success: true, found: false, salary_range: null });
    }

    return Response.json({
      success: true,
      found: true,
      position_title: row.position_title,
      salary_range: row.salary_range,
    });
  } catch (error) {
    console.error('[position-salary]', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
