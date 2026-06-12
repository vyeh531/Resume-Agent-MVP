import db from '../../../database';

const FALLBACK_POSITIONS = [
  'Data Analyst',
  'Software Engineer',
  'Product Manager',
  'Business Analyst',
  'Management Trainee',
  'Marketing Analyst',
  'Financial Analyst',
  'UX Designer',
];

export async function GET() {
  try {
    if (!db.hasDatabaseUrl()) {
      return Response.json({ success: true, data: FALLBACK_POSITIONS, source: 'offline-fallback' });
    }
    const pool = db.getPool();
    const { rows } = await pool.query('SELECT position_title FROM position_skills ORDER BY position_title');
    return Response.json({ success: true, data: rows.map(r => r.position_title) });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
