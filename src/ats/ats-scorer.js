"use strict";

const { findRoleDictionaryEntry, inferCanonicalRoleFamily, roleToProfile } = require("./role-dictionary");
const { analyzeMarketingResume } = require("./marketing-lens");

const STOP_WORDS = new Set([
  "the", "a", "an", "and", "or", "of", "in", "to", "for", "is", "are", "be",
  "on", "at", "with", "that", "this", "we", "you", "our", "your", "as", "by",
  "it", "its", "from", "will", "can", "have", "has", "been", "not", "all",
  "also", "more", "other", "their", "than", "into", "was", "were", "but",
  "may", "use", "used", "using", "per", "new", "strong", "ability",
  "experience", "including", "such", "both", "based", "role", "work", "team",
  "make", "well", "able", "good", "any", "who", "how", "what", "they",
  "each", "when", "about", "then", "some", "these", "those", "there", "here",
  "time", "very", "just", "like", "over", "only", "which", "after", "before",
  "while", "need", "should", "would", "could", "them", "had", "within",
  "across", "responsibilities", "requirements", "preferred", "qualification",
  "qualifications", "candidate", "company", "business", "hiring",
  "distinguished", "full-service", "full", "service", "firm", "organization",
  "located", "seeking", "join", "provide", "provides", "providing", "client",
  "clients", "services", "globally", "global", "professional", "professionals", "excellent", "highly", "leading",
  "established", "committed", "dedicated", "opportunity", "position", "office",
  "include", "includes", "included", "responsibility", "responsibilities",
  "website", "http", "https", "www", "com", "net", "org", "inc", "llc", "ltd",
  "corp", "corporation", "associates", "group", "partners", "zhang",
  // Job boards & recruiting platforms — should never be keywords
  "linkedin", "indeed", "glassdoor", "handshake", "ziprecruiter", "monster",
  "careerbuilder", "lever", "greenhouse", "workday", "taleo", "jobvite",
  // Social media platforms (not developer tools)
  "twitter", "facebook", "instagram", "tiktok", "snapchat", "pinterest",
  "youtube", "reddit", "quora", "medium", "substack", "tumblr",
  "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten",
  "branch", "branches", "offices", "location", "locations", "additional",
  "headquarter", "headquarters", "headquartered", "based", "california",
  "seattle", "new", "york", "san", "francisco", "los", "angeles", "chicago",
  "boston", "austin", "dallas", "houston", "washington", "remote", "hybrid",
  "entry", "maintain", "records", "timely", "basis", "necessary", "adjustments",
  "federal", "express", "collaborates", "providers", "exceptional", "reliable",
  "cost-efficient", "real-time", "tracking", "advanced", "technology", "streamline",
  "enhancing", "transparency", "flexibility", "operating", "high-density", "cities",
  "regions", "tailor", "specific", "needs", "e-commerce", "customer-centric",
  "guarantees", "dependable", "experiences"
]);

const STRONG_VERBS = new Set([
  "led", "built", "developed", "designed", "implemented", "launched",
  "improved", "increased", "reduced", "created", "managed", "optimized",
  "analyzed", "deployed", "architected", "owned", "coordinated", "delivered",
  "scaled", "automated", "engineered", "established", "drove", "executed",
  "spearheaded", "streamlined", "accelerated", "collaborated", "partnered",
  "produced", "generated", "secured", "negotiated", "trained", "mentored",
  "diagnosed", "integrated", "migrated", "refactored", "leveraged", "authored",
  "researched", "performed", "conducted", "translated", "identified",
  "supported", "directed", "modeled", "forecasted", "validated", "tested",
  "prepared", "reconciled", "processed", "reviewed",
  // additional common resume verbs often missing from detection
  "split", "converted", "extracted", "achieved", "enhanced", "expanded",
  "eliminated", "introduced", "transformed", "configured", "enabled",
  "constructed", "rewrote", "adopted", "overhauled", "compiled", "applied",
  "restructured", "upgraded", "unified", "connected", "controlled",
  "prevented", "maintained", "resolved", "fixed", "shipped", "extended",
  "defined", "proposed", "acquired", "retained", "measured", "monitored",
  "documented", "published", "presented", "influenced", "prioritized",
  "evaluated", "standardized", "modernized", "containerized", "orchestrated",
  "provisioned", "instrumented", "debugged", "profiled", "indexed",
  "sharded", "cached", "batched", "parallelized", "vectorized",
  "designed", "built", "launched", "implemented"
]);

// Verb / synonym expansion map for soft skills.
// When a JD requires these skill terms and the resume contains the listed
// action verbs or synonyms, it counts as a match.
// e.g. "led" / "lead" in a resume → matches "leadership" in the JD
//      "collaborated" / "partnered" → matches "cross-functional collaboration"
const SKILL_VERB_MAP = {
  // ── Leadership ────────────────────────────────────────────────────────────
  "leadership":             ["lead", "led", "leads", "headed", "heading", "directed", "supervised", "oversaw", "managed"],
  "leadership skills":      ["lead", "led", "leads", "headed", "supervised", "oversaw"],
  "team leadership":        ["lead", "led", "supervised", "oversaw", "managed team", "team lead"],
  "leadership development": ["lead", "led", "mentored", "coached", "developed team"],
  "people management":      ["managed", "supervised", "led", "directed", "oversaw"],

  // ── Cross-functional / collaboration ──────────────────────────────────────
  "cross-functional":               ["collaborate", "collaborated", "collaborating", "collaboration", "cross-team", "partnered", "coordinated"],
  "cross-functional collaboration": ["collaborate", "collaborated", "collaborating", "collaboration", "cross-team", "partnered", "coordinated", "aligned"],
  "collaboration":                  ["collaborate", "collaborated", "collaborating", "partnered", "coordinated"],
  "cross-team collaboration":       ["collaborate", "collaborated", "cross-team", "partnered", "coordinated"],
  "stakeholder management":         ["collaborate", "collaborated", "partnered", "coordinated", "aligned", "communicated"]
};

const SEMANTIC_MATCH_MAP = {
  "software development engineer": ["software engineer", "software developer", "sde", "swe"],
  "software engineer": ["software development engineer", "software developer", "full stack engineer", "full-stack engineer", "full stack product engineer", "full-stack product engineer", "product engineer", "sde", "swe"],
  "data visualization": ["dashboard", "dashboards", "tableau dashboard", "power bi dashboard", "bi reporting", "charting", "visual analytics", "data viz"],
  "dashboarding": ["dashboard", "dashboards", "bi dashboard", "tableau dashboard", "power bi dashboard", "reporting dashboard"],
  "business analysis": ["business reporting", "requirements analysis", "stakeholder reporting", "business insights", "business analytics", "analysis for business stakeholders"],
  "requirements gathering": ["gather requirements", "gathered requirements", "define reporting needs", "defined reporting needs", "translate business needs", "translated business needs", "business requirements"],
  "etl": ["data pipeline", "data pipelines", "data ingestion", "data extraction", "extract load", "extract transform load", "pipeline automation"],
  "extraction": ["data extraction", "extract data", "extracted data", "data ingestion", "source data"],
  "decision-making": ["insights", "recommendations", "data-driven decisions", "data driven decisions", "business decisions", "decision support"],
  "cloud-native architectures": ["aws", "azure", "gcp", "docker", "kubernetes", "ci/cd", "cloud infrastructure", "cloud architecture"],
  "cloud native architectures": ["aws", "azure", "gcp", "docker", "kubernetes", "ci/cd", "cloud infrastructure", "cloud architecture"],
  "communicate effectively": ["collaborated", "communicated", "presented", "partnered", "aligned", "stakeholder communication"],
  "microservices": ["microservice", "backend services", "distributed services", "service-oriented architecture", "service oriented architecture"],
  "technical documentation": ["documentation", "documented", "technical design document", "design docs", "runbooks"],
  "operational excellence": ["observability", "monitoring", "incident response", "reliability", "automation", "continuous improvement"],
  "code reviews": ["code review", "reviewed code", "pull request reviews", "pr reviews"],
  "object-oriented design": ["object oriented design", "oop", "object-oriented programming", "object oriented programming"],
  "ci/cd": ["continuous integration", "continuous deployment", "github actions", "jenkins", "gitlab ci"],
  "aws": ["amazon web services"],
  "debugging": ["troubleshooting", "diagnosed", "debugged", "root cause analysis"],
  "data structures": ["data structure"],
  "algorithms": ["algorithm"]
};

const DIMENSION_MAX = {
  A: 8,
  B: 7,
  C: 12,
  D: 45,
  E: 5,
  F: 23
};

const SOFT_KEYWORD_TERMS = new Set([
  "communication", "communicate effectively", "communicated", "collaboration",
  "cross-functional collaboration", "cross-team collaboration", "stakeholder management",
  "stakeholder communication", "leadership", "team leadership", "ownership",
  "operational excellence", "problem solving", "problem-solving", "critical thinking",
  "mentoring", "mentored", "partnered", "coordinated", "aligned", "presentation skills"
]);

const MUST_HAVE_KEYWORDS = new Set([
  "software development engineer", "data structures", "algorithms",
  "object-oriented design", "object oriented design", "object-oriented programming",
  "object oriented programming", "aws", "code reviews", "code review",
  "debugging", "ci/cd", "continuous integration", "continuous deployment"
]);

const ROLE_RELEVANT_BOOSTERS = new Set([
  "distributed systems", "microservices", "cloud-native architecture",
  "cloud-native architectures", "cloud native architecture", "cloud native architectures",
  "nosql", "technical documentation", "operational excellence"
]);

const OPTIONAL_RISKY_KEYWORDS = new Set([
  "quantum computing", "game development", "embedded systems", "rust", "c++"
]);

const ROLE_DISPLAY_NAMES = {
  logistics_operations: "物流运营",
  accounting:           "会计",
  software_engineer:    "软件工程师",
  data_analyst:         "数据分析师",
  data_scientist:       "数据科学家",
  product_manager:      "产品经理",
  financial_analyst:    "金融/财务分析师",
  marketing:            "市场营销",
  general:              "通用岗位"
};

function formatRole(roleId) {
  return ROLE_DISPLAY_NAMES[roleId] || roleId.replace(/_/g, " ");
}

const WEAK_PHRASES = [
  "helped", "assisted", "worked on", "worked with", "responsible for",
  "participated in", "involved in", "did", "made", "used"
];

// Soft-skill indicator keywords for bullet-point skill-balance analysis.
// These terms, when found in bullet text, count as "soft skill" mentions.
const SOFT_SKILL_KEYWORDS = new Set([
  // Leadership & management
  "leadership", "managed", "directed", "supervised", "mentored", "coached",
  "delegated", "empowered", "influenced",
  // Collaboration & teamwork
  "collaboration", "collaborated", "teamwork", "cross-functional", "partnered",
  "coordinated", "aligned",
  // Communication & facilitation
  "communicated", "presented", "presentation", "facilitated",
  "negotiated", "persuaded",
  // Problem-solving & strategic thinking
  "problem-solving", "critical thinking", "decision-making", "strategic",
  "innovation", "innovative", "creative", "creativity", "analytical",
  // Organization & planning
  "prioritized", "organized", "multitasked", "time management", "planned",
  // Interpersonal & professional attributes
  "stakeholder", "conflict resolution", "adaptable", "accountability",
  "ownership", "initiative", "relationship-building",
  // Training & people development
  "trained", "onboarded"
]);

const ROLE_FAMILIES = [
  { role: "logistics_operations", terms: ["揽收", "调度", "物流", "仓库", "库管", "司机", "客服", "运营", "末端", "配送", "异常", "卡量", "时效", "完结率", "pickup", "dispatch", "logistics", "warehouse", "last-mile", "parcel"] },
  { role: "accounting", terms: ["accountant", "staff accountant", "accounting", "bookkeeping", "payroll", "tax preparation", "quickbooks", "financial statements", "reconciliation"] },
  { role: "machine_learning", terms: ["machine learning engineer", "ml engineer", "mle", "machine learning", "deep learning", "computer vision", "model training", "model deployment", "pytorch", "tensorflow"] },
  { role: "ai_engineer", terms: ["ai engineer", "artificial intelligence engineer", "llm engineer", "generative ai", "prompt engineering", "rag", "vector database", "langchain"] },
  { role: "design_creative", terms: ["graphic designer", "visual designer", "ui/ux designer", "ux designer", "ui designer", "product designer", "brand designer", "portfolio", "figma", "adobe"] },
  { role: "software_engineer", terms: ["software engineer", "swe", "backend", "frontend", "full stack", "full-stack", "api", "microservice", "react", "node", "java", "python"] },
  { role: "data_analyst", terms: ["data analyst", "business analyst", "analytics", "sql", "tableau", "power bi", "excel", "dashboard"] },
  { role: "data_scientist", terms: ["data scientist", "machine learning", "ml", "modeling", "experiment", "statistics", "python", "pandas"] },
  { role: "product_manager", terms: ["product manager", "pm", "roadmap", "user research", "stakeholder", "metrics", "launch"] },
  { role: "financial_analyst", terms: ["financial analyst", "finance", "valuation", "forecast", "investment", "portfolio", "excel"] },
  { role: "marketing", terms: ["marketing", "campaign", "brand", "content", "seo", "growth", "social media"] }
];

const CATEGORY_PHRASES = {
  tools: [
    // Finance / Data / Software
    "quickbooks", "excel", "microsoft excel", "tableau", "power bi", "sql",
    "python", "sap", "netsuite", "xero", "sage", "oracle", "salesforce",
    // 會計 / 稅務專用軟體
    "cch axcess", "proseries", "lacerte", "drake tax", "ultratax",
    "cch prosystem", "gosystem", "taxslayer", "atx", "checkpoint",
    "adp", "paychex", "gusto", "bill.com", "expensify", "concur",
    "freshbooks", "wave", "zoho books",
    "react", "node.js", "next.js", "typescript", "aws", "azure", "gcp",
    "docker", "kubernetes",
    // AI / ML tools
    "pytorch", "tensorflow", "keras", "opencv", "scikit-learn",
    "hugging face", "huggingface", "transformers", "diffusers",
    "stable diffusion", "comfyui", "controlnet", "lora", "sdxl", "flux",
    "langchain", "llamaindex", "llama index", "pinecone", "weaviate",
    "streamlit", "gradio", "fastapi",
    "pandas", "numpy", "matplotlib", "jupyter",
    "spark", "airflow", "dbt", "snowflake", "bigquery",
    "mongodb", "postgresql", "redis", "elasticsearch",
    // Engineering tools
    "autocad", "solidworks", "matlab", "ansys", "labview", "simulink",
    "catia", "creo", "nx", "plc", "altium", "multisim", "pspice",
    // Design / UX / Creative tools
    "figma", "sketch", "adobe xd", "illustrator", "photoshop", "indesign",
    "after effects", "premiere pro", "lightroom", "canva", "procreate",
    "blender", "cinema 4d", "maya", "zbrush", "davinci resolve",
    "final cut pro", "invision", "zeplin", "framer",
    // Life Sciences / Healthcare tools
    "spss", "graphpad", "benchling", "spotfire", "veeva", "epic", "cerner",
    "flowjo", "lims", "medidata", "iqvia",
    // Marketing tools
    "google analytics", "hubspot", "mailchimp", "hootsuite", "semrush",
    "ahrefs", "google ads", "meta ads", "marketo", "pardot",
    "adobe analytics", "sprout social", "buffer", "klaviyo",
    // Semiconductor / EDA tools
    "verilog", "vhdl", "systemverilog", "cadence", "synopsys",
    "vivado", "quartus", "hspice", "modelsim", "mentor graphics",
    // IT / Security tools
    "terraform", "ansible", "jenkins", "gitlab ci", "github actions",
    "splunk", "datadog", "prometheus", "grafana", "wireshark",
    "servicenow", "active directory", "jira", "confluence",
    // Legal tools
    "westlaw", "lexisnexis", "bloomberg law",
    // Statistics / Research tools
    "stata", "rstudio", "r programming", "sas", "eviews", "nvivo", "maxqda", "atlas.ti",
    // Finance / Banking / IB tools
    "bloomberg terminal", "capital iq", "factset", "refinitiv", "pitchbook",
    "argus", "dealogic",
    // HR / People Ops tools
    "workday", "bamboohr", "rippling", "lattice", "culture amp", "15five",
    "paylocity", "ukg", "ceridian", "icims", "greenhouse", "lever",
    // Architecture / Civil / GIS tools
    "revit", "arcgis", "qgis", "rhino", "grasshopper", "sketchup",
    "civil 3d", "navisworks", "infraworks",
    // Productivity / Project Management tools
    "powerpoint", "microsoft powerpoint", "microsoft word", "google workspace",
    "google sheets", "google slides", "google docs", "notion", "asana",
    "trello", "monday.com", "clickup", "smartsheet", "ms project", "basecamp",
    // Customer Success / Support tools
    "zendesk", "intercom", "freshdesk", "gainsight", "totango", "churnzero",
    // Chemical / Process Engineering tools
    "aspen plus", "aspen hysys", "chemcad", "hysys",
    // Healthcare / Clinical EHR tools
    "meditech", "allscripts", "athenahealth", "nextgen",
    // Education / LMS tools
    "canvas lms", "blackboard", "moodle", "google classroom",
    // Additional SW Engineering — languages & frameworks
    "vue.js", "angular", "svelte", "django", "flask", "spring", "spring boot",
    "express.js", "nestjs", "ruby on rails", "swift", "kotlin", "flutter",
    "dart", "react native", "c#", "c sharp", "golang", "scala",
    "mysql", "sqlite", "cassandra", "dynamodb", "supabase", "firebase",
    "celery", "rabbitmq", "kafka", "nginx", "linux", "bash", "shell scripting",
    "java", "ruby", "php", "perl", "haskell", "elixir",
    "webpack", "vite", "babel", "eslint", "jest", "pytest", "selenium",
    "postman", "graphql", "grpc", "openapi", "swagger",
    "langsmith", "openai api", "anthropic api", "cohere", "vertex ai",
    "dvc", "mlflow", "weights and biases", "wandb", "ray", "triton",
    "tableau prep", "looker", "metabase", "power automate", "apache flink",
    "hadoop", "hive", "presto", "databricks"
  ],
  core_skills: [
    // Finance / Accounting
    "tax preparation", "bookkeeping", "payroll", "financial statements",
    "bank reconciliation", "account reconciliation", "reconciliation",
    "accounts payable", "accounts receivable", "general ledger",
    "journal entries", "month-end close", "data analysis", "data visualization",
    "machine learning", "financial modeling", "user research", "product roadmap",
    "a/b testing", "dashboarding", "reporting",
    "software development engineer", "software development",
    "data structures", "algorithms", "object-oriented design",
    "object oriented design", "code reviews", "code review",
    "debugging", "technical documentation", "operational excellence",
    // Chinese logistics
    "揽收调度", "揽收数据分析", "数据分析", "资源调配", "成本控制",
    "流程优化", "报告制作", "应急响应", "多任务处理", "团队协作", "客服经验",
    // AI / ML skills
    "fine-tuning", "model fine-tuning", "model training", "model evaluation",
    "dataset curation", "inference optimization", "prompt engineering",
    "image generation", "text generation", "computer vision",
    "object detection", "image segmentation", "model deployment",
    "reinforcement learning", "transfer learning", "retrieval augmented generation",
    "rag", "vector search", "embedding", "deep learning", "neural network",
    "model optimization", "visual reasoning", "multi-step reasoning",
    // 管理 / 商科
    "strategic planning", "process improvement", "stakeholder management",
    "cross-functional collaboration", "project management", "change management",
    "decision making", "decision-making", "problem solving", "problem-solving",
    "business analysis", "performance management", "team leadership",
    "critical thinking", "time management", "presentation skills",
    "analytical skills", "leadership development", "organizational skills",
    // Engineering
    "lean manufacturing", "six sigma", "gd&t", "quality control", "fmea",
    "root cause analysis", "design verification", "systems engineering",
    "process engineering", "finite element analysis", "tolerance analysis",
    "product development", "failure analysis", "design for manufacturability",
    "mechanical design", "electrical design", "circuit design", "signal processing",
    "embedded systems", "firmware development",
    // Design / UX / Creative
    "wireframing", "prototyping", "usability testing", "user testing",
    "design systems", "typography", "color theory", "visual design",
    "interaction design", "motion design", "ui design", "ux research",
    "information architecture", "accessibility", "responsive design",
    "brand identity", "art direction", "creative direction",
    // Life Sciences / Healthcare
    "clinical trials", "clinical research", "gcp", "gmp", "fda regulations",
    "irb", "hipaa", "protocol development", "biostatistics", "lab techniques",
    "pcr", "elisa", "cell culture", "western blot", "next generation sequencing",
    "medical writing", "regulatory affairs", "pharmacovigilance",
    "data integrity", "drug development", "formulation",
    // Marketing / Communications
    "seo", "sem", "content marketing", "social media marketing",
    "email marketing", "digital marketing", "paid advertising", "ppc",
    "campaign management", "brand management", "copywriting", "content strategy",
    "influencer marketing", "conversion rate optimization", "lead generation",
    "marketing analytics", "public relations", "media relations",
    // Semiconductor / Electronics
    "vlsi design", "rtl design", "digital ic design", "analog ic design",
    "fpga design", "chip design", "timing analysis", "power analysis",
    "design for testability", "dft", "hardware description language",
    "circuit simulation", "place and route", "synthesis", "logic design",
    "hardware verification", "silicon validation",
    // IT / Security
    "cybersecurity", "network security", "information security",
    "penetration testing", "vulnerability assessment", "incident response",
    "identity and access management", "iam", "zero trust", "encryption",
    "firewall management", "siem", "threat detection", "network administration",
    "system administration", "it infrastructure", "cloud security",
    "devsecops", "disaster recovery", "business continuity", "itil",
    // Legal / Compliance
    "legal research", "contract drafting", "contract review",
    "litigation support", "due diligence", "regulatory compliance",
    "corporate governance", "intellectual property", "legal writing",
    "compliance monitoring", "policy development", "regulatory reporting",
    // Environmental / Sustainability
    "environmental impact assessment", "life cycle assessment", "lca",
    "ghg inventory", "carbon footprint", "sustainability reporting",
    "esg reporting", "environmental compliance", "waste management",
    "air quality monitoring", "remediation", "iso 14001",
    // HR / Talent Acquisition
    "talent acquisition", "recruiting", "sourcing", "candidate screening",
    "employee relations", "performance review", "compensation and benefits",
    "compensation & benefits", "benefits administration", "workforce planning",
    "succession planning", "learning and development", "l&d", "employee engagement",
    "diversity and inclusion", "dei", "hr business partner", "hrbp", "hris",
    "talent management", "employer branding", "organizational design",
    "headcount planning", "attrition analysis", "people analytics",
    "onboarding program", "offboarding", "exit interviews",
    // Management Consulting
    "case analysis", "structured problem solving", "hypothesis-driven",
    "market sizing", "benchmarking", "operating model", "management consulting",
    "strategy consulting", "business case development", "go-to-market strategy",
    "competitive benchmarking", "issue tree", "mece", "top-down communication",
    "executive communication", "client-facing", "stakeholder alignment",
    // Economics / Policy / Quantitative Research
    "econometrics", "economic modeling", "policy analysis", "cost-benefit analysis",
    "causal inference", "panel data", "time series analysis", "microeconomics",
    "macroeconomics", "quantitative research", "qualitative research",
    "survey design", "survey methodology", "literature review",
    "academic research", "research design", "statistical modeling",
    "instrumental variables", "difference-in-differences", "regression discontinuity",
    "natural experiment", "randomized controlled trial", "rct",
    // Supply Chain / Operations Management
    "procurement", "strategic sourcing", "demand planning", "inventory management",
    "vendor management", "supplier management", "supply chain management",
    "logistics management", "warehouse management", "fulfillment", "order management",
    "capacity planning", "s&op", "sales and operations planning",
    "rfp management", "contract negotiation", "purchase order management",
    "supplier evaluation", "supplier development", "vendor onboarding",
    "last-mile logistics", "reverse logistics", "kitting",
    // Architecture / Civil Engineering / Urban Planning
    "building information modeling", "bim", "construction documents",
    "structural design", "site analysis", "urban planning", "urban design",
    "zoning", "land use planning", "construction management", "cost estimating",
    "sustainable design", "passive design", "landscape design",
    "civil engineering", "geotechnical engineering", "transportation planning",
    "stormwater management", "traffic engineering", "pavement design",
    "foundation design", "retaining wall design", "site grading",
    // Education / Instructional Design
    "curriculum development", "lesson planning", "instructional design",
    "e-learning", "learning management system", "lms", "classroom management",
    "differentiated instruction", "assessment design", "student outcomes",
    "pedagogy", "tutoring", "academic advising", "educational technology",
    "edtech", "formative assessment", "summative assessment",
    "project-based learning", "blended learning", "distance learning",
    // Social Sciences / Psychology / Research Methods
    "content analysis", "thematic analysis", "ethnography", "focus groups",
    "interview research", "academic writing", "psychological assessment",
    "behavior analysis", "cognitive research", "discourse analysis",
    "grounded theory", "mixed methods", "action research",
    // Healthcare / Nursing / Clinical (non-lab)
    "patient care", "clinical assessment", "patient education",
    "medication administration", "electronic health records", "ehr", "emr",
    "triage", "care coordination", "population health", "public health",
    "epidemiology", "community health", "health informatics", "nursing",
    "patient advocacy", "discharge planning", "clinical documentation",
    "health coaching", "case management",
    // Chemical Engineering / Process
    "chemical process design", "reaction engineering", "heat transfer",
    "mass transfer", "thermodynamics", "separation processes",
    "process simulation", "process safety", "hazop", "process optimization",
    "scale-up", "pilot plant", "distillation", "absorption", "extraction",
    // Aerospace / Advanced Mechanical
    "aerodynamics", "computational fluid dynamics", "cfd",
    "structural mechanics", "propulsion systems", "systems integration",
    "orbital mechanics", "avionics", "flight dynamics", "astrodynamics",
    "composite materials", "fatigue analysis",
    // Customer Success / Account Management
    "customer success", "customer onboarding", "renewal management",
    "account management", "churn reduction", "upsell", "cross-sell",
    "quarterly business review", "qbr", "customer health scoring",
    "voice of customer", "net promoter score", "nps management",
    "customer retention", "product adoption", "time to value",
    // Investment / Finance — Advanced
    "dcf analysis", "discounted cash flow", "financial due diligence",
    "lbo modeling", "comparable company analysis", "precedent transactions",
    "capital markets", "portfolio management", "risk management",
    "asset management", "investment analysis", "equity research",
    "fixed income", "derivatives", "options pricing", "hedge fund",
    "private equity", "venture capital", "mergers and acquisitions",
    // Sales / Business Development
    "sales strategy", "pipeline management", "account planning",
    "business development", "crm management", "cold outreach",
    "prospecting", "quota attainment", "revenue generation",
    "solution selling", "consultative selling",
    // Operations Research / Optimization
    "linear programming", "integer programming", "stochastic modeling",
    "simulation modeling", "operations research", "queuing theory",
    "network optimization", "combinatorial optimization",
    // Communications / Journalism / Media
    "journalism", "news writing", "editorial", "media production",
    "video production", "audio production", "podcast production",
    "broadcast journalism", "investigative reporting", "feature writing",
    "press release", "media outreach",
    // Social Work / Nonprofit
    "community organizing", "crisis intervention", "counseling",
    "social work", "child welfare", "advocacy", "program evaluation",
    "grant writing", "fundraising", "volunteer management",
    "nonprofit management", "community development"
  ],
  domain_keywords: [
    // Finance / Accounting
    "cpa", "accounting", "audit", "tax", "gaap", "kpi", "customer analytics",
    "retention", "revenue", "forecasting", "valuation", "etl", "api",
    "microservices", "stakeholder communication", "client communication",
    "distributed systems", "cloud-native architecture",
    "cloud-native architectures", "cloud native architecture",
    "cloud native architectures", "nosql",
    // Chinese logistics
    "揽收", "调度", "仓库", "库管", "司机", "客服", "时效", "揽收率",
    "异常卡", "重复卡", "人效模型", "卡量", "完结率", "异常原因",
    "节假日", "促销期", "卸车", "分拨", "值班", "系统报警",
    "last-mile delivery", "parcel delivery", "routing", "dispatch",
    // AI / ML domain
    "generative ai", "diffusion model", "foundation model",
    "large language model", "llm", "nlp", "natural language processing",
    "multimodal", "text-to-image", "image-to-image", "latent diffusion",
    "open source", "open-source", "mlops", "production ml",
    "model serving", "model inference", "batch inference",
    "prompt-to-image", "layout-to-graphic", "creative ai", "design automation",
    "brand design", "visual layout", "design system", "visual ai",
    "image synthesis", "ux",
    // 管理 / 商科
    "operations", "customer service", "business strategy", "business process",
    "cross-functional", "organizational development", "business development",
    "performance metrics", "continuous improvement", "strategic initiative",
    "supply chain", "policy", "procedure", "leadership pipeline",
    "corporate strategy", "go-to-market", "market analysis",
    "competitive analysis", "budget management", "cost reduction",
    // Engineering
    "manufacturing", "production", "quality assurance", "iso", "osha",
    "r&d", "research and development", "material science", "thermal analysis",
    "structural analysis", "fluid dynamics", "cad", "cam", "automation",
    "robotics", "maintenance", "reliability", "safety", "regulatory standards",
    // Design / UX / Creative
    "user experience", "user interface", "design thinking",
    "human-centered design", "visual storytelling", "brand guidelines",
    "style guide", "design sprint", "design critique", "iteration",
    "creative brief", "storyboard", "illustration", "animation",
    // Life Sciences / Healthcare
    "pharmaceutical", "biotechnology", "clinical data management",
    "patient safety", "adverse events", "ind", "nda", "medical device",
    "healthcare compliance", "life sciences", "biopharma", "genomics",
    "proteomics", "clinical operations", "translational research",
    "preclinical", "biomarker", "therapeutic", "drug discovery",
    // Marketing / Communications
    "brand awareness", "engagement", "impressions", "reach",
    "click-through rate", "ctr", "roi", "cost per acquisition", "cpa",
    "customer acquisition", "demand generation", "inbound marketing",
    "outbound marketing", "growth hacking", "marketing funnel",
    "b2b marketing", "b2c marketing", "media buying", "sponsorship",
    // Semiconductor / Electronics
    "semiconductor", "integrated circuit", "system on chip", "soc",
    "asic", "processor design", "memory design", "rf design",
    "mixed-signal", "tape-out", "foundry", "process node",
    "eda tools", "hardware design", "embedded hardware",
    // IT / Security
    "cybersecurity", "threat intelligence", "malware analysis",
    "data breach", "patch management", "endpoint security",
    "network monitoring", "nist", "cis controls", "gdpr", "ccpa",
    "sox", "compliance framework", "it governance", "help desk",
    "technical support", "infrastructure",
    // Legal / Compliance
    "corporate law", "securities law", "employment law",
    "mergers and acquisitions", "regulatory framework", "data privacy",
    "compliance program", "discovery", "case management",
    "contract management", "risk mitigation", "legal counsel",
    // Environmental / Sustainability
    "esg", "sustainability", "carbon neutral", "net zero",
    "renewable energy", "climate change", "greenhouse gas", "ghg",
    "environmental policy", "leed", "circular economy", "biodiversity",
    "corporate sustainability", "green chemistry", "decarbonization",
    // Macro — broad industry / business strategy concepts
    "digital transformation", "business model", "value proposition",
    "competitive landscape", "industry trends", "market dynamics",
    "market expansion", "enterprise", "platform", "ecosystem",
    "saas", "b2b", "b2c", "product-market fit", "revenue model",
    "innovation", "scale", "scalability", "data-driven", "growth strategy",
    "organizational change", "business intelligence", "value creation",
    "digital strategy", "disruption", "venture", "economic impact",
    "industry landscape", "macro environment", "strategic alignment",
    "total addressable market", "tam", "market positioning",
    // Micro — specific metrics, processes, and technical concepts
    "ltv", "cac", "mrr", "arr", "nps", "dau", "mau",
    "churn", "churn rate", "retention", "retention rate", "conversion", "conversion rate",
    "unit economics", "customer lifetime value", "customer acquisition cost",
    "funnel", "funnel optimization", "cohort", "cohort analysis",
    "okr", "mvp", "north star metric",
    "agile", "scrum", "sprint", "kanban", "devops", "ci/cd",
    "rest api", "graphql", "system design", "code review",
    "technical debt", "version control", "data pipeline",
    "microservices architecture", "service-oriented", "event-driven",
    "statistical significance", "hypothesis testing", "regression analysis",
    "a/b testing", "multivariate testing", "experiment design",
    // HR / People Ops domain
    "headcount", "attrition", "talent pipeline", "workforce development",
    "employee lifecycle", "employer brand", "employee value proposition",
    "diversity equity inclusion", "dei initiatives", "employee retention",
    "people operations", "hris implementation", "payroll processing",
    "total rewards", "job leveling", "career pathing",
    // Management Consulting domain
    "workstream", "deliverable", "client engagement", "engagement management",
    "strategic recommendation", "value creation framework", "deck",
    "management presentation", "c-suite communication", "board presentation",
    // Economics / Policy domain
    "fiscal policy", "monetary policy", "labor market", "gdp", "inflation",
    "impact evaluation", "program evaluation", "policy brief",
    "cost effectiveness analysis", "welfare economics", "public finance",
    "income inequality", "poverty reduction", "development economics",
    "behavioral economics", "experimental economics",
    // Supply Chain domain
    "lead time", "on-time delivery", "otd", "fill rate", "service level",
    "sku", "bom", "bill of materials", "mrp", "material requirements planning",
    "just-in-time", "jit", "lean supply chain", "vendor performance",
    "spend analysis", "total cost of ownership", "tco", "rfq",
    "purchase order", "raw materials", "finished goods", "wip",
    "cross-docking", "3pl", "4pl", "freight", "incoterms",
    // Architecture / Civil domain
    "building code", "master plan", "site plan", "floor plan", "schematic design",
    "design development", "construction administration", "shop drawings",
    "mixed-use development", "transit-oriented development",
    "urban mobility", "geotechnical", "surveying", "infrastructure design",
    "stormwater", "grading", "utility design", "right of way",
    // Education domain
    "student achievement", "learning outcomes", "stem education",
    "k-12", "higher education", "professional development",
    "training and development", "accreditation", "learning objectives",
    "course design", "syllabus development", "faculty development",
    // Healthcare domain (clinical/operational)
    "value-based care", "health outcomes", "patient satisfaction",
    "clinical workflow", "telemedicine", "telehealth", "care management",
    "disease management", "preventive care", "chronic disease management",
    "population health management", "utilization management",
    "health equity", "social determinants of health", "sdoh",
    // Social Sciences / Nonprofit domain
    "social impact", "community engagement", "policy advocacy",
    "nonprofit management", "grant writing", "fundraising",
    "program management", "community development", "civic engagement",
    "capacity building", "stakeholder engagement", "coalition building",
    // Customer Success domain
    "health score", "product adoption", "customer journey",
    "expansion revenue", "net revenue retention", "nrr",
    "gross revenue retention", "grr", "logo retention",
    "customer segmentation", "tier management", "executive sponsor",
    // Aerospace / Defense domain
    "faa regulations", "mil-spec", "airworthiness", "propulsion",
    "systems engineering", "avionics", "flight test", "certification",
    // Investment / Finance domain
    "investment banking", "private equity", "venture capital",
    "asset management", "hedge fund", "capital markets",
    "equity research", "fixed income", "credit analysis",
    "lbo", "ipo", "spac", "syndication", "underwriting",
    "fund administration", "nav", "aum",
    // Sales / Revenue domain
    "pipeline", "quota", "bookings", "annual recurring revenue",
    "net new revenue", "expansion", "win rate", "average deal size",
    "sales cycle", "territory management", "channel sales",
    "partner management", "reseller", "distributor",
    // Operations Research / Analytics domain
    "optimization problem", "constraint satisfaction", "heuristic",
    "monte carlo", "discrete event simulation", "supply-demand balancing",
    // Communications / Media domain
    "media relations", "press coverage", "editorial calendar",
    "content calendar", "newsroom", "beat reporting", "source development",
    "interview skills", "fact-checking", "ap style",
    // Chemical / Process domain
    "batch processing", "continuous processing", "gmp manufacturing",
    "process validation", "technology transfer", "scale-up", "cmc",
    "environmental health and safety", "ehs", "process hazard analysis"
  ],
  action_verbs: [
    // Finance / Data / Tech
    "prepare", "reconcile", "analyze", "process", "review", "report",
    "manage", "build", "develop", "implement", "optimize", "audit",
    "forecast", "model", "launch", "coordinate",
    // Chinese
    "分析", "监控", "制定", "梳理", "协同", "处理", "调配", "优化", "输出", "支援",
    // AI / ML
    "train", "fine-tune", "evaluate", "deploy", "curate", "generate", "infer",
    // 管理 / 商科
    "lead", "execute", "facilitate", "present", "identify", "assess",
    "plan", "prioritize", "delegate", "negotiate", "recommend", "drive",
    "oversee", "streamline", "align", "resolve", "monitor", "deliver",
    "communicate", "collaborate", "track", "contribute", "support", "rotate",
    // Engineering
    "design", "test", "validate", "simulate", "prototype", "troubleshoot",
    "calibrate", "inspect", "manufacture", "fabricate", "integrate", "configure",
    // Design / Creative
    "create", "illustrate", "animate", "render", "sketch", "iterate",
    "visualize", "conceptualize", "storyboard", "brand",
    // Life Sciences
    "conduct", "research", "synthesize", "formulate", "culture",
    "sequence", "assay", "document", "submit", "register",
    // Marketing
    "market", "campaign", "promote", "publish", "advertise", "grow",
    "acquire", "engage", "convert", "segment", "target",
    // IT / Security
    "secure", "patch", "monitor", "migrate", "provision", "automate",
    "architect", "harden", "encrypt", "detect", "respond",
    // HR / Talent
    "recruit", "source", "screen", "hire", "onboard", "coach", "retain",
    "interview", "assess candidates", "headhunt",
    // Education / Training
    "teach", "instruct", "educate", "tutor", "facilitate learning",
    "scaffold", "differentiate", "advise",
    // Supply Chain / Ops
    "procure", "replenish", "expedite", "fulfil", "ship", "receive",
    "inspect", "warehouse", "distribute",
    // Healthcare / Clinical
    "administer", "treat", "counsel", "refer", "triage", "diagnose",
    "prescribe", "assess", "document",
    // Architecture / Civil
    "draft", "permit", "survey", "inspect", "estimate",
    // Consulting / Strategy
    "synthesize", "frame", "scope", "size", "hypothesize",
    "benchmark", "advise", "pitch",
    // Sales / BD
    "prospect", "close", "upsell", "cross-sell", "negotiate",
    // Communications / Media
    "write", "edit", "proofread", "publish", "broadcast",
    // Finance / Investment
    "model", "value", "underwrite", "syndicate", "allocate", "hedge",
    // Research / Social Sciences
    "observe", "code", "transcribe", "interpret", "test",
    // General additions
    "transform", "scale", "pilot", "revamp", "overhaul", "standardize",
    "digitize", "automate", "integrate", "centralize", "consolidate"
  ],
  nice_to_have: [
    // Finance / Accounting
    "certified public accountant", "cpa eligible", "bilingual", "public accounting",
    "startup experience", "consulting experience", "advanced excel",
    "open source contribution", "research experience", "published paper",
    // 管理 / 商科
    "mba", "leadership experience", "cross-functional experience",
    "rotational program", "management experience", "operations experience",
    "international experience", "volunteer experience",
    // Engineering
    "pe license", "six sigma certification", "pmp", "lean certification",
    "autocad certification", "solidworks certification",
    // Design
    "portfolio", "dribbble", "behance", "design award",
    // Life Sciences
    "phd", "md", "clinical experience", "gcp certification",
    "regulatory experience", "fda experience",
    // Marketing
    "google certified", "hubspot certified", "facebook blueprint",
    "content creation experience", "agency experience",
    // IT / Security
    "comptia", "cissp", "cism", "ceh", "aws certified",
    "azure certified", "google cloud certified", "ccna", "ccnp",
    // Legal
    "bar admission", "juris doctor", "jd", "llm", "paralegal certificate",
    // Environmental
    "leed certified", "iso 14001 certified", "sustainability certification",
    "quantum computing", "game development", "embedded systems", "rust", "c++",
    // HR Certifications
    "shrm-cp", "shrm-scp", "phr", "sphr", "shrm certified",
    "talent management certified",
    // Finance / Banking Certifications
    "cfa", "cfa level 1", "cfa candidate", "cfa level 2", "cfa charterholder",
    "series 7", "series 63", "series 79", "frm", "caia",
    "chartered financial analyst",
    // Consulting / Strategy
    "case competition", "management consulting internship",
    "strategy internship", "consulting internship",
    // Architecture
    "leed ap", "are", "architect registration examination",
    "registered architect",
    // Supply Chain Certifications
    "apics cpim", "apics cscp", "cltd", "cscmp",
    "certified supply chain professional",
    // Engineering Certifications
    "fe exam", "eit", "fundamentals of engineering", "pe license",
    // Data / Cloud Certifications
    "google data analytics certificate", "tableau certified",
    "databricks certified", "aws solutions architect",
    "azure data engineer", "google cloud professional",
    // Project Management Certifications
    "pmp certified", "capm", "agile certified", "scrum master", "csm",
    "safe agile", "prince2",
    // Finance Additional
    "acca", "cma", "enrolled agent", "ea", "cfp",
    // Legal Additional
    "bar prep", "law review", "moot court",
    // Language / Cultural
    "bilingual", "trilingual", "multilingual", "toefl", "ielts",
    "hsk", "delf", "goethe", "jlpt",
    // Research
    "published research", "peer-reviewed publication", "conference presentation",
    "research fellowship", "grant recipient",
    // General Nice-to-Have Experience
    "startup experience", "nonprofit experience", "government experience",
    "international internship", "study abroad", "exchange program",
    "dean's list", "honor society", "honors thesis", "capstone project"
  ]
};

const FALLBACK_ROLE_LEXICON = {
  "staff accountant": {
    target_role: ["staff accountant"],
    core_skills: ["bookkeeping", "tax preparation", "payroll", "financial statements", "reconciliation", "general ledger", "journal entries"],
    tools: ["quickbooks", "excel"],
    action_verbs: ["prepare", "reconcile", "process", "review"],
    domain_keywords: ["accounting", "cpa", "client communication"],
    nice_to_have: ["public accounting", "cpa eligible"]
  },
  "data analyst": {
    target_role: ["data analyst"],
    core_skills: ["data analysis", "data visualization", "dashboarding", "reporting", "a/b testing"],
    tools: ["sql", "python", "excel", "tableau", "power bi"],
    action_verbs: ["analyze", "build", "report", "visualize"],
    domain_keywords: ["kpi", "customer analytics", "stakeholder communication"],
    nice_to_have: ["statistics", "etl"]
  }
};

function normalizeText(text) {
  return String(text || "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    // Common bullet/list characters from Word, PDF, and web sources
    .replace(/[\u2022\u25cf\u25aa\u25e6\u25b8\u25ba\u25a0\u25a1\u25c6\u25c7\u25bd\u25be\u2023\u2043\u2219\u00b7\u2027\uf0b7\uf0a7\u2714\u2713\u2612\u2611\u2739\u2736\u2012\u2013\u276f\u203a]/g, "- ")
    .replace(/[\u201c\u201d]/g, "\"")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/\ufeff/g, ""); // strip BOM
}

function tokenize(text) {
  return normalizeText(text)
    .toLowerCase()
    .replace(/[^a-z0-9+#.\s/-]/g, " ")
    .split(/\s+/)
    .map((w) => w.trim().replace(/^[^a-z0-9+#]+|[^a-z0-9+#]+$/gi, ""))
    .filter((w) => isUsefulKeywordToken(w));
}

function extractKeywords(text) {
  const cleaned = removeCompanyNames(removeCompanyBoilerplate(stripUrlsAndEmails(getJdKeywordText(text))));
  const raw = tokenize(cleaned).filter((w) => w.length > 3);
  const phrases = [];
  const lower = normalizeText(text).toLowerCase();
  const knownPhrases = [
    "machine learning", "deep learning", "data analysis", "data visualization",
    "business analysis", "requirements gathering", "decision-making",
    "power bi", "tableau", "react", "node.js", "next.js", "typescript",
    "python", "sql", "aws", "azure", "gcp", "docker", "kubernetes",
    "financial modeling", "financial statements", "tax preparation",
    "client communication", "bank reconciliation", "account reconciliation",
    "accounts payable", "accounts receivable", "general ledger",
    "user research", "product roadmap", "a/b testing",
    "software development engineer", "software engineer", "data structures",
    "algorithms", "object-oriented design", "object oriented design",
    "code reviews", "code review", "cloud-native architecture",
    "cloud-native architectures", "cloud native architecture",
    "cloud native architectures", "technical documentation",
    "operational excellence", "distributed systems", "microservices",
    "game development", "quantum computing", "embedded systems",
    "communicate effectively", "data extraction", "data ingestion", "data pipeline"
  ];
  for (const phrase of knownPhrases) {
    if (lower.includes(phrase)) phrases.push(phrase);
  }
  const phraseParts = new Set(phrases.flatMap((phrase) => phrase.split(/\s+/)));
  const cleanedRaw = raw.filter((word) => !phraseParts.has(word));
  return [...new Set([...phrases, ...cleanedRaw])];
}

function extractJdKeywords(jdText, jobTitle = "") {
  const jobTitleTerms = new Set(extractKeywords(jobTitle));
  return extractKeywords(jdText)
    .filter((kw) => !jobTitleTerms.has(kw))
    .filter((kw) => isUsefulJdKeyword(kw));
}

function buildKeywordProfile(jdText = "", jobTitle = "") {
  const explicitChineseRole = extractChineseTargetRole(jdText);
  const hasChineseStructuredRole = /\u5c97\u4f4d[^\uff1a:\n]*[\uff1a:]\s*[^\n]*[\u4e00-\u9fff]/.test(normalizeText(jdText));
  const shouldUseDictionary = Boolean(jobTitle && /[a-z]/i.test(jobTitle)) || (!explicitChineseRole && !hasChineseStructuredRole);
  const roleEntry = shouldUseDictionary ? findRoleDictionaryEntry(jobTitle, jdText) : null;
  const roleProfile = roleToProfile(roleEntry);

  if (jdText && jdText.trim()) {
    const jdProfile = extractJdProfile(jdText, jobTitle);
    return normalizeProfile({
      source: roleEntry ? "jd+role_dictionary" : "jd",
      role_id: roleEntry?.role_id || null,
      canonical_role: roleEntry?.canonical_role || null,
      target_role: unique([...(roleProfile?.target_role || []), explicitChineseRole, ...jdProfile.target_role].filter(Boolean)),
      core_skills: unique([...jdProfile.core_skills, ...termsFromJdThatMatchRole(jdText, roleProfile?.core_skills || [])]),
      tools: unique([...jdProfile.tools, ...termsFromJdThatMatchRole(jdText, roleProfile?.tools || [])]),
      action_verbs: unique([...jdProfile.action_verbs, ...termsFromJdThatMatchRole(jdText, roleProfile?.action_verbs || [])]),
      domain_keywords: unique([...jdProfile.domain_keywords, ...termsFromJdThatMatchRole(jdText, roleProfile?.domain_keywords || [])]),
      nice_to_have: unique([...jdProfile.nice_to_have, ...termsFromJdThatMatchRole(jdText, roleProfile?.nice_to_have || [])])
    });
  }
  if (roleProfile) {
    return normalizeProfile({
      source: "role_dictionary",
      role_id: roleEntry.role_id,
      canonical_role: roleEntry.canonical_role,
      ...roleProfile
    });
  }
  return fallbackRoleProfile(jobTitle);
}

function termsFromJdThatMatchRole(jdText, roleTerms) {
  const lower = normalizeText(getJdKeywordText(jdText)).toLowerCase();
  return unique((roleTerms || []).filter((term) => lower.includes(cleanKeyword(term))));
}

function extractJdProfile(jdText, jobTitle = "") {
  const sections = parseJdSections(jdText);
  const jobTitleTerms = new Set(extractKeywords(jobTitle));

  const cleanLines = (lines) =>
    removeCompanyNames(removeCompanyBoilerplate(stripUrlsAndEmails(lines.join("\n")))).toLowerCase();

  const reqText  = cleanLines(sections.requirements);
  const respText = cleanLines(sections.responsibilities);
  const niceText = cleanLines(sections.nice_to_have);
  const otherText = cleanLines(sections.other);
  // Priority order: requirements first, then responsibilities, nice_to_have, other
  const orderedTexts = [reqText, respText, niceText, otherText];
  const allText = orderedTexts.join("\n");

  const collectOrdered = (categoryTerms) => {
    const seen = new Set();
    const result = [];
    for (const text of orderedTexts) {
      for (const term of findCategoryTerms(text, categoryTerms, jobTitleTerms)) {
        if (!seen.has(term)) { seen.add(term); result.push(term); }
      }
    }
    return result;
  };

  const profile = {
    source: "jd",
    target_role: extractTargetRole(allText, jobTitle),
    core_skills: collectOrdered(CATEGORY_PHRASES.core_skills),
    tools: collectOrdered(CATEGORY_PHRASES.tools),
    action_verbs: findActionVerbs(allText),
    domain_keywords: collectOrdered(CATEGORY_PHRASES.domain_keywords),
    nice_to_have: unique([
      ...findCategoryTerms(niceText, CATEGORY_PHRASES.nice_to_have, jobTitleTerms),
      ...extractNiceToHave(allText, jobTitleTerms)
    ])
  };

  return normalizeProfile(profile);
}

function fallbackRoleProfile(jobTitle = "") {
  const lower = normalizeText(jobTitle).toLowerCase();
  const matchedKey = Object.keys(FALLBACK_ROLE_LEXICON).find((role) => lower.includes(role));
  const base = matchedKey ? FALLBACK_ROLE_LEXICON[matchedKey] : {
    target_role: jobTitle ? [jobTitle.toLowerCase()] : [],
    core_skills: [],
    tools: [],
    action_verbs: [],
    domain_keywords: [],
    nice_to_have: []
  };
  return normalizeProfile({ source: "role_lexicon", ...base });
}

function extractTargetRole(text, jobTitle = "") {
  const roles = [];
  const fullText = normalizeText(text);
  const chineseRole = extractChineseTargetRole(fullText);
  if (chineseRole) roles.push(chineseRole);
  const lower = fullText.toLowerCase();
  if (jobTitle && jobTitle.trim()) roles.push(jobTitle.trim().toLowerCase());
  const match =
    lower.match(/\b(?:seeking|hiring|looking for)\s+(?:an?\s+)?([a-z][a-z\s/-]{2,40}?)(?:\.|,| with | who | to |$)/) ||
    lower.match(/\bposition\s+(?:is\s+)?(?:for\s+)?(?:an?\s+)?([a-z][a-z\s/-]{2,40}?)(?:\.|,| with | who | to |$)/);
  if (match) roles.push(match[1].trim());
  return unique(roles.map(cleanKeyword).filter(Boolean));
}

function findCategoryTerms(lowerText, terms, exclude = new Set()) {
  return unique(terms
    .filter((term) => {
      const clean = cleanKeyword(term);
      if (!clean) return false;
      if (clean.includes(" ") || clean.includes("-")) return lowerText.includes(clean);
      return new RegExp(`\\b${escapeRegExp(clean)}\\b`).test(lowerText);
    })
    .map(cleanKeyword)
    .filter((term) => term && !exclude.has(term)));
}

function findActionVerbs(lowerText) {
  const verbs = CATEGORY_PHRASES.action_verbs.filter((verb) => {
    const re = new RegExp(`\\b${escapeRegExp(verb)}(?:s|ed|ing)?\\b`, "i");
    return re.test(lowerText);
  });
  return unique(verbs);
}

function extractNiceToHave(text, exclude = new Set()) {
  const lower = normalizeText(text).toLowerCase();
  const niceSentences = lower
    .split(/\n|(?<=[.!?])\s+/)
    .filter((s) => /\b(preferred|nice to have|plus|bonus|preferred qualifications?)\b/.test(s))
    .join(" ");
  return findCategoryTerms(niceSentences, CATEGORY_PHRASES.nice_to_have, exclude);
}

function normalizeProfile(profile) {
  const normalized = { ...profile };
  for (const key of ["target_role", "core_skills", "tools", "action_verbs", "domain_keywords", "nice_to_have"]) {
    normalized[key] = unique((normalized[key] || []).map(cleanKeyword).filter(Boolean));
  }
  return normalized;
}

function cleanKeyword(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/^[^a-z0-9+#\u4e00-\u9fff]+|[^a-z0-9+#\u4e00-\u9fff]+$/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function parseJdSections(jdText) {
  const normalized = normalizeText(jdText);
  const lines = normalized.split("\n");
  const sections = { requirements: [], responsibilities: [], nice_to_have: [], other: [] };
  let current = "other";

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;
    const lower = line.toLowerCase();
    const isShort = line.length < 90;

    if (isShort && (
      /\b(what we'?re looking for|requirements?|qualifications?|must.?have|required skills?|required qualifications?)\b/.test(lower) ||
      /【?(任职要求|要求)】?/.test(line)
    )) { current = "requirements"; continue; }

    if (isShort && /\b(nice.?to.?have|preferred|bonus|good to have|desirable)\b/.test(lower)) {
      current = "nice_to_have"; continue;
    }

    if (isShort && (
      /\b(what you'?ll work on|what you'?ll do|responsibilities?|duties|your role|job summary)\b/.test(lower) ||
      /【?(岗位职责|职责)】?/.test(line)
    )) { current = "responsibilities"; continue; }

    if (isShort && (
      /\b(about us|about the company|who we are|what we offer|we offer|benefits?|perks?|compensation)\b/.test(lower) ||
      /【?(公司|公司介绍|网站|地点|关于)】?/.test(line)
    )) { current = "other"; continue; }

    sections[current].push(line);
  }

  return sections;
}

function getJdKeywordText(text) {
  const normalized = normalizeText(text);
  if (!/[【\[]?(岗位职责|任职要求|职责|要求|responsibilities|requirements|qualifications|what you|looking for)/i.test(normalized)) {
    return normalized;
  }

  const lines = normalized.split("\n");
  const kept = [];
  let active = false;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    const isHeader = /^【[^】]+】/.test(line) || /^[A-Za-z''\s]+:/.test(line);
    const startsRelevant = /【?(岗位职责|任职要求|职责|要求)】?|^(responsibilities?|requirements?|qualifications?|what you will do|what you'?ll work on|what we'?re looking for|duties|nice to have|nice-to-have)\b/i.test(line);
    const startsIrrelevant = /【?(公司|公司介绍|网站|地点|岗位)】?|^(about us|about the company|about [a-z]+:|company|website|location|what we offer|benefits?|perks?)\b/i.test(line);

    if (startsRelevant) {
      active = true;
      const afterColon = line.split(/[：:]/).slice(1).join(":").trim();
      if (afterColon) kept.push(afterColon);
      continue;
    }

    if (startsIrrelevant && isHeader) {
      active = false;
      continue;
    }

    if (active) kept.push(line);
  }

  return kept.length ? kept.join("\n") : normalized;
}

function extractChineseTargetRole(text) {
  const candidates = [];
  for (const line of normalizeText(text).split("\n")) {
    const match = line.match(/\u5c97\u4f4d[^\uff1a:\n]*[\uff1a:]\s*([^\n]+)/);
    if (match) candidates.push(match[1].trim());
  }

  for (const raw of candidates) {
    const cleaned = raw
      .replace(/[（(].*?[）)]/g, "")
      .replace(/\s+/g, " ")
      .trim();
    const looksLikeLocation = /弗吉尼亚|田纳西|加州|洛杉矶|纽约|西雅图|virginia|tennessee|california|seattle/i.test(cleaned);
    const looksLikeRole = /专员|经理|主管|助理|分析师|工程师|会计|运营|支持|intern|analyst|engineer|accountant|specialist|manager/i.test(cleaned);
    if (cleaned && looksLikeRole && !looksLikeLocation) return cleaned.toLowerCase();
  }

  return "";
}

function unique(items) {
  return [...new Set(items)];
}

function isLikelyDomainKeyword(keyword) {
  if (!isUsefulJdKeyword(keyword)) return false;
  if (keyword.length < 5) return false;
  const generic = new Set(["entry", "maintain", "records", "timely", "basis", "necessary", "adjustments"]);
  return !generic.has(keyword);
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function removeCompanyBoilerplate(text) {
  return normalizeText(text)
    .split(/\n|(?<=[.!?])\s+/)
    .filter((sentence) => {
      const s = sentence.toLowerCase();
      const looksLikeCompanyIntro =
        /\b(full-service|distinguished|founded|located|headquartered|firm|website)\b/.test(s) ||
        /\b(inc|llc|ltd|corp|corporation|associates|partners)\b/.test(s);
      const looksLikeLocationInfo =
        /\b(branch|branches|office|offices|location|locations|headquarter|headquarters|california|seattle|new york|san francisco|los angeles|chicago|boston|austin|dallas|houston)\b/.test(s);
      const hasRoleRequirement =
        /\b(required|requirement|qualification|responsibilit|skill|experience with|proficient|knowledge of|must|preferred|duties)\b/.test(s);
      return (!looksLikeCompanyIntro && !looksLikeLocationInfo) || hasRoleRequirement;
    })
    .join(" ");
}

function removeCompanyNames(text) {
  const companyNames = extractCompanyNameCandidates(text);
  let cleaned = normalizeText(text);
  for (const name of companyNames) {
    if (!name || name.split(/\s+/).length > 6) continue;
    const escaped = escapeRegExp(name);
    cleaned = cleaned.replace(new RegExp(`\\b${escaped}\\b`, "gi"), " ");
  }
  return cleaned;
}

function extractCompanyNameCandidates(text) {
  const raw = normalizeText(text);
  const candidates = [];
  const patterns = [
    /\b([A-Z][A-Za-z&'.-]+(?:\s+[A-Z][A-Za-z&'.-]+){0,4})\s+(?:is|are)\s+(?:a|an|the)?\s*(?:distinguished\s+|leading\s+|full-service\s+|professional\s+)*(?:company|firm|organization|agency|startup|corporation|llc|inc|ltd|group|partners|associates)\b/g,
    /\b(?:About|At|Join)\s+([A-Z][A-Za-z&'.-]+(?:\s+[A-Z][A-Za-z&'.-]+){0,4})\b/g,
    /\b([A-Z][A-Za-z&'.-]+(?:\s+[A-Z][A-Za-z&'.-]+){0,3})\s+(?:LLC|Inc\.?|Ltd\.?|Corporation|Corp\.?|Associates|Partners|Group)\b/g
  ];
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(raw))) {
      const candidate = match[1].trim();
      if (!/^(we|our|the|job|role|responsibilities|qualifications)$/i.test(candidate)) {
        candidates.push(candidate.toLowerCase());
      }
    }
  }
  return unique(candidates);
}

function stripUrlsAndEmails(text) {
  return normalizeText(text)
    .replace(/https?:\/\/\S+/gi, " ")
    .replace(/\bwww\.\S+/gi, " ")
    .replace(/\b[\w.-]+\.\w{2,}(?:\/\S*)?/gi, " ")
    .replace(/\b[\w.-]+@[\w.-]+\.\w{2,}\b/gi, " ");
}

function isUsefulKeywordToken(word) {
  if (!word || word.length <= 2) return false;
  if (STOP_WORDS.has(word)) return false;
  if (/^\d+$/.test(word)) return false;
  if (/^www\./i.test(word)) return false;
  if (/\.(com|net|org|io|co|edu|gov)$/i.test(word)) return false;
  if (/^https?:/i.test(word)) return false;
  return true;
}

function isUsefulJdKeyword(keyword) {
  if (!keyword || STOP_WORDS.has(keyword)) return false;
  if (/^\d+$/.test(keyword)) return false;
  if (keyword.length < 4) return false;
  const genericBusinessWords = new Set([
    "staff", "role", "work", "team", "office", "branch", "location", "include",
    "additional", "california", "seattle", "service", "firm"
  ]);
  return !genericBusinessWords.has(keyword);
}

function getBulletLines(text) {
  return normalizeText(text)
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => {
      if (!line) return false;
      if (/^[-*]\s/.test(line)) return true;
      // Strip leading non-alpha chars (bullet symbols, etc.) then check verb.
      // Use startsWith instead of splitting on spaces, because pdf-parse often
      // strips all spaces: "Optimized property..." becomes "Optimizedproperty..."
      const stripped = line.replace(/^[^a-zA-Z]+/, "");
      const lower = stripped.toLowerCase();
      const startsWithVerb = [...STRONG_VERBS].some((v) => lower.startsWith(v));
      return line.length > 40 && startsWithVerb;
    });
}

function parseSectionsLegacy(text) {
  return parseSections(text);
  const sections = {};
  const lines = normalizeText(text).split("\n");
  let current = "header";
  sections[current] = [];

  // Patterns include space-merged variants (e.g. "TECHNICALSKILLS") because
  // pdf-parse strips spaces, turning section headers into single merged words.
  const headingMap = [
    ["summary", /^(summary|profile|professionalsummary|professional summary|careerobjective|career objective|objective)\b/i, ["summary", "profile", "professionalsummary", "professional summary", "careerobjective", "career objective", "objective"]],
    ["experience", /^(experience|workexperience|work experience|professionalexperience|professional experience|employment)\b/i, ["professionalexperience", "professional experience", "workexperience", "work experience", "experience", "employment"]],
    ["projects", /^(projects?|projectexperience|project experience|selectedprojects|selected projects)\b/i, ["projectexperience", "project experience", "selectedprojects", "selected projects", "projects", "project"]],
    ["skills", /^(skills?|technicalskills?|technical skills?|coreskills?|core skills?|competencies)\b/i, ["technicalskills", "technical skills", "coreskills", "core skills", "competencies", "skills", "skill"]],
    ["education", /^(education|academicbackground|academic background)\b/i, ["academicbackground", "academic background", "education"]],
    ["certifications", /^(certifications?|licenses?|awards?|honors?)\b/i, ["certifications", "certification", "licenses", "license", "awards", "award", "honors", "honor"]]
  ];

  for (const rawLine of lines) {
    const line = rawLine.trim();
    const matched = headingMap.find(([re]) => re.test(line.replace(/[:：]$/, "")));
    if (matched) {
      current = matched[1];
      sections[current] = sections[current] || [];
      continue;
    }
    sections[current].push(rawLine);
  }

  return Object.fromEntries(Object.entries(sections).map(([key, value]) => [key, value.join("\n").trim()]));
}

function parseSections(text) {
  const sections = {};
  const lines = normalizeText(text).split("\n");
  let current = "header";
  sections[current] = [];

  const headingMap = [
    ["summary", /^(summary|profile|professionalsummary|professional summary|careerobjective|career objective|objective)\b/i, ["summary", "profile", "professionalsummary", "professional summary", "careerobjective", "career objective", "objective"]],
    ["experience", /^(experience|workexperience|work experience|professionalexperience|professional experience|employment)\b/i, ["professionalexperience", "professional experience", "workexperience", "work experience", "experience", "employment"]],
    ["projects", /^(projects?|projectexperience|project experience|selectedprojects|selected projects)\b/i, ["projectexperience", "project experience", "selectedprojects", "selected projects", "projects", "project"]],
    ["skills", /^(skills?|technicalskills?|technical skills?|coreskills?|core skills?|competencies)\b/i, ["technicalskills", "technical skills", "coreskills", "core skills", "competencies", "skills", "skill"]],
    ["education", /^(education|academicbackground|academic background)\b/i, ["academicbackground", "academic background", "education"]],
    ["certifications", /^(certifications?|licenses?|awards?|honors?)\b/i, ["certifications", "certification", "licenses", "license", "awards", "award", "honors", "honor"]]
  ];

  for (const rawLine of lines) {
    const line = rawLine.trim();
    const cleaned = line.replace(/[:\uFF1A]$/, "");
    const matched = headingMap.find(([, re, aliases]) =>
      re.test(cleaned) || Boolean(extractInlineHeadingText(cleaned, aliases))
    );
    if (matched) {
      current = matched[0];
      sections[current] = sections[current] || [];
      const inlineText = extractInlineHeadingText(cleaned, matched[2]);
      if (inlineText) sections[current].push(inlineText);
      continue;
    }
    sections[current].push(rawLine);
  }

  return Object.fromEntries(Object.entries(sections).map(([key, value]) => [key, value.join("\n").trim()]));
}

function extractInlineHeadingText(line, aliases) {
  const value = String(line || "").trim();
  const sortedAliases = [...aliases].sort((a, b) => b.length - a.length);
  for (const alias of sortedAliases) {
    const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\\ /g, "\\s+");
    const spaced = value.match(new RegExp(`^${escaped}\\s*[:\\-–—]?\\s+(.+)$`, "i"));
    if (spaced) return spaced[1].trim();

    const compactAlias = alias.replace(/\s+/g, "");
    const compact = value.match(new RegExp(`^${compactAlias}([A-Z][\\s\\S]+)$`, "i"));
    if (compact) return compact[1].trim();
  }
  return "";
}

function sectionText(sections, names) {
  return names.map((name) => sections[name] || "").join("\n");
}

function bulletsFromSection(text) {
  return getBulletLines(text).map((line) => line.replace(/^[^a-zA-Z]+/, "").trim());
}

function stripBulletMarker(line) {
  return String(line || "").replace(/^[^a-zA-Z]+/, "").trim();
}

function hasQuantifiedResult(text) {
  return countQuantifiedResults(text) > 0;
}

function countQuantifiedResults(text) {
  const matches = normalizeText(text).match(/\d+\s*%|\$[\d,]+[kKmMbB]?|\b\d+[kKmMbB]\b|\b[1-9]\d{2,}\b|\b\d+x\b/gi) || [];
  return matches.filter((m) => {
    const digits = m.replace(/[^0-9]/g, "");
    return !/^20[0-3]\d$/.test(digits);
  }).length;
}

function countStrongVerbStarts(lines) {
  let hits = 0;
  for (const line of lines) {
    if (!line.trim()) continue;
    const stripped = line.trim().replace(/^[^a-zA-Z]+/, "");
    const lower = stripped.toLowerCase();
    // startsWith handles both "Optimized..." and "Optimizedproperty..." (merged PDF)
    if (line.trim().length > 20 && [...STRONG_VERBS].some((v) => lower.startsWith(v))) hits += 1;
  }
  return hits;
}

function countWeakPhrases(text) {
  const lower = normalizeText(text).toLowerCase();
  return WEAK_PHRASES.filter((phrase) => lower.includes(phrase)).length;
}

function detectRoleFamily(text) {
  const lower = normalizeText(text).toLowerCase();
  let best = { role: "general", hits: 0, terms: [] };
  for (const family of ROLE_FAMILIES) {
    const hits = family.terms.filter((term) => lower.includes(term));
    if (hits.length > best.hits) best = { role: family.role, hits: hits.length, terms: hits };
  }
  return best;
}

function detectRoleFamilyFromExplicitTitle(candidate = "") {
  const clean = cleanExplicitRoleCandidate(candidate);
  if (!clean) return null;

  const explicitRole = inferExplicitTitleRoleFamily(clean);
  if (explicitRole) return { role: explicitRole, hits: 1, terms: [clean], explicit: true };

  const canonicalRole = inferCanonicalRoleFamily(clean);
  if (canonicalRole) return { role: canonicalRole, hits: 1, terms: [clean], explicit: true };

  const detected = detectRoleFamily(clean);
  return detected.role === "general" ? null : { ...detected, explicit: true };
}

function inferExplicitTitleRoleFamily(title = "") {
  const lower = normalizeText(title).toLowerCase();
  if (/\bmanagement trainee\b/.test(lower) || /管培生/.test(title)) return "management_trainee";
  return null;
}

function cleanExplicitRoleCandidate(candidate = "") {
  return normalizeText(candidate)
    .replace(/^\s*【?\s*(?:岗位|岗位名称|职位|职位名称)\s*】?\s*[:：-]\s*/i, "")
    .replace(/^\s*(?:job\s*title|position\s*title|position|role)\s*[:：-]\s*/i, "")
    .replace(/\b(?:responsibilities?|requirements?|qualifications?|job\s+summary|what\s+you'?ll\s+do)\b.*$/i, "")
    .replace(/\s*[-|:：,;]\s*$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function uniqueRoleCandidates(candidates) {
  const seen = new Set();
  const result = [];
  for (const candidate of candidates) {
    const clean = cleanExplicitRoleCandidate(candidate);
    if (!clean) continue;
    const key = clean.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(clean);
  }
  return result;
}

function extractExplicitJdRoleCandidatesV2(jdText = "") {
  const candidates = [];
  const text = String(jdText || "");

  const lines = text
    .split(/\r?\n/)
    .map((line) => normalizeText(line).trim())
    .filter(Boolean)
    .slice(0, 12);

  for (const line of lines) {
    const labeledTitle = line.match(/^\s*(?:【?\s*(?:岗位|岗位名称|职位|职位名称)\s*】?|job\s*title|position\s*title|position|role)\s*[:：-]\s*(.+)$/i);
    if (labeledTitle) candidates.push(labeledTitle[1].trim());

    const cleanedLine = cleanExplicitRoleCandidate(line);
    const wordCount = cleanedLine.split(/\s+/).filter(Boolean).length;
    if (
      wordCount <= 8 &&
      !/[.!?]/.test(cleanedLine) &&
      (inferCanonicalRoleFamily(cleanedLine) || detectRoleFamilyFromExplicitTitle(cleanedLine))
    ) {
      candidates.push(cleanedLine);
    }
  }

  const chineseRole = extractChineseTargetRole(text);
  if (chineseRole) candidates.push(chineseRole);

  for (const role of extractTargetRole(text, "")) candidates.push(role);

  return uniqueRoleCandidates(candidates);
}

function detectExplicitTargetRole(jobTitle = "", jdText = "") {
  const jobTitleRole = detectRoleFamilyFromExplicitTitle(jobTitle);
  if (jobTitleRole) return { ...jobTitleRole, source: "jobTitle", title: cleanExplicitRoleCandidate(jobTitle) };

  for (const candidate of extractExplicitJdRoleCandidatesV2(jdText)) {
    const role = detectRoleFamilyFromExplicitTitle(candidate);
    if (role) return { ...role, source: "jdTitle", title: candidate };
  }

  return { role: "general", hits: 0, terms: [], explicit: false, source: null };
}

function formatTargetRoleSource(role) {
  return role?.source === "jobTitle" ? "目标岗位为" : "JD 指向";
}

function formatTargetRoleName(role) {
  return role?.title || formatRole(role?.role || "general");
}

function formatRoleMismatchProblem(explicitTargetRole, resumeRole) {
  const resumeRoleName = formatRole(resumeRole.role);
  if (explicitTargetRole?.explicit) {
    if (explicitTargetRole.role === resumeRole.role) {
      return `${formatTargetRoleSource(explicitTargetRole)}「${formatTargetRoleName(explicitTargetRole)}」，但 JD 技能信号与简历定位不够一致。`;
    }
    return `${formatTargetRoleSource(explicitTargetRole)}「${formatTargetRoleName(explicitTargetRole)}」，但简历定位更接近「${resumeRoleName}」，岗位信号不够一致。`;
  }
  return `目标岗位与简历定位不一致：简历定位更接近「${resumeRoleName}」，但 JD 未明确写出岗位 title。`;
}

function formatRoleMismatchDimensionProblem(explicitTargetRole, resumeRole) {
  const resumeRoleName = formatRole(resumeRole.role);
  if (explicitTargetRole?.explicit) {
    if (explicitTargetRole.role === resumeRole.role) {
      return `岗位信号不一致：${formatTargetRoleSource(explicitTargetRole)}「${formatTargetRoleName(explicitTargetRole)}」，但 JD 技能信号与简历定位不够一致`;
    }
    return `岗位信号不一致：${formatTargetRoleSource(explicitTargetRole)}「${formatTargetRoleName(explicitTargetRole)}」，简历更接近「${resumeRoleName}」`;
  }
  return `岗位信号不一致：JD 未明确写出岗位 title，简历更接近「${resumeRoleName}」`;
}

function scoreByRatio(ratio, scale) {
  if (ratio >= 0.90) return scale;
  if (ratio >= 0.80) return Math.round(scale * 0.83);
  if (ratio >= 0.70) return Math.round(scale * 0.66);
  if (ratio >= 0.60) return Math.round(scale * 0.51);
  if (ratio >= 0.50) return Math.round(scale * 0.36);
  if (ratio >= 0.40) return Math.round(scale * 0.22);
  if (ratio >= 0.30) return Math.round(scale * 0.13);
  if (ratio >= 0.20) return Math.round(scale * 0.07);
  if (ratio >= 0.10) return Math.round(scale * 0.03);
  return 0;
}

function compareKeywordProfile(profile, resumeText) {
  const categoryWeights = {
    core_skills: 0.38,
    tools: 0.24,
    domain_keywords: 0.18,
    action_verbs: 0.10,
    nice_to_have: 0.10
  };
  const comparison = {};
  let activeWeight = 0;
  let weightedRatio = 0;

  for (const [category, weight] of Object.entries(categoryWeights)) {
    const terms = profile[category] || [];
    const matched = terms.filter((term) => resumeHasTerm(resumeText, term));
    const missing = terms.filter((term) => !resumeHasTerm(resumeText, term));
    const ratio = terms.length ? matched.length / terms.length : null;
    comparison[category] = { terms, matched, missing, ratio };
    if (terms.length) {
      activeWeight += weight;
      weightedRatio += ratio * weight;
    }
  }

  const ratio = activeWeight ? weightedRatio / activeWeight : 0;
  const allTerms = unique([
    ...comparison.core_skills.terms,
    ...comparison.tools.terms,
    ...comparison.domain_keywords.terms,
    ...comparison.action_verbs.terms,
    ...comparison.nice_to_have.terms
  ]);
  const allMatched = allTerms.filter((term) => resumeHasTerm(resumeText, term));
  const allMissing = buildPrioritizedMissing(comparison);

  return {
    ratio,
    comparison,
    allTerms,
    allMatched,
    allMissing
  };
}

function buildPrioritizedMissing(comparison) {
  return unique([
    ...comparison.core_skills.missing,
    ...comparison.tools.missing,
    ...comparison.domain_keywords.missing,
    ...comparison.nice_to_have.missing,
    ...comparison.action_verbs.missing
  ]);
}

function resumeHasTerm(resumeText, term) {
  const lower = normalizeText(resumeText).toLowerCase();
  const clean = cleanKeyword(term);
  if (!clean) return false;
  // substring check handles both normal text and PDF-merged text (no spaces)
  if (lower.includes(clean)) return true;
  if (clean.includes(" ")) {
    // "spring boot" → also try "springboot" for PDFs where spaces were stripped
    if (lower.includes(clean.replace(/\s+/g, ""))) return true;
  } else {
    // inflected forms for single words ("-s", "-ed", "-ing")
    const re = new RegExp(`\\b${escapeRegExp(clean)}(?:s|ed|ing)?\\b`, "i");
    if (re.test(lower)) return true;
  }
  // Synonym / verb expansion: if the JD asks for a soft skill (e.g. "leadership"),
  // also check whether the resume demonstrates it through action verbs (e.g. "led").
  const synonyms = SKILL_VERB_MAP[clean];
  if (synonyms) {
    return synonyms.some((syn) => {
      if (syn.includes(" ")) return lower.includes(syn);
      const synRe = new RegExp(`\\b${escapeRegExp(syn)}(?:s|ed|ing)?\\b`, "i");
      return synRe.test(lower);
    });
  }
  return false;
}

function compareKeywordProfile(profile, resumeText) {
  const categoryWeights = {
    core_skills: 0.34,
    tools: 0.24,
    domain_keywords: 0.18,
    action_verbs: 0.12,
    nice_to_have: 0.12
  };
  const comparison = {};
  let activeWeight = 0;
  let weightedRatio = 0;
  let exactPhraseCount = 0;

  for (const [category, weight] of Object.entries(categoryWeights)) {
    const terms = profile[category] || [];
    const matches = terms.map((term) => matchTermWithCredit(resumeText, term, category));
    const matched = matches.filter((m) => m.credit > 0).map((m) => m.term);
    const exactMatched = matches.filter((m) => m.type === "exact").map((m) => m.term);
    const normalizedMatched = matches.filter((m) => m.type === "normalized").map((m) => m.term);
    const semanticMatched = matches.filter((m) => m.type === "semantic").map((m) => m.term);
    const partialMatched = matches.filter((m) => m.credit > 0 && m.credit < 1).map((m) => m.term);
    const missing = matches.filter((m) => m.credit <= 0).map((m) => m.term);
    const credit = matches.reduce((sum, m) => sum + m.credit, 0);
    const ratio = terms.length ? credit / terms.length : null;
    exactPhraseCount += exactMatched.length;
    comparison[category] = {
      terms,
      matched,
      exactMatched,
      normalizedMatched,
      semanticMatched,
      partialMatched,
      missing,
      matches,
      ratio
    };
    if (terms.length) {
      activeWeight += weight;
      weightedRatio += ratio * weight;
    }
  }

  const ratio = activeWeight ? weightedRatio / activeWeight : 0;
  const allMatches = uniqueByTerm(Object.values(comparison).flatMap((data) => data.matches || []));
  const allTerms = allMatches.map((match) => match.term);
  const allMatched = allMatches.filter((match) => match.credit > 0).map((match) => match.term);
  const allMissing = buildPrioritizedMissing(comparison);
  const hardMatches = allMatches.filter((match) => classifySkillType(match.term, match.category) === "hard");
  const softMatches = allMatches.filter((match) => classifySkillType(match.term, match.category) === "soft");

  return {
    ratio,
    comparison,
    allTerms,
    allMatched,
    allMissing,
    hardCoverage: coverageFromMatches(hardMatches),
    softCoverage: coverageFromMatches(softMatches),
    hardTermCount: hardMatches.length,
    softTermCount: softMatches.length,
    combinedKeywordCoverage: coverageFromMatches([...hardMatches, ...softMatches]),
    exactPhraseCount,
    experienceEvidence: analyzeKeywordEvidence(profile, resumeText)
  };
}

function resumeHasTerm(resumeText, term) {
  return matchTermWithCredit(resumeText, term).credit > 0;
}

function matchTermWithCredit(resumeText, term, category = "") {
  const lower = normalizeText(resumeText).toLowerCase();
  const clean = cleanKeyword(term);
  if (!clean) return { term: clean, category, type: "missing", credit: 0, matchedBy: null };

  if (hasExactPhrase(lower, clean)) {
    return { term: clean, category, type: "exact", credit: 1, matchedBy: clean };
  }
  if (clean.includes(" ")) {
    if (hasNormalizedPhrase(lower, clean)) {
      return { term: clean, category, type: "normalized", credit: 0.8, matchedBy: clean };
    }
  } else {
    const re = new RegExp(`\\b${escapeRegExp(clean)}(?:s|es|ed|ing)?\\b`, "i");
    if (re.test(lower)) {
      return { term: clean, category, type: "normalized", credit: 0.8, matchedBy: clean };
    }
  }

  const synonyms = unique([...(SKILL_VERB_MAP[clean] || []), ...(SEMANTIC_MATCH_MAP[clean] || [])]);
  const matchedSynonym = synonyms.find((syn) => phraseOrWordMatch(lower, cleanKeyword(syn)));
  if (matchedSynonym) {
    return {
      term: clean,
      category,
      type: "semantic",
      credit: SOFT_KEYWORD_TERMS.has(clean) || SKILL_VERB_MAP[clean] ? 0.6 : 0.5,
      matchedBy: cleanKeyword(matchedSynonym)
    };
  }

  const evidenceMatch = matchEvidencePattern(lower, clean);
  if (evidenceMatch) {
    return {
      term: clean,
      category,
      type: "semantic",
      credit: evidenceMatch.credit,
      matchedBy: evidenceMatch.matchedBy
    };
  }

  if (clean.includes(" ")) {
    const tokens = clean.split(/\s+/).filter((t) => t.length > 2 && !STOP_WORDS.has(t));
    const hits = tokens.filter((token) => phraseOrWordMatch(lower, token)).length;
    if (tokens.length >= 2 && hits / tokens.length >= 0.6) {
      return { term: clean, category, type: "semantic", credit: 0.4, matchedBy: `${hits}/${tokens.length} tokens` };
    }
  }

  return { term: clean, category, type: "missing", credit: 0, matchedBy: null };
}

function uniqueByTerm(matches) {
  const best = new Map();
  for (const match of matches) {
    const existing = best.get(match.term);
    if (!existing || match.credit > existing.credit) best.set(match.term, match);
  }
  return [...best.values()];
}

function coverageFromMatches(matches) {
  if (!matches.length) return 0;
  return matches.reduce((sum, match) => sum + match.credit, 0) / matches.length;
}

function hasExactPhrase(lowerText, cleanTerm) {
  if (!cleanTerm) return false;
  if (!cleanTerm.includes(" ")) {
    return new RegExp(`\\b${escapeRegExp(cleanTerm)}\\b`, "i").test(lowerText);
  }
  return new RegExp(`(^|[^a-z0-9+#])${escapeRegExp(cleanTerm)}([^a-z0-9+#]|$)`, "i").test(lowerText);
}

function hasNormalizedPhrase(lowerText, cleanTerm) {
  const compactText = lowerText.replace(/[\s/-]+/g, "");
  const compactTerm = cleanTerm.replace(/[\s/-]+/g, "");
  if (compactTerm && compactText.includes(compactTerm)) return true;
  const tokens = cleanTerm.split(/\s+/).filter(Boolean).map((token) => singularize(token));
  if (!tokens.length) return false;
  const normalizedText = lowerText
    .replace(/[-/]+/g, " ")
    .split(/\s+/)
    .map((token) => singularize(token))
    .join(" ");
  return normalizedText.includes(tokens.join(" "));
}

function phraseOrWordMatch(lowerText, cleanTerm) {
  if (!cleanTerm) return false;
  if (hasExactPhrase(lowerText, cleanTerm)) return true;
  return cleanTerm.includes(" ")
    ? hasNormalizedPhrase(lowerText, cleanTerm)
    : new RegExp(`\\b${escapeRegExp(cleanTerm)}(?:s|es|ed|ing)?\\b`, "i").test(lowerText);
}

function matchEvidencePattern(lowerText, cleanTerm) {
  const evidenceRules = [
    {
      terms: ["data visualization", "dashboarding", "reporting"],
      credit: 0.55,
      matchedBy: "dashboard/reporting evidence",
      patterns: [
        /\b(built|created|developed|designed|launched|maintained|delivered|automated)\b.{0,90}\b(dashboard|dashboards|report|reports|visualization|visualizations|chart|charts|tableau|power\s*bi|looker)\b/i,
        /\b(dashboard|dashboards|report|reports|visualization|visualizations|tableau|power\s*bi|looker)\b.{0,90}\b(kpi|metric|metrics|insight|insights|stakeholder|stakeholders|business)\b/i
      ]
    },
    {
      terms: ["business analysis"],
      credit: 0.55,
      matchedBy: "business analysis evidence",
      patterns: [
        /\b(analyzed|analysed|identified|translated|modeled|reported|built|created)\b.{0,90}\b(business|stakeholder|stakeholders|requirement|requirements|kpi|metric|metrics|process|processes)\b/i,
        /\b(business|stakeholder|stakeholders)\b.{0,90}\b(insight|insights|reporting|analysis|analytics|recommendation|recommendations)\b/i
      ]
    },
    {
      terms: ["requirements gathering"],
      credit: 0.55,
      matchedBy: "requirements gathering evidence",
      patterns: [
        /\b(gathered|gather|defined|define|translated|translate|elicited|documented|scoped|partnered|collaborated)\b.{0,90}\b(requirement|requirements|business needs|reporting needs|stakeholder needs|dashboard specs|specifications)\b/i,
        /\b(partnered|collaborated|worked)\b.{0,90}\b(stakeholder|stakeholders|business teams|product managers|users)\b.{0,90}\b(define|defined|translate|translated|scope|scoped|requirements|needs)\b/i
      ]
    },
    {
      terms: ["etl", "extraction"],
      credit: 0.55,
      matchedBy: "data pipeline evidence",
      patterns: [
        /\b(extracted|extract|ingested|ingest|loaded|load|transformed|transform|built|automated)\b.{0,90}\b(data|dataset|datasets|pipeline|pipelines|source|sources|warehouse)\b/i,
        /\b(data pipeline|data pipelines|data ingestion|data extraction|source data|etl pipeline)\b/i
      ]
    },
    {
      terms: ["decision-making"],
      credit: 0.5,
      matchedBy: "decision support evidence",
      patterns: [
        /\b(insight|insights|recommendation|recommendations|analysis|analytics)\b.{0,90}\b(decision|decisions|strategy|prioritization|roadmap|business)\b/i,
        /\b(data-driven|data driven)\b.{0,60}\b(decision|decisions|recommendation|recommendations|insight|insights)\b/i
      ]
    }
  ];

  const rule = evidenceRules.find((item) => item.terms.includes(cleanTerm));
  if (!rule) return null;
  return rule.patterns.some((pattern) => pattern.test(lowerText))
    ? { credit: rule.credit, matchedBy: rule.matchedBy }
    : null;
}

function singularize(token) {
  return String(token || "")
    .replace(/ies$/i, "y")
    .replace(/(?:ses|xes|zes|ches|shes)$/i, (m) => m.slice(0, -2))
    .replace(/s$/i, "");
}

function classifySkillType(term, category = "") {
  const clean = cleanKeyword(term);
  if (category === "action_verbs" || SOFT_KEYWORD_TERMS.has(clean) || SKILL_VERB_MAP[clean]) return "soft";
  return "hard";
}

function analyzeKeywordEvidence(profile, resumeText) {
  const sections = parseSections(resumeText);
  const experienceProjectsText = sectionText(sections, ["experience", "projects"]);
  const skillsText = sectionText(sections, ["skills"]);
  const terms = unique([
    ...(profile.core_skills || []),
    ...(profile.tools || []),
    ...(profile.domain_keywords || [])
  ].map(cleanKeyword).filter(Boolean)).slice(0, 40);
  const matched = terms.filter((term) => resumeHasTerm(resumeText, term));
  const inExperience = matched.filter((term) => resumeHasTerm(experienceProjectsText, term));
  const skillsOnly = matched.filter((term) => !resumeHasTerm(experienceProjectsText, term) && resumeHasTerm(skillsText, term));
  return {
    termCount: terms.length,
    matchedCount: matched.length,
    inExperienceCount: inExperience.length,
    skillsOnlyCount: skillsOnly.length,
    skillsOnlyShare: matched.length ? skillsOnly.length / matched.length : 0
  };
}

function computeHybridJdMatchRatio(keywordMatch, coreBulletSignal) {
  const keywordCoverage = keywordMatch.softTermCount
    ? keywordMatch.hardCoverage * 0.78 + keywordMatch.softCoverage * 0.22
    : (keywordMatch.hardTermCount ? keywordMatch.hardCoverage : keywordMatch.ratio);

  const evidence = keywordMatch.experienceEvidence || {};
  const evidenceCoverage = evidence.termCount
    ? Math.min(1, ((evidence.inExperienceCount || 0) + (evidence.skillsOnlyCount || 0) * 0.35) / evidence.termCount)
    : keywordCoverage;
  const roleCoreAlignment = typeof coreBulletSignal?.coverage === "number"
    ? coreBulletSignal.coverage
    : keywordCoverage;
  const placementQuality = typeof coreBulletSignal?.earlyPlacement === "number"
    ? coreBulletSignal.earlyPlacement
    : 0;

  const hybrid = keywordCoverage * 0.40 +
    evidenceCoverage * 0.35 +
    roleCoreAlignment * 0.15 +
    placementQuality * 0.10;

  return Math.max(keywordCoverage, hybrid);
}

function analyzeExactJobTitleMatch(resumeText, jobTitle, keywordProfile) {
  const targetTitles = unique([
    jobTitle,
    ...(keywordProfile.target_role || [])
  ].map(cleanKeyword).filter(Boolean));
  const title = targetTitles.find((term) => term.split(/\s+/).length >= 2) || targetTitles[0] || "";
  if (!title) return { targetTitle: "", exact: true, partial: false, matchedBy: null, penalty: 0 };
  const match = matchTermWithCredit(resumeText, title, "target_role");
  return {
    targetTitle: title,
    exact: match.type === "exact",
    partial: match.credit > 0 && match.type !== "exact",
    matchedBy: match.matchedBy,
    penalty: match.type === "exact" ? 0 : (match.credit > 0 ? 3 : 5)
  };
}

function buildScoreCaps({ keywordMatch, exactJobTitle, D_final, F, hybridCoverage }) {
  const caps = [];
  const capCoverage = typeof hybridCoverage === "number" ? hybridCoverage : keywordMatch.combinedKeywordCoverage;
  if (capCoverage < 0.3) caps.push({ max: 60, reason: "Hybrid JD coverage < 30%" });
  else if (capCoverage < 0.4) caps.push({ max: 72, reason: "Hybrid JD coverage < 40%" });
  if (exactJobTitle && !exactJobTitle.exact && !exactJobTitle.partial) caps.push({ max: 90, reason: "Exact job title missing" });
  if (D_final < 20) caps.push({ max: 70, reason: "D dimension < 20/45" });
  if (F < 14) caps.push({ max: 80, reason: "F dimension < 14/23" });
  return caps;
}

function analyzePhone(text) {
  const candidates = normalizeText(text).match(/(?:\+?\d[\d\s().-]{7,}\d)/g) || [];
  for (const candidate of candidates) {
    const digits = candidate.replace(/\D/g, "");
    if (digits.length === 10 || (digits.length === 11 && digits.startsWith("1"))) {
      return { present: true, valid: true, digits };
    }
  }
  return { present: candidates.length > 0, valid: false, digits: candidates[0]?.replace(/\D/g, "") || "" };
}

function latestDateOlderThanMonths(text, months) {
  const latest = extractLatestDate(text);
  if (!latest) return false;
  const now = new Date();
  const cutoff = new Date(now.getFullYear(), now.getMonth() - months, now.getDate());
  return latest < cutoff;
}

function extractLatestDate(text) {
  const monthNames = "jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec|january|february|march|april|june|july|august|september|october|november|december";
  const dates = [];
  const normalized = normalizeText(text);
  const monthYearRe = new RegExp(`\\b(${monthNames})\\.?\\s+(20\\d{2})\\b`, "gi");
  let match;
  while ((match = monthYearRe.exec(normalized))) {
    dates.push(new Date(Number(match[2]), monthToIndex(match[1]), 1));
  }
  const years = normalized.match(/\b20\d{2}\b/g) || [];
  for (const year of years) {
    dates.push(new Date(Number(year), 11, 1));
  }
  if (/present|current|now/i.test(normalized)) return new Date();
  return dates.length ? new Date(Math.max(...dates.map((d) => d.getTime()))) : null;
}

function monthToIndex(month) {
  const key = month.toLowerCase().slice(0, 3);
  return ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"].indexOf(key);
}

function analyzeCoreSkillBulletPlacement(bullets, coreSkills) {
  const required = (coreSkills || []).slice(0, 8);
  if (!required.length || !bullets.length) {
    return { coverage: 0, earlyPlacement: 0, coverageScore: 0, orderScore: 0 };
  }

  const matchedIndexes = [];
  for (const skill of required) {
    const idx = bullets.findIndex((bullet) => resumeHasTerm(bullet, skill));
    if (idx >= 0) matchedIndexes.push(idx);
  }

  const coverage = matchedIndexes.length / required.length;
  const earlyCount = matchedIndexes.filter((idx) => idx <= 2).length;
  const earlyPlacement = matchedIndexes.length ? earlyCount / matchedIndexes.length : 0;

  return {
    coverage,
    earlyPlacement,
    coverageScore: coverage >= 0.7 ? 2 : coverage >= 0.4 ? 1 : -1,
    orderScore: earlyPlacement >= 0.7 ? 1 : 0
  };
}

function scoreRoleRelevance({ keywordProfile, experienceProjectsText, skillsText, summaryText, resumeText }) {
  // Give full credit for skills appearing in experience bullets, and 0.4× partial
  // credit for skills that are only listed in the Skills section (not woven into
  // experience descriptions). This prevents an unfair 0% score when a candidate
  // properly lists their tech stack in a dedicated Skills section.
  const expTerms = unique([
    ...(keywordProfile.core_skills || []),
    ...(keywordProfile.domain_keywords || [])
  ].map(cleanKeyword).filter(Boolean)).slice(0, 20);
  const expInExp = expTerms.filter((t) => resumeHasTerm(experienceProjectsText, t)).length;
  const expInSkillsOnly = expTerms.filter(
    (t) => !resumeHasTerm(experienceProjectsText, t) && resumeHasTerm(skillsText, t)
  ).length;
  const experienceRatio = expTerms.length
    ? Math.min(1, (expInExp + expInSkillsOnly * 0.4) / expTerms.length)
    : 0;
  const skillsRatio = ratioForTerms(skillsText, [
    ...(keywordProfile.core_skills || []),
    ...(keywordProfile.tools || [])
  ]);
  const toolsRatio = ratioForTerms(`${skillsText}\n${experienceProjectsText}`, keywordProfile.tools || []);
  const titleSummaryRatio = ratioForTerms(summaryText, keywordProfile.target_role || []);
  const domainRatio = ratioForTerms(`${summaryText}\n${experienceProjectsText}`, keywordProfile.domain_keywords || []);

  const score =
    experienceRatio * DIMENSION_MAX.F * 0.45 +
    skillsRatio * DIMENSION_MAX.F * 0.25 +
    toolsRatio * DIMENSION_MAX.F * 0.15 +
    titleSummaryRatio * DIMENSION_MAX.F * 0.10 +
    domainRatio * DIMENSION_MAX.F * 0.05;

  return {
    score: Math.round(score),
    breakdown: {
      experienceProjectsCoreMatch: Number((experienceRatio * 100).toFixed(1)),
      skillsCoreMatch: Number((skillsRatio * 100).toFixed(1)),
      toolsMatch: Number((toolsRatio * 100).toFixed(1)),
      titleSummaryAliasMatch: Number((titleSummaryRatio * 100).toFixed(1)),
      domainKeywordMatch: Number((domainRatio * 100).toFixed(1))
    }
  };
}

function ratioForTerms(text, terms) {
  const cleanTerms = unique((terms || []).map(cleanKeyword).filter(Boolean)).slice(0, 20);
  if (!cleanTerms.length) return 0;
  const matched = cleanTerms.filter((term) => resumeHasTerm(text, term));
  return matched.length / cleanTerms.length;
}

// ── Experience date & structure helpers ──────────────────────────────────────

const MONTH_ABBR_MAP = {
  jan:1, feb:2, mar:3, apr:4, may:5, jun:6, jul:7, aug:8, sep:9, oct:10, nov:11, dec:12,
  january:1, february:2, march:3, april:4, june:6, july:7,
  august:8, september:9, october:10, november:11, december:12
};

function extractJobDateRange(line) {
  const s = normalizeText(line).toLowerCase();
  const re = /(?:(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+)?(20\d{2}|19\d{2})\s*[-–—]\s*(?:(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+)?(20\d{2}|19\d{2}|present|current|now)/i;
  const match = s.match(re);
  if (!match) {
    const numericMatch = s.match(/\b(0?[1-9]|1[0-2])\s*\/\s*((?:19|20)\d{2})\s*[-–—]\s*(?:(0?[1-9]|1[0-2])\s*\/\s*)?((?:19|20)\d{2}|present|current|now)\b/i);
    if (!numericMatch) return null;
    const [, startMonthStr, startYearStr, endMonthStr, endYearStr] = numericMatch;
    const startYear = parseInt(startYearStr);
    const startMonth = parseInt(startMonthStr);
    const isCurrent = /present|current|now/i.test(endYearStr);
    const endYear = isCurrent ? new Date().getFullYear() : parseInt(endYearStr);
    const endMonth = endMonthStr ? parseInt(endMonthStr) : (isCurrent ? new Date().getMonth() + 1 : 6);
    return { startYear, startMonth, endYear, endMonth, isCurrent,
      durationMonths: (endYear - startYear) * 12 + (endMonth - startMonth) };
  }
  const [, startMonStr, startYearStr, endMonStr, endYearStr] = match;
  const startYear = parseInt(startYearStr);
  const startMonth = startMonStr ? (MONTH_ABBR_MAP[startMonStr.slice(0, 3)] || 6) : 6;
  const isCurrent = /present|current|now/.test(endYearStr);
  const endYear = isCurrent ? new Date().getFullYear() : parseInt(endYearStr);
  const endMonth = endMonStr ? (MONTH_ABBR_MAP[endMonStr.slice(0, 3)] || 6) : (isCurrent ? new Date().getMonth() + 1 : 6);
  return { startYear, startMonth, endYear, endMonth, isCurrent,
    durationMonths: (endYear - startYear) * 12 + (endMonth - startMonth) };
}

// Returns true if a line looks like a company name or location header — used to
// distinguish real company/location lines from bullet wrap-around continuations
// that also happen to start with an uppercase letter (e.g. "DNS resolution, …").
function isCompanyOrLocationLine(line) {
  // Legal entity suffixes
  if (/\b(inc\.?|l\.?l\.?c\.?|ltd\.?|co\.,|corp\.?|p\.?c\.?|llp|pllc)\b/i.test(line)) return true;
  // Common company-type words
  if (/\b(technology|technologies|tech|systems?|solutions?|consulting|consultancy|group|laboratory|laboratories|labs?|studio|agency|agencies|enterprises?|holdings?|capital|ventures?)\b/i.test(line)) return true;
  // Country names
  if (/\b(china|usa|united states|canada|uk|england|australia|germany|japan|france|india|korea|singapore|hong kong|taiwan)\b/i.test(line)) return true;
  // "City, ST" two-letter state abbreviation
  if (/,\s*(?:AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY|DC)\b/i.test(line)) return true;
  return false;
}

function parseExperienceEntries(expText) {
  const lines = normalizeText(expText).split("\n").map((l) => l.trim()).filter(Boolean);
  const entries = [];
  let current = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const dr = extractJobDateRange(line);

    if (dr) {
      // ── Look back for company / location header lines ─────────────────────
      // In many resume formats the company name and city appear on the line(s)
      // BEFORE the date range, e.g.:
      //   Shenzhen Meida Technology Co., Ltd.  Shenzhen, China
      //   Software Engineer  Mar 2022 – Jun 2022   ← date range line
      // Use isCompanyOrLocationLine() to filter out bullet wrap-around lines
      // that also happen to start with uppercase (e.g. "DNS resolution, …").
      const headerLines = [];
      for (let j = i - 1; j >= Math.max(0, i - 3); j--) {
        const prev = lines[j];
        const isBullet = prev.startsWith("-") || prev.startsWith("•");
        const hasYear  = /\d{4}/.test(prev);
        const isUpperStart = /^[A-Z0-9一-鿿]/.test(prev);
        // No length cap here — PDF column-spacing can produce very long lines
        // (e.g. "Shenzhen Meida Technology Co., Ltd.          Shenzhen, China").
        // isCompanyOrLocationLine() is the real filter; length would block valid headers.
        if (!isBullet && !hasYear && isUpperStart && isCompanyOrLocationLine(prev)) {
          headerLines.unshift(prev);
        } else {
          break;
        }
      }

      if (current) entries.push(current);
      current = {
        dateRange: dr,
        titleLines: [...headerLines, line],
        rawText:    [...headerLines, line].join("\n")
      };

    } else if (current) {
      current.rawText += "\n" + line;

      const isBulletLine   = line.startsWith("-") || line.startsWith("•");
      // Lowercase-starting lines are wrap-around continuations of bullet text
      // (e.g. "with native Kotlin modules…") — never a job title or company name
      const isContinuation = /^[a-z]/.test(line);

      if (line.length < 300 && !isBulletLine && !isContinuation) {
        current.titleLines.push(line);
      }
    }
  }
  if (current) entries.push(current);
  return entries;
}

function checkChronologicalOrder(entries) {
  if (entries.length < 2) return true;
  for (let i = 0; i < entries.length - 1; i++) {
    const a = entries[i].dateRange;
    const b = entries[i + 1].dateRange;
    if (a.startYear * 12 + a.startMonth < b.startYear * 12 + b.startMonth) return false;
  }
  return true;
}

function detectShortTenures(entries) {
  const issues = [];
  for (const entry of entries) {
    const dur = entry.dateRange.durationMonths;
    if (dur >= 0 && dur <= 3) {
      const titleText = entry.titleLines.join(" ");
      const fullText = `${titleText} ${entry.rawText || ""}`;
      if (!looksLikeEmploymentEntry(entry)) continue;
      const isIntern = /intern|internship|co-?op|contractor|contract\b|temp\b|temporary|part[- ]time|volunteer/i.test(fullText);
      if (!isIntern) {
        // Priority 1: a line that looks like a company name (has legal/tech suffix)
        const companyLine = entry.titleLines.find((l) =>
          !/\d{4}/.test(l) &&
          /\b(inc\.?|l\.?l\.?c\.?|ltd\.?|co\.,|corp\.?|technology|technologies|tech|systems?|solutions?|consulting|group|enterprises?)\b/i.test(l)
        );
        // Priority 2: first line without a year that is NOT just a standalone country/city word
        const fallbackLine = entry.titleLines.find((l) =>
          !/\d{4}/.test(l) && !/^(china|usa|united states|remote|canada|uk|australia)$/i.test(l.trim())
        );
        // Priority 3: strip date portion from first titleLine
        const strippedFirst = (entry.titleLines[0] || "")
          .replace(/(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+\d{4}|\d{4}\s*[-–—]\s*(?:\d{4}|present|current|now)/gi, "")
          .trim();
        const rawTitle = companyLine || fallbackLine || strippedFirst;
        issues.push({ title: rawTitle.slice(0, 60), durationMonths: dur });
      }
    }
  }
  return issues;
}

function looksLikeEmploymentEntry(entry) {
  const titleText = entry.titleLines.join(" ");
  const rawText = entry.rawText || "";
  const combined = `${titleText} ${rawText}`;
  const hasProjectSignal = /\b(project|capstone|case\s+study|coursework|academic|competition|hackathon|research\s+project|portfolio)\b/i.test(combined);
  const hasEmploymentSignal = /\b(engineer|developer|analyst|manager|specialist|consultant|assistant|associate|coordinator|designer|marketer|strategist|intern|internship|trainee|contractor|founder|lead|director|officer|researcher|scientist|editor|producer|tutor|teacher)\b/i.test(titleText);
  const hasCompanySignal = entry.titleLines.some((l) =>
    !/\d{4}/.test(l) &&
    /\b(inc\.?|l\.?l\.?c\.?|ltd\.?|co\.,|corp\.?|company|agency|group|studio|labs?|laborator(?:y|ies)|technology|technologies|tech|systems?|solutions?|consulting|capital|ventures?|university|college|school|institute|department)\b/i.test(l)
  );
  const hasWorkBullets = getBulletLines(rawText).some((line) =>
    /\b(client|customer|stakeholder|team|cross-functional|production|launched|shipped|deployed|managed|owned|supported|reported|revenue|budget|sales|campaign|operations)\b/i.test(line)
  );

  if (hasProjectSignal && !(hasCompanySignal && hasEmploymentSignal)) return false;
  return hasCompanySignal || hasEmploymentSignal || hasWorkBullets;
}

function computeMustHaveFrequencyBonus(coreSkills, resumeText) {
  if (!coreSkills || !coreSkills.length) return 0;
  const topSkills = coreSkills.slice(0, 5);
  const lower = normalizeText(resumeText).toLowerCase();
  let total = 0;
  for (const skill of topSkills) {
    const clean = cleanKeyword(skill);
    if (!clean) continue;
    total += (lower.match(new RegExp(escapeRegExp(clean), "gi")) || []).length;
  }
  if (total >= 15) return 2;
  if (total >= 8) return 1;
  return 0;
}

function checkJdPriorityAlignment(coreSkills, firstJobText) {
  if (!coreSkills || !coreSkills.length || !firstJobText) return 0;
  const topSkills = coreSkills.slice(0, 4);
  const matched = topSkills.filter((skill) => resumeHasTerm(firstJobText, skill));
  if (matched.length >= 3) return 2;
  if (matched.length >= 1) return 1;
  return 0;
}

// ── File / format helpers ─────────────────────────────────────────────────────

function analyzeFileName(fileName) {
  if (!fileName) return { score: 0, issues: [] };
  const issues = [];
  const fn = fileName.replace(/\.(pdf|docx?|txt)$/i, "").toLowerCase();
  const hasCorrectResume = fn.includes("resume");
  const hasMisspelling = !hasCorrectResume &&
    ["remuse", "resme", "rsume", "reesume", "reusme", "resumee"].some((m) => fn.includes(m));
  const hasNumberSuffix = /\(\d+\)/.test(fn);
  const parts = fn.split(/[_\s\-./]+/).filter(Boolean);
  const hasCopySuffix = parts.some((p) => ["copy", "draft", "final", "new", "old"].includes(p) || /^v\d+$/.test(p));
  let score = 0;
  if (hasMisspelling) {
    issues.push('文件名 "resume" 拼写有误（如 remuse、resme），请更正');
    score -= 1;
  } else if (hasCorrectResume) {
    if (hasNumberSuffix) issues.push('文件名含序号后缀如 (1)(2)，请删除并命名为 姓名_Resume.pdf');
    if (hasCopySuffix) issues.push('文件名含 copy/draft 等后缀，请删除');
    if (!hasNumberSuffix && !hasCopySuffix) score += 1;
  } else {
    issues.push('文件名未包含 "resume"，建议命名为 姓名_Resume.pdf');
  }
  return { score, issues };
}

function hasInconsistentDateFormat(text) {
  const hasSpelledMonths = /\b(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|oct|nov|dec)\b/i.test(text);
  const hasNumericMonthDates = /\b(0?[1-9]|1[0-2])\s*\/\s*(20\d{2}|19\d{2})\b/.test(text);
  return hasSpelledMonths && hasNumericMonthDates;
}

function detectChinaExperience(expText, fullText, entries = []) {
  const textToCheck = normalizeText(expText && expText.trim().length > 50 ? expText : fullText);

  const chinaPattern = /\b(beijing|shanghai|shenzhen|guangzhou|chengdu|hangzhou|nanjing|wuhan|tianjin|xi'?an|chongqing|suzhou|zhengzhou|qingdao|dongguan|china|p\.?r\.?\s*china|chinese market)\b/i;
  const chineseCompanyPattern = /\b(alibaba|tencent|baidu|huawei|xiaomi|jd\.com|bytedance|didi|meituan|netease|pinduoduo|ctrip|sina|sohu|lenovo|haier|byd|zte|oppo|vivo|weibo)\b/i;

  // Expanded US city/state list — includes commonly used California cities
  const usPattern = /\b(new york|san francisco|los angeles|chicago|seattle|boston|austin|houston|dallas|atlanta|denver|miami|phoenix|san jose|san diego|irvine|santa clara|sunnyvale|mountain view|palo alto|menlo park|redwood city|cupertino|fremont|oakland|berkeley|pasadena|long beach|anaheim|santa ana|riverside|silicon valley|bay area|nyc|new jersey|philadelphia|portland|minneapolis|pittsburgh|detroit|nashville|charlotte|indianapolis|columbus|memphis|baltimore|raleigh|tampa|orlando|las vegas|salt lake city|cincinnati|kansas city|st\.?\s*louis|sacramento|washington|district of columbia|california|texas|florida|illinois|ohio|georgia|colorado|massachusetts|virginia|pennsylvania|new york state|remote|united states|u\.s\.a?\.?|usa)\b/i;
  // "City, ST" two-letter state abbreviation — most reliable US address signal.
  // Uses /i flag so it also catches lowercased text from PDF extraction ("irvine, ca").
  const usStateAbbrevPattern = /,\s*(?:AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY|DC)\b/i;

  const hasChina = (t) => chinaPattern.test(t) || chineseCompanyPattern.test(t);
  const hasUS   = (t) => usPattern.test(t) || usStateAbbrevPattern.test(t);

  // ── Per-entry detection + full-text US fallback ──────────────────────────────
  // Why full-text fallback matters: many resumes put "City, ST" on the line BEFORE
  // the date range. parseExperienceEntries starts each entry at the date-range line,
  // so "Irvine, CA" placed above the date is NOT captured in entry.rawText.
  // Solution: when per-entry US count is 0 but China signals exist, also scan the
  // full experience text before declaring allChina = true.
  if (entries && entries.length > 0) {
    let chinaCount = 0;
    let usCount    = 0;
    for (const entry of entries) {
      const t = normalizeText(entry.rawText || "");
      if (hasChina(t)) chinaCount++;
      if (hasUS(t))   usCount++;
    }
    if (chinaCount > 0 || usCount > 0) {
      // If no US signals found in per-entry text, also check the full experience
      // block — location lines that precede the date will be caught here.
      const effectiveHasUS = usCount > 0 || hasUS(textToCheck);
      return {
        allChina:       chinaCount > 0 && !effectiveHasUS,
        hasAnyChinaExp: chinaCount > 0
      };
    }
    // No signals at all in any entry — fall through to full-text check.
  }

  // ── Full-text fallback ────────────────────────────────────────────────────────
  const hasChinaSignals = hasChina(textToCheck);
  const hasUsSignals    = hasUS(textToCheck);
  return {
    allChina:       hasChinaSignals && !hasUsSignals,
    hasAnyChinaExp: hasChinaSignals
  };
}

// ── New rule helpers ─────────────────────────────────────────────────────────

function hasInconsistentMonthStyle(text) {
  // Flag if both full names (January) and abbreviations (Jan) appear in date context
  const hasFullMonth = /\b(January|February|March|April|June|July|August|September|October|November|December)\s+\d{4}/i.test(text);
  const hasAbbrMonth = /\b(Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\.?\s+\d{4}/i.test(text);
  return hasFullMonth && hasAbbrMonth;
}

function checkGPA(educationText) {
  return /\b(GPA|G\.P\.A\.)\s*[:;]?\s*\d\.\d|\b\d\.\d+\s*[\/]\s*4(\.\d+)?\b/i.test(educationText);
}

function checkSectionHasDates(text) {
  return /\b(19|20)\d{2}\b/.test(text);
}

function checkExperienceLocations(expEntries) {
  if (!expEntries.length) return { allHaveLocation: true, missingCount: 0 };
  const locationRe = /\b[A-Z][A-Za-z .'-]+,\s*(?:[A-Z]{2}|China|USA|United States|Canada|Singapore|Taiwan|Hong Kong)\b|\b(Remote|Hybrid|On-?site)\b/i;
  const missing = expEntries.filter(e => !locationRe.test(`${e.titleLines.join(" ")} ${e.rawText || ""}`));
  return {
    allHaveLocation: missing.length === 0,
    missingCount: missing.length,
    missingEntries: missing.map((entry) => ({
      titleLines: entry.titleLines,
      rawText: entry.rawText
    }))
  };
}

function checkJobTitleAlignment(expEntries, jobTitle) {
  if (!jobTitle || !expEntries.length) return { aligned: true };
  const jdWords = jobTitle.toLowerCase().split(/[\s/,\-]+/).filter(w => w.length > 3);
  if (!jdWords.length) return { aligned: true };
  const allTitles = expEntries.flatMap(e => e.titleLines).join(" ").toLowerCase();
  const matchCount = jdWords.filter(w => allTitles.includes(w)).length;
  return { aligned: matchCount >= Math.ceil(jdWords.length * 0.5) };
}

// ── Verb diversity analysis ───────────────────────────────────────────────────

// Returns the base STRONG_VERB that `bulletLine` starts with, or null.
// Longest-match wins (e.g. "managed" beats "manage").
function getStartingVerb(bulletLine) {
  const lower = bulletLine.replace(/^[^a-zA-Z一-鿿]+/, "").toLowerCase().trim();
  if (!lower) return null;
  let best = null;
  for (const v of STRONG_VERBS) {
    if (lower.startsWith(v) && (!best || v.length > best.length)) best = v;
  }
  return best;
}

// Counts how often each starting verb is used across all bullet lines.
// Returns diversity stats useful for C-dimension scoring.
function analyzeVerbDiversity(bullets) {
  const verbCounts = {};
  let verbBulletCount = 0;

  for (const bullet of bullets) {
    if (!bullet || bullet.trim().length <= 15) continue;
    const verb = getStartingVerb(bullet);
    if (verb) {
      verbBulletCount++;
      verbCounts[verb] = (verbCounts[verb] || 0) + 1;
    }
  }

  const uniqueVerbCount = Object.keys(verbCounts).length;
  const maxRepeat = verbBulletCount > 0 ? Math.max(...Object.values(verbCounts)) : 0;
  const diversityRatio = verbBulletCount > 0 ? uniqueVerbCount / verbBulletCount : 1;
  const repeatedVerbs = Object.entries(verbCounts)
    .filter(([, c]) => c >= 3)
    .sort((a, b) => b[1] - a[1])
    .map(([verb, count]) => ({ verb, count }));

  return { verbCounts, uniqueVerbCount, verbBulletCount, diversityRatio, repeatedVerbs, maxRepeat };
}

// ── Soft-skill / tech-skill balance ──────────────────────────────────────────

// Counts unique soft-skill keywords and tech-skill tool terms found in bullet text.
// Returns the raw counts and matched term lists for reporting.
function analyzeSkillBalance(bulletLines) {
  const bulletText = bulletLines.join(" ").toLowerCase();

  // Soft skills: match against SOFT_SKILL_KEYWORDS
  const softMatched = [];
  for (const term of SOFT_SKILL_KEYWORDS) {
    const re = term.includes(" ")
      ? new RegExp(escapeRegExp(term), "i")
      : new RegExp(`\\b${escapeRegExp(term)}\\b`, "i");
    if (re.test(bulletText)) softMatched.push(term);
  }

  // Tech skills: leverage the existing tools list + common in-bullet tech terms
  const techCandidates = unique([
    ...CATEGORY_PHRASES.tools,
    "algorithm", "backend", "frontend", "full stack", "system design", "architecture",
    "database", "query", "pipeline", "model", "deployment",
    "testing", "debugging", "code review", "version control", "git",
    "rest api", "graphql", "microservice", "api", "ci/cd", "devops",
    "regression", "classification", "forecasting", "statistical"
  ]);
  const techMatched = [];
  const seen = new Set();
  for (const term of techCandidates) {
    const clean = term.toLowerCase();
    if (seen.has(clean)) continue;
    seen.add(clean);
    const re = clean.includes(" ")
      ? new RegExp(escapeRegExp(clean), "i")
      : new RegExp(`\\b${escapeRegExp(clean)}\\b`, "i");
    if (re.test(bulletText)) techMatched.push(term);
  }

  const softCount = softMatched.length;
  const techCount = techMatched.length;
  const minCount = Math.min(softCount, techCount);
  const maxCount = Math.max(softCount, techCount);
  // ratio = how many times larger the dominant side is (1 = perfectly balanced)
  const ratio = minCount > 0 ? maxCount / minCount : (maxCount > 0 ? maxCount : 1);

  return { softCount, techCount, softMatched, techMatched, ratio };
}

// ── Graduation date detection ─────────────────────────────────────────────────
// Returns { year, month, expected } or null.
// `expected: true`  → still enrolled / future graduation (treat as recent grad)
// `expected: false` → already graduated; check year/month against today
function extractGraduationDate(educationText) {
  if (!educationText || !educationText.trim()) return null;
  const lower = normalizeText(educationText).toLowerCase();

  // Currently enrolled or expected graduation
  if (/\b(expected|graduating|anticipated)\b/.test(lower) || /\b(present|current|now)\b/.test(lower)) {
    return { expected: true };
  }

  const monthPat = "jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec";
  const candidates = [];
  let m;

  // "May 2020 – May 2024" — capture end month + year
  const rangeEndRe = new RegExp(
    `(?:${monthPat})[a-z]*\\.?\\s+20\\d{2}\\s*[-–—]\\s*((?:${monthPat})[a-z]*\\.?\\s+)?(20\\d{2})`,
    "gi"
  );
  while ((m = rangeEndRe.exec(lower)) !== null) {
    const rawMon = (m[1] || "jun").trim().slice(0, 3);
    const idx = monthToIndex(rawMon);
    candidates.push({ year: parseInt(m[2]), month: idx >= 0 ? idx + 1 : 6, expected: false });
  }

  // "2020 – 2024" year-only ranges
  const yearRangeRe = /\b20\d{2}\s*[-–—]\s*(20\d{2})\b/g;
  while ((m = yearRangeRe.exec(lower)) !== null) {
    candidates.push({ year: parseInt(m[1]), month: 6, expected: false });
  }

  if (candidates.length) {
    // Return the most recent end date
    return candidates.reduce((a, b) => (a.year * 12 + a.month >= b.year * 12 + b.month ? a : b));
  }

  // Fallback: any year mentioned
  const years = (lower.match(/\b(20\d{2})\b/g) || []).map(Number);
  if (years.length) return { year: Math.max(...years), month: 6, expected: false };
  return null;
}

function analyzeWriteGoodIssues(bulletTexts) {
  try {
    const writeGood = require("write-good");
    let passiveCount = 0;
    const flagged = [];
    for (const bullet of bulletTexts.slice(0, 25)) {
      const issues = writeGood(bullet, {
        passive: true, weasel: false, adverb: false,
        illusion: false, so: false, thereIs: false, cliches: false
      });
      if (issues.length > 0) {
        passiveCount += issues.length;
        if (flagged.length < 3) flagged.push({ text: bullet.slice(0, 100), reason: issues[0].reason });
      }
    }
    return { passiveCount, flagged };
  } catch (e) {
    return { passiveCount: 0, flagged: [] };
  }
}

function checkRepetitiveVerbs(bulletLines) {
  const verbCounts = {};
  for (const line of bulletLines) {
    const stripped = line.trim().replace(/^[^a-zA-Z]+/, "");
    const firstWord = stripped.split(/\s+/)[0]?.toLowerCase().replace(/[^a-z]/g, "");
    if (!firstWord || firstWord.length < 3) continue;
    verbCounts[firstWord] = (verbCounts[firstWord] || 0) + 1;
  }
  const repetitive = Object.entries(verbCounts)
    .filter(([, count]) => count >= 2)
    .sort(([, a], [, b]) => b - a)
    .map(([verb, count]) => ({ verb, count }));
  const maxCount = repetitive.length ? repetitive[0].count : 0;
  const maxVerb  = repetitive.length ? repetitive[0].verb  : null;
  return { repetitive, maxCount, maxVerb };
}

// ── Candidate profile detection ──────────────────────────────────────────────

function detectSeniority(expEntries) {
  let totalMonths = 0;
  for (const entry of expEntries) {
    const dr = entry.dateRange;
    const text = entry.titleLines.join(" ").toLowerCase();
    const isIntern = /intern|internship|co-?op|contractor|temp\b|temporary|part[- ]time|volunteer/i.test(text);
    if (!isIntern && dr.durationMonths > 0) {
      totalMonths += Math.min(dr.durationMonths, 72);
    }
  }
  if (totalMonths < 24) return "entry_level";
  if (totalMonths < 60) return "mid_level";
  return "senior";
}

function buildProfile({ expEntries, isRecentGraduate, targetRole, resumeRole, hasWillingToRelocate, allChina, hasAnyChinaExp }) {
  const seniority = detectSeniority(expEntries);
  let candidateType;
  if (isRecentGraduate || seniority === "entry_level") candidateType = "early_career";
  else if (targetRole.role !== "general" && resumeRole.role !== targetRole.role) candidateType = "career_changer";
  else candidateType = "experienced";
  const market = allChina ? "china" : hasAnyChinaExp ? "mixed" : "us";
  return {
    roleFamily: targetRole.role,
    targetRole: targetRole.role,
    seniority,
    candidateType,
    market,
    willingToRelocate: hasWillingToRelocate
  };
}

// ── Problem tags ─────────────────────────────────────────────────────────────

const PROBLEM_TAG_DEFS = {
  // A
  outdated_resume:           { dimension: "A", topic: "resume_maintenance",    severity: "medium",   retrievalWeight: 0.5  },
  non_chronological_order:   { dimension: "A", topic: "format",                severity: "high",     retrievalWeight: 0.3  },
  inconsistent_date_format:  { dimension: "A", topic: "format",                severity: "low",      retrievalWeight: 0.2  },
  missing_section_dates:     { dimension: "A", topic: "format",                severity: "low",      retrievalWeight: 0.2  },
  file_naming_issue:         { dimension: "A", topic: "format",                severity: "low",      retrievalWeight: 0.15 },
  // B
  missing_summary:           { dimension: "B", topic: "resume_structure",      severity: "high",     retrievalWeight: 0.6  },
  missing_gpa:               { dimension: "B", topic: "education_completeness", severity: "medium",  retrievalWeight: 0.4  },
  missing_coursework:        { dimension: "B", topic: "education_completeness", severity: "medium",  retrievalWeight: 0.35 },
  missing_contact_info:      { dimension: "B", topic: "searchability",         severity: "high",     retrievalWeight: 0.5  },
  missing_linkedin:          { dimension: "B", topic: "searchability",         severity: "low",      retrievalWeight: 0.3  },
  missing_portfolio:         { dimension: "B", topic: "portfolio_links",      severity: "high",     retrievalWeight: 0.65 },
  missing_github_link:       { dimension: "B", topic: "code_links",           severity: "medium",   retrievalWeight: 0.55 },
  missing_exp_location:      { dimension: "B", topic: "searchability",         severity: "low",      retrievalWeight: 0.25 },
  // C
  insufficient_quantification: { dimension: "C", topic: "content_quality",    severity: "high",     retrievalWeight: 0.7  },
  weak_verbs:                { dimension: "C", topic: "content_quality",       severity: "medium",   retrievalWeight: 0.6  },
  passive_voice:             { dimension: "C", topic: "content_quality",       severity: "medium",   retrievalWeight: 0.5  },
  repetitive_verbs:          { dimension: "C", topic: "content_quality",       severity: "low",      retrievalWeight: 0.4  },
  low_bullet_coverage:       { dimension: "C", topic: "content_quality",       severity: "medium",   retrievalWeight: 0.5  },
  short_tenure_unexplained:  { dimension: "C", topic: "career_narrative",      severity: "high",     retrievalWeight: 0.6  },
  marketing_metric_gap:      { dimension: "C", topic: "content_quality",       severity: "medium",   retrievalWeight: 0.72 },
  marketing_audience_channel_gap: { dimension: "C", topic: "experience_rewrite", severity: "medium", retrievalWeight: 0.7 },
  // D
  keyword_gap_critical:      { dimension: "D", topic: "keyword_alignment",     severity: "critical", retrievalWeight: 0.9  },
  keyword_gap_major:         { dimension: "D", topic: "keyword_alignment",     severity: "high",     retrievalWeight: 0.75 },
  keyword_gap_minor:         { dimension: "D", topic: "keyword_alignment",     severity: "medium",   retrievalWeight: 0.5  },
  missing_tools:             { dimension: "D", topic: "tools_alignment",       severity: "high",     retrievalWeight: 0.7  },
  marketing_tool_gap:         { dimension: "D", topic: "keyword_alignment",     severity: "high",     retrievalWeight: 0.78 },
  marketing_experience_keyword_gap: { dimension: "D", topic: "experience_rewrite", severity: "medium", retrievalWeight: 0.68 },
  // E
  all_china_experience:      { dimension: "E", topic: "market_fit",            severity: "critical", retrievalWeight: 0.9  },
  partial_china_experience:  { dimension: "E", topic: "market_fit",            severity: "high",     retrievalWeight: 0.7  },
  no_relocate_signal:        { dimension: "E", topic: "market_fit",            severity: "medium",   retrievalWeight: 0.5  },
  // F
  role_mismatch:             { dimension: "F", topic: "career_positioning",    severity: "high",     retrievalWeight: 0.8  },
  job_title_mismatch:        { dimension: "F", topic: "career_positioning",    severity: "medium",   retrievalWeight: 0.55 },
  summary_missing_role:      { dimension: "F", topic: "career_positioning",    severity: "medium",   retrievalWeight: 0.5  },
  marketing_business_goal_gap:{ dimension: "F", topic: "summary_positioning",  severity: "medium",   retrievalWeight: 0.66 },
  career_growth_optimization:{ dimension: "F", topic: "career_growth",         severity: "low",      retrievalWeight: 0.35 }
};

function makeTag(tagKey) {
  const def = PROBLEM_TAG_DEFS[tagKey];
  if (!def) return null;
  return { tag: tagKey, ...def };
}

function buildProblemTags({
  resumeOutdated, isChronological, inconsistentDates, inconsistentMonthStyle,
  educationHasDates, projectsHasDates, fileNameIssues,
  hasSummary, isRecentGraduate, hasEducation, hasGPA, hasCoursework,
  emailValid, phoneValid, hasLinkedIn, hasPortfolio, hasGithub, portfolioExpected, githubExpected, expLocationResult,
  quantifiedCount, weakPhraseCount, writeGoodResult, repetitiveVerbResult,
  coreSkillBulletCoverage, shortTenures,
  hasJD, jdMatchRatio, keywordMatch,
  allChina, hasAnyChinaExp, hasWillingToRelocate,
  targetRole, resumeRole, jobTitleAligned, summaryMentionsRole, total
}) {
  const tags = [];
  const push = (key) => { const t = makeTag(key); if (t) tags.push(t); };

  // A
  if (resumeOutdated) push("outdated_resume");
  if (!isChronological) push("non_chronological_order");
  if (inconsistentDates || inconsistentMonthStyle) push("inconsistent_date_format");
  if ((hasEducation && !educationHasDates) || !projectsHasDates) push("missing_section_dates");
  if (fileNameIssues && fileNameIssues.length) push("file_naming_issue");

  // B
  if (!hasSummary && !isRecentGraduate) push("missing_summary");
  if (hasEducation && !hasGPA) push("missing_gpa");
  if (hasEducation && !hasCoursework) push("missing_coursework");
  if (!emailValid || !phoneValid) push("missing_contact_info");
  if (!hasLinkedIn) push("missing_linkedin");
  if (portfolioExpected && !hasPortfolio) push("missing_portfolio");
  if (githubExpected && !hasGithub) push("missing_github_link");
  if (expLocationResult && !expLocationResult.allHaveLocation) push("missing_exp_location");

  // C
  if (quantifiedCount < 3) push("insufficient_quantification");
  if (weakPhraseCount >= 3) push("weak_verbs");
  if (writeGoodResult?.passiveCount >= 2) push("passive_voice");
  if (repetitiveVerbResult?.maxCount >= 2) push("repetitive_verbs");
  if (coreSkillBulletCoverage < 0.4) push("low_bullet_coverage");
  if (shortTenures && shortTenures.length > 0) push("short_tenure_unexplained");

  // D
  if (hasJD) {
    if (jdMatchRatio < 0.3) push("keyword_gap_critical");
    else if (jdMatchRatio < 0.5) push("keyword_gap_major");
    else if (jdMatchRatio < 0.7) push("keyword_gap_minor");
    if ((keywordMatch?.comparison?.tools?.missing?.length || 0) > 2) push("missing_tools");
  }

  // E
  if (allChina) push("all_china_experience");
  else if (hasAnyChinaExp) push("partial_china_experience");
  if (!hasWillingToRelocate && (allChina || hasAnyChinaExp)) push("no_relocate_signal");

  // F
  if (targetRole.role !== "general" && resumeRole.role !== targetRole.role) push("role_mismatch");
  if (jobTitleAligned && !jobTitleAligned.aligned) push("job_title_mismatch");
  if (!summaryMentionsRole) push("summary_missing_role");
  if (total >= 70) push("career_growth_optimization");

  // Sort: critical → high → medium → low
  const order = { critical: 0, high: 1, medium: 2, low: 3 };
  return tags.sort((a, b) => (order[a.severity] ?? 9) - (order[b.severity] ?? 9));
}

function makeEvidence(tag, dimension, evidence = [], metadata = {}) {
  return {
    tag,
    dimension,
    evidence: evidence
      .map((item) => ({
        section: item.section || "",
        text: String(item.text || "").trim()
      }))
      .filter((item) => item.text)
      .slice(0, 6),
    metadata
  };
}

function buildProblemEvidence({
  expLocationResult,
  rawBullets,
  quantifiedCount,
  weakPhraseCount,
  writeGoodResult,
  repetitiveVerbResult,
  coreSkillBulletCoverage,
  shortTenures
}) {
  const items = [];

  if (expLocationResult && !expLocationResult.allHaveLocation) {
    items.push(makeEvidence(
      "missing_exp_location",
      "B",
      (expLocationResult.missingEntries || []).map((entry) => ({
        section: "experience",
        text: (entry.titleLines || []).join(" ") || entry.rawText
      })),
      { missingCount: expLocationResult.missingCount }
    ));
  }

  if (quantifiedCount < 3) {
    items.push(makeEvidence(
      "insufficient_quantification",
      "C",
      rawBullets
        .filter((bullet) => !hasQuantifiedResult(bullet))
        .slice(0, 6)
        .map((bullet) => ({ section: "experience_or_projects", text: bullet })),
      { quantifiedCount }
    ));
  }

  if (weakPhraseCount >= 3) {
    const weakEvidence = rawBullets
      .filter((bullet) => WEAK_PHRASES.some((phrase) => bullet.toLowerCase().includes(phrase)))
      .map((bullet) => ({ section: "experience_or_projects", text: bullet }));
    items.push(makeEvidence("weak_verbs", "C", weakEvidence, { weakPhraseCount }));
  }

  if (writeGoodResult?.passiveCount >= 2) {
    items.push(makeEvidence(
      "passive_voice",
      "C",
      (writeGoodResult.flagged || []).map((item) => ({ section: "experience_or_projects", text: item.text })),
      { passiveCount: writeGoodResult.passiveCount }
    ));
  }

  if (repetitiveVerbResult?.maxCount >= 2) {
    const verb = repetitiveVerbResult.maxVerb;
    const repeatedBullets = rawBullets
      .filter((bullet) => verb && getStartingVerb(bullet) === verb)
      .map((bullet) => ({ section: "experience_or_projects", text: bullet }));
    items.push(makeEvidence("repetitive_verbs", "C", repeatedBullets, {
      maxVerb: repetitiveVerbResult.maxVerb,
      maxCount: repetitiveVerbResult.maxCount
    }));
  }

  if (coreSkillBulletCoverage < 0.4) {
    items.push(makeEvidence("low_bullet_coverage", "C", rawBullets.slice(0, 6).map((bullet) => ({
      section: "experience_or_projects",
      text: bullet
    })), { coreSkillBulletCoverage }));
  }

  if (shortTenures && shortTenures.length > 0) {
    items.push(makeEvidence("short_tenure_unexplained", "C", shortTenures.map((entry) => ({
      section: "experience",
      text: entry.title || entry.rawText || ""
    })), { count: shortTenures.length }));
  }

  return items.filter((item) => item.evidence.length || Object.keys(item.metadata || {}).length);
}

// ── Retrieval query ──────────────────────────────────────────────────────────

function buildRetrievalQuery(profile, problemTags, priorityMissingKeywords) {
  const topics = [...new Set(problemTags.map(t => t.topic))];
  const tagNames = problemTags.map(t => t.tag);
  const priorityKeywords = priorityMissingKeywords
    .filter(k => k.priority === "high" || k.priority === "medium")
    .map(k => k.term)
    .slice(0, 5);

  const seniorityExpansion = {
    entry_level: ["entry_level", "early_career", "universal"],
    mid_level:   ["mid_level", "universal"],
    senior:      ["senior", "universal"]
  };

  const queryText = [
    profile.seniority,
    profile.roleFamily,
    ...topics.slice(0, 3),
    ...tagNames.slice(0, 3)
  ].join(" ");

  return {
    roleFamily: profile.roleFamily,
    targetRole: profile.targetRole,
    seniority: profile.seniority,
    topics,
    problemTags: tagNames,
    priorityKeywords,
    queryText,
    filters: {
      roleFamily: [profile.roleFamily, "universal"],
      seniority: seniorityExpansion[profile.seniority] || ["universal"]
    }
  };
}

// ── Diagnostics (frontend-friendly summary) ───────────────────────────────────

function buildDiagnostics({ emailValid, phoneValid, hasLinkedIn, hasPortfolio, hasSummary,
  hasEducation, hasExperience, inconsistentDates, inconsistentMonthStyle,
  wordCount, exactJobTitle, jobTitle, quantifiedCount }) {
  return {
    searchability: {
      hasEmail: emailValid,
      hasPhone: phoneValid,
      hasLinkedIn,
      hasPortfolio,
      hasSummary,
      hasEducation,
      hasExperience,
      dateFormattingValid: !inconsistentDates && !inconsistentMonthStyle,
      wordCount
    },
    jobTitleMatch: {
      exactMatch: exactJobTitle?.exact || false,
      targetTitle: exactJobTitle?.targetTitle || jobTitle || "",
      severity: (exactJobTitle?.penalty ?? 0) === 0 ? "none" : "low"
    },
    measurableResults: {
      count: quantifiedCount,
      status: quantifiedCount >= 8 ? "strong"
            : quantifiedCount >= 5 ? "good"
            : quantifiedCount >= 3 ? "fair"
            : "weak"
    }
  };
}

// ── Priority missing keywords ─────────────────────────────────────────────────

function generateKeywordReason(term, type, roleName) {
  switch (type) {
    case "hard_skill": return `Core skill expected for ${roleName} roles; add to experience bullets or skills section to improve ATS match.`;
    case "tool":       return `Commonly required tool in ${roleName} job descriptions; add to skills if you have experience with it.`;
    case "domain":     return `Domain keyword that signals ${roleName} knowledge; consider adding to summary or experience context.`;
    case "soft_skill": return `Action verb from the JD; can be naturally incorporated into existing experience bullets.`;
    case "nice_to_have": return `Nice-to-have qualification; add if applicable to your background.`;
    default:           return `Appears in the JD; adding it can improve overall keyword match rate.`;
  }
}

function buildPriorityMissingKeywords(keywordMatch, targetRole) {
  const comparison = keywordMatch?.comparison || {};
  const roleName = targetRole?.role?.replace(/_/g, " ") || "this";

  const categoryConfig = [
    { key: "core_skills",     priority: "high",   type: "hard_skill"   },
    { key: "tools",           priority: "high",   type: "tool"         },
    { key: "domain_keywords", priority: "medium", type: "domain"       },
    { key: "action_verbs",    priority: "low",    type: "soft_skill"   },
    { key: "nice_to_have",    priority: "low",    type: "nice_to_have" }
  ];

  const result = [];
  for (const { key, priority, type } of categoryConfig) {
    const missing = comparison[key]?.missing || [];
    for (const term of missing.slice(0, 4)) {
      result.push({
        term,
        priority,
        category: type,
        safeToAdd: true,
        reason: generateKeywordReason(term, type, roleName)
      });
    }
  }

  const order = { high: 0, medium: 1, low: 2 };
  return result.sort((a, b) => (order[a.priority] ?? 9) - (order[b.priority] ?? 9)).slice(0, 10);
}

function roleNeedsPortfolio(role) {
  return ["design_creative"].includes(role?.role || role);
}

function roleNeedsGithub(role) {
  return ["software_engineer", "machine_learning", "ai_engineer", "data_scientist", "data_engineer"].includes(role?.role || role);
}

function hasPortfolioLink(text) {
  return /\b(behance\.net|dribbble\.com|portfolio|personal\s+(site|website)|\w[\w-]*\.(me|dev|io|app|site|co))\b/i.test(text || "");
}

function hasGithubLink(text) {
  return /\b(github\.com|gitlab\.com|bitbucket\.org|github\.io)\b/i.test(text || "");
}

function hasWebsiteLink(text) {
  const value = String(text || "").replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, " ");
  const urls = value.match(/\b(?:https?:\/\/)?(?:www\.)?[a-z0-9-]+\.[a-z]{2,}(?:\/[^\s|,;]*)?/gi) || [];
  return urls.some((url) => {
    const lower = url.toLowerCase();
    return !lower.includes("linkedin.") &&
      !lower.includes("github.") &&
      !lower.includes("gitlab.") &&
      !lower.includes("bitbucket.") &&
      !/@/.test(lower);
  });
}

function hasLinkedInSignal(text) {
  const value = text || "";
  return (
    /\blinkedin\.com\s*\/\s*(in|pub)\s*\//i.test(value) ||
    /\blinkedin\b/i.test(value) ||
    /\blinked[\s-]*in\b/i.test(value) ||
    /\blinkedln\b/i.test(value)
  );
}

function cleanHeadingTitle(line) {
  return String(line || "")
    .trim()
    .replace(/[:ï¼š]\s*$/, "")
    .replace(/\s+/g, " ");
}

function detectResumeSectionTitles(text) {
  const titlePatterns = [
    { title: "Summary", key: "summary", re: /^(summary|profile|professional summary)\b/i },
    { title: "Objective", key: "summary", re: /^(objective|career objective)\b/i },
    { title: "Professional Experience", key: "experience", re: /^professional experience\b/i },
    { title: "Internship", key: "experience", re: /^(internship|internships|internship experience)\b/i },
    { title: "Experience", key: "experience", re: /^(experience|work experience|employment)\b/i },
    { title: "Projects", key: "projects", re: /^(projects?|project experience|selected projects)\b/i },
    { title: "Skills", key: "skills", re: /^(skills?|technical skills?|core skills?|competencies)\b/i },
    { title: "Education", key: "education", re: /^(education|academic background)\b/i },
    { title: "Activities", key: "activities", re: /^(activities|leadership activities|extracurriculars?)\b/i },
    { title: "Awards", key: "awards", re: /^(awards?|honors?)\b/i },
    { title: "Publications", key: "publications", re: /^(publications?|papers?|research publications?)\b/i },
    { title: "Certifications", key: "certifications", re: /^(certifications?|licenses?)\b/i }
  ];

  const detected = [];
  for (const rawLine of normalizeText(text).split("\n")) {
    const line = cleanHeadingTitle(rawLine);
    if (!line || line.length > 80) continue;
    const compact = line.replace(/\s+/g, "");
    const match = titlePatterns.find(({ re }) => re.test(line) || re.test(compact));
    if (match && !detected.some((item) => item.title === match.title && item.key === match.key)) {
      detected.push({ title: match.title, key: match.key });
    }
  }
  return detected;
}

function detectSectionOrder(sectionTitles, key) {
  return sectionTitles.findIndex((item) => item.key === key);
}

function termsPresentInText(terms, text) {
  return unique((terms || []).filter((term) => matchTermWithCredit(text || "", term).credit > 0));
}

function buildResumeFacts({
  normalized,
  sections,
  summaryText,
  experienceProjectsText,
  skillsText,
  educationText,
  projectsText,
  keywordMatch,
  targetRole,
  explicitTargetRole,
  resumeRole,
  phoneInfo,
  hasEmail,
  hasLinkedIn,
  hasGithub,
  hasPortfolio,
  hasCoursework,
  hasGPA,
  educationHasDates,
  projectsHasDates,
  inconsistentDates,
  inconsistentMonthStyle,
  rawBullets,
  quantifiedCount,
  strongVerbCount,
  impactCount,
  weakPhraseCount
}) {
  const sectionTitles = detectResumeSectionTitles(normalized);
  const detectedTitles = sectionTitles.map((item) => item.title);
  const normalizedSections = unique([
    ...sectionTitles.map((item) => item.key),
    ...Object.keys(sections || {}).filter((key) => key !== "header" && String(sections[key] || "").trim())
  ]);
  const educationIndex = detectSectionOrder(sectionTitles, "education");
  const experienceIndex = detectSectionOrder(sectionTitles, "experience");
  const projectsIndex = detectSectionOrder(sectionTitles, "projects");
  const allTerms = unique(keywordMatch?.allTerms || []);
  const presentInResume = unique(keywordMatch?.allMatched || termsPresentInText(allTerms, normalized));
  const presentInSkills = termsPresentInText(allTerms, skillsText);
  const presentInExperience = termsPresentInText(allTerms, experienceProjectsText);
  const bulletsText = (rawBullets || []).join("\n");
  const evidenceText = `${normalized}\n${bulletsText}`.toLowerCase();
  const wordCount = normalized.split(/\s+/).filter(Boolean).length;
  const estimatedPages = Math.max(1, Math.ceil(wordCount / 650));
  const missingDatesSections = [];
  if (educationText.trim() && !educationHasDates) missingDatesSections.push("education");
  if (projectsText.trim() && !projectsHasDates) missingDatesSections.push("projects");

  const hasProfessionalExperienceTitle = detectedTitles.includes("Professional Experience");
  const hasInternshipTitle = detectedTitles.includes("Internship");

  const targetRoleFamily = explicitTargetRole?.explicit
    ? explicitTargetRole.role
    : (targetRole?.role || "unknown");

  return {
    sections: {
      detectedTitles,
      normalizedSections,
      hasSummary: Boolean((summaryText || "").trim()),
      hasObjective: detectedTitles.includes("Objective"),
      hasExperience: Boolean((sections?.experience || "").trim()),
      hasProfessionalExperienceTitle,
      hasInternshipTitle,
      hasProjects: Boolean((projectsText || "").trim()),
      hasEducation: Boolean((educationText || "").trim()),
      hasSkills: Boolean((skillsText || "").trim()),
      hasActivities: normalizedSections.includes("activities"),
      hasAwards: normalizedSections.includes("awards"),
      hasPublications: normalizedSections.includes("publications"),
      hasCertifications: normalizedSections.includes("certifications"),
      educationBeforeExperience: educationIndex >= 0 && experienceIndex >= 0 && educationIndex < experienceIndex,
      projectsBeforeExperience: projectsIndex >= 0 && experienceIndex >= 0 && projectsIndex < experienceIndex
    },
    links: {
      hasEmail: Boolean(hasEmail),
      hasPhone: Boolean(phoneInfo?.present),
      phoneValid: Boolean(phoneInfo?.valid),
      hasLinkedIn: Boolean(hasLinkedIn),
      hasGithub: Boolean(hasGithub),
      hasPortfolio: Boolean(hasPortfolio),
      hasWebsite: hasWebsiteLink(normalized)
    },
    keywords: {
      jdRequired: allTerms,
      presentInResume,
      missingFromResume: unique(keywordMatch?.allMissing || allTerms.filter((term) => !presentInResume.includes(term))),
      presentInSkills,
      presentInExperience,
      skillsOnly: presentInSkills.filter((term) => !presentInExperience.includes(term)),
      experienceOnly: presentInExperience.filter((term) => !presentInSkills.includes(term))
    },
    experience: {
      bulletCount: (rawBullets || []).length,
      quantifiedBulletCount: quantifiedCount || 0,
      weakBulletCount: weakPhraseCount || 0,
      strongVerbBulletCount: strongVerbCount || 0,
      impactWordCount: impactCount || 0,
      hasActionVerbBullets: (strongVerbCount || 0) > 0,
      hasMeasurableResults: (quantifiedCount || 0) > 0,
      hasBusinessOutcomeLanguage: /\b(revenue|cost|profit|growth|retention|efficiency|business outcome|customer|market|kpi|roi)\b/i.test(bulletsText),
      hasCrossFunctionalLanguage: /\b(cross[-\s]?functional|stakeholder|collaborat|coordinate|partnered|team|department)\b/i.test(bulletsText),
      hasReportingLanguage: /\b(report|reporting|dashboard|presentation|presented|visualiz|analysis|analyz|insight)\b/i.test(bulletsText),
      hasProcessImprovementLanguage: /\b(process improvement|improv|optimiz|streamlin|automated|reduc|efficien|workflow)\b/i.test(bulletsText)
    },
    roleEvidence: {
      targetRoleFamily,
      resumeRoleFamily: resumeRole?.role || "unknown",
      hasLeadershipEvidence: /\b(leadership|led|lead|managed|supervised|mentor|trained|owned)\b/i.test(evidenceText),
      hasCommunicationEvidence: /\b(communicat|present|presentation|wrote|written|client|stakeholder|report)\b/i.test(evidenceText),
      hasTeamworkEvidence: /\b(team|collaborat|coordinat|partnered|cross[-\s]?functional)\b/i.test(evidenceText),
      hasDataAnalysisEvidence: /\b(data|analysis|analyz|excel|sql|python|tableau|dashboard|metric|statistics?)\b/i.test(evidenceText),
      hasReportingEvidence: /\b(report|reporting|dashboard|presentation|kpi|weekly|monthly)\b/i.test(evidenceText),
      hasCustomerServiceEvidence: /\b(customer service|client service|customer support|customer|client|satisfaction)\b/i.test(evidenceText),
      hasSalesEvidence: /\b(sales|selling|pipeline|lead generation|crm|revenue)\b/i.test(evidenceText),
      hasFinanceEvidence: /\b(finance|financial|budget|forecast|accounting|profit|loss|p&l)\b/i.test(evidenceText),
      hasOperationsEvidence: /\b(operations?|operational|logistics|inventory|supply chain|workflow|process)\b/i.test(evidenceText),
      hasProcessImprovementEvidence: /\b(process improvement|continuous improvement|streamlin|optimiz|automated|efficien|workflow)\b/i.test(evidenceText),
      hasAdaptabilityEvidence: /\b(adapt|rotate|rotation|learned|trained|multiple departments?|fast[-\s]?paced)\b/i.test(evidenceText)
    },
    format: {
      estimatedPages,
      likelyOverOnePage: estimatedPages > 1 || normalized.length > 4500,
      hasDateInconsistency: Boolean(inconsistentDates),
      hasMonthStyleInconsistency: Boolean(inconsistentMonthStyle),
      missingDatesSections,
      hasDenseFormattingRisk: normalized.length > 6500 || wordCount > 900,
      parseWarnings: []
    },
    education: {
      hasCoursework: Boolean(hasCoursework),
      hasGPA: Boolean(hasGPA)
    }
  };
}

function scoreResumeATS(resumeText, jobTitle = "", jdText = "", options = {}) {
  const normalized = normalizeText(resumeText);
  if (!normalized.trim()) throw new Error("resumeText is required");

  const lowerResume = normalized.toLowerCase();
  const lines = normalized.split("\n");
  const sections = parseSections(normalized);
  const summaryText = sectionText(sections, ["summary", "header"]);
  const experienceProjectsText = sectionText(sections, ["experience", "projects"]);
  const skillsText = sectionText(sections, ["skills"]);
  const educationText = sectionText(sections, ["education"]);
  const hasCoursework = /\b(coursework|relevant courses?|related courses?|course work)\b/i.test(educationText);
  const projectsText = sectionText(sections, ["projects"]);
  const hasGPA = checkGPA(educationText);
  const educationHasDates = !educationText.trim() || checkSectionHasDates(educationText);
  const projectsHasDates = !projectsText.trim() || checkSectionHasDates(projectsText);
  const inconsistentMonthStyle = hasInconsistentMonthStyle(normalizeText(resumeText));
  const experienceProjectBulletLines = getBulletLines(experienceProjectsText);
  const rawBullets = experienceProjectBulletLines.map(stripBulletMarker);
  const writeGoodResult = analyzeWriteGoodIssues(rawBullets);
  const repetitiveVerbResult = checkRepetitiveVerbs(experienceProjectBulletLines);
  const verbDiversity = analyzeVerbDiversity(rawBullets);
  const skillBalance  = analyzeSkillBalance(rawBullets);
  const experienceBullets = rawBullets;
  const bulletLines = getBulletLines(normalized);
  const hasJD = Boolean(jdText && jdText.trim());

  let A = 0;
  const coreSections = ["experience", "education", "skills"].filter((s) => lowerResume.includes(s)).length;
  const supportSections = ["projects", "summary", "objective", "profile", "certifications", "awards"].filter((s) => lowerResume.includes(s)).length;
  A += coreSections * 1.5;  // max 4.5 for all 3 core sections
  if (supportSections > 0) A += 0.5;
  if (bulletLines.length >= 8) A += 1;
  else if (bulletLines.length >= 4) A += 0.5;
  if (normalized.length >= 700 && normalized.length <= 9000) A += 1;
  else if (normalized.length < 400) A -= 2;
  else if (normalized.length > 9000) A -= 1;
  const fileNameResult = analyzeFileName(options.fileName);
  A += fileNameResult.score;
  if (hasInconsistentDateFormat(normalized)) A -= 1;
  if (inconsistentMonthStyle) A -= 0.5;
  if (educationText.trim() && !educationHasDates) A -= 0.5;
  if (projectsText.trim() && !projectsHasDates) A -= 0.5;
  // chronological order check runs after expEntries is available — applied post-hoc below
  A = clamp(A, 0, 8);

  let B = 0;
  const hasEmail = /@[\w.-]+\.\w{2,}/.test(normalized);
  const emailValid = hasEmail && /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i.test(normalized);
  const isGmail = hasEmail && /@gmail\.com\b/i.test(normalized);
  const phoneInfo = analyzePhone(normalized);
  const hasLinkedIn = hasLinkedInSignal(normalized);
  const hasPortfolio = hasPortfolioLink(normalized);
  const hasGithub = hasGithubLink(normalized);
  const hasWillingToRelocate = /willing\s+to\s+(re)?locate|open\s+to\s+(re)?locat|\brelocate\b|\brelocation\b/i.test(normalized);
  if (hasEmail && emailValid) B += isGmail ? 2.5 : 2;
  else if (hasEmail && !emailValid) B -= 0.5;
  if (phoneInfo.valid) B += 1;
  else if (phoneInfo.present) B -= 0.5;
  if (hasLinkedIn) B += 2;
  // "Willing to relocate" is scored in E dimension only — no duplicate here
  const hasSummary = Boolean((sections.summary || "").trim());

  // Graduation-date aware summary rule:
  //   - Graduated ≤ 12 months ago (or still enrolled) → summary is optional
  //   - Graduated > 12 months ago → summary is mandatory
  const gradInfo = extractGraduationDate(educationText);
  let isRecentGraduate = false;
  if (gradInfo) {
    if (gradInfo.expected) {
      isRecentGraduate = true; // still enrolled / expected graduation
    } else {
      const _now = new Date();
      const monthsSince = (_now.getFullYear() - gradInfo.year) * 12 + (_now.getMonth() + 1 - gradInfo.month);
      isRecentGraduate = monthsSince >= 0 && monthsSince <= 12;
    }
  }

  if (hasSummary) B += 1;
  else if (!isRecentGraduate) B -= 1;  // mandatory for candidates > 1 yr post-graduation
  // Coursework in Education boosts ATS keyword density; penalise if section exists but coursework is absent
  if (educationText.trim() && !hasCoursework) B -= 0.5;
  // GPA is expected in Education section
  if (educationText.trim() && !hasGPA) B -= 0.5;
  B = clamp(B, 0, 7);

  let C = 0;
  const quantifiedCount = countQuantifiedResults(rawBullets.join("\n"));
  if (quantifiedCount >= 8) C += 5;
  else if (quantifiedCount >= 5) C += 4;
  else if (quantifiedCount >= 3) C += 3;
  else if (quantifiedCount >= 1) C += 1;

  const strongVerbCount = countStrongVerbStarts(experienceProjectBulletLines);
  if (strongVerbCount >= 8) C += 4;
  else if (strongVerbCount >= 5) C += 3;
  else if (strongVerbCount >= 3) C += 2;
  else if (strongVerbCount >= 1) C += 1;

  const impactSourceText = rawBullets.join("\n");
  const impactCount = (impactSourceText.match(/\b(result|impact|improv|reduc|increas|achiev|enabl|boost|cut|sav|generat|drove|delivered|launched|grew|decreas)/gi) || []).length;
  if (impactCount >= 6) C += 2;
  else if (impactCount >= 3) C += 1.5;
  else if (impactCount >= 1) C += 1;
  if (experienceProjectBulletLines.length >= 5) C += 1;
  if (countWeakPhrases(impactSourceText) >= 3) C -= 1;
  if (writeGoodResult.passiveCount >= 5) C -= 1;
  else if (writeGoodResult.passiveCount >= 2) C -= 0.5;
  if (repetitiveVerbResult.maxCount >= 3) C -= 1;
  else if (repetitiveVerbResult.maxCount >= 2) C -= 0.5;

  // Verb diversity: penalise when the same verb is overused
  if (verbDiversity.verbBulletCount >= 5) {
    if (verbDiversity.diversityRatio < 0.35 || verbDiversity.maxRepeat >= 5) C -= 2;
    else if (verbDiversity.diversityRatio < 0.55 || verbDiversity.maxRepeat >= 4) C -= 1;
  }

  // Skill balance: penalise extreme imbalance (one side > 5× the other)
  if (rawBullets.length >= 5 && skillBalance.softCount > 0 && skillBalance.techCount > 0
      && skillBalance.ratio > 5) {
    C -= 1;
  }

  const keywordProfile = buildKeywordProfile(jdText, jobTitle);
  const keywordMatch = compareKeywordProfile(keywordProfile, normalized);
  const coreBulletSignal = analyzeCoreSkillBulletPlacement(experienceBullets, keywordProfile.core_skills);
  C += coreBulletSignal.coverageScore;
  C += coreBulletSignal.orderScore;
  C = clamp(C, 0, DIMENSION_MAX.C);
  const jdKeywords = keywordMatch.allTerms;
  const jdHits = keywordMatch.allMatched.length;
  const jdMatchRatio = computeHybridJdMatchRatio(keywordMatch, coreBulletSignal);
  const D = jdKeywords.length ? clamp(Math.round(jdMatchRatio * DIMENSION_MAX.D), 0, DIMENSION_MAX.D) : 13;

  const expText = sections.experience || "";
  const expEntries = parseExperienceEntries(expText);
  const isChronological = checkChronologicalOrder(expEntries);
  const shortTenures = detectShortTenures(expEntries);
  const expLocationResult = checkExperienceLocations(expEntries);
  const jobTitleAligned = checkJobTitleAlignment(expEntries, jobTitle);
  // Apply B deduction for missing experience locations (post-hoc, after expEntries available)
  if (!expLocationResult.allHaveLocation) B = clamp(B - Math.min(expLocationResult.missingCount * 0.5, 1), 0, 7);
  const mustHaveFreqBonus = computeMustHaveFrequencyBonus(keywordProfile.core_skills, normalized);
  const priorityAlignmentBonus = checkJdPriorityAlignment(keywordProfile.core_skills, expEntries[0]?.rawText || "");

  // Apply A deduction for non-chronological order (computed after expEntries)
  if (!isChronological) A = clamp(A - 1, 0, 8);
  // Rule: most recent experience > 3 months ago → resume may be outdated
  const resumeOutdated = latestDateOlderThanMonths(expText, 3);
  if (resumeOutdated) A = clamp(A - 1, 0, 8);

  // Apply C adjustments: short tenure penalty + JD priority alignment bonus
  if (shortTenures.length >= 2) C = clamp(C - 2, 0, DIMENSION_MAX.C);
  else if (shortTenures.length === 1) C = clamp(C - 1, 0, DIMENSION_MAX.C);
  C = clamp(C + priorityAlignmentBonus, 0, DIMENSION_MAX.C);

  // Apply D frequency bonus for must-have skills (capped at max)
  let D_final = jdKeywords.length ? clamp(D + mustHaveFreqBonus, 0, DIMENSION_MAX.D) : D;
  if (keywordMatch.experienceEvidence.skillsOnlyShare > 0.6 && keywordMatch.experienceEvidence.inExperienceCount < 3) {
    D_final = Math.min(D_final, Math.round(DIMENSION_MAX.D * 0.6));
  }

  const { allChina, hasAnyChinaExp } = detectChinaExperience(expText, normalized, expEntries);
  let E = 0;
  if (allChina) {
    E = 2;  // 80% deduction: max 2pt
  } else if (hasAnyChinaExp) {
    E = 3;  // 65% deduction: max ~3.5pt
  } else {
    E = 8;  // US/international baseline
  }
  if (hasWillingToRelocate) E = Math.min(10, E + 2);
  E = clamp(Math.round(E * 0.5), 0, DIMENSION_MAX.E);

  const summaryMentionsRole = keywordProfile.target_role.some((role) => resumeHasTerm(summaryText, role)) ||
    extractKeywords(jobTitle).some((kw) => resumeHasTerm(summaryText, kw));

  const fScore = scoreRoleRelevance({
    keywordProfile,
    experienceProjectsText,
    skillsText,
    summaryText,
    resumeText: normalized
  });
  let F = fScore.score;
  if (summaryMentionsRole) F = Math.min(DIMENSION_MAX.F, F + 2);
  const roleSource = `${jobTitle}\n${jdText}`;
  const targetRole = detectRoleFamily(roleSource || jobTitle);
  const explicitTargetRole = detectExplicitTargetRole(jobTitle, jdText);
  const resumeRole = detectRoleFamily(normalized);
  const marketingLens = analyzeMarketingResume({
    jobTitle,
    jdText,
    resumeText: normalized,
    sections,
    rawBullets,
    keywordProfile,
    keywordMatch,
    detectedRole: targetRole
  });
  F = clamp(F, 0, DIMENSION_MAX.F);

  const wordCount = normalized.split(/\s+/).filter(Boolean).length;
  const hasExperience = Boolean(expText.trim());

  const profile = buildProfile({
    expEntries, isRecentGraduate, targetRole, resumeRole,
    hasWillingToRelocate, allChina, hasAnyChinaExp
  });

  const rawTotal = A + B + C + D_final + E + F;
  const formatPenaltyTriggered = A < 8 * 0.6 || B < 7 * 0.6;
  const formatPenaltyReason = [];
  if (A < 8 * 0.6) formatPenaltyReason.push(`格式规范（A 维度）仅 ${A}/8 分`);
  if (B < 7 * 0.6) formatPenaltyReason.push(`基本资料（B 维度）仅 ${B}/7 分`);
  const exactJobTitle = analyzeExactJobTitleMatch(normalized, jobTitle, keywordProfile);
  const scoreCaps = buildScoreCaps({ keywordMatch, exactJobTitle, D_final, F, hybridCoverage: jdMatchRatio });
  const cappedTotal = scoreCaps.length ? Math.min(rawTotal, ...scoreCaps.map((cap) => cap.max)) : rawTotal;
  const total = formatPenaltyTriggered ? Math.min(cappedTotal, 54) : cappedTotal;
  const risk = formatPenaltyTriggered ? "高" : (total >= 75 ? "低" : total >= 55 ? "中" : "高");
  const missingKeywords = keywordMatch.allMissing;

  const coreSectionNames = ["experience", "education", "skills"].filter((s) => lowerResume.includes(s));
  const weakPhraseCount = countWeakPhrases(impactSourceText);
  const hasEducation = /education|university|college|bachelor|master|degree/i.test(normalized);
  const phonePresent = analyzePhone(normalized).present;
  const inconsistentDates = hasInconsistentDateFormat(normalized);

  const priorityMissingKeywords = buildPriorityMissingKeywords(keywordMatch, targetRole);
  const resumeFacts = buildResumeFacts({
    normalized,
    sections,
    summaryText,
    experienceProjectsText,
    skillsText,
    educationText,
    projectsText,
    keywordProfile,
    keywordMatch,
    targetRole,
    explicitTargetRole,
    resumeRole,
    phoneInfo,
    hasEmail,
    hasLinkedIn,
    hasGithub,
    hasPortfolio,
    hasCoursework,
    hasGPA,
    educationHasDates,
    projectsHasDates,
    inconsistentDates,
    inconsistentMonthStyle,
    expEntries,
    rawBullets,
    quantifiedCount,
    strongVerbCount,
    impactCount,
    weakPhraseCount
  });

  const problemTagsInput = {
    resumeOutdated, isChronological, inconsistentDates, inconsistentMonthStyle,
    educationHasDates, projectsHasDates, fileNameIssues: fileNameResult.issues,
    hasSummary, isRecentGraduate, hasEducation, hasGPA, hasCoursework,
    emailValid, phoneValid: phoneInfo.valid, hasLinkedIn, hasPortfolio, hasGithub,
    portfolioExpected: roleNeedsPortfolio(targetRole), githubExpected: roleNeedsGithub(targetRole), expLocationResult,
    quantifiedCount, weakPhraseCount, writeGoodResult, repetitiveVerbResult,
    coreSkillBulletCoverage: coreBulletSignal.coverage, shortTenures,
    hasJD, jdMatchRatio, keywordMatch,
    allChina, hasAnyChinaExp, hasWillingToRelocate,
    targetRole, resumeRole, jobTitleAligned, summaryMentionsRole, total
  };
  const problemTags = buildProblemTags(problemTagsInput);
  if (marketingLens.active) {
    const existingTags = new Set(problemTags.map((item) => item.tag));
    for (const tag of marketingLens.tags) {
      const tagItem = makeTag(tag);
      if (tagItem && !existingTags.has(tagItem.tag)) {
        problemTags.push(tagItem);
        existingTags.add(tagItem.tag);
      }
    }
  }
  const problemEvidence = buildProblemEvidence({
    expLocationResult,
    rawBullets,
    quantifiedCount,
    weakPhraseCount,
    writeGoodResult,
    repetitiveVerbResult,
    coreSkillBulletCoverage: coreBulletSignal.coverage,
    shortTenures
  });

  const diagnostics = buildDiagnostics({
    emailValid, phoneValid: phoneInfo.valid,
    hasLinkedIn,
    hasPortfolio,
    hasSummary, hasEducation, hasExperience,
    inconsistentDates, inconsistentMonthStyle,
    wordCount, exactJobTitle, jobTitle, quantifiedCount
  });

  const retrievalQuery = buildRetrievalQuery(profile, problemTags, priorityMissingKeywords);

  const problems = buildProblems({
    hasEmail, hasJD, jdMatchRatio, quantifiedCount, strongVerbCount, impactCount,
    bulletCount: experienceProjectBulletLines.length, missingKeywords, keywordMatch, targetRole, explicitTargetRole, resumeRole,
    allChina, hasAnyChinaExp, formatPenaltyTriggered, isChronological, shortTenures,
    exactJobTitle, scoreCaps
  });
  if (marketingLens.active) {
    problems.push(...marketingLens.problems);
  }
  const suggestions = buildSuggestions({
    hasJD, missingKeywords, keywordMatch, quantifiedCount, strongVerbCount, impactCount,
    targetRole, resumeRole, allChina, hasAnyChinaExp, isChronological, shortTenures,
    hasSummary, isRecentGraduate, exactJobTitle
  });
  if (marketingLens.active) {
    suggestions.push(...marketingLens.suggestions);
  }

  const dimensionProblems = buildDimensionProblems({
    checks: {
      fileNameIssues: fileNameResult.issues,
      inconsistentDates,
      inconsistentMonthStyle,
      isChronological,
      emailValid,
      isGmail,
      phoneValid: analyzePhone(normalized).valid,
      hasLinkedIn,
      hasPortfolio,
      hasWillingToRelocate,
      hasSummary,
      isRecentGraduate,
      summaryMentionsRole,
      allChina,
      hasAnyChinaExp,
      hasCoursework,
      hasGPA,
      educationHasDates,
      projectsHasDates,
      expLocationResult,
      jobTitleAligned,
      exactJobTitle,
      scoreCaps,
      writeGoodResult,
      repetitiveVerbResult,
      verbDiversity,
      skillBalance,
      resumeOutdated,
      coreSkillBulletCoverage: coreBulletSignal.coverage,
      coreSkillEarlyPlacement: coreBulletSignal.earlyPlacement,
      fBreakdown: fScore.breakdown
    },
    coreSections: coreSectionNames,
    coreSectionCount: coreSections,
    resumeLength: normalized.length,
    hasEmail,
    phonePresent,
    hasEducation,
    hasProjects: Boolean(projectsText.trim()),
    quantifiedCount,
    strongVerbCount,
    impactCount,
    weakPhraseCount,
    bulletCount: experienceProjectBulletLines.length,
    shortTenures,
    hasJD,
    jdMatchRatio,
    keywordMatch,
    targetRole,
    explicitTargetRole,
    resumeRole
  });

  const potentialGain =
    (D < 20 ? 8 : 0) +
    (C < 10 ? 6 : 0) +
    (F < 13 ? 4 : 0) +
    (A < 6 ? 3 : 0) +
    (B < 5 ? 2 : 0);

  return {
    engine: "rule-based",
    version: "0.1.0",
    jobTitle: jobTitle || null,
    hasJD,
    total,
    risk,
    formatPenaltyTriggered,
    formatPenaltyReason,
    dimensions: {
      A: { score: A, max: 8, label: "文件与格式规范" },
      B: { score: B, max: 7, label: "基本资料完整性" },
      C: { score: C, max: DIMENSION_MAX.C, label: "内容质量与成果表达" },
      D: { score: D_final, max: DIMENSION_MAX.D, label: "JD 关键词匹配度" },
      E: { score: E, max: DIMENSION_MAX.E, label: "地域与市场适配度" },
      F: { score: F, max: DIMENSION_MAX.F, label: "职位相关性 / 经验匹配度" }
    },
    metrics: {
      bulletCount: experienceProjectBulletLines.length,
      allBulletCount: bulletLines.length,
      experienceProjectBulletCount: experienceProjectBulletLines.length,
      quantifiedCount,
      strongVerbCount,
      impactCount,
      jdKeywordCount: jdKeywords.length,
      jdKeywordHits: jdHits,
      jdMatchRatio: Number((jdMatchRatio * 100).toFixed(1)),
      keywordProfile,
      keywordMatch: summarizeKeywordMatch(keywordMatch),
      detectedTargetRole: targetRole.role,
      detectedResumeRole: resumeRole.role,
      checks: {
        fileNameIssues: fileNameResult.issues,
        inconsistentDates,
        isChronological,
        emailValid,
        isGmail,
        phoneValid: phoneInfo.valid,
        hasLinkedIn,
        hasPortfolio,
        hasGithub,
        portfolioExpected: roleNeedsPortfolio(targetRole),
        githubExpected: roleNeedsGithub(targetRole),
        hasWillingToRelocate,
        hasSummary,
        summaryMentionsRole,
        allChina,
        hasAnyChinaExp,
        shortTenures,
        hasCoursework,
        mustHaveFreqBonus,
        priorityAlignmentBonus,
        coreSkillBulletCoverage: coreBulletSignal.coverage,
        coreSkillEarlyPlacement: coreBulletSignal.earlyPlacement,
        fBreakdown: fScore.breakdown,
        hasGPA,
        educationHasDates,
        projectsHasDates,
        inconsistentMonthStyle,
        expLocationResult,
        jobTitleAligned,
        exactJobTitle,
        scoreCaps,
        writeGoodResult,
        repetitiveVerbResult,
        verbDiversity,
        skillBalance,
        resumeOutdated
      }
    },
    topMissingKeywords: missingKeywords.slice(0, 12),
    problems: problems.slice(0, 6),
    suggestions: suggestions.slice(0, 6),
    dimensionProblems,
    improvement: formatPenaltyTriggered
      ? `先解决格式/信息问题，修复后预计提升至 ${Math.min(90, rawTotal + potentialGain)}`
      : `${total} → ${Math.min(90, total + potentialGain)}（保守估计）`,
    profile,
    problemTags,
    problemEvidence,
    retrievalQuery,
    diagnostics,
    priorityMissingKeywords,
    resumeFacts,
  };
}

function buildProblems(ctx) {
  const problems = [];
  if (ctx.formatPenaltyTriggered) {
    problems.unshift("格式或基本资料存在严重缺陷，总分已被上限至 54（高风险）。优先修复格式问题。");
  }
  if (ctx.allChina) {
    problems.push("所有工作经历均在中国，与美国求职市场适配度极低（E 维度扣分 80%）。");
  } else if (ctx.hasAnyChinaExp) {
    problems.push("部分工作经历在中国，影响美国市场适配度（E 维度扣分 65%）。");
  }
  if (!ctx.isChronological) {
    problems.push("工作经历未按时间倒序排列（最新在前），需重新排序。");
  }
  if (ctx.shortTenures && ctx.shortTenures.length > 0) {
    const titles = ctx.shortTenures.map((t) => `"${t.title || "未知岗位"}"`).join("、");
    problems.push(`发现 ${ctx.shortTenures.length} 段在职时长不足 3 个月且未标注 Intern 的经历（${titles}），建议注明是否为实习。`);
  }
  if (ctx.hasJD && ctx.jdMatchRatio < 0.4) {
    problems.push(`JD 关键词覆盖率仅 ${(ctx.jdMatchRatio * 100).toFixed(0)}%，核心技能、工具或领域词匹配不足。`);
  }
  if (ctx.quantifiedCount < 3) {
    problems.push(`量化成果只有 ${ctx.quantifiedCount} 个，bullet 的结果证据不足。`);
  }
  if (ctx.strongVerbCount < 4) {
    problems.push(`强动作动词开头的 bullet 只有 ${ctx.strongVerbCount} 条，经历表达不够主动。`);
  }
  if (ctx.impactCount < 3) {
    problems.push("结果导向语言不足，缺少 improved、reduced、increased、generated 等影响表达。");
  }
  if (ctx.bulletCount < 5) {
    problems.push(`可识别 bullet 只有 ${ctx.bulletCount} 条，ATS 难以稳定解析职责和成果。`);
  }
  if (!ctx.hasEmail) {
    problems.push("未检测到标准 email，联系方式完整性存在风险。");
  }
  if (ctx.targetRole.role !== "general" && ctx.resumeRole.role !== ctx.targetRole.role) {
    problems.push(formatRoleMismatchProblem(ctx.explicitTargetRole, ctx.resumeRole));
  }
  if (problems.length === 0) {
    problems.push("基础结构良好，下一步应继续提升 JD 关键词覆盖率和成果量化密度。");
  }
  return problems;
}

function buildDimensionProblems(ctx) {
  const { checks, quantifiedCount, strongVerbCount, impactCount, bulletCount,
    hasJD, jdMatchRatio, keywordMatch, targetRole, explicitTargetRole, resumeRole } = ctx;

  const A = [];
  const missingCore = ["experience", "education", "skills"].filter((s) => !ctx.coreSections.includes(s));
  if (missingCore.length) A.push(`缺少核心段落：${missingCore.join("、")}`);
  if (bulletCount < 4) A.push(`bullet 数量仅 ${bulletCount} 条，建议至少 8 条以便 ATS 解析`);
  if (ctx.resumeLength < 400) A.push("简历内容过短（< 400 字符），信息密度不足");
  else if (ctx.resumeLength > 9000) A.push("简历内容过长（> 9000 字符），建议精简至 1-2 页");
  if (checks.fileNameIssues && checks.fileNameIssues.length > 0) A.push(...checks.fileNameIssues);
  if (checks.inconsistentDates) A.push('日期格式不一致：同一份简历混用月份名称（如 "May"）与数字格式（如 "5/2024"），请统一');
  if (checks.inconsistentMonthStyle) A.push('月份写法不统一：同时出现缩写（如 "Jan"）和全称（如 "January"），请统一使用其中一种');
  if (ctx.hasEducation && !checks.educationHasDates) A.push("Education 段落缺少年份，建议补充入学 / 毕业年份");
  if (!checks.projectsHasDates && ctx.hasProjects) A.push("Projects 段落部分条目缺少时间，建议补充项目年份");
  if (!checks.isChronological) A.push("工作经历未按时间倒序排列，建议最新经历放在最前面");
  if (checks.resumeOutdated) A.push("最近一段工作经历日期距今超过 3 个月，简历可能未更新，建议补充最新经历或更新日期");

  const B = [];
  if (!ctx.hasEmail) B.push("未检测到 email 地址");
  else if (!checks.emailValid) B.push("email 格式不合法（拼写错误等），请检查");
  else if (!checks.isGmail) B.push("建议使用 Gmail 邮箱（@gmail.com），部分 ATS 对非 Gmail 邮箱有扣分");
  if (!checks.phoneValid) B.push(ctx.phonePresent ? "电话号码格式有误（非 10/11 位美国号码）" : "未检测到电话号码");
  if (!checks.hasLinkedIn) B.push("未提供 LinkedIn 链接");
  if (!checks.hasSummary && !checks.isRecentGraduate) B.push("缺少 Summary / 个人简介段落");
  if (ctx.hasEducation && !checks.hasCoursework) B.push('Education 段落未列出 Relevant Coursework，建议补充相关课程以增加 ATS 关键词密度');
  if (ctx.hasEducation && !checks.hasGPA) B.push('Education 段落未包含 GPA，建议加入（如 GPA: 3.X / 4.0）');
  if (checks.expLocationResult && !checks.expLocationResult.allHaveLocation) B.push(`${checks.expLocationResult.missingCount} 段工作经历缺少地点信息（如 "New York, NY" 或 "Remote"），建议补充`);

  const C = [];
  if (quantifiedCount < 3) C.push(`量化成果仅 ${quantifiedCount} 个，建议至少 5 个（百分比、金额、规模）`);
  if (strongVerbCount < 4) C.push(`强动词开头的 bullet 仅 ${strongVerbCount} 条，建议用 led、built、optimized 等替代`);
  if (impactCount < 3) C.push("缺少结果导向语言（improved、reduced、increased、generated 等）");
  if (bulletCount < 5) C.push(`可识别 bullet 仅 ${bulletCount} 条，建议至少 8 条`);
  if (ctx.weakPhraseCount >= 3) C.push(`发现 ${ctx.weakPhraseCount} 处弱表达（helped、assisted、responsible for 等）`);
  if (checks.writeGoodResult?.passiveCount >= 5) C.push(`检测到 ${checks.writeGoodResult.passiveCount} 处被动语态，建议改为主动句式（如 "was developed by" → "developed"）`);
  else if (checks.writeGoodResult?.passiveCount >= 2) C.push(`发现 ${checks.writeGoodResult.passiveCount} 处被动语态，建议优先使用主动动词`);
  if (checks.repetitiveVerbResult?.maxCount >= 3) C.push(`动词 "${checks.repetitiveVerbResult.maxVerb}" 重复出现 ${checks.repetitiveVerbResult.maxCount} 次，建议替换为多样化的动作动词以提升 ATS 吸引力`);
  else if (checks.repetitiveVerbResult?.maxCount >= 2) C.push(`动词 "${checks.repetitiveVerbResult.maxVerb}" 重复出现 2 次，建议每条 bullet 使用不同动词，避免表达单一`);
  if (checks.coreSkillBulletCoverage < 0.4) C.push("核心技能在 bullet 中的覆盖率不足 40%");
  else if (checks.coreSkillBulletCoverage < 0.7) C.push("核心技能 bullet 覆盖率未达 70%，可进一步强化");
  if (ctx.shortTenures && ctx.shortTenures.length > 0) {
    ctx.shortTenures.forEach((t) => {
      C.push(`"${t.title || "某段经历"}" 在职时长仅约 ${t.durationMonths} 个月且未标注 Intern，建议补充说明或注明实习性质`);
    });
  }

  // ── Verb diversity ───────────────────────────────────────────────────────
  const vd = checks.verbDiversity;
  if (vd && vd.verbBulletCount >= 5) {
    if (vd.diversityRatio < 0.55 || vd.maxRepeat >= 4) {
      const pct = Math.round(vd.diversityRatio * 100);
      const repStr = vd.repeatedVerbs.length
        ? `（重复较多的动词：${vd.repeatedVerbs.map(r => `"${r.verb}"×${r.count}`).join("、")}）`
        : "";
      C.push(
        `动词多样性不足：${vd.verbBulletCount} 条 bullet 中仅用了 ${vd.uniqueVerbCount} 个不同动词（多样性 ${pct}%）${repStr}。` +
        `建议将重复动词替换为同义强动词，如 managed→led、built→developed→engineered、improved→optimized→enhanced。`
      );
    }
  }

  // ── Soft vs tech skill balance ───────────────────────────────────────────
  const sb = checks.skillBalance;
  if (sb && bulletCount >= 5) {
    const { softCount, techCount, ratio } = sb;
    // Always show the distribution summary
    const dominant = softCount >= techCount ? "soft skills" : "tech skills";
    const minority = softCount < techCount ? "soft skills" : "tech skills";
    if (softCount === 0 || techCount === 0) {
      C.push(
        `Bullet 技能分布：soft skills ${softCount} 个 / tech skills ${techCount} 个。` +
        `${softCount === 0 ? "未见软技能（领导力、协作、沟通等），建议在部分 bullet 中体现人际/领导维度。" : "未见技术工具词，建议在 bullet 中点名所用工具或技术。"}`
      );
    } else if (ratio > 3) {
      C.push(
        `Bullet 技能分布偏向 ${dominant}（soft ${softCount} / tech ${techCount}，比例约 ${Math.round(ratio)}:1）。` +
        `建议补充更多 ${minority} 相关描述，让简历软硬技能更均衡。`
      );
    } else {
      C.push(`Bullet 技能分布：soft skills ${softCount} 个 / tech skills ${techCount} 个（比例均衡 ✓）`);
    }
  }

  const D = [];
  if (!hasJD) {
    D.push("未提供 JD，关键词匹配使用通用词库估算，精度有限");
  } else {
    if (jdMatchRatio < 0.4) D.push(`JD 关键词总覆盖率仅 ${(jdMatchRatio * 100).toFixed(0)}%`);
    if (checks.exactJobTitle && !checks.exactJobTitle.exact) D.push(`缺少 exact job title phrase：${checks.exactJobTitle.targetTitle}`);
    if (checks.scoreCaps && checks.scoreCaps.length) D.push(`已触发总分上限：${checks.scoreCaps.map((cap) => `${cap.reason} <= ${cap.max}`).join("；")}`);
    const cs = keywordMatch.comparison?.core_skills;
    if (cs && cs.missing?.length) D.push(`缺失核心技能：${cs.missing.slice(0, 4).join("、")}`);
    const tools = keywordMatch.comparison?.tools;
    if (tools && tools.missing?.length) D.push(`缺失工具：${tools.missing.slice(0, 4).join("、")}`);
    const domain = keywordMatch.comparison?.domain_keywords;
    if (domain && domain.missing?.length) D.push(`缺失领域词：${domain.missing.slice(0, 3).join("、")}`);
  }

  const E = [];
  if (checks.allChina) {
    E.push("所有工作经历均在中国，美国市场适配度极低（扣分 80%）");
    E.push("建议在简历中突出可迁移技能，并在 Summary 中说明赴美求职意向");
  } else if (checks.hasAnyChinaExp) {
    E.push("部分工作经历在中国，影响美国市场适配度（扣分 65%）");
    E.push("建议优先展示与美国岗位相关的经历和技能");
  }
  if (!checks.hasWillingToRelocate) {
    E.push('未提及 "Willing to relocate"，建议加入以向 ATS 和招聘官传递明确信号');
  }

  const F = [];
  const fb = checks.fBreakdown || {};
  if ((fb.experienceProjectsCoreMatch || 0) < 40) F.push(`工作经历与 JD 核心技能匹配率仅 ${fb.experienceProjectsCoreMatch || 0}%`);
  if ((fb.skillsCoreMatch || 0) < 40) F.push(`技能区块与岗位要求匹配率仅 ${fb.skillsCoreMatch || 0}%`);
  if ((fb.toolsMatch || 0) < 40) F.push(`工具技术覆盖率仅 ${fb.toolsMatch || 0}%`);
  if ((fb.titleSummaryAliasMatch || 0) < 50) F.push("Summary / 标题未体现目标岗位定位");
  if (targetRole.role !== "general" && resumeRole.role !== targetRole.role) {
    F.push(formatRoleMismatchDimensionProblem(explicitTargetRole, resumeRole));
  }
  if (checks.jobTitleAligned && !checks.jobTitleAligned.aligned) {
    F.push(`简历工作经历中的 Job Title 与 JD 职位名称差异较大，建议尽量保持一致以提升 ATS 匹配率`);
  }

  return { A, B, C, D, E, F };
}

function buildSuggestions(ctx) {
  const suggestions = [];
  if (!ctx.isChronological) {
    suggestions.push("将工作经历重新排列为时间倒序（最新在前），这是所有 ATS 和 HR 的基本预期。");
  }
  if (ctx.shortTenures && ctx.shortTenures.length > 0) {
    suggestions.push("在职时长不足 3 个月的经历请明确标注 Intern/Internship，或考虑是否有必要保留；无说明的短期经历会引发 HR 疑虑。");
  }
  if (!ctx.hasSummary && !ctx.isRecentGraduate) {
    suggestions.push("添加 Summary / 个人简介段落：用 2–3 句话说明你的背景、核心技能和目标岗位，这是 ATS 和 HR 第一眼读到的内容，也有助于提升关键词密度。");
  }
  if (ctx.hasJD) {
    const exactPhraseSuggestion = formatExactPhraseSuggestion(ctx.keywordMatch, ctx.exactJobTitle);
    if (exactPhraseSuggestion) suggestions.push(exactPhraseSuggestion);
    const grouped = formatMissingByCategory(ctx.keywordMatch);
    suggestions.push(grouped || "JD 关键词匹配较好，下一步重点优化量化成果和 bullet 表达。");
  } else {
    suggestions.push("建议加入目标 JD；没有 JD 时会先用岗位词库做通用 ATS 估算。");
  }
  if (ctx.allChina) {
    suggestions.push('在 Summary 中加入 "Seeking US-based opportunities" 并强调可迁移的技术能力，同时考虑补充美国相关实习/项目经历。');
  } else if (ctx.hasAnyChinaExp) {
    suggestions.push('建议将中国经历的描述聚焦在与美国岗位相关的技能和成果上，并在 Summary 中加入 "Willing to relocate"。');
  }
  if (ctx.quantifiedCount < 5) {
    suggestions.push(`把量化成果从 ${ctx.quantifiedCount} 个提升到至少 5 个，优先使用百分比、金额、规模、效率提升。`);
  }
  if (ctx.strongVerbCount < 6) {
    suggestions.push("将 helped、assisted、responsible for 改成 led、built、optimized、launched 等动作动词。");
  }
  if (ctx.impactCount < 4) {
    suggestions.push("每条核心 bullet 尽量写成 Action + Method + Result，明确业务或技术影响。");
  }
  if (ctx.targetRole.role !== "general" && ctx.resumeRole.role !== ctx.targetRole.role) {
    suggestions.push("在 Summary、Skills 和前两段经历中强化目标岗位关键词，让简历定位更一致。");
  }
  return suggestions;
}

function summarizeKeywordMatch(keywordMatch) {
  const summary = {};
  for (const [category, data] of Object.entries(keywordMatch.comparison)) {
    summary[category] = {
      total: data.terms.length,
      matched: data.matched.length,
      matchedTerms: data.matched,
      exactMatched: data.exactMatched || [],
      normalizedMatched: data.normalizedMatched || [],
      semanticMatched: data.semanticMatched || [],
      partialMatched: data.partialMatched || [],
      missing: data.missing
    };
  }
  const allMatches = uniqueByTerm(Object.values(keywordMatch.comparison).flatMap((data) => data.matches || []));
  const bySkillType = (type) => {
    const matches = allMatches.filter((match) => classifySkillType(match.term, match.category) === type);
    return {
      total: matches.length,
      coverage: Number((coverageFromMatches(matches) * 100).toFixed(1)),
      matchedTerms: matches.filter((match) => match.credit > 0).map((match) => match.term),
      missing: matches.filter((match) => match.credit <= 0).map((match) => match.term)
    };
  };
  summary.hard_skills = bySkillType("hard");
  summary.soft_skills = bySkillType("soft");
  summary.matchMethod = {
    exactPhraseCount: keywordMatch.exactPhraseCount || 0,
    hardCoverage: Number((keywordMatch.hardCoverage * 100).toFixed(1)),
    softCoverage: Number((keywordMatch.softCoverage * 100).toFixed(1)),
    hardTermCount: keywordMatch.hardTermCount || 0,
    softTermCount: keywordMatch.softTermCount || 0,
    combinedKeywordCoverage: Number((keywordMatch.combinedKeywordCoverage * 100).toFixed(1)),
    experienceEvidence: keywordMatch.experienceEvidence
  };
  summary.missingByPriority = classifyMissingKeywords(keywordMatch);
  return summary;
}

function formatExactPhraseSuggestion(keywordMatch, exactJobTitle) {
  const requestedExactTerms = [
    "software development engineer",
    "microservices",
    "technical documentation",
    "operational excellence"
  ];
  const partial = [];
  for (const data of Object.values(keywordMatch.comparison || {})) {
    for (const match of data.matches || []) {
      if (requestedExactTerms.includes(match.term) && match.credit > 0 && match.type !== "exact") {
        partial.push(match.term);
      }
    }
  }
  if (exactJobTitle && exactJobTitle.targetTitle && !exactJobTitle.exact && !partial.includes(exactJobTitle.targetTitle)) {
    partial.unshift(exactJobTitle.targetTitle);
  }
  const terms = unique(partial).slice(0, 5);
  if (!terms.length) return "";
  return `你已经有类似概念，但缺少 exact phrase：${terms.join("、")}。建议只在真实经历对应的 Summary、Experience bullet 或 Skills 中补入原词，不要只靠同义词。`;
}

function classifyMissingKeywords(keywordMatch) {
  const missing = unique(Object.values(keywordMatch.comparison || {}).flatMap((data) => data.missing || []));
  const group = (set) => missing.filter((term) => set.has(cleanKeyword(term)));
  const mustHave = group(MUST_HAVE_KEYWORDS);
  const boosters = group(ROLE_RELEVANT_BOOSTERS);
  const optionalRisky = group(OPTIONAL_RISKY_KEYWORDS);
  const assigned = new Set([...mustHave, ...boosters, ...optionalRisky]);
  const other = missing.filter((term) => !assigned.has(term));
  return {
    mustHaveHighPriority: mustHave,
    roleRelevantBooster: boosters,
    optionalRiskyToAdd: optionalRisky,
    other
  };
}

function formatMissingByCategory(keywordMatch) {
  const byPriority = classifyMissingKeywords(keywordMatch);
  const priorityGroups = [];
  if (byPriority.mustHaveHighPriority.length) {
    priorityGroups.push(`Must-have / high priority：${byPriority.mustHaveHighPriority.slice(0, 6).join("、")}（强烈建议补）`);
  }
  if (byPriority.roleRelevantBooster.length) {
    priorityGroups.push(`Role-relevant booster：${byPriority.roleRelevantBooster.slice(0, 6).join("、")}（有真实经验就补）`);
  }
  if (byPriority.optionalRiskyToAdd.length) {
    priorityGroups.push(`Optional / risky to add：${byPriority.optionalRiskyToAdd.slice(0, 6).join("、")}（没有真实经验不要硬补）`);
  }
  if (priorityGroups.length) return `Missing keywords 已分级：${priorityGroups.join("；")}。`;

  const labels = {
    core_skills: "核心技能",
    tools: "工具",
    domain_keywords: "领域关键词",
    nice_to_have: "加分项",
    action_verbs: "动作词"
  };
  const priority = ["core_skills", "tools", "domain_keywords", "nice_to_have", "action_verbs"];
  const groups = priority
    .map((category) => {
      const missing = keywordMatch.comparison[category]?.missing || [];
      if (!missing.length) return "";
      return `${labels[category]}：${missing.slice(0, 5).join("、")}`;
    })
    .filter(Boolean);
  if (!groups.length) return "";
  return `优先补齐 JD 匹配缺口：${groups.slice(0, 3).join("；")}。`;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

module.exports = {
  scoreResumeATS,
  extractKeywords,
  buildKeywordProfile,
  normalizeText
};
