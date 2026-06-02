import Anthropic from '@anthropic-ai/sdk';
import db from '../../../database';

export async function POST(request) {
  try {
    const { jobTitle, resumeText, keyProblems, atsScore } = await request.json();
    const pool = db.getPool();
    const kw = '%' + (jobTitle || '').toLowerCase() + '%';

    // ── 1. Segments (4-tier priority) ──────────────────────────
    let segments = [];
    const { rows: tier1 } = await pool.query(
      "SELECT * FROM segments WHERE retrieval_scope='resume_edit' AND generality='universal' AND (confidence='high' OR confidence IS NULL)" +
      ' AND (LOWER(topic) LIKE $1 OR LOWER("L1") LIKE $2 OR LOWER("L2") LIKE $3)' +
      ' ORDER BY background_fit DESC LIMIT 6',
      [kw, kw, kw]
    );
    segments.push(...tier1);

    if (segments.length < 5) {
      const { rows: tier2 } = await pool.query(
        "SELECT * FROM segments WHERE retrieval_scope='resume_edit' AND generality='universal' AND (confidence='high' OR confidence IS NULL)" +
        ' ORDER BY background_fit DESC LIMIT 8'
      );
      const ids = new Set(segments.map((s) => s.id));
      for (const s of tier2) { if (!ids.has(s.id)) segments.push(s); }
    }

    const { rows: tier3 } = await pool.query(
      "SELECT * FROM segments WHERE retrieval_scope='resume_edit' AND (generality='industry-specific' OR generality='role-specific')" +
      ' AND (LOWER(topic) LIKE $1 OR LOWER("L1") LIKE $2 OR LOWER("L2") LIKE $3)' +
      ' ORDER BY industry_fit ASC LIMIT 5',
      [kw, kw, kw]
    );
    { const ids = new Set(segments.map((s) => s.id)); for (const s of tier3) { if (!ids.has(s.id)) segments.push(s); } }

    if (segments.length < 8) {
      const { rows: tier4 } = await pool.query("SELECT * FROM segments WHERE retrieval_scope='resume_edit' ORDER BY background_fit DESC LIMIT 12");
      const ids = new Set(segments.map((s) => s.id));
      for (const s of tier4) { if (!ids.has(s.id)) segments.push(s); }
    }
    segments = segments.slice(0, 12);

    // ── 2. Before/after pairs (need 12 for 4 mentors x 3 each) ──
    let pairs = [];
    const problemText =
      (Array.isArray(keyProblems) ? keyProblems.join(' ') : keyProblems || '') + ' ' + (jobTitle || '');
    const kwList = problemText
      .toLowerCase()
      .split(/[\s,\n]+/)
      .filter((w) => w.length > 2)
      .slice(0, 8);
    for (const w of kwList) {
      const { rows: found } = await pool.query(
        'SELECT * FROM before_after_pairs WHERE LOWER(issue_tags_json) LIKE $1 OR LOWER("before") LIKE $2 OR LOWER(reason) LIKE $3 LIMIT 3',
        ['%' + w + '%', '%' + w + '%', '%' + w + '%']
      );
      pairs.push(...found);
      if (pairs.length >= 12) break;
    }
    if (pairs.length < 6) {
      const { rows: fb } = await pool.query('SELECT * FROM before_after_pairs ORDER BY RANDOM() LIMIT 12');
      const seen = new Set(pairs.map((p) => p.id));
      for (const p of fb) { if (!seen.has(p.id)) pairs.push(p); }
    }
    pairs = pairs.slice(0, 12);
    console.log('[Mentor] segments:', segments.length, 'pairs:', pairs.length);

    // ── 3. Build prompt ─────────────────────────────────────────
    const segText = segments
      .map(
        (s, i) =>
          `[S${i + 1}] ${s.generality || ''} confidence:${s.confidence || ''} fit:${s.background_fit || 0}\n` +
          `  topic:${s.topic || ''} L1:${s.L1 || ''}\n` +
          `  insight:${(s.I_insight || '').slice(0, 100)}\n` +
          `  action:${(s.A_action || '').slice(0, 90)}\n` +
          `  example:${(s.E_example || '').slice(0, 100)}`
      )
      .join('\n');

    const pairText = pairs
      .map(
        (p, i) =>
          `[P${i + 1}] before:${(p.before || '').slice(0, 100)} | after:${(p.after || '').slice(0, 130)} | reason:${(p.reason || '').slice(0, 70)}`
      )
      .join('\n');

    const problemsStr = (Array.isArray(keyProblems) ? keyProblems.slice(0, 5) : [keyProblems || ''])
      .map((p, i) => `${i + 1}. ${p}`)
      .join('\n');

    const systemPrompt =
      'You are a resume coaching AI. Output ONLY a valid JSON array — no markdown, no code fences, no extra text. ' +
      'The array has exactly 4 objects. Each object has these exact keys: ' +
      'name, company, role, avatar, tag, credentials, career_path, adviceList. ' +
      'adviceList is an array of exactly 3 objects, each with keys: priority, issue, strategy, current, advice, beforeAfter. ' +
      'beforeAfter has keys: before, after. ' +
      'Wrap any fabricated/estimated numbers in [[double brackets]] in beforeAfter.after and advice fields. ' +
      'All free-text fields in Chinese EXCEPT: name, company, role, credentials pill text, career_path company names, ' +
      'and beforeAfter.before / beforeAfter.after which MUST be written in English (they are English resume bullet points).';

    const userPrompt =
      `Resume target: ${jobTitle || 'unknown'} | ATS: ${atsScore || '?'}/100\n` +
      `Key problems:\n${problemsStr}\n\n` +
      `KNOWLEDGE BASE segments (priority-ordered):\n${segText}\n\n` +
      `REWRITE EXAMPLES:\n${pairText}\n\n` +
      `Rules for the 4 mentors:\n` +
      `- Each mentor is from a DIFFERENT company and focuses on a DIFFERENT problem area\n` +
      `- company: Google / Amazon / Goldman Sachs / McKinsey / Meta / Apple / Microsoft\n` +
      `- avatar: one emoji fitting the company/role\n` +
      `- credentials: 3 pills e.g. ["10年产品经验","前Google PM","专注北美求职"]\n` +
      `- career_path: realistic career progression e.g. "咨询公司 → 快消品牌 → 科技公司（Amazon）"\n` +
      `\nRules for adviceList (3 items per mentor, ALL different angles):\n` +
      `  item 0: priority="必改" — the single most critical fix\n` +
      `  item 1: priority="建议改" — important improvement\n` +
      `  item 2: priority="补充" — bonus differentiator\n` +
      `  Each item:\n` +
      `  - issue: 20-40 chars, core problem headline\n` +
      `  - strategy: 70-120 chars, start with "[Company]在筛选[role]时," + screening philosophy from KB\n` +
      `  - current: 70-110 chars, 2-3 specific gaps found in this resume\n` +
      `  - advice: MUST use format "(1) ... (2) ... (3) ..." with each step as a separate sentence; 90-150 chars total\n` +
      `  - beforeAfter.before: original weak English resume bullet 15-40 chars (from REWRITE EXAMPLES if possible)\n` +
      `  - beforeAfter.after: improved English resume bullet 20-50 chars, wrap invented numbers in [[brackets]]`;

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    console.log('[Mentor] Calling Claude for 4 mentors x 3 advice groups...');
    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 6000,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    });
    const rawText = message.content[0].text.trim();
    console.log('[Mentor] Done. Length:', rawText.length, 'stop:', message.stop_reason);

    let mentors = [];
    try {
      const cleaned = rawText.replace(/^```[a-z]*\n?/i, '').replace(/\n?```$/i, '').trim();
      const m = cleaned.match(/\[[\s\S]*\]/);
      mentors = JSON.parse(m ? m[0] : cleaned);
    } catch (e) {
      console.error('[Mentor] JSON parse error:', e.message, '| raw:', rawText.substring(0, 300));
      return Response.json(
        { error: 'Failed to parse mentor JSON', raw: rawText.substring(0, 500) },
        { status: 500 }
      );
    }

    return Response.json({ success: true, mentors, timestamp: new Date().toISOString() });
  } catch (error) {
    console.error('[Mentor] Error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
