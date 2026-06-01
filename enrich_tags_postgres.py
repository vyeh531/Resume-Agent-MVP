"""
Enrich problem_tags and keywords for vibe_offer.segments in Postgres.
Strategy (Option C):
  1. topic-based mapping → guarantees baseline tags for every row
  2. expanded keyword pattern matching → adds specific signals from content
Only updates rows where problem_tags = '' or keywords = ''.
"""
import psycopg2, os, sys, re
sys.stdout.reconfigure(encoding='utf-8')

for l in open('.env'):
    k, *v = l.strip().split('=')
    if k and v: os.environ.setdefault(k.strip(), '='.join(v).strip())

conn = psycopg2.connect(os.environ['DATABASE_URL'], options='-c search_path=vibe_offer')
cur = conn.cursor()
cur.execute("SET statement_timeout = '120s'")
conn.commit()

# ── 1. topic → guaranteed problem_tags baseline ───────────────────────────────
TOPIC_TO_TAGS = {
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
}

# ── 2. topic → guaranteed keywords baseline ───────────────────────────────────
TOPIC_TO_KEYWORDS = {
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
}

# ── 3. Expanded content-based pattern matching ────────────────────────────────
PROBLEM_PATTERNS = {
    'low_jd_keyword_match': [
        'jd关键词','jd匹配','ats匹配','关键词命中','keyword match','命中率','jd要求',
        '匹配度','match率','机筛','ats系统','关键词不够','关键词不足','关键词少',
        '关键词缺','没有关键词','缺关键词','keyword','筛选系统',
    ],
    'missing_priority_keywords': [
        '关键词缺失','missing keyword','优先关键词','高频词','必要关键词',
        '核心技能词','缺少关键词','关键词不够','priority keyword','核心词',
        '重要关键词','技术词汇','专业词汇',
    ],
    'low_hard_skill_match': [
        '技术栈','hard skill','技术技能','technical skill','硬技能','缺技术',
        '技能缺失','技术关键词','skill match','编程','代码','框架','语言',
        '工具','算法','数据库','python','sql','java','backend','frontend',
    ],
    'low_soft_skill_match': [
        'soft skill','软技能','沟通','communication','leadership','领导力',
        'teamwork','团队协作','人际','协作','表达','演讲','情商',
    ],
    'weak_summary_role_alignment': [
        'summary','个人简介','概述','profile','objective','求职目标',
        '定位不明','概要','自我介绍','个人陈述','开头','第一段',
    ],
    'low_measurable_results': [
        '缺量化','没有数字','no metrics','无数据','量化结果','可量化',
        '缺少数字','没有量化','数字','百分比','指标','kpi','成果',
        '效果','提升了','降低了','增加了','减少了','impact',
    ],
    'weak_action_verbs': [
        '弱动词','weak verb','动词不强','负责','responsible for','动词强度',
        '动词选择','参与了','协助了','帮助了','负责人','参与',
    ],
    'weak_result_orientation': [
        '结果导向','result oriented','无结果','缺结果','成效不明',
        '缺乏结果','没有结果','贡献','价值','影响','contribution',
    ],
    'generic_resume_positioning': [
        '通用简历','generic resume','一份简历','简历走天下','万能简历',
        '通用版本','一简历投所有','所有岗位','全部岗位',
    ],
    'low_role_specificity': [
        '针对性','岗位针对性','role specific','缺乏针对性','不够针对',
        '针对岗位','定向','有针对','有针对性','具体岗位',
    ],
    'weak_target_role_alignment': [
        '目标岗位匹配','角色匹配','岗位对齐','role alignment','简历不匹配',
        '岗位不匹配','定向投递','方向','目标岗位','目标职位','目标方向',
    ],
    'resume_not_tailored_to_jd': [
        '针对jd','tailored','定制简历','按jd修改','对应jd','根据jd','jd定制',
        '根据岗位','岗位定制','jd',
    ],
    'weak_experience_keyword_evidence': [
        '项目里','经历里','工作经历中','experience section','经验部分',
        '关键词在项目','项目描述中','经历中体现','项目中','工作中体现',
    ],
    'keywords_only_in_skills': [
        '技能列表','skills section','技能区','只在技能栏','技能部分',
        'skills版块','技能版块','技能栏','只写在技能',
    ],
    'formatting_penalty_triggered': [
        '格式问题','formatting issue','ats不识别','格式错误','乱码',
        '解析错误','格式','排版','字体','边距','页面','间距','对齐',
    ],
    'education_details_missing': [
        '学历','education','degree','gpa','课程','coursework','教育背景缺失',
        '学位','毕业','学校','学院','专业','成绩',
    ],
    'missing_portfolio': [
        'portfolio','作品集','项目链接','github link','展示链接',
        'github','作品','展示','链接','demo',
    ],
    'missing_exact_job_title': [
        'exact title','精准职位','job title','标题匹配','目标职位名称',
        '职位名称','岗位名称','头衔','title','职称',
    ],
    'short_tenure_unclear': [
        '短期','short tenure','跳槽','工作时间短','gap','空窗期',
        '离职','在职','工作年限','经验年限',
    ],
}

KEYWORD_PATTERNS = {
    'ATS':                   ['ats','机筛','applicant tracking','机器筛选'],
    'JD match':              ['jd match','jd匹配','job description match','jd要求'],
    'keyword match':         ['keyword match','关键词匹配','关键词命中','关键词'],
    'targeted resume':       ['targeted resume','针对性简历','定向简历','定制简历'],
    'resume version':        ['resume version','简历版本','多版本简历','版本简历'],
    'resume tailoring':      ['resume tailoring','简历定制','定制简历','针对jd'],
    'quantified results':    ['量化','quantified','measurable','数字','指标','百分比'],
    'action verbs':          ['action verb','动词','主动动词','强动词'],
    'LinkedIn':              ['linkedin','领英'],
    'GitHub':                ['github'],
    'portfolio':             ['portfolio','作品集'],
    'career switch':         ['转行','career switch','职业转型','跨行'],
    'new grad':              ['new grad','应届','应届生','毕业生','fresh graduate'],
    'internship':            ['internship','实习','实习生'],
    'work authorization':    ['work authorization','签证','opt','h1b','工作授权'],
    'system design':         ['system design','系统设计'],
    'behavioral interview':  ['behavioral','行为面试','bq','star法则','star框架'],
    'technical interview':   ['technical interview','技术面试','技术轮','代码面试'],
    'backend engineer':      ['后端','backend','back-end','服务端'],
    'frontend engineer':     ['前端','frontend','front-end'],
    'AI engineer':           ['ai engineer','ai工程师','人工智能'],
    'data analyst':          ['data analyst','数据分析师','da岗'],
    'software engineer':     ['software engineer','软件工程师','sde','swe'],
    'product manager':       ['product manager','产品经理','pm岗'],
    'SQL':                   [' sql',' sql查询','sql语句'],
    'Python':                ['python'],
    'Java':                  [' java '],
    'C++':                   ['c++'],
    'Spring Boot':           ['spring boot'],
    'React':                 ['react'],
    'AWS':                   ['aws','amazon web services'],
    'Docker':                ['docker'],
    'PyTorch':               ['pytorch'],
    'TensorFlow':            ['tensorflow'],
    'microservices':         ['microservices','微服务'],
    'distributed systems':   ['distributed systems','分布式系统'],
    'machine learning':      ['machine learning','机器学习','ml模型'],
    'data science':          ['data science','数据科学'],
    'GPA':                   [' gpa'],
    'cover letter':          ['cover letter','求职信'],
    'networking':            ['networking','人脉','内推','referral'],
}

def normalize(text):
    return (text or '').lower()

def infer_tags_from_content(row):
    text = ' '.join(normalize(v) for v in [
        row[2], row[3], row[4], row[5], row[6], row[7], row[8], row[9]
    ] if v)
    found = [tag for tag, pats in PROBLEM_PATTERNS.items() if any(p in text for p in pats)]
    return ','.join(dict.fromkeys(found))

def infer_keywords_from_content(row):
    text = ' '.join(normalize(v) for v in [
        row[2], row[3], row[4], row[5], row[6], row[7], row[8], row[9]
    ] if v)
    found = [kw for kw, pats in KEYWORD_PATTERNS.items() if any(p in text for p in pats)]
    return ','.join(dict.fromkeys(found))

def merge_tags(*tag_strings):
    seen = {}
    for ts in tag_strings:
        for t in (ts or '').split(','):
            t = t.strip()
            if t: seen[t] = 1
    return ','.join(seen.keys())

# ── Main enrichment loop ──────────────────────────────────────────────────────
cur.execute("""
    SELECT id, topic, "L1", "L2", "P_mentor", "A_action", "I_insight",
           "H_hook", "E_example", "HR_os", advice_type, problem_tags, keywords
    FROM segments
    WHERE problem_tags = '' OR keywords = ''
       OR problem_tags IS NULL OR keywords IS NULL
""")
rows = cur.fetchall()
print(f'Rows to enrich: {len(rows)}')

updates = []
for row in rows:
    rid, topic = row[0], row[1]
    existing_tags = row[11] or ''
    existing_kws  = row[12] or ''

    # Baseline from topic mapping
    base_tags = TOPIC_TO_TAGS.get(topic, '')
    base_kws  = TOPIC_TO_KEYWORDS.get(topic, '')

    # Content-based additions
    content_tags = infer_tags_from_content(row)
    content_kws  = infer_keywords_from_content(row)

    # Merge: existing + topic baseline + content
    final_tags = merge_tags(existing_tags, base_tags, content_tags)
    final_kws  = merge_tags(existing_kws, base_kws, content_kws)

    updates.append((final_tags, final_kws, rid))

for i, (tags, kws, rid) in enumerate(updates):
    cur.execute(
        'UPDATE segments SET problem_tags = %s, keywords = %s WHERE id = %s',
        (tags, kws, rid)
    )
    if (i + 1) % 100 == 0:
        conn.commit()
        print(f'  {i+1}/{len(updates)}')
conn.commit()
print(f'Updated {len(updates)} rows')

# ── Verify ────────────────────────────────────────────────────────────────────
cur.execute("SELECT COUNT(*) FROM segments WHERE problem_tags = '' OR problem_tags IS NULL")
print(f'Still empty problem_tags: {cur.fetchone()[0]}')
cur.execute("SELECT COUNT(*) FROM segments WHERE keywords = '' OR keywords IS NULL")
print(f'Still empty keywords: {cur.fetchone()[0]}')
cur.execute("SELECT COUNT(*) FROM segments WHERE problem_tags != '' AND problem_tags IS NOT NULL")
print(f'problem_tags populated: {cur.fetchone()[0]}')

# ── Fix HR_os placeholders ────────────────────────────────────────────────────
print('\n── HR_os placeholder cleanup ──')
for placeholder in ['暂无', '暂无HR视角', '（无）', '(无)', '暂无hr视角', '无']:
    cur.execute('UPDATE segments SET "HR_os" = NULL WHERE "HR_os" = %s', (placeholder,))
    if cur.rowcount: print(f'  "{placeholder}" → NULL: {cur.rowcount} rows')
cur.execute("""
    UPDATE segments SET "HR_os" = NULL
    WHERE "HR_os" IS NOT NULL
      AND LENGTH(TRIM("HR_os")) < 5
""")
print(f'  Too short (<5 chars) → NULL: {cur.rowcount} rows')
conn.commit()
cur.execute("SELECT COUNT(*) FROM segments WHERE \"HR_os\" IS NULL OR \"HR_os\" = ''")
print(f'  Total HR_os empty after cleanup: {cur.fetchone()[0]}')

conn.close()
print('\nDone.')
