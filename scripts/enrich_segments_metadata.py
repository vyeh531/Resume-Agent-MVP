"""
Deterministic metadata enrichment for the segments table.

Reads existing Chinese PLAIEHT fields and infers retrieval metadata using
keyword/rule matching — no AI API calls.

Usage:
    python scripts/enrich_segments_metadata.py [--db PATH] [--force]
                                               [--batch-size N] [--limit N]
                                               [--rebuild-fts]

    --force       : Re-enrich rows that already have metadata
    --batch-size  : Rows committed per transaction (default: 200)
    --limit N     : Only process first N rows (0 = all)
    --rebuild-fts : Rebuild the FTS5 index after enrichment

    Or set env var: MENTOR_KB_DB_PATH=path/to/mentor_kb-v5.db
"""

import argparse
import logging
import os
import re
import sqlite3
import sys
import unicodedata
from pathlib import Path

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Text utilities
# ---------------------------------------------------------------------------

def normalize_text(*fields) -> str:
    """Merge and lowercase multiple nullable fields into one string for matching."""
    return " ".join(str(f) for f in fields if f).lower()


# Common Chinese → English tokens used in resume-coaching topics
_CN_EN_TOKENS = {
    "简历": "resume", "定向投递": "targeted_application", "按岗位": "by_role",
    "多版本": "multi_version", "维护": "maintain", "机筛": "ats_filter",
    "技能": "skill", "关键词": "keyword", "经历": "experience",
    "项目": "project", "格式": "format", "规范": "standard",
    "版块": "section", "排序": "ordering", "优化": "optimize",
    "量化": "quantify", "结果": "result", "求职": "job_search",
    "策略": "strategy", "面试": "interview", "薪资": "salary",
    "职业": "career", "规划": "planning", "应届": "new_grad",
    "转行": "career_switch", "目标": "target", "岗位": "role",
    "行业": "industry", "投递": "application", "版本": "version",
    "技术": "technical", "工程师": "engineer", "数据": "data",
    "分析": "analysis", "产品": "product", "经理": "manager",
    "市场": "marketing", "动词": "verb", "内容": "content",
    "匹配": "match", "挖掘": "extraction", "描述": "description",
    "展示": "showcase", "提升": "improve", "标题": "title",
    "定位": "positioning", "联系": "contact", "教育": "education",
    "成就": "achievement", "板块": "section", "简介": "summary",
}


def _ascii_slug(text: str) -> str:
    if not text:
        return ""
    for cn, en in _CN_EN_TOKENS.items():
        text = text.replace(cn, f" {en} ")
    text = unicodedata.normalize("NFKD", text)
    text = text.encode("ascii", "ignore").decode("ascii")
    text = re.sub(r"[^a-z0-9]+", "_", text.lower()).strip("_")
    return text[:60]


# Curated L1 → base slug
_L1_SLUG_MAP = {
    "求职策略":  "job_search_strategy",
    "格式规范":  "resume_format",
    "技能板块":  "skills_section",
    "经历描述":  "experience_description",
    "项目经历":  "project_experience",
    "教育背景":  "education",
    "个人简介":  "personal_summary",
    "ATS优化":   "ats_optimization",
    "投递策略":  "application_strategy",
    "面试准备":  "interview_preparation",
    "薪资谈判":  "salary_negotiation",
    "职业规划":  "career_planning",
    "求职心态":  "job_search_mindset",
    "市场认知":  "market_understanding",
    "领英优化":  "linkedin_optimization",
    "内容挖掘":  "content_extraction",
    "成就量化":  "achievement_quantification",
    "简历整体":  "resume_overall",
    "简历结构":  "resume_structure",
    "转行建议":  "career_switch_advice",
}

# Curated L1|L2 → full slug
_L1L2_SLUG_MAP = {
    "求职策略|简历版本规划":         "resume_versioning_by_target_role",
    "求职策略|ATS机筛机制":           "ats_filter_mechanism",
    "格式规范|版块顺序":              "resume_section_ordering",
    "技能板块|Skills版块结构优化":    "skills_section_structure",
    "经历描述|项目技术细节展示":      "project_technical_detail_showcase",
    "格式规范|日期格式":              "resume_date_format",
    "个人简介|Summary撰写":           "summary_writing",
    "求职策略|目标岗位定位":          "target_role_positioning",
    "经历描述|量化成就":              "quantified_achievements",
    "经历描述|动词选择":              "action_verb_selection",
}


def make_slug(row: dict) -> str:
    l1 = (row.get("L1") or "").strip()
    l2 = (row.get("L2") or "").strip()
    key = f"{l1}|{l2}"
    if key in _L1L2_SLUG_MAP:
        return _L1L2_SLUG_MAP[key]
    if l1 in _L1_SLUG_MAP:
        base = _L1_SLUG_MAP[l1]
        l2_slug = _ascii_slug(l2)
        return f"{base}_{l2_slug}" if l2_slug else base
    topic_slug = _ascii_slug(row.get("topic") or "")
    return topic_slug if topic_slug else f"segment_{row.get('id', '0')}"


# ---------------------------------------------------------------------------
# Role family inference
# ---------------------------------------------------------------------------

_ROLE_FAMILY_PATTERNS = {
    "software_engineer": [
        "后端", "前端", "full stack", "full-stack", "software engineer",
        "software development", "spring boot", "rest api", "redis", "react",
        "typescript", "node.js", "nodejs", "aws", "ci/cd", " java ",
        "golang", "kubernetes", "docker", "microservices", "distributed",
        "软件工程", "工程师", "backend", "frontend", "web development",
        "开发", "编程", "coding", " api", "system design", "系统设计",
        "leetcode", "algorithms", "算法", "数据库", "database",
        "c++", "c#", ".net", "angular", "vue ", "flask", "django",
        "spring", "hibernate", "jenkins", "sde ", " swe ",
    ],
    "ai_engineer": [
        "ai engineer", "ai工程师", " llm", "large language model",
        "generative ai", "生成式ai", "fine-tuning", "fine tuning",
        "rag", "retrieval augmented", "openai", "hugging face", "huggingface",
        "langchain", "模型部署", "model deployment",
    ],
    "machine_learning": [
        "machine learning", " ml ", "ml工程师", "机器学习", "深度学习",
        "deep learning", "模型", "pytorch", "tensorflow", "cnn", " rnn",
        "transformer", "bert", " gpt", "nlp", "computer vision",
        "neural network", "神经网络", "data science", "数据科学",
        "sklearn", "scikit-learn", "xgboost", "feature engineering",
    ],
    "data_analyst": [
        "data analyst", "data analysis", "数据分析", " sql", "dashboard",
        " bi ", "tableau", "power bi", "excel", "数据可视化",
        "data visualization", "reporting", "analytics", "looker",
        "business intelligence", "数据报表",
    ],
    "product_manager": [
        "product manager", " pm ", "产品", "产品经理", "roadmap",
        "user research", "用户研究", "stakeholder", "product strategy",
        "产品策略", "agile", "sprint", "backlog", "prd", "用户故事",
    ],
    "marketing": [
        "marketing", "营销", "增长", "growth", "seo", "sem", "campaign",
        "市场", "brand", "品牌", "content marketing", "social media",
        "digital marketing", "performance marketing", "投放", "广告",
    ],
}


def infer_role_family(row: dict) -> str:
    text = normalize_text(
        row.get("topic"), row.get("L1"), row.get("L2"),
        row.get("P_mentor"), row.get("A_action"), row.get("I_insight"),
        row.get("E_example"), row.get("advice_type"),
    )
    found = []
    for family, patterns in _ROLE_FAMILY_PATTERNS.items():
        if any(p in text for p in patterns):
            found.append(family)

    # Seed from existing target_role_family if inference is empty
    trf = (row.get("target_role_family") or "").lower()
    if "software" in trf and "software_engineer" not in found:
        found.append("software_engineer")
    if "data" in trf and "data_analyst" not in found and "machine_learning" not in found:
        found.append("data_analyst")
    if "product" in trf and "product_manager" not in found:
        found.append("product_manager")

    if row.get("generality") == "universal" and "universal" not in found:
        found.append("universal")
    if not found:
        found.append("universal")

    return ",".join(dict.fromkeys(found))


# ---------------------------------------------------------------------------
# Target roles inference
# ---------------------------------------------------------------------------

_TARGET_ROLE_PATTERNS = {
    "backend_engineer": [
        "后端", "backend", "back-end", "spring boot", " java ", "spring ",
        "rest api", "服务端", "server side",
    ],
    "frontend_engineer": [
        "前端", "frontend", "front-end", "react", "vue ", "angular",
        "typescript", "javascript", "css ", "html ", "ui developer",
    ],
    "full_stack_engineer": [
        "full stack", "full-stack", "全栈",
    ],
    "software_engineer": [
        "software engineer", " swe ", "software developer", "软件工程师", "程序员",
    ],
    "software_development_engineer": [
        "software development engineer", " sde ", "amazon sde", "microsoft sde",
    ],
    "ai_engineer": [
        "ai engineer", "ai工程师", " llm ", "generative ai", "大模型工程师",
    ],
    "machine_learning_engineer": [
        "machine learning engineer", "ml engineer", " mle ", "ml工程师",
        "deep learning engineer", "pytorch", "tensorflow",
    ],
    "data_analyst": [
        "data analyst", "数据分析师", "bi analyst",
    ],
    "data_scientist": [
        "data scientist", "数据科学家",
    ],
    "product_manager": [
        "product manager", "产品经理", " pm ",
    ],
    "business_analyst": [
        "business analyst", "业务分析", "商业分析",
    ],
}


def infer_target_roles(row: dict) -> str:
    text = normalize_text(
        row.get("topic"), row.get("L1"), row.get("L2"),
        row.get("P_mentor"), row.get("A_action"), row.get("E_example"),
        row.get("advice_type"),
    )
    found = []
    for role, patterns in _TARGET_ROLE_PATTERNS.items():
        if any(p.lower() in text for p in patterns):
            found.append(role)

    # Seed from existing target_role column
    existing_tr = (row.get("target_role") or "").lower()
    if "software engineer" in existing_tr:
        for r in ("software_engineer", "software_development_engineer"):
            if r not in found:
                found.append(r)
    if "data" in existing_tr and not any("data" in f for f in found):
        found.append("data_analyst")
    if "product" in existing_tr and "product_manager" not in found:
        found.append("product_manager")

    if not found:
        found.append("universal")
    return ",".join(dict.fromkeys(found))


# ---------------------------------------------------------------------------
# Seniority inference
# ---------------------------------------------------------------------------

_SENIORITY_PATTERNS = {
    "student": [
        "学生", " student", "university", "college", "大学", "在校",
        "coursework", "课程", "undergraduate", " master", " phd",
        "研究生", "本科", "高校", "校园", "在读",
    ],
    "new_grad": [
        "new grad", "recent grad", "应届", "应届生", "毕业生",
        "fresh graduate", "刚毕业",
    ],
    "entry_level": [
        "entry level", "entry-level", " junior", "初级", "入门",
        "0-1年", "第一份工作", "刚入职",
    ],
    "early_career": [
        "early career", "1-3年", "职场新人", " associate ", "职业初期",
    ],
    "experienced": [
        " senior", " staff ", " principal", " lead ", "资深", "高级",
        "5年", "7年", "10年", "多年经验",
    ],
    "career_switcher": [
        "转行", "career switch", "career change", "career pivot",
        "转专业", "跨行", "非科班", "换行业", "跨领域",
    ],
}


def infer_seniority(row: dict) -> str:
    text = normalize_text(
        row.get("topic"), row.get("L1"), row.get("L2"),
        row.get("P_mentor"), row.get("A_action"), row.get("I_insight"),
        row.get("H_hook"), row.get("advice_type"),
    )
    found = []
    for level, patterns in _SENIORITY_PATTERNS.items():
        if any(p.lower() in text for p in patterns):
            found.append(level)

    if row.get("generality") == "universal":
        if not found:
            found = ["student", "new_grad", "entry_level", "early_career", "universal"]
        elif "universal" not in found:
            found.append("universal")
    if not found:
        found.append("universal")
    return ",".join(dict.fromkeys(found))


# ---------------------------------------------------------------------------
# ATS dimension inference
# ---------------------------------------------------------------------------

_ATS_DIMENSION_PATTERNS = {
    "A_format": [
        "格式", " format", "formatting", "排版", "layout", "template",
        "模板", "版块", "date format", "日期格式", "font", "字体",
        "页边距", "一页", "one page", "版块顺序", "版块排序",
    ],
    "B_contact": [
        "linkedin", "联系方式", " contact", " gpa", "成绩", "coursework",
        "课程", "email", "邮箱", "phone", "电话", "github", "portfolio",
        "作品集", "简介链接", "个人主页",
    ],
    "C_content_quality": [
        "量化", "quantified", "measurable", "可量化", "metrics", "指标",
        "result", "结果", "成效", "impact", "影响", "action verb",
        "动词", "成就", "achievement", "accomplishment",
        "strong verb", "%", "百分比", "具体数字",
    ],
    "D_keyword_match": [
        " ats", "机筛", "keyword", "关键词", " jd", "job description",
        "职位描述", "keyword match", "匹配", "关键词命中",
        "ats匹配", "关键词覆盖", "exact match", "精准匹配",
        "技能关键词", "match数量", "关键词密度",
    ],
    "E_market_fit": [
        "美国", "us market", "american", "美国市场", "relocation",
        "签证", "visa", "work authorization", "h1b", "opt", "cpt",
        "北美", "north america", "中国经验", "海归", "国内经验",
    ],
    "F_role_fit": [
        "目标岗位", "target role", "role positioning", "岗位定位",
        "resume version", "简历版本", "多版本", "定位",
        "career objective", "求职目标", "针对性", "tailored",
        "投后端", "投前端", "投ai", "版本维护",
    ],
}


def infer_ats_dimensions(row: dict) -> str:
    text = normalize_text(
        row.get("topic"), row.get("L1"), row.get("L2"),
        row.get("P_mentor"), row.get("A_action"), row.get("I_insight"),
        row.get("E_example"), row.get("HR_os"), row.get("advice_type"),
    )
    found = []
    for dim, patterns in _ATS_DIMENSION_PATTERNS.items():
        if any(p.lower() in text for p in patterns):
            found.append(dim)
    if not found:
        found.append("C_content_quality")
    return ",".join(dict.fromkeys(found))


# ---------------------------------------------------------------------------
# Problem tag inference
# ---------------------------------------------------------------------------

_PROBLEM_TAG_PATTERNS = {
    "missing_exact_job_title": [
        "exact title", "精准职位", "job title", "标题匹配", "目标职位名称",
        "exact job title",
    ],
    "low_hard_skill_match": [
        "技术栈", "hard skill", "技术技能", "technical skill", "硬技能",
        "缺技术", "技能缺失", "技术关键词", "skill match",
    ],
    "low_soft_skill_match": [
        "soft skill", "软技能", "沟通", "communication", "leadership",
        "领导力", "teamwork", "团队协作",
    ],
    "weak_summary_role_alignment": [
        "summary", "个人简介", "概述", " profile", "objective",
        "求职目标", "定位不明", "概要",
    ],
    "missing_priority_keywords": [
        "关键词缺失", "missing keyword", "优先关键词", "高频词",
        "必要关键词", "核心技能词", "缺少关键词", "关键词不够",
        "关键词不足", "priority keyword",
    ],
    "missing_distributed_systems": [
        "distributed", "分布式", "distributed systems", "分布式系统",
        "分布式架构",
    ],
    "missing_microservices": [
        "microservices", "微服务", "service mesh", "kubernetes", " k8s",
    ],
    "missing_code_review_documentation": [
        "code review", "代码审查", "documentation", "文档", "pull request",
    ],
    "weak_experience_keyword_evidence": [
        "项目里", "经历里", "工作经历中", "experience section",
        "经验部分", "关键词在项目", "项目描述中", "经历中体现",
    ],
    "keywords_only_in_skills": [
        "技能列表", "skills section", "技能区", "只在技能栏",
        "技能部分", "skills版块", "技能版块",
    ],
    "low_jd_keyword_match": [
        "jd关键词", "jd匹配", "ats匹配低", "关键词命中率",
        "keyword match", "命中率低", "jd要求", "jd技术词",
        "匹配度低", "match率低",
    ],
    "generic_resume_positioning": [
        "通用简历", "generic resume", "一份简历", "简历走天下",
        "万能简历", "通用版本", "一简历投所有",
    ],
    "low_role_specificity": [
        "针对性", "岗位针对性", "role specific", "缺乏针对性",
        "不够针对", "针对岗位",
    ],
    "weak_target_role_alignment": [
        "目标岗位匹配", "角色匹配", "岗位对齐", "role alignment",
        "简历不匹配岗位", "岗位不匹配", "定向投递",
    ],
    "resume_not_tailored_to_jd": [
        "针对jd", "tailored", "定制简历", "按jd修改", "对应jd",
        "根据jd", "jd定制",
    ],
    "universal_resume_problem": [
        "所有岗位", "全部岗位", "all positions", "简历走天下", "通吃",
    ],
    "low_measurable_results": [
        "缺量化", "没有数字", "no metrics", "无数据", "量化结果",
        "可量化成就", "缺少数字", "没有量化",
    ],
    "weak_action_verbs": [
        "弱动词", "weak verb", "动词不强", "负责", "responsible for",
        "动词强度", "动词选择",
    ],
    "weak_result_orientation": [
        "结果导向", "result oriented", "无结果", "缺结果", "成效不明",
        "缺乏结果", "没有结果",
    ],
    "missing_linkedin": [
        "linkedin", "领英", "缺linkedin", "没有linkedin", "linkedin profile",
    ],
    "missing_portfolio": [
        "portfolio", "作品集", "项目链接", "github link", "展示链接",
    ],
    "outdated_resume": [
        "过时", "outdated", "旧简历", "版本老",
    ],
    "missing_relocation_signal": [
        "relocation", "地点", "location", "签证状态",
        "work authorization", "工作地点",
    ],
    "formatting_penalty_triggered": [
        "格式问题", "formatting issue", "ats不识别", "格式错误",
        "乱码", "解析错误",
    ],
    "short_tenure_unclear": [
        "短期", "short tenure", "跳槽", "工作时间短", " gap", "空窗期",
    ],
    "education_details_missing": [
        "学历", "education", "degree", " gpa", "课程", "coursework",
        "教育背景缺失",
    ],
}


def infer_problem_tags(row: dict) -> str:
    text = normalize_text(
        row.get("topic"), row.get("L1"), row.get("L2"),
        row.get("P_mentor"), row.get("A_action"), row.get("I_insight"),
        row.get("E_example"), row.get("HR_os"), row.get("advice_type"),
    )
    found = [tag for tag, pats in _PROBLEM_TAG_PATTERNS.items() if any(p.lower() in text for p in pats)]
    return ",".join(dict.fromkeys(found))


# ---------------------------------------------------------------------------
# Keywords inference
# ---------------------------------------------------------------------------

_KEYWORD_TOKENS = [
    ("ATS",                   ["ats", "机筛", "applicant tracking"]),
    ("JD match",              ["jd match", "jd匹配", "job description match"]),
    ("keyword match",         ["keyword match", "关键词匹配", "关键词命中"]),
    ("targeted resume",       ["targeted resume", "针对性简历", "定向简历"]),
    ("resume version",        ["resume version", "简历版本", "多版本简历"]),
    ("resume tailoring",      ["resume tailoring", "简历定制", "定制简历"]),
    ("backend engineer",      ["后端", "backend", "back-end"]),
    ("frontend engineer",     ["前端", "frontend", "front-end"]),
    ("AI engineer",           ["ai engineer", "ai工程师"]),
    ("machine learning engineer", ["machine learning engineer", "ml engineer"]),
    ("software engineer",     ["software engineer", "软件工程师"]),
    ("data analyst",          ["data analyst", "数据分析师"]),
    ("product manager",       ["product manager", "产品经理"]),
    ("Spring Boot",           ["spring boot"]),
    ("REST API",              ["rest api", "restful api"]),
    ("Redis",                 ["redis"]),
    ("React",                 ["react"]),
    ("TypeScript",            ["typescript"]),
    ("Node.js",               ["node.js", "nodejs"]),
    ("AWS",                   ["aws", "amazon web services"]),
    ("Docker",                ["docker"]),
    ("Kubernetes",            ["kubernetes", " k8s"]),
    ("PyTorch",               ["pytorch"]),
    ("TensorFlow",            ["tensorflow"]),
    ("CNN",                   ["cnn "]),
    ("Transformer",           ["transformer", " bert", " gpt"]),
    ("SQL",                   [" sql"]),
    ("Python",                ["python"]),
    ("Java",                  [" java "]),
    ("C++",                   ["c++"]),
    ("quantified results",    ["量化", "quantified", "measurable"]),
    ("action verbs",          ["action verb", "动词"]),
    ("LinkedIn",              ["linkedin", "领英"]),
    ("GitHub",                ["github"]),
    ("portfolio",             ["portfolio", "作品集"]),
    ("career switch",         ["转行", "career switch"]),
    ("new grad",              ["new grad", "应届", "应届生"]),
    ("internship",            ["internship", "实习"]),
    ("relocation",            ["relocation", "搬迁"]),
    ("work authorization",    ["work authorization", "签证", " opt", " h1b"]),
    ("microservices",         ["microservices", "微服务"]),
    ("distributed systems",   ["distributed systems", "distributed system", "分布式系统"]),
    ("system design",         ["system design", "系统设计"]),
]


def infer_keywords(row: dict) -> str:
    text = normalize_text(
        row.get("topic"), row.get("L1"), row.get("L2"),
        row.get("P_mentor"), row.get("A_action"), row.get("I_insight"),
        row.get("E_example"), row.get("HR_os"), row.get("H_hook"),
    )
    found = [kw for kw, pats in _KEYWORD_TOKENS if any(p.lower() in text for p in pats)]
    return ",".join(dict.fromkeys(found))


# ---------------------------------------------------------------------------
# Priority
# ---------------------------------------------------------------------------

def infer_priority(row: dict) -> int:
    score = 3
    conf = (row.get("confidence") or "").lower()
    if conf == "high":
        score += 1
    elif conf == "low":
        score -= 1

    gen = (row.get("generality") or "").lower()
    if gen == "universal":
        score += 1
    elif gen == "role-specific":
        score -= 1

    if (row.get("background_fit") or 0.0) < 0.3:
        score -= 1

    text = normalize_text(row.get("topic"), row.get("L1"), row.get("P_mentor"))
    if any(s in text for s in ["ats", "机筛", "keyword", "关键词", "jd匹配"]):
        score += 1

    return max(1, min(5, score))


# ---------------------------------------------------------------------------
# Unlock tier
# ---------------------------------------------------------------------------

def _likely_requires_ai_rewrite(row: dict) -> bool:
    text = normalize_text(row.get("A_action"), row.get("advice_type"))
    signals = ["改写", "rewrite", "重写", "ai改", "生成", "generate", "personalized"]
    return any(s in text for s in signals)


def infer_unlock_tier(row: dict) -> str:
    if _likely_requires_ai_rewrite(row):
        return "premium"
    gen = (row.get("generality") or "").lower()
    if gen == "universal":
        return "free"
    if row.get("E_example") and row.get("A_action"):
        return "paid"
    return "free"


# ---------------------------------------------------------------------------
# User-facing card fields
# ---------------------------------------------------------------------------

_CARD_TITLE_MAP = {
    "简历版本规划":       "不要一份简历投所有岗位",
    "ATS机筛机制":        "关键词匹配是ATS机筛的核心",
    "Skills版块结构优化": "按属性重组你的技能板块",
    "项目技术细节展示":   "在项目描述中显性写出框架和模型",
    "版块顺序":           "应届生简历：Education应置顶",
    "日期格式":           "统一简历中的日期格式",
    "Summary撰写":        "Summary要直接说明你的目标岗位",
    "目标岗位定位":       "简历要清晰展示你的目标岗位",
    "量化成就":           "用数字量化你的项目成果",
    "动词选择":           "用强动词开头每条简历子弹",
}


def build_advice_card_title(row: dict) -> str:
    l2 = (row.get("L2") or "").strip()
    if l2 in _CARD_TITLE_MAP:
        return _CARD_TITLE_MAP[l2]
    p = (row.get("P_mentor") or "").strip()
    if p:
        for sep in ("。", "，", "；"):
            idx = p.find(sep)
            if 0 < idx <= 30:
                return p[:idx].strip()
        return p[:25].strip() + ("..." if len(p) > 25 else "")
    return (row.get("topic") or "")[:30] or "导师建议"


def build_user_problem_summary(row: dict) -> str:
    p = (row.get("P_mentor") or "").strip()
    if not p:
        return "你的简历在这个方面可能有改进空间。"
    if len(p) <= 65:
        return p
    for sep in ("。", "；", "，"):
        idx = p.find(sep)
        if 0 < idx <= 65:
            return p[:idx + 1].strip()
    return p[:63].strip() + "..."


def build_action_summary(row: dict) -> str:
    a = (row.get("A_action") or "").strip()
    if not a:
        return "请参考导师建议进行优化。"
    if len(a) <= 65:
        return a
    for sep in ("。", "；", "，"):
        idx = a.find(sep)
        if 0 < idx <= 65:
            return a[:idx + 1].strip()
    return a[:63].strip() + "..."


# ---------------------------------------------------------------------------
# Retrieval text
# ---------------------------------------------------------------------------

def build_retrieval_text(row: dict, enriched: dict) -> str:
    parts = []
    for label, key in (
        ("Topic", "topic"), ("L1", "L1"), ("L2", "L2"),
    ):
        if row.get(key):
            parts.append(f"{label}: {row[key]}")
    for label, key in (
        ("Role family", "role_family"),
        ("Target roles", "target_roles"),
        ("Seniority", "seniority"),
        ("ATS dimensions", "ats_dimensions"),
        ("Problem tags", "problem_tags"),
        ("Keywords", "keywords"),
    ):
        if enriched.get(key):
            parts.append(f"{label}: {enriched[key]}")
    for label, key in (
        ("Mentor diagnosis", "P_mentor"),
        ("Action", "A_action"),
        ("Insight", "I_insight"),
        ("Example", "E_example"),
        ("HR/ATS perspective", "HR_os"),
    ):
        if row.get(key):
            parts.append(f"{label}: {row[key]}")
    return "\n".join(parts)


# ---------------------------------------------------------------------------
# Mentor quality score
# ---------------------------------------------------------------------------

def calculate_mentor_quality_score(row: dict) -> float:
    score = 0.5
    conf = (row.get("confidence") or "").lower()
    if conf == "high":
        score += 0.15
    elif conf == "medium":
        score += 0.05
    if row.get("A_action"):
        score += 0.10
    if row.get("E_example"):
        score += 0.10
    if row.get("HR_os"):
        score += 0.10
    if row.get("I_insight"):
        score += 0.05
    return round(min(1.0, max(0.0, score)), 4)


# ---------------------------------------------------------------------------
# Safe/rewrite flags
# ---------------------------------------------------------------------------

def infer_safe_to_show_free(row: dict, unlock_tier: str) -> int:
    if unlock_tier == "free":
        return 1
    if _likely_requires_ai_rewrite(row):
        return 0
    if row.get("generality") == "universal":
        return 1
    return 0


def infer_requires_ai_rewrite(row: dict) -> int:
    return 1 if _likely_requires_ai_rewrite(row) else 0


# ---------------------------------------------------------------------------
# Enrich one row
# ---------------------------------------------------------------------------

def enrich_row(row: dict) -> dict:
    role_family  = infer_role_family(row)
    target_roles = infer_target_roles(row)
    seniority    = infer_seniority(row)
    ats_dims     = infer_ats_dimensions(row)
    prob_tags    = infer_problem_tags(row)
    keywords     = infer_keywords(row)
    slug         = make_slug(row)
    priority     = infer_priority(row)
    unlock_tier  = infer_unlock_tier(row)
    card_title   = build_advice_card_title(row)
    prob_sum     = build_user_problem_summary(row)
    act_sum      = build_action_summary(row)
    safe_free    = infer_safe_to_show_free(row, unlock_tier)
    req_ai       = infer_requires_ai_rewrite(row)
    mq_score     = calculate_mentor_quality_score(row)

    enriched = {
        "role_family":           role_family,
        "target_roles":          target_roles,
        "seniority":             seniority,
        "ats_dimensions":        ats_dims,
        "problem_tags":          prob_tags,
        "keywords":              keywords,
        "topic_slug":            slug,
        "priority":              priority,
        "unlock_tier":           unlock_tier,
        "advice_card_title":     card_title,
        "user_problem_summary":  prob_sum,
        "action_summary":        act_sum,
        "safe_to_show_free":     safe_free,
        "requires_ai_rewrite":   req_ai,
        "mentor_quality_score":  mq_score,
    }
    enriched["retrieval_text"] = build_retrieval_text(row, enriched)
    return enriched


# ---------------------------------------------------------------------------
# DB path resolution
# ---------------------------------------------------------------------------

def resolve_db_path(cli_arg: str | None = None) -> "Path":
    if cli_arg:
        return Path(cli_arg)
    env = os.environ.get("MENTOR_KB_DB_PATH")
    if env:
        return Path(env)
    repo_root = Path(__file__).parent.parent
    for name in ("mentor_kb-v5.db", "mentor_kb-v6.db"):
        p = repo_root / name
        if p.exists():
            return p
    raise FileNotFoundError(
        "Cannot find mentor KB database. "
        "Pass --db <path> or set MENTOR_KB_DB_PATH."
    )


# ---------------------------------------------------------------------------
# FTS5 rebuild
# ---------------------------------------------------------------------------

def rebuild_fts(conn: sqlite3.Connection):
    try:
        conn.execute("INSERT INTO segments_fts(segments_fts) VALUES('rebuild')")
        conn.commit()
        log.info("FTS5 index rebuilt.")
    except sqlite3.OperationalError as exc:
        log.warning("FTS5 rebuild skipped: %s", exc)


# ---------------------------------------------------------------------------
# Main enrichment loop
# ---------------------------------------------------------------------------

_UPDATE_SQL = """
UPDATE segments SET
    role_family           = :role_family,
    target_roles          = :target_roles,
    seniority             = :seniority,
    ats_dimensions        = :ats_dimensions,
    problem_tags          = :problem_tags,
    keywords              = :keywords,
    topic_slug            = :topic_slug,
    retrieval_text        = :retrieval_text,
    priority              = :priority,
    unlock_tier           = :unlock_tier,
    advice_card_title     = :advice_card_title,
    user_problem_summary  = :user_problem_summary,
    action_summary        = :action_summary,
    safe_to_show_free     = :safe_to_show_free,
    requires_ai_rewrite   = :requires_ai_rewrite,
    mentor_quality_score  = :mentor_quality_score
WHERE id = :_row_id
"""


def _run_enrichment(
    conn: sqlite3.Connection,
    force: bool,
    batch_size: int,
    limit: int,
    rebuild_fts_after: bool,
):
    if force:
        cur = conn.execute("SELECT * FROM segments ORDER BY id")
    else:
        cur = conn.execute(
            "SELECT * FROM segments "
            "WHERE role_family IS NULL OR role_family = '' "
            "ORDER BY id"
        )
    rows = cur.fetchall()
    total_in_db = conn.execute("SELECT COUNT(*) FROM segments").fetchone()[0]

    if limit > 0:
        rows = rows[:limit]
        log.info(
            "Processing %d/%d rows (limit=%d, force=%s)",
            len(rows), total_in_db, limit, force,
        )
    else:
        log.info(
            "Processing %d/%d rows (force=%s)",
            len(rows), total_in_db, force,
        )

    updated = 0
    for i, raw_row in enumerate(rows):
        row = dict(raw_row)
        enriched = enrich_row(row)
        enriched["_row_id"] = row["id"]
        conn.execute(_UPDATE_SQL, enriched)
        updated += 1

        if (i + 1) % batch_size == 0:
            conn.commit()
            log.info("  ... committed %d / %d rows", i + 1, len(rows))

    conn.commit()
    log.info("Enrichment complete: %d rows updated.", updated)

    if rebuild_fts_after:
        rebuild_fts(conn)


def main(args=None):
    parser = argparse.ArgumentParser(
        description="Deterministic metadata enrichment for the segments table"
    )
    parser.add_argument("--db", metavar="PATH", help="Path to SQLite database")
    parser.add_argument(
        "--force", action="store_true",
        help="Re-enrich rows that already have metadata"
    )
    parser.add_argument(
        "--batch-size", type=int, default=200, metavar="N",
        help="Rows committed per transaction (default: 200)"
    )
    parser.add_argument(
        "--limit", type=int, default=0, metavar="N",
        help="Only process first N rows (0 = all)"
    )
    parser.add_argument(
        "--rebuild-fts", action="store_true",
        help="Rebuild the FTS5 index after enrichment"
    )
    opts = parser.parse_args(args)

    db_path = resolve_db_path(opts.db)
    if not db_path.exists():
        log.error("Database not found: %s", db_path)
        sys.exit(1)

    log.info("Database: %s", db_path)
    conn = sqlite3.connect(str(db_path))
    conn.row_factory = sqlite3.Row
    try:
        _run_enrichment(
            conn,
            force=opts.force,
            batch_size=opts.batch_size,
            limit=opts.limit,
            rebuild_fts_after=opts.rebuild_fts,
        )
    finally:
        conn.close()


if __name__ == "__main__":
    main()
