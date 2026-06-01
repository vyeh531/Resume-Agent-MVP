"""
Fix truncated A_action in Postgres vibe_offer.segments.

Two categories:
1. Raw transcript leaked (contains timestamp patterns / fragmented Chinese)
   → set requires_ai_rewrite = 1, leave content as-is for manual review
2. Genuinely truncated mid-sentence (< 60 chars, no terminal punctuation)
   → try to find full sentence in chunks.json
"""
import psycopg2, json, re, os, sys
sys.stdout.reconfigure(encoding='utf-8')

for l in open('.env'):
    k, *v = l.strip().split('=')
    if k and v: os.environ.setdefault(k.strip(), '='.join(v).strip())

CHUNKS_PATH = r'C:\Users\viviy\Documents\GitHub\db_creator\data\chunks.json'
print('Loading chunks...')
with open(CHUNKS_PATH, encoding='utf-8') as f:
    chunk_map = {c['chunk_id']: c['text'] for c in json.load(f)}
print(f'Loaded {len(chunk_map)} chunks')

conn = psycopg2.connect(os.environ['DATABASE_URL'], options='-c search_path=vibe_offer')
cur = conn.cursor()

TERMINAL = set('。！？；')

def is_truncated(text):
    t = (text or '').strip()
    if not t: return False
    return t[-1] not in TERMINAL and len(t) < 80

def is_transcript_leak(text):
    t = text or ''
    return bool(
        re.search(r'\d{2}:\d{2}:\d{2}', t) or          # timestamp
        re.search(r'就是说.*然后.*然后', t) or            # fragmented filler
        re.search(r'(嗯|对对对|然后然后|就是就是){2,}', t) or
        re.search(r'[\w\s]+\s\d{2}:\d{2}:\d{2}', t)   # speaker label
    )

def clean_chunk(text):
    out = []
    for l in text.split('\n'):
        l = l.strip()
        m = re.match(r'^L\d+:\s*(.*)', l)
        if m:
            c = m.group(1).strip()
            if c and not re.match(r'^\d{4}-\d{2}', c) and \
               not re.match(r'^[\w\s]+\s\d{2}:\d{2}:\d{2}', c) and len(c) > 5:
                out.append(c)
    return ''.join(out)

def find_full_sentence(chunk_text, truncated):
    clean = clean_chunk(chunk_text)
    prefix = truncated.strip()[:15]
    idx = clean.find(prefix)
    if idx == -1: return ''
    end = idx
    while end < len(clean) and clean[end] not in '。！？；\n':
        end += 1
    full = clean[idx:end].strip()
    return full[:300] if len(full) > len(truncated) + 5 else ''

# Fetch candidates: no terminal punctuation, not too long
cur.execute("""
    SELECT id, chunk_id, "A_action"
    FROM segments
    WHERE "A_action" IS NOT NULL
      AND LENGTH(TRIM("A_action")) > 0
      AND RIGHT(TRIM("A_action"), 1) NOT IN ('。', '！', '？', '；', '）', '」', '…')
      AND LENGTH(TRIM("A_action")) < 80
""")
rows = cur.fetchall()
print(f'\nCandidates (short + no terminal punct): {len(rows)}')

leaked = 0
fixed = 0
flagged = 0

for rid, chunk_id, a_action in rows:
    a = (a_action or '').strip()

    # Category 1: transcript leak → flag for rewrite
    if is_transcript_leak(a):
        cur.execute('UPDATE segments SET requires_ai_rewrite = 1 WHERE id = %s', (rid,))
        leaked += 1
        continue

    # Category 2: truncated → try to find full sentence in chunk
    chunk_text = chunk_map.get(chunk_id or '', '')
    if chunk_text:
        full = find_full_sentence(chunk_text, a)
        if full:
            cur.execute('UPDATE segments SET "A_action" = %s WHERE id = %s', (full, rid))
            fixed += 1
            continue

    # Category 3: couldn't fix → flag for review
    cur.execute('UPDATE segments SET requires_ai_rewrite = 1 WHERE id = %s', (rid,))
    flagged += 1

conn.commit()
print(f'Transcript leaks flagged (requires_ai_rewrite=1): {leaked}')
print(f'Truncated A_action fixed from chunks: {fixed}')
print(f'Could not fix, flagged for review: {flagged}')

# Verify
cur.execute("SELECT COUNT(*) FROM segments WHERE requires_ai_rewrite = 1")
print(f'\nTotal requires_ai_rewrite=1: {cur.fetchone()[0]}')

conn.close()
print('Done.')
