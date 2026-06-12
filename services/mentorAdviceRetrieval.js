"use strict";

const fs = require("fs");
const path = require("path");
const db = require("../database");
const actionGovernance = require("./actionGovernance");
const titleGovernance = require("./titleGovernance");
// pg pool is retrieved lazily via db.getPool()

const FALLBACK_FREE_ADVICE = {
  adviceId: "adv_free_tailor_resume",
  title: "不要一份简历投所有岗位",
  problemSummary: "你的简历需要根据目标岗位强化关键词与定位。",
  actionSummary: "根据目标岗位维护不同版本简历，把最相关的技能、项目和关键词放到对应版本里。",
  source: "fallback",
};

const ACCOUNTING_FALLBACK_FREE_ADVICE = {
  adviceId: "adv_free_accounting_positioning",
  title: "先让简历看起来像 Accounting 岗位",
  problemSummary: "你的简历目前和目标 JD 的关键词与职责语言匹配度较低，ATS 可能无法明确判断你在申请 Accounting 方向。",
  actionSummary: "优先把 Summary、Skills 和第一段 Experience 改成 Accounting 相关语言，例如 financial reporting、reconciliation、Excel、QuickBooks、GAAP、accounts payable/receivable 等真实掌握的关键词。",
  source: "fallback",
  adviceIntent: "resume_positioning",
};

const TECH_ROLE_FAMILIES = new Set(["software_engineer", "ai_engineer", "machine_learning", "data_scientist"]);
const BUSINESS_ROLE_FAMILIES = new Set(["accounting", "finance", "financial_analyst", "business", "operations", "management_trainee"]);

// ── Company → logo file mapping (files live in public/logos/) ─────────────────
const COMPANY_LOGO_MAP = {
  // Big Tech
  "Amazon":                    "/logos/Amazon.png",
  "Amazon Web Services":       "/logos/Amazon Web Services, Inc.png",
  "AWS":                       "/logos/Amazon Web Services, Inc.png",
  "Google":                    "/logos/google.png",
  "Meta":                      "/logos/Meta.png",
  "Microsoft":                 "/logos/Microsoft.png",
  "Apple":                     "/logos/Apple.png",
  "NVIDIA":                    "/logos/NVIDIA.png",
  "Intel":                     "/logos/Intel.png",
  "Qualcomm":                  "/logos/Qualcomm.png",
  "Cisco":                     "/logos/Cisco.png",
  "IBM":                       "/logos/IBM.jpg",
  "Oracle":                    "/logos/Oracle.png",
  "Salesforce":                "/logos/Salesforce.png",
  "Adobe":                     "/logos/Adobe.png",
  "Intuit":                    "/logos/Intuit.png",
  "Snowflake":                 "/logos/Snowflake.png",
  "Spotify":                   "/logos/Spotify.png",
  "Uber":                      "/logos/Uber.jpg",
  "Robinhood":                 "/logos/Robinhood.png",
  "OpenAI":                    "/logos/OpenAI.png",
  "ByteDance":                 "/logos/ByteDance.png",
  "TikTok":                    "/logos/Tiktok.png",
  "SAP":                       "/logos/SAP.png",
  "DocuSign":                  "/logos/DocuSign.png",
  "Dynatrace":                 "/logos/Dynatrace.png",
  "Comcast":                   "/logos/Comcast Corporation.png",
  "Siemens":                   "/logos/Siemens.png",
  "Bosch":                     "/logos/Bosch Group.png",
  // Finance
  "Goldman Sachs":             "/logos/Goldman Sachs.png",
  "JPMorgan":                  "/logos/JPMorgan Chase.png",
  "JPMorgan Chase":            "/logos/JPMorganChase.png",
  "Morgan Stanley":            "/logos/Morgan Stanley.png",
  "BlackRock":                 "/logos/BlackRock.png",
  "Capital One":               "/logos/Capital One.png",
  "Bank of America":           "/logos/Bank of America.png",
  "Citigroup":                 "/logos/Citigroup.png",
  "Citi":                      "/logos/Citigroup.png",
  "American Express":          "/logos/American Express.png",
  "State Street":              "/logos/State Street.png",
  "Guggenheim":                "/logos/Guggenheim Partners.png",
  "Apollo":                    "/logos/Apollo.png",
  // Consulting
  "McKinsey":                  "/logos/McKinsey & Company.png",
  "McKinsey & Company":        "/logos/McKinsey & Company.png",
  "BCG":                       "/logos/Boston Consulting Group.png",
  "Boston Consulting Group":   "/logos/Boston Consulting Group.png",
  "Deloitte":                  "/logos/Deloitte.png",
  "KPMG":                      "/logos/KPMG.png",
  "EY":                        "/logos/EY.png",
  "PwC":                       "/logos/PRICE WATERHOUSE COOPERS.png",
  "PricewaterhouseCoopers":    "/logos/PRICE WATERHOUSE COOPERS.png",
  "Accenture":                 "/logos/Accenture.png",
  "BDO":                       "/logos/BDO.png",
  // Semiconductor & Hardware
  "Applied Materials":         "/logos/Applied Materials.png",
  "KLA":                       "/logos/KLA.png",
  "Lam Research":              "/logos/Lam Research.png",
  "Marvell":                   "/logos/Marvell.png",
  "TSMC":                      "/logos/TSMC.png",
  "Texas Instruments":         "/logos/Texas Instruments.png",
  "Cirrus Logic":              "/logos/Cirrus Logic.png",
  "NXP":                       "/logos/NXP Semiconductors.png",
  "Renesas":                   "/logos/Renesas Electronics.png",
  "Skyworks":                  "/logos/Skyworks.png",
  // Healthcare / Pharma
  "Johnson & Johnson":         "/logos/Johnson & Johnson.png",
  "Merck":                     "/logos/Merck.png",
  "Bristol Myers Squibb":      "/logos/Bristol Myers Squibb.png",
  "Amgen":                     "/logos/Amgen.png",
  "Biogen":                    "/logos/Biogen.png",
  "Moderna":                   "/logos/Moderna.png",
  "AbbVie":                    "/logos/AbbVie.png",
  "Humana":                    "/logos/Humana.png",
  "CVS":                       "/logos/CVS Health.png",
  "Kaiser":                    "/logos/Kaiser Permanente.png",
  // Auto / Industrial
  "Tesla":                     "/logos/Tesla.png",
  "Ford":                      "/logos/Ford Motor Company.png",
  "General Motors":            "/logos/General Motors.png",
  "GM":                        "/logos/General Motors.png",
  "Nissan":                    "/logos/Nissan.png",
  "Volvo":                     "/logos/Volvo Group.png",
  "John Deere":                "/logos/John Deere.png",
  "GE":                        "/logos/General Electric.png",
  "General Electric":          "/logos/General Electric.png",
  "Bosch Group":               "/logos/Bosch Group.png",
  // Retail & Consumer
  "Amazon (Retail)":           "/logos/Amazon.png",
  "Walmart":                   "/logos/Walmart.png",
  "Target":                    "/logos/Target.png",
  "Costco":                    "/logos/Costco.png",
  "Nordstrom":                 "/logos/Nordstrom.png",
  "Kroger":                    "/logos/Kroger.png",
  // Media & Entertainment
  "Disney":                    "/logos/Disney.png",
  "Warner Bros":               "/logos/Warner Bros Discovery.png",
  "Sony":                      "/logos/Sony AI America Inc.png",
  "Spotify":                   "/logos/Spotify.png",
  "Sirius XM":                 "/logos/Sirius XM.png",
  "Skydance":                  "/logos/Skydance.png",
  // Logistics
  "FedEx":                     "/logos/FedEx.png",
  "UPS":                       null,
  "Amtrak":                    "/logos/Amtrak.png",
  // Finance – additional variants & missing
  "Barclays":                  "/logos/Barclays.png",
  "RBC":                       "/logos/RBC Royal Bank.png",
  "RBC Royal Bank":            "/logos/RBC Royal Bank.png",
  "Royal Bank of Canada":      "/logos/RBC Royal Bank.png",
  "Scotiabank":                "/logos/Scotiabank.png",
  "Wells Fargo":               "/logos/Wells_Fargo.png",
  "Visa":                      "/logos/Visa.png",
  "UBS":                       "/logos/UBS.png",
  "Pimco":                     "/logos/PIMCO.png",
  "PIMCO":                     "/logos/PIMCO.png",
  "Credit Suisse":             "/logos/Credit_Suisse.png",
  "JP Morgan Chase":           "/logos/JPMorganChase.png",
  "J.P. Morgan":               "/logos/JPMorganChase.png",
  "Bank of America Merrill Lynch": "/logos/Bank of America.png",
  "BOA":                       "/logos/Bank of America.png",
  "E&Y":                       "/logos/EY.png",
  "Ernst & Young":             "/logos/EY.png",
  // Tech – missing popular companies
  "Facebook":                  "/logos/Meta.png",
  "LinkedIn":                  "/logos/LinkedIn.png",
  "Broadcom":                  "/logos/Broadcom.png",
  "Roblox":                    "/logos/Roblox.png",
  "eBay":                      "/logos/eBay.png",
  "Yelp":                      "/logos/Yelp.png",
  "Western Digital":           "/logos/Western_Digital.png",
  "Compass":                   "/logos/Compass.png",
  "IQVIA":                     "/logos/IQVIA.png",
  "Verizon":                   "/logos/Verizon.png",
  "T-Mobile":                  "/logos/T-Mobile.png",
  "Hewlett Packard Enterprise": "/logos/Hewlett Packard Enterprise.png",
  "HPE":                       "/logos/Hewlett Packard Enterprise.png",
  "salesforce":                "/logos/Salesforce.png",
  // Additional tech & other
  "Netflix":                   "/logos/Netflix.png",
  "Stripe":                    "/logos/Stripe.png",
  "Lyft":                      "/logos/Lyft.png",
  "Airbnb":                    "/logos/Airbnb.png",
  "Palantir":                  "/logos/Palantir.png",
  "Databricks":                "/logos/Databricks.png",
  "Workday":                   "/logos/Workday.png",
  "ServiceNow":                "/logos/ServiceNow.png",
  "Atlassian":                 "/logos/Atlassian.png",
  "Zoom":                      "/logos/Zoom.png",
  "Slack":                     "/logos/Slack.png",
  "Twitter":                   "/logos/Twitter.png",
  "Pinterest":                 "/logos/Pinterest.png",
  "Coinbase":                  "/logos/Coinbase.png",
  "DoorDash":                  "/logos/DoorDash.png",
  "Instacart":                 "/logos/Instacart.png",
  "Square":                    "/logos/Square.png",
  "Rivian":                    "/logos/Rivian.png",
  "Waymo":                     "/logos/Waymo.png",
  "Lockheed Martin":           "/logos/Lockheed_Martin.png",
  "Raytheon":                  "/logos/Raytheon.png",
  "Boeing":                    "/logos/Boeing.png",
  "Northrop Grumman":          "/logos/Northrop_Grumman.png",
  "Medtronic":                 "/logos/Medtronic.png",
  "Abbott":                    "/logos/Abbott.png",
  "Pfizer":                    "/logos/Pfizer.png",
  "Eli Lilly":                 "/logos/Eli_Lilly.png",
  "Genentech":                 "/logos/Genentech.png",
  "Gilead":                    "/logos/Gilead.png",
  "23andMe":                   "/logos/23andMe.svg",
  "23andMe Research Institute": "/logos/23andMe.svg",
  "Bill.com":                  "/logos/Bill.com.png",
  "BILL":                      "/logos/Bill.com.png",
  "BILL Holdings":             "/logos/Bill.com.png",
  "Polarr":                    "/logos/Polarr.png",
  "Polarr/Facebook":           "/logos/Polarr.png",
  "Structuretx":               "/logos/Structure Therapeutics.png",
  "Structure Therapeutics":    "/logos/Structure Therapeutics.png",
  // DB company name variants that won't substring-match short keys (≤3 chars)
  "BCG Digital Ventures":      "/logos/Boston Consulting Group.png",
  "EY-Parthenon":              "/logos/EY.png",
  "EY-Partheno":               "/logos/EY.png",
  "UBS AG":                    "/logos/UBS.png",
  "BOA Merril Lynch":          "/logos/Bank of America.png",
  "BOA Merrill Lynch":         "/logos/Bank of America.png",
  "KLA-TENCOR":                "/logos/KLA.png",
  // "Ernst and" won't match map key "Ernst & Young" (& vs and)
  "Ernst and Young":           "/logos/EY.png",
  // "PwC" is 3 chars so "PwC UK" skips substring match
  "PwC UK":                    "/logos/PRICE WATERHOUSE COOPERS.png",
  // Logo files exist but no map entry
  "UnitedHealthcare":          "/logos/UnitedHealthcare.png",
  "United Health":             "/logos/UnitedHealth Group.png",
  "United Healthcare":         "/logos/United Healthcare.png",
  "UnitedHealth Group":        "/logos/UnitedHealth Group.png",
  "MetLife":                   "/logos/MetLife.png",
  "Activision Blizzard":       "/logos/Activision Blizzard.png",
  // Additional companies with mentors (add logo files to public/logos/ with matching filenames)
  "Anyscale":                  "/logos/Anyscale.png",
  "Generac Power Systems":     "/logos/Generac_Power_Systems.png",
  // DB typos
  "Googl":                     "/logos/google.png",
};

const LOGO_FILE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".svg"]);
let logoFileIndex = null;

function normalizeLogoLookupKey(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ")
    .replace(/[_+]/g, " ")
    .replace(/\b(the|inc|incorporated|llc|ltd|co|company|corp|corporation|group|holdings|services|service|usa|u\.s\.|us)\b/gi, " ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function compactLogoLookupKey(value) {
  return normalizeLogoLookupKey(value).replace(/[^\p{L}\p{N}]/gu, "");
}

function addLogoFileIndexValue(index, key, file) {
  if (!key || key.length < 2) return;
  if (index.has(key)) {
    const existing = index.get(key);
    const existingExt = path.extname(existing).toLowerCase();
    const nextExt = path.extname(file).toLowerCase();
    if (existingExt === ".svg" && nextExt !== ".svg") {
      index.set(key, `/logos/${file}`);
    }
    return;
  }
  index.set(key, `/logos/${file}`);
}

function buildLogoFileIndex(force = false) {
  if (logoFileIndex && !force) return logoFileIndex;
  const index = new Map();
  const logosDir = path.join(process.cwd(), "public", "logos");
  try {
    for (const file of fs.readdirSync(logosDir)) {
      const ext = path.extname(file);
      if (!LOGO_FILE_EXTENSIONS.has(ext.toLowerCase())) continue;
      const stem = path.basename(file, ext);
      addLogoFileIndexValue(index, normalizeLogoLookupKey(stem), file);
      addLogoFileIndexValue(index, compactLogoLookupKey(stem), file);
      addLogoFileIndexValue(index, normalizeLogoLookupKey(stem.replace(/_/g, " ")), file);
      addLogoFileIndexValue(index, compactLogoLookupKey(stem.replace(/_/g, " ")), file);
    }
  } catch (err) {
    console.warn("[mentorAdviceRetrieval] Unable to read public/logos for company logo index:", err.message);
  }
  logoFileIndex = index;
  return logoFileIndex;
}

function resolveLogoFromFileIndex(company) {
  let index = buildLogoFileIndex();
  const normalized = normalizeLogoLookupKey(company);
  const compact = compactLogoLookupKey(company);
  if (index.has(normalized)) return index.get(normalized);
  if (index.has(compact)) return index.get(compact);
  if (!normalized || compact.length <= 3) return null;
  for (const [key, value] of index.entries()) {
    if (key.length <= 3) continue;
    if (normalized.includes(key) || key.includes(normalized) || compact.includes(key) || key.includes(compact)) {
      return value;
    }
  }
  index = buildLogoFileIndex(true);
  if (index.has(normalized)) return index.get(normalized);
  if (index.has(compact)) return index.get(compact);
  return null;
}

/**
 * Resolves a company name to its logo URL path.
 * Returns null if no logo is found.
 */
function resolveCompanyLogo(company) {
  if (!company) return null;
  // Exact match
  if (COMPANY_LOGO_MAP[company] !== undefined) return COMPANY_LOGO_MAP[company] || null;
  // Case-insensitive / substring match
  const lower = company.toLowerCase();
  for (const [key, val] of Object.entries(COMPANY_LOGO_MAP)) {
    if (key.toLowerCase() === lower) return val || null;
    if (lower.includes(key.toLowerCase()) && key.length > 3) return val || null;
  }
  return resolveLogoFromFileIndex(company);
}

const DEFAULT_FREE_MENTOR_PROFILE = {
  mentorId: "mentor_amazon_default",
  mentorName: "Y 导师",
  company: "Amazon",
  companyLogo: "/logos/Amazon.png",
};

const CONFLICTING_TECH_KEYWORDS = [
  "spring boot", "rest api", "redis", "react", "node", "typescript", "pytorch",
  "transformer", "cnn", "backend", "frontend", "ai engineer", "software engineer",
  "software development engineer", "machine learning engineer"
];
const ACCOUNTING_UNSAFE_KEYWORDS = [
  ...CONFLICTING_TECH_KEYWORDS,
  "tip out", "measured cycle", "whole cycle"
];
const ML_UNSAFE_BUSINESS_KEYWORDS = [
  "financial analyst", "investment analyst", "risk analyst", "accounting",
  "accountant", "financial reporting", "valuation", "fp&a", "fpa",
  "quickbooks", "gaap", "accounts payable", "accounts receivable",
  "procurement", "logistic", "logistics", "supply chain",
  "ux designer", "ui/ux designer", "graphic designer", "visual designer",
  "product designer", "uiux", "portfolio", "animation", "animator",
  "2d animation", "storyboarding", "concept design", "hardware engineer",
  "hardware", "adc comparator", "tape out", "broadcom", "superseed studios",
  "data analyst", "actuarial", "marketing analytics", "marketing general",
  "会计", "投资分析", "金融公司", "数据分析岗位", "精算",
  "作品集", "设计师", "動畫", "硬件", "硬體"
];
const CAREER_GROUP_BY_FAMILY = {
  software_engineer: "tech",
  cloud_infrastructure: "tech",
  cybersecurity: "tech",
  it_support: "tech",
  machine_learning: "data",
  ai_engineer: "data",
  data_scientist: "data",
  data_analyst: "data",
  data_engineer: "data",
  design_creative: "design_creative",
  ux_research_design: "design_creative",
  finance: "finance_accounting",
  accounting: "finance_accounting",
  financial_analyst: "finance_accounting",
  trading_quant: "finance_accounting",
  actuarial: "finance_accounting",
  business: "business_ops",
  business_analysis: "business_ops",
  operations: "business_ops",
  business_operations: "business_ops",
  project_program_management: "business_ops",
  consulting: "business_ops",
  supply_chain_logistics: "business_ops",
  procurement: "business_ops",
  hr_recruiting: "business_ops",
  hospitality_events: "business_ops",
  marketing: "marketing_sales",
  sales_customer_success: "marketing_sales",
  communications_pr: "marketing_sales",
  product_manager: "product",
  hardware_electrical: "engineering_hardware",
  mechanical_engineering: "engineering_hardware",
  manufacturing_process: "engineering_hardware",
  industrial_quality: "engineering_hardware",
  civil_construction: "engineering_hardware",
  healthcare: "healthcare_life_sciences",
  life_sciences: "healthcare_life_sciences",
  social_services: "healthcare_life_sciences",
  legal_compliance: "legal_policy",
  policy_public_sector: "legal_policy",
  sustainability_environment: "legal_policy",
  education: "education_research",
  research_academic: "education_research",
  journalism_media: "media",
};
const CAREER_GROUP_BY_ROLE_GROUP = {
  accounting: "finance_accounting",
  finance: "finance_accounting",
  machine_learning: "data",
  ai_engineer: "data",
  data_scientist: "data",
  data_analyst: "data",
  cloud: "tech",
  security: "tech",
  it_support: "tech",
  software_engineer: "tech",
  hardware: "engineering_hardware",
  manufacturing: "engineering_hardware",
  quality: "engineering_hardware",
  mechanical: "engineering_hardware",
  project_management: "business_ops",
  product: "product",
  marketing: "marketing_sales",
  consulting: "business_ops",
  design: "design_creative",
  sales: "marketing_sales",
  hr: "business_ops",
  ops: "business_ops",
  education: "education_research",
  administration: "business_ops",
  legal: "legal_policy",
  healthcare: "healthcare_life_sciences",
};
const CROSS_ROLE_UNSAFE_PATTERNS_BY_GROUP = {
  tech: [
    /\b(accounting|accountant|audit|gaap|quickbooks|financial reporting|valuation|fp&a|fpa)\b/i,
    /\b(graphic designer|ux designer|ui\/ux|portfolio website|storyboarding|2d animation)\b/i,
    /\b(clinical trial|patient|medical chart)\b/i,
  ],
  data: [
    /\b(accounting|accountant|audit|gaap|quickbooks|financial reporting|valuation|fp&a|fpa)\b/i,
    /\b(graphic designer|ux designer|ui\/ux|portfolio website|storyboarding|2d animation)\b/i,
    /\b(hardware engineer|fpga|pcb|rtl|verilog|tape out|adc comparator)\b/i,
    /\b(clinical trial|patient|medical chart)\b/i,
  ],
  finance_accounting: [
    /\b(machine learning engineer|ml engineer|mle|pytorch|tensorflow|neural network|deep learning|llm|rag)\b/i,
    /\b(graphic designer|ux designer|ui\/ux|portfolio website|storyboarding|figma)\b/i,
    /\b(hardware engineer|fpga|pcb|rtl|verilog|tape out)\b/i,
  ],
  design_creative: [
    /\b(accounting|accountant|audit|gaap|financial modeling|valuation)\b/i,
    /\b(machine learning engineer|ml engineer|mle|pytorch|tensorflow|neural network|deep learning)\b/i,
    /\b(hardware|hardware engineer|electrical|circuit|analog|simulation circuit|medical device|medical devices|debug|prototype|fpga|pcb|rtl|verilog)\b/i,
    /硬件|硬體|医疗器械|醫療器械|模拟电路|類比電路|电路|電路|原型测试|调试|調試/i,
  ],
  engineering_hardware: [
    /\b(accounting|accountant|audit|gaap|financial analyst|valuation)\b/i,
    /\b(data analyst|business analyst|marketing analytics|graphic designer|ux designer|portfolio website|gameplay mechanics|player psychology|label design)\b/i,
    /\b(campaign|seo|sem|brand strategy)\b/i,
  ],
  business_ops: [
    /\b(pytorch|tensorflow|neural network|machine learning engineer|ml engineer|mle|rtl|verilog|fpga)\b/i,
    /\b(graphic designer|storyboarding|clinical trial)\b/i,
  ],
  marketing_sales: [
    /\b(pytorch|tensorflow|neural network|machine learning engineer|ml engineer|mle|rtl|verilog|fpga)\b/i,
    /\b(accounting reconciliation|gaap|quickbooks|clinical trial)\b/i,
  ],
  product: [
    /\b(accounting|gaap|quickbooks|rtl|verilog|fpga|clinical trial)\b/i,
  ],
  healthcare_life_sciences: [
    /\b(financial analyst|accounting|gaap|graphic designer|ux designer|frontend|backend|hardware engineer|fpga)\b/i,
  ],
  legal_policy: [
    /\b(pytorch|tensorflow|frontend|backend|graphic designer|financial modeling|hardware engineer|fpga)\b/i,
  ],
  education_research: [
    /\b(financial analyst|accounting|gaap|frontend|backend|graphic designer|hardware engineer|fpga)\b/i,
  ],
  media: [
    /\b(accounting|gaap|pytorch|tensorflow|hardware engineer|fpga|clinical trial)\b/i,
  ],
};

const ROLE_LOCKED_UNSAFE_RULES = [
  {
    allowedCareerGroups: ["engineering_hardware"],
    patterns: [
      /\b(hardware engineer|electrical engineer|circuit design|logic design|analog circuit|simulation circuit|pcb|fpga|rtl|verilog|vlsi|semiconductor|tape out|adc comparator|board-level|bring up)\b/i,
      /硬件|硬體|硬件工程|硬體工程|模拟电路|類比電路|电路设计|電路設計|板级测试|板級測試|芯片|晶片|嵌入式|软硬件调试|軟硬體調試/i,
    ],
  },
  {
    allowedCareerGroups: ["engineering_hardware", "healthcare_life_sciences"],
    patterns: [
      /\b(medical device|medical devices|medical equipment|biomedical device|test\/debug\/prototype)\b/i,
      /\b(hardware|medical device|medical devices).{0,50}\b(test|debug|prototype)\b/i,
      /\b(test|debug|prototype).{0,50}\b(hardware|medical device|medical devices)\b/i,
      /医疗器械|醫療器械|医疗设备|醫療設備|医工|醫工|硬件或医疗器械|硬體或醫療器械/i,
    ],
  },
  {
    allowedCareerGroups: ["healthcare_life_sciences"],
    patterns: [
      /\b(clinical trial|patient|medical chart|medical record|healthcare provider|pharma|biotech)\b/i,
      /临床|臨床|病患|患者|病历|病歷|医疗记录|醫療紀錄|药企|藥企|生物医药|生物醫藥/i,
    ],
  },
];
const ML_DA_DIRECTION_PATTERNS = [
  /\b(da|ba)\s*(方向|岗位|职位|role|jd|version|版本)\b/i,
  /\b(data analyst|business analyst|analytics analyst|bi analyst)\b/i,
  /\bmarketing analytics\b/i,
  /da\s*(相关|岗位|常用|匹配|工作内容|项目|简历|版本|方向)/i,
  /da\s*(和|与|及|\/)/i,
  /数据分析\s*(岗位|方向|相关|常用|匹配)/i,
  /目标(?:是|岗位是|职位是)\s*analytics/i,
  /目标是在\s*da\s*方向/i,
  /不要强调\s*(?:pytorch|neural network|deep learning|机器学习|深度学习)/i,
  /把精力放在\s*sql[、,\s]+统计[、,\s]+业务理解/i,
  /机器学习不需要学得很透彻/i,
];
const ACCOUNTING_FINANCE_TERMS = [
  "accounting", "finance", "audit", "bookkeeping", "financial reporting",
  "reconciliation", "excel", "quickbooks", "gaap", "accounts payable",
  "accounts receivable", "tax", "accountant", "financial analyst"
];
function containsUnsafeKeyword(text, keyword) {
  if (/[\u4e00-\u9fff]/.test(keyword)) return text.includes(keyword);
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, "i").test(text);
}
const RESUME_SCOPE_PATTERN = /简历|resume|ats|jd|keyword|关键词|投递|summary|skills|experience|bullet|岗位匹配|岗位定位|targeted resume|resume version/i;
const INTERVIEW_SCOPE_PATTERN = /面试|interview|behavioral|favorite course|课程|mock interview|star|tell me about yourself|自我介绍|stock answer|答案/i;
const NON_RESUME_ADVICE_PATTERN = /申研|升学|录取侧重|录取标准|admission|申请文书|推荐信|硬件.*onsite|硬件.*on-site|lab相关|实验室岗位|投递窗口|窗口期|10月份|十月份|春季\/暑期|实习作为entry point|追加约?\d+|先追加|投递量不足|丧失信心|full-time job offer|internship顺利完成|面试穿帮|判断简历效果|后续行动计划|岗位消失|岗位下线|快速约面|快速联系|约面邀请|收到约面|急需人才|公司急招|好兆头|放平心态|积极应对|候选人已足够|投递后.*约面|目标岗位是\s*analytics|analytics[（(]?.*而非\s*ds|analytics岗位和ds|机器学习不需要学得很透彻|把精力放在\s*sql|sql、统计和业务理解/i;
const NON_RESUME_TOPIC_PATTERN = /面试|interview|behavioral|technical interview|mock interview|投递渠道|求职渠道|内推|networking|职业方向选择|职业规划|求职时间规划|时间规划|市场竞争分析|竞争分析|背景差距分析|gap分析|申请学校|申研|升学|录取|申请文书|推荐信/i;
const RESUME_EDIT_ACTION_PATTERN = /summary|skills?|experience|projects?|education|coursework|relevant coursework|word|ruler|tab|bullet|jd|ats|keyword|keywords|关键词|简历|履历|改写|重写|精修|量化|成果|格式|版块|板块|岗位原词|目标岗位|portfolio|github|linkedin|课程|排版|段落|行距|页边距|对齐|日期右对齐|展示|体现|列出|补充|加入|写入|写进|删除|删掉|删去|移除|替换|添加|强调|说明|明确说明|细化|展开|重新框架|重构|保留/i;
const ATS_PROBLEM_TAGS = new Set([
  "low_jd_keyword_match",
  "missing_priority_keywords",
  "weak_target_role_alignment",
  "resume_not_tailored_to_jd",
  "low_hard_skill_match",
  "keyword_gap_minor",
  "weak_experience_keyword_evidence",
  "keywords_only_in_skills",
  "missing_exact_job_title",
  "partial_china_experience",
  "all_china_experience",
  "repetitive_verbs",
  "passive_voice",
  "missing_exp_location",
  "missing_section_dates",
  "inconsistent_date_format",
  "job_title_mismatch",
  "missing_github_link",
  "file_naming_issue",
  "non_chronological_order",
  "missing_summary",
  "missing_gpa",
  "missing_coursework",
  "career_growth_optimization",
]);
const FREE_HIGH_RISK_INTENTS = new Set([
  "resume_jd_keyword_fix",
  "resume_positioning",
  "resume_section_rewrite",
  "resume_content_quality",
]);

const PROBLEM_TAG_ALIASES = {
  keyword_gap_critical: "low_jd_keyword_match",
  keyword_gap_major: "low_jd_keyword_match",
  keyword_gap_minor: "low_jd_keyword_match",
  insufficient_quantification: "low_measurable_results",
  weak_verbs: "weak_action_verbs",
  missing_tools: "low_hard_skill_match",
  low_bullet_coverage: "weak_experience_keyword_evidence",
  no_relocate_signal: "missing_relocation_signal",
  short_tenure_unexplained: "short_tenure_unclear",
  role_mismatch: "weak_target_role_alignment",
  summary_missing_role: "weak_summary_role_alignment",
};

function normalizeTerm(term) {
  return String(term || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_")
    .replace(/[^\p{L}\p{N}_]+/gu, "")
    .replace(/^_+|_+$/g, "");
}

function splitCsv(value) {
  if (Array.isArray(value)) return value.map(normalizeTerm).filter(Boolean);
  if (!value) return [];
  return String(value)
    .split(/[,;|，、\n]+/)
    .map(normalizeTerm)
    .filter(Boolean);
}

const TARGET_ROLE_DISPLAY_LABELS = {
  software_development_engineer: "Software Development Engineer",
  software_engineer: "Software Engineer",
  backend_engineer: "Backend Engineer",
  frontend_engineer: "Frontend Engineer",
  full_stack_engineer: "Full Stack Engineer",
  machine_learning_engineer: "Machine Learning Engineer",
  machine_learning: "Machine Learning",
  ai_engineer: "AI Engineer",
  data_scientist: "Data Scientist",
  data_analyst: "Data Analyst",
  business_analyst: "Business Analyst",
  product_manager: "Product Manager",
  management_trainee: "Management Trainee",
  accounting: "Accounting",
  finance: "Finance",
};

function displayLabelForRoleTerm(term, fallback = "你的目标岗位") {
  const normalized = normalizeTerm(term);
  if (!normalized || normalized === "unknown" || normalized === "universal") return fallback;
  return TARGET_ROLE_DISPLAY_LABELS[normalized] ||
    String(term || normalized)
      .replace(/_/g, " ")
      .replace(/\b\w/g, (char) => char.toUpperCase());
}

function keywordDisplayLabel(term) {
  const raw = String(term || "").trim();
  if (!raw) return "";
  const normalized = normalizeTerm(raw);
  if (!normalized || normalized.length < 2) return "";
  return raw.includes("_")
    ? displayLabelForRoleTerm(raw, raw.replace(/_/g, " "))
    : raw;
}

function keywordMatchesInsight(term, insight) {
  const label = keywordDisplayLabel(term);
  if (!label) return false;
  const needle = String(term || "").trim().toLowerCase().replace(/_/g, " ");
  const haystack = String(insight || "").toLowerCase();
  if (!needle || !haystack) return false;
  if (/^[a-z0-9][a-z0-9+#.\s-]*$/i.test(needle)) {
    const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
    return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, "i").test(haystack);
  }
  return haystack.includes(needle);
}

function normalizeProblemTagForRetrieval(tag) {
  const normalized = normalizeTerm(tag);
  return PROBLEM_TAG_ALIASES[normalized] || normalized;
}

function normalizeProblemTagsForRetrieval(problemTags) {
  return [...new Set(splitCsv(problemTags).map(normalizeProblemTagForRetrieval).filter(Boolean))];
}

function includesAny(rowTerms, queryTerms) {
  const rowSet = new Set(splitCsv(rowTerms));
  return splitCsv(queryTerms).some((term) => rowSet.has(term));
}

function overlapScore(queryTerms, rowTerms) {
  const query = [...new Set(splitCsv(queryTerms))];
  const row = new Set(splitCsv(rowTerms));
  if (!query.length || !row.size) return 0;
  const hits = query.filter((term) => row.has(term)).length;
  return hits / query.length;
}

function textTermOverlapScore(queryTerms, text) {
  const query = [...new Set(splitCsv(queryTerms))];
  const haystack = String(text || "").toLowerCase();
  if (!query.length || !haystack) return 0;
  const hits = query.filter((term) => {
    const needle = term.replace(/_/g, " ");
    return needle && haystack.includes(needle);
  }).length;
  return hits / query.length;
}

function inferRoleFamilyFromJobTitle(jobTitle) {
  const text = String(jobTitle || "").toLowerCase();
  if (/\b(management trainee|graduate trainee|leadership development program|rotational program)\b/.test(text) || /管培/.test(text)) {
    return "management_trainee";
  }
  if (/\b(machine learning engineer|ml engineer|mle|deep learning engineer)\b/.test(text)) {
    return "machine_learning";
  }
  if (/\b(ai engineer|artificial intelligence engineer|llm engineer|generative ai engineer)\b/.test(text)) {
    return "ai_engineer";
  }
  if (/\b(data scientist)\b/.test(text)) return "data_scientist";
  if (/\b(data analyst|analytics analyst|business intelligence|bi analyst)\b/.test(text)) return "data_analyst";
  if (/\b(accountant|accounting|bookkeep|audit|tax|controller|cpa|accounts payable|accounts receivable)\b/.test(text)) {
    return "accounting";
  }
  if (/\b(finance|financial|investment|fp&a|valuation|treasury)\b/.test(text)) return "finance";
  if (/\b(cloud|devops|site reliability|sre|infrastructure|kubernetes|aws|azure|gcp)\b/.test(text)) return "cloud_infrastructure";
  if (/\b(cyber|security|soc analyst|siem|threat|vulnerability|incident response)\b/.test(text)) return "cybersecurity";
  if (/\b(it support|help desk|desktop support|technical support|systems administrator)\b/.test(text)) return "it_support";
  if (/\b(manufacturing|process engineer|lean|six sigma|yield|production engineer)\b/.test(text)) return "manufacturing_process";
  if (/\b(quality engineer|quality analyst|qa engineer|supplier quality|root cause|iso 9001)\b/.test(text)) return "industrial_quality";
  if (/\b(mechanical|cad|solidworks|autocad|thermal|finite element|fea|hvac)\b/.test(text)) return "mechanical_engineering";
  if (/\b(supply chain|logistics|demand planning|inventory|vendor|erp)\b/.test(text)) return "supply_chain_logistics";
  if (/\b(procurement|purchasing|sourcing|supplier|purchase order)\b/.test(text)) return "procurement";
  if (/\b(hr|human resources|recruiter|talent acquisition|people operations|hrbp)\b/.test(text)) return "hr_recruiting";
  if (/\b(game designer|game design|level designer|level design|ux designer|ui designer|product designer|graphic designer|visual designer|designer|animation|animator|illustrator)\b/.test(text)) {
    return "design_creative";
  }
  if (/\b(business|operations|strategy)\b/.test(text)) return "business";
  if (/\b(software|swe|sde|backend|frontend|full stack|developer|engineer)\b/.test(text)) {
    return "software_engineer";
  }
  return "unknown";
}

function qualityNormalized(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0.5;
  return Math.max(0, Math.min(1, numeric));
}

function dimensionsFromProblemTags(problemTags) {
  const map = {
    missing_exact_job_title: ["F", "F_role_fit"],
    keyword_gap_minor: ["D", "D_keyword_match"],
    low_hard_skill_match: ["D", "D_keyword_match"],
    low_soft_skill_match: ["D", "D_keyword_match"],
    missing_priority_keywords: ["D", "D_keyword_match"],
    low_jd_keyword_match: ["D", "D_keyword_match"],
    weak_summary_role_alignment: ["B", "B_contact", "F", "F_role_fit"],
    generic_resume_positioning: ["F", "F_role_fit"],
    low_role_specificity: ["F", "F_role_fit"],
    weak_target_role_alignment: ["F", "F_role_fit"],
    resume_not_tailored_to_jd: ["D", "D_keyword_match"],
    low_measurable_results: ["C", "C_content_quality"],
    weak_action_verbs: ["C", "C_content_quality"],
    weak_result_orientation: ["C", "C_content_quality"],
    missing_linkedin: ["B", "B_contact"],
    missing_portfolio: ["B", "B_contact"],
    uploaded_non_pdf_format: ["A", "A_format"],
    outdated_resume: ["A", "A_format"],
    formatting_penalty_triggered: ["A", "A_format"],
    short_tenure_unclear: ["C", "C_content_quality"],
    education_details_missing: ["B", "B_contact"],
    partial_china_experience: ["F", "F_role_fit", "C", "C_content_quality"],
    all_china_experience: ["E", "E_market_fit", "F", "F_role_fit", "C", "C_content_quality"],
    repetitive_verbs: ["C", "C_content_quality"],
    passive_voice: ["C", "C_content_quality"],
    missing_exp_location: ["A", "A_format"],
    missing_section_dates: ["A", "A_format"],
    inconsistent_date_format: ["A", "A_format"],
    job_title_mismatch: ["F", "F_role_fit"],
    missing_github_link: ["B", "B_contact"],
    file_naming_issue: ["A", "A_format"],
    non_chronological_order: ["A", "A_format"],
    missing_summary: ["B", "B_contact", "F", "F_role_fit"],
    missing_gpa: ["B", "B_contact"],
    missing_coursework: ["B", "B_contact"],
    career_growth_optimization: ["F", "F_role_fit", "C", "C_content_quality"],
  };
  return [...new Set(normalizeProblemTagsForRetrieval(problemTags).flatMap((tag) => map[tag] || []).filter(Boolean))];
}

function queryRoleFamilies(retrievalQuery = {}) {
  const filters = retrievalQuery.filters || {};
  const direct = normalizeTerm(retrievalQuery.roleFamily);
  const explicit = [...splitCsv(filters.roleFamily), direct].filter((term) => term && term !== "unknown" && term !== "universal");
  if (explicit.length) return [...new Set(explicit)];
  const inferred = inferRoleFamilyFromJobTitle(`${retrievalQuery.targetRole || ""} ${retrievalQuery.queryText || ""}`);
  return [...new Set([inferred].filter((term) => term && term !== "unknown"))];
}

function isBusinessQuery(retrievalQuery = {}) {
  return queryRoleFamilies(retrievalQuery).some((term) => BUSINESS_ROLE_FAMILIES.has(term));
}

function rowText(row) {
  return [
    row.topic, row.L1, row.L2, row.P_mentor, row.A_action, row.I_insight, row.H_hook,
    row.E_example, row.HR_os, row.keywords, row.retrieval_text, row.advice_card_title,
    row.user_problem_summary, row.action_summary, row.role_family, row.target_roles,
    row.generalized_action, row.activation_keywords, row.grounding_terms, row.canonical_action_family,
    row.title, row.problemSummary, row.actionSummary, row.currentDiagnosis, row.action,
    row.mentorInsight, row.example, row.hrPerspective, row.roleFamily, row.targetRoles,
    row.humanized_hr_perspective, row.humanizedHrPerspective, row.recruiterPerspective,
    row.recruiter_perspective, row.hrPov, row.humanized_mentor_insight,
    row.humanized_mentor_insight_raw, row.humanizedMentorInsightRaw,
    row.humanized_hr_perspective_raw, row.humanizedHrPerspectiveRaw,
    row.humanized_mentor_insight_generalized, row.humanizedMentorInsightGeneralized,
    row.humanized_hr_perspective_generalized, row.humanizedHrPerspectiveGeneralized,
    row.humanizedMentorInsight, row.reason, row.mentorLens,
    row.mentorName, row.mentor_name, row.company, row.mentor_company, row.mentorTitle,
    row.mentor_title
  ].filter(Boolean).join(" ").toLowerCase();
}

function hasWrongMlTargetAdvice(row) {
  const text = rowText(row);
  return /目标岗位是\s*analytics|analytics[（(]?.*而非\s*ds|analytics岗位和ds|data analytics.*而非.*data scientist|machine learning.*不是.*ds|机器学习不需要学得很透彻|把精力放在\s*sql|sql、统计和业务理解|基础统计和sql|业务理解上|准备两个版本[^。.!?]*(da\/ba|data analyst|business analyst|marketing analytics)|marketing analytics|marketing general|\bba\s*方向|ba方向|ba\s*\/\s*da|da\s*\/\s*ba|\bquant\b|quant\s*(research|risk)|mfe|risk quant|sharpe ratio|embedded system|computer vision|偏\s*(da|ba|bi)\b/i.test(text);
}

function hasUnsupportedIdentityAssumption(row) {
  const text = rowText(row);
  return /绿卡|green card|work authorization|工作身份|公民身份|身份放到|holder|不需要sponsor|不需要\s*sponsorship|无需sponsor|无需\s*sponsorship/i.test(text);
}

function hasUnsupportedBackgroundAssumption(row) {
  const text = rowText(row);
  return /\bphd\b|ph\.d\.|doctorate|doctoral|博士|博士学历|博士研究|research domain/i.test(text);
}

function hasMismatchedCaseStudyAdvice(row, targetProblemTags = []) {
  const text = rowText(row);
  const hasPrCase = /battery scandal|pr crisis|public relations crisis|legal implications|case study|竞争分析|宏观影响|舆情|危机公关/i.test(text);
  if (!hasPrCase) return false;
  const allowed = targetProblemTags.some((item) => {
    const tag = item.tag || item;
    const family = item.coverageFamily || "";
    return /communications|pr|legal|policy|case_study|research|market|competition/i.test(`${tag} ${family}`);
  });
  return !allowed;
}

function hasExperienceSectionTitleOnlyAdvice(row) {
  const text = rowText(row);
  return /internship/.test(text) &&
    /professional experience|experience/.test(text) &&
    /标题|栏|section|header|heading|版块|板块/.test(text) &&
    !/jd|ats|keyword|关键词|machine learning|mle|image generation|stable diffusion|sdxl|flux|comfyui/i.test(text);
}

function inferAdviceScope(row) {
  const text = rowText(row);
  const topicText = [row.topic, row.L1, row.L2].filter(Boolean).join(" ").toLowerCase();
  const actionText = [row.A_action, row.action_summary].filter(Boolean).join(" ").toLowerCase();
  if (INTERVIEW_SCOPE_PATTERN.test(topicText)) {
    if (/behavioral|star|tell me about yourself|自我介绍/i.test(topicText)) return "behavioral_interview";
    return "interview_prep";
  }
  if (RESUME_SCOPE_PATTERN.test(`${topicText} ${actionText}`)) {
    if (/rewrite|改写|精修|bullet|experience/i.test(`${topicText} ${actionText}`)) return "resume_rewrite";
    if (/投递|strategy|version|版本|定位/i.test(`${topicText} ${actionText}`)) return "resume_strategy";
    return "resume_ats";
  }
  if (INTERVIEW_SCOPE_PATTERN.test(text)) return "interview_prep";
  if (/job search|求职|networking|linkedin|岗位/i.test(text)) return "job_search_strategy";
  if (/career|职业|成长|规划/i.test(text)) return "career_coaching";
  return "unknown";
}

function inferAdviceIntent(row) {
  const text = rowText(row);
  const topicText = [row.topic, row.L1, row.L2].filter(Boolean).join(" ").toLowerCase();
  const actionText = [row.A_action, row.action_summary].filter(Boolean).join(" ").toLowerCase();
  const decisionText = `${topicText} ${actionText}`;
  if (INTERVIEW_SCOPE_PATTERN.test(topicText)) return "interview_prep";
  if (/3\s*小时|三\s*小时|尽快投递|投递时间|application timing|timing|apply within|early application|抢投|海投/i.test(actionText)) {
    return "application_timing";
  }
  if (/jd|ats|keyword|关键词|机筛|匹配|岗位匹配|targeted resume|resume version|版本/i.test(decisionText)) {
    return "resume_jd_keyword_fix";
  }
  if (/summary|skills|experience|bullet|section|板块|经历|项目|改写|rewrite|精修/i.test(decisionText)) {
    return "resume_section_rewrite";
  }
  if (/定位|positioning|目标岗位|像.*岗位|role fit|岗位方向/i.test(decisionText)) return "resume_positioning";
  if (/量化|成果|content quality|action verb|impact|表达|内容质量/i.test(decisionText)) return "resume_content_quality";
  if (INTERVIEW_SCOPE_PATTERN.test(text)) return "interview_prep";
  if (/job search|求职策略|linkedin|networking|内推|投递策略/i.test(text)) return "job_search_strategy";
  if (/career|职业|成长|规划/i.test(text)) return "career_coaching";
  return "resume_positioning";
}

// ── Issue-first matching helpers ──────────────────────────────────────────────

const ISSUE_SPECIFIC_TAGS = new Set([
  "weak_quantification", "weak_action_verbs", "vague_impact", "bullet_too_generic",
  "weak_summary", "unclear_positioning", "low_readability",
  "low_measurable_results", "weak_result_orientation", "weak_action_verb",
]);
const UNIVERSAL_TAGS = new Set([
  "format_issue", "readability_issue", "missing_contact_info", "objective_outdated",
  "formatting_penalty_triggered", "outdated_resume", "missing_linkedin", "missing_portfolio",
]);
const FUNCTION_GROUP_FAMILIES = {
  finance_group: ["finance", "accounting", "financial_analyst", "investment", "risk"],
  data_group: ["data_analyst", "data_scientist", "business_analyst", "bi_analyst"],
  marketing_group: ["marketing", "growth", "social_media", "brand", "content"],
};

/**
 * Infer how transferable an advice segment is across roles/industries.
 * Returns: "role_specific" | "function_specific" | "issue_specific" | "universal"
 * Note: this is different from inferAdviceScope() which returns resume_ats/interview_prep/etc.
 */
function inferAdviceTransferabilityScope(row) {
  const rowFamilies = splitCsv(row.role_family || row.roleFamily || "").filter((f) => f !== "universal");
  const tags = splitCsv(row.problem_tags);
  const text = rowText(row);

  // Universal: explicitly tagged universal or format/contact/objective issues
  if (rowFamilies.length === 0 || rowFamilies.includes("universal")) {
    if (tags.some((t) => UNIVERSAL_TAGS.has(t)) || /format|contact|objective|length|layout|section.?order/i.test(text)) {
      return "universal";
    }
  }

  // Issue-specific: problem tags that cross industry lines
  if (tags.some((t) => ISSUE_SPECIFIC_TAGS.has(t)) && rowFamilies.length === 0) return "issue_specific";

  // Role-bound: check if within a shared function group → function_specific
  if (rowFamilies.length > 0 && !rowFamilies.includes("universal")) {
    for (const [, group] of Object.entries(FUNCTION_GROUP_FAMILIES)) {
      if (rowFamilies.some((f) => group.includes(f))) return "function_specific";
    }
    return "role_specific";
  }

  // Issue-specific fallback (prefer over role_specific for cross-industry problems)
  if (tags.some((t) => ISSUE_SPECIFIC_TAGS.has(t))) return "issue_specific";
  return "issue_specific";
}

const ROLE_SENSITIVITY_BY_PROBLEM_TAG = {
  low_jd_keyword_match: 0.75,
  missing_domain_keywords: 0.85,
  low_hard_skill_match: 0.80,
  missing_priority_keywords: 0.75,
  weak_target_role_alignment: 0.55,
  weak_summary_role_alignment: 0.50,
  weak_summary: 0.45,
  unclear_positioning: 0.45,
  generic_resume_positioning: 0.50,
  resume_not_tailored_to_jd: 0.65,
  weak_experience_keyword_evidence: 0.55,
  keywords_only_in_skills: 0.50,
  weak_quantification: 0.25,
  weak_action_verbs: 0.20,
  vague_impact: 0.25,
  bullet_too_generic: 0.20,
  low_measurable_results: 0.25,
  weak_result_orientation: 0.25,
  format_issue: 0.10,
  readability_issue: 0.10,
  formatting_penalty_triggered: 0.10,
  missing_contact_info: 0.05,
  missing_linkedin: 0.08,
  missing_portfolio: 0.35,
  missing_github_link: 0.35,
  objective_outdated: 0.05,
  outdated_resume: 0.05,
};

function getActionabilityScore(card) {
  const text = `${card.action || card.actionSummary || ""} ${card.reason || ""}`.trim();
  if (!text) return 0.3;
  const len = text.length;
  const lengthScore = Math.min(1, len / 200);
  const hasVerb = /\b(删除|改成|补上|在|把|加入|建议|优先|先|add|remove|replace|rewrite|change|update|include|删掉|写进|嵌入|调整|改写|移除)\b/i.test(text);
  const hasConcrete = /\d|%|关键词|bullet|section|summary|skills|experience|jd|ats|岗位词/i.test(text);
  return Math.min(1, (lengthScore * 0.4) + (hasVerb ? 0.35 : 0) + (hasConcrete ? 0.25 : 0));
}

function getSpecificityScore(card) {
  const text = `${card.title || ""} ${card.action || card.actionSummary || ""} ${card.mentorLens || ""}`.trim();
  if (!text) return 0.3;
  const hasExample = /例如|比如|e\.g\.|such as|例子|如：|like:|比如说/i.test(text);
  const hasSection = /summary|skills|experience|education|projects|bullet|section/i.test(text);
  const hasNumber = /\d/.test(text);
  const len = Math.min(1, text.length / 150);
  return Math.min(1, (hasExample ? 0.35 : 0) + (hasSection ? 0.25 : 0) + (hasNumber ? 0.15 : 0) + len * 0.25);
}

function getTransferabilityScore(card) {
  const scope = card._transferabilityScope || inferAdviceTransferabilityScope(card);
  switch (scope) {
    case "universal": return 1.0;
    case "issue_specific": return 0.80;
    case "function_specific": return 0.55;
    case "role_specific": return 0.30;
    default: return 0.60;
  }
}

function getProblemFitScore(card, problemTags = []) {
  if (!problemTags.length) return card.retrieval_score || 0;
  const related = relatedTagsForCard(card, problemTags);
  if (!related.length) return Math.min(0.3, card.retrieval_score || 0);
  const severities = new Map(problemTags.map((p) => [typeof p === "string" ? p : p.tag, p.severity || "medium"]));
  const weightedFit = related.reduce((sum, tag) => sum + severityWeight(severities.get(tag) || "medium"), 0);
  const maxPossible = problemTags.slice(0, 3).reduce((sum, p) => sum + severityWeight(p.severity || "medium"), 0) || 1;
  return Math.min(1, weightedFit / maxPossible);
}

function inferTopicCluster(card) {
  const text = `${card.title || ""} ${card.adviceIntent || ""} ${card.topic || ""} ${card.targetSection || ""}`.toLowerCase();
  const tags = card.relatedProblemTags || [];
  if (tags.some((t) => /jd_keyword|hard_skill|keyword_gap|priority_keyword/.test(t)) || /keyword|jd match|技能词|硬技能/.test(text)) return "JD Match";
  if (/summary|定位|about|headline|positioning/.test(text)) return "Summary Positioning";
  if (tags.some((t) => /role_alignment|target_role|exact_title/.test(t)) || /role.alignment|方向|岗位定位/.test(text)) return "Role Alignment";
  if (/skill|工具|技能区/.test(text)) return "Skills Section";
  if ((/experience|bullet|经历/.test(text)) && /impact|成果|量化|result/.test(text)) return "Bullet Impact";
  if (/quantif|量化|数字|数据|measure/.test(text)) return "Quantification";
  if (/action verb|动词|用词/.test(text)) return "Action Verbs";
  if (/format|格式|layout|版式/.test(text)) return "Format";
  if (/ats|machine|系统识别/.test(text)) return "ATS Screening";
  if (/hr|招聘|recruiter|筛选/.test(text)) return "HR Screening";
  if (/readability|阅读|可读/.test(text)) return "Readability";
  return "Overall";
}

function inferMentorFitType(card, userProfile = {}) {
  const transferScope = card._transferabilityScope || inferAdviceTransferabilityScope(card);
  const rowFamilies = splitCsv(card.roleFamily || card.role_family || "");
  const userFamily = normalizeTerm(userProfile.roleFamily || "");
  const hasSameRole = userFamily && rowFamilies.includes(userFamily);

  if (transferScope === "universal") return "ats_universal";
  if (card.adviceIntent === "resume_jd_keyword_fix" && transferScope !== "role_specific") return "ats_universal";
  if (hasSameRole) return "same_role";
  if (transferScope === "function_specific") return "same_function";
  if (transferScope === "issue_specific") return "cross_domain_high_relevance";
  if (rowFamilies.includes("universal")) return "ats_universal";
  return "cross_domain_high_relevance";
}

function generateAdviceExplanationMetadata(card, userProfile = {}) {
  const transferScope = card._transferabilityScope || inferAdviceTransferabilityScope(card);
  const mentorFitType = inferMentorFitType(card, userProfile);
  const topicCluster = card._topicCluster || inferTopicCluster(card);
  const tags = card.relatedProblemTags || [];
  const problemFit = getProblemFitScore(card, userProfile.problemTags || []);
  const roleMismatch = card.roleMismatchPenalty || 0;
  const roleFit = Math.max(0, 1 - roleMismatch);
  const confidenceScore = Math.round(
    (problemFit * 0.50 + roleFit * 0.20 + getTransferabilityScore(card) * 0.30) * 100
  ) / 100;

  let matchReason = "";
  if (mentorFitType === "ats_universal") {
    matchReason = "这是 ATS 通用建议，适用于所有岗位，不依赖特定产业背景。";
  } else if (mentorFitType === "same_role") {
    matchReason = "这位导师与你的目标职位方向一致，建议与你的岗位需求高度对齐。";
  } else if (mentorFitType === "same_function") {
    matchReason = "导师与你属于同一职能领域，这条建议在该职能内可安全复用。";
  } else if (mentorFitType === "recruiter_perspective") {
    matchReason = "这条建议来自 HR / Recruiter 视角，聚焦筛选逻辑，不依赖特定产业背景。";
  } else if (mentorFitType === "cross_domain_high_relevance") {
    if (transferScope === "issue_specific") {
      const tagName = tags[0] ? tags[0].replace(/_/g, " ") : "简历问题";
      matchReason = `虽然导师来自不同产业，但这条建议处理的是跨职位通用的「${tagName}」问题，可直接应用。`;
    } else {
      matchReason = "这条建议虽来自跨领域导师，但精准对应你当前的简历问题，属于跨领域高相关建议。";
    }
  } else {
    matchReason = "这条建议与你当前 ATS 简历问题高度相关。";
  }

  return {
    adviceTransferScope: transferScope,
    matchReason,
    mentorFitType,
    coveredProblemTags: tags,
    topicCluster,
    confidenceScore,
  };
}

// Dynamic role-group classification — maps any role / role-family string to a coarse
// career group. Used to detect when role-specific advice belongs to a career area that
// is incompatible with whatever role the CURRENT user is actually applying for.
// NOTE: keyword list, not hardcoded single roles — adapts to the user's real target role.
const ROLE_GROUP_KEYWORDS = [
  ["accounting",  ["accounting", "accountant", "account", "audit", "tax", "bookkeep", "cpa", "controller", "accounts payable", "accounts receivable", "gaap"]],
  ["finance",     ["finance", "financial analyst", "investment", "equity", "bank", "wealth", "actuar", "fp&a", "fpa", "treasury", "credit risk", "valuation"]],
  ["machine_learning", ["machine learning", "ml ", "ml engineer", "mle", "deep learning", "computer vision", "model deployment", "ml pipeline"]],
  ["ai_engineer", ["ai engineer", "artificial intelligence engineer", "llm engineer", "generative ai engineer", "prompt engineer", "rag engineer"]],
  ["data_scientist", ["data scientist", "statistician", "biostatistician", "statistical modeling", "experiment design"]],
  ["data_analyst", ["data analyst", "data analytics", "data and analytics", "business analyst", "business intelligence", "analytics analyst", "bi analyst"]],
  ["cloud",      ["cloud", "cloud infrastructure", "cloud engineer", "devops", "site reliability", "sre", "kubernetes", "docker", "terraform", "aws", "azure", "gcp"]],
  ["security",   ["cybersecurity", "cyber security", "security engineer", "security analyst", "soc analyst", "siem", "vulnerability", "incident response", "threat"]],
  ["it_support", ["it support", "help desk", "desktop support", "technical support", "systems administrator", "system administrator", "network support"]],
  ["hardware",    ["hardware", "electrical", "circuit", "chip", "semiconductor", "vlsi", "analog", "pcb", "embedded", "firmware"]],
  ["manufacturing", ["manufacturing", "manufacturing process", "process engineer", "production engineer", "lean", "six sigma", "yield", "root cause"]],
  ["quality",     ["industrial quality", "quality engineer", "quality analyst", "supplier quality", "quality assurance", "qa engineer", "iso 9001", "root cause"]],
  ["mechanical",  ["mechanical", "mechanical engineering", "cad", "solidworks", "autocad", "thermal", "finite element", "fea", "hvac"]],
  ["software_engineer", ["software", "backend", "back end", "frontend", "front end", "full stack", "fullstack", "web develop", "mobile develop", "data engineer", "devops", "sde", "swe", "developer", "programmer"]],
  ["project_management", ["project manager", "program manager", "scrum master", "delivery manager", "implementation manager"]],
  ["product",     ["product manager", "product owner", "product analyst", "product operations"]],
  ["marketing",   ["marketing", "growth", "seo", "sem", "content strateg", "brand", "social media", "advertis", "copywrit"]],
  ["consulting",  ["consult", "strategy", "advisory"]],
  ["design",      ["ux", "ui ", "product design", "graphic design", "game design", "designer", "animat", "illustrat"]],
  ["sales",       ["sales", "account executive", "business development", "customer success", "solution consultant"]],
  ["hr",          ["human resource", "people ops", "recruit", "talent acquisition", "hrbp"]],
  ["ops",         ["operations", "business operations", "supply chain", "logistics", "procurement", "purchasing", "sourcing", "inventory", "demand planning"]],
  ["education",   ["education", "teacher", "teaching", "school", "admission", "counseling", "student affairs"]],
  ["administration", ["administration", "admin", "office assistant", "office coordinator"]],
  ["legal",       ["legal", "law", "attorney", "paralegal", "compliance", "counsel"]],
  ["healthcare",  ["nurse", "clinical", "pharma", "medical", "healthcare"]],
];

function roleGroupOf(str) {
  // normalize underscores → spaces so "machine_learning" matches "machine learning"
  const s = String(str || "").toLowerCase().replace(/_/g, " ");
  if (!s.trim() || s.trim() === "universal") return null;
  for (const [group, kws] of ROLE_GROUP_KEYWORDS) {
    if (kws.some((k) => s.includes(k))) return group;
  }
  return null; // unknown / unclassifiable → treat as non-restrictive
}

function careerGroupOf(value) {
  const normalized = normalizeTerm(value);
  if (!normalized || normalized === "universal" || normalized === "unknown") return null;
  return CAREER_GROUP_BY_FAMILY[normalized] ||
    CAREER_GROUP_BY_ROLE_GROUP[roleGroupOf(normalized)] ||
    null;
}

function careerGroupsForRow(row) {
  const terms = [
    row.target_role_family, row.targetRoleFamily,
    row.target_role, row.targetRole,
    row.role_family, row.roleFamily,
    row.target_roles, row.targetRoles,
  ].flatMap(splitCsv).filter((term) => term && term !== "universal");
  return [...new Set(terms.map(careerGroupOf).filter(Boolean))];
}

function hasRoleSpecificSignal(row) {
  const text = rowText(row);
  const roles = [
    ...splitCsv(row.target_role_family || row.targetRoleFamily),
    ...splitCsv(row.target_role || row.targetRole),
    ...splitCsv(row.role_family || row.roleFamily),
    ...splitCsv(row.target_roles || row.targetRoles),
  ].filter((term) => term && term !== "universal");
  if (roles.length) return true;
  return /\b(accounting|accountant|financial analyst|machine learning engineer|ml engineer|mle|data analyst|data scientist|business analyst|software engineer|ux designer|graphic designer|hardware engineer|mechanical engineer|marketing analyst|product manager|clinical|legal|compliance)\b/i.test(text);
}

function hasMlDaDirectionalAdvice(row) {
  const text = rowText(row);
  return ML_DA_DIRECTION_PATTERNS.some((pattern) => pattern.test(text));
}

function hasRoleLockedUnsafeAdvice(text = "", userCareerGroup = "") {
  if (!userCareerGroup) return false;
  return ROLE_LOCKED_UNSAFE_RULES.some((rule) => {
    if (rule.allowedCareerGroups.includes(userCareerGroup)) return false;
    return rule.patterns.some((pattern) => pattern.test(text));
  });
}

function hasCrossRoleUnsafeAdvice(row, userRoleFamily = "", userTargetRole = "") {
  const userFamily = normalizeTerm(userRoleFamily || inferRoleFamilyFromJobTitle(userTargetRole));
  const userCareerGroup = careerGroupOf(userFamily) || careerGroupOf(userTargetRole);
  if (!userCareerGroup) return false;

  const text = rowText(row);
  if (userFamily === "machine_learning" || /\b(machine learning|mle|ml engineer)\b/i.test(String(userTargetRole || ""))) {
    if (hasMlDaDirectionalAdvice(row)) return true;
  }

  const rowCareerGroups = careerGroupsForRow(row);
  const roleSpecific = hasRoleSpecificSignal(row);
  if (rowCareerGroups.length && !rowCareerGroups.includes(userCareerGroup) && roleSpecific) return true;
  if (hasRoleLockedUnsafeAdvice(text, userCareerGroup)) return true;

  const unsafePatterns = CROSS_ROLE_UNSAFE_PATTERNS_BY_GROUP[userCareerGroup] || [];
  return unsafePatterns.some((pattern) => pattern.test(text));
}

function isEligibleForAtsResumeReport(row) {
  const dbScope = normalizeTerm(row.retrieval_scope || row.retrievalScope || "");
  if (dbScope) {
    const text = rowText(row);
    const actionText = [row.A_action, row.action_summary, row.action, row.actionSummary].filter(Boolean).join(" ").toLowerCase();
    if (dbScope !== "resume_edit") return false;
    if (NON_RESUME_ADVICE_PATTERN.test(text)) return false;
    if (!RESUME_EDIT_ACTION_PATTERN.test(actionText)) return false;
    return true;
  }

  const scope = inferAdviceScope(row);
  const text = rowText(row);
  const actionText = [row.A_action, row.action_summary].filter(Boolean).join(" ").toLowerCase();
  const topicText = [row.topic, row.L1, row.L2].filter(Boolean).join(" ").toLowerCase();
  const hasResumeEditSignal = RESUME_EDIT_ACTION_PATTERN.test(text);
  const hasResumeEditAction = RESUME_EDIT_ACTION_PATTERN.test(actionText);
  if (NON_RESUME_TOPIC_PATTERN.test(topicText)) return false;
  if ((scope === "interview_prep" || scope === "behavioral_interview") && !RESUME_EDIT_ACTION_PATTERN.test(text)) return false;
  if (/favorite course|stock answer|面试答案|interview answers?/i.test(text)) return false;
  // Exclude cover letter advice — this is a resume-only system
  if (/cover letter|求职信|coverletter/i.test(text)) return false;
  // Exclude micro-formatting advice (font, bold, spacing) — too low-value
  if (/bold.*normal|字体.*不一致|normal.*bold|字号不统一|字体混用|font.*incons/i.test(text)) return false;
  if (!hasResumeEditSignal) return false;
  if (!hasResumeEditAction) return false;
  if (NON_RESUME_ADVICE_PATTERN.test(actionText) && !RESUME_EDIT_ACTION_PATTERN.test(actionText)) return false;
  if (["resume_ats", "resume_rewrite", "resume_strategy"].includes(scope)) return true;
  if (String(row.ats_dimensions || "").trim() && RESUME_EDIT_ACTION_PATTERN.test(text)) return true;
  if (splitCsv(row.problem_tags).some((tag) => ATS_PROBLEM_TAGS.has(tag)) && RESUME_EDIT_ACTION_PATTERN.test(text)) return true;
  return false;
}

// Dynamically filter advice whose career area is incompatible with the user's ACTUAL
// target role. Fully role-agnostic: derives the user's group from their real target role,
// and the segment's group from its coaching-session role tags. Universal advice always passes.
function isRoleSafeForUser(row, userRoleFamily, userTargetRole) {
  const userGroup = roleGroupOf(userRoleFamily) || roleGroupOf(userTargetRole);
  const userCareerGroup = careerGroupOf(userRoleFamily) || careerGroupOf(userTargetRole);
  if (hasCrossRoleUnsafeAdvice(row, userRoleFamily, userTargetRole)) return false;
  if (!userGroup && !userCareerGroup) return true; // can't classify the user → don't filter

  // Universal advice transfers across all roles
  if (String(row.generality || "").toLowerCase() === "universal" && !hasRoleSpecificSignal(row)) return true;

  // The segment's own career area — prefer the coaching session's actual target role,
  // which is the most reliable signal of what career area the advice was really about.
  const segGroup =
    roleGroupOf(row.target_role_family) ||
    roleGroupOf(row.target_role) ||
    roleGroupOf((row.role_family || "").split(",")[0]);
  const segCareerGroups = careerGroupsForRow(row);
  if (!segGroup && !segCareerGroups.length) return true; // segment not tied to a concrete area → safe

  // Role-specific / industry-specific advice is only safe within the same coarse career group.
  // Fine-grained cases such as MLE receiving DA-direction advice are handled by text guards.
  if (userCareerGroup && segCareerGroups.length) {
    return segCareerGroups.includes(userCareerGroup);
  }
  return segGroup === userGroup;
}

function isTechOnlyRow(row) {
  const rowRoles = [...splitCsv(row.role_family), ...splitCsv(row.target_roles)].filter((term) => term !== "universal");
  return rowRoles.length > 0 && rowRoles.every((term) =>
    TECH_ROLE_FAMILIES.has(term) || /software|backend|frontend|ai|machine_learning/.test(term)
  );
}

function hasConflictingRoleExamples(row, retrievalQuery = {}) {
  if (!isBusinessQuery(retrievalQuery)) return false;
  const text = rowText(row);
  const unsafe = isAccountingQuery(retrievalQuery) ? ACCOUNTING_UNSAFE_KEYWORDS : CONFLICTING_TECH_KEYWORDS;
  return unsafe.some((keyword) => text.includes(keyword));
}

function isAdviceRoleSafe(row, targetRole, roleFamily) {
  if (hasUnsupportedIdentityAssumption(row)) return false;
  if (hasUnsupportedBackgroundAssumption(row)) return false;
  const normalizedRole = normalizeTerm(targetRole || "");
  const normalizedFamily = normalizeTerm(roleFamily || inferRoleFamilyFromJobTitle(targetRole));
  const retrievalQuery = {
    roleFamily: normalizedFamily,
    targetRole: normalizedRole,
    queryText: `${targetRole || ""} ${roleFamily || ""}`,
    filters: {
      roleFamily: [normalizedFamily].filter(Boolean),
      targetRoles: [normalizedRole].filter(Boolean),
    },
  };
  const scope = row.adviceScope || inferAdviceScope(row);
  const intent = row.adviceIntent || inferAdviceIntent(row);
  const text = rowText(row);

  if (scope === "interview_prep" || scope === "behavioral_interview") return false;
  if (intent === "interview_prep") return false;
  if (!isEligibleForAtsResumeReport(row)) return false;
  if (hasCrossRoleUnsafeAdvice(row, normalizedFamily, normalizedRole)) return false;
  if (hasConflictingRoleExamples(row, retrievalQuery)) return false;

  const technicalFamilies = ["software_engineer", "ai_engineer", "machine_learning", "data_scientist"];
  const userGroup = roleGroupOf(normalizedFamily) || roleGroupOf(normalizedRole);
  const rowGroups = [
    ...splitCsv(row.roleFamily || row.role_family).filter((term) => term !== "universal"),
    ...splitCsv(row.targetRoles || row.target_roles).filter((term) => term !== "universal"),
  ].map(roleGroupOf).filter(Boolean);
  if (userGroup && rowGroups.length && !rowGroups.includes(userGroup)) return false;

  const nonTechnical = !technicalFamilies.includes(normalizedFamily);
  if (nonTechnical && CONFLICTING_TECH_KEYWORDS.some((keyword) => text.includes(keyword))) return false;
  const normalizedRoleWords = normalizedRole.replace(/_/g, " ");
  if (technicalFamilies.includes(normalizedFamily) || /\b(machine learning|mle|ml engineer|ai engineer)\b/.test(normalizedRoleWords)) {
    if (ML_UNSAFE_BUSINESS_KEYWORDS.some((keyword) => containsUnsafeKeyword(text, keyword))) return false;
    if (hasWrongMlTargetAdvice(row)) return false;
  }
  if (normalizedFamily === "accounting" || normalizedFamily === "finance" || /account/.test(normalizedRole)) {
    if (ACCOUNTING_UNSAFE_KEYWORDS.some((keyword) => text.includes(keyword))) return false;
  }
  return /resume|ats|jd|keyword|summary|skills|experience|bullet|简历|关键词|岗位|匹配|经历|项目|模型|框架|技术栈|技能/i.test(text);
}

function calculateRoleMismatchPenalty(row, retrievalQuery = {}) {
  // Universal advice (by content) should never be penalized regardless of
  // which student's session it came from — the tag reflects the student, not the advice.
  const userRoleFamily = (retrievalQuery?.filters?.roleFamily || []).find(r => r !== "universal")
    || retrievalQuery?.roleFamily || inferRoleFamilyFromJobTitle(retrievalQuery?.targetRole || "");
  const userTargetRole = retrievalQuery?.targetRole || "";
  if (hasCrossRoleUnsafeAdvice(row, userRoleFamily, userTargetRole)) return 0.95;
  if (row.generality === "universal" && !hasRoleSpecificSignal(row)) return 0;

  const queryFamilies = queryRoleFamilies(retrievalQuery);
  const rowFamilies = splitCsv(row.role_family);
  const rowTargets = splitCsv(row.target_roles);
  const concreteFamilies = rowFamilies.filter((term) => term !== "universal");
  const concreteTargets = rowTargets.filter((term) => term !== "universal");
  const businessQuery = queryFamilies.some((term) => BUSINESS_ROLE_FAMILIES.has(term));
  const familyMatch = concreteFamilies.some((term) => queryFamilies.includes(term));
  const queryCareerGroups = new Set(queryFamilies.map(careerGroupOf).filter(Boolean));
  const rowCareerGroups = new Set([...concreteFamilies, ...concreteTargets].map(careerGroupOf).filter(Boolean));
  const sameCareerGroup = !queryCareerGroups.size || !rowCareerGroups.size ||
    [...rowCareerGroups].some((group) => queryCareerGroups.has(group));

  if (!queryFamilies.length) return 0;
  if (!sameCareerGroup && hasRoleSpecificSignal(row)) return 0.75;
  if (businessQuery && isTechOnlyRow(row)) return 0.65;
  if (businessQuery && concreteTargets.some((term) => /software|backend|frontend|ai|machine_learning/.test(term))) return 0.5;
  if (!familyMatch && concreteFamilies.length) return 0.35;
  if (rowFamilies.includes("universal") && !familyMatch) return 0.08;
  return 0;
}

function conflictingExamplePenalty(row, retrievalQuery = {}) {
  return hasConflictingRoleExamples(row, retrievalQuery) ? 0.45 : 0;
}

function calculateRetrievalScore(row, retrievalQuery = {}) {
  const filters = retrievalQuery.filters || {};
  const queryProblemTags = normalizeProblemTagsForRetrieval(retrievalQuery.problemTags);
  const problemTagScore = overlapScore(queryProblemTags, row.problem_tags);
  const roleFamilyScore = overlapScore(filters.roleFamily, row.role_family);
  const targetRoleScore = overlapScore(filters.targetRoles, row.target_roles);
  const seniorityScore = includesAny(row.seniority, "universal")
    ? Math.max(0.65, overlapScore(filters.seniority, row.seniority))
    : overlapScore(filters.seniority, row.seniority);
  const keywordScore = overlapScore(retrievalQuery.priorityKeywords, row.keywords);
  const contentKeywordScore = textTermOverlapScore(retrievalQuery.priorityKeywords, rowText(row));
  const dimensionScore = overlapScore(dimensionsFromProblemTags(retrievalQuery.problemTags), row.ats_dimensions);
  const accountingKeywordBoost = isBusinessQuery(retrievalQuery) ? overlapScore(ACCOUNTING_FINANCE_TERMS, row.keywords) : 0;
  const roleMismatchPenalty = calculateRoleMismatchPenalty(row, retrievalQuery);
  const roleConflictPenalty = conflictingExamplePenalty(row, retrievalQuery);
  const confidenceScore = { high: 1, medium: 0.65, low: 0.25 }[normalizeTerm(row.confidence)] || 0.5;
  const freeSafetyScore = Number(row.safe_to_show_free || 0) === 1 ? 1 : 0;
  const rewriteValueScore = Number(row.requires_ai_rewrite || 0) === 1 ? 0.35 : 0.15;

  const score =
    0.35 * Math.max(problemTagScore, dimensionScore * 0.8) +
    0.25 * roleFamilyScore +
    0.15 * targetRoleScore +
    0.08 * seniorityScore +
    0.08 * Math.max(keywordScore, contentKeywordScore, accountingKeywordBoost) +
    0.06 * qualityNormalized(row.mentor_quality_score) +
    0.04 * qualityNormalized(row.feedback_score) +
    0.04 * confidenceScore +
    0.02 * freeSafetyScore +
    0.02 * rewriteValueScore -
    roleMismatchPenalty -
    roleConflictPenalty;

  return Number(score.toFixed(6));
}

function buildMatchedReasons(row, retrievalQuery = {}) {
  const filters = retrievalQuery.filters || {};
  const reasons = [];
  const queryProblemTags = normalizeProblemTagsForRetrieval(retrievalQuery.problemTags);
  if (overlapScore(queryProblemTags, row.problem_tags) > 0) reasons.push("problem_tags");
  if (overlapScore(filters.roleFamily, row.role_family) > 0) reasons.push("role_family");
  if (overlapScore(filters.targetRoles, row.target_roles) > 0) reasons.push("target_roles");
  if (overlapScore(filters.seniority, row.seniority) > 0) reasons.push("seniority");
  if (overlapScore(retrievalQuery.priorityKeywords, row.keywords) > 0) reasons.push("keywords");
  if (textTermOverlapScore(retrievalQuery.priorityKeywords, rowText(row)) > 0) reasons.push("content_keywords");
  if (overlapScore(dimensionsFromProblemTags(retrievalQuery.problemTags), row.ats_dimensions) > 0) reasons.push("ats_dimensions");
  if (calculateRoleMismatchPenalty(row, retrievalQuery) > 0) reasons.push("role_mismatch_penalty");
  if (hasConflictingRoleExamples(row, retrievalQuery)) reasons.push("conflicting_role_examples");
  const scope = inferAdviceScope(row);
  if (scope !== "unknown") reasons.push(`scope:${scope}`);
  if (includesAny(row.role_family, "universal") || includesAny(row.target_roles, "universal") || includesAny(row.seniority, "universal")) {
    reasons.push("universal_fallback");
  }
  return [...new Set(reasons)];
}

// Circled digit codepoints U+2460-U+2469 (①-⑩) and U+2776-U+277F (❶-❿)
function isEnumChar(ch) {
  if (!ch) return false;
  var cp = ch.codePointAt(0);
  return (cp >= 0x2460 && cp <= 0x2469) || (cp >= 0x2776 && cp <= 0x277F);
}

function cleanAndTruncate(value, maxLength, fallback) {
  maxLength = maxLength == null ? 140 : maxLength;
  fallback = fallback == null ? '' : fallback;
  var text = String(value || '').replace(/\s+/g, ' ').trim();
  if (!text) return fallback;
  if (text.length <= maxLength) return text;
  var slice = text.slice(0, maxLength);
  var sentenceEnd = Math.max(
    slice.lastIndexOf("。"), slice.lastIndexOf("."), slice.lastIndexOf("！"),
    slice.lastIndexOf("!"),      slice.lastIndexOf("？"), slice.lastIndexOf("?")
  );
  if (sentenceEnd >= 24) return slice.slice(0, sentenceEnd + 1).trim();
  var commaEnd = -1;
  ["，", ","].forEach(function(sep) {
    var idx = slice.lastIndexOf(sep);
    if (idx >= 24) commaEnd = Math.max(commaEnd, idx);
  });
  // Accept ；/; as break only when NOT followed by an enumeration marker
  ["；", ";"].forEach(function(sep) {
    var idx = slice.lastIndexOf(sep);
    if (idx >= 24 && !isEnumChar(text[idx + 1])) commaEnd = Math.max(commaEnd, idx);
  });
  var cut = commaEnd >= 24 ? slice.slice(0, commaEnd).trim() : slice.trim();
  cut = cut.replace(/[\s([{,:]+$/, "").trim();
  var lastSpace = cut.lastIndexOf(" ");
  if (/^[\x00-\x7F]+$/.test(cut) && lastSpace > Math.floor(maxLength * 0.55)) {
    cut = cut.slice(0, lastSpace).trim();
  }
  if (!cut || /[(（\[{]$/.test(cut)) {
    return fallback || (text.slice(0, Math.max(1, maxLength - 3)).trim() + "...");
  }
  return cut + "...";
}

function truncateAtSentence(value, maxLength = 140) {
  return cleanAndTruncate(value, maxLength);
}

function firstMeaningfulSentence(value = "", maxLength = 90) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (!text) return "";
  const normalized = text
    .replace(/^(HR|招聘方|面试官|导师|企业|公司|系统|ATS)[在会通常优先]*扫描简历时/g, "")
    .replace(/^(学生|求职者|候选人)/g, "你")
    .replace(/候选人/g, "你")
    .replace(/求职者/g, "你")
    .replace(/学生/g, "你")
    .replace(/主观能动性/g, "主动推进感")
    .replace(/关键指标/g, "重点")
    .replace(/核心考察点/g, "重点")
    .replace(/显著提升/g, "更容易提升")
    .replace(/具有说服力/g, "更有说服力")
    .replace(/\s+/g, " ")
    .trim();
  return cleanAndTruncate(normalized, maxLength, "");
}

function perspectiveFamilyOf(item = {}) {
  const family = normalizeTerm(canonicalActionFamilyOf(item));
  const tags = splitCsv(item.relatedProblemTags || item.problemTags || item.problem_tags || []);
  const tagText = `${family} ${tags.join(" ")}`;
  const visibleText = [
    item.title,
    item.topic,
    item.problemSummary,
    item.currentDiagnosis,
    item.action,
    item.actionSummary,
    item.A_action,
    item.mentorInsight,
    item.I_insight,
    item.hrPerspective,
    item.HR_os,
    item.user_problem_summary,
  ].filter(Boolean).join(" ").toLowerCase();
  const combined = `${tagText} ${visibleText}`;

  // Highest-signal problem tags first. Avoid letting generic "role/target" words
  // swallow keyword, portfolio, education, and impact cases.
  const isSkillsFrontloadCase =
    /skill.*前置|技能.*前置|skills.*front|skill_section_first|技能栏.*前|在校生.*技能|学生.*技能/.test(combined) ||
    (/skills_section/.test(tagText) && /education_details|student|junior|在校|学生|课程|教育/.test(combined));
  if (isSkillsFrontloadCase) return "skills_frontload";
  if (/portfolio|作品集|作品|可运行.{0,12}demo|demo.{0,12}(?:作品|可运行)|game.{0,20}demo|design.{0,20}demo/.test(combined)) return "portfolio";
  if (/github|linkedin|profile_link|project_link|header.{0,12}link|链接|入口|可验证/.test(combined)) return "links";
  if (/visa|sponsor|relocation|relocate|opt|cpt|work_authorization|market_fit|地域|身份|搬迁/.test(combined)) return "market";
  if (/可部署|可访问|产品形态|benchmark|基准对比|上线|deployable|deployed|deployment|productionized|live product/.test(combined)) return "deployment_evidence";
  if (/追问|过度包装|实际参与度|参与度匹配|可信度|写得越多|被问到/.test(combined)) return "scope_truthfulness";
  if (/数据处理|模型评估|实质性数据|数据工作|算法部署|业务决策|业务影响|可复现|持续使用|stable.{0,8}metrics|metrics.{0,8}stable|data science|data_processing|model_evaluation|model evaluation|data work|reproducible|business decision|price elasticity|促销效果|excel|pivot|vlookup|sql|window function|var|stress testing|regression model/.test(combined)) return "data_evidence";
  if (/format|layout|date|section_order|section_structure|readability|排版|格式|日期|结构|顺序/.test(combined)) return "structure";
  if (/generic_resume|resume_not_tailored|tailored|low_role_specificity|weak_target_role_alignment|universal_resume|多版本|一份简历|通用版|版本简历|不同岗位/.test(combined)) return "resume_versioning";
  if (/measurable|result|impact|metric|quant|weak_action_verbs|weak_result|low_measurable|数字|量化|成果|影响/.test(combined)) return "impact";
  if (/keyword|jd|hard_skill|skills_only|skill_match|priority_keyword|terminology|技能|关键词/.test(combined)) return "keywords";
  if (/education|course|certificate|training|coursework|missing_coursework|gpa|课程|证书|教育背景|学校名称|评分制/.test(combined)) return "education";
  if (/experience|bullet|evidence|project|soft_skill|cross_functional|沟通|协作|项目|经历/.test(combined)) return "experience";
  if (/summary|position|role_alignment|role_specificity|tailored|generic_resume|exact_job_title|target_role|missing_summary|定位|岗位原词|目标岗位|通用版/.test(combined)) return "positioning";
  return "general";
}

const MENTOR_TONE_TEMPLATES = {
  resume_versioning: [
    "你不是没有材料，是一份简历同时想服务太多方向。建议先拆成 1-2 个版本，让每一版都能一眼看出目标岗位。",
    "这类问题不要靠海投硬扛。先把通用版收成 1-2 个岗位版，每版只突出最相关的经历和关键词，比做五六份散版更稳。",
    "这里建议先收窄方向：不是所有经历都放进去，而是每版只回答一个问题——为什么你适合这个岗位。"
  ],
  skills_frontload: [
    "如果你还是学生或经验不长，技能可以适当前置。不是为了炫技，而是先让 HR 看到你已经具备这个岗位的基本准备。",
    "这块可以把 Skills 放得更有策略：先列和 JD 最贴的工具，再用经历证明你真的用过，别让相关技能藏在后面。",
    "在校生简历要先给招聘方一个能力入口。最相关的技能和课程项目可以往前放，让人先看到你和岗位有连接。"
  ],
  portfolio: [
    "作品集或 Demo 不是装饰，它是在帮你证明真的做出来了。哪怕还不完美，也比只靠文字描述更有说服力。",
    "你这个方向最好别只靠文字说项目。可以补一个能点开的作品或 Demo，让招聘方可以马上验证你的产出。",
    "创意、设计、游戏或内容岗位很吃作品证据。你不用等到完美才放，先让对方看到你实际做过什么。"
  ],
  data_evidence: [
    "你不是不能写 Demo，但数据岗不能只停在展示层。这里要补出数据处理、模型评估或分析产出，让项目更像真正的数据工作。",
    "这条项目要从“我做了展示”往“我处理了什么数据、怎么评估、产出了什么结论”走。这样才比较能支撑数据岗。",
    "如果目标是数据相关岗位，算法部署后面的数据证据要补出来。只写 Demo，容易让人觉得深度还不够。"
  ],
  deployment_evidence: [
    "这条项目可以更像真实产品一点。把可部署、可访问或 benchmark 对比写出来，会比只说技术点更能证明你做到了可交付。",
    "你这里的亮点不是模型多复杂，而是东西能不能被验证。访问入口、部署方式和对比结果要补清楚。",
    "如果项目已经能跑或能和成熟产品对比，就别让它藏在描述里。这个证据会让项目从练习题变成更像实际产出。"
  ],
  scope_truthfulness: [
    "这条不是要你写少一点，而是要写得和真实参与度对得上。简历上写太满，面试被追问时反而会伤可信度。",
    "你这条项目深度要控制在自己能讲清楚的范围内。亮点可以放大，但不能放到面试时接不住。",
    "你有材料可以写，但每一句都要经得起追问。我们先保留最能证明能力、也最能讲清楚的部分。"
  ],
  positioning: [
    "你这里不是经历不够，而是开头还没把方向说清楚。建议先把目标岗位放出来，让后面的项目和技能被放在正确语境里读。",
    "这里建议先把定位写稳。现在的问题不是没有材料，而是招聘方第一眼还不确定你到底要投哪个方向。",
    "这块很适合先补一条清楚的岗位线索。方向立住以后，你后面的经历才比较容易被当成相关证据。"
  ],
  keywords: [
    "你这类问题不用硬塞关键词，重点是把 JD 里的词放回真实经历里。这样 ATS 能扫到，HR 也会觉得这些能力有证据。",
    "可以先挑最该补的关键词，再找经历里的落点。不是把词堆上去，而是让它们看起来确实是你做过的事。",
    "这里可以修得很具体：先对齐 JD 的核心词，再把它们写进 Summary、Skills 或对应 bullet，可信度会比单纯列词高很多。"
  ],
  experience: [
    "你这条经历不是没价值，是现在写法还没把价值露出来。任务、方法和结果要拆清楚，让人一眼看懂你贡献在哪。",
    "这块可以先把经历讲完整。现在像是在说你参与过，但还没说明你具体推进了什么、产出了什么。",
    "你的材料其实可以用，只是需要从“做了什么”改成“解决了什么”。这样读起来会更像真实工作成果。"
  ],
  impact: [
    "这里不用追求夸张数字，但一定要给看简历的人一个结果边界。补上规模、频率或效率，贡献就不会停留在职责描述。",
    "你已经有事情可写，下一步是把影响讲出来。哪怕数字很朴素，也比只写负责、协助更能让人判断价值。",
    "这条可以从结果往回改：先写你带来的变化，再补方法。这样 HR 读到时会更快知道你不是普通参与者。"
  ],
  structure: [
    "这类问题看起来像排版小事，其实会影响别人愿不愿意继续读。结构先理顺，亮点才不会被格式消耗掉。",
    "你不用大改所有内容，先把 section 顺序和格式稳定下来。读者少花力气找信息，你的经历才更容易被看见。",
    "这里先做减法会很有效。把最相关的内容往前放，弱相关内容收住，整份简历会更像在服务同一个目标岗位。"
  ],
  links: [
    "如果项目或作品能被点开验证，就不要只留在文字里。链接可以放到 header 或对应项目旁边，降低别人确认成本。",
    "这块是低成本加分项。你已经写了项目，就尽量给招聘方一个能快速验证的入口。",
    "这里重点是减少确认成本。能放链接就放在最容易看到的位置，让对方不用来回找证据。"
  ],
  education: [
    "经验还不多的时候，课程和训练可以帮你补岗位信号。别只列名字，要写出它和目标岗位有什么关系。",
    "这块可以当作 junior 候选人的支撑证据。把课程、项目或证书和岗位能力连起来，会比单纯罗列更有用。",
    "如果你还在校，教育经历不只是学校名字。把相关课程、项目或证书写成能力证据，会比单纯罗列更像岗位准备。"
  ],
  market: [
    "身份或地点信息不用写得很重，但要让招聘方少一点不确定。可工作、可搬迁或时间安排要说清楚。",
    "这类信息不是能力问题，而是推进流程的问题。你先把条件讲清楚，HR 才不用在第一轮替你猜。",
    "如果涉及 sponsorship、OPT 或 relocation，用一句干净的话交代清楚就好，避免它盖过你的能力亮点。"
  ],
  general: [
    "你这里有可修改的空间，而且不是推倒重来。先抓最影响筛选的那一处改，简历会更快被读懂。",
    "这条建议的重点是把现有材料讲得更清楚。方向对了以后，很多小修改都会变得更有效。",
    "这块值得优先修：不是因为你不行，而是现在的写法还没帮你把优势说出来。"
  ]
};

const HR_TONE_TEMPLATES = {
  resume_versioning: [
    "我会先判断这是不是为当前岗位写的版本；如果像通用版，匹配感会马上变弱。",
    "一份简历同时投很多方向时，我很难判断该把你推给哪个团队；岗位版本越清楚，筛选越顺。",
    "我不需要看到所有经历，我需要看到和这个 JD 最相关的证据；内容越散，越容易被当成不够聚焦。"
  ],
  skills_frontload: [
    "经验不长时，我会先看技能和训练能不能补上岗位信号；相关技能藏太后面，会影响第一判断。",
    "Skills 如果能快速对上 JD，我会更愿意继续看经历；但后面也要有项目或工作证据支撑。",
    "学生简历我会更快扫 Skills 和课程项目；写得清楚，才容易被理解为有准备。"
  ],
  portfolio: [
    "如果岗位需要作品或 Demo，我会很自然地去找链接；找不到会影响继续评估。",
    "能点开的作品会降低判断成本；没有入口时，我只能按文字描述保守判断。",
    "作品链接不是加分装饰，它会影响我能不能快速确认你的真实产出。"
  ],
  data_evidence: [
    "如果只是 Demo 展示，我会继续看有没有数据处理、评估或分析证据；没有这些，数据岗匹配感会弱。",
    "数据相关岗位我会看项目里有没有真实数据动作；只写部署或展示，深度判断会比较保守。",
    "我需要看到你处理了什么数据、怎么评估结果；否则这个项目更像展示，不像数据能力证明。"
  ],
  deployment_evidence: [
    "我会看这个项目是不是能被验证；如果有可访问入口、部署结果或 benchmark，可信度会明显更高。",
    "只写用了什么技术还不够，我会更想看到它能不能跑、和谁比较、结果差在哪里。",
    "项目如果已经产品化，我会把它当成更强证据；但入口和对比结果要写清楚。"
  ],
  scope_truthfulness: [
    "写得越满，我越可能在面试里追问细节；如果讲不出来，可信度会掉得很快。",
    "我不怕项目小，但怕描述和实际参与度对不上。写清楚自己真实负责的部分会更稳。",
    "简历上的每个亮点都可能被追问；如果只是包装出来的贡献，面试时风险很高。"
  ],
  positioning: [
    "我第一眼会先判断你到底投什么岗；如果定位不清楚，后面的经历再好也容易被归到不相关。",
    "这块如果没有目标岗位线索，我会先降低匹配判断，因为我需要很快确认你是不是这类候选人。",
    "我不会花很久猜你想投什么方向；岗位信号越清楚，继续细读的概率越高。"
  ],
  keywords: [
    "我会用 JD 关键词快速确认基本匹配；如果核心词缺失，简历很容易在第一轮就显得不够贴合。",
    "关键词只在 Skills 里出现还不够，我会继续看经历里有没有证据；没有证据时可信度会打折。",
    "这类词不是写给系统看的摆设；如果真实经历里看不到，我会怀疑只是照着 JD 补词。"
  ],
  experience: [
    "我看经历时会先找你具体负责什么、怎么做、交付了什么；只写参与或协助，很难判断贡献。",
    "一条 bullet 如果没有任务和结果，我会把它当成弱信号，因为看不出你能独立承担到哪一步。",
    "项目名本身不够，我会看你在里面的角色和产出；写不清楚时，亮点很容易被跳过。"
  ],
  impact: [
    "我会看你是不是把事情做到有结果；数字不用夸张，但要让我知道规模、效率或影响边界。",
    "如果整段都停在职责描述，我会很难判断你比其他候选人强在哪里。",
    "结果表达会直接影响可信度；没有规模或变化，我只能按普通执行经历来理解。"
  ],
  structure: [
    "排版和结构会影响我读下去的耐心；信息乱的时候，很多亮点还没被看到就已经扣分。",
    "我不会平均阅读每个 section；越靠前、越清楚的内容，越会影响我对你的第一判断。",
    "格式稳定不是美观问题，而是筛选效率问题；如果信息不好找，我会更快转向下一份简历。"
  ],
  links: [
    "如果我能一键验证项目或作品，判断成本会低很多；没有链接时，只能按文字描述保守判断。",
    "可验证入口会增加可信度；尤其是项目型经历，没有链接会让证据感弱一些。",
    "我会优先相信能被快速验证的材料；链接缺失时，项目亮点容易停留在自述层面。"
  ],
  education: [
    "经验不长时，我会看训练是否补得上；相关课程别只列名字，要让我看到它和岗位的关系。",
    "如果你还是 junior，我会用课程、项目和证书判断准备度；写得太泛就很难加分。",
    "教育背景可以补信号，但必须和岗位能力连起来；否则我只会把它当成普通课程清单。"
  ],
  market: [
    "涉及 sponsorship 或 relocation 时，我会很快确认流程风险；信息清楚，不代表扣分，反而能减少来回确认。",
    "我需要知道这位候选人能不能顺利推进到入职；身份和地点说不清，会拖慢判断。",
    "这不是能力问题，但会影响招聘流程。你把条件讲明白，我才更容易把注意力放回经历本身。"
  ],
  general: [
    "我会先看这条信息能不能帮我快速判断匹配度；如果太泛，筛选价值会变低。",
    "这块如果说不清楚，我会保守处理，因为第一轮筛选没有太多时间帮候选人补上下文。",
    "我需要很快看到岗位相关证据；信息越具体，进入下一轮的理由越充分。"
  ]
};

function templateIndexForItem(item = {}, length = 1) {
  const raw = String(item.adviceId || item.id || item.chunkId || item.chunk_id || item.title || "");
  let hash = 0;
  for (let i = 0; i < raw.length; i += 1) hash = (hash * 31 + raw.charCodeAt(i)) >>> 0;
  return length ? hash % length : 0;
}

function approvedHumanized(value, status = "") {
  const text = cleanAndTruncate(value, 180, "");
  if (!text) return "";
  const normalizedStatus = normalizeTerm(status || "");
  if (!normalizedStatus || ["approved", "auto_classified", "llm_generated", "runtime"].includes(normalizedStatus)) return text;
  return normalizedStatus === "needs_review" ? "" : text;
}

function isReportLikePerspective(value = "") {
  const text = String(value || "");
  return /候选人|求职者|招聘方|企业|公司|ATS|机筛|系统|面试官|简历读者|读者|HR|客户|岗位需求|关键指标|核心指标|显著提升|筛选|竞争力|匹配度|标准术语|市场份额|业务布局|普遍要求|业界普遍|市场JD|baseline技能/.test(text);
}

function isConversationalMentorText(value = "") {
  const text = String(value || "").trim();
  return /^(你这里|你这条|这条|这块|我会|我建议|你的|这里)/.test(text) &&
    !isReportLikePerspective(text) &&
    text.length <= 120;
}

function toneTargetContextText(context = {}) {
  const internalAtsResult = context.internalAtsResult || {};
  const text = [
    internalAtsResult.jobTitle,
    internalAtsResult.profile?.targetRole,
    internalAtsResult.profile?.roleFamily,
    internalAtsResult.jdText,
    internalAtsResult.jobDescription,
    internalAtsResult.rawJobDescription,
    internalAtsResult.retrievalQuery?.targetRole,
    internalAtsResult.retrievalQuery?.queryText,
  ].filter(Boolean).join(" ");
  return String(text || "").toLowerCase();
}

function hasRuntimeTargetContext(context = {}) {
  return Boolean(toneTargetContextText(context).trim());
}

function toneTargetMatches(context = {}, pattern) {
  if (!hasRuntimeTargetContext(context)) return true;
  return pattern.test(toneTargetContextText(context));
}

function isDaToneContext(context = {}) {
  return toneTargetMatches(context, /\b(da|data analyst|data analytics|analytics analyst|bi analyst|business intelligence|business analyst|product analyst|marketing analytics)\b|数据分析|商业分析|业务分析|分析师|数据岗/i);
}

function isSdeToneContext(context = {}) {
  return toneTargetMatches(context, /\b(sde|swe|software engineer|software developer|full[-\s]?stack|backend|frontend|front[-\s]?end|back[-\s]?end)\b|软件工程|软件开发|前端|后端|全栈/i);
}

function isDataToneContext(context = {}) {
  return toneTargetMatches(context, /\b(da|ds|data analyst|data analytics|analytics analyst|bi analyst|business intelligence|business analyst|product analyst|marketing analytics|data scientist|machine learning|ml engineer|mle)\b|数据分析|商业分析|业务分析|数据科学|机器学习|分析师|数据岗/i);
}

function isMlToneContext(context = {}) {
  return hasRuntimeTargetContext(context) &&
    /\b(machine learning|ml engineer|mle|applied ml|ai engineer|llm|large language model|data scientist|deep learning)\b|机器学习|人工智能|大模型|数据科学/i.test(toneTargetContextText(context));
}

function isApprovedPerspectiveSafeForContext(text = "", item = {}, context = {}) {
  if (!hasRuntimeTargetContext(context)) return true;
  const value = String(text || "");
  const { roleFamily, targetRole } = contextRoleForPerspective(context);
  if (hasCrossRoleUnsafeAdvice({
    ...item,
    HR_os: value,
    hrPerspective: value,
    humanized_hr_perspective: value,
  }, roleFamily, targetRole)) {
    return false;
  }
  if (/\b(da|data analyst|data analytics|bi analyst|business intelligence|business analyst)\b|DA 简历|DA 经历|DA 实习|DA bullet|DA工作|数据分析岗位|数据岗/i.test(value) && !isDataToneContext(context)) {
    return false;
  }
  if (/\b(sde|swe|software engineer|software developer)\b|SDE|SWE|软件工程|软件开发/i.test(value) && !isSdeToneContext(context)) {
    return false;
  }
  if (/\b(pm|product manager|product management|prd)\b|产品经理|产品岗/i.test(value) && !toneTargetMatches(context, /\b(pm|product manager|product management|prd)\b|产品经理|产品岗/i)) {
    return false;
  }
  if (/\b(finance|financial analyst|accounting|audit|risk|quant|banking|valuation)\b|金融|会计|审计|风控|量化|估值/i.test(value) && !toneTargetMatches(context, /\b(finance|financial analyst|accounting|audit|risk|quant|banking|valuation)\b|金融|会计|审计|风控|量化|估值/i)) {
    return false;
  }
  if (/\b(marketing|consumer|social media|retention|growth)\b|营销|市场|消费者|社媒|增长/i.test(value) && !toneTargetMatches(context, /\b(marketing|consumer|social media|retention|growth)\b|营销|市场|消费者|社媒|增长/i)) {
    return false;
  }
  return true;
}

function detailAwareMentorTemplate(family, rawSource = "", item = {}, context = {}) {
  const raw = String(rawSource || "");
  const text = [
    raw,
    item.title,
    item.problemSummary,
    item.currentDiagnosis,
    item.action,
    item.actionSummary,
  ].filter(Boolean).join(" ");
  if (/背调公司不会直接使用简历时间|背调表|毕业证书日期|简历时间模糊化|背调如实填写/i.test(text)) {
    return "你这里可以把简历时间写得简洁，但背调表要按毕业证书日期如实填。两者不冲突，关键是不要让时间线前后矛盾。";
  }
  if (/sponsorship|无需担保|HR筛选阶段|ATS层面|中小公司|初创公司|成本和风险/i.test(text)) {
    return "你这里如果不需要 sponsorship，要主动写清楚。很多中小公司在 ATS 和 HR 初筛就怕成本风险，这句能减少误杀。";
  }
  if (/技术关键词会传递求职方向信号|技术栈判断候选人定位|与目标岗位不符的高级工程技术|认知混乱/i.test(text)) {
    return "你这条技术关键词要服务目标岗位定位。高级工程词如果和目标岗不符，会让 HR 误判方向，降低通过率。";
  }
  if (isDaToneContext(context) && /DA简历的bullet point|岗位JD中要求的技能点|按技能维度分拆|时间顺序叙事|关键词覆盖密度/i.test(text)) {
    return "你这条 DA bullet 可以按技能维度拆，不要只按时间顺序讲故事。让 HR 一眼对到 JD 技能点，关键词密度会更有效。";
  }
  if (isDaToneContext(context) && /DA实习经历|技术工具链的各个环节|完整的DA工作流能力|DA工作流/i.test(text)) {
    return "你这段 DA 实习要写出完整工作流。取数、清洗、分析、可视化各环节都有信号，才像真的做过 DA 工作。";
  }
  if (isDaToneContext(context) && /DA和DS简历|DA和DS简历的关键词体系|DA和DS简历侧重点|DA简历需突出.*DS简历才需要|DA强调数据查询、可视化、业务协作|用错简历版本/i.test(text)) {
    return "你这条要分清 DA 和 DS 关键词版本。DA 写数据查询、清洗、可视化和业务协作；DS 才重点放建模和大数据工程。";
  }
  if (isDaToneContext(context) && /同一份工作内容|不同技术栈的语言|分析师视角|从哪里取数|如何清洗|如何整合|底层传输架构/i.test(text)) {
    return "你这条可以换成 DA 视角写，但不是乱包装。重点写从哪里取数、怎么清洗整合，而不是底层传输架构。";
  }
  if (isDaToneContext(context) && /Kafka|误认为你在求DE\/DS|求DE|求DS|目标岗位精准匹配技术栈/i.test(text)) {
    return "你这条如果目标是 DA，Kafka 这类技术关键词要谨慎放。它可能让 HR 误判你在投 DE 或 DS，反而稀释岗位定位。";
  }
  if (/Asana|设定里程碑|分配任务|追踪时间线|项目管理工具/i.test(text)) {
    return "你这条 Asana 不是只写工具名。把设定里程碑、分配任务、追踪时间线这些动作写出来，跨职能执行力才会被看见。";
  }
  if (/SQL、Python|不提工具|具体技术关键词|数据岗位的技术能力无法被识别/i.test(text)) {
    return "你这条数据岗经历要把 SQL、Python 这些具体技术关键词写出来。只写业务动作不提工具，ATS 和 HR 很难识别技术能力。";
  }
  if (/通用简历无法|岗位高度匹配|核心技能和经历|ATS系统/i.test(text)) {
    return "你这里要避免一份通用简历打全部岗位。每个版本都要按 JD 放核心技能和经历，不然 ATS 和 HR 都很难判定匹配。";
  }
  if (/目标岗位定制|无关经历|分散HR注意力|方向不同的岗位需维护不同版本/i.test(text)) {
    return "你这里要按目标岗位定制。无关经历会占版面也会分散注意力，不同方向可以维护不同版本，但每版都要更聚焦。";
  }
  if (/目标JD为锚点|先定目标再修简历|命中率.*泛化版/i.test(text)) {
    return "你这里先别急着改字句，要先把目标 JD 定下来。不同职位侧重点不一样，先定目标再修，命中率会比泛化版高。";
  }
  if (/覆盖多种职能类型的主简历|90%重用|10%的定制|摘要行|每个职位一条要点/i.test(text)) {
    return "你可以保留主简历做 90% 复用，再用 10% 针对 JD 调摘要和要点。这样比每次从零重写更有效率。";
  }
  if (/职位名称的标准化|Software Engineer Intern|行业通用的标准名称|ATS系统.*title/i.test(text)) {
    return "你这里 title 要用市场听得懂的标准名称。像 Software Engineer Intern 这种行业通用 title，会比自创名称更容易被 ATS 和 HR 识别。";
  }
  if (/Job Title|Title在目标市场认知度低|定位判断|简历被忽视/i.test(text)) {
    return "你这条 Job Title 要先对齐目标市场。title 如果别人看不懂或和方向不符，HR 很可能还没读经历就先定位错。";
  }
  if (/IPO客户|三年历史财务复核|内控审计.*SOC|IT cycle|revenue cycle|普通engagement/i.test(text)) {
    return "你这段 IPO audit 要把三年历史财务复核、SOC、IT cycle 和 revenue cycle 写出来，这些细节比普通 engagement 更能说明资历。";
  }
  if (/Retention Marketing Specialist|lower funnel|LTV|自动化触达|现有客户/i.test(text)) {
    return "你这条 Retention Marketing 要讲清 lower funnel。重点是现有客户 LTV、自动化触达和留存，不是泛泛写 Marketing Specialist。";
  }
  if (/SWOT analysis|persona analysis|建模、预测、量化分析|数据岗/i.test(text)) {
    return "你这条数据岗项目别只放 SWOT。persona analysis、建模、预测或量化分析更能证明分析师价值，也更贴近数据岗。";
  }
  if (/模型告诉了你什么|模型精度|用了什么算法|数据分析项目的核心价值/i.test(text)) {
    return "你这条数据分析项目要写洞察，不是只比模型精度。面试官更想知道模型告诉了你什么，而不是你堆了哪些算法。";
  }
  if (/简历不要求所有项目都已完成上线|发现问题|参与设计|推动自动化|流程优化意识/i.test(text)) {
    return "你这条项目不一定要完全上线。发现问题、参与设计、推动自动化这些过程也有价值，尤其能体现数据或财务岗位的流程优化意识。";
  }
  if (/Social Media Marketing|marketing\/media\/communication|平台运营经验|软技能/i.test(text)) {
    return "你这条 Social Media Marketing 不用被专业背景卡死。JD 通常较宽，真正要写的是平台运营经验和能落地的沟通协作。";
  }
  if (/真实金融场景|资产配置优化|金融科技|量化岗位|项目功能高度重叠/i.test(text)) {
    return "你这条 ML 项目要靠真实金融场景拉开差异。资产配置优化比虚构场景更有说服力，也更贴金融科技或量化岗位。";
  }
  if (/计划学习的相关模型|未来学习|ATS通过率|匹配目标岗位JD关键词/i.test(text)) {
    return "你如果列计划学习的模型，要写得像学习路线，不要包装成已掌握。它可以帮 ATS 对上 JD，也能提醒自己补技能。";
  }
  if (/MLE岗位|SDE工程能力|机器学习基础|Cloud Computing|System Design|调参工程/i.test(text)) {
    return "你这条 MLE 要同时写工程和 ML。Cloud Computing、System Design 加上调参实践，才像 MLE，不只是普通 CS 项目。";
  }
  if (/兴趣爱好栏|hiking|看电影|面试破冰|记忆点/i.test(text)) {
    return "你这栏兴趣不要只是罗列 hiking 或电影。能加具体数据或特别经历，才会变成记忆点，甚至能帮面试破冰。";
  }
  if (/设计岗位|作品集链接|设计解决方案|关键评估材料/i.test(text)) {
    return "你这条设计岗一定要有可访问作品集。招聘经理需要直接看解决方案呈现，没有链接就像少了关键评估材料。";
  }
  if (/经历数量有限|差异化价值|重复工具|相似职能|技能覆盖最独特/i.test(text)) {
    return "你这里要让每段经历服务目标岗位里的不同价值。重复工具或相似职能会占空间，保留最相关、技能覆盖最独特的经历更划算。";
  }
  if (/RAG\/LLM\/Agent项目泛滥|同质化严重|真实工作经验|核心差异化/i.test(text)) {
    return "你这条 AI 经历别只靠常见 RAG、LLM、Agent 项目。真实实习或工作经验才是差异化，要把它放成主证据。";
  }
  if (/内部意见收集|用户问卷|customer-facing|internal|同一链条/i.test(text)) {
    return "你这条可以把 internal 工作翻成 customer-facing 逻辑。意见收集、汇总、分析、解决方案，本质上和用户问卷到营销洞察是同一条 impact 链，也更可信。";
  }
  if (/医疗、银行|行业.*工具术语|大写或突出的关键词|第一印象阶段/i.test(text)) {
    return "你这里关键词要按行业换。医疗、银行这类方向偏好的工具术语不同，大写或突出词一错，第一眼就会被判不相关。";
  }
  if (/Tableau|better visualizations|具体工具名称|实际操作能力/i.test(text)) {
    return "你这条要把 Tableau 这种具体工具名写出来。better visualizations 太虚，工具关键词能让 ATS 和 HR 更快判断实操能力。";
  }
  if (/IC设计|工艺节点|团队现有flow|课程项目|专业感/i.test(text)) {
    return "你这条 IC 设计要写具体节点和工具。即使是课程项目，工艺节点也能说明你和团队 flow 的匹配度。";
  }
  if (/跨渠道.*ins.*YouTube|channel effectiveness|广告素材|严格意义上的AB测试/i.test(text)) {
    return "你这条别把跨渠道硬写成 A/B test。ins 和 YouTube 受众不同，更适合写 channel effectiveness；素材或文案测试才更接近严格 AB。";
  }
  if (/LinkedIn链接已成为北美求职简历标配|信息不透明|不够专业/i.test(text)) {
    return "你这里 LinkedIn link 是北美简历标配。缺了会让 HR 觉得信息不够透明，至少要放一个干净、可访问的链接。";
  }
  if (/极短时间内理解候选人做了什么|用了什么方法|产出了什么结果|描述散乱/i.test(text)) {
    return "你这条项目要让人很快看出做了什么、用什么方法、产出什么结果。描述散了，HR 就很难判断实际能力。";
  }
  if (/Bloomberg Market Concepts|BMC|金融行业广泛认可|入门级证书/i.test(text)) {
    return "你这条 BMC 可以补金融入门信号。缺少实际金融经验时，Bloomberg Market Concepts 至少能说明你有基础准备。";
  }
  if (/标点符号间距|格式不整洁|粗心印象/i.test(text)) {
    return "你这里要把标点和间距修干净。它不是小题大做，格式细节会直接影响 HR 对专业度和细心程度的判断。";
  }
  if (/保密客户|American auto mobile company|行业\+地区|专业又合规/i.test(text)) {
    return "你这段咨询经历可以用行业加地区来处理保密客户。像 American auto mobile company 这种写法既合规，也不会让项目显得空。";
  }
  if (/技能列表堆砌不相关工具|形同虚设|经历背书|方向不清晰/i.test(text)) {
    return "你这块 Skills 不要堆不相关工具。每个技能最好能在经历里找到背书，不然会显得方向散、可信度也弱。";
  }
  if (/NLP项目|基础NLP功能|NLP文本处理/i.test(text)) {
    return "你这条 NLP 项目要从基础文本处理往 ML 商业 insight 走。ChatGPT 之后，雇主更看重能辅助决策的分析价值。";
  }
  if (/LinkedIn上的job posting|市场需求信号|定位自身GAP|技能组合/i.test(text)) {
    return "你可以用 LinkedIn job posting 校准市场需求。它最直接反映雇主要的技能组合，也能帮你定位自己的 GAP。";
  }
  if (/工作逻辑链：分析→优化→结果|完整流程|实际能力/i.test(text)) {
    return "你这条经历要补完整工作逻辑链：分析、优化、结果。HR 看到流程闭环，才更容易判断你的实际能力。";
  }
  if (/多样化经历|不同维度的能力|重复类型的经历/i.test(text)) {
    return "你这几段经历要避免重复。每段最好展示不同能力维度，不然占了版面却没有增加信息量。";
  }
  if (/企业背调一般只验证|付费线上实习|Project形式|合规边界/i.test(text)) {
    return "你这段付费线上实习可以谨慎放成 Project。企业背调通常验证参与记录，关键是不要把它包装成正式雇佣。";
  }
  if (/background check|技能描述有一定调整空间|不会核查具体工作内容|Work Experience/i.test(text)) {
    return "你这里要先分清 Work Experience 和项目经历。技能描述可以调整，但栏位不能误导；能被 background check 的正式雇佣才适合放这里。";
  }
  if (/被动观看视频|不做作业|动手完成项目|数据分析类技能|实操内化/i.test(text)) {
    return "你这条学习经历要落到动手项目。只看视频不做作业很难证明掌握，数据分析技能尤其要靠实操和产出说话。";
  }
  if (/5秒|高亮关键词|项目标题|热门大模型技术名称|Recruiter/i.test(text)) {
    return "你这条要照顾 Recruiter 的 5 秒扫描。项目标题和高亮关键词要对上 JD，热门大模型技术名别藏在长句后面。";
  }
  if (/AB测试|A\/B测试|A\/B test|统计理解|业务判断|独立设计实验/i.test(text)) {
    return "你这条 A/B test 要写出统计理解和业务判断。能独立设计实验、解释结果，比只说做过测试更有说服力。";
  }
  if (/ratio metric|continuous metric|t-test|z-test|统计检验/i.test(text)) {
    return "你这条 A/B test 项目要把指标和检验讲清楚。ratio metric、continuous metric、t-test、z-test 这些选择逻辑就是深度。";
  }
  if (/供应链|库存分析|ABC分析|行业标准方法论|自创框架/i.test(text)) {
    return "你这条供应链分析要点名 ABC 分析。它能说明你用的是行业方法论，不是自己随便罗列问题。";
  }
  if (/商业分析.*Excel|预测建模.*ML|实验分析.*AB测试|不同技术栈对应的项目/i.test(text)) {
    return "你这份数据分析项目可以分三条线：Excel 商业分析、ML 预测建模、A/B test 实验分析。这样能覆盖不同招聘方的筛选偏好。";
  }
  if (/DS岗位竞争|招聘需求收缩|强投DS|ML背景不够深厚/i.test(text)) {
    return "你这里要现实一点看 DS 和 DA。ML 背景还不深时，DA 可能更稳；不是降低目标，而是先提高整体录取概率。";
  }
  if (/产品文档|自我保护机制|PRD|Success Metrics|点击率|页面停留时长/i.test(text)) {
    return "你这段 PM 经历要把 PRD 和 Success Metrics 写出来。点击率、停留时长这类指标能说明你不是只写文档，而是在做数据驱动产品。";
  }
  if (/相关课程列表|ATS关键词匹配|课程项目|工作经验不足/i.test(text)) {
    return "你这条 Education 可以把相关课程和课程项目放清楚。经验还少时，它们能补 ATS 关键词，也能弥补工作经历不足。";
  }
  if (/加粗词汇|关键词密度|一条没有可加粗关键词/i.test(text)) {
    return "你这条 bullet 要先想清楚哪些词值得加粗。关键词密度比条数更重要，一条没有核心词的 bullet 真的可以删。";
  }
  if (/CDN|CloudFront|Cloudflare|S3|对象存储|静态资源/i.test(text)) {
    return "你这条工程项目要写 CDN 和对象存储。CloudFront、Cloudflare、S3 这类实践能让项目更像真实生产环境。";
  }
  if (/Tesla|前30%|OA机会|知名公司.*实习经历/i.test(text)) {
    return "你这段 career fair 策略要保留 Tesla 这类公司信号。entry level 先做到前 30% 拿 OA，比追求完美经历更现实。";
  }
  if (/AI\+控制|传统背景|深度技术理解|主动追问/i.test(text)) {
    return "你这条 AI 加控制的结合点要写清楚。它会引导面试官追问技术深度，也能和只有传统控制背景的人拉开差距。";
  }
  if (/Data vs Risk|Data.*Risk|Risk.*Data/i.test(text)) {
    return "你这里 Data 和 Risk 要拆版本。关键词和侧重点不同，硬塞在同一版里会让两个方向都不够准。";
  }
  if (/(LinkedIn 还是官网|官网投递|敲门砖).*(关键词匹配|初步筛选)|关键词匹配.*(LinkedIn|官网|敲门砖)/i.test(text)) {
    return "你这里不要只想投递渠道。LinkedIn 或官网都会先看关键词匹配，简历这块敲门砖要先对上岗位门槛。";
  }
  if (/一页简历|行业普遍标准|经验年限较短|内容过多/i.test(text)) {
    return "你这份简历先守住一页。经验还不长时，内容过多反而会稀释重点，一页是为了让 HR 更快抓到核心。";
  }
  if (/Times New Roman|Cambria|视觉疲劳|可读性/i.test(text)) {
    return "你这里字体别小看。Times New Roman 太方正容易疲劳，Cambria 在专业感和可读性之间通常更稳。";
  }
  if (/DA简历|行业通用工具|最大化ATS匹配率/i.test(text)) {
    return "你这条 DA 简历要先放行业通用工具和能力关键词。它们会在多份 JD 里反复出现，能最大化 ATS 匹配率。";
  }
  if (/end-to-end.*ML pipeline|data processing|feature engineering|modeling|evaluation/i.test(text)) {
    return "你这条 end-to-end ML pipeline 要保留完整链路。data processing、feature engineering、modeling、evaluation 都写到，才像能对标多个 JD。";
  }
  if (/成果数字和业务影响|结果埋在句尾|量化结果前置/i.test(text)) {
    return "你这条要把量化结果前置。成果数字和业务影响埋在句尾，很容易被扫过去，先给结果会更抓眼。";
  }
  if (/Meta Ads|付费广告|有机内容运营|独立操作广告账户/i.test(text)) {
    return "你这段数字营销要突出 Meta Ads 和 ROI。哪怕预算小，只要能证明独立操作广告账户，也比泛泛内容运营更有分量。";
  }
  if (/70%|30%|40%|异常高的指标提升|深度追问实现路径/i.test(text)) {
    return "你这条数字别贪大。70% 这类异常提升会引来追问，30%-40% 这种合理区间反而更容易被相信。";
  }
  if (/字体过小|10.?11号|过于拥挤|字号联动/i.test(text)) {
    return "你这里要把正文字号稳在 10-11 号附近。内容多时别硬挤，字号和信息量要一起调整。";
  }
  if (/verify functional correctness|functional correctness.*95|处理速度|细节密度/i.test(text)) {
    return "你这条技术项目要靠细节密度取胜。与其写 verify performance，不如写 functional correctness 95% 和处理速度这类具体结果。";
  }
  if (/项目缺少时间标注|时间范围|经验深度|时间线/i.test(text)) {
    return "你这条项目要补时间范围。HR 会用时间线判断经验深度，缺日期会让整段信息看起来不完整。";
  }
  if (/数据处理和可视化能力|单纯的开发经历|方向单一/i.test(text)) {
    return "你这份数据分析简历不能只像开发经历。要补数据处理和可视化能力，让方向不只停在写代码。";
  }
  if (/供应链或运营细节|可量化的竞争优势|相对表现/i.test(text)) {
    return "你这条供应链或运营经历要把平淡操作翻成可量化优势。HR 更看结果和相对表现，不会只因为流程细节买单。";
  }
  if (/直播运营|规划与复盘|助播协调|上架顺序|运营思维/i.test(text)) {
    return "你这段直播运营要写规划和复盘。只写助播协调、上架顺序，会被看成基础执行，而不是有运营思维。";
  }
  if (/SQL查询|跨数据库|revenue、company size|company size|业务字段/i.test(text)) {
    return "你这条 SQL 经历要保留跨数据库和业务字段。revenue、company size 这类字段能证明你理解业务，不只是机械写查询。";
  }
  if (isSdeToneContext(context) && /SWE岗位|ML系统|Gemini|图像类和语言类模型|AI应用/i.test(text)) {
    return "你这条 SWE 经历可以写和 ML 系统整合。像 Gemini、图像模型、语言模型这些接口理解，会让 SWE 背景更有加分点。";
  }
  if (/传统ML|GenAI|区分.*能力|扎实的技术背景/i.test(text)) {
    return "你这条 AI 面试准备要讲清传统 ML 和 GenAI 的差异。能说明两者边界，比只列 AI 关键词更像技术底子扎实。";
  }
  if (/母简历|收录所有经历|最匹配的子集|多目标岗位|多份简历版本/i.test(text)) {
    return "你可以保留一份母简历收全经历，再按每个 JD 选最匹配的子集。这样不是多写几份，而是让每版更对焦。";
  }
  if (/持续迭代|不同阶段.*不同JD|掌握方法论|一次性修改成果|长期价值/i.test(text)) {
    return "你这里要把求职当成持续迭代。不同阶段按 JD 调整简历，重点是掌握方法论，不是只追求一次性改完。";
  }
  if (/模型做了什么|结果如何|最基本的逻辑|写上去就代表你懂|面试官追问/i.test(text)) {
    return "你这条 JD 里的模型关键词写上去就要能讲清楚。至少要说明模型做了什么、结果如何，不然面试追问时可信度会掉。";
  }
  if (/官方职位名称|reframing|重新框架|岗位叙事/i.test(text)) {
    return "你这里不要被官方 title 卡住。把实际工作内容重新框到 target role 和岗位语言里，ATS 和 HR 才更容易看出你为什么相关。";
  }
  if (/Experience栏默认代表正式雇佣关系|混入课程项目|实际工作经验产生误判/i.test(text)) {
    return "你这里要先分清 Experience 和课程项目。Experience 默认是正式雇佣或实习，课程项目混进去会让人误判你的实际工作经验。";
  }
  if (/background check|正式雇佣|非正式实习|Work Experience栏|信任风险/i.test(text)) {
    return "你这里要先分清 Work Experience 和项目经历。能被 background check 的正式雇佣才适合放这里，非正式实习放错栏位会有信任风险。";
  }
  if (/第一眼就判断出.*目标方向|标题、Summary、技能顺序|共同服务于同一个岗位定位/i.test(text)) {
    return "你这份简历开头要先把目标方向立住。标题、Summary、技能排序和前几条经历要服务同一个岗位，不然第一眼会被读散。";
  }
  if (/circuit design|logic design|硬件工程|同一份简历广泛投递/i.test(text)) {
    return "硬件方向这里要分清 circuit design 和 logic design。不是一定要拆两版，而是先把 circuit design 这条线写准，再集中投同类岗位。";
  }
  if (/Analytics岗位|Tableau.*Excel.*SQL|月度dashboard|行业标配技能/i.test(text)) {
    return "Analytics 岗这里要保留 Tableau、Excel、SQL 和 dashboard 这组信号。它们是行业标配，不是装饰词，简历里要接到具体分析场景。";
  }
  if (/顶级投行|投行实习|orientation|收尾presentation|1\s*[-–~至到]\s*2\s*周|实际动手时间极短/i.test(text)) {
    return "你这段投行实习不要只靠公司名气。orientation 和收尾 presentation 各占 1-2 周时，真正动手时间有限，更要把做过的市场分析讲清楚。";
  }
  if (/转码|项目来源渠道|技术覆盖度|全栈|功能实现|技术选型/i.test(text)) {
    return "转码项目这里别纠结项目从哪里来。真正要写清楚的是全栈覆盖、功能实现和技术选型，面试时也要能顺着细节讲出来。";
  }
  if (/RAG|policy文档|内部员工查询|业务场景|用户痛点/i.test(text)) {
    return "你这条 RAG 项目要先写业务场景。帮内部员工查询 policy 文档，比只说做了 RAG 系统更像真实需求，也更容易让人相信项目价值。";
  }
  if (/每个步骤的具体实现方式|技术细节写清楚|通过ATS|基础问题|系统性思维/i.test(text)) {
    return "你这条技术项目要写到能对上目标 JD、也能被追问。把实现方式、技术细节和 ATS 关键词放清楚，面试时才不会卡在基础问题上。";
  }
  if (/仅描述参与行为|参与行为的bullet|结构化的分析过程|实际能力与思维方式/i.test(text)) {
    return "你这条别只写参与了什么。把分析过程拆出来，写清楚你怎么判断、怎么推进，能力才不会停在参与感。";
  }
  if (/纯点选|下载|导出|机械操作|操作步骤|分析过程|业务价值/i.test(text)) {
    return "这条别停在点选、下载、导出这些操作。要把分析过程和业务价值写出来，不然技术含量会被读得很低。";
  }
  if (/publication|同一项目|同一研究|不同产出|整合在同一条目|单独列项/i.test(text)) {
    return "同一个研究的过程和 publication 可以合在同一条下面。这样既省版面，也能让成果和你做的研究自然连在一起。";
  }
  if (/market方向实习生|marketing research|统计分析类课程|课程名称不完全对口/i.test(text)) {
    return "你如果投 market 方向实习，课程也可以补信号。marketing research 或统计分析课即使不完全对口，也比课程栏完全空白更有说服力。";
  }
  if (/课程顺序|不同职能方向|GPA和相关课程|学术实力与岗位匹配度/i.test(text)) {
    return "你这条 Education 可以更有方向感。GPA 和相关课程要保留，课程顺序也可以按目标职能和 JD 调整，让匹配度更快被看见。";
  }
  if (/低 GPA|不写不会被追问|写出反而形成减分|教育背景中少数可量化/i.test(text)) {
    return "你这里的 GPA 要现实处理。高 GPA 可以当硬信号，低 GPA 不一定要写出来；不写通常不会被追问，硬放反而先扣印象分。";
  }
  if (/education是招聘方筛选的第一要素|work experience权重次之|Education放顶部|金融行业应届生|target school/i.test(text)) {
    return "金融应届生简历里，Education 放前面是合理的。target school 和 GPA 会先帮你建立背景信号，工作经历再往下接。";
  }
  if (/GPA|target school|高 GPA|低 GPA|Education放顶部|金融行业应届生|教育背景中少数可量化/i.test(text)) {
    return "应届生这里要认真处理 Education。target school 和高 GPA 是少数能快速被读懂的硬信号，低 GPA 不写通常比硬放更稳。";
  }
  if (/线性回归|基础ML|ML技能|ATS机筛|模型逻辑|口头解释模型/i.test(text)) {
    if (isMlToneContext(context)) {
      return "MLE 简历这里要把模型证据写实。模型名称、任务、评估指标和你能解释的基本逻辑要对上，不然 ATS 过了也容易在面试被追问卡住。";
    }
    return "数据分析岗位这里要补基础 ML 信号。线性回归这类模型、项目证据和口头解释能力都要对上，不然 ATS 和面试都会吃亏。";
  }
  if (/BA简历|每一条bullet point|紧扣岗位JD|稀释简历焦点|定位不清晰/i.test(text)) {
    return "你这条 BA bullet 要紧扣 JD。和目标岗位不匹配的技术内容别乱放，不然焦点会被稀释，定位也会显得不清楚。";
  }
  if (/动词的选择|ownership等级|based on|主导者还是执行者|精准动词/i.test(text)) {
    return "这条要把动词换准。像 based on 这种模糊说法会让人分不清你是主导还是执行，精准动词能更快说明 ownership。";
  }
  if (/environment artist|环境模型|关卡布局|行业标准术语|专业方向/i.test(text)) {
    return "游戏行业这里要用标准 title。environment artist 能直接说明环境模型和关卡布局方向，比自己造一个模糊名称更容易被识别。";
  }
  if (/Ray专注于非结构化数据|OpenAI|阿里巴巴|腾讯|百度|字节|学校几乎不教|求职市场稀缺/i.test(text)) {
    return "Ray 这里要写得更具体。它和文本、图片、音频、视频这类非结构化数据的分布式计算有关，放出来会比泛 AI 技能更稀缺。";
  }
  if (/LoRA|Stable Diffusion|inpainting|完整模型名称|具体工具或模型/i.test(text)) {
    return "你这条 AI 项目不要只说模型。LoRA、Stable Diffusion v2 inpainting 这种完整模型名要写出来，读起来才像真的动手做过。";
  }
  if (/跨方向投递|数据分析类岗位ATS|直接被系统过滤/i.test(text)) {
    if (isMlToneContext(context)) {
      return "MLE 版本要优先让 Python、Machine Learning、模型评估和项目证据有真实落点；关键词只放在 Skills 里，还不够像能进组做事。";
    }
    return "你跨方向投递时，关键词要按岗位版本调整。数据分析版至少要让 Python、SQL、Machine Learning 这些 ATS 高频词有真实落点。";
  }
  if (/金融数据类岗位JD|所需工具|ATS会匹配关键词|面试前针对性复习/i.test(text)) {
    return "金融数据岗这里可以先按 JD 补工具关键词。ATS 会先看这些词，JD 没提的通常不用抢版面，面试前再针对性复习更有效。";
  }
  if (/广告预算|awareness|触达量|转化类|渠道\/KOL|带单量|投放衡量/i.test(text)) {
    return "广告投放这条要按目标选指标。awareness 看触达，转化类看渠道或 KOL 带单量，不同预算和目标不能用同一套数字讲。";
  }
  if (/教育游戏|游戏行为数据|学习路径|用户留存|Google Analytics/i.test(text)) {
    return "教育游戏这条要把 Google Analytics 接到游戏行为数据。重点是怎么用数据优化学习路径和留存，而不是只写通用分析能力。";
  }
  if (/超链接在PDF|纯文本URL|行间距过大|full-time|写满一页|精准点击|复制/i.test(text)) {
    return "这条格式建议很具体：PDF 里链接要方便复制，行间距别撑得太空。full-time 简历最好写满一页，但不要牺牲可读性。";
  }
  if (/计划课程|选课记录|在读生|列出计划课程|常见且合理/i.test(text)) {
    return "你如果还在读，可以列计划课程，但要写得克制。它的作用是补目标岗位匹配度，不是把还没学完的内容包装成经验。";
  }
  if (/错落有致|过于密集|过于稀疏|适中的行长|版面整洁/i.test(text)) {
    return "你这里要调的是阅读节奏。行长、密度和留白要稳定，太挤或太散都会让重点经历变难读。";
  }
  if (/结果和影响前置|浏览简历时间极短|快速筛掉|抓住阅读者眼球/i.test(text)) {
    return "你这条要先把结果和影响放前面。HR 没时间慢慢找亮点，第一眼看不到成果就容易被快速略过。";
  }
  if (/敲门砖|第一印象直接决定|屡屡碰壁|不断试错和反馈/i.test(text)) {
    return "你这里别把碰壁解读成材料没救。简历本来就是反复试出来的，先用反馈去改最影响第一印象的地方。";
  }
  if (/跑了多少地点|采访了多少用户|量化执行细节|早期经历|工作规模和影响力/i.test(text)) {
    return "你这类早期经历也能量化。跑过多少地点、访谈多少用户、覆盖多大范围，这些朴素数字都能把执行量讲清楚。";
  }
  if (/冗余形容词|主观评价性形容词|证明能力|信息的密度|空间有限/i.test(text)) {
    return "你这条可以先删形容词。简历空间有限，少写主观评价，多写能证明能力的动作、工具和结果。";
  }
  if (/美国本地经历|课程project|实验室research project|纯上课经历|不写等于白上/i.test(text)) {
    return "你如果是在读研究生，美国本地项目别空着。课程 project 分量有限，但实验室 research project 更能补本地经历信号。";
  }
  if (/writing tutor|writing sample|辅导人数|成绩提升/i.test(text)) {
    return "你这段 writing tutor 不是普通经历。可以补 writing sample、辅导人数或成绩提升，让写作能力从默认印象变成可验证证据。";
  }
  if (/ensure quality|3倍以上|纯描述型.*3倍|引导讨论到候选人熟悉/i.test(text)) {
    return "你这条别只写 ensure quality。换成可验证的结果或数字，面试时也更容易把讨论带到你熟悉的部分。";
  }
  if (/工作经历置顶|教育背景置顶|职业人身份|经验不足|结构顺序本身传递信息/i.test(text)) {
    return "你这里要用板块顺序表达身份定位。有经验就让工作经历先说话，应届或经验少时再让教育背景承担第一眼信号。";
  }
  if (/结构化流程|主动构思底稿|针对性批注|被动等待导师全部代劳|内化反馈/i.test(text)) {
    return "你这里要先把修改流程想清楚。先自己搭底稿、再带着问题看反馈，比等别人逐句改更能把建议真正内化。";
  }
  if (/版本管理|通用版随时可发|定制版提高匹配度|草稿版|未完成内容/i.test(text)) {
    return "你这里要把版本管理做好。通用版可以随时发，定制版再按岗位改；带批注或未完成内容的草稿绝对不要外发。";
  }
  if (/结果和价值|完整的历史叙述|最终成果中的贡献|过程中的曲折/i.test(text)) {
    return "你这条要从历史叙述改成结果和价值。过程有多曲折不用全写，重点是你对最终成果贡献了什么。";
  }
  if (/VaR|Monte Carlo|风险计量|完整分析链条/i.test(text)) {
    return "金融风险这条别被泛技能带走。VaR、Monte Carlo 和对应工具要放进完整分析链条里，才像真的懂风险计量。";
  }
  if (/system design|第二条求职赛道|重新框架包装|无需额外积累经验/i.test(text)) {
    return "你已有的 system design 内容可以开第二条线。重点不是重新攒经历，而是把现有经历框成系统设计能力。";
  }
  if (/Strategy模式|Factory模式|接口\+实现|SWE标配|大量生产实践/i.test(text)) {
    return "你这栏技能可以放基础设计模式。Strategy、Factory 这类软件工程标配知识不一定要有大量生产实践，但要理解原理、能讲清楚。";
  }
  if (/LinkedIn的experience描述|猎头评估|主页吸引力|主动联系|简单的职位名称/i.test(text)) {
    return "你这里要补 LinkedIn experience，不只是放职位名。猎头会看主页里的经历描述，空白会降低被主动联系的机会。";
  }
  if (/角色定位|逐条阅读小点才能判断职责|理解成本|优先寻找.*角色/i.test(text)) {
    if (/可量化的产出|实际影响力|impact|空洞的任务罗列/i.test(text)) {
      return "你这条项目要同时交代角色、量化产出和 impact。只写任务会很空，先说你负责哪一块，再补结果和影响。";
    }
    return "你这条项目要先把角色定位写出来。别让别人读完整段才猜到你负责什么，第一句就要交代你的职责边界。";
  }
  if (/描述的粒度|太粗泛|太细|能反映关键能力|快速理解/i.test(text)) {
    return "你这条要控制描述粒度。太粗看不出专业度，太细又读不动，写到能判断核心能力就够。";
  }
  if (/各板块的分类|无关的经历|分散阅读注意力|整体相关性评分/i.test(text)) {
    return "你这里要先分清板块和相关性。无关经历不是中性信息，放错位置会分散注意力，也会拖低整体匹配感。";
  }
  if (/identify anomalies\/trends|identify anomalies|anomalies\/trends|真实案例|贴合JD关键词/i.test(text)) {
    return "JD 写 identify anomalies 或 trends 时，简历里要接真实案例。别只复述关键词，要写你识别了什么异常或趋势、怎么判断的。";
  }
  if (/Bar执照|学历存在劣势|Education移至末尾|顶部信息不具竞争力/i.test(text)) {
    return "你这里不是要突出学历，而是把更有说服力的 Bar 执照前置。Education 如果会拖第一印象，可以往后放一点。";
  }
  if (/业务决策支持|分析结果转化为业务决策|跨团队协作经历|soft skill与业务影响力/i.test(text)) {
    return "数据岗这条要把分析结果怎么支持业务决策写出来。跨团队协作不是软技能口号，要接到具体决策、影响或落地动作。";
  }
  if (/咨询公司|不区分行业|竞争激烈|不宜过度筛选|Niche/i.test(text)) {
    return "咨询投递这里别过度筛公司。多数非 niche 咨询公司不先分行业，能拿到面试本身就不容易，简历先保持通用咨询能力清楚。";
  }
  if (/RTL设计|Physical Design|Synthesis|芯片公司|Skyworks/i.test(text)) {
    return "芯片岗位这里要先聚焦方向。RTL、Physical Design、Synthesis 是不同准备路径，简历和面试重点别在几条线之间来回跳。";
  }
  if (/产品说明书|个人贡献|功能列表|描述语气模糊|个人成就/i.test(text)) {
    return "作品集或项目描述别写成产品说明书。重点是你的个人贡献、判断和产出，不是把产品功能列表搬上来。";
  }
  if (/实习经历.*可验证|易回答的技能点|2个核心技能维度|展开作答/i.test(text)) {
    return "你这段实习经历可以收成 2 个核心技能维度。重点是可验证、面试时答得出来，而不是把日常工作零散铺开。";
  }
  if (/官方职位名称|reframing|重新框架|岗位叙事/i.test(text)) {
    return "你这里不要被官方 title 卡住。把实际工作内容重新框到 target role 和岗位语言里，ATS 和 HR 才更容易看出你为什么相关。";
  }
  if (/SDE岗位|编程语言只是基础门槛|framework|数据库|云服务|我会说中文/i.test(text)) {
    return "你这条 SDE 技能栏别只停在编程语言。语言是门槛，framework、数据库和云服务才是 ATS 关键词和真实开发能力。";
  }
  if (/Web GIS|GIS就业市场|GIS岗位|缺少该技能/i.test(text)) {
    return "你如果看 GIS 岗位，Web GIS 要放出来。现在很多 GIS 招聘会直接找这类能力，缺了它竞争力会明显弱一截。";
  }
  if (/sustainability|ESG|city officials|residents|外部方协作|stakeholder场景/i.test(text)) {
    return "ESG 这条别只写技术能力。city officials、residents 这些外部 stakeholder 要写出来，才像真实协作场景。";
  }
  if (/第一个bullet point|第一句话抓到重点|定锚|快速扫描/i.test(text)) {
    return "你这条第一条 bullet 要有定锚作用。HR 快速扫时，第一句话抓不到重点，后面的亮点就很容易被低估。";
  }
  if (/部署平台|端到端系统|工程化能力|模型\/脚本实际落地|实际落地/i.test(text)) {
    return "端到端项目这里要补部署平台。它能证明你不只是写模型或脚本，而是有把东西实际落地的工程化能力。";
  }
  if (/Web相关的岗位数量|C\+\+等额外技术栈|机会池|增加投递数量/i.test(text)) {
    return "你可以把 Web 当成主机会池，同时把 C++ 这类额外技术栈当成第二入口。这样不是乱投 JD 关键词，而是扩大可匹配岗位数量。";
  }
  if (/Risk部门|市场风险|信用风险|中台风控|金融量化|分析类专业/i.test(text)) {
    return "金融 Risk 这条赛道可以认真看。市场风险、信用风险、中台风控细分很多，也和量化或分析背景更容易接上。";
  }
  if (/金融风险管理|MFE|量化模型|模型关键词|技术背景/i.test(text)) {
    return "你这条金融风险/MFE 要把量化模型写清楚。招聘方会用模型关键词判断技术底子，别只写风险方向兴趣。";
  }
  if (/Nielsen|大型快消|market research|心理学|社会学|受众细分|消费行为洞察/i.test(text)) {
    return "你可以把快消 market research 当成切入口。Nielsen 这类第三方数据公司会看心理学、社会学背景和受众洞察能力。";
  }
  if (/physical design|bring up|板级测试|纯嵌入式|软硬件调试|芯片组/i.test(text)) {
    return "嵌入式这里要按目标公司拆信号。偏芯片组就写 physical design，偏软硬件调试就突出 bring up 和板级测试。";
  }
  if (/recommendation|SQL monkey|Excel monkey|策略思维|分析师越往后/i.test(text)) {
    return "你这条分析师经历不能只停在 SQL 或 Excel 操作。能写出 recommendation 和策略判断，才会和机械执行型分析拉开差距。";
  }
  if (/课程顺序|不同职能方向|GPA和相关课程|学术实力与岗位匹配度/i.test(text)) {
    return "你这条 Education 可以更有方向感。GPA 和相关课程要保留，课程顺序也可以按目标职能和 JD 调整，让匹配度更快被看见。";
  }
  if (/强行动动词|participate|主动性|主导角色|边缘角色/i.test(text)) {
    return "这条 bullet 要先换强动词。participate 会让人觉得你在边缘位置，动词要更准确地说明你主导或推进了什么。";
  }
  if (/deal经验|purchase price|交易类型|交易规模|真实deal/i.test(text)) {
    return "你这段金融 deal 经历要把 purchase price 和交易类型写出来。即使只是初级参与，这些细节也能快速提升可信度。";
  }
  if (/结构化自我梳理|口头叙述|完整还原|筛选提炼|遗漏亮点/i.test(text)) {
    return "你这里可以先用口头叙述把经历还原完整。再筛选亮点写进简历，比一开始就硬憋 bullet 更容易写出质量。";
  }
  if (/净资产乘以行业调节系数|信用评级得分|金融信贷|风险量化评估|具体评估维度/i.test(text)) {
    return "金融信贷这条要写具体评估维度。净资产乘以行业调节系数、信用评级得分这类细节，比泛泛参与风险评估更有说服力。";
  }
  if (/共性技能栈|特性工具要求|SQL|Python|初筛通过率/i.test(text)) {
    return "关键词这里要分层写。SQL、Python 是共性技能，特定工具要按 JD 补；这样 ATS 和 HR 都更容易判断匹配度。";
  }
  if (/Power BI.*Office|PL300|微软官方认证|管理层.*可视化|高性价比/i.test(text)) {
    return "Power BI 这条要保留 PL300 和 Office 生态优势。它不是单纯工具名，而是管理层看得懂、认证成本也相对划算的信号。";
  }
  if (/Marketing岗位面试|叙事能力|自圆其说|逻辑清晰|经历包装/i.test(text)) {
    return "Marketing 面试更吃叙事和逻辑。经历可以包装，但要能自圆其说，故事线清楚比硬塞技术指标更重要。";
  }
  if (/个人博主|自媒体运营|非传统雇主|填补简历.*空白|marketing能力/i.test(text)) {
    return "个人博主或自媒体经历可以包装成 marketing 项目。重点是写出受众、内容策略和结果，让它补上这个方向的经历空白。";
  }
  if (/学校白名单|工作年限|匹配权重|泛化技能堆砌|针对性版本/i.test(text)) {
    return "ATS 不只看关键词数量，也可能看学校、年限和方向权重。技能别泛泛堆，针对性版本会让每个方向的匹配信号更集中。";
  }
  if (/证书不是越多越好|基础证书|资历浅薄|稀缺或高度相关/i.test(text)) {
    return "证书这里不是越多越好。基础证书堆太多反而显得浅，真正值得放的是稀缺、和目标岗位高度相关的认证。";
  }
  if (/学术研究项目|hire manager|1-2个项目|同类技能项目|高质量项目/i.test(text)) {
    return "学术项目别并排堆太多同类内容。HR 通常不会逐条细看，挑 1-2 个质量最高、最能展开的项目会更有记忆点。";
  }
  if (/CFA\+买方|sell side|买方经验|跳板/i.test(text)) {
    return "你这条职业轨迹要解释清楚。CFA 加买方经验对 sell side 可能被读成跳板心态，要提前降低这个疑虑。";
  }
  if (/职位title|多种不一致|两个方向都拿不到面试|关键词和title针对性替换/i.test(text)) {
    return "简历里 title 不一致会让 HR 和 ATS 都不知道你到底投哪条线。多版本可以共用内容，但 title 和关键词要按方向替换。";
  }
  if (/V-Model|需求分析到测试验证|测试验证|机械\/系统工程|专业性/i.test(text)) {
    return "机械/系统工程这条要把 V-Model 链条写出来。从需求分析到测试验证都能对上，专业可信度会比只写单点任务高。";
  }
  if (/市场主流|格式与市场主流不一致|违和感|找不到关键信息|格式统一/i.test(text)) {
    return "格式这里要贴近市场主流。不是为了好看，而是避免 HR 第一眼产生违和感、找不到关键信息，影响进入实质筛选。";
  }
  if (/逻辑连贯的bullet|系统性思维|零散的描述|强逻辑岗位/i.test(text)) {
    return "这几条 bullet 要连成一条逻辑线。数据分析这类强逻辑岗位，很怕零散描述，看起来会像缺少系统性思维。";
  }
  if (/Business Context|练习作业|实际价值的分析案例|Tableau\/SQL|商业背景/i.test(text)) {
    return "Tableau 和 SQL 不能只像练工具。要补 Business Context，让项目从练习作业变成有实际价值的分析案例。";
  }
  if (/学习过程|提及mentor|学生作业|实战经验|成果与行动/i.test(text)) {
    return "这条要从学习过程改成成果和行动。mentor 可以不用强调太多，不然 HR 容易读成学生作业，而不是实战经验。";
  }
  if (/编程语言熟练度|技术面试筛选|投入产出比/i.test(text)) {
    return "技术岗准备这里很现实：刷题和编程语言熟练度直接影响能不能过技术面试筛选。简历可以写能力，但基本功也要跟上。";
  }
  if (/component描述|真正参与了开发|实际贡献深度|泛泛而谈/i.test(text)) {
    return "技术项目这里要把 component 写具体。越能说清楚你参与了哪个组件、做了什么，越不像泛泛蹭项目。";
  }
  if (/Google Analytics|SQL和Python|无需手动下载CSV|电商数据分析|标准工作流/i.test(text)) {
    return "电商数据分析这条要保留 Google Analytics、SQL 和 Python 的工作流。它说明你不是手动拉 CSV，而是在用标准工具组合分析用户行为。";
  }
  if (/skill section前置|skill section 前置|更快捕捉到关键技术关键词|提升简历通过率/i.test(text)) {
    return "你这里可以把 Skills 往前放一点。技术类或数据岗初筛会先扫关键技术词，前置不是炫技，是帮 HR 和 ATS 更快确认匹配。";
  }
  if (/skill与project|skill 与 project|工具本身.*Tableau.*SQL|完整分析流程|项目栏/i.test(text)) {
    return "你这里要分清 Skills 和 Project。Tableau、SQL 是工具；只有带完整分析流程和结果的课程项目，才适合放进项目栏。";
  }
  if (/口头语言能力|语言能力|多种语言|跨文化沟通/i.test(text)) {
    if (/口头语言能力|无需单独列出|填充内容/.test(text)) {
      return "你这条 Skills 要精简。技术和产品岗更看技术栈熟练度，口头语言能力通常面试会自然体现，单独列太多反而像填充。";
    }
    return "你这条语言能力可以保留，但要放在合适位置。跨文化沟通相关岗位会加分，重点是写完整、别和核心技能抢版面。";
  }
  if (/多版本策略|单一简历|多个方向|投递覆盖面|版本越针对性/i.test(text)) {
    return "你不是要靠一份简历打所有岗位。多版本的价值是让每版关键词和项目侧重都更贴目标方向，覆盖面会更大也更清楚。";
  }
  if (/headcount|budget|电话screening|员工提离职|发布.*JD|周期.*数周|周期.*数月/i.test(text)) {
    return "你要知道一个职位从 headcount、budget 到 JD 发布和 screening，本来就可能拖几周甚至几个月。投递节奏要按流程周期规划，不要只看岗位刚发没发。";
  }
  if (/SQL入门|SQL是基础筛选项|SQL.*ATS匹配率|基础操作/i.test(text)) {
    return "SQL 这条要写成基础筛选项，不只是兴趣技能。数据相关岗位少了 SQL，ATS 和 HR 都会更难判断你够不够基本门槛。";
  }
  if (/上半屏|前5秒|Skills区紧跟Education|专业背景\+技能匹配|视线停留/i.test(text)) {
    return "你这里可以利用简历上半屏。Skills 紧跟 Education 能形成专业背景加技能匹配的第一眼信号，让 HR 前 5 秒先读到重点。";
  }
  if (/银行类岗位|SaaS关键词|行业证书|低成本补充证书/i.test(text)) {
    return "银行类岗位这条别只写泛技能。SaaS 关键词和行业证书对 HR/ATS 都比较敏感，低成本能补的证书可以优先补上。";
  }
  if (/技能列表应与目标岗位高度匹配|删除无关技能|减少ATS误判|无关技能/i.test(text)) {
    return "你这栏 Skills 要做减法。保留和 JD 直接相关的技能，删掉弱相关项，HR 才能更快看出岗位契合，也能减少 ATS 误判。";
  }
  if (/跨行业|消费品|快消|电商运营逻辑|行业壁垒/i.test(text)) {
    return "你如果转 Marketing，行业选择要现实一点。电商运营逻辑比较通用，消费品或快消又贴近背景，会比硬跨到高壁垒行业更稳。";
  }
  if (/workflow自动化|时间节省|百分比|可衡量改进|工具使用描述/i.test(text)) {
    return "这条别停在用了什么工具。workflow 自动化最好写出节省了多少时间或提升了多少效率，业务价值会比工具名更有说服力。";
  }
  if (/used Excel|Excel.{0,20}功能|工具类描述|实际分析能力/i.test(text)) {
    return "你这条 Excel 不能只写 used Excel。要写清楚用了什么功能、做了什么分析，工具名才会变成数据分析能力的证据。";
  }
  if (/PRD|Figma|产品类岗位|产品工作方式|执行力/i.test(text)) {
    return "你这段 PM 经历要把 PRD、Figma 和跨团队协作写成具体工作方式。工具不是重点，重点是它们证明你真的按产品流程推进过。";
  }
  if (/模糊的action|follow-up|用了什么工具|怎么分析|framework|结构化思维/i.test(text)) {
    return "你这条要先把 action 写具体。工具、分析方法、framework 这些细节自己先讲清楚，面试追问时才不会被动。";
  }
  if (/两分钟|2分钟|快速glance|第一条bullet|high level understanding|准备问题/i.test(text)) {
    return "你要假设面试官开场只会快速 glance 两分钟。第一条 bullet 先给结论，后面再用关键词和数字帮对方形成 high level understanding。";
  }
  if (/学校合作|实习项目|企业项目经验|自主投递外部实习/i.test(text)) {
    return "学校合作的实习项目可以写得更有策略。它不只是机会来源，更能证明你有真实企业项目经验，比空泛投递经历更有说服力。";
  }
  if (/数据设计决策|收集什么数据|从哪里获得|业务理解力|差异化亮点/i.test(text)) {
    return "数据项目别只写用了什么工具。收集什么数据、从哪里来、为什么这样设计，反而更能体现你的业务理解力。";
  }
  if (/付费引流|Google Ads|社媒广告|网红营销|influencer marketing/i.test(text)) {
    return "电商 marketing 可以先抓两个方向：付费引流和 influencer marketing。Google Ads、社媒广告这些实操信号，比泛泛写 marketing 更清楚。";
  }
  if (/工具\/方法 \+ 行动|streamlined X process|可解释的成果|bullet point应遵循/i.test(text)) {
    return "这条 bullet 可以按工具/方法、行动、结果来写。即使没有百分比，也要用 streamlined process 这类真实、可解释的成果撑住。";
  }
  if (/PE行业|AUM|平台层级|公司规模的核心指标/i.test(text)) {
    return "你这条 PE 经历要把 AUM 补出来。AUM 是判断平台层级的核心指标，缺了它，HR 会很难快速理解这段经历的分量。";
  }
  if (/scalable|production-grade|high-performance|技术形容词|具体技术栈|抽象描述/i.test(text)) {
    return "你这里别只放 scalable、production-grade 这类形容词。要用具体技术栈、关键词、数据或实现细节撑住，不然面试一追问会很虚。";
  }
  if (/A\/B test|z-score|hypothesis testing|statistical analysis|统计方法/i.test(text)) {
    return "你这条数据分析经历要把统计方法写具体。A/B test、z-score、hypothesis testing 要对上 JD，比泛泛写 statistical analysis 更能同时过 ATS 和技术筛选。";
  }
  if (/职位池|DA\/Marketing\/PM|投科技公司|咨询公司|灵活组合经历/i.test(text)) {
    return "你可以把科技行业当成更大的职位池。同一技能背景能拆成 DA、Marketing、PM 等版本，但每版都要只服务一个方向。";
  }
  if (/新增用户数|销售增长|识别率提升|impact|实际贡献|量化指标/i.test(text)) {
    return "你这条要把 impact 放到最前面。新增用户、销售增长、识别率提升这类数字，能让 HR 更快判断你的实际贡献。";
  }
  if (/partner with stakeholder|业务-数据|桥接能力|DA\/BI|转化逻辑/i.test(text)) {
    return "你这条不能只写 partner with stakeholder。要把业务问题怎么转成数据分析讲清楚，这才是 DA/BI 岗很在意的桥接能力。";
  }
  if (/analyst类岗位|data analyst|business analyst|product analyst|单一title|广撒网投递/i.test(text)) {
    return "你不用被单一 title 卡住。Data analyst、business analyst、product analyst 在互联网公司核心技能很接近，可以广撒网但简历版本要对焦。";
  }
  if (/全部技能准备齐全|错失机会|缺口技能|投递过程中持续补充|高度匹配/i.test(text)) {
    return "你不用等技能全满才开始投。先投高度匹配的岗位，缺口技能边投边补，机会窗口比完美准备更重要。";
  }
  if (/冷门技术栈|主流框架|无法触发匹配/i.test(text)) {
    return "你这里要把冷门技术栈翻译成主流框架能理解的信号。HR 和面试官更熟主流框架，匹配和评估都会更快。";
  }
  if (/Logistic regression|预测转化概率|建模语言/i.test(text)) {
    return "你这条可以把 VLOOKUP 的业务操作升级成建模语言。Logistic regression 和转化概率预测一写出来，数据岗信号会强很多。";
  }
  if (/医药行业|垂直行业知识|DS求职|数据分析能力|行业经历转化/i.test(text)) {
    return "你这段医药分析经历其实有价值。重点是把垂直行业知识和数据分析能力连起来，让它看起来是在支撑 DS，而不是只像行业经历。";
  }
  if (/Power BI|TB\s*级|历史数据处理|会用.*用好|复杂场景/i.test(text)) {
    return "Power BI 这条不要只写会用。TB 级数据接入、历史数据处理这类复杂场景要写出来，才像真的用好，而不是只点过工具。";
  }
  if (/业务损失|风险规模|实际业务影响|技术操作本身|金额不大/i.test(text)) {
    return "你这里要把技术动作接到业务影响。哪怕金额不大，只要能说明损失、风险规模或改进幅度，就比只写操作更有力。";
  }
  if (/技能栏贵精不贵多|列出不熟悉的技能|集中展示强项|暴露弱点/i.test(text)) {
    return "你这栏 Skills 贵精不贵多。不熟的技能别硬列，集中展示真正能被追问的强项，可信度会比堆满更高。";
  }
  if (/LinkedIn|linkedin|自定义URL|乱码|特定城市|外地雇主|只考虑该地区/i.test(text)) {
    return "你这里的地点和 LinkedIn 要写得干净。城市别把自己锁死在一个地区，LinkedIn URL 也要整理成专业、可点击的样子。";
  }
  if (/咨询类简历|consulting project|项目工作内容|问题分析|数据支撑|客户沟通|任务清单/i.test(text)) {
    return "你这段咨询经历别只写职位名称。问题分析、数据支撑、客户沟通这些核心技能要落到具体项目任务里，实习任务清单就是很好的还原线索。";
  }
  if (/C\/C\+\+|操作系统编程|embedded|嵌入式|硬件\/系统|硬件系统|物理背景/i.test(text)) {
    return "你如果投硬件/系统方向，别只写泛泛技能。C/C++、操作系统编程、嵌入式这些细分背景要说清楚，物理背景里的相关接触也可以变成证据。";
  }
  if (/Solution Architect|稀缺组合|云证书|Ray\s*\+?\s*大模型|Ray 加大模型/i.test(text)) {
    return "这条不是普通证书问题。Solution Architect 只能证明一部分，Ray 加大模型才是更稀缺的组合，简历里要把这个差异化放出来。";
  }
  if (/(?:LLM|大语言模型|ChatGPT|多模态|图像|音频|视频|传统模型迁移|LLM架构|LLM 架构)/i.test(text)) {
    return "你这里别只写泛 AI。LLM 现在不只是文本模型，多模态输入和传统模型往 LLM 架构迁移，都可以写成方向判断和技能准备。";
  }
  if (/暑期实习|summer intern|提前一年|8\s*[-–~至到]\s*9\s*月|Career Fair|春招|招募窗口|黄金窗口/i.test(text)) {
    return "你要把美国科技公司暑期实习节奏抓早。8-9 月 Career Fair 往往就在抢次年 summer intern，春招再开始准备会明显被动。";
  }
  if (/ML model|generalizability|overfit|过拟合|关键词匹配|同类JD|同类 JD/i.test(text)) {
    return "你可以把 ATS 想成一个 ML model 式的关键词匹配系统。简历要对同类 JD 有 generalizability，不要过拟合某一份 JD 到换个岗位就失效。";
  }
  if (family === "resume_versioning") {
    if (/[5五]\s*份/.test(text) && /1\s*(?:至|到|-|~)\s*2|1\s*[-~]\s*2|一\s*(?:至|到)\s*两/.test(text)) {
      return "你不用一下做 5 份简历，反而容易散。先收成 1-2 个最有把握的版本，每版只服务一个清楚的目标岗位。";
    }
    if (/一份简历|通用版|多个方向|混合多个方向/.test(text)) {
      return "你不是没有材料，是一份简历同时想服务太多方向。建议先拆成 1-2 个版本，让每一版都能一眼看出目标岗位。";
    }
  }
  if (family === "portfolio") {
    if (/demo|Demo|美术粗糙|可运行|游戏|game/i.test(text)) {
      return "你这个方向最好别只靠文字说项目，能跑起来的 Demo 会更有说服力。哪怕美术还粗糙，也能证明你真的把东西做出来了。";
    }
    if (/内容营销|社交媒体|创意|作品集|portfolio/i.test(text)) {
      return "创意或内容类岗位很吃作品证据。你可以先放最能代表产出的作品集链接，让对方不用只靠文字想象你的能力。";
    }
  }
  if (family === "skills_frontload") {
    if (/在校生|学生|student|经验不长|工作经历/.test(text)) {
      return "如果你还是学生或经验不长，技能可以适当前置。不是因为经历不重要，而是先让 HR 看到你和这个岗位有基本准备。";
    }
  }
  if (/顶部信息|名校|高学历|新毕业生/.test(raw)) {
    return "如果你的学校或学历背景强，别让它埋太深。这类顶部信息适合放到更容易被扫到的位置，先建立第一印象。";
  }
  if (/控制在一页|一页简历|超页|跨页断裂/.test(raw)) {
    return "这条先别急着加内容，优先把它收回一页。简历超页或跨页时，HR 很容易还没看到重点就先被阅读成本劝退。";
  }
  if (/地址位置|字体大小|行间距|跨页|一页|页面空间/.test(text)) {
    return "这条不是要你重写内容，而是先把版面空间救回来。可以从地址位置、字号和行距下手，避免重点经历被跨页切开。";
  }
  if (/career fair|第一眼看的是skills|技术栈快速判断|技能越丰富/i.test(text)) {
    return "Career Fair 或初筛真的会先扫 Skills。最贴 JD 的技术栈要放清楚，但后面也要接上你实际用过的经历。";
  }
  if (family === "data_evidence") {
    if (/pivot|公司规模|中小规模|规模较大|excel.{0,30}marketing|marketing.{0,30}excel/i.test(text)) {
      return "Marketing 岗不用一律堆很重的数据工具。可以按目标公司规模取舍：中小公司突出 Excel、pivot table、vlookup，大公司再补更完整的分析工具。";
    }
    if (/window function|刷题|系统复习/i.test(text)) {
      return "SQL 这块别只写会用，要补到能解释使用场景，也把 window function 这类高频点系统复习到面试能接住。";
    }
    if (/price elasticity|促销效果|沃尔玛|costco/i.test(text)) {
      return "这条很适合把渠道和数据场景写出来。像 Walmart、Costco 这类渠道里的 price elasticity、促销效果分析，会让 marketing 背景更像岗位优势。";
    }
    if (/var|stress testing|credit risk|regression model/i.test(text)) {
      return "金融风险这块要把术语写准。VaR、stress testing、regression model 这些词能把方向对到 credit risk，而不是只写泛金融。";
    }
    if (/业务决策|业务影响|可复现|持续使用|stable.{0,8}metrics|metrics.{0,8}stable|business decision|reproducible/i.test(text)) {
      return "数据岗这里不要只强调模型复杂度。业务决策、可复现流程和 stable metrics 要写出来，让项目更像能持续使用的分析成果。";
    }
  }
  if (/cross-functional|跨部门协作|文化适配|协作能力/i.test(text)) {
    return "这条不要只写成软技能口号。cross-functional collaboration 要放回具体项目里，写清楚你和哪些团队协作、推动了什么结果。";
  }
  if (/非主流平台|自媒体|雇主知名度|公司知名度|知名度不高/i.test(text)) {
    return "公司或平台名气不大时，不要急着删经历。可以补一句背景和实际工作内容，让数据分析、内容运营这些可量化产出被看见。";
  }
  if (/debug|prototype|医疗器械|硬件|实操能力/i.test(text)) {
    return "硬件或医疗器械岗位很看实操。test、debug、prototype 这些动手证据要写进经历里，别让它看起来只有理论分析。";
  }
  if (/reframing|客户视角|内部项目|服务性|交付性|合理重新框架/i.test(text)) {
    return "内部项目不是不能写，重点是换成客户或业务视角来讲。建议保留真实内容，但把服务对象、交付物和业务目标说清楚。";
  }
  if (/动态更新|两周|最新背景|新工作经历|最新实习/i.test(text)) {
    return "这条提醒很实用：新经历不用等到结束才写。做了两周左右就可以先提炼职责和初步成果，让简历保持和目标岗位同步。";
  }
  if (/结构化流程|主动构思底稿|针对性批注|被动等待导师全部代劳|内化反馈/i.test(text)) {
    return "改简历这件事不能只等别人代劳。你先主动想一版底稿，再带着问题看批注，反馈会吸收得更快。";
  }
  if (/Green card|无需公司提供签证担保|隐性偏见|身份标注/i.test(text)) {
    return "Green card 这类信息可以简洁写清楚，但别指望它解决所有筛选偏见。重点还是让经历本身先站得住。";
  }
  if (/版面空白过多|内容单薄|bullet point数量|不增加内容|视觉效果/i.test(text)) {
    return "版面空白太多时，先调整 bullet 数量和字数分配。不是硬加内容，而是别让简历第一眼显得材料很薄。";
  }
  if (/无法区分项目和正式工作|项目和正式工作|非传统行业|职能语言/.test(text)) {
    return "这条要先把经历性质讲清楚。项目、正式工作或非传统行业经历都能用，但要改成目标岗位听得懂的职能语言。";
  }
  if (/soft skill|hard skill|communication|洞察输出/i.test(text)) {
    return "金融类岗位不要只列工具，也别只写沟通能力。Python、Tableau 这类 hard skill 可以和跨团队洞察输出放在同一条证据里。";
  }
  if (/相关性最弱|稀释整体印象|篇幅有限|主动删除/.test(text)) {
    return "简历不是把所有东西都塞进去。先删掉相关性最弱的条目，把篇幅留给最能支撑目标岗位的经历。";
  }
  if (/先总后分|首句给出量化成就|钩子|逐步拆解|分析思路/.test(text)) {
    return "这条 bullet 可以先总后分：第一句先给量化成果当钩子，后面再拆方法和分析思路，读起来会更顺。";
  }
  if (/加粗关键词|强制引导视线|想不被看到都难|只扫title/i.test(text)) {
    return "如果对方只快速扫 title 和关键词，加粗就要用得有策略。最重要的技术词可以标出来，让它不容易被跳过。";
  }
  if (/结构化的bullet|做了什么、用什么工具、产生什么结果|缺少技术工具和量化影响/.test(text)) {
    return "这条不是要堆更多内容，而是把 bullet 结构补完整：做了什么、用了什么工具、产生什么结果，要让人一眼看出深度。";
  }
  if (/具体算法|预测任务|特征规模|模型名称|四元组|ML相关/i.test(text)) {
    return "ML 项目别只写模型很强。模型名称、预测任务、特征规模和量化结果要放成一组，让技术能力更具体。";
  }
  if (/行动.*结果.*影响|学习放最后|能做什么、带来什么价值/.test(text)) {
    return "这条要从学习过程改成工作价值。建议按行动、结果、影响的顺序写，学习内容放后面，不要抢走成果的位置。";
  }
  if (/Series\s*7|Series\s*66|FINRA|wealth management|stock trading|硬性资质/.test(text)) {
    return "金融前台岗这条不能只靠关键词补。Series 7、Series 66 这类 FINRA 证照如果是硬门槛，要先确认要求，再决定简历怎么交代。";
  }
  if (/消费者研究|付费增长|广告投放ROI|营销漏斗|Marketing analyst/i.test(text)) {
    return "Marketing analyst 不是一个方向。先分清你更像消费者研究，还是付费增长分析，再把经历往对应的指标和场景上靠。";
  }
  if (/谷歌|Meta|Doordash|Instacart|用人团队|技术栈匹配|入组完全分离/i.test(text)) {
    return "大厂和中型公司的筛法不一样。Google、Meta 和 DoorDash、Instacart 要分开看，后者更容易让用人团队盯技术栈匹配度。";
  }
  if (/Tableau|可视化场景|课程实操|实际产出|项目\/经历背书/i.test(text)) {
    return "Tableau 不要只停在 Skills 里。它最好接到课程实操或项目产出上，写清楚可视化场景和你做出的东西。";
  }
  if (/raw data|拿到数据|产出洞见|完整的数据分析场景|DA岗位/i.test(text)) {
    return "DA 项目要像一条完整链路：从 raw data 出发，做分析，再产出洞见。只罗列技能，不如讲清楚你怎么解决业务问题。";
  }
  if (/美国电话|直接致电|沟通障碍|被联系的概率|安排面试/.test(text)) {
    return "联系方式这块别小看。美国电话会影响 HR 能不能快速联系你，尤其是初筛沟通或安排面试时，少一个入口就多一层阻力。";
  }
  if (family === "education") {
    if (/GPA|scale|4\.0|评分|字母制/i.test(text)) {
      return "GPA 或评分制别让对方猜。scale 要写清楚，用招聘方熟悉的方式呈现，避免好成绩被读不出来。";
    }
  }
  return "";
}

function detailAwareHrTemplate(family, rawSource = "", item = {}, context = {}) {
  const text = [
    rawSource,
    item.hrPerspective,
    item.HR_os,
    item.title,
    item.problemSummary,
    item.currentDiagnosis,
  ].filter(Boolean).join(" ");
  if (/兴趣爱好栏|hiking|看电影|面试破冰|记忆点/i.test(text)) {
    return "兴趣栏我会看有没有记忆点；只有普通爱好帮助不大，有具体数据或特别经历才比较容易留下印象。";
  }
  if (/设计岗位|作品集链接|设计解决方案|关键评估材料/i.test(text)) {
    return "设计岗我会直接找作品集链接；没有可访问作品集时，设计解决方案就很难被完整评估。";
  }
  if (/背调公司不会直接使用简历时间|背调表|毕业证书日期|简历时间模糊化|背调如实填写/i.test(text)) {
    return "我会把背调表和毕业证书日期当正式核验口径；简历时间可以简化，但前后不一致要能解释清楚。";
  }
  if (/sponsorship|无需担保|HR筛选阶段|ATS层面|中小公司|初创公司|成本和风险/i.test(text)) {
    return "我初筛会很快看 sponsorship 要求；如果明确不需要sponsor，ATS 和中小公司 HR 都更容易继续推进。";
  }
  if (/技术关键词会传递求职方向信号|技术栈判断候选人定位|与目标岗位不符的高级工程技术|认知混乱/i.test(text)) {
    return "我会用技术关键词判断候选人定位；高级工程技术如果偏离目标岗位，会让我怀疑投递方向不清。";
  }
  if (isMlToneContext(context) && /方向不聚焦|not focused|weakly aligned|目标岗位|target role|岗位定位|Summary|定位|core field|核心领域专长|专项简历版本|dedicated.*resume|相关项目|relevant projects|unrelated.*full stack|不相关.*full stack|full stack|安卓|Android/i.test(text)) {
    return "我会先看候选人是不是明确投 MLE、Applied ML 或 LLM 工程方向；如果简历同时强调 full stack、Android 和 AI 项目，但没有突出模型、数据、评估或部署证据，前 10 秒会很难判断匹配度。";
  }
  if (isDaToneContext(context) && /DA简历的bullet point|岗位JD中要求的技能点|按技能维度分拆|时间顺序叙事|关键词覆盖密度/i.test(text)) {
    return "我会按 JD 技能点扫 DA bullet；如果只按时间线叙事，匹配信号会变慢，关键词覆盖也不够集中。";
  }
  if (isDaToneContext(context) && /DA实习经历|技术工具链的各个环节|完整的DA工作流能力|DA工作流/i.test(text)) {
    return "DA 实习我会看工具链是否完整；取数、清洗、分析、可视化缺一段，都会影响我判断实操能力。";
  }
  if (isDaToneContext(context) && /DA和DS简历|DA和DS简历的关键词体系|DA和DS简历侧重点|DA简历需突出.*DS简历才需要|DA强调数据查询、可视化、业务协作|用错简历版本/i.test(text)) {
    return "DA 初筛我会找查询、清洗、可视化和业务协作关键词；如果写成 DS 技术栈，很容易被判断为方向不匹配。";
  }
  if (isDaToneContext(context) && /同一份工作内容|不同技术栈的语言|分析师视角|从哪里取数|如何清洗|如何整合|底层传输架构/i.test(text)) {
    return "我会看这段是否像 DA 工作：取数、清洗、整合要清楚；只讲传输架构，会让我误判成 DE 或 DS。";
  }
  if (isDaToneContext(context) && /Kafka|误认为你在求DE\/DS|求DE|求DS|目标岗位精准匹配技术栈/i.test(text)) {
    return "看到 Kafka 这类技术关键词时，我会先判断你是不是投 DE/DS；如果目标是 DA，技术栈太偏会拖累定位。";
  }
  if (/职位名称的标准化|Software Engineer Intern|行业通用的标准名称|ATS系统.*title/i.test(text)) {
    return "标准 title 我会直接拿来和岗位筛选条件对；像 Software Engineer Intern 这种通用名称，比自创 title 更不容易被系统误判。";
  }
  if (/Job Title|Title在目标市场认知度低|定位判断|简历被忽视/i.test(text)) {
    return "我第一眼会先看 title 是否对得上目标岗位；title 太冷门或不标准时，ATS 和人工都会更容易误判。";
  }
  if (/IPO客户|三年历史财务复核|内控审计.*SOC|IT cycle|revenue cycle|普通engagement/i.test(text)) {
    return "审计经历我会看项目复杂度；三年历史财务、SOC、IT cycle 和 revenue cycle 写出来，资历层级才清楚。";
  }
  if (/经历数量有限|差异化价值|重复工具|相似职能|技能覆盖最独特/i.test(text)) {
    return "我会看每段经历是否提供不同证据；内容太重复时，版面占了，判断价值却没有增加。";
  }
  if (/保密客户|American auto mobile company|行业\+地区|专业又合规/i.test(text)) {
    return "咨询经历我可以接受保密写法；行业加地区说清楚时，既合规，也能判断项目背景。";
  }
  if (/NLP项目|基础NLP功能|NLP文本处理/i.test(text)) {
    return "NLP 项目我会看是否能产生商业 insight；只做基础文本处理，区分度会比较弱。";
  }
  if (/SQL、Python|不提工具|具体技术关键词|数据岗位的技术能力无法被识别/i.test(text)) {
    return "数据岗初筛我会先扫 SQL、Python 这些具体技术词；只写业务动作，会让我很难判断技术匹配度。";
  }
  if (/企业背调一般只验证|付费线上实习|Project形式|合规边界/i.test(text)) {
    return "付费线上实习我会看呈现方式是否合规；写成 Project 可以，但不能让我误以为是正式雇佣。";
  }
  if (/background check|技能描述有一定调整空间|不会核查具体工作内容|Work Experience/i.test(text)) {
    return "Work Experience 我会默认可被 background check 验证；技能描述可以调整，但栏位误导会直接伤可信度。";
  }
  if (/简历上的LinkedIn链接|自定义URL|便于HR快速访问/i.test(text)) {
    return "我会把 LinkedIn URL 当成第一印象细节；链接干净可访问，会降低背景确认成本。";
  }
  if (/跨渠道.*ins.*YouTube|channel effectiveness|广告素材|严格意义上的AB测试/i.test(text)) {
    return "看到跨渠道对比时，我会更倾向判断为 channel effectiveness；如果写成严格 A/B test，我会追问变量是否真的可控。";
  }
  if (/技能列表堆砌不相关工具|形同虚设|经历背书|方向不清晰/i.test(text)) {
    return "Skills 堆太散时，我会怀疑候选人方向不清楚；每个技能最好能在经历里找到对应证据。";
  }
  if (/极短时间内理解候选人做了什么|用了什么方法|产出了什么结果|描述散乱/i.test(text)) {
    return "项目描述我会先抓做了什么、方法是什么、结果是什么；三件事散开时，实际能力会很难判断。";
  }
  if (/工作逻辑链：分析→优化→结果|完整流程|实际能力/i.test(text)) {
    return "工作经历我会看分析、优化、结果有没有连起来；链条断掉时，只能按零散执行动作来判断。";
  }
  if (/内部意见收集|用户问卷|customer-facing|internal|同一链条/i.test(text)) {
    return "如果 internal 工作能转成 customer-facing 逻辑，我会更容易相信 impact；只写内部流程会比较弱。";
  }
  if (/LinkedIn链接已成为北美求职简历标配|信息不透明|不够专业/i.test(text)) {
    return "LinkedIn link 缺失时，我会觉得背景信息不够透明；干净可访问的链接能降低确认成本。";
  }
  if (/多样化经历|不同维度的能力|重复类型的经历/i.test(text)) {
    return "我会看几段经历是不是各自提供新证据；类型太重复时，篇幅增加了，候选人画像却没有变清楚。";
  }
  if (/简历不要求所有项目都已完成上线|发现问题|参与设计|推动自动化|流程优化意识/i.test(text)) {
    return "项目没完全上线我可以接受；我会看发现问题、参与设计和推动自动化这些过程有没有体现流程优化意识。";
  }
  if (/Power BI.*Office|PL300|微软官方认证|管理层.*可视化|高性价比/i.test(text)) {
    return "Power BI 和 PL300 我会当成清楚的能力信号；管理层能读懂的可视化证据，也会让我更快判断商业呈现能力。";
  }
  if (/母简历|收录所有经历|最匹配的子集|多目标岗位|多份简历版本/i.test(text)) {
    return "我会看这一版是不是专门服务当前岗位；母简历素材可以多，但投出来的版本必须像被筛选过。";
  }
  if (/持续迭代|不同阶段.*不同JD|掌握方法论|一次性修改成果|长期价值/i.test(text)) {
    return "我会看简历有没有随 JD 调整；一直用同一版，会让我怀疑候选人没有认真对齐岗位。";
  }
  if (/模型做了什么|结果如何|最基本的逻辑|写上去就代表你懂|面试官追问/i.test(text)) {
    return "看到模型相关描述，我会追问基本逻辑和结果；讲不清楚时，会怀疑这段是不是写过头。";
  }
  if (/官方职位名称|reframing|重新框架|岗位叙事/i.test(text)) {
    return "我会看 title 背后的实际工作内容；如果叙事能对上目标岗位，即使官方职位名不完全一致也能继续评估。";
  }
  if (/跑了多少地点|采访了多少用户|量化执行细节|早期经历|工作规模和影响力/i.test(text)) {
    return "早期经历我也会看执行规模；地点数、用户访谈数这类数字能让我更快判断工作量。";
  }
  if (/LinkedIn的experience描述|猎头评估|主页吸引力|主动联系|简单的职位名称/i.test(text)) {
    return "LinkedIn experience 空白时，我会少一个判断背景的入口；只放职位名也不太能吸引猎头继续看。";
  }
  if (/LinkedIn|linkedin|自定义URL|乱码|特定城市|外地雇主|只考虑该地区/i.test(text)) {
    return "我会用地点和 LinkedIn 快速判断联系与背景可信度；链接乱码或地点信号太窄，都会增加不确定感。";
  }
  if (/咨询类简历|consulting project|项目工作内容|问题分析|数据支撑|客户沟通|任务清单/i.test(text)) {
    return "咨询经历我会看具体项目内容；只有职位名，没有问题分析、数据支撑或客户沟通证据，很难判断咨询能力。";
  }
  if (/C\/C\+\+|操作系统编程|embedded|嵌入式|硬件\/系统|硬件系统|物理背景/i.test(text)) {
    return "系统或硬件方向我会看 C/C++、OS、嵌入式证据；只有泛技能时，很难判断是不是这条赛道的人。";
  }
  if (/Solution Architect|稀缺组合|云证书|Ray\s*\+?\s*大模型|Ray 加大模型/i.test(text)) {
    return "如果候选人同时懂 Ray 和大模型，我会把它当成更稀缺的信号；只有常见云证书，区分度会弱一些。";
  }
  if (/Ray专注于非结构化数据|OpenAI|阿里巴巴|腾讯|百度|字节|学校几乎不教|求职市场稀缺/i.test(text)) {
    return "Ray 我会当成 JD 里的稀缺核心技能看，尤其是非结构化数据的分布式计算；只写泛 AI 就很难体现差异。";
  }
  if (/LoRA|Stable Diffusion|inpainting|完整模型名称|具体工具或模型/i.test(text)) {
    return "AI 项目我会看具体工具和模型名；LoRA、Stable Diffusion v2 inpainting 写清楚，比泛泛说用了模型可信很多。";
  }
  if (/(?:LLM|大语言模型|ChatGPT|多模态|图像|音频|视频|传统模型迁移|LLM架构|LLM 架构)/i.test(text)) {
    return "AI 岗我会看你是不是跟上 LLM 和多模态趋势；只写传统模型，可能显得方向更新不够快。";
  }
  if (/暑期实习|summer intern|提前一年|8\s*[-–~至到]\s*9\s*月|Career Fair|春招|招募窗口|黄金窗口/i.test(text)) {
    return "我会看候选人有没有踩准实习招募窗口；错过 8-9 月的大厂节点，后面被团队看到的机会会少很多。";
  }
  if (/Experience栏默认代表正式雇佣关系|混入课程项目|实际工作经验产生误判/i.test(text)) {
    return "Experience 栏我会默认是正式雇佣或实习；课程项目混进去，会让我重新判断这段经历到底算不算工作经验。";
  }
  if (/background check|正式雇佣|非正式实习|Work Experience栏|信任风险/i.test(text)) {
    return "Work Experience 我会默认可被 background check 验证；非正式项目放进来，会让我先担心经历真实性和栏位是否准确。";
  }
  if (/第一眼就判断出.*目标方向|标题、Summary、技能顺序|共同服务于同一个岗位定位/i.test(text)) {
    return "我第一眼会看标题、Summary、技能排序和前几条经历是不是指向同一岗位；不一致时，很容易被当成通用版。";
  }
  if (/circuit design|logic design|硬件工程|同一份简历广泛投递/i.test(text)) {
    return "硬件岗我会区分 circuit design 和 logic design；方向写准时，同一份简历投同类岗位反而更有效。";
  }
  if (/Analytics岗位|Tableau.*Excel.*SQL|月度dashboard|行业标配技能/i.test(text)) {
    return "Analytics 岗我会找 Tableau、Excel、SQL 和 dashboard 证据；这些工具缺失或没有场景，匹配感会明显变弱。";
  }
  if (/顶级投行|投行实习|orientation|收尾presentation|1\s*[-–~至到]\s*2\s*周|实际动手时间极短/i.test(text)) {
    return "投行实习我不会只看公司名；如果实际动手时间很短，我会更看这段市场分析到底被你讲得多扎实。";
  }
  if (/转码|项目来源渠道|技术覆盖度|全栈|功能实现|技术选型/i.test(text)) {
    return "转码项目我会看全栈覆盖、功能实现和技术选型；项目来源不关键，关键是面试追细节时能不能讲清楚。";
  }
  if (/RAG|policy文档|内部员工查询|业务场景|用户痛点/i.test(text)) {
    return "RAG 项目我会看它解决谁的问题；内部员工查 policy 文档这种场景，比单独写 RAG 系统更容易判断价值。";
  }
  if (/每个步骤的具体实现方式|技术细节写清楚|通过ATS|基础问题|系统性思维/i.test(text)) {
    return "技术描述写清楚时，我会更相信候选人真的做过；只写大词但没有实现步骤，ATS 过了也容易在面试掉分。";
  }
  if (/仅描述参与行为|参与行为的bullet|结构化的分析过程|实际能力与思维方式/i.test(text)) {
    return "只写参与行为时，我很难判断能力；看到结构化分析过程，才比较像能独立思考和推进。";
  }
  if (/纯点选|下载|导出|机械操作|操作步骤|分析过程|业务价值/i.test(text)) {
    return "如果经历只停在点选、下载、导出，我会把它当成低技术含量操作；看到分析过程和业务价值才会继续评估深度。";
  }
  if (/publication|同一项目|同一研究|不同产出|整合在同一条目|单独列项/i.test(text)) {
    return "研究经历我会一起看过程和产出；publication 单独飘出来时，反而不如放回对应研究里容易判断贡献。";
  }
  if (/market方向实习生|marketing research|统计分析类课程|课程名称不完全对口/i.test(text)) {
    return "Market 实习我会看有没有 marketing research 或统计分析训练；课程不完全同名没关系，能补方向信号就有用。";
  }
  if (/课程顺序|不同职能方向|GPA和相关课程|学术实力与岗位匹配度/i.test(text)) {
    return "在校生我会看 GPA 和课程是否服务目标方向；课程顺序调整得好，能更快看到岗位匹配信号。";
  }
  if (/低 GPA|不写不会被追问|写出反而形成减分|教育背景中少数可量化/i.test(text)) {
    return "GPA 我会当成快速量化信号；高 GPA 加分，低 GPA 如果硬放出来，第一眼反而会拖弱学术印象。";
  }
  if (/education是招聘方筛选的第一要素|work experience权重次之|Education放顶部|金融行业应届生|target school/i.test(text)) {
    return "金融应届生我会先扫 Education、target school 和 GPA；这个顺序能更快判断基本背景，再看实习经历。";
  }
  if (/GPA|target school|高 GPA|低 GPA|Education放顶部|金融行业应届生|教育背景中少数可量化/i.test(text)) {
    return "应届生我会很快扫 Education、target school 和 GPA；高 GPA 是加分信号，低 GPA 硬放反而会拖第一印象。";
  }
  if (/线性回归|基础ML|ML技能|ATS机筛|模型逻辑|口头解释模型/i.test(text)) {
    if (isMlToneContext(context)) {
      return "MLE 初筛我会看模型、任务、评估指标和项目证据是否成链；只出现基础 ML 词，但讲不清模型逻辑，匹配感会比较弱。";
    }
    return "数据分析岗我会找基础 ML 和模型逻辑证据；线性回归这类词缺失，ATS 和人工初筛都会比较保守。";
  }
  if (/BA简历|每一条bullet point|紧扣岗位JD|稀释简历焦点|定位不清晰/i.test(text)) {
    return "BA 简历我会看每条 bullet 是否贴 JD；不相关技术内容太多，会让我怀疑候选人的定位不够清楚。";
  }
  if (/动词的选择|ownership等级|based on|主导者还是执行者|精准动词/i.test(text)) {
    return "我会从动词判断 ownership；based on 这类模糊词会让我追问你到底是主导、协作还是只执行一小段。";
  }
  if (/environment artist|环境模型|关卡布局|行业标准术语|专业方向/i.test(text)) {
    return "游戏岗位我会先看 title 是否是行业听得懂的词；environment artist 这类标准名称能减少误判。";
  }
  if (/跨方向投递|数据分析类岗位ATS|直接被系统过滤/i.test(text)) {
    if (isMlToneContext(context)) {
      return "MLE 版本我会先扫 Python、Machine Learning、模型评估和项目证据；这些信号缺失时，很容易不像直接匹配的候选人。";
    }
    return "数据分析版我会先扫 Python、SQL、Machine Learning；这些 ATS 高频词缺失时，很容易在第一轮就被过滤。";
  }
  if (/金融数据类岗位JD|所需工具|ATS会匹配关键词|面试前针对性复习/i.test(text)) {
    return "金融数据岗我会先扫 JD 里的工具关键词；该出现的词没有，ATS 和人工初筛都会很难放心推进。";
  }
  if (/广告预算|awareness|触达量|转化类|渠道\/KOL|带单量|投放衡量/i.test(text)) {
    return "广告投放我会看指标是否贴目标；awareness 和转化类投放看的数字不同，混在一起会显得不专业。";
  }
  if (/教育游戏|游戏行为数据|学习路径|用户留存|Google Analytics/i.test(text)) {
    return "教育游戏岗位我会看数据有没有接到学习路径和用户留存；Google Analytics 只有和行为场景连起来才有分量。";
  }
  if (/超链接在PDF|纯文本URL|行间距过大|full-time|写满一页|精准点击|复制/i.test(text)) {
    return "PDF 链接不好复制、行距又太空时，我会觉得版面不够成熟；full-time 简历太空也会像内容不足。";
  }
  if (/计划课程|选课记录|在读生|列出计划课程|常见且合理/i.test(text)) {
    return "在读生列计划课程我可以接受，但我会把它当成准备度信号，不会等同于已经完成的项目或工作经验。";
  }
  if (/错落有致|过于密集|过于稀疏|适中的行长|版面整洁/i.test(text)) {
    return "排版密度会影响我读下去的耐心；太挤或太散都会降低信息抓取效率。";
  }
  if (/结果和影响前置|浏览简历时间极短|快速筛掉|抓住阅读者眼球/i.test(text)) {
    return "我第一眼会先抓结果和影响；亮点藏太后面时，很容易还没读到就被筛掉。";
  }
  if (/敲门砖|第一印象直接决定|屡屡碰壁|不断试错和反馈/i.test(text)) {
    return "简历第一印象会直接影响约面机会；如果投递一直没反应，我会建议先看反馈和修改节奏。";
  }
  if (/跑了多少地点|采访了多少用户|量化执行细节|早期经历|工作规模和影响力/i.test(text)) {
    return "早期经历我也会看执行规模；地点数、用户访谈数这类数字能让我更快判断工作量。";
  }
  if (/冗余形容词|主观评价性形容词|证明能力|信息的密度|空间有限/i.test(text)) {
    return "主观形容词太多时，我会觉得信息密度低；动作、工具和结果比自我评价更有筛选价值。";
  }
  if (/美国本地经历|课程project|实验室research project|纯上课经历|不写等于白上/i.test(text)) {
    return "在读研究生我会看有没有美国本地项目信号；实验室 research project 通常比普通课程项目更有分量。";
  }
  if (/ensure quality|3倍以上|纯描述型.*3倍|引导讨论到候选人熟悉/i.test(text)) {
    return "ensure quality 这种说法我会比较警惕；有数字或可验证成果时，可信度会高很多。";
  }
  if (/工作经历置顶|教育背景置顶|职业人身份|经验不足|结构顺序本身传递信息/i.test(text)) {
    return "板块顺序会影响我对候选人资历的判断；工作经历置顶更像职业人，教育背景置顶更像应届生。";
  }
  if (/结构化流程|主动构思底稿|针对性批注|被动等待导师全部代劳|内化反馈/i.test(text)) {
    return "我会看候选人有没有主动整理问题和吸收反馈；只等别人逐句改，通常说明自我修订能力还不够。";
  }
  if (/版本管理|通用版随时可发|定制版提高匹配度|草稿版|未完成内容/i.test(text)) {
    return "如果我收到带批注或未完成内容的草稿，会直接影响专业印象；版本管理本身也是求职基本功。";
  }
  if (/结果和价值|完整的历史叙述|最终成果中的贡献|过程中的曲折/i.test(text)) {
    return "我不需要完整历史叙述；我会先看最终成果里你贡献了什么，以及这个贡献有没有价值。";
  }
  if (/system design|第二条求职赛道|重新框架包装|无需额外积累经验/i.test(text)) {
    return "如果经历里已有 system design 证据，我会看它能不能支撑第二条求职赛道；框架不清楚就容易被埋掉。";
  }
  if (/Strategy模式|Factory模式|接口\+实现|SWE标配|大量生产实践/i.test(text)) {
    return "软件工程初筛可以接受基础设计模式放在技能栏，但面试时我会默认你能解释 Strategy、Factory 这些原理。";
  }
  if (/角色定位|逐条阅读小点才能判断职责|理解成本|优先寻找.*角色/i.test(text)) {
    if (/可量化的产出|实际影响力|impact|空洞的任务罗列/i.test(text)) {
      return "项目经历我会同时看角色、量化产出和 impact；缺了这些，整段很容易像空洞任务清单。";
    }
    return "项目里角色定位不清时，我要多读很多小点才知道你负责什么；这会增加筛选成本。";
  }
  if (/描述的粒度|太粗泛|太细|能反映关键能力|快速理解/i.test(text)) {
    return "描述太粗我看不出专业度，太细又影响快速判断；我会更看能直接反映核心能力的粒度。";
  }
  if (/各板块的分类|无关的经历|分散阅读注意力|整体相关性评分/i.test(text)) {
    return "板块分类会影响我判断背景；无关经历放太多，会分散注意力，也会降低整体相关性。";
  }
  if (/业务决策支持|分析结果转化为业务决策|跨团队协作经历|soft skill与业务影响力/i.test(text)) {
    return "数据岗我会看分析有没有支持业务决策；跨团队协作如果没有接到影响力，只会像普通软技能。";
  }
  if (/RTL设计|Physical Design|Synthesis|芯片公司|Skyworks/i.test(text)) {
    return "芯片岗位我会先判断候选人投 RTL、Physical Design 还是 Synthesis；方向散了，简历和面试准备都会变弱。";
  }
  if (/实习经历.*可验证|易回答的技能点|2个核心技能维度|展开作答/i.test(text)) {
    return "实习经历我会追问具体技能点；如果写得太散或答不出来，可信度会比内容少一点还更危险。";
  }
  if (/Marketing岗位面试|叙事能力|自圆其说|逻辑清晰|经历包装/i.test(text)) {
    return "Marketing 面试我会听故事线是否自洽；逻辑讲不顺时，再多包装也会显得风险高。";
  }
  if (/职位title|多种不一致|两个方向都拿不到面试|关键词和title针对性替换/i.test(text)) {
    return "title 不一致会让我很难判断投递方向；多版本可以共用内容，但岗位名和关键词必须对齐。";
  }
  if (/V-Model|需求分析到测试验证|测试验证|机械\/系统工程|专业性/i.test(text)) {
    return "机械/系统工程岗我会看完整开发链条；能覆盖需求分析到测试验证，会比单点任务更可信。";
  }
  if (/市场主流|格式与市场主流不一致|违和感|找不到关键信息|格式统一/i.test(text)) {
    return "格式和市场主流差太多时，ATS 和人工第一眼都会更费劲；信息不好找，会降低进入实质评估的机会。";
  }
  if (/学习过程|提及mentor|学生作业|实战经验|成果与行动/i.test(text)) {
    return "我会更看成果和行动；如果一直强调 mentor 或学习过程，会比较像课程作业，也不容易对上 JD 里的能力要求。";
  }
  if (/编程语言熟练度|技术面试筛选|投入产出比/i.test(text)) {
    return "技术岗我会默认候选人能过 JD 里的基本编程筛；刷题和语言熟练度不足，后续面试风险会很高。";
  }
  if (/官方职位名称|reframing|重新框架|岗位叙事/i.test(text)) {
    return "我会看 title 背后的实际工作内容；如果叙事能对上目标岗位，即使官方职位名不完全一致也能继续评估。";
  }
  if (/SDE岗位|编程语言只是基础门槛|framework|数据库|云服务|我会说中文/i.test(text)) {
    return "SDE 初筛我不会只看语言名；framework、数据库和云服务能让我更快判断候选人是否能落到真实开发任务。";
  }
  if (/Web GIS|GIS就业市场|GIS岗位|缺少该技能/i.test(text)) {
    return "GIS 岗我会特别看 Web GIS；这个技能缺失时，即使有 GIS 背景，岗位匹配感也会弱很多。";
  }
  if (/sustainability|ESG|city officials|residents|外部方协作|stakeholder场景/i.test(text)) {
    return "ESG 岗我会看外部协作证据；city officials 和 residents 这种 stakeholder 场景写清楚，会比泛泛协作更可信。";
  }
  if (/第一个bullet point|第一句话抓到重点|定锚|快速扫描/i.test(text)) {
    return "我快速扫简历时会先看第一条 bullet；第一句话如果没有定住重点，后面内容很容易被降权。";
  }
  if (/部署平台|端到端系统|工程化能力|模型\/脚本实际落地|实际落地/i.test(text)) {
    return "端到端项目我会看部署平台和落地方式；只写模型或脚本，工程化能力还不够好判断。";
  }
  if (/Web相关的岗位数量|C\+\+等额外技术栈|机会池|增加投递数量/i.test(text)) {
    return "我会把 Web 技术栈当成主要机会池，再看 C++ 这类额外技能能不能打开不同岗位入口。";
  }
  if (/Risk部门|市场风险|信用风险|中台风控|金融量化|分析类专业/i.test(text)) {
    return "金融 Risk 岗我会区分市场风险、信用风险和中台风控；方向写清楚，专业背景才更容易被匹配到合适团队。";
  }
  if (/金融风险管理|MFE|量化模型|模型关键词|技术背景/i.test(text)) {
    return "金融风险/MFE 初筛会看量化模型关键词；模型名不清楚时，我很难判断技术背景是否够用。";
  }
  if (/Nielsen|大型快消|market research|心理学|社会学|受众细分|消费行为洞察/i.test(text)) {
    return "Market research 岗我会看受众细分和消费行为洞察；心理学、社会学背景在 Nielsen 这类渠道里是相关信号。";
  }
  if (/physical design|bring up|板级测试|纯嵌入式|软硬件调试|芯片组/i.test(text)) {
    return "嵌入式初筛我会区分 physical design、bring up 和板级测试；方向混在一起时，很难判断你适合哪类团队。";
  }
  if (/recommendation|SQL monkey|Excel monkey|策略思维|分析师越往后/i.test(text)) {
    return "分析师经历我会看有没有 recommendation；只有 SQL 或 Excel 操作，很容易被判断成执行型而不是策略型。";
  }
  if (/课程顺序|不同职能方向|GPA和相关课程|学术实力与岗位匹配度/i.test(text)) {
    return "在校生我会看 GPA 和课程是否服务目标方向；课程顺序调整得好，能更快看到岗位匹配信号。";
  }
  if (/强行动动词|participate|主动性|主导角色|边缘角色/i.test(text)) {
    return "我会从动词判断角色强弱；participate 这类词会让我倾向认为候选人只是边缘参与。";
  }
  if (/deal经验|purchase price|交易类型|交易规模|真实deal/i.test(text)) {
    return "金融简历我会找真实 deal、purchase price 和交易类型；这些细节缺失时，经历分量会比较难判断。";
  }
  if (/结构化自我梳理|口头叙述|完整还原|筛选提炼|遗漏亮点/i.test(text)) {
    return "经历讲得散时，我会很难抓亮点；先完整还原再提炼，能减少遗漏，也更像成熟的简历材料。";
  }
  if (/净资产乘以行业调节系数|信用评级得分|金融信贷|风险量化评估|具体评估维度/i.test(text)) {
    return "信贷风险岗我会看具体评估维度；净资产调节系数、信用评级得分这类细节，比参与风险评估更能判断深度。";
  }
  if (/共性技能栈|特性工具要求|SQL|Python|初筛通过率/i.test(text)) {
    return "初筛我会先扫 JD 核心技能；SQL、Python 这类共性技能和岗位特定工具都要有，缺一块都会影响推进。";
  }
  if (/Power BI.*Office|PL300|微软官方认证|管理层.*可视化|高性价比/i.test(text)) {
    return "Power BI 和 PL300 我会当成低成本但清楚的能力信号；管理层能读懂的可视化证据也会加分。";
  }
  if (/PE行业|AUM|平台层级|公司规模的核心指标/i.test(text)) {
    return "PE 经历我会先看 AUM 这类平台规模信号；缺了它，就很难判断候选人原来平台的层级和经历分量。";
  }
  if (/scalable|production-grade|high-performance|技术形容词|具体技术栈|抽象描述/i.test(text)) {
    return "看到 scalable、production-grade 这类词，我会继续追具体技术和数据；撑不住时，反而会降低可信度。";
  }
  if (/A\/B test|z-score|hypothesis testing|statistical analysis|统计方法/i.test(text)) {
    return "数据岗我会看统计方法是否贴 JD；A/B test、z-score、hypothesis testing 比泛泛的 statistical analysis 更容易判断深度。";
  }
  if (/used Excel|Excel.{0,20}功能|工具类描述|实际分析能力/i.test(text)) {
    return "Excel 我不会只看工具名；写出具体功能和分析场景，才比较能证明是真的数据能力。";
  }
  if (/PRD|Figma|产品类岗位|产品工作方式|执行力/i.test(text)) {
    return "PM 岗我会看 PRD、Figma 和协作证据；只有工具名，没有推进方式，产品执行力会不够清楚。";
  }
  if (/模糊的action|follow-up|用了什么工具|怎么分析|framework|结构化思维/i.test(text)) {
    return "看到模糊 action 时，我会追问工具、分析方法和 framework；这些细节先写清楚，面试风险会低很多。";
  }
  if (/两分钟|2分钟|快速glance|第一条bullet|high level understanding|准备问题/i.test(text)) {
    return "面试前我可能只快速扫两分钟；第一条 bullet、关键词和数字如果不清楚，准备问题时就很难抓到重点。";
  }
  if (/writing tutor|writing sample|辅导人数|成绩提升/i.test(text)) {
    return "看到 writing tutor 我会预设写作能力不错；如果还能看到 sample、辅导人数或成绩提升，可信度会高很多。";
  }
  if (/VaR|Monte Carlo|风险计量|完整分析链条/i.test(text)) {
    return "金融风险岗我会看 VaR、Monte Carlo 和工具是否连成分析链条；孤立技能点不够判断实操深度。";
  }
  if (/学校合作|实习项目|企业项目经验|自主投递外部实习/i.test(text)) {
    return "学校合作项目我会当成真实项目经验看，但前提是要写清楚企业场景和你实际承担的部分。";
  }
  if (/数据设计决策|收集什么数据|从哪里获得|业务理解力|差异化亮点/i.test(text)) {
    return "数据项目我会看数据从哪里来、为什么这样收；这比只列工具更能体现业务理解。";
  }
  if (/付费引流|Google Ads|社媒广告|网红营销|influencer marketing/i.test(text)) {
    return "电商 marketing 我会找 Google Ads、社媒广告或 influencer marketing 证据；方向具体，才好判断匹配度。";
  }
  if (/工具\/方法 \+ 行动|streamlined X process|可解释的成果|bullet point应遵循/i.test(text)) {
    return "我会看 bullet 有没有方法、行动和结果；没有百分比也可以，但成果要真实、可解释。";
  }
  if (/ML model|generalizability|overfit|过拟合|关键词匹配|同类JD|同类 JD/i.test(text)) {
    return "我会看关键词是不是能覆盖同类岗位，而不是只贴住某一份 JD；过拟合单一 JD 的简历，泛用性会比较弱。";
  }
  if (/地址位置|字体大小|行间距|跨页|一页|页面空间/.test(text)) {
    return "版面如果跨页或太挤，我会更难顺着读完；这些格式细节会直接影响第一轮阅读效率。";
  }
  if (/career fair|第一眼看的是skills|技术栈快速判断|技能越丰富/i.test(text)) {
    return "Career Fair 场景我会很快扫 Skills；技术栈不清楚，就很难决定要不要继续聊经历。";
  }
  if (/pivot|中小规模|规模较大|excel.{0,30}marketing|marketing.{0,30}excel/i.test(text)) {
    return "Marketing 岗我会按公司规模看工具要求；Excel、pivot table、vlookup 写清楚，比泛泛说 data skills 更有用。";
  }
  if (/window function|刷题|系统复习/i.test(text)) {
    return "SQL 写上去后我会默认你能被追问；如果 window function 这类常见点接不住，面试风险会很明显。";
  }
  if (/price elasticity|促销效果|沃尔玛|costco/i.test(text)) {
    return "看到具体渠道和分析场景，我会更容易判断你是不是真的懂 consumer marketing 的数据工作。";
  }
  if (/var|stress testing|credit risk|regression model/i.test(text)) {
    return "Credit risk 我会看术语是否对得上；VaR、stress testing、regression model 写清楚，方向感会强很多。";
  }
  if (/cross-functional|跨部门协作|文化适配|协作能力/i.test(text)) {
    return "我不会只因为写了 teamwork 就加分；要看到你和哪些团队合作、推动了什么结果。";
  }
  if (/非主流平台|自媒体|雇主知名度|公司知名度|知名度不高/i.test(text)) {
    return "公司名气不高不是问题，但我需要快速知道它做什么，以及你在里面交付了什么。";
  }
  if (/debug|prototype|医疗器械|硬件|实操能力/i.test(text)) {
    return "硬件或医疗器械岗位我会找 test、debug、prototype 证据；只有理论分析时，匹配判断会保守。";
  }
  if (/reframing|客户视角|内部项目|服务性|交付性|合理重新框架/i.test(text)) {
    return "内部项目可以写，但我会看它服务了谁、交付了什么；只讲内部流程，外部价值会不清楚。";
  }
  if (/动态更新|两周|最新背景|新工作经历|最新实习/i.test(text)) {
    return "我会看简历是不是反映最新经历；新实习如果完全没写，相关性可能被低估。";
  }
  if (/结构化流程|主动构思底稿|针对性批注|被动等待导师全部代劳|内化反馈/i.test(text)) {
    return "如果候选人只等别人代改，我会担心他讲不清自己的经历；先有底稿再吸收反馈，面试也更稳。";
  }
  if (/Green card|无需公司提供签证担保|隐性偏见|身份标注/i.test(text)) {
    return "Green card 能降低一部分流程顾虑，但不会替代能力判断；经历本身不清楚时，这个信息帮不了太多。";
  }
  if (/版面空白过多|内容单薄|bullet point数量|不增加内容|视觉效果/i.test(text)) {
    return "空白太多会让我觉得内容偏薄；合理分配 bullet 数量和字数，比硬塞无关经历更好。";
  }
  if (/无法区分项目和正式工作|项目和正式工作|非传统行业|职能语言/.test(text)) {
    return "如果我分不清这是项目还是正式工作，判断会变慢；用岗位职能语言写清楚，会更容易被归到相关经历。";
  }
  if (/顶部信息|名校|高学历|新毕业生/.test(text)) {
    return "顶部信息会影响我第一眼的判断；学校或学历是强信号时，放清楚会提高继续读的概率。";
  }
  if (/soft skill|hard skill|communication|洞察输出/i.test(text)) {
    return "金融类岗位我会同时看工具和协作输出；只有 Python、Tableau 或只有 communication，都不如两者有项目证据。";
  }
  if (/相关性最弱|稀释整体印象|篇幅有限|主动删除/.test(text)) {
    return "我不会平均看所有经历；弱相关内容太多时，反而会稀释最该被看到的岗位证据。";
  }
  if (/先总后分|首句给出量化成就|钩子|逐步拆解|分析思路/.test(text)) {
    return "我会先抓第一句有没有结果；先给成果，再展开方法，会比一开始就进细节更容易读下去。";
  }
  if (/加粗关键词|强制引导视线|想不被看到都难|只扫title/i.test(text)) {
    return "我快速扫简历时会被加粗词引导；加粗对了能帮我抓重点，加粗错了也会放大噪音。";
  }
  if (/结构化的bullet|做了什么、用什么工具、产生什么结果|缺少技术工具和量化影响/.test(text)) {
    return "一条 bullet 至少要让我看到任务、工具和结果；缺任何一块，能力深度都会比较难判断。";
  }
  if (/具体算法|预测任务|特征规模|模型名称|四元组|ML相关/i.test(text)) {
    return "ML 项目我会找模型、任务、特征规模和结果；只有模糊模型描述，很难判断技术含量。";
  }
  if (/行动.*结果.*影响|学习放最后|能做什么、带来什么价值/.test(text)) {
    return "企业更关心你能交付什么；如果 bullet 先讲学习过程，我会比较难判断业务价值。";
  }
  if (/Series\s*7|Series\s*66|FINRA|wealth management|stock trading|硬性资质/.test(text)) {
    return "金融前台岗我会先看硬性资质；Series 7、Series 66 这类要求不符合时，关键词再像也很难推进。";
  }
  if (/消费者研究|付费增长|广告投放ROI|营销漏斗|Marketing analyst/i.test(text)) {
    return "Marketing analyst 我会先判断你是哪一类；消费者研究和付费增长的证据不一样，写混会削弱匹配感。";
  }
  if (/谷歌|Meta|Doordash|Instacart|用人团队|技术栈匹配|入组完全分离/i.test(text)) {
    return "不同公司筛选逻辑差很多；如果是用人团队直接看，技术栈不贴会比大厂通筛更伤。";
  }
  if (/Tableau|可视化场景|课程实操|实际产出|项目\/经历背书/i.test(text)) {
    return "Tableau 只列在 Skills 里我不会太买单；我会继续找有没有真实 dashboard、课程实操或项目产出。";
  }
  if (/raw data|拿到数据|产出洞见|完整的数据分析场景|DA岗位/i.test(text)) {
    return "DA 经历我会看完整数据链路；只写工具名，没有 raw data 到洞见的过程，匹配度会弱。";
  }
  if (/美国电话|直接致电|沟通障碍|被联系的概率|安排面试/.test(text)) {
    return "如果联系信息不完整，我安排初筛会多一步确认；美国电话缺失时，确实可能降低联系效率。";
  }
  if (family === "data_evidence" && /业务决策|业务影响|可复现|持续使用|stable.{0,8}metrics|metrics.{0,8}stable|business decision|reproducible/i.test(text)) {
    return "我会看这个分析是不是能影响业务、能不能复现、metrics 是否稳定；只有复杂模型，不一定代表项目够强。";
  }
  return "";
}

function hasPerspectiveSplitFields(item = {}, role = "mentor") {
  if (role === "mentor") {
    return Boolean(item.humanizedMentorInsightRaw ||
      item.humanized_mentor_insight_raw ||
      item.humanizedMentorInsightGeneralized ||
      item.humanized_mentor_insight_generalized);
  }
  return Boolean(item.humanizedHrPerspectiveRaw ||
    item.humanized_hr_perspective_raw ||
    item.humanizedHrPerspectiveGeneralized ||
    item.humanized_hr_perspective_generalized);
}

function dbHumanizedPerspectiveForMode(item = {}, context = {}, role = "mentor") {
  const generalized = Boolean(context.useGeneralizedPerspective);
  const status = item.perspectiveReviewStatus || item.perspective_review_status;
  const splitFieldsPresent = hasPerspectiveSplitFields(item, role);
  if (role === "mentor") {
    const modeText = generalized
      ? (item.humanizedMentorInsightGeneralized || item.humanized_mentor_insight_generalized)
      : (item.humanizedMentorInsightRaw || item.humanized_mentor_insight_raw ||
          (splitFieldsPresent ? "" :
          item.humanizedMentorInsight || item.humanized_mentor_insight));
    return approvedHumanized(modeText, status);
  }
  const modeText = generalized
    ? (item.humanizedHrPerspectiveGeneralized || item.humanized_hr_perspective_generalized)
    : (item.humanizedHrPerspectiveRaw || item.humanized_hr_perspective_raw ||
        (splitFieldsPresent ? "" :
        item.humanizedHrPerspective || item.humanized_hr_perspective));
  return approvedHumanized(modeText, status);
}

function humanizeMentorInsight(item = {}, context = {}) {
  const dbText = dbHumanizedPerspectiveForMode(item, context, "mentor");
  if (dbText && isApprovedPerspectiveSafeForContext(dbText, item, context)) {
    return finalizePerspectiveForContext(dbText, item, context, "mentor");
  }
  if (dbText) {
    return finalizePerspectiveForContext("", item, context, "mentor");
  }
  if (hasPerspectiveSplitFields(item, "mentor")) {
    return finalizePerspectiveForContext("", item, context, "mentor");
  }

  const rawSource = item.mentorInsight || item.I_insight || item.reason || item.mentorLens || item.P_mentor || "";
  const source = decontextualizeAdviceText(
    rawSource,
    ""
  );
  const family = perspectiveFamilyOf(item);
  const templates = MENTOR_TONE_TEMPLATES[family] || MENTOR_TONE_TEMPLATES.general;
  const template = detailAwareMentorTemplate(family, rawSource, item, context) ||
    templates[templateIndexForItem(item, templates.length)];
  const concrete = firstMeaningfulSentence(source, 72);
  if (!concrete) return finalizePerspectiveForContext(template, item, context, "mentor");
  if ((isReportLikePerspective(rawSource) || isReportLikePerspective(source)) && !isConversationalMentorText(concrete)) {
    return finalizePerspectiveForContext(template, item, context, "mentor");
  }
  if (isConversationalMentorText(concrete)) {
    return finalizePerspectiveForContext(cleanAndTruncate(concrete, 120, template), item, context, "mentor");
  }
  return finalizePerspectiveForContext(template, item, context, "mentor");
}

function humanizeHrPerspective(item = {}, context = {}) {
  const dbText = dbHumanizedPerspectiveForMode(item, context, "hr");
  if (dbText && isApprovedPerspectiveSafeForContext(dbText, item, context)) {
    return finalizeHrPerspectiveForContext(dbText, item, context);
  }
  if (dbText) {
    return finalizeHrPerspectiveForContext("", item, context);
  }
  if (hasPerspectiveSplitFields(item, "hr")) {
    return finalizeHrPerspectiveForContext("", item, context);
  }

  const rawSource = [
    item.hrPerspective || item.HR_os || item.hrPov || item.recruiterPerspective || item.recruiter_perspective || "",
    item.I_insight || item.mentorInsight || "",
  ].filter(Boolean).join(" ");
  const source = decontextualizeAdviceText(
    item.hrPerspective || item.HR_os || item.hrPov || item.recruiterPerspective || item.recruiter_perspective || "",
    ""
  );
  const family = perspectiveFamilyOf(item);
  const templates = HR_TONE_TEMPLATES[family] || HR_TONE_TEMPLATES.general;
  const detailTemplate = detailAwareHrTemplate(family, rawSource, item, context);
  const template = detailTemplate ||
    templates[templateIndexForItem(item, templates.length)];
  if (detailTemplate) return finalizeHrPerspectiveForContext(detailTemplate, item, context);
  if (!source) return finalizeHrPerspectiveForContext(template, item, context);
  const concise = firstMeaningfulSentence(source, 82);
  if (/^(我|这|如果|一条|关键词|排版|可验证|经验)/.test(concise) && concise.length <= 100) {
    return finalizeHrPerspectiveForContext(cleanAndTruncate(concise, 110, template), item, context);
  }
  return finalizeHrPerspectiveForContext(template, item, context);
}

function contextRoleForPerspective(context = {}) {
  const internal = context.internalAtsResult || context || {};
  const profile = internal.profile || {};
  return {
    roleFamily: profile.roleFamily || internal.roleFamily || "",
    targetRole: profile.targetRole || internal.jobTitle || internal.targetRole || "",
  };
}

function fallbackHrPerspectiveForContext(item = {}, context = {}) {
  return fallbackPerspectiveForContext(item, context, "hr");
}

function fallbackPerspectiveForContext(item = {}, context = {}, role = "hr") {
  const { roleFamily, targetRole } = contextRoleForPerspective(context);
  const careerGroup = careerGroupOf(roleFamily) || careerGroupOf(targetRole);
  const family = perspectiveFamilyOf(item);
  const toneTemplates = role === "mentor" ? MENTOR_TONE_TEMPLATES : HR_TONE_TEMPLATES;
  const pool = careerGroup === "design_creative"
    ? toneTemplates.portfolio
    : (toneTemplates[family] || toneTemplates.general);
  return pool[templateIndexForItem(item, pool.length)];
}

function isHrPerspectiveUnsafeForContext(text = "", item = {}, context = {}) {
  return isPerspectiveUnsafeForContext(text, item, context);
}

function isPerspectiveUnsafeForContext(text = "", item = {}, context = {}) {
  const { roleFamily, targetRole } = contextRoleForPerspective(context);
  if (!roleFamily && !targetRole) return false;
  return hasCrossRoleUnsafeAdvice({
    ...item,
    HR_os: text,
    hrPerspective: text,
    humanized_hr_perspective: text,
  }, roleFamily, targetRole);
}

function finalizeHrPerspectiveForContext(text = "", item = {}, context = {}) {
  return finalizePerspectiveForContext(text, item, context, "hr");
}

function finalizePerspectiveForContext(text = "", item = {}, context = {}, role = "hr") {
  const cleaned = cleanAndTruncate(text, 120, "");
  if (!cleaned) return fallbackPerspectiveForContext(item, context, role);
  if (!isPerspectiveUnsafeForContext(cleaned, item, context)) return cleaned;
  const toneTemplates = role === "mentor" ? MENTOR_TONE_TEMPLATES : HR_TONE_TEMPLATES;
  return cleanAndTruncate(
    fallbackPerspectiveForContext(item, context, role),
    120,
    toneTemplates.general[0]
  );
}

function normalizedPerspectiveKey(value = "") {
  return String(value || "")
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[，。；、,.!?;:："'“”‘’（）()\[\]{}<>]/g, "")
    .slice(0, 42);
}

function variantPerspective(item = {}, role = "hr", usedKeys = new Set()) {
  const family = perspectiveFamilyOf(item);
  const templates = role === "mentor"
    ? (MENTOR_TONE_TEMPLATES[family] || MENTOR_TONE_TEMPLATES.general)
    : (HR_TONE_TEMPLATES[family] || HR_TONE_TEMPLATES.general);
  for (let offset = 0; offset < templates.length; offset += 1) {
    const candidate = templates[(templateIndexForItem(item, templates.length) + offset) % templates.length];
    const key = normalizedPerspectiveKey(candidate);
    if (!usedKeys.has(key)) return candidate;
  }
  return templates[0];
}

function avoidRepeatedPerspectives(items = []) {
  const mentorKeys = new Set();
  const hrKeys = new Set();
  return (items || []).map((item) => {
    if (!item || typeof item !== "object") return item;
    const next = { ...item };
    const mentorText = next.mentorInsight || next.mentorLens || next.reason || "";
    const mentorKey = normalizedPerspectiveKey(mentorText);
    if (mentorKey && mentorKeys.has(mentorKey)) {
      const replacement = variantPerspective(next, "mentor", mentorKeys);
      next.mentorInsight = replacement;
      next.mentorLens = replacement;
      next.reason = next.reason || replacement;
    }
    const finalMentorKey = normalizedPerspectiveKey(next.mentorInsight || next.mentorLens || next.reason || "");
    if (finalMentorKey) mentorKeys.add(finalMentorKey);

    const hrText = next.hrPerspective || next.HR_os || "";
    const hrKey = normalizedPerspectiveKey(hrText);
    if (hrKey && hrKeys.has(hrKey)) {
      const replacement = variantPerspective(next, "hr", hrKeys);
      next.hrPerspective = replacement;
      next.HR_os = replacement;
    }
    const finalHrKey = normalizedPerspectiveKey(next.hrPerspective || next.HR_os || "");
    if (finalHrKey) hrKeys.add(finalHrKey);
    return next;
  });
}

function roleSafeActionSummary(row, retrievalQuery = {}) {
  if (hasConflictingRoleExamples(row, retrievalQuery)) {
    return "根据目标岗位维护不同版本简历，把最相关的技能、项目和关键词放到对应版本里。";
  }
  return row.A_action || row.action_summary;
}

function governanceContextFromInternal(internalAtsResult = {}) {
  const profile = internalAtsResult.profile || {};
  return {
    resumeText: internalAtsResult.resumeText || internalAtsResult.rawResumeText || "",
    jdText: internalAtsResult.jdText || internalAtsResult.retrievalQuery?.queryText || "",
    jobTitle: internalAtsResult.jobTitle || profile.targetRole || "",
    targetRole: profile.targetRole || internalAtsResult.jobTitle || "",
    roleFamily: profile.roleFamily || "",
  };
}

function governanceContextFromRetrievalQuery(retrievalQuery = {}) {
  const filters = retrievalQuery.filters || {};
  return {
    jdText: retrievalQuery.queryText || "",
    jobTitle: retrievalQuery.targetRole || "",
    targetRole: retrievalQuery.targetRole || "",
    roleFamily: retrievalQuery.roleFamily || (filters.roleFamily || [])[0] || "",
  };
}

function resolvedGovernedAction(card = {}, context = {}, fallback = "") {
  const resolved = actionGovernance.resolveDisplayAction(card, context);
  const actionSource = resolved.allowed === false ? resolved.action : (resolved.action || fallback);
  return {
    ...resolved,
    action: cleanAndTruncate(actionSource, 500, resolved.allowed === false ? "" : fallback),
  };
}

function shouldUseGeneralizedPerspective(card = {}, governedAction = {}) {
  return governedAction.usedMode === "generalized";
}

function generalizedMentorLensForCard(card = {}) {
  const family = canonicalActionFamilyOf(card);
  if (family === "experience_evidence") {
    return "项目和经历的价值不在于名字多亮，而在于招聘方能否看出你做了什么、怎么做、产出了什么，以及这些证据是否支撑目标岗位。";
  }
  if (family === "jd_keyword_alignment") {
    return "关键词只有放进真实经历里才有说服力。把 JD 里的能力要求转成项目或工作证据，比单纯堆词更容易通过人工筛选。";
  }
  if (family === "summary_positioning") {
    return "简历开头要先帮招聘方判断方向。定位清楚后，后面的项目、技能和经历才会被放在正确语境里理解。";
  }
  return "这条建议的重点是把原本零散的经历证据，改写成招聘方能快速判断价值的简历信息。";
}

function generalizedReasonForCard(card = {}) {
  const family = canonicalActionFamilyOf(card);
  if (family === "experience_evidence") {
    return "HR 和面试官扫经历时会找任务、方法和结果；只看到课程名、工具名或职责描述，会很难判断你的真实贡献。";
  }
  if (family === "jd_keyword_alignment") {
    return "ATS 能扫到词，但人工筛选会继续看这些词有没有出现在真实项目和工作场景里。";
  }
  return "去掉个案细节后，建议仍然保留原本的判断：让简历内容更具体、更可验证，也更贴近目标岗位。";
}

function generalizedHrPerspectiveForCard(card = {}) {
  const family = canonicalActionFamilyOf(card);
  if (family === "experience_evidence") {
    return "我看项目时不会只看你上过什么课或用过什么工具，我更在意你能不能把任务、过程和结果讲清楚。";
  }
  if (family === "jd_keyword_alignment") {
    return "关键词不是写给系统看的摆设；如果经历里没有对应证据，我会怀疑你只是照着 JD 填词。";
  }
  return "如果一条经历缺少上下文和结果，我会先把它当成弱信号，除非你能给出更具体的证据。";
}

function buildCardTitle(row) {
  if (row.canonical_title) return row.canonical_title;
  // Use full first sentence of P_mentor — stop at sentence-ending punctuation only
  const p = (row.advice_card_title || row.topic || "").trim();
  // Only break at definitive sentence ends (。！？), not commas/semicolons
  for (const sep of ["。", "！", "？"]) {
    const idx = p.indexOf(sep);
    if (idx > 0 && idx <= 80) return p.slice(0, idx + 1);
  }
  // If no sentence end found within 80 chars, return up to 80 chars at word boundary
  if (p.length > 80) {
    // Try to find a natural break point (comma/space) near 80 chars
    const cutPoint = p.slice(0, 80).lastIndexOf("，");
    return cutPoint > 40 ? p.slice(0, cutPoint) : p.slice(0, 80);
  }
  return p;
}

// Numbered option markers used in compound advice text (e.g. ①…；②…)
const COMPOUND_OPTION_RE = /[①②③④⑤]|（[123]）|\b[123][.)]\s/;

// Map each option in a compound advice string to conditions already satisfied by the resume.
// Returns a cleaned string with satisfied options removed; if only one option remains,
// strips the "choose one of the following" preamble.
function sanitizeCompoundAdviceText(text, resumeFacts) {
  if (!text || !resumeFacts || !COMPOUND_OPTION_RE.test(text)) return text;

  const sections = resumeFacts.sections || {};

  // Split on numbered markers, keeping the marker with each segment
  const parts = text.split(/((?:[①②③④⑤]|（[123]）|\b[123][.)]\s))/);
  // parts: [preamble, marker1, body1, marker2, body2, ...]
  if (parts.length < 5) return text; // need at least 2 options

  const preamble = parts[0];
  const options = [];
  for (let i = 1; i < parts.length - 1; i += 2) {
    options.push({ marker: parts[i], body: parts[i + 1] });
  }

  const isSatisfied = (body) => {
    const b = body.toLowerCase();
    if (/technical\s+skills?|技能.*板块|技能.*区|skills?\s*(section|板块|模块)|在.*education.*列.*skills?/i.test(b) && sections.hasSkills === true) return true;
    if (/summary|个人简介|顶部.*段落|加.*summary|写.*2[-–]?3\s*行/i.test(b) && sections.hasSummary === true) return true;
    return false;
  };

  const kept = options.filter((o) => !isSatisfied(o.body));
  if (kept.length === options.length) return text; // nothing removed
  if (kept.length === 0) return text; // all removed — leave as-is, gate should have blocked it

  if (kept.length === 1) {
    // Single option left — strip the "choose one" preamble and the marker
    const cleanedPreamble = preamble
      .replace(/选择以下\S*种方式之一[：:]/g, "")
      .replace(/以下\S*种方式[：:]/g, "")
      .replace(/两种方案[之一]*[：:]/g, "")
      .trimEnd();
    const body = kept[0].body.trimStart();
    return (cleanedPreamble ? cleanedPreamble + body : body).trim();
  }

  // Multiple options remain — re-assemble with original markers
  return preamble + kept.map((o, idx) => {
    const newMarker = ["①", "②", "③", "④", "⑤"][idx];
    return newMarker + o.body;
  }).join("");
}

function formatAdviceCardForPublic(row, retrievalQuery = {}) {
  const preliminary = resolvedGovernedAction(row, governanceContextFromRetrievalQuery(retrievalQuery), roleSafeActionSummary(row, retrievalQuery));
  const resumeFacts = retrievalQuery.resumeFacts || null;
  return {
    adviceId: row.id ? `seg_${row.id}` : row.chunk_id,
    chunkId: row.chunk_id || null,
    title: buildCardTitle(row),
    problemSummary: cleanAndTruncate(row.user_problem_summary || row.P_mentor, 180),
    actionSummary: decontextualizeActionText(sanitizeCompoundAdviceText(preliminary.action, resumeFacts) || ""),
    rawActionSummary: row.A_action || row.action_summary || "",
    mentorInsight: row.I_insight || "",
    example: row.E_example || "",
    hrPerspective: row.HR_os || "",
    topic: row.topic_slug || row.L2,
    mentorName: row.mentor_name,
    unlockTier: row.unlock_tier || "paid",
    safeToShowFree: Number(row.safe_to_show_free || 0) === 1,
    roleFamily: row.role_family || "",
    targetRoles: row.target_roles || "",
    relatedProblemTags: splitCsv(row.problem_tags),
    keywords: row.keywords || "",
    atsDimensions: row.ats_dimensions || "",
    dbPriority: row.priority,
    confidence: row.confidence || "",
    mentorQualityScore: row.mentor_quality_score,
    feedbackScore: row.feedback_score,
    requiresAiRewrite: Number(row.requires_ai_rewrite || 0) === 1,
    retrieval_score: row.retrieval_score,
    matched_reasons: row.matched_reasons || [],
    roleMismatchPenalty: row.roleMismatchPenalty || 0,
    conflictingExamplePenalty: row.conflictingExamplePenalty || 0,
    adviceScope: row.adviceScope || inferAdviceScope(row),
    adviceIntent: row.adviceIntent || inferAdviceIntent(row),
    mentor_title: row.mentor_title || null,
    mentor_career_keywords: row.mentor_career_keywords || null,
    mentor_career_path_display: row.mentor_career_path_display || null,
    mentor_company: row.mentor_company || null,
    retrievalScope: row.retrieval_scope || null,
    actionSpecificity: row.action_specificity || "",
    displayActionMode: row.display_action_mode || "",
    generalizedAction: row.generalized_action || "",
    activationRoleFamily: row.activation_role_family || "",
    activationKeywords: row.activation_keywords || "",
    groundingTerms: row.grounding_terms || "",
    canonicalActionFamily: row.canonical_action_family || "",
    actionDepth: row.action_depth || "",
    actionReviewStatus: row.action_review_status || "",
    actionSemanticReviewStatus: row.action_semantic_review_status || "",
    actionSemanticReviewSource: row.action_semantic_review_source || "",
    actionSemanticReviewConfidence: row.action_semantic_review_confidence || null,
    actionSemanticReviewIssues: row.action_semantic_review_issues || [],
    actionDisplayModeUsed: preliminary.usedMode,
    canonicalTitle: row.canonical_title || "",
    titleReviewStatus: row.title_review_status || "",
    titleSource: row.title_source || "",
    titleConfidence: row.title_confidence || null,
    humanizedMentorInsight: row.humanized_mentor_insight || "",
    humanizedHrPerspective: row.humanized_hr_perspective || "",
    humanizedMentorInsightRaw: row.humanized_mentor_insight_raw || "",
    humanizedHrPerspectiveRaw: row.humanized_hr_perspective_raw || "",
    humanizedMentorInsightGeneralized: row.humanized_mentor_insight_generalized || "",
    humanizedHrPerspectiveGeneralized: row.humanized_hr_perspective_generalized || "",
    perspectiveReviewStatus: row.perspective_review_status || "",
    perspectiveSource: row.perspective_source || "",
    perspectiveConfidence: row.perspective_confidence || null,
  };
}

function formatAdviceCard(row) {
  return formatAdviceCardForPublic(row, {});
}

function baseSelectSql(where, limit = 500) {
  return `
    SELECT
      id, chunk_id, topic, "L1", "L2", "P_mentor", "A_action", "I_insight", "H_hook", "E_example", "HR_os",
      advice_type, mentor_name, role_family, target_roles, seniority, ats_dimensions,
      problem_tags, keywords, topic_slug, retrieval_text, priority, unlock_tier,
      advice_card_title, user_problem_summary, action_summary, safe_to_show_free,
      requires_ai_rewrite, mentor_quality_score, feedback_score,
      mentor_title, mentor_career_keywords, mentor_career_path_display, mentor_company,
      retrieval_scope,
      action_specificity, display_action_mode, generalized_action,
      activation_role_family, activation_keywords, grounding_terms,
      canonical_action_family, action_depth, action_review_status,
      action_semantic_review_status, action_semantic_review_source,
      action_semantic_review_confidence, action_semantic_review_issues,
      canonical_title, title_review_status, title_source, title_confidence,
      to_jsonb(segments)->>'humanized_mentor_insight' AS humanized_mentor_insight,
      to_jsonb(segments)->>'humanized_hr_perspective' AS humanized_hr_perspective,
      to_jsonb(segments)->>'humanized_mentor_insight_raw' AS humanized_mentor_insight_raw,
      to_jsonb(segments)->>'humanized_hr_perspective_raw' AS humanized_hr_perspective_raw,
      to_jsonb(segments)->>'humanized_mentor_insight_generalized' AS humanized_mentor_insight_generalized,
      to_jsonb(segments)->>'humanized_hr_perspective_generalized' AS humanized_hr_perspective_generalized,
      to_jsonb(segments)->>'perspective_review_status' AS perspective_review_status,
      to_jsonb(segments)->>'perspective_source' AS perspective_source,
      NULLIF(to_jsonb(segments)->>'perspective_confidence', '')::numeric AS perspective_confidence
    FROM segments
    WHERE (${where})
      AND (retrieval_scope IS NULL OR retrieval_scope = 'resume_edit')
    LIMIT ${Number(limit) || 500}
  `;
}

function likeClauseForTerms(columns, terms, startIdx = 1) {
  const clauses = [];
  const params = [];
  let idx = startIdx;
  for (const term of [...new Set(terms)].filter(Boolean).slice(0, 30)) {
    const like = `%${term.replace(/_/g, "%")}%`;
    clauses.push(`(${columns.map((col) => `LOWER(COALESCE(${col},'')) LIKE $${idx++}`).join(" OR ")})`);
    params.push(...columns.map(() => like));
  }
  return { clause: clauses.length ? clauses.join(" OR ") : "1 = 0", params };
}

function exactProblemTagClause(terms, startIdx = 1) {
  const tags = normalizeProblemTagsForRetrieval(terms).slice(0, 20);
  if (!tags.length) return { clause: "1 = 0", params: [] };
  return {
    clause: `id IN (SELECT segment_id FROM segment_problem_tags WHERE problem_tag = ANY($${startIdx}::text[]))`,
    params: [tags],
  };
}

const RETRIEVAL_MATCH_COLUMNS = [
  "role_family",
  "target_roles",
  "problem_tags",
  "keywords",
  "ats_dimensions",
  "retrieval_text",
  "advice_card_title",
  "user_problem_summary",
  "\"A_action\"",
  "action_summary",
  "\"I_insight\"",
];

async function queryRows(pool, where, params, retrievalQuery, options = {}) {
  const startedAt = Date.now();
  const sqlLimit = Number(options.sqlLimit || process.env.MENTOR_RETRIEVAL_SQL_LIMIT || 800);
  const { rows } = await pool.query(baseSelectSql(where, sqlLimit), params);
  const queryMs = Date.now() - startedAt;
  if (process.env.MENTOR_RETRIEVAL_TIMING === "true" || queryMs > 8000) {
    console.log("[mentor-retrieval] sql", JSON.stringify({
      label: options.label || "queryRows",
      ms: queryMs,
      rows: rows.length,
      sqlLimit,
      params: params.length,
    }));
  }
  const userRoleFamily = (retrievalQuery?.filters?.roleFamily || []).find(r => r !== "universal")
    || retrievalQuery?.roleFamily || "";
  const userTargetRole = retrievalQuery?.targetRole || "";
  return rows
    .filter((row) => isEligibleForAtsResumeReport(row))
    .filter((row) => isRoleSafeForUser(row, userRoleFamily, userTargetRole))
    .map((row) => {
      const retrieval_score = calculateRetrievalScore(row, retrievalQuery);
      const matched_reasons = buildMatchedReasons(row, retrievalQuery);
      const roleMismatchPenalty = calculateRoleMismatchPenalty(row, retrievalQuery);
      const rowConflictPenalty = conflictingExamplePenalty(row, retrievalQuery);
      return formatAdviceCardForPublic({
        ...row,
        retrieval_score,
        matched_reasons,
        roleMismatchPenalty,
        conflictingExamplePenalty: rowConflictPenalty,
        adviceScope: inferAdviceScope(row),
        adviceIntent: inferAdviceIntent(row),
      }, retrievalQuery);
    });
}

function isHighRiskAtsGap(retrievalQuery = {}) {
  const tags = normalizeProblemTagsForRetrieval(retrievalQuery.problemTags);
  const text = `${retrievalQuery.queryText || ""} ${tags.join(" ")}`.toLowerCase();
  return tags.some((tag) => ["low_jd_keyword_match", "low_hard_skill_match", "weak_target_role_alignment", "missing_priority_keywords"].includes(tag)) ||
    /high|critical|low_jd|low_hard|keyword_gap/.test(text);
}

function isAccountingQuery(retrievalQuery = {}) {
  return queryRoleFamilies(retrievalQuery).some((term) => term === "accounting" || term === "finance");
}

function hasStrictSignal(card) {
  return card.matched_reasons.some((reason) => [
    "problem_tags",
    "ats_dimensions",
    "role_family",
    "target_roles",
    "keywords",
    "content_keywords",
  ].includes(reason));
}

function isGenericUniversalResumeAdvice(card) {
  const reasons = card.matched_reasons || [];
  const scopeAllowed = ["resume_ats", "resume_rewrite", "resume_strategy", "job_search_strategy"].includes(card.adviceScope);
  return scopeAllowed && reasons.includes("universal_fallback") && !reasons.includes("conflicting_role_examples");
}

function targetProblemsFromRetrievalQuery(retrievalQuery = {}) {
  return normalizeProblemTagsForRetrieval(retrievalQuery.problemTags).map((tag) => ({
    tag,
    severity: "medium",
    dimension: dimensionsFromProblemTags([tag])[0] || "overall",
    topic: "resume_ats",
  }));
}

function rankCandidates(candidates, limit, retrievalQuery = {}) {
  const targetProblemTags = targetProblemsFromRetrievalQuery(retrievalQuery);
  const scoredCandidates = candidates.filter((card) => card.retrieval_score > 0);
  const alignedCandidates = targetProblemTags.length
    ? scoredCandidates.filter((card) => isCardAlignedWithTargetProblems(card, targetProblemTags))
    : scoredCandidates;
  const candidatePool = alignedCandidates.length ? alignedCandidates : scoredCandidates;
  const exactProblemTagHits = candidatePool.filter((card) => (card.matched_reasons || []).includes("problem_tags"));
  return (exactProblemTagHits.length ? exactProblemTagHits : candidatePool)
    .sort((a, b) => compareCardsStable(a, b, targetProblemTags, new Set(), []))
    .slice(0, limit);
}

async function retrieveStrictCandidates(retrievalQuery = {}, options = {}) {
  const pool = options.pool || db.getPool();
  const filters = retrievalQuery.filters || {};
  const roleTerms = [
    ...splitCsv(filters.roleFamily),
    ...splitCsv(filters.targetRoles),
    ...splitCsv(retrievalQuery.priorityKeywords),
  ].filter((term) => term && term !== "unknown" && term !== "universal");
  const terms = [
    ...roleTerms,
    ...normalizeProblemTagsForRetrieval(retrievalQuery.problemTags),
    ...dimensionsFromProblemTags(retrievalQuery.problemTags),
  ].filter((term) => term && term !== "unknown" && term !== "universal");
  const { clause, params } = likeClauseForTerms(
    RETRIEVAL_MATCH_COLUMNS,
    terms
  );
  const { clause: roleClause, params: roleParams } = likeClauseForTerms(
    RETRIEVAL_MATCH_COLUMNS,
    roleTerms
  );
  const { clause: problemTagClause, params: problemTagParams } = exactProblemTagClause(
    retrievalQuery.problemTags
  );
  const [problemTagRows, broadRows, roleRows] = await Promise.all([
    queryRows(pool, problemTagClause, problemTagParams, retrievalQuery, { sqlLimit: options.problemTagSqlLimit || 200, label: "strict_problem_tags" }),
    queryRows(pool, clause, params, retrievalQuery, { sqlLimit: options.sqlLimit, label: "strict_broad" }),
    queryRows(pool, roleClause, roleParams, retrievalQuery, { sqlLimit: options.roleSqlLimit || options.sqlLimit, label: "strict_role" }),
  ]);
  const rows = [...new Map([...problemTagRows, ...roleRows, ...broadRows].map((card) => [card.adviceId, card])).values()]
    .filter(hasStrictSignal)
    .filter((card) => !card.matched_reasons.includes("conflicting_role_examples"))
    .filter((card) => card.roleMismatchPenalty < 0.35);
  return rankCandidates(rows, options.limit || 80, retrievalQuery);
}

async function retrieveFallbackCandidates(retrievalQuery = {}, options = {}) {
  const pool = options.pool || db.getPool();
  const terms = [
    ...normalizeProblemTagsForRetrieval(retrievalQuery.problemTags),
    ...splitCsv(retrievalQuery.priorityKeywords),
    ...dimensionsFromProblemTags(retrievalQuery.problemTags),
    "universal",
  ].filter(Boolean);
  const { clause, params } = likeClauseForTerms(
    ["seniority", ...RETRIEVAL_MATCH_COLUMNS],
    terms
  );
  const rows = (await queryRows(pool, clause, params, retrievalQuery, { sqlLimit: options.sqlLimit, label: "fallback" }))
    .filter(isGenericUniversalResumeAdvice)
    .filter((card) => !card.matched_reasons.includes("conflicting_role_examples"));
  return rankCandidates(rows, options.limit || 80, retrievalQuery);
}

async function retrieveMentorAdvice(retrievalQuery = {}, options = {}) {
  const limit = options.limit || 80;
  const pool = options.pool || db.getPool();
  const startedAt = Date.now();
  const timings = {};
  const includeDebugCounts = options.includeDebugCounts === true ||
    process.env.MENTOR_RETRIEVAL_DEBUG_COUNTS === "true";

  let rawRows = null;
  let eligibleRows = null;
  let excludedInterviewAdvice = null;
  if (includeDebugCounts) {
    const countStartedAt = Date.now();
    const [countResult, eligibleResult] = await Promise.all([
      pool.query("SELECT COUNT(*) AS count FROM segments"),
      pool.query("SELECT COUNT(*) AS count FROM segments WHERE retrieval_scope IS NULL OR retrieval_scope = 'resume_edit'"),
    ]);
    rawRows = parseInt(countResult.rows[0].count, 10);
    eligibleRows = parseInt(eligibleResult.rows[0].count, 10);
    timings.debugCountsMs = Date.now() - countStartedAt;
  }

  const [strictCandidates, fallbackCandidates] = await Promise.all([
    retrieveStrictCandidates(retrievalQuery, { ...options, pool, limit }),
    retrieveFallbackCandidates(retrievalQuery, { ...options, pool, limit }),
  ]);
  timings.queryCandidatesMs = Date.now() - startedAt;

  const byId = new Map();
  for (const candidate of [...strictCandidates, ...fallbackCandidates]) {
    const existing = byId.get(candidate.adviceId);
    if (!existing || compareCardsStable(candidate, existing, [], new Set(), []) < 0) {
      byId.set(candidate.adviceId, candidate);
    }
  }
  const candidates = rankCandidates([...byId.values()], limit, retrievalQuery);
  timings.totalMs = Date.now() - startedAt;
  if (process.env.MENTOR_RETRIEVAL_TIMING === "true" || timings.totalMs > 8000) {
    console.log("[mentor-retrieval] timing", JSON.stringify({
      totalMs: timings.totalMs,
      queryCandidatesMs: timings.queryCandidatesMs,
      debugCountsMs: timings.debugCountsMs || 0,
      strictCandidates: strictCandidates.length,
      fallbackCandidates: fallbackCandidates.length,
      selectedCandidates: candidates.length,
    }));
  }
  Object.defineProperty(candidates, "debug", {
    enumerable: false,
    value: {
      strictCandidates: strictCandidates.length,
      fallbackCandidates: fallbackCandidates.length,
      rawRows,
      eligibleRows,
      excludedInterviewAdvice,
      maxRoleMismatchPenalty: candidates.reduce((max, card) => Math.max(max, card.roleMismatchPenalty || 0), 0),
      selectedScope: candidates[0]?.adviceScope || "fallback",
      timings,
      retrievalQuery,
    },
  });
  return candidates;
}

function selectFreeAdvice(candidates, retrievalQuery = candidates?.debug?.retrievalQuery || {}) {
  const requireResumeIntent = isHighRiskAtsGap(retrievalQuery);
  const governanceContext = {
    ...governanceContextFromRetrievalQuery(retrievalQuery),
    resumeText: retrievalQuery.resumeText || retrievalQuery.rawResumeText || "",
  };
  const freeAdvice = candidates
    .filter((card) => card.unlockTier === "free" || card.safeToShowFree)
    .filter((card) => !["interview_prep", "behavioral_interview"].includes(card.adviceScope))
    .filter((card) => card.adviceIntent !== "application_timing")
    .filter((card) => {
      const resolved = actionGovernance.resolveDisplayAction(card, governanceContext);
      return Boolean(resolved.allowed && resolved.action);
    })
    .filter((card) => actionPreconditionGate(card, { retrievalQuery, resumeFacts: retrievalQuery.resumeFacts || null }).allowed)
    .filter((card) => !requireResumeIntent || FREE_HIGH_RISK_INTENTS.has(card.adviceIntent))
    .filter((card) => !card.matched_reasons?.includes("conflicting_role_examples"))
    .sort((a, b) => compareCardsStable(a, b, [], new Set(), []))[0];
  return freeAdvice || (isAccountingQuery(retrievalQuery) ? ACCOUNTING_FALLBACK_FREE_ADVICE : FALLBACK_FREE_ADVICE);
}

function selectPaidAdvice(candidates, freeAdvice, retrievalQuery = candidates?.debug?.retrievalQuery || {}) {
  const selected = [];
  const usedTopics = new Set();
  const freeId = freeAdvice?.adviceId;
  const governanceContext = {
    ...governanceContextFromRetrievalQuery(retrievalQuery),
    resumeText: retrievalQuery.resumeText || retrievalQuery.rawResumeText || "",
  };
  const paidCandidates = candidates
    .filter((card) => card.adviceId !== freeId)
    .filter((card) => !["interview_prep", "behavioral_interview"].includes(card.adviceScope))
    .filter((card) => {
      const resolved = actionGovernance.resolveDisplayAction(card, governanceContext);
      return Boolean(resolved.allowed && resolved.action);
    })
    .filter((card) => actionPreconditionGate(card, { retrievalQuery, resumeFacts: retrievalQuery.resumeFacts || null }).allowed)
    .filter((card) => !card.matched_reasons?.includes("conflicting_role_examples"))
    .sort((a, b) =>
      Number(b.unlockTier === "paid") - Number(a.unlockTier === "paid") ||
      compareCardsStable(a, b, [], new Set(), selected)
    );

  for (const card of paidCandidates) {
    if (selected.length >= 3) break;
    if (card.topic && usedTopics.has(card.topic)) continue;
    selected.push(card);
    if (card.topic) usedTopics.add(card.topic);
  }

  for (const card of paidCandidates) {
    if (selected.length >= 3) break;
    if (!selected.some((item) => item.adviceId === card.adviceId)) selected.push(card);
  }

  return selected.slice(0, 3);
}

function problemTagsFromInternal(internalAtsResult = {}) {
  return (internalAtsResult.problemTags || []).map((item) => ({
    tag: normalizeProblemTagForRetrieval(item.tag),
    originalTag: item.tag,
    severity: item.severity || "medium",
    dimension: item.dimension || "overall",
    topic: item.topic || "resume_ats",
    evidence: item.evidence,
  })).filter((item) => item.tag);
}

function obligationsFromInternal(internalAtsResult = {}) {
  const obligations = Array.isArray(internalAtsResult.adviceCoverageObligations)
    ? internalAtsResult.adviceCoverageObligations
    : [];
  if (!obligations.length) return problemTagsFromInternal(internalAtsResult);
  return obligations.map((item) => ({
    ...item,
    tag: normalizeProblemTagForRetrieval(item.tag),
    originalTag: item.tag,
    severity: item.severity || "medium",
    dimension: item.dimension || "overall",
    topic: item.topic || item.coverageFamily || "resume_ats",
    evidence: item.message || item.evidence,
    obligationId: item.id,
    keywords: item.keywords || [],
    required: item.required !== false,
    coverageFamily: item.coverageFamily || problemFamilyForTag(item.tag),
  })).filter((item) => item.tag);
}

function severityWeight(severity) {
  return { critical: 1, high: 0.85, medium: 0.55, low: 0.25 }[severity] ?? 0.4;
}

function targetSectionFromCard(card = {}) {
  const text = `${card.title || ""} ${card.problemSummary || ""} ${card.actionSummary || ""} ${card.topic || ""}`.toLowerCase();
  const actionFamily = card._actionFamily || inferAdviceActionFamily(card);
  if (actionFamily === "skills_section") return "skills";
  if (actionFamily === "summary_creation") return "summary";
  if (actionFamily === "summary_positioning") return "summary";
  if (actionFamily === "keyword_visibility" || actionFamily === "jd_terminology") return "overall";
  if (actionFamily === "project_evidence" && /project|项目/.test(text)) return "projects";
  if (/experience|bullet|经历|项目|证据/.test(text)) return "experience";
  if (/summary|定位|about/.test(text)) return "summary";
  if (/skill|关键词|keyword|工具/.test(text)) return "skills";
  if (/education|gpa|coursework|学校/.test(text)) return "education";
  if (/project|项目/.test(text)) return "projects";
  return "overall";
}

function priorityFromTags(tags = [], problemTags = []) {
  const severities = new Map(problemTags.map((item) => [item.tag, item.severity]));
  if (tags.some((tag) => ["critical", "high"].includes(severities.get(tag)))) return "high";
  if (tags.some((tag) => severities.get(tag) === "medium")) return "medium";
  return "low";
}

function priorityForLane(lane) {
  if (lane === "p0") return "high";
  if (lane === "p1") return "medium";
  return "low";
}

function priorityLaneFromSeverity(severity) {
  if (severity === "critical" || severity === "high") return "p0";
  if (severity === "medium") return "p1";
  return "p2";
}

function problemFamilyForTag(tag = "") {
  if (/jd|keyword|hard_skill|priority_keyword/.test(tag)) return "keyword";
  if (/missing_summary/.test(tag)) return "summary_missing";
  if (/summary|target_role|role_alignment|position|exact_job_title/.test(tag)) return "positioning";
  if (/experience|evidence|skills_only|bullet|project_details/.test(tag)) return "experience";
  if (/measurable|result|impact|action_verbs/.test(tag)) return "impact";
  if (/readability|format|section|pdf|file/.test(tag)) return "format";
  if (/portfolio|github|linkedin|contact|link/.test(tag)) return "links";
  if (/education|gpa|coursework/.test(tag)) return "education";
  return tag || "other";
}

function inferAdviceActionFamily(card = {}) {
  const text = [
    card.title,
    card.problemSummary,
    card.actionSummary,
    card.action,
    card.mentorInsight,
    card.topic,
    card.targetSection,
  ].filter(Boolean).join(" ").toLowerCase();

  if (/missing_summary|缺少\s*summary|没有\s*summary|新增\s*summary|补上\s*summary|add\s+(?:a\s+)?summary/.test(text)) return "summary_creation";
  if (/压缩至?一页|控制在一页|一页以内|行间距|字体|字号|页边距|删除不相关.*(活动|activity|获奖|award)|activity section|获奖记录/.test(text)) return "format_structure";
  if (/排序|顺序|置于前列|放到前面|靠前|提前|移至后面|移到后面|reorder|section order/.test(text)) return "section_relevance_order";
  if (/植入|嵌入|正文bullet|bullet point.*关键词|关键词.*bullet|关键词.*经历/.test(text)) return "keyword_in_experience";
  if (/时间最近|最新技术状态|保留.*项目|替换旧项目|筛选.*项目/.test(text)) return "project_selection";
  if (/加粗|高亮|bold|highlight/.test(text)) return "keyword_visibility";
  if (/(替换(?!旧项目)|轮换|同义|通用.*表达|terminology|术语|jd.*语言|关键词.*出现一次)/.test(text)) return "jd_terminology";
  if (/skills?|技能|skills区|skills版块|技能词条|package|工具.*列/.test(text)) return "skills_section";
  if (/逐句精读|逐条对比|逐条.*jd|对照jd|对照目标岗位|缺少哪些内容|哪些不匹配|分析.*匹配度|about the job|核心段落/.test(text)) return "jd_gap_audit";
  if (/单独准备|不同投递岗位|申请方向|每一个申请方向|定制简历版本|tailor简历|多个版本|素材库/.test(text)) return "resume_versioning";
  if (/反向推理|理想人才|人物画像|业务问题|用人部门|hiring manager/.test(text)) return "role_persona_alignment";
  if (/项目|project|交付|背景|situation|problem|整理后用于改写简历 bullet|经历.*重写|experience.*rewrite/.test(text)) return "project_evidence";
  if (/summary|headline|定位|岗位原词|职位名称|target role|positioning/.test(text)) return "summary_positioning";
  if (/量化|数字|result|impact|成果|metrics?/.test(text)) return "impact_metrics";
  if (/readability|可读|字太密|行数|1\s*到\s*2\s*行|3\s*到\s*5/.test(text)) return "readability";
  if (/pdf|word|格式|layout|版式|section|板块|版块|顺序/.test(text)) return "format_structure";
  if (/github|portfolio|linkedin|作品集|链接|link/.test(text)) return "profile_links";
  return "general_resume_edit";
}

function actionFamiliesForProblemFamily(family = "") {
  const map = {
    keyword: new Set([
      "keyword_in_experience",
      "keyword_visibility",
      "jd_terminology",
      "skills_section",
      "jd_gap_audit",
      "resume_versioning",
      "role_persona_alignment",
      "project_evidence",
      "summary_positioning",
      "section_relevance_order",
      "project_selection",
      "general_resume_edit",
    ]),
    positioning: new Set([
      "summary_creation",
      "summary_positioning",
      "resume_versioning",
      "role_persona_alignment",
      "section_relevance_order",
      "project_selection",
      "skills_section",
      "jd_terminology",
      "general_resume_edit",
    ]),
    summary_missing: new Set([
      "summary_creation",
      "summary_positioning",
      "general_resume_edit",
    ]),
    experience: new Set([
      "keyword_in_experience",
      "project_evidence",
      "impact_metrics",
      "readability",
      "section_relevance_order",
      "project_selection",
      "general_resume_edit",
    ]),
    impact: new Set([
      "impact_metrics",
      "project_evidence",
      "readability",
      "keyword_in_experience",
      "general_resume_edit",
    ]),
    format: new Set([
      "format_structure",
      "readability",
      "section_relevance_order",
      "project_selection",
      "keyword_visibility",
      "general_resume_edit",
    ]),
    links: new Set(["profile_links", "general_resume_edit"]),
    education: new Set([
      "format_structure",
      "section_relevance_order",
      "skills_section",
      "project_evidence",
      "general_resume_edit",
    ]),
  };
  return map[family] || new Set(["general_resume_edit"]);
}

function isActionFamilyCompatibleWithProblems(card = {}, targetProblemTags = []) {
  const related = relatedTagsForCard(card, targetProblemTags);
  if (!related.length) return false;
  const actionFamily = card._actionFamily || inferAdviceActionFamily(card);
  const actionText = card.action || card.actionSummary || "";
  if (actionText && !related.some((tag) => actionMatchesProblemTag(tag, actionText))) return false;
  return related.some((tag) => actionFamiliesForProblemFamily(problemFamilyForTag(tag)).has(actionFamily));
}

function forceAdvicePriority(item, priority) {
  item.priority = priority;
  item.priorityLabel = priorityLabel(priority);
  return item;
}

function resolveHrPerspective(item = {}) {
  const raw = decontextualizeAdviceText(
    item.hrPerspective ||
    item.HR_os ||
    item.hrPov ||
    item.recruiterPerspective ||
    item.recruiter_perspective ||
    "",
    ""
  );
  return cleanAndTruncate(raw, 140, "");
}

function normalizePremiumAdvicePriorities(mentors = []) {
  const items = mentors.slice(1).flatMap((mentor) => mentor.adviceItems || []);
  items.forEach((item, index) => {
    const priority = index < 2 ? "high" : index < 5 ? "medium" : "low";
    forceAdvicePriority(item, priority);
  });
  return mentors;
}

function sortProblemsStable(a, b) {
  const diff = severityWeight(b.severity) - severityWeight(a.severity);
  if (Math.abs(diff) > 1e-9) return diff;
  return String(a.tag || "").localeCompare(String(b.tag || ""));
}

function stableAdviceKey(card = {}) {
  const raw = String(card.adviceId || card.chunk_id || card.id || "");
  const numeric = raw.match(/\d+/)?.[0];
  return `${numeric ? numeric.padStart(10, "0") : "9999999999"}:${raw}`;
}

function renderedCardTitle(card = {}, targetProblemTags = []) {
  return titleGovernance.bestDisplayTitle(
    card,
    titleForCurrentProblem(relatedTagsForCard(card, targetProblemTags), card)
  );
}

function dbPriorityScore(card = {}) {
  const numeric = Number(card.dbPriority ?? card.priorityRank);
  return Number.isFinite(numeric) ? -numeric / 100 : 0;
}

function priorityLabel(priority) {
  if (priority === "high" || priority === "critical") return "必改";
  if (priority === "medium") return "建议改";
  return "补充";
}

function getInternalKeywordCount(internalAtsResult = {}) {
  const explicit = internalAtsResult.keywordMatchCount || internalAtsResult.publicReport?.keywordMatchCount;
  if (explicit && Number.isFinite(Number(explicit.total)) && Number(explicit.total) > 0) {
    return { matched: Number(explicit.matched || 0), total: Number(explicit.total) };
  }
  const cats = internalAtsResult.keywordMatch?.categories || {};
  const count = Object.values(cats).reduce((acc, cat = {}) => {
    const matched = Number(cat.matched || (cat.matchedTerms || []).length || 0);
    const total = Number(cat.total || matched + ((cat.missing || []).length || 0));
    acc.matched += matched;
    acc.total += total;
    return acc;
  }, { matched: 0, total: 0 });
  return count.total > 0 ? count : null;
}

function sectionHintForProblemTag(targetProblemTags = [], tagName = "") {
  const target = targetProblemTags.find((item) => (item.tag || item) === tagName);
  if (!target || typeof target === "string") return "";
  const text = [
    target.topic,
    ...(Array.isArray(target.evidence) ? target.evidence : [target.evidence]),
  ].filter(Boolean).join(" ").toLowerCase();
  if (/education|school|degree|gpa|coursework|university|college|教育|学校|學校|学历|學歷/.test(text)) return "Education";
  if (/project|projects|portfolio|github|项目|專案|作品/.test(text)) return "Projects";
  if (/experience|work|employment|internship|经历|經歷|工作|实习|實習/.test(text)) return "Experience";
  if (/activity|activities|leadership|volunteer|活动|活動|志愿/.test(text)) return "Activities";
  return "";
}

function generateUserDiagnosis(relatedProblemTags = [], targetProblemTags = [], internalAtsResult = {}, usedDiagnosisTags = new Set()) {
  const dims = internalAtsResult.dimensions || {};
  const missingKw = (internalAtsResult.topMissingKeywords || internalAtsResult.topMissingKw || []).slice(0, 3);
  const jobTitle = internalAtsResult.jobTitle || internalAtsResult.profile?.targetRole || "目标岗位";
  const keywordCount = getInternalKeywordCount(internalAtsResult);
  const keywordCountText = keywordCount ? `（当前 ${keywordCount.matched}/${keywordCount.total}）` : "";
  const jdRatio = internalAtsResult.jdMatchRatio != null
    ? Math.round(internalAtsResult.jdMatchRatio)
    : internalAtsResult.keywordMatch?.summary?.overallKeywordCoverage != null
      ? Math.round(internalAtsResult.keywordMatch.summary.overallKeywordCoverage * 100)
      : null;

  const diagnoses = {
    low_jd_keyword_match: () =>
      `简历与目标 JD 的关键词匹配偏低${keywordCountText || (jdRatio != null ? `（当前约 ${jdRatio}%）` : "")}，ATS 扫描时匹配信号不够强，容易在第一轮被过滤。`,
    low_hard_skill_match: () =>
      `目标岗位的核心技能词${missingKw.length ? `（如 ${missingKw.join("、")}）` : ""}在简历中出现不足，ATS 难以确认你的技能匹配度。`,
    missing_exact_job_title: () =>
      `简历中缺少"${jobTitle}"作为精确职位名称，ATS 按岗位原词检索时可能会排除你的简历。`,
    missing_priority_keywords: () =>
      `简历缺少目标岗位优先级较高的关键词${missingKw.length ? `（如 ${missingKw.join("、")}）` : ""}，这些词在 ATS 中权重较高。`,
    weak_summary_role_alignment: () =>
      `Summary 段落与目标岗位"${jobTitle}"的定位关联不够直接，HR 初筛时难以快速识别你的求职方向。`,
    weak_target_role_alignment: () =>
      `简历整体对"${jobTitle}"的方向匹配度偏弱，需要更系统地对照 JD 调整定位和关键词。`,
    weak_experience_keyword_evidence: () =>
      `经历 bullet 中目标岗位的核心技能证据不足，技能更多出现在 Skills 栏，缺少在实际工作中使用它们的成果佐证。`,
    keywords_only_in_skills: () =>
      `核心技能词主要集中在 Skills 栏，在 Experience 的 bullet 里缺少通过实际成果呈现它们的记录，说服力较弱。`,
    resume_not_tailored_to_jd: () =>
      `简历内容与目标 JD 的针对性不足，未能体现对"${jobTitle}"关键词和要求的专项对应。`,
    missing_portfolio: () =>
      `当前简历没有清楚呈现作品集或可点击的项目展示入口，设计/创意类岗位会因此少一个关键评估信号。`,
    missing_linkedin: () =>
      `简历中缺少 LinkedIn 等职业资料链接，HR 难以快速补充查看你的背景和经历可信度。`,
    missing_github_link: () =>
      `简历中缺少代码仓库或项目链接，技术岗位的项目可信度和可验证性会被削弱。`,
    uploaded_non_pdf_format: () =>
      `当前提交格式可能影响简历排版稳定性，HR 或 ATS 看到的版面不一定与你预期一致。`,
    first_person_summary: () =>
      `Summary 中存在第一人称表达，英文简历里会显得不够职业化，建议改成更客观的岗位定位句。`,
    low_measurable_results: () =>
      `经历描述里可量化结果不足，HR 很难判断你具体带来了什么影响或产出。`,
    weak_result_orientation: () =>
      `经历 bullet 偏向描述职责，缺少结果、影响或业务价值，读起来不够有说服力。`,
    weak_action_verbs: () =>
      `bullet 开头动词偏弱，主动性和贡献感不够突出。`,
    vague_project_details: () =>
      `项目描述缺少背景、方法和产出细节，读者难以判断项目规模、技术深度或实际价值。`,
    education_details_missing: () =>
      `教育背景或课程信息没有充分服务目标岗位，相关课程、训练或证书信号还可以更清楚。`,
    low_soft_skill_match: () =>
      `简历中与岗位相关的沟通、协作或 stakeholder 经验呈现不足，软技能证据不够具体。`,
    partial_china_experience: () =>
      `简历中有部分经历来自中国或非目标市场，需要把工具、场景和成果写得更容易被目标市场 HR 理解。`,
    all_china_experience: () =>
      `简历的核心经历主要来自中国或非目标市场，需要更主动说明这些经历如何迁移到目标岗位和目标市场。`,
    missing_section_dates: () => {
      const section = sectionHintForProblemTag(targetProblemTags, "missing_section_dates");
      return section
        ? `${section} section 中有条目缺少日期，ATS 和招聘者无法判断这段经历的时间线和新旧程度。`
        : `简历中有 Experience、Education、Projects 或 Activities 条目缺少日期，ATS 和招聘者无法判断时间线和经历新旧。`;
    },
  };

  const unusedTags = relatedProblemTags.filter(t => diagnoses[t] && !usedDiagnosisTags.has(t));
  const tagPool = unusedTags.length ? unusedTags : relatedProblemTags;
  for (const tag of tagPool) {
    if (diagnoses[tag]) {
      usedDiagnosisTags.add(tag);
      return diagnoses[tag]();
    }
  }

  // Generic fallback: point to weakest dimension
  const weakDimLabels = { A: "格式规范", B: "基本资料", C: "内容质量", D: "JD 关键词匹配", E: "市场适配度", F: "经验匹配度" };
  const dimEntries = Object.entries(dims)
    .map(([k, v]) => ({ k, pct: v.max > 0 ? v.score / v.max : 1 }))
    .sort((a, b) => (a.pct - b.pct) || a.k.localeCompare(b.k));
  if (dimEntries.length && dimEntries[0].pct < 0.65 && weakDimLabels[dimEntries[0].k]) {
    return `简历在「${weakDimLabels[dimEntries[0].k]}」维度得分偏低，这是影响 ATS 通过率的主要因素之一。`;
  }
  return `简历与目标岗位的匹配信号还不够集中，建议重点对照 JD 优化关键词和成果表达。`;
}

// ── Personalize a generic DB diagnosis with user-specific resume context ──────
// Injects job title, missing keywords, and ATS score into the summary
// so it feels tailored rather than generic.
function shouldAppendKeywordContext(diagnosis, relatedProblemTags = []) {
  const text = String(diagnosis || "").toLowerCase();
  if (/first person|第一人称|format|格式|font|spacing|length|页|标点|grammar|语法|拼写|排版/.test(text)) return false;
  if ((relatedProblemTags || []).some((tag) => /jd_keyword|keyword|hard_skill|priority_keyword|target_role|role_alignment|summary/.test(tag))) return true;
  return /jd|ats|keyword|关键词|skills?|summary|岗位|职位|role|position|定位|匹配/.test(text);
}

function personalizeDiagnosis(diagnosis, internalAtsResult = {}, relatedProblemTags = []) {
  if (!diagnosis) return diagnosis;
  const jobTitle = internalAtsResult.jobTitle || internalAtsResult.profile?.targetRole || "";
  const missingKw = (internalAtsResult.topMissingKeywords || internalAtsResult.topMissingKw || []).slice(0, 3);
  const jdRatio = internalAtsResult.jdMatchRatio != null
    ? Math.round(internalAtsResult.jdMatchRatio)
    : internalAtsResult.keywordMatch?.summary?.overallKeywordCoverage != null
      ? Math.round(internalAtsResult.keywordMatch.summary.overallKeywordCoverage * 100)
      : null;

  let result = diagnosis;

  // Inject job title if missing from diagnosis
  if (jobTitle && !result.includes(jobTitle)) {
    result = result.replace(/目标岗位/g, `"${jobTitle}"`) || result;
  }

  // Append a personalized sentence with concrete user data
  const additions = [];
  if (shouldAppendKeywordContext(result, relatedProblemTags)) {
    if (jdRatio != null && jdRatio < 75 && !/\d+%/.test(result)) {
      additions.push(`简历 JD 关键词匹配率约 ${jdRatio}%`);
    }
    if (missingKw.length > 0 && !missingKw.some(kw => result.includes(kw))) {
      additions.push(`缺少如 ${missingKw.join("、")} 等高频词`);
    }
  }
  if (additions.length > 0) {
    result = result.replace(/[。！]$/, "") + `（${additions.join("，")}）。`;
  }

  return result;
}

// ── Multiple P_mentor variations ─────────────────────────────────────────────
// Randomly vary the framing of common diagnosis types so repeat users
// see fresh phrasing instead of the same sentence every time.
const DIAGNOSIS_VARIANTS = {
  generic_resume_positioning: [
    "目前简历版本通用性过强，无法有效针对每个具体岗位的关键词要求。",
    "一份简历投所有岗位的策略在当下竞争环境中效果有限，建议按方向维护多个版本。",
    "简历缺少对目标岗位的针对性调整，HR 很难快速判断你是否匹配这个岗位。",
  ],
  low_measurable_results: [
    "简历中经历描述以职责为主，缺少可量化的结果数据，HR 难以评估实际贡献。",
    "每条 bullet 缺少数字支撑，读起来像任务清单而非成就展示。",
    "简历描述偏向「做了什么」，缺少「做出了什么成果」，说服力不足。",
  ],
  weak_action_verbs: [
    "经历描述中动词选择偏弱（如「负责」「参与」），缺少展示主动性的强动词。",
    "bullet 开头动词过于被动，建议用更有力的动词替换（如 Led、Built、Reduced）。",
    "简历用词较为普通，强动词能让 HR 在扫描时更快抓到你的价值点。",
  ],
};

function variantDiagnosis(diagnosis, problemTags = []) {
  for (const tag of problemTags) {
    const variants = DIAGNOSIS_VARIANTS[tag];
    if (variants && variants.length > 1) {
      // Use a deterministic-ish index based on diagnosis length to avoid true randomness
      const idx = diagnosis.length % variants.length;
      return variants[idx];
    }
  }
  return diagnosis;
}

function isBucketRoleSafe(bucket, targetRoleFamily) {
  if (!targetRoleFamily || targetRoleFamily === "unknown") return true;
  const families = bucket.roleFamilies || [];
  // Allow universal content or buckets with no role tags (old data)
  if (families.length === 0) return true;
  if (families.includes("universal")) return true;
  return families.includes(normalizeTerm(targetRoleFamily));
}

function relatedTagsForCard(card = {}, targetProblemTags = []) {
  const cardProblemTags = splitCsv(card.relatedProblemTags || card.problemTags || card.problem_tags || []);
  const text = `${card.title || ""} ${card.problemSummary || ""} ${card.actionSummary || ""} ${card.topic || ""} ${card.adviceIntent || ""}`.toLowerCase();
  const targetTagSet = new Set(targetProblemTags.map((item) => item.tag || item).filter(Boolean));
  const tags = cardProblemTags.filter((tag) => targetTagSet.has(tag));
  const bulletReadabilityAdvice = isBulletReadabilityAdvice(card);
  for (const problem of targetProblemTags) {
    const tag = problem.tag || problem;
    if (!tag) continue;
    if (tags.includes(tag)) continue;
    if (text.includes(tag.replace(/_/g, " "))) tags.push(tag);
    // Only match keyword/ATS tags if the card is specifically about JD/keyword matching, not generic format cards
    else if (/keyword|关键词|jd match|岗位匹配|ats.*keyword/.test(text) && /keyword|jd|hard_skill|priority/.test(tag)) tags.push(tag);
    else if (/岗位原词|精确职位|职位名称|job title|exact title|exact job title/.test(text) && /exact_job_title|job_title/.test(tag)) tags.push(tag);
    else if (!bulletReadabilityAdvice && /summary|定位|position|求职方向|目标方向/.test(text) && /summary|role_alignment|target_role|position/.test(tag)) tags.push(tag);
    else if (bulletReadabilityAdvice && /readability|bullet|experience|evidence|format|measurable|result|action_verbs|project_details/.test(tag)) tags.push(tag);
    else if (/experience|bullet|经历|证据/.test(text) && /experience|evidence|skills_only/.test(tag)) tags.push(tag);
    else if (/量化|result|impact|成果/.test(text) && /measurable|result|action/.test(tag)) tags.push(tag);
    else if (/linkedin|portfolio|github|code profile|searchability/.test(text) && /linkedin|portfolio|github|code|searchability/.test(tag)) tags.push(tag);
  }
  if (!targetTagSet.has("uploaded_non_pdf_format")) {
    return [...new Set(tags)].filter((tag) => tag !== "uploaded_non_pdf_format").slice(0, 3);
  }
  return [...new Set(tags)].slice(0, 3);
}

function isBulletReadabilityAdvice(card = {}) {
  const text = [
    card.title,
    card.problemSummary,
    card.actionSummary,
    card.action,
    card.mentorInsight,
    card.hrPerspective,
    card.topic,
  ].filter(Boolean).join(" ").toLowerCase();
  const talksAboutBullets = /bullet|point|经历|experience/.test(text);
  const talksAboutDensity = /readability|可读|字太密|行数|1\s*到\s*2\s*行|3\s*到\s*5|一到两行|三到五/.test(text);
  return talksAboutBullets && talksAboutDensity;
}

function titleForCurrentProblem(relatedProblemTags = [], card = {}) {
  const tags = new Set(relatedProblemTags);
  const text = `${card.title || ""} ${card.problemSummary || ""} ${card.actionSummary || ""} ${card.action || ""} ${card.topic || ""}`.toLowerCase();
  if (tags.has("missing_summary")) return "先补上 Summary 段落";
  if (tags.has("missing_exact_job_title")) return "补上目标岗位原词";
  if (tags.has("generic_resume_positioning") || tags.has("low_role_specificity")) return "聚焦目标岗位定位";
  const hasKeywordProblem = tags.has("low_jd_keyword_match") || tags.has("missing_priority_keywords") || tags.has("low_hard_skill_match");
  if (hasKeywordProblem && /排序|顺序|置于前列|放到前面|靠前|提前|移至后面|移到后面|reorder|section order/.test(text)) return "重排最相关项目与技能";
  if (hasKeywordProblem && /植入|嵌入|正文bullet|bullet point.*关键词|关键词.*bullet|关键词.*经历/.test(text)) return "把关键词嵌入经历 bullet";
  if (hasKeywordProblem && /时间最近|最新技术状态|保留.*项目|替换旧项目|筛选.*项目/.test(text)) return "优先保留最新相关项目";
  if (hasKeywordProblem && /(替换(?!旧项目)|轮换|同义|通用.*表达|terminology|术语)/.test(text)) return "把术语改成 JD 语言";
  if (hasKeywordProblem && /skills?|技能|skills区|skills版块|技能词条/.test(text)) return "整理 Skills 关键词";
  if (hasKeywordProblem && /逐句精读|逐条对比|逐条.*jd|对照jd|对照目标岗位|缺少哪些内容|哪些不匹配|分析.*匹配度|about the job|核心段落/.test(text)) return "逐条对照 JD 缺口";
  if (hasKeywordProblem && /单独准备|不同投递岗位|申请方向|每一个申请方向|定制简历版本|tailor简历|多个版本|素材库/.test(text)) return "按申请方向维护简历版本";
  if (hasKeywordProblem && /反向推理|理想人才|人物画像|业务问题|用人部门|hiring manager/.test(text)) return "按岗位画像调整简历";
  if (hasKeywordProblem && /项目|project|交付|背景|problem|situation|整理后用于改写简历 bullet/.test(text)) return "把项目证据写进 bullet";
  if (hasKeywordProblem && /加粗|高亮|bold|highlight/.test(text)) return "突出 JD 核心关键词";
  if ((tags.has("low_jd_keyword_match") || tags.has("missing_priority_keywords") || tags.has("low_hard_skill_match")) &&
      /keyword|关键词|jd|ats|skills?|技能|加粗|高亮/.test(text)) return "补齐 JD 关键词证据";
  if ((tags.has("weak_summary_role_alignment") || tags.has("weak_target_role_alignment")) &&
      /summary|定位|岗位原词|职位名称|target role|position/.test(text)) return "让 Summary 更贴近目标岗位";
  if (tags.has("low_jd_keyword_match") || tags.has("missing_priority_keywords") || tags.has("low_hard_skill_match")) return "补齐 JD 关键词证据";
  if (tags.has("weak_experience_keyword_evidence") || tags.has("keywords_only_in_skills")) return "把技能写进经历 bullet";
  if (tags.has("missing_portfolio")) return "补上作品集入口";
  if (tags.has("missing_github_link")) return "补上项目或代码链接";
  if (tags.has("missing_linkedin")) return "补上 LinkedIn 链接";
  if (tags.has("uploaded_non_pdf_format")) return "稳定简历提交格式";
  if (tags.has("first_person_summary")) return "改掉 Summary 第一人称";
  if (tags.has("low_measurable_results") || tags.has("weak_result_orientation")) return "强化 bullet 的结果表达";
  if (tags.has("weak_action_verbs")) return "替换更有力的 action verbs";
  if (tags.has("education_details_missing")) return "调整教育背景信息";
  if (tags.has("all_china_experience")) return "强化美国市场可信经历";
  if (tags.has("career_growth_optimization")) return "补强成长轨迹";
  if (tags.has("missing_section_dates")) return "补齐经历日期";
  return titleGovernance.bestDisplayTitle(card, card.title || card.advice_card_title || "");
}

function decontextualizeAdviceText(value, fallback = "") {
  let text = String(value || "").replace(/\s+/g, " ").trim();
  if (!text) return fallback;
  text = text
    .replace(/^导师\s*/i, "")
    .replace(/^(学生|求职者|候选人)/g, "你")
    .replace(/\bHR\s+这人方向对了\b/gi, "")
    .replace(/导师\s*["“][^"”]{1,80}["”]\s*/g, "")
    .replace(/就因为|好像|对吧|就是；|I should know it\.?/gi, "")
    .replace(/阅读(?:CITI|Yale|Amazon|Google|Meta|Microsoft|Apple|TikTok|ByteDance|NVIDIA|Artisk)[^，。；;]{0,60}(?:，|。|；|;)?/gi, "阅读目标 JD，")
    .replace(/\b(CITI|Yale|Artisk|Amazon|Google|Meta|Microsoft|Apple|TikTok|ByteDance|NVIDIA)\b/g, "目标公司")
    .replace(/[（(]如[^）)]*(?:药厂|电商|solution engineer|marketing analytics|marketing general|business sense|产品分析|sharpe ratio|financial analyst|quant|embedded)[^）)]*[）)]/gi, "")
    .replace(/如\s*Java、machine learning、LLM\s*等/gi, "目标 JD 中的核心技术词")
    .replace(/和面试回答/g, "")
    .replace(/整理后提交给导师[^。.!?]*(。|\.|!|\?)?/g, "整理后用于改写简历 bullet。")
    .replace(/学生|求职者|候选人/g, "你")
    .replace(/岗位你/g, "岗位")
    .replace(/\s+/g, " ")
    .replace(/[，,；;]\s*[，,；;]/g, "，")
    .replace(/^\s*[，,；;。]\s*/, "")
    .trim();
  return cleanAndTruncate(text, 500, fallback);
}

/**
 * decontextualizeActionText
 *
 * Strips student-specific parenthetical examples from action text before display.
 * These examples were valid advice for the original student but would confuse
 * other users who see different project/company names than their own.
 *
 * Keeps generic tool/skill examples: （如Excel、Python、SQL）
 * Strips student-specific project/client names:
 *   - （如Dyson和diffuser项目中的3D建模...）   — brand/product names
 *   - （如fake news project和校园park track项目）— named personal projects
 *   - （如 E Commerce Consumer Analysis、Yoyo Engagement Optimization）— project titles
 *   - （如：中东small cap公司，总资产1.42亿...） — specific client context
 */
/**
 * decontextualizeActionText
 *
 * Strips student-specific parenthetical examples from action text.
 * Keeps generic tool/skill examples: （如Excel、Python、SQL）
 * Strips student-specific content:
 *   - "（如Dyson和diffuser项目中的...）"  — named projects joined by 和/与
 *   - "（如：中东small cap公司，总资产1.42亿...）" — colon + specific client context
 *   - "（如 E Commerce Consumer Analysis、Yoyo Engagement Optimization）"
 *     — English multi-word project titles (has spaces, no Chinese chars)
 */
function decontextualizeActionText(text = "") {
  let t = String(text || "").trim();
  if (!t) return t;
  t = t
    // Pattern 1: "（如X和Y项目...）" — named projects joined by 和/与
    .replace(/（如[^）]{0,100}(?:和|与)[^）]{0,60}项目[^）]*）/g, "")
    // Pattern 2: "（如：long specific context）" — colon-introduced specific context
    .replace(/（如[：:][^）]{15,200}）/g, "")
    // Pattern 3: "（如EnglishMultiWordProject、AnotherProject）"
    //   — English multi-word phrases (has spaces) with no Chinese chars = likely project titles
    .replace(/（如\s*([A-Za-z][A-Za-z0-9\s,、&/-]{8,})\s*）/g, (match, content) => {
      const hasChinese = /[一-鿿]/.test(content);
      const hasInternalSpace = /[ \t]/.test(content.trim());
      return (!hasChinese && hasInternalSpace) ? "" : match;
    })
    .replace(/\s+/g, " ")
    .replace(/，，/g, "，")
    .replace(/，\s*。/g, "。")
    .trim();
  return t;
}

function isSystemPlaceholderAdviceText(value = "") {
  const text = String(value || "");
  return /当前报告可用的导师建议不足\s*12\s*条|导师建议不足\s*12\s*条|简历优化建议\s*\d+|report-fallback/i.test(text);
}

function isMostlyEnglishAction(value = "") {
  const text = String(value || "").trim();
  if (!text) return false;
  const cjk = (text.match(/[\u4e00-\u9fff]/g) || []).length;
  if (cjk >= 8) return false;
  const letters = (text.match(/[A-Za-z]/g) || []).length;
  const words = (text.match(/\b[A-Za-z][A-Za-z'-]*\b/g) || [])
    .filter((word) => !/^(ATS|JD|Summary|Skills|Experience|Projects?|Education|HR|PDF|LinkedIn|GitHub|bullet)$/i.test(word));
  return letters >= 32 && words.length >= 5;
}

function chineseActionFallbackForCard(card = {}, defaultAction = "") {
  const candidates = [
    card.generalizedAction,
    card.generalized_action,
    actionGovernance.buildGeneralizedAction(card),
    defaultAction,
  ].map((item) => String(item || "").trim()).filter(Boolean);
  const chineseCandidate = candidates.find((item) => /[\u4e00-\u9fff]/.test(item) && !isMostlyEnglishAction(item));
  if (chineseCandidate) return chineseCandidate;
  const family = canonicalActionFamilyOf(card);
  const fallbacks = {
    summary_creation: "先新增 2-3 行 Summary：第一句写目标岗位，第二句连接你最相关的经历、技能和可量化成果。",
    summary_positioning: "先把 Summary 改成目标岗位导向：写出目标岗位原词，并用一句话连接你的经历与 JD 核心职责。",
    jd_keyword_alignment: "对照 JD 提取真实掌握的核心关键词，把它们补进 Skills，并写进最相关的 Experience bullet。",
    experience_evidence: "选择最相关的一段经历，把 bullet 改成「动作 + 方法/工具 + 结果」结构，让关键词有真实证据支撑。",
    quantified_impact: "为核心 bullet 补充数量、频率、规模、效率或结果，让 HR 能判断你的实际贡献。",
    skills_section: "重排 Skills，把目标 JD 最需要且你真实掌握的技能放在前面，并删除干扰定位的弱相关技能。",
    education_signal: "只保留和目标岗位相关的课程、证书或训练成果，并说明它们如何支撑岗位要求。",
    format_cleanup: "统一简历格式、日期和 section 结构，优先保证 ATS 可解析、HR 可快速扫描。",
    profile_links: "在简历头部补齐可验证资料入口，并确保链接、联系方式和文件格式稳定可用。",
  };
  return fallbacks[family] || "围绕目标岗位重新检查这部分内容，把最相关的职责、关键词和结果证据写得更明确。";
}

function normalizeDisplayActionLanguage(action = "", card = {}, defaultAction = "") {
  const text = cleanAndTruncate(action, 500, defaultAction);
  if (!text || isSystemPlaceholderAdviceText(text) || isMostlyEnglishAction(text)) {
    return cleanAndTruncate(chineseActionFallbackForCard(card, defaultAction), 500, defaultAction);
  }
  return text;
}

function displayTargetRole(internalAtsResult = {}, fallback = "目标岗位") {
  return internalAtsResult.jobTitle ||
    internalAtsResult.profile?.targetRole ||
    internalAtsResult.metrics?.checks?.exactJobTitle?.targetTitle ||
    fallback;
}

function targetRoleTextForGovernance(internalAtsResult = {}) {
  const facts = internalAtsResult.resumeFacts || {};
  return [
    internalAtsResult.jobTitle,
    internalAtsResult.profile?.targetRole,
    internalAtsResult.profile?.roleFamily,
    internalAtsResult.profile?.seniority,
    facts.roleEvidence?.targetRoleFamily,
    facts.roleEvidence?.targetRole,
    facts.jobDescriptionText,
    internalAtsResult.jobDescription,
    internalAtsResult.jdText,
    internalAtsResult.rawJobDescription,
  ].filter(Boolean).join(" ");
}

function resumeEvidenceTextForGovernance(internalAtsResult = {}) {
  const facts = internalAtsResult.resumeFacts || {};
  return [
    internalAtsResult.resumeText,
    internalAtsResult.rawResumeText,
    facts.rawText,
    JSON.stringify(facts.experience || {}),
    JSON.stringify(facts.projects || {}),
    JSON.stringify(facts.skills || {}),
    JSON.stringify(facts.education || {}),
  ].filter(Boolean).join(" ");
}

function isRotationTargetRole(internalAtsResult = {}) {
  return /管培|管理培训|management\s*trainee|graduate\s*trainee|rotat(?:e|ion|ional)|轮岗/i
    .test(targetRoleTextForGovernance(internalAtsResult));
}

function familyRoleGuardResult(card = {}, internalAtsResult = {}) {
  const family = canonicalActionFamilyOf(card);
  const roleText = targetRoleTextForGovernance(internalAtsResult).toLowerCase();
  const resumeText = resumeEvidenceTextForGovernance(internalAtsResult).toLowerCase();
  const combined = `${roleText} ${resumeText}`;

  if (family === "rotation_readiness" && !isRotationTargetRole(internalAtsResult)) {
    return { allowed: false, reason: "rotation_role_not_present" };
  }

  if (family === "manager_assist_evidence") {
    const roleOk = /assistant|assist|coordinator|administrative|admin|operations?\s*(support|coordinator|assistant)?|运营支持|运营助理|行政|助理|协调/.test(roleText);
    const resumeOk = /assist|support|coordinate|coordinat|admin|manager|supervisor|协助|支持|协调|主管|经理|跟进/.test(resumeText);
    if (!roleOk && !resumeOk) return { allowed: false, reason: "manager_assist_not_grounded" };
  }

  if (family === "business_reporting") {
    const roleOk = /report|reporting|analysis|analy[sz]e|data|dashboard|metrics|operation|运营|分析|报告|报表|数据|指标/.test(roleText);
    const resumeOk = /report|summary|analysis|analy[sz]e|data|excel|dashboard|presentation|metrics|报告|报表|分析|数据|汇总|整理|指标/.test(resumeText);
    if (!roleOk || !resumeOk) return { allowed: false, reason: "business_reporting_not_grounded" };
  }

  if (family === "process_improvement") {
    const roleOk = /process|operation|workflow|improvement|optimi[sz]e|efficiency|quality|流程|运营|优化|改进|效率|质量/.test(roleText);
    const resumeOk = /process|workflow|improv|optimi[sz]e|efficien|standardi[sz]e|document|流程|优化|改进|效率|规范|文档|整理/.test(resumeText);
    if (!roleOk || !resumeOk) return { allowed: false, reason: "process_improvement_not_grounded" };
  }

  if (family === "cross_functional_delivery") {
    const roleOk = /cross[-\s]?functional|stakeholder|coordinate|collaborat|team|operation|project|跨部门|协作|协调|团队|项目|运营/.test(roleText);
    const resumeOk = /cross[-\s]?functional|stakeholder|coordinate|collaborat|team|partner|teacher|manager|client|协作|协调|团队|同学|老师|经理|客户|交付/.test(resumeText);
    if (!roleOk || !resumeOk) return { allowed: false, reason: "cross_functional_not_grounded" };
  }

  if (family === "learning_adaptability") {
    const roleOk = isRotationTargetRole(internalAtsResult) || /entry|junior|trainee|new grad|fast[-\s]?paced|learn|adapt|初级|应届|快速学习|适应/.test(roleText);
    const resumeOk = /learn|adapt|new|training|course|self[-\s]?study|快速学习|适应|培训|课程|新/.test(combined);
    if (!roleOk || !resumeOk) return { allowed: false, reason: "learning_adaptability_not_grounded" };
  }

  if (family === "customer_business_exposure") {
    const roleOk = /customer|client|user|sales|service|business|operation|客户|用户|销售|服务|业务|运营/.test(roleText);
    const resumeOk = /customer|client|user|sales|service|business|survey|research|客户|用户|销售|服务|业务|调研|需求/.test(resumeText);
    if (!roleOk || !resumeOk) return { allowed: false, reason: "customer_business_not_grounded" };
  }

  return { allowed: true, reason: "passed" };
}

function exactJobTitleCoherencePatch(item = {}, internalAtsResult = {}) {
  const tags = new Set(item.relatedProblemTags || []);
  if (!tags.has("missing_exact_job_title")) return null;
  if (tags.has("missing_summary")) return null;
  const text = [
    item.title,
    item.currentDiagnosis,
    item.problemSummary,
    item.action,
    item.actionSummary,
  ].filter(Boolean).join(" ");
  const hasCompetingProblem = [...tags].some((tag) =>
    tag !== "missing_exact_job_title" &&
    !/target_role|role_alignment|summary|job_title|exact_title|role_specificity|generic_resume_positioning/.test(tag)
  );
  const isVisibleExactTitleCard =
    /补上目标岗位原词|岗位原词|精确职位|职位名称|exact (?:target )?(?:job )?title|job title|target title/i.test(text);
  if (hasCompetingProblem && !isVisibleExactTitleCard) return null;
  if (!isVisibleExactTitleCard && tags.size > 1) return null;
  const targetRole = displayTargetRole(internalAtsResult);
  return {
    title: "补上目标岗位原词",
    mentorLens: `ATS 和 recruiter 会优先查找目标岗位原词；如果 Summary 没有出现 ${targetRole}，系统可能无法稳定判断你的投递方向。`,
    action: `在 Summary 第一或第二句自然加入 ${targetRole}，并紧接一句说明你和该岗位核心职责相关的经历或项目证据。`,
    reason: "岗位原词放在 Summary 能最快建立职位定位，也能帮助后续 Skills 和 Experience 的关键词被正确解释。",
    targetSection: "summary",
    canonicalActionFamily: "summary_positioning",
    actionDepth: "rewrite",
  };
}

function normalizedKeywordText(internalAtsResult = {}) {
  return arrayOf(internalAtsResult.topMissingKeywords || internalAtsResult.priorityMissingKeywords)
    .map((item) => typeof item === "string" ? item : item?.term || item?.keyword || "")
    .filter(Boolean)
    .slice(0, 3)
    .join("、");
}

function actionMatchesProblemTag(tag = "", action = "") {
  const text = String(action || "").toLowerCase();
  const checks = {
    missing_summary: /summary|概要|总结|新增|补上|开头|2-3\s*行/,
    missing_exact_job_title: /summary|岗位原词|职位名称|精确职位|target title|job title|exact.*title|target role|目标岗位/,
    weak_summary_role_alignment: /summary|定位|目标岗位|target role|岗位原词|headline/,
    weak_target_role_alignment: /summary|定位|目标岗位|jd|关键词|最相关|顺序|靠前|target role|role/,
    low_role_specificity: /summary|定位|目标岗位|岗位原词|具体岗位|target role|role/,
    generic_resume_positioning: /版本|方向|summary|定位|目标岗位|相关内容|target role|tailor/,
    low_jd_keyword_match: /jd|ats|keyword|关键词|skills?|技能|experience|经历|bullet|核心词/,
    low_hard_skill_match: /keyword|关键词|skills?|技能|tool|工具|experience|经历|bullet|核心职责/,
    missing_priority_keywords: /keyword|关键词|skills?|技能|jd|experience|经历|bullet|核心词/,
    weak_experience_keyword_evidence: /experience|经历|bullet|项目|证据|使用场景|工具|方法|结果/,
    keywords_only_in_skills: /experience|经历|bullet|skills?|技能|证据|使用场景|做过/,
    low_measurable_results: /量化|数字|结果|成果|影响|规模|频率|效率|metric|impact|result/,
    weak_result_orientation: /量化|数字|结果|成果|影响|产出|业务价值|result|impact/,
    weak_action_verbs: /action verb|动词|主动|开头|led|built|improved|created|managed|delivered/,
    short_tenure_unclear: /intern|internship|实习|短期|时长|项目周期|稳定性|title/,
    education_details_missing: /education|course|coursework|课程|证书|certificate|training|教育|gpa|项目训练/,
    missing_portfolio: /portfolio|作品集|个人网站|project link|项目链接|链接|入口|behance|dribbble/,
    missing_linkedin: /linkedin|领英|職業資料|职业资料|链接|header|头部/,
    missing_github_link: /github|gitlab|repo|repository|代码|仓库|项目链接|链接/,
    uploaded_non_pdf_format: /pdf|格式|format|导出|提交|文件|版面|ats|解析/,
    file_naming_issue: /文件名|file name|命名|pdf|提交/,
    first_person_summary: /第一人称|first person|summary|客观|i\b|my\b|me\b|改写/,
    missing_section_dates: /日期|date|时间|timeline|时间线|section|倒序/,
  };
  return checks[tag] ? checks[tag].test(text) : true;
}

function problemCoherencePatchForTag(tag = "", item = {}, internalAtsResult = {}) {
  const targetRole = displayTargetRole(internalAtsResult);
  const keywordText = normalizedKeywordText(internalAtsResult);
  const keywordPhrase = keywordText || "目标 JD 中真实掌握的核心关键词";
  const templates = {
    missing_summary: {
      title: "先补上 Summary 段落",
      action: `新增 2-3 行 Summary：第一句写目标岗位 ${targetRole}，第二句连接你最相关的经历、技能和可量化成果。`,
      targetSection: "summary",
      canonicalActionFamily: "summary_creation",
      actionDepth: "create",
    },
    weak_summary_role_alignment: {
      title: "让 Summary 更贴近目标岗位",
      action: `把 Summary 改成 ${targetRole} 导向：写出目标岗位原词，并用一句话连接你最相关的经历、技能和 JD 核心职责。`,
      targetSection: "summary",
      canonicalActionFamily: "summary_positioning",
      actionDepth: "rewrite",
    },
    weak_target_role_alignment: {
      title: "聚焦目标岗位定位",
      action: `围绕 ${targetRole} 重排 Summary、Skills 和最靠前的经历，把最相关的职责、关键词和结果证据放到前面，弱相关内容收住。`,
      targetSection: "overall",
      canonicalActionFamily: "summary_positioning",
      actionDepth: "structure",
    },
    low_role_specificity: {
      title: "聚焦目标岗位定位",
      action: `把简历主线收束到 ${targetRole}：Summary 写清目标岗位，Skills 和前两段经历只优先展示与该岗位直接相关的关键词和证据。`,
      targetSection: "overall",
      canonicalActionFamily: "summary_positioning",
      actionDepth: "structure",
    },
    generic_resume_positioning: {
      title: "按申请方向维护简历版本",
      action: `不要用同一版覆盖所有岗位；为 ${targetRole} 单独维护一版简历，把该岗位最相关的 Summary、Skills、项目和经历放到前面。`,
      targetSection: "overall",
      canonicalActionFamily: "summary_positioning",
      actionDepth: "structure",
    },
    low_jd_keyword_match: {
      title: "补齐 JD 关键词证据",
      action: `优先确认你真实掌握的 ${keywordPhrase}，把它们写进 Skills，并至少选择一条最相关的 Experience bullet 说明使用场景、任务和结果。`,
      targetSection: "skills",
      canonicalActionFamily: "jd_keyword_alignment",
      actionDepth: "rewrite",
    },
    low_hard_skill_match: {
      title: "补齐 JD 缺失技能",
      action: `把 ${keywordPhrase} 这类硬技能补进 Skills，并在 Experience 或 Projects 中写出你实际使用它们解决了什么问题。`,
      targetSection: "skills",
      canonicalActionFamily: "jd_keyword_alignment",
      actionDepth: "rewrite",
    },
    missing_priority_keywords: {
      title: "补齐 JD 缺失关键词",
      action: `对照 JD 先补 ${keywordPhrase} 等高优先级关键词；每个关键词都尽量配一条经历或项目证据，避免只堆在 Skills。`,
      targetSection: "skills",
      canonicalActionFamily: "jd_keyword_alignment",
      actionDepth: "rewrite",
    },
    weak_experience_keyword_evidence: {
      title: "把技能写进经历 bullet",
      action: `选择最相关的一段 Experience，把目标岗位核心技能写成「动作 + 方法/工具 + 结果」的 bullet，让关键词有真实使用证据。`,
      targetSection: "experience",
      canonicalActionFamily: "experience_evidence",
      actionDepth: "rewrite",
    },
    keywords_only_in_skills: {
      title: "把技能写进经历 bullet",
      action: "不要只把核心技能放在 Skills；至少挑 1-2 个关键词写进 Experience bullet，说明你在什么任务中用过、产出了什么结果。",
      targetSection: "experience",
      canonicalActionFamily: "experience_evidence",
      actionDepth: "rewrite",
    },
    low_measurable_results: {
      title: "强化 bullet 的结果表达",
      action: "为核心 bullet 补充数量、频率、规模、效率或结果，例如处理量、覆盖范围、故障率、响应时间、转化率或节省成本。",
      targetSection: "experience",
      canonicalActionFamily: "quantified_impact",
      actionDepth: "rewrite",
    },
    weak_result_orientation: {
      title: "强化 bullet 的结果表达",
      action: "把职责型 bullet 改成结果型表达：先写动作和方法，再补产出、影响或业务价值，让 HR 能判断你做出了什么。",
      targetSection: "experience",
      canonicalActionFamily: "quantified_impact",
      actionDepth: "rewrite",
    },
    weak_action_verbs: {
      title: "替换更有力的 action verbs",
      action: "检查每条 Experience bullet 的开头动词，用更主动的 action verbs 替换「负责、参与、协助」这类弱动词，并接上具体方法和结果。",
      targetSection: "experience",
      canonicalActionFamily: "quantified_impact",
      actionDepth: "rewrite",
    },
    short_tenure_unclear: {
      title: "说明短期经历性质",
      action: "如果这段经历是实习，请在 title 中明确标注 Intern / Internship；如果不是核心相关经历，用项目周期或产出说明这段短期经历的边界。",
      targetSection: "experience",
      canonicalActionFamily: "experience_evidence",
      actionDepth: "clarify",
    },
    education_details_missing: {
      title: "调整教育背景信息",
      action: `只保留和 ${targetRole} 相关的课程、证书、训练或课程项目，并说明它们如何支撑岗位要求；弱相关教育细节可以删减。`,
      targetSection: "education",
      canonicalActionFamily: "education_signal",
      actionDepth: "rewrite",
    },
    missing_portfolio: {
      title: "补上作品集入口",
      action: "在简历头部补上可点击的 portfolio / personal website / project link，并确保最相关作品能直接打开、能验证你的实际产出。",
      targetSection: "header",
      canonicalActionFamily: "profile_links",
      actionDepth: "create",
    },
    missing_linkedin: {
      title: "补上 LinkedIn 链接",
      action: "在简历头部补上可点击的 LinkedIn 链接，并确保头像、经历时间线、职位名称和简历内容保持一致。",
      targetSection: "header",
      canonicalActionFamily: "profile_links",
      actionDepth: "create",
    },
    missing_github_link: {
      title: "补上项目或代码链接",
      action: "在简历头部或 Projects 中补上 GitHub / repo / project link，并确保链接可点击、README 能说明项目目标、技术栈和运行方式。",
      targetSection: "header",
      canonicalActionFamily: "profile_links",
      actionDepth: "create",
    },
    uploaded_non_pdf_format: {
      title: "稳定简历提交格式",
      action: "导出并提交稳定的一页 PDF 版本，检查字体、间距、日期和 section 顺序在 PDF 中没有错位，降低 ATS 解析失败风险。",
      targetSection: "format",
      canonicalActionFamily: "format_cleanup",
      actionDepth: "fix",
    },
    file_naming_issue: {
      title: "稳定简历提交格式",
      action: "把简历文件名改成清晰稳定的格式，例如 Firstname_Lastname_Resume.pdf，并用 PDF 提交，避免文件名或格式影响筛选效率。",
      targetSection: "format",
      canonicalActionFamily: "format_cleanup",
      actionDepth: "fix",
    },
    first_person_summary: {
      title: "改掉 Summary 第一人称",
      action: "把 Summary 里的 I / my / me 等第一人称删掉，改成客观的岗位定位句：目标岗位 + 相关技能/经历 + 可量化成果。",
      targetSection: "summary",
      canonicalActionFamily: "summary_positioning",
      actionDepth: "rewrite",
    },
    missing_section_dates: {
      title: "补齐经历日期",
      action: "补齐 Experience、Education、Projects 或 Activities 中缺失的日期，并统一月份/年份格式，按倒序展示经历时间线。",
      targetSection: "overall",
      canonicalActionFamily: "format_cleanup",
      actionDepth: "fix",
    },
  };
  const template = templates[tag];
  if (!template) return null;
  return {
    ...template,
    mentorLens: item.mentorLens,
    reason: item.reason,
  };
}

function applyProblemCoherencePatch(item = {}, internalAtsResult = {}) {
  const exactPatch = exactJobTitleCoherencePatch(item, internalAtsResult);
  if (exactPatch) {
    return {
      ...item,
      ...exactPatch,
      problemSummary: item.currentDiagnosis || item.problemSummary || "",
      actionSummary: exactPatch.action,
      mentorInsight: exactPatch.mentorLens,
    };
  }
  const orderedTags = [
    "missing_summary",
    "missing_exact_job_title",
    "weak_summary_role_alignment",
    "weak_target_role_alignment",
    "low_role_specificity",
    "generic_resume_positioning",
    "low_jd_keyword_match",
    "low_hard_skill_match",
    "missing_priority_keywords",
    "weak_experience_keyword_evidence",
    "keywords_only_in_skills",
    "low_measurable_results",
    "weak_result_orientation",
    "weak_action_verbs",
    "short_tenure_unclear",
    "education_details_missing",
    "missing_portfolio",
    "missing_linkedin",
    "missing_github_link",
    "uploaded_non_pdf_format",
    "file_naming_issue",
    "first_person_summary",
    "missing_section_dates",
  ];
  const tags = new Set(item.relatedProblemTags || []);
  const tag = orderedTags.find((candidate) => tags.has(candidate) && !actionMatchesProblemTag(candidate, item.action || item.actionSummary || ""));
  const patch = tag ? problemCoherencePatchForTag(tag, item, internalAtsResult) : null;
  if (!patch) return item;
  return {
    ...item,
    ...patch,
    problemSummary: item.currentDiagnosis || item.problemSummary || "",
    actionSummary: patch.action,
    mentorInsight: patch.mentorLens,
  };
}

function titleFallbackForCard(card = {}) {
  const canonical = card.canonicalTitle || card.canonical_title;
  if (canonical && !titleGovernance.isBadVisibleTitle(canonical)) return canonical;
  const family = canonicalActionFamilyOf(card);
  const titles = {
    summary_creation: "先补上 Summary 段落",
    summary_positioning: "优化 Summary 岗位定位",
    jd_keyword_alignment: "补齐 JD 关键词证据",
    experience_evidence: "优化经历 bullet 证据",
    quantified_impact: "强化 bullet 的结果表达",
    skills_section: "整理 Skills 关键词",
    education_signal: "补强教育背景信号",
    format_cleanup: "修复格式和时间线问题",
    profile_links: "补齐可验证资料入口",
    transferable_framing: "改写可迁移经历表达",
  };
  return titles[family] || titleGovernance.titleFromRules(card);
}

function normalizeDisplayTitle(title = "", card = {}) {
  return titleGovernance.bestDisplayTitle(
    { ...card, canonicalTitle: card.canonicalTitle || card.canonical_title || titleFallbackForCard(card) },
    cleanAndTruncate(title, 80, titleFallbackForCard(card))
  );
}

function normalizeDisplayDiagnosis(diagnosis = "", fallback = "") {
  if (!diagnosis || isSystemPlaceholderAdviceText(diagnosis)) return fallback || "这条建议针对当前简历与目标岗位之间的匹配缺口，优先转化成可执行的修改动作。";
  return diagnosis;
}

function targetTagSet(targetProblemTags = []) {
  return new Set(targetProblemTags.map((item) => item.tag || item).filter(Boolean));
}

function exactTriggerSatisfied(card = {}, targetProblemTags = []) {
  const tags = targetTagSet(targetProblemTags);
  const cardTags = splitCsv(card.relatedProblemTags || card.problemTags || card.problem_tags || []);
  const text = [
    card.title,
    card.problemSummary,
    card.actionSummary,
    card.currentDiagnosis,
    card.action,
    card.mentorInsight,
    card.example,
    card.hrPerspective,
  ].filter(Boolean).join(" ").toLowerCase();

  const requires = [
    {
      tag: "uploaded_non_pdf_format",
      active: hasFileSubmissionFormatWarning(card) || cardTags.includes("uploaded_non_pdf_format"),
      ok: tags.has("uploaded_non_pdf_format") || tags.has("file_naming_issue"),
    },
    {
      tag: "missing_portfolio",
      active: cardTags.includes("missing_portfolio") || /portfolio|作品集|behance|dribbble|personal\s+(site|website)|个人网站|個人網站/.test(text),
      ok: tags.has("missing_portfolio"),
    },
    {
      tag: "missing_linkedin",
      active: cardTags.includes("missing_linkedin") || /linkedin|领英|領英/.test(text),
      ok: tags.has("missing_linkedin"),
    },
    {
      tag: "missing_github_link",
      active: cardTags.includes("missing_github_link") || /github|gitlab|repo|repository|代码仓库|程式碼/.test(text),
      ok: tags.has("missing_github_link"),
    },
    {
      tag: "first_person_summary",
      active: cardTags.includes("first_person_summary") || /第一人称|\bfirst person\b|summary[^。.!?]{0,80}\b(i|my|me)\b/.test(text),
      ok: tags.has("first_person_summary"),
    },
  ];

  return requires.every((item) => !item.active || item.ok);
}

function hasFileSubmissionFormatWarning(card = {}) {
  const text = `${card.title || ""} ${card.problemSummary || ""} ${card.actionSummary || ""} ${card.mentorInsight || ""} ${card.example || ""}`.toLowerCase();
  return /\bword\b|\.docx?\b|pdf格式|pdf 格式|一页pdf|一頁pdf|submit.*pdf|提交.*pdf|word文档|word 文件|word檔|word档/.test(text);
}

function hasGpaSpecificWarning(card = {}) {
  const text = [
    card.title,
    card.problemSummary,
    card.actionSummary,
    card.currentDiagnosis,
    card.action,
  ].filter(Boolean).join(" ").toLowerCase();
  return /\bgpa\s*[:：]?\s*[3-4](?:\.\d+)?\b|gpa[^0-9]{0,16}[3-4](?:\.\d+)?|gpa\s*3\.8/i.test(text);
}

function normalizeGroundingText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[\u2010-\u2015]/g, "-")
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function termAppearsInResume(term, resumeText) {
  const normalizedTerm = normalizeGroundingText(term);
  if (!normalizedTerm || normalizedTerm.length < 2) return true;
  const normalizedResume = normalizeGroundingText(resumeText);
  if (!normalizedResume) return true;
  if (normalizedResume.includes(normalizedTerm)) return true;
  const compactTerm = normalizedTerm.replace(/\s+/g, "");
  const compactResume = normalizedResume.replace(/\s+/g, "");
  return compactTerm.length >= 3 && compactResume.includes(compactTerm);
}

function extractGroundingTermsFromAdvice(card = {}) {
  const actionText = [
    card.action,
    card.actionSummary,
    card.example,
    card.E_example,
  ].filter(Boolean).join(" ");
  const terms = new Set();
  const add = (value) => {
    const term = String(value || "")
      .replace(/^(?:the|a|an)\s+/i, "")
      .replace(/\b(project|pipeline|section|bullet|summary|experience|skills?)\b$/i, "")
      .replace(/\s+/g, " ")
      .trim();
    if (term.length >= 3 && term.length <= 80) terms.add(term);
  };

  const projectPatterns = [
    /(?:将|把|在|从|选择|拆分|重写|改写|展开|合并)\s*([A-Z][A-Za-z0-9&/ .-]{2,70}?)(?:项目|project)/g,
    /\b([A-Z][A-Za-z0-9&/ .-]{2,70}?)\s+(?:project|pipeline)\b/gi,
  ];
  for (const pattern of projectPatterns) {
    let match;
    while ((match = pattern.exec(actionText))) add(match[1]);
  }

  const acronymAllowlist = new Set([
    "ATS", "HR", "JD", "PDF", "DOC", "DOCX", "GPA", "USA", "US", "CA", "NY",
    "BA", "BS", "MS", "MBA", "PhD", "CEO", "CFO", "API", "KPI", "OKR",
  ]);
  for (const match of actionText.matchAll(/\b[A-Z][A-Z0-9+/#.-]{1,}\b/g)) {
    const token = match[0].replace(/[.,;:!?]+$/, "");
    if (acronymAllowlist.has(token)) continue;
    if (/^\d+$/.test(token)) continue;
    add(token);
  }

  const specificPhrasePatterns = [
    /\b(compound sentiment scores?|market trends?|sentiment scores?|data acquisition|data pre[-\s]?processing|pre[-\s]?processing headlines?|article summar(?:y|ies))\b/gi,
  ];
  for (const pattern of specificPhrasePatterns) {
    let match;
    while ((match = pattern.exec(actionText))) add(match[1]);
  }

  return [...terms];
}

function isResumeGroundedAdvice(card = {}, internalAtsResult = {}) {
  const resumeText = internalAtsResult.resumeText || internalAtsResult.rawResumeText || "";
  if (!resumeText) return true;
  const terms = extractGroundingTermsFromAdvice(card);
  if (!terms.length) return true;
  const actionText = [card.action, card.actionSummary, card.example, card.E_example].filter(Boolean).join(" ");
  const hasProjectLevelInstruction = /(?:项目|project|pipeline|拆分|合并|重写|改写|展开|用[A-Z][A-Z0-9+/#.-]{1,})/i.test(actionText);
  if (!hasProjectLevelInstruction) return true;
  const missing = terms.filter((term) => !termAppearsInResume(term, resumeText));
  if (!missing.length) return true;
  const groundedCount = terms.length - missing.length;
  if (terms.some((term) => /research|project|pipeline/i.test(term) && !termAppearsInResume(term, resumeText))) return false;
  return groundedCount >= 2 && groundedCount / terms.length >= 0.5;
}

function isGovernedAdviceDisplayable(card = {}, internalAtsResult = {}) {
  const semanticStatus = normalizeTerm(card.actionSemanticReviewStatus || card.action_semantic_review_status || "");
  if (semanticStatus === "blocked") return false;
  const resolved = actionGovernance.resolveDisplayAction(card, governanceContextFromInternal(internalAtsResult));
  if (!resolved.allowed || !resolved.action) return false;
  return actionPreconditionGate(card, internalAtsResult).allowed;
}

function actionPreconditionText(card = {}, internalAtsResult = {}) {
  const governed = actionGovernance.resolveDisplayAction(card, governanceContextFromInternal(internalAtsResult));
  return [
    governed.action,
    card.actionSummary,
    card.action,
    card.rawActionSummary,
    card.title,
    card.problemSummary,
    card.currentDiagnosis,
    card.mentorLens,
    card.reason,
  ].filter(Boolean).join(" ");
}

function hasResumeFacts(internalAtsResult = {}) {
  return Boolean(internalAtsResult.resumeFacts && typeof internalAtsResult.resumeFacts === "object");
}

function arrayOf(value) {
  return Array.isArray(value) ? value : [];
}

function hasExplicitProfileLinkProblemForGate(internalAtsResult = {}) {
  const tags = [
    ...(internalAtsResult.problemTags || []),
    ...(internalAtsResult.adviceCoverageObligations || []),
  ];
  return tags.some((item) => {
    const text = [
      item.tag,
      item.coverageFamily,
      item.targetSection,
      item.message,
      ...(item.keywords || []),
    ].filter(Boolean).join(" ").toLowerCase();
    return /linkedin|github|portfolio|website|profile_links|project_link|missing_.*link|header.*link/.test(text);
  });
}

function roleOrProjectActuallyNeedsPortfolio(card = {}, internalAtsResult = {}) {
  const facts = internalAtsResult.resumeFacts || {};
  const roleFamily = normalizeTerm(
    facts.roleEvidence?.targetRoleFamily ||
    internalAtsResult.profile?.roleFamily ||
    internalAtsResult.profile?.targetRole ||
    internalAtsResult.jobTitle
  );
  const text = actionPreconditionText(card, internalAtsResult).toLowerCase();
  const portfolioRoles = new Set([
    "software_engineer",
    "cloud_infrastructure",
    "cybersecurity",
    "machine_learning",
    "ai_engineer",
    "data_scientist",
    "data_analyst",
    "data_engineer",
    "design_creative",
    "ux_research_design",
    "product_manager",
  ]);
  if (hasExplicitProfileLinkProblemForGate(internalAtsResult)) return true;
  if (facts.sections?.hasProjects && /project|portfolio|github|作品|项目/.test(text)) return true;
  return portfolioRoles.has(roleFamily);
}

function containsAnyPattern(text, patterns = []) {
  return patterns.some((pattern) => pattern.test(text));
}

function jdRequiredTextFromFacts(facts = {}) {
  return arrayOf(facts.keywords?.jdRequired).join(" ").toLowerCase();
}

function sectionPosition(sections = {}, key) {
  const positions = sections.sectionPositions || {};
  if (Number.isFinite(Number(positions[key]))) return Number(positions[key]);
  const order = Array.isArray(sections.sectionOrder) ? sections.sectionOrder : [];
  const index = order.indexOf(key);
  return index >= 0 ? index : null;
}

function sectionBefore(sections = {}, left, right) {
  const leftPos = sectionPosition(sections, left);
  const rightPos = sectionPosition(sections, right);
  return leftPos != null && rightPos != null && leftPos < rightPos;
}

function isLikelyExperiencedCandidate(internalAtsResult = {}) {
  const profile = internalAtsResult.profile || {};
  const text = [
    profile.seniority,
    profile.candidateType,
    internalAtsResult.jobTitle,
    profile.targetRole,
  ].filter(Boolean).join(" ").toLowerCase();
  if (/student|intern|new[_\s-]?grad|recent graduate|entry[_\s-]?level|junior/.test(text)) return false;
  return true;
}

function sectionOrderProblemPresent(sections = {}, internalAtsResult = {}) {
  const experienced = isLikelyExperiencedCandidate(internalAtsResult);
  if (sections.hasEducation === true && sections.hasExperience === true && experienced && sections.educationBeforeExperience === true) return true;
  if (sections.hasEducation === true && sections.hasExperience === true && experienced && sectionBefore(sections, "education", "experience")) return true;
  if (sections.hasEducation === true && sections.hasSkills === true && experienced && sectionBefore(sections, "education", "skills")) return true;
  if (sections.hasSkills === true && sections.hasExperience === true && sectionBefore(sections, "experience", "skills")) return true;
  if (sections.hasExperience === true && sections.hasProjects === true && sectionBefore(sections, "projects", "experience")) return true;
  return false;
}

function isSectionOrderAdvice(text = "", card = {}) {
  const family = normalizeTerm(card.canonicalActionFamily || card.canonical_action_family || "");
  const tagText = [
    ...(card.relatedProblemTags || []),
    card.problem_tags,
    card.topic_slug,
  ].filter(Boolean).join(" ");
  const mentionsOrder = /reorder|order|sequence|first|second|third|front|before|after|move|prioriti[sz]e|section\s*order|section\s*structure|sorting|ranking|排序|顺序|前置|靠前|提前|后移|往后|移到后面|退居|第一|第二|第三/.test(text);
  const sectionMentions = [
    /summary|objective|简介|开头/i,
    /skills?|technical\s+skills?|技能/i,
    /experience|work\s+experience|professional\s+experience|经历|工作/i,
    /projects?|项目/i,
    /education|学历|教育/i,
  ].filter((pattern) => pattern.test(text)).length;
  return /section_structure|section_relevance_order/.test(family) ||
    /section_structure|section_order|section_relevance_order|skills_section_ordering/.test(tagText) ||
    (mentionsOrder && sectionMentions >= 2);
}

function isDeleteOrPruneAdvice(text = "") {
  return /delete|remove|drop|cut|omit|hide|weaken|de[-\s]?emphasize|删掉|删除|删去|移除|去掉|不写|弱化|后移/.test(text);
}

function hasMisleadingDeletionRisk(text = "") {
  return /(?:去掉|删除|remove|omit).{0,30}(?:结束时间|end date|毕业时间|graduation date|date).{0,80}(?:仍在进行|still ongoing|ongoing|present|默认|assume|gap|空白)|(?:仍在进行|still ongoing|ongoing|present).{0,80}(?:去掉|删除|remove|omit)|(?:国内|中国).{0,20}(?:经历|学校|本科).{0,30}(?:删除|删掉|remove|omit)|(?:delete|remove|omit).{0,30}(?:china|chinese|domestic).{0,30}(?:experience|school|education)/i.test(text);
}

function deletionTargetPresent(text = "", facts = {}, internalAtsResult = {}) {
  const sections = facts.sections || {};
  const education = facts.education || {};
  if (/interests?|hobbies|兴趣|爱好/i.test(text)) return sections.hasInterests === true;
  if (/languages?|english|mandarin|语言|英语|中文|普通话/i.test(text)) return sections.hasLanguages === true;
  if (/activities?|extracurricular|leadership|活动|课外/i.test(text)) return sections.hasActivities === true;
  if (/awards?|honou?rs?|奖项|获奖|荣誉/i.test(text)) return sections.hasAwards === true;
  if (/publications?|papers?|论文|发表/i.test(text)) return sections.hasPublications === true;
  if (/certifications?|licenses?|证书|认证/i.test(text)) return sections.hasCertifications === true;
  if (/coursework|courses?|课程/i.test(text)) return education.hasCoursework === true;
  if (/\bgpa\b|g\.p\.a|绩点|评分/i.test(text)) return education.hasGPA === true;
  if (/projects?|项目/i.test(text)) return sections.hasProjects === true;
  if (/internship|experience|经历|实习|工作/i.test(text)) return sections.hasExperience === true;
  if (/education|school|university|college|学历|教育|学校|本科|硕士/i.test(text)) return sections.hasEducation === true;
  const resumeText = internalAtsResult.resumeText || internalAtsResult.rawResumeText || "";
  const namedTerms = extractNamedTermsForPruning(text);
  if (namedTerms.length) return namedTerms.some((term) => termAppearsInResume(term, resumeText));
  return false;
}

function extractNamedTermsForPruning(text = "") {
  const terms = new Set();
  for (const tool of extractToolTermsForPruning(text)) terms.add(tool);
  for (const match of text.matchAll(/\b[A-Z][A-Za-z0-9+/#.-]{1,}(?:\s+[A-Z][A-Za-z0-9+/#.-]{1,}){0,2}\b/g)) {
    const term = match[0].trim();
    if (!/^(HR|ATS|JD|PDF|GPA|US|USA|OPT|CPT|Summary|Skills|Experience|Projects|Education|Data Analyst|Business Analyst)$/.test(term)) terms.add(term);
  }
  return [...terms].filter((term) => term.length >= 2 && term.length <= 40);
}

function extractToolTermsForPruning(text = "") {
  const commonTools = [
    "Kafka", "Docker", "Kubernetes", "AWS", "GCP", "Azure", "Python", "Java", "JavaScript",
    "TypeScript", "React", "Node", "SQL", "Tableau", "Power BI", "Excel", "MATLAB",
    "Figma", "Miro", "JIRA", "GitHub", "R", "SAS", "Spark", "Redis", "MySQL", "PostgreSQL",
  ];
  return commonTools.filter((tool) => new RegExp(`\\b${tool.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(text));
}

function isSkillPruningAdvice(text = "") {
  return isDeleteOrPruneAdvice(text) && /skills?|tools?|technical|技术|技能|工具|技术栈/.test(text);
}

function skillPruningTargetPresent(text = "", internalAtsResult = {}) {
  const resumeText = internalAtsResult.resumeText || internalAtsResult.rawResumeText || "";
  const terms = extractToolTermsForPruning(text);
  if (!terms.length) return true;
  return terms.some((term) => termAppearsInResume(term, resumeText));
}

function isGpaRemovalAdvice(text = "") {
  return /\bgpa\b|g\.p\.a|绩点|评分/.test(text) && /delete|remove|omit|hide|不写|删|删除|去掉|移除/.test(text);
}

function isGpaAddAdvice(text = "") {
  return /\bgpa\b|g\.p\.a|绩点/.test(text) && /add|include|write|补|加|写|加入|添加|保留/.test(text) && !isGpaRemovalAdvice(text);
}

function actionPreconditionGate(card = {}, internalAtsResult = {}) {
  if (!hasResumeFacts(internalAtsResult)) {
    const familyGuard = familyRoleGuardResult(card, internalAtsResult);
    if (!familyGuard.allowed) return familyGuard;
    return { allowed: true, reason: "resumeFacts_missing", fallbackMode: "resumeFacts_missing" };
  }

  const familyGuard = familyRoleGuardResult(card, internalAtsResult);
  if (!familyGuard.allowed) return familyGuard;

  const facts = internalAtsResult.resumeFacts || {};
  const sections = facts.sections || {};
  const links = facts.links || {};
  const keywords = facts.keywords || {};
  const experience = facts.experience || {};
  const format = facts.format || {};
  const education = facts.education || {};
  const roleEvidence = facts.roleEvidence || {};
  const text = actionPreconditionText(card, internalAtsResult);
  const lower = text.toLowerCase();
  const targetRoleFamily = normalizeTerm(roleEvidence.targetRoleFamily || internalAtsResult.profile?.roleFamily || "");

  const isExperienceRename = containsAnyPattern(text, [
    /\binternship\b/i,
    /professional\s+experience/i,
    /经历栏标题|经历.*标题|section title|rename experience section/i,
  ]) && /professional\s+experience|经历栏标题|section title|rename experience section/i.test(text);
  if (isExperienceRename) {
    if (!sections.hasInternshipTitle) {
      return { allowed: false, reason: "section_title_no_internship" };
    }
    if (sections.hasProfessionalExperienceTitle) {
      return { allowed: false, reason: "section_title_already_professional_experience" };
    }
  }

  const isLinkedInAdvice = /\blinkedin\b|linked[\s-]?in/i.test(text);
  if (isLinkedInAdvice && links.hasLinkedIn === true) {
    return { allowed: false, reason: "linkedin_already_present" };
  }

  const isGithubAdvice = /\bgithub\b|git hub/i.test(text);
  if (isGithubAdvice) {
    if (links.hasGithub === true) return { allowed: false, reason: "github_already_present" };
    if (!roleOrProjectActuallyNeedsPortfolio(card, internalAtsResult)) {
      return { allowed: false, reason: "github_not_needed_for_role" };
    }
  }

  const isPortfolioAdvice = /\bportfolio\b|作品集|personal website|个人网站|website link|项目链接/i.test(text);
  if (isPortfolioAdvice) {
    if (links.hasPortfolio === true) return { allowed: false, reason: "portfolio_already_present" };
    if (!roleOrProjectActuallyNeedsPortfolio(card, internalAtsResult)) {
      return { allowed: false, reason: "portfolio_not_needed_for_role" };
    }
  }

  const isKeywordAdvice = /jd|ats|keyword|关键词|核心词|技能词|岗位词|priority keyword/i.test(text);
  if (isKeywordAdvice) {
    const hasKeywordGap = arrayOf(keywords.missingFromResume).length > 0 || arrayOf(keywords.skillsOnly).length > 0;
    if (!hasKeywordGap) return { allowed: false, reason: "keyword_gap_not_present" };
    const jdRequired = jdRequiredTextFromFacts(facts);
    const staleTerms = [
      ["aws", /\baws\b/i],
      ["gcp", /\bgcp\b/i],
      ["it infrastructure", /\bit infrastructure\b/i],
      ["azure", /\bazure\b/i],
    ].filter(([term, pattern]) => pattern.test(text) && !jdRequired.includes(term));
    if (staleTerms.length) {
      return { allowed: false, reason: `stale_keyword_${staleTerms[0][0].replace(/\s+/g, "_")}` };
    }
  }

  if (/\brisk consulting\b|rcsa|control framework|regulatory compliance|internal control/i.test(text) &&
      !["risk_consulting", "consulting", "legal_compliance"].includes(targetRoleFamily)) {
    return { allowed: false, reason: "role_specific_risk_consulting_mismatch" };
  }
  if (/\bfinancial advisor\b|\bFA\b/.test(text) &&
      !["finance", "financial_analyst", "accounting"].includes(targetRoleFamily)) {
    return { allowed: false, reason: "role_specific_fa_mismatch" };
  }
  if (/\bquant\b|risk quant|trading book|limits monitoring/i.test(text) &&
      !["trading_quant", "finance", "data_scientist"].includes(targetRoleFamily)) {
    return { allowed: false, reason: "role_specific_quant_mismatch" };
  }

  const isQuantifiedAdvice = /量化|quantif|measurable|result|impact|成果|数字|规模|频率|效率|metrics?/i.test(text);
  if (isQuantifiedAdvice &&
      Number(experience.quantifiedBulletCount || 0) >= 3 &&
      experience.hasMeasurableResults === true) {
    return { allowed: false, reason: "quantification_already_sufficient" };
  }

  // Block summary-creation advice if resume already has a Summary section.
  // Run before the education gate because summary cards may mention "education" as context.
  const isSummaryCreationAdvice = /新增\s*summary|补上\s*summary|add\s+(?:a\s+)?summary|写.*summary|summary\s*段落|个人简介.*段落|先.*summary/i.test(text);
  if (isSummaryCreationAdvice && sections.hasSummary === true) {
    return { allowed: false, reason: "summary_already_present" };
  }

  // Block skills-section-creation advice if resume already has a Skills section.
  // Run before the education gate because these cards often mention "Education" as a placement hint
  // (e.g. "list Technical Skills after Education"), which would otherwise trigger the education gate.
  const isSkillsSectionCreationAdvice = /新增.*技能|加.*skills?\s*section|在.*education.*列.*skills?|technical\s+skills?\s*区|skills?\s*板块|skills?\s*模块/i.test(text);
  if (isSkillsSectionCreationAdvice && sections.hasSkills === true) {
    return { allowed: false, reason: "skills_section_already_present" };
  }

  if (isSectionOrderAdvice(lower, card) && !sectionOrderProblemPresent(sections, internalAtsResult)) {
    return { allowed: false, reason: "section_order_condition_not_present" };
  }

  if (hasMisleadingDeletionRisk(lower)) {
    return { allowed: false, reason: "misleading_deletion_risk" };
  }

  if (isGpaRemovalAdvice(lower)) {
    const gpaValue = Number(education.gpaValue);
    if (education.hasGPA !== true) return { allowed: false, reason: "gpa_not_present" };
    if (Number.isFinite(gpaValue) && gpaValue >= 3.5) return { allowed: false, reason: "gpa_not_low_enough_to_remove" };
  }

  if (isGpaAddAdvice(lower) && education.hasGPA === true) {
    return { allowed: false, reason: "gpa_already_present" };
  }

  if (isSkillPruningAdvice(lower) && !skillPruningTargetPresent(text, internalAtsResult)) {
    return { allowed: false, reason: "skill_pruning_target_not_present" };
  }

  if (isDeleteOrPruneAdvice(lower) && !deletionTargetPresent(text, facts, internalAtsResult)) {
    return { allowed: false, reason: "deletion_target_not_present" };
  }

  const isEducationAdvice = /coursework|course work|education|certificate|certification|training|课程|教育|证书|lab\/project|lab project|课程项目/i.test(text);
  if (isEducationAdvice) {
    const isEntryOrJunior = /entry|junior|trainee|student|recent/i.test([
      internalAtsResult.profile?.seniority,
      internalAtsResult.profile?.candidateType,
      targetRoleFamily,
    ].filter(Boolean).join(" "));
    const hasRelevantCondition = sections.hasEducation === true ||
      sections.hasProjects === true ||
      education.hasCoursework === false ||
      isEntryOrJunior;
    if (!hasRelevantCondition) return { allowed: false, reason: "education_condition_not_present" };
    if (/补.*课程项目|add.*course project|补.*project/i.test(text) &&
        sections.hasProjects === true &&
        !hasExplicitProfileLinkProblemForGate(internalAtsResult) &&
        !arrayOf(internalAtsResult.problemTags).some((item) => /course|education|project|training/i.test(item.tag || ""))) {
      return { allowed: false, reason: "course_project_already_present_without_problem" };
    }
  }

  const isFormatAdvice = /一页|one[-\s]?page|format|格式|日期|date|section order|顺序|排版|行距|字体|压缩|压到|错位/i.test(text);
  if (isFormatAdvice) {
    const hasFormatProblem = format.likelyOverOnePage === true ||
      format.hasDateInconsistency === true ||
      format.hasMonthStyleInconsistency === true ||
      arrayOf(format.missingDatesSections).length > 0 ||
      sections.educationBeforeExperience === true;
    if (!hasFormatProblem) return { allowed: false, reason: "format_condition_not_present" };
  }

  return { allowed: true, reason: "passed", fallbackMode: null };
}

function recordActionPreconditionGate(card = {}, internalAtsResult = {}) {
  const result = actionPreconditionGate(card, internalAtsResult);
  if (!result.allowed || result.fallbackMode === "resumeFacts_missing") {
    const key = result.reason || result.fallbackMode || "unknown";
    if (!internalAtsResult._actionPreconditionRejected) internalAtsResult._actionPreconditionRejected = {};
    internalAtsResult._actionPreconditionRejected[key] = (internalAtsResult._actionPreconditionRejected[key] || 0) + 1;
  }
  return result;
}

function isActionPreconditionAllowed(card = {}, internalAtsResult = {}) {
  return recordActionPreconditionGate(card, internalAtsResult).allowed;
}

function isCardAlignedWithTargetProblems(card = {}, targetProblemTags = []) {
  const tags = targetProblemTags.map((item) => item.tag || item).filter(Boolean);
  if (!tags.length) return true;
  if (!exactTriggerSatisfied(card, targetProblemTags)) return false;
  if (hasMismatchedCaseStudyAdvice(card, targetProblemTags)) return false;
  if (!isActionFamilyCompatibleWithProblems(card, targetProblemTags)) return false;
  const related = relatedTagsForCard(card, targetProblemTags);
  const text = [
    card.title,
    card.problemSummary,
    card.actionSummary,
    card.currentDiagnosis,
    card.action,
    card.topic,
    card.adviceIntent,
    card.targetSection,
  ].filter(Boolean).join(" ").toLowerCase();

  if (hasFileSubmissionFormatWarning(card) && !tags.includes("uploaded_non_pdf_format") && !tags.includes("file_naming_issue")) {
    return false;
  }
  if (hasExperienceSectionTitleOnlyAdvice(card) &&
      !tags.some((tag) => /section_title|experience_header|formatting_penalty|resume_structure|section_order/.test(tag))) {
    return false;
  }
  if (hasGpaSpecificWarning(card) &&
      !tags.some((tag) => /gpa|education_details_missing|education/.test(tag))) {
    return false;
  }
  if (isBulletReadabilityAdvice(card) &&
      !tags.some((tag) => /readability|bullet|experience|evidence|format|measurable|result|action_verbs|project_details/.test(tag))) {
    return false;
  }
  if (tags.includes("education_details_missing") && hasGpaSpecificWarning(card)) {
    return false;
  }
  if (tags.some((tag) => /jd|keyword|hard_skill|priority_keyword/.test(tag))) {
    if (!/jd|ats|keyword|关键词|匹配|岗位|skills?|summary|target role|positioning/.test(text)) return false;
  }
  if (tags.some((tag) => /experience|evidence|skills_only/.test(tag))) {
    if (!/experience|bullet|经历|项目|证据|skills?|keyword|关键词/.test(text)) return false;
  }
  if (tags.some((tag) => /exact_job_title|target_role|summary|role_alignment/.test(tag))) {
    if (!/title|summary|岗位|职位|role|position|定位/.test(text)) return false;
  }
  return related.length > 0;
}

function isDisplayableByFamilyRoleGuard(item = {}, internalAtsResult = {}) {
  return familyRoleGuardResult(item, internalAtsResult).allowed;
}

// Returns true if the card's own problem summary is topically aligned with its advice
// (i.e. we should use the DB summary rather than generating from ATS data)
function cardHasOwnDiagnosis(card) {
  const summary = card.problemSummary || card.user_problem_summary || card.P_mentor || "";
  if (!summary || summary.trim().length < 10) return false;
  const adviceText = `${card.title || ""} ${card.actionSummary || ""} ${card.topic || ""}`.toLowerCase();
  const summaryText = summary.toLowerCase();
  // Check that the summary is topically related to the card's own advice
  // (not just a generic keyword/JD diagnosis that could belong to any card)
  const isGenericKeywordDiagnosis = /jd.*匹配|关键词.*不足|ats.*过滤|hard skill.*缺|技能词.*缺/.test(summaryText);
  if (isGenericKeywordDiagnosis) return false;
  // The summary should share content words with the card's advice
  const adviceWords = adviceText.split(/\W+/).filter(w => w.length > 3);
  const summaryWords = new Set(summaryText.split(/\W+/).filter(w => w.length > 3));
  const overlap = adviceWords.filter(w => summaryWords.has(w)).length;
  return overlap >= 2;
}

function toAdviceItem(card = {}, targetProblemTags = [], index = 0, includePremiumFields = false, internalAtsResult = {}, usedDiagnosisTags = new Set()) {
  const relatedProblemTags = relatedTagsForCard(card, targetProblemTags);
  const defaultAction = "优先把目标岗位关键词、相关技能和经历证据放到 Summary、Skills 和 Experience 中。";

  const hasNativeNewSchema = !!(card.mentorLens || card.currentDiagnosis || card.action || card.reason);
  const currentDiagnosis = generateUserDiagnosis(relatedProblemTags, targetProblemTags, internalAtsResult, usedDiagnosisTags);
  const governedAction = resolvedGovernedAction(card, governanceContextFromInternal(internalAtsResult), card.action || card.actionSummary || defaultAction);
  let action = decontextualizeAdviceText(governedAction.action, defaultAction);
  action = normalizeDisplayActionLanguage(action, card, defaultAction);
  const sectionForMissingDates = relatedProblemTags.includes("missing_section_dates")
    ? sectionHintForProblemTag(targetProblemTags, "missing_section_dates")
    : "";
  if (relatedProblemTags.includes("missing_section_dates")) {
    if (sectionForMissingDates) {
      action = action.replace(
        /检查所有 Experience、Education、Projects、Activities 条目/,
        `优先检查 ${sectionForMissingDates} section；同时复查 Experience、Education、Projects、Activities 中的其他条目`
      );
    }
  }
  const useGeneralizedPerspective = shouldUseGeneralizedPerspective(card, governedAction);
  // mentorLens: new schema field; for DB-adapted rows derive from P_mentor if helpful
  const rawMentorLens = useGeneralizedPerspective
    ? generalizedMentorLensForCard(card)
    : card.mentorLens || card.P_mentor || "";
  // reason: new schema field; for DB-adapted rows, I_insight is the closest analog
  const rawReason = useGeneralizedPerspective
    ? generalizedReasonForCard(card)
    : card.reason || card.I_insight || "";
  const rawHrPerspective = useGeneralizedPerspective
    ? generalizedHrPerspectiveForCard(card)
    : resolveHrPerspective(card);
  const toneContext = { internalAtsResult, targetProblemTags, useGeneralizedPerspective };
  const mentorPerspective = humanizeMentorInsight({
    ...card,
    mentorLens: rawMentorLens,
    reason: rawReason,
    mentorInsight: card.mentorInsight || card.I_insight || rawReason || rawMentorLens,
  }, toneContext);
  const hrPerspective = humanizeHrPerspective({
    ...card,
    hrPerspective: rawHrPerspective,
    HR_os: rawHrPerspective,
  }, toneContext);
  // evidence: explicit chips array; populated by fallback templates or buildAdviceEvidence later
  const evidence = Array.isArray(card.evidence) ? [...card.evidence] : [];

  // Determine source: prefer explicit, then detect whether we have native new-schema fields
  const source = card.source || (hasNativeNewSchema ? "db" : "db_adapted");
  const titleBase = useGeneralizedPerspective
    ? titleFallbackForCard(card)
    : titleForCurrentProblem(relatedProblemTags, card);
  const title = normalizeDisplayTitle(titleBase, card);

  let item = {
    adviceId: card.adviceId || `fallback_${index}`,
    title,
    mentorLens: mentorPerspective,
    currentDiagnosis: normalizeDisplayDiagnosis(currentDiagnosis),
    action,
    reason: mentorPerspective,
    evidence,
    // backward compat aliases
    problemSummary: normalizeDisplayDiagnosis(currentDiagnosis),
    actionSummary: action,
    targetSection: card.targetSection || (sectionForMissingDates ? sectionForMissingDates.toLowerCase() : targetSectionFromCard(card)),
    relatedProblemTags,
    priority: card.priority || priorityFromTags(relatedProblemTags, targetProblemTags),
    priorityLabel: priorityLabel(card.priority || priorityFromTags(relatedProblemTags, targetProblemTags)),
    source,
    actionSpecificity: card.actionSpecificity || card.action_specificity || "",
    actionDisplayMode: card.displayActionMode || card.display_action_mode || "",
    actionDisplayModeUsed: governedAction.usedMode || "",
    canonicalActionFamily: card.canonicalActionFamily || card.canonical_action_family || inferAdviceActionFamily(card),
    actionDepth: card.actionDepth || card.action_depth || actionGovernance.inferActionDepth(card),
    canonicalTitle: card.canonicalTitle || card.canonical_title || titleFallbackForCard(card),
    titleReviewStatus: card.titleReviewStatus || card.title_review_status || "",
    titleSource: card.titleSource || card.title_source || "",
    titleConfidence: card.titleConfidence || card.title_confidence || null,
    humanizedMentorInsight: card.humanizedMentorInsight || card.humanized_mentor_insight || "",
    humanizedHrPerspective: card.humanizedHrPerspective || card.humanized_hr_perspective || "",
    humanizedMentorInsightRaw: card.humanizedMentorInsightRaw || card.humanized_mentor_insight_raw || "",
    humanizedHrPerspectiveRaw: card.humanizedHrPerspectiveRaw || card.humanized_hr_perspective_raw || "",
    humanizedMentorInsightGeneralized: card.humanizedMentorInsightGeneralized || card.humanized_mentor_insight_generalized || "",
    humanizedHrPerspectiveGeneralized: card.humanizedHrPerspectiveGeneralized || card.humanized_hr_perspective_generalized || "",
    perspectiveReviewStatus: card.perspectiveReviewStatus || card.perspective_review_status || "",
    perspectiveSource: card.perspectiveSource || card.perspective_source || "",
    perspectiveConfidence: card.perspectiveConfidence || card.perspective_confidence || null,
    mentorSource: {
      mentorName: card.mentorName || card.mentor_name || "",
      company: inferCompanyFromMentor(card),
      companyLogo: resolveCompanyLogo(inferCompanyFromMentor(card)),
      mentorTitle: inferMentorTitle(card),
    },
    hrPerspective,
    HR_os: hrPerspective,
  };
  if (includePremiumFields) {
    const suppressContext = useGeneralizedPerspective || hasMismatchedCaseStudyAdvice(card, targetProblemTags);
    item.mentorInsight = suppressContext ? mentorPerspective : mentorPerspective;
    item.example = suppressContext ? "" : decontextualizeAdviceText(card.example || card.E_example || "", "");
    item.hrPerspective = hrPerspective;
    item.HR_os = item.hrPerspective;
  }
  item = applyProblemCoherencePatch(item, internalAtsResult);
  return item;
}

function buildMentorLogoPoolFromItems(adviceItems = []) {
  const byCompany = new Map();
  for (const item of adviceItems) {
    const source = item.mentorSource || {};
    const company = source.company || "";
    const companyLogo = source.companyLogo || resolveCompanyLogo(company);
    if (!company || !companyLogo || byCompany.has(company)) continue;
    byCompany.set(company, {
      company,
      companyLogo,
      mentorName: source.mentorName || "",
      mentorTitle: source.mentorTitle || "",
    });
  }
  return [...byCompany.values()];
}

function buildMentorLogoPoolFromCandidates(candidates = [], max = 16) {
  const byCompany = new Map();
  const buckets = groupAdviceByMentor(candidates);
  const sortedBuckets = [...buckets].sort((a, b) => {
    const diff = stableCardScore(b.cards?.[0] || {}) - stableCardScore(a.cards?.[0] || {});
    if (Math.abs(diff) > 1e-9) return diff;
    return String(a.mentorName || "").localeCompare(String(b.mentorName || ""));
  });
  for (const bucket of sortedBuckets) {
    const company = bucket.company || "";
    const companyLogo = bucket.companyLogo || resolveCompanyLogo(company);
    if (!company || !companyLogo || byCompany.has(company)) continue;
    byCompany.set(company, {
      company,
      companyLogo,
      mentorName: bucket.mentorName || "",
      mentorTitle: bucket.mentorTitle || "",
    });
    if (byCompany.size >= max) break;
  }
  return [...byCompany.values()];
}

function canonicalActionFamilyOf(item = {}) {
  return normalizeTerm(
    item.canonicalActionFamily ||
    item.canonical_action_family ||
    item.actionFamily ||
    item._actionFamily ||
    actionGovernance.inferCanonicalActionFamily(item) ||
    inferAdviceActionFamily(item)
  ) || "overall_positioning";
}

function actionDepthOf(item = {}) {
  return normalizeTerm(
    item.actionDepth ||
    item.action_depth ||
    actionGovernance.inferActionDepth(item)
  ) || "rewrite";
}

function selectGlobalAdviceItems(candidates, targetProblemTags, count, coveredTags = new Set(), internalAtsResult = {}, userProfile = {}, usedAdviceIds = new Set(), options = {}) {
  const selectedCards = [];
  const selectedItems = [];
  const clusterCounts = new Map();
  const companyCounts = new Map();
  const actionFamilyCounts = new Map();
  const titleCounts = new Map();
  const usedDiagnosisTags = new Set();
  const familyDepths = new Map();
  const cards = [...(candidates || [])]
    .filter((card) => !usedAdviceIds.has(card.adviceId))
    .sort((a, b) => compareCardsStable(a, b, targetProblemTags, coveredTags, selectedCards));

  for (const item of userProfile.seedAdviceItems || []) {
    const actionFamily = canonicalActionFamilyOf(item);
    const actionDepth = actionDepthOf(item);
    const renderedTitle = item.title || renderedCardTitle(item, targetProblemTags);
    actionFamilyCounts.set(actionFamily, (actionFamilyCounts.get(actionFamily) || 0) + 1);
    if (!familyDepths.has(actionFamily)) familyDepths.set(actionFamily, new Set());
    familyDepths.get(actionFamily).add(actionDepth);
    titleCounts.set(renderedTitle, (titleCounts.get(renderedTitle) || 0) + 1);
  }

  function addCard(card, options = {}) {
    if (!card || usedAdviceIds.has(card.adviceId)) return false;
    if (!canAddCard(card, options)) return false;
    const idx = cards.findIndex((item) => item.adviceId === card.adviceId);
    if (idx !== -1) cards.splice(idx, 1);
    const item = toAdviceItem(card, targetProblemTags, selectedItems.length, true, internalAtsResult, usedDiagnosisTags);
    const meta = generateAdviceExplanationMetadata(card, userProfile);
    item.matchReason = meta.matchReason;
    item.mentorFitType = meta.mentorFitType;
    item.topicCluster = meta.topicCluster;
    item.confidenceScore = meta.confidenceScore;
    item.adviceTransferScope = meta.adviceTransferScope;
    if (!canAddToTwelveAdviceBundle(item, [...(userProfile.seedAdviceItems || []), ...selectedItems])) return false;

    selectedCards.push(card);
    selectedItems.push(item);
    usedAdviceIds.add(card.adviceId);
    (item.relatedProblemTags || []).forEach((tag) => coveredTags.add(tag));
    const company = inferCompanyFromMentor(card);
    const cluster = card._topicCluster || inferTopicCluster(card);
    const actionFamily = canonicalActionFamilyOf(item);
    const actionDepth = actionDepthOf(item);
    const renderedTitle = item.title || renderedCardTitle(card, targetProblemTags);
    companyCounts.set(company, (companyCounts.get(company) || 0) + 1);
    clusterCounts.set(cluster, (clusterCounts.get(cluster) || 0) + 1);
    actionFamilyCounts.set(actionFamily, (actionFamilyCounts.get(actionFamily) || 0) + 1);
    if (!familyDepths.has(actionFamily)) familyDepths.set(actionFamily, new Set());
    familyDepths.get(actionFamily).add(actionDepth);
    titleCounts.set(renderedTitle, (titleCounts.get(renderedTitle) || 0) + 1);
    return true;
  }

  function canAddCard(card, options = {}) {
    if (hasUnsupportedIdentityAssumption(card)) return false;
    if (hasUnsupportedBackgroundAssumption(card)) return false;
    if (!isDisplayableByFamilyRoleGuard(card, internalAtsResult)) return false;
    const actionFamily = canonicalActionFamilyOf(card);
    const actionDepth = actionDepthOf(card);
    const renderedTitle = renderedCardTitle(card, targetProblemTags);
    const relaxed = Boolean(options.relaxed);
    const allowDiversityOverflow = Boolean(options.allowDiversityOverflow);
    const familyCount = actionFamilyCounts.get(actionFamily) || 0;
    if (familyCount >= (relaxed ? 2 : 2)) return false;
    if (familyCount >= 1 && (familyDepths.get(actionFamily) || new Set()).has(actionDepth)) return false;
    if (!allowDiversityOverflow && (titleCounts.get(renderedTitle) || 0) >= (relaxed ? 3 : 2)) return false;
    return true;
  }

  for (const problem of [...targetProblemTags].sort(sortProblemsStable)) {
    if (selectedItems.length >= count) break;
    if (coveredTags.has(problem.tag)) continue;
    const covering = cards
      .filter((card) => relatedTagsForCard(card, targetProblemTags).includes(problem.tag))
      .filter((card) => canAddCard(card))
      .sort((a, b) => compareCardsStable(a, b, [problem], coveredTags, selectedCards))[0];
    addCard(covering);
  }

  while (selectedItems.length < count && cards.length) {
    cards.sort((a, b) => {
      const aCompany = inferCompanyFromMentor(a);
      const bCompany = inferCompanyFromMentor(b);
      const aCluster = a._topicCluster || inferTopicCluster(a);
      const bCluster = b._topicCluster || inferTopicCluster(b);
      const aAction = a._actionFamily || inferAdviceActionFamily(a);
      const bAction = b._actionFamily || inferAdviceActionFamily(b);
      const aTitle = renderedCardTitle(a, targetProblemTags);
      const bTitle = renderedCardTitle(b, targetProblemTags);
      const aPenalty = (companyCounts.get(aCompany) || 0) * 0.08 + (clusterCounts.get(aCluster) || 0) * 0.12 +
        (actionFamilyCounts.get(aAction) || 0) * 0.18 + (titleCounts.get(aTitle) || 0) * 0.22;
      const bPenalty = (companyCounts.get(bCompany) || 0) * 0.08 + (clusterCounts.get(bCluster) || 0) * 0.12 +
        (actionFamilyCounts.get(bAction) || 0) * 0.18 + (titleCounts.get(bTitle) || 0) * 0.22;
      const diff = (stableCardScore(b, targetProblemTags, coveredTags, selectedCards) - bPenalty) -
        (stableCardScore(a, targetProblemTags, coveredTags, selectedCards) - aPenalty);
      if (Math.abs(diff) > 1e-9) return diff;
      return stableAdviceKey(a).localeCompare(stableAdviceKey(b));
    });
    let relaxed = false;
    let allowDiversityOverflow = false;
    let card = cards.find((item) => canAddCard(item));
    if (!card) {
      card = cards.find((item) => canAddCard(item, { relaxed: true }));
      relaxed = Boolean(card);
    }
    if (!card) {
      card = cards.find((item) => canAddCard(item, { relaxed: true, allowDiversityOverflow: true }));
      allowDiversityOverflow = Boolean(card);
    }
    if (!card) break;
    if (card) cards.splice(cards.indexOf(card), 1);
    addCard(card, { relaxed, allowDiversityOverflow });
  }

  if (selectedItems.length < count && options.allowFallback !== false) {
    const fallback = fallbackAdviceItems(internalAtsResult, count, coveredTags, {
      allowGenericTemplates: options.allowGenericFallbackTemplates !== false,
    });
    for (const item of fallback) {
      if (selectedItems.length >= count) break;
      if (usedAdviceIds.has(item.adviceId)) continue;
      if (!isDisplayableByFamilyRoleGuard(item, internalAtsResult)) continue;
      if (!canAddToTwelveAdviceBundle(item, [...(userProfile.seedAdviceItems || []), ...selectedItems])) continue;
      selectedItems.push(item);
      usedAdviceIds.add(item.adviceId);
      (item.relatedProblemTags || []).forEach((tag) => coveredTags.add(tag));
    }
  }

  return selectedItems.slice(0, count);
}

function fallbackAdviceForObligation(obligation = {}, context = {}) {
  const roleName = context.roleName || "目标岗位";
  const targetRole = context.targetRole || roleName;
  const contextKeywords = arrayOf(context.topMissingKeywords || context.missingKeywords)
    .map((item) => typeof item === "string" ? item : item?.term || item?.keyword || "")
    .filter(Boolean);
  const keywordText = [...new Set([...(obligation.keywords || []), ...contextKeywords].filter(Boolean))]
    .slice(0, 3)
    .join("、");
  const tag = obligation.tag || "resume_optimization_gap";
  const dimensionLabels = {
    A: "格式规范",
    B: "基本资料完整性",
    C: "内容质量",
    D: "JD 关键词匹配",
    E: "市场适配度",
    F: "职位相关性",
  };
  const dimensionLabel = dimensionLabels[obligation.dimension] || "简历匹配";
  const diagnosisMessage = obligation.message || `你的简历在「${dimensionLabel}」方面还有明显优化空间，需要转化成更具体的简历修改动作。`;
  const base = {
    adviceId: `fb_obligation_${normalizeTerm(obligation.id || `${tag}_${keywordText || dimensionLabel}`)}`.slice(0, 96),
    relatedProblemTags: [tag],
    obligationIds: [obligation.id || tag],
    coverageFamily: obligation.coverageFamily || problemFamilyForTag(tag),
    targetSection: obligation.targetSection || targetSectionFromCard({ problemSummary: obligation.message || "", actionSummary: "" }),
    priority: ["critical", "high"].includes(obligation.severity) ? "high" : obligation.severity === "medium" ? "medium" : "low",
    source: "fallback",
  };

  if (tag === "short_tenure_unclear") {
    return {
      ...base,
      title: "说明短期经历性质",
      mentorLens: "短于 3 个月的经历如果没有标注原因，HR 很容易把它理解成稳定性风险，而不是正常实习或项目经历。",
      currentDiagnosis: obligation.message || "简历中存在在职时长较短的经历，当前没有足够说明，可能引发 HR 对稳定性或离职原因的疑虑。",
      action: "如果这段经历是实习，请在 title 中明确标注 Intern / Internship；如果不是核心相关经历，评估是否保留，或在 bullet 中用项目周期说明这段经历的边界和产出。",
      reason: "把短期经历解释清楚，可以降低 HR 的负面猜测，也让 ATS 和人工筛选更准确理解经历性质。",
      evidence: ["短期经历未说明", "HR 稳定性疑虑", "Experience 时间线需澄清"],
    };
  }

  if (tag === "missing_summary") {
    return {
      ...base,
      title: "先补上 Summary 段落",
      mentorLens: "没有 Summary 时，简历开头缺少岗位定位入口；先搭出这一段，后续目标岗位原词和 JD 关键词才有自然承载位置。",
      currentDiagnosis: obligation.message || "简历缺少 Summary 段落，HR 和 ATS 需要先有一条清晰的岗位定位线索。",
      action: `新增 2-3 行 Summary：第一句写目标岗位 ${targetRole}，第二句连接你最相关的经历、技能和可量化成果；先把段落搭起来，再补具体关键词。`,
      reason: "先补结构，再优化关键词，顺序会更自然，也避免把关键词硬塞到不存在的 section 里。",
      HR_os: "我第一眼会先看简历开头能不能说明你投什么岗位；没有 Summary 时，后面的技能和经历更容易被读散。",
      hrPerspective: "我第一眼会先看简历开头能不能说明你投什么岗位；没有 Summary 时，后面的技能和经历更容易被读散。",
      evidence: ["缺少 Summary", "岗位定位入口不足", "需要先补结构"],
      relatedProblemTags: ["missing_summary"],
      canonicalActionFamily: "summary_creation",
      actionDepth: "create",
      targetSection: "summary",
    };
  }

  if (tag === "missing_exact_job_title") {
    return {
      ...base,
      title: "补上目标岗位原词",
      mentorLens: `ATS 和 recruiter 会优先查找目标岗位原词；如果 Summary 没有出现 ${targetRole}，系统可能无法稳定判断你的投递方向。`,
      currentDiagnosis: obligation.message || `简历中缺少 ${targetRole} 作为精确职位名称，岗位定位信号不够明确。`,
      action: `在 Summary 第一或第二句自然加入 ${targetRole}，并紧接一句说明你和该岗位核心职责相关的经历或项目证据。`,
      reason: "岗位原词放在 Summary 能最快建立职位定位，也能帮助后续 Skills 和 Experience 的关键词被正确解释。",
      evidence: ["缺少目标岗位原词", "Summary 岗位定位不清晰", "F 职位相关性偏低"],
    };
  }

  if (tag === "missing_priority_keywords" || /keyword|hard_skill|jd_match/.test(`${tag} ${obligation.coverageFamily}`)) {
    return {
      ...base,
      title: keywordText ? `补齐 JD 缺失技能：${keywordText}` : "补齐 JD 缺失关键词",
      mentorLens: "ATS 做 JD match 时会扫目标岗位的核心技能词，但关键词必须建立在真实经验上，不能只为了机筛硬塞。",
      currentDiagnosis: obligation.message || `简历缺少 ${roleName} 相关的高优先级关键词，JD Match 信号偏弱。`,
      action: keywordText
        ? `优先确认你真实掌握的 ${keywordText}，把它写进 Skills，并至少选择一个最相关的 Experience bullet 说明使用场景、任务和结果。`
        : "对照 JD 标出真实掌握的核心工具、技能和职责词，把它们分别写进 Summary、Skills 和最相关的 Experience bullet。",
      reason: "关键词出现在 Skills 能提升检索命中，出现在经历证据里才能让 HR 相信你真的用过。",
      evidence: keywordText ? [`缺失关键词：${keywordText}`, "JD Match 偏低", "需要经历证据支撑"] : ["JD Match 偏低", "核心关键词缺失", "需要经历证据支撑"],
    };
  }

  if (/experience|evidence|skills_only/.test(tag)) {
    return {
      ...base,
      title: "把关键词写进经历证据",
      mentorLens: "只把技能列在 Skills 中，ATS 可能能扫到词，但招聘方无法判断你是否真的在工作或项目里用过。",
      currentDiagnosis: obligation.message || "Experience 中缺少与目标岗位关键词对应的实际职责、工具和结果证据。",
      action: `选择最相关的一段经历，把 ${roleName} 的核心职责写成 bullet：动作 + 方法/工具 + 量化结果；如果涉及 AWS、GCP 或 IT infrastructure，要说明使用场景和产出。`,
      reason: "经历证据能把关键词从“会写”变成“做过”，同时服务 ATS 和人工筛选。",
      evidence: ["Experience 缺少关键词证据", "关键词不能只堆 Skills", "需要动作 + 工具 + 结果"],
    };
  }

  if (/measurable|result|impact|action_verbs|weak_result/.test(tag)) {
    return {
      ...base,
      title: "强化 bullet 的量化结果",
      mentorLens: "HR 看经历 bullet 时会快速找影响、规模和结果；只有职责描述会让贡献显得模糊。",
      currentDiagnosis: obligation.message || "经历描述偏向说明做了什么，缺少数量、频率、效率、规模或业务结果。",
      action: "将核心 bullet 改成「动作 + 方法/工具 + 量化结果」：例如处理多少请求/工单、维护多少设备或系统、降低多少故障率、提升多少响应效率。",
      reason: "量化结果让 ATS 和招聘官都能判断你的工作强度、技术深度和实际贡献。",
      evidence: ["Bullet 量化结果不足", "内容质量维度偏低", "成果表达不够具体"],
    };
  }

  if (/education|gpa|coursework/.test(tag)) {
    return {
      ...base,
      title: "补强教育背景相关信号",
      mentorLens: "Entry-level 或 junior 岗位会看课程、证书和训练是否支撑目标岗位，尤其当工作经验还不长时。",
      currentDiagnosis: obligation.message || "教育背景信息还没有充分服务目标岗位，相关课程、证书或训练信号不够清楚。",
      action: `只保留和 ${roleName} 有关的课程、证书或 lab/project，并把它们放在 Education 或 Projects 中靠前位置。`,
      reason: "相关教育信号可以补足 junior 候选人的经验不足，让岗位匹配更完整。",
      evidence: ["教育背景信号不足", "Junior 岗位需要训练证据", "相关课程可补强匹配"],
    };
  }

  if (/linkedin|github|portfolio|contact|link|profile_completeness/.test(`${tag} ${obligation.coverageFamily}`)) {
    return {
      ...base,
      title: "补齐可验证资料入口",
      mentorLens: "ATS 和 HR 都会优先读取简历头部的联系方式与可验证链接，缺失会降低可信度和后续联系效率。",
      currentDiagnosis: obligation.message || "简历基础资料或可验证链接不完整，影响搜索、联系和背景判断。",
      action: "在简历头部补齐邮箱、电话、LinkedIn；技术或项目相关岗位补 GitHub / portfolio / project link，并确保链接可点击。",
      reason: "完整的资料入口能减少 HR 的验证成本，也能提升 ATS 对候选人资料完整性的判断。",
      evidence: ["基本资料完整性偏低", "可验证链接不足", "Header 信息需补齐"],
    };
  }

  if (/format|date|section|chronological/.test(`${tag} ${obligation.coverageFamily}`)) {
    return {
      ...base,
      title: "修复格式和时间线问题",
      mentorLens: "格式、日期和 section 结构会影响 ATS 解析，也会影响 HR 快速判断经历新旧和相关性。",
      currentDiagnosis: diagnosisMessage,
      action: "统一日期格式，补齐 Experience / Education / Projects 的时间信息，按倒序排列经历，并导出稳定的一页 PDF 版本。",
      reason: "稳定格式能降低 ATS 解析失败风险，也让招聘方更快看懂你的经历顺序。",
      evidence: [`${dimensionLabel}偏低`, "时间线需澄清", "ATS 解析稳定性"],
    };
  }

  return {
    ...base,
    title: `${dimensionLabel}优化建议`,
    mentorLens: "这条建议来自 ATS 对简历维度的综合诊断，重点是把问题转化成可以直接修改的简历动作。",
    currentDiagnosis: diagnosisMessage,
    action: `围绕 ${roleName} 重新检查 ${base.targetSection} 部分，把最相关的关键词、职责和结果证据写得更明确。`,
    reason: "把诊断维度落到具体 section 修改，能避免建议只停留在分数解释上。",
    evidence: [`${dimensionLabel}需补强`, "ATS 诊断问题", "需要具体修改动作"],
  };
}

function fallbackAdviceItems(internalAtsResult = {}, count = 3, usedTags = new Set(), options = {}) {
  const profile = internalAtsResult.profile || {};
  const roleFamily = normalizeTerm(profile.roleFamily || "");
  const targetRole = internalAtsResult.jobTitle || profile.targetRole || "target role";

  const ROLE_PROFILES = {
    accounting:        { name: "Accounting",        keywords: "financial reporting、reconciliation、Excel、QuickBooks、GAAP、accounts payable/receivable、audit support 或 month-end close",         evidence: "说明你处理了什么报表、对账、发票或流程，并补充数量、频率或结果。" },
    finance:           { name: "Finance",            keywords: "financial modeling、Excel、valuation、DCF、budgeting、variance analysis、FP&A、Bloomberg 或 financial statements",                   evidence: "说明你构建了什么模型、分析了什么财务数据、支持了什么决策，并补充规模或结果。" },
    financial_analyst: { name: "Financial Analyst",  keywords: "financial modeling、Excel、variance analysis、budgeting、forecasting、KPI tracking 或 reporting",                                    evidence: "说明你分析了什么数据、提交了什么报告、支持了什么业务决策。" },
    software_engineer: { name: "Software Engineer",  keywords: "distributed systems、microservices、APIs、CI/CD、AWS、TypeScript、Java、Python 或 system design",                                    evidence: "说明你设计或实现了什么服务、API 或系统模块，并补充规模、性能或可靠性结果。" },
    ai_engineer:       { name: "AI / ML Engineer",   keywords: "Python、PyTorch、TensorFlow、LLM、fine-tuning、model deployment、RAG、vector DB 或 ML pipeline",                                    evidence: "说明你训练或部署了什么模型，并补充准确率、延迟或业务影响。" },
    machine_learning:  { name: "Machine Learning",   keywords: "Python、PyTorch、Stable Diffusion/SDXL、Flux、ComfyUI、prompt-to-image、image generation、model evaluation、inference optimization、debugging 或 data pipeline", evidence: "说明你做过什么生成式 AI / 视觉模型项目、如何训练、微调或集成模型、如何评估质量或优化推理，并补充指标、延迟或产出。" },
    data_scientist:    { name: "Data Scientist",     keywords: "Python、R、SQL、statistical modeling、A/B testing、machine learning、visualization 或 experimentation",                            evidence: "说明你做了什么分析、使用了什么方法、输出了什么洞察或业务建议。" },
    data_analyst:      { name: "Data Analyst",       keywords: "SQL、Excel、Tableau、Power BI、data cleaning、KPI reporting、dashboards 或 business insights",                                     evidence: "说明你清洗了什么数据、搭建了什么 dashboard、追踪了什么 KPI，并补充业务洞察或结果。" },
    product_manager:   { name: "Product Manager",    keywords: "product roadmap、user research、A/B testing、PRD、stakeholder management、OKR、go-to-market 或 cross-functional",                  evidence: "说明你负责了什么产品或功能、如何推动跨团队协作、取得了什么可量化结果。" },
    management_trainee:{ name: "Management Trainee", keywords: "department rotation、operations、sales、finance、customer service、data analysis、reporting、process improvement、communication 或 leadership potential", evidence: "说明你支持了什么跨部门任务、分析了什么数据、产出了什么报告、提出了什么流程改进或协作结果。" },
    marketing:         { name: "Marketing",          keywords: "campaign management、SEO/SEM、Google Analytics、content strategy、brand awareness、lead generation 或 CRM",                        evidence: "说明你策划或执行了什么 campaign、使用了什么渠道、取得了什么转化或增长结果。" },
    business_analyst:  { name: "Business Analyst",   keywords: "requirements gathering、process improvement、SQL、Excel、stakeholder communication、Agile、JIRA 或 business case",                  evidence: "说明你分析了什么业务问题、提出了什么方案、推动了什么流程改进或结果。" },
    consulting:        { name: "Consulting",         keywords: "client engagement、problem structuring、data analysis、presentation、Excel modeling、project management 或 cross-industry",         evidence: "说明你参与了什么项目、解决了什么客户问题、产出了什么交付物或建议。" },
    operations:        { name: "Operations",         keywords: "process optimization、supply chain、logistics、KPI tracking、cross-functional coordination、lean 或 project management",            evidence: "说明你优化了什么流程、管理了什么运营指标、取得了什么效率或成本改善。" },
    project_manager:   { name: "Project Manager",    keywords: "PMP、Agile、Scrum、stakeholder management、budget control、risk management、timeline 或 cross-functional coordination",             evidence: "说明你管理了什么项目、规模多大、如何控制风险、最终交付了什么结果。" },
    sales:             { name: "Sales",              keywords: "quota attainment、pipeline management、CRM、Salesforce、account management、cold outreach、negotiation 或 revenue growth",          evidence: "说明你负责了什么区域或客户、达成了什么销售目标、取得了什么业绩数据。" },
    ux_design:         { name: "UX / Product Design", keywords: "Figma、user research、wireframing、prototyping、usability testing、design system 或 user journey mapping",                        evidence: "说明你设计了什么产品或功能、怎么做的用研、最终用户体验有什么改善。" },
    hr:                { name: "HR / People Ops",    keywords: "talent acquisition、onboarding、HRIS、employee relations、performance management、Workday 或 HR policy",                          evidence: "说明你负责了什么招聘或人事流程、管理了多少人或职位、取得了什么效率或满意度结果。" },
  };

  const rp = ROLE_PROFILES[roleFamily] || {
    name: targetRole !== "target role" ? targetRole : "目标岗位",
    keywords: "target role keywords、JD 核心职责、role-specific tools 和真实掌握的岗位技能",
    evidence: "说明你承担了什么职责、使用了什么工具、产出了什么结果，并尽量补充数量、频率或影响。",
  };
  const roleName = rp.name;
  const keywordText = rp.keywords;
  const evidenceText = rp.evidence;
  const isAccounting = ["accounting", "finance", "financial_analyst"].includes(roleFamily);
  const selected = [];
  const obligations = obligationsFromInternal(internalAtsResult);
  const sortedObligations = obligations
    .filter((obligation) => obligation.required !== false)
    .sort((a, b) => {
      const aMissingSummary = a.tag === "missing_summary" ? 1 : 0;
      const bMissingSummary = b.tag === "missing_summary" ? 1 : 0;
      if (aMissingSummary !== bMissingSummary) return bMissingSummary - aMissingSummary;
      const severityDiff = severityWeight(b.severity) - severityWeight(a.severity);
      if (Math.abs(severityDiff) > 1e-9) return severityDiff;
      const aDim = a.source === "dimensions" ? 1 : 0;
      const bDim = b.source === "dimensions" ? 1 : 0;
      if (aDim !== bDim) return bDim - aDim;
      return String(a.id || a.tag).localeCompare(String(b.id || b.tag));
    });
  for (const obligation of sortedObligations) {
    if (selected.length >= count) break;
    const coverageKey = obligation.id || obligation.tag;
    const keywordKey = `${obligation.tag}:${(obligation.keywords || []).join("|").toLowerCase()}`;
    if (usedTags.has(coverageKey) || (usedTags.has(obligation.tag) && !obligation.keywords?.length) || usedTags.has(keywordKey)) continue;
    const item = fallbackAdviceForObligation(obligation, {
      roleName,
      targetRole,
      topMissingKeywords: internalAtsResult.topMissingKeywords || internalAtsResult.priorityMissingKeywords,
    });
    if (selected.some((existing) => existing.adviceId === item.adviceId)) continue;
    selected.push(item);
    usedTags.add(coverageKey);
    usedTags.add(keywordKey);
    (item.relatedProblemTags || []).forEach((tag) => usedTags.add(tag));
  }

  if (options.allowGenericTemplates === false) return selected.slice(0, count);

  const templates = [
    {
      adviceId: "fb_target_role_positioning",
      title: `先让简历看起来像 ${roleName} 岗位`,
      mentorLens: `从内部筛选角度看，ATS 和 recruiter 第一眼会先判断：这份简历到底是不是在投 ${roleName}。如果 Summary 和前几条经历没有出现岗位原词，很容易被归到不相关方向。`,
      currentDiagnosis: isAccounting
        ? "你的简历目前有基础经历和教育背景，但和这份 JD 的岗位语言连接较弱。系统检测到 JD Match 和职位相关性都偏低，说明简历还没有稳定传达 Accounting 定位。"
        : `你的简历目前和目标 JD 的岗位语言匹配度较低，ATS 可能无法明确判断你在申请 ${roleName} 方向。`,
      action: isAccounting
        ? "先在 Summary 中自然加入 Accounting / Accountant 等目标岗位原词，并用一句话说明你与财务、报表、对账或审计支持相关的经验。"
        : `先在 Summary 中自然加入 ${targetRole === "unknown" ? roleName : targetRole} 等目标岗位原词，并用一句话说明你与该岗位核心职责相关的经验。`,
      reason: "这样做可以帮助 ATS 和 recruiter 更快识别你的投递方向，也能让后面的 Skills 和 Experience 看起来更有一致性。",
      HR_os: `HR 第一眼会先找岗位原词和定位线索；如果 Summary 没有明确指向 ${roleName}，即使经历不错，也可能被快速归到“不够相关”。`,
      hrPerspective: `HR 第一眼会先找岗位原词和定位线索；如果 Summary 没有明确指向 ${roleName}，即使经历不错，也可能被快速归到“不够相关”。`,
      evidence: ["JD Match 偏低", "F 职位相关性偏低", "缺少目标岗位原词"],
      // backward compat
      get problemSummary() { return this.currentDiagnosis; },
      get actionSummary() { return this.action; },
      relatedProblemTags: ["missing_exact_job_title", "weak_summary_role_alignment", "weak_target_role_alignment"],
      canonicalActionFamily: "summary_positioning",
      actionDepth: "rewrite",
      targetSection: "summary",
      priority: "high",
      source: "fallback",
    },
    {
      adviceId: "fb_jd_keyword_alignment",
      title: isAccounting ? "补上 JD 中真实掌握的 Accounting 关键词" : "补上 JD 中真实掌握的岗位关键词",
      mentorLens: "ATS 做关键词匹配时，会扫全文搜索 JD 中的核心技能词。如果 Skills 区块缺少这些词，系统会把你的匹配分打低，recruiter 在关键词筛选时也会跳过你。",
      currentDiagnosis: "当前简历缺少目标岗位会搜索的核心硬技能和工具词，导致 JD Match 分数偏低。",
      action: `把你真实掌握的 ${roleName} 相关关键词补进 Skills，例如 ${keywordText}。`,
      reason: "把真实掌握的关键词补进 Skills，不仅能直接提升 ATS 匹配分，也能让 recruiter 快速确认你的技能范围与 JD 相符。",
      HR_os: "HR 在筛简历时会用 JD 技能词快速确认候选人是否进入下一轮；缺少核心关键词会让你看起来不像这份 JD 的直接匹配人选。",
      hrPerspective: "HR 在筛简历时会用 JD 技能词快速确认候选人是否进入下一轮；缺少核心关键词会让你看起来不像这份 JD 的直接匹配人选。",
      evidence: ["JD Match 偏低", "D 关键词维度偏低", "Skills 缺少 JD 核心词"],
      // backward compat
      get problemSummary() { return this.currentDiagnosis; },
      get actionSummary() { return this.action; },
      relatedProblemTags: ["low_jd_keyword_match", "missing_priority_keywords", "low_hard_skill_match"],
      canonicalActionFamily: "jd_keyword_alignment",
      actionDepth: "evidence",
      targetSection: "skills",
      priority: "high",
      source: "fallback",
    },
    {
      adviceId: "fb_experience_keyword_evidence",
      title: "把关键词写进经历证据",
      mentorLens: "即使 Skills 里有关键词，ATS 和 recruiter 还是会看 Experience 里有没有对应的证据。光靠 Skills 列词、缺乏经历支撑，很容易被认为是简历注水。",
      currentDiagnosis: "即使关键词出现在 Skills 区块，如果 Experience 中没有对应证据，ATS 和招聘方仍然难以判断你的真实匹配度。",
      action: `选择一段最相关经历，把 ${roleName} 关键词写进 bullet：${evidenceText}`,
      reason: "经历证据让关键词变得可信。把技能词嵌入到具体工作内容里，既提升 ATS 分，也让 recruiter 看到你真的做过相关工作。",
      HR_os: "HR 不只看 Skills 列表，也会扫 Experience 里有没有同样的技能证据；如果技能只停留在列表里，可信度会明显下降。",
      hrPerspective: "HR 不只看 Skills 列表，也会扫 Experience 里有没有同样的技能证据；如果技能只停留在列表里，可信度会明显下降。",
      evidence: ["Experience 缺少关键词证据", "关键词集中在 Skills 区块", "JD Match 偏低"],
      // backward compat
      get problemSummary() { return this.currentDiagnosis; },
      get actionSummary() { return this.action; },
      relatedProblemTags: ["weak_experience_keyword_evidence", "keywords_only_in_skills", "resume_not_tailored_to_jd"],
      canonicalActionFamily: "experience_evidence",
      actionDepth: "evidence",
      targetSection: "experience",
      priority: "high",
      source: "fallback",
    },
    {
      adviceId: "fb_quantified_impact",
      title: "把职责描述改成结果表达",
      mentorLens: "HR 扫 bullet 时会先找规模、频率、效率或结果。只有职责描述，会让你看起来像参与过，但看不出贡献大小。",
      currentDiagnosis: "当前经历里有任务，但缺少能判断贡献的数字或结果，影响内容说服力。",
      action: "挑 2–3 条最核心经历，补上处理数量、报告频率、协作人数、流程节省时间或业务结果；没有精确数字时，也可以写范围、周期或交付物规模。",
      reason: "结果表达能让同一段经历从“做过”变成“做出了什么”，这是免费建议之后付费内容应该继续深化的层级。",
      HR_os: "我会看你是不是能把事情做到有结果；数字不一定要夸张，但要让我知道工作量和影响边界。",
      hrPerspective: "我会看你是不是能把事情做到有结果；数字不一定要夸张，但要让我知道工作量和影响边界。",
      evidence: ["Bullet 量化结果不足", "职责描述偏多", "成果表达需补强"],
      get problemSummary() { return this.currentDiagnosis; },
      get actionSummary() { return this.action; },
      relatedProblemTags: ["weak_measurable_results", "weak_result_oriented_bullets", "low_content_quality"],
      canonicalActionFamily: "quantified_impact",
      actionDepth: "proof",
      targetSection: "experience",
      priority: "medium",
      source: "fallback",
    },
    {
      adviceId: "fb_skills_section_order",
      title: "重排 Skills，让关键词更像这份 JD",
      mentorLens: "Skills 不是技能清单仓库，而是 ATS 和 recruiter 判断方向的入口。顺序混乱时，真实相关技能也会被埋掉。",
      currentDiagnosis: `Skills 还没有围绕 ${roleName} 的 JD 优先级重排，岗位信号不够集中。`,
      action: `把最贴近 ${roleName} 的技能放在 Skills 前半段，弱相关或解释不清的技能后移或删除；每个核心技能最好能在经历里找到对应证据。`,
      reason: "技能排序能快速改变第一印象，也能减少一份简历同时像多个方向的模糊感。",
      HR_os: "我通常先扫技能栏确认方向；如果最相关的词藏在后面，会降低继续细读的动力。",
      hrPerspective: "我通常先扫技能栏确认方向；如果最相关的词藏在后面，会降低继续细读的动力。",
      evidence: ["Skills 顺序需优化", "JD 关键词优先级不清", "岗位定位信号分散"],
      get problemSummary() { return this.currentDiagnosis; },
      get actionSummary() { return this.action; },
      relatedProblemTags: ["skills_section_ordering", "low_hard_skill_match", "resume_not_tailored_to_jd"],
      canonicalActionFamily: "skills_section",
      actionDepth: "structure",
      targetSection: "skills",
      priority: "medium",
      source: "fallback",
    },
    {
      adviceId: "fb_format_cleanup",
      title: "先把版面压到可快速扫描",
      mentorLens: "格式问题不只是好不好看，它会影响 ATS 解析，也会影响 HR 是否愿意继续读细节。",
      currentDiagnosis: "简历需要进一步检查版面、日期、section 顺序和一页可读性，避免内容被格式问题拖累。",
      action: "统一日期格式和 section 标题，删掉低相关内容，把最相关经历留在第一页上半部；导出 PDF 后检查是否仍可复制、可搜索、无错位。",
      reason: "格式清楚后，招聘方才会把注意力放在经历内容，而不是先处理阅读阻力。",
      HR_os: "排版稳定会让我更快进入内容；如果版面乱，很多亮点还没被读到就已经扣分。",
      hrPerspective: "排版稳定会让我更快进入内容；如果版面乱，很多亮点还没被读到就已经扣分。",
      evidence: ["ATS 解析稳定性", "格式可读性", "一页扫描效率"],
      get problemSummary() { return this.currentDiagnosis; },
      get actionSummary() { return this.action; },
      relatedProblemTags: ["format_parse_risk", "section_structure_weak", "resume_length_risk"],
      canonicalActionFamily: "format_cleanup",
      actionDepth: "delivery",
      targetSection: "overall",
      priority: "medium",
      source: "fallback",
    },
    {
      adviceId: "fb_education_signal",
      title: "用课程或项目补足 junior 信号",
      mentorLens: "经验还不长时，课程、训练和项目可以补岗位信号，但必须写成能力证据，而不是课程名单。",
      currentDiagnosis: "教育背景和项目训练还没有充分服务目标岗位，相关内容可以更靠近 JD 职责来表达。",
      action: `保留和 ${roleName} 相关的课程、项目或证书，把它们写成「学了什么方法 + 做了什么交付物 + 支撑哪项岗位能力」。`,
      reason: "这能把学生背景转成岗位可读的训练证据，尤其适合 entry-level / trainee 类岗位。",
      HR_os: "经验不长时，我会看训练是否补得上；相关课程别只列名字，要让我看到它和岗位的关系。",
      hrPerspective: "经验不长时，我会看训练是否补得上；相关课程别只列名字，要让我看到它和岗位的关系。",
      evidence: ["Entry-level 训练证据", "Education 可迁移信号", "项目经历不足"],
      get problemSummary() { return this.currentDiagnosis; },
      get actionSummary() { return this.action; },
      relatedProblemTags: ["education_signal_weak", "project_evidence_gap", "entry_level_training_signal"],
      canonicalActionFamily: "education_signal",
      actionDepth: "evidence",
      targetSection: "education",
      priority: "low",
      source: "fallback",
    },
    {
      adviceId: "fb_profile_links",
      title: "补齐可验证入口",
      mentorLens: "可验证链接会降低招聘方确认成本。没有入口时，很多项目和经历只能停留在文字描述里。",
      currentDiagnosis: "简历头部和项目入口还可以更完整，尤其是 LinkedIn、作品、项目或可点击链接。",
      action: "检查邮箱、电话、LinkedIn 是否完整；如果有项目、作品集或 GitHub，把最能证明目标岗位能力的链接放在 header 或项目名旁边。",
      reason: "可验证入口能增强可信度，也能让付费版建议里的项目证据更容易被招聘方确认。",
      HR_os: "如果我能一键看到作品或项目，判断成本会低很多；没有链接时，只能按文字可信度打折。",
      hrPerspective: "如果我能一键看到作品或项目，判断成本会低很多；没有链接时，只能按文字可信度打折。",
      evidence: ["链接完整性", "项目可验证性", "Header 信息"],
      get problemSummary() { return this.currentDiagnosis; },
      get actionSummary() { return this.action; },
      relatedProblemTags: ["profile_links_missing", "project_link_missing", "contact_info_incomplete"],
      canonicalActionFamily: "profile_links",
      actionDepth: "delivery",
      targetSection: "header",
      priority: "low",
      source: "fallback",
    },
    {
      adviceId: "fb_section_structure",
      title: "调整 section 顺序，让主线更清楚",
      mentorLens: "简历 section 顺序会影响第一眼判断。最能证明目标岗位的内容应该先出现，而不是按模板机械排列。",
      currentDiagnosis: "当前简历主线还可以更集中，section 顺序需要服务目标岗位，而不是平均展示所有经历。",
      action: `按 ${roleName} 的相关性重排内容：最相关的 Summary、Skills 和 Experience 靠前；低相关活动、奖项或课程后移或删除。`,
      reason: "这能让免费版指出的问题在付费版里变成更具体的结构调整，而不是重复同一句定位建议。",
      HR_os: "我不会平均阅读每个 section；越靠前的内容越决定我怎么理解你。",
      hrPerspective: "我不会平均阅读每个 section；越靠前的内容越决定我怎么理解你。",
      evidence: ["Section 顺序", "岗位主线", "信息优先级"],
      get problemSummary() { return this.currentDiagnosis; },
      get actionSummary() { return this.action; },
      relatedProblemTags: ["section_structure_weak", "weak_target_role_alignment", "resume_not_tailored_to_jd"],
      canonicalActionFamily: "section_structure",
      actionDepth: "structure",
      targetSection: "overall",
      priority: "low",
      source: "fallback",
    },
    {
      adviceId: "fb_transferable_framing",
      title: "把原经历翻译成岗位可读语言",
      mentorLens: "转方向或投 trainee 类岗位时，重点不是隐藏原背景，而是把原经历改写成目标岗位能理解的能力信号。",
      currentDiagnosis: `你的经历里有可迁移能力，但还没有充分翻译成 ${roleName} 会关心的业务、协作和交付语言。`,
      action: `把最相关的 2 条经历按 ${roleName} 视角重写：先写你支持了什么业务目标，再写你用了什么分析、沟通或协调方法，最后写交付物或改进结果。`,
      reason: "这样能让非同专业背景也显得顺理成章，付费建议可以从“哪里不匹配”继续推进到“如何把已有经历转成匹配”。",
      HR_os: "我不介意候选人背景不是一模一样；但你要帮我看懂，这段经历为什么能迁移到现在这个岗位。",
      hrPerspective: "我不介意候选人背景不是一模一样；但你要帮我看懂，这段经历为什么能迁移到现在这个岗位。",
      evidence: ["可迁移能力", "经历叙事", "岗位语言"],
      get problemSummary() { return this.currentDiagnosis; },
      get actionSummary() { return this.action; },
      relatedProblemTags: ["transferable_experience_framing", "weak_target_role_alignment", "low_content_quality"],
      canonicalActionFamily: "transferable_framing",
      actionDepth: "rewrite",
      targetSection: "experience",
      priority: "low",
      source: "fallback",
    },
    {
      adviceId: "fb_cross_functional_delivery",
      title: "突出跨部门协作交付",
      mentorLens: "Management Trainee 会轮到不同部门，招聘方会特别看你能不能和不同角色一起把事情推进到结果。",
      currentDiagnosis: "简历里有协作和团队经历，但还可以更明确写出你和哪些对象配合、推进了什么任务、最后交付了什么。",
      action: "选一段最相关经历，改成「协作对象 + 你负责的推进动作 + 交付物」结构，例如和老师、同学、经理或跨职能成员一起完成报告、流程、分析或运营任务。",
      reason: "这能把普通团队合作写成管培生更需要的跨部门推进能力，而不是泛泛写 communication / teamwork。",
      HR_os: "管培生不是只看聪明，我会看你能不能和不同部门的人一起把任务落地。",
      hrPerspective: "管培生不是只看聪明，我会看你能不能和不同部门的人一起把任务落地。",
      evidence: ["跨部门协作", "交付物", "团队推进"],
      get problemSummary() { return this.currentDiagnosis; },
      get actionSummary() { return this.action; },
      relatedProblemTags: ["cross_functional_collaboration_gap", "weak_soft_skill_evidence", "weak_target_role_alignment"],
      canonicalActionFamily: "cross_functional_delivery",
      actionDepth: "evidence",
      targetSection: "experience",
      priority: "medium",
      source: "fallback",
    },
    {
      adviceId: "fb_business_reporting_output",
      title: "把分析经历写成业务报告产出",
      mentorLens: "管培生 JD 里的 analyze data / create reports 不只是会用工具，而是能把信息整理成管理者能用的报告或建议。",
      currentDiagnosis: "简历里有 data analysis 和 reporting 信号，但还可以更清楚说明这些分析服务了什么业务判断或管理动作。",
      action: "把一条数据或研究经历改写成「分析对象 + 报告/总结产出 + 支持的决策或改进」；如果是课程或项目，也要写清楚最终交付物，而不是只写用了哪些工具。",
      reason: "这能直接对齐 JD 中 analyze data、create reports 和 assist managers 的职责，比单独列 data analysis 更有岗位感。",
      HR_os: "我会问这份分析最后给谁看、用来做什么；能讲清楚产出，经历就更像工作能力。",
      hrPerspective: "我会问这份分析最后给谁看、用来做什么；能讲清楚产出，经历就更像工作能力。",
      evidence: ["Data analysis", "Reporting output", "业务决策"],
      get problemSummary() { return this.currentDiagnosis; },
      get actionSummary() { return this.action; },
      relatedProblemTags: ["reporting_output_gap", "weak_experience_keyword_evidence", "low_jd_keyword_match"],
      canonicalActionFamily: "business_reporting",
      actionDepth: "proof",
      targetSection: "experience",
      priority: "medium",
      source: "fallback",
    },
    {
      adviceId: "fb_process_improvement_framing",
      title: "补出流程改进视角",
      mentorLens: "Management Trainee 的价值不只是完成任务，还包括观察流程、发现问题、提出改进建议。",
      currentDiagnosis: "简历目前对 process improvement 的表达不够突出，容易让经历停留在执行层面。",
      action: "从经历里找一件你整理、检查、协调或汇总过的任务，补一句你发现了什么低效点、如何优化步骤、或给团队留下了什么更清楚的流程/文档。",
      reason: "这能把执行型经历提升到管理训练岗位更看重的流程意识和改进意识。",
      HR_os: "管培生要有一点 owner 视角；如果你能看到流程哪里可以改，会比只说完成任务更有潜力。",
      hrPerspective: "管培生要有一点 owner 视角；如果你能看到流程哪里可以改，会比只说完成任务更有潜力。",
      evidence: ["Process improvement", "Owner mindset", "流程意识"],
      get problemSummary() { return this.currentDiagnosis; },
      get actionSummary() { return this.action; },
      relatedProblemTags: ["process_improvement_gap", "weak_target_role_alignment", "low_content_quality"],
      canonicalActionFamily: "process_improvement",
      actionDepth: "rewrite",
      targetSection: "experience",
      priority: "medium",
      source: "fallback",
    },
    {
      adviceId: "fb_rotation_readiness",
      title: "写出轮岗适应能力",
      mentorLens: "管培生岗位的特殊点是轮岗。简历需要证明你能快速学习新场景，而不是只适合单一专业任务。",
      currentDiagnosis: "简历还没有充分体现你适应不同任务、不同团队和不同业务场景的能力。",
      action: "在 Summary 或经历 bullet 中加入一条轮岗可读的表达：强调你能快速学习新流程、和不同团队协作，并把分析或报告任务转化为可执行交付。",
      reason: "这比单纯写 willing to learn 更有证据，也更贴近 Management Trainee 的岗位设计。",
      HR_os: "我会看候选人是不是只会一个窄任务；能快速切换场景，对管培生很重要。",
      hrPerspective: "我会看候选人是不是只会一个窄任务；能快速切换场景，对管培生很重要。",
      evidence: ["轮岗适应", "快速学习", "跨场景协作"],
      get problemSummary() { return this.currentDiagnosis; },
      get actionSummary() { return this.action; },
      relatedProblemTags: ["rotation_readiness_gap", "weak_summary_role_alignment", "weak_target_role_alignment"],
      canonicalActionFamily: "rotation_readiness",
      actionDepth: "delivery",
      targetSection: "summary",
      priority: "low",
      source: "fallback",
    },
  ];
  for (const template of templates) {
    if (selected.length >= count) break;
    if (!isDisplayableByFamilyRoleGuard(template, internalAtsResult)) continue;
    if (template.relatedProblemTags.some((tag) => !usedTags.has(tag))) {
      selected.push(template);
      template.relatedProblemTags.forEach((tag) => usedTags.add(tag));
    }
  }
  for (const template of templates) {
    if (selected.length >= count) break;
    if (!isDisplayableByFamilyRoleGuard(template, internalAtsResult)) continue;
    if (!selected.some((item) => item.adviceId === template.adviceId)) selected.push(template);
  }
  return selected.slice(0, count);
}

function groupAdviceByMentor(candidates = []) {
  const buckets = new Map();
  for (const card of candidates) {
    const mentorName = card.mentorName || "Y导师";
    const key = mentorName;
    if (!buckets.has(key)) {
      const company = inferCompanyFromMentor(card);
      buckets.set(key, {
        mentorId: `mentor_${buckets.size + 1}_${normalizeTerm(mentorName || "mentor")}`,
        mentorName,
        company,
        companyLogo: resolveCompanyLogo(company),
        mentorTitle: inferMentorTitle(card),
        careerPathDisplay: card.mentor_career_path_display || null,
        badges: [],
        cards: [],
        roleFamilies: new Set(),
      });
    }
    const b = buckets.get(key);
    b.cards.push(card);
    splitCsv(card.roleFamily || card.role_family || "").filter(Boolean).forEach((rf) => b.roleFamilies.add(rf));
  }
  return [...buckets.values()].map((bucket) => {
    const sorted = bucket.cards.sort((a, b) => compareCardsStable(a, b, [], new Set(), []));
    return {
      ...bucket,
      badges: buildMentorBadges(sorted),
      cards: sorted,
      roleFamilies: [...bucket.roleFamilies],
    };
  });
}

function inferCompanyFromMentor(card = {}) {
  // Direct from DB (segments.mentor_company populated via mentors join in migration)
  if (card.mentor_company) return card.mentor_company;
  // Final fallback
  return "Amazon";
}

function inferMentorTitle(card = {}) {
  // Prefer actual title from DB
  if (card.mentor_title) return card.mentor_title;
  // Intent-based fallback
  if (card.adviceIntent === "resume_jd_keyword_fix") return "ATS / JD 关键词策略师";
  if (card.adviceIntent === "resume_section_rewrite") return "简历内容优化师";
  if (card.adviceIntent === "resume_content_quality") return "经历成果表达师";
  if (card.adviceIntent === "job_search_strategy") return "求职策略顾问";
  if (card.adviceIntent === "resume_positioning") return "岗位定位顾问";
  return "简历策略师";
}

function buildMentorBadges(cards = []) {
  const cardArr = Array.isArray(cards) ? cards : [cards];
  // Prefer career keywords pre-stored in DB
  const kwJson = cardArr.find((c) => c.mentor_career_keywords)?.mentor_career_keywords;
  if (kwJson) {
    try {
      const kws = JSON.parse(kwJson);
      if (Array.isArray(kws) && kws.length) return kws.slice(0, 3);
    } catch (_) {}
  }
  // Fallback: use L1 topic categories from cards
  const topics = [...new Set(cardArr.map((c) => c.L1 || c.topic).filter(Boolean))];
  if (topics.length) return topics.slice(0, 3);
  return ["简历优化", "ATS 策略"];
}

function coverageForAdvice(item = {}) {
  return new Set(item.relatedProblemTags || []);
}

function calculateAdviceCoverage(adviceItems = [], problemTags = []) {
  const target = new Set(problemTags.map((item) => item.tag || item).filter(Boolean));
  const covered = new Set();
  for (const item of adviceItems) {
    for (const tag of item.relatedProblemTags || []) {
      if (target.has(tag)) covered.add(tag);
    }
  }
  return covered;
}

function adviceTextForCoverage(item = {}) {
  return [
    item.title,
    item.currentDiagnosis,
    item.problemSummary,
    item.action,
    item.actionSummary,
    item.mentorLens,
    item.mentorInsight,
    item.reason,
    item.example,
    ...(item.evidence || []),
  ].filter(Boolean).join(" ").toLowerCase();
}

function adviceCoversObligation(item = {}, obligation = {}) {
  const tag = obligation.tag || "";
  const relatedTags = new Set(item.relatedProblemTags || []);
  if (tag && relatedTags.has(tag)) {
    if (!actionMatchesProblemTag(tag, item.action || item.actionSummary || "")) return false;
    const kws = obligation.keywords || [];
    if (!kws.length) return true;
    const text = [
      item.action,
      item.actionSummary,
      item.title,
      ...(item.evidence || []),
    ].filter(Boolean).join(" ").toLowerCase();
    return kws.some((kw) => kw && text.includes(String(kw).toLowerCase()));
  }
  const text = adviceTextForCoverage(item);
  if (obligation.coverageFamily && text.includes(String(obligation.coverageFamily).replace(/_/g, " "))) return true;
  if ((obligation.keywords || []).some((kw) => kw && text.includes(String(kw).toLowerCase()))) return true;
  return false;
}

function calculateObligationCoverage(adviceItems = [], obligations = []) {
  const covered = new Set();
  for (const obligation of obligations) {
    if (adviceItems.some((item) => adviceCoversObligation(item, obligation))) {
      covered.add(obligation.id || obligation.tag);
    }
  }
  return covered;
}

function adviceSelectionScore(card, targetProblemTags, coveredTags, selectedCards = []) {
  const related = relatedTagsForCard(card, targetProblemTags);
  const uncovered = related.filter((tag) => !coveredTags.has(tag));
  const matchedReasons = new Set(card.matched_reasons || []);

  const problemFitScore = getProblemFitScore(card, targetProblemTags);
  const actionabilityScore = getActionabilityScore(card);
  const specificityScore = getSpecificityScore(card);
  const transferabilityScore = getTransferabilityScore(card);
  const roleFitScore = Math.max(0, 1 - (card.roleMismatchPenalty || 0));
  const retrievalScore = card.retrieval_score || 0;
  const roleSignalScore = Math.min(1,
    (matchedReasons.has("role_family") ? 0.45 : 0) +
    (matchedReasons.has("target_roles") ? 0.35 : 0) +
    (matchedReasons.has("content_keywords") ? 0.20 : 0)
  );
  const universalOnlyPenalty = matchedReasons.has("universal_fallback") && roleSignalScore === 0 ? 0.08 : 0;

  // Bonus for covering new uncovered problems
  const uncoveredBonus = Math.min(1, uncovered.length / 2);
  // Topic diversity bonus
  const selectedTopics = new Set(selectedCards.map((c) => c._topicCluster || inferTopicCluster(c)));
  const thisCluster = card._topicCluster || inferTopicCluster(card);
  const topicDiversityBonus = selectedTopics.has(thisCluster) ? 0 : 0.12;
  const selectedActionFamilies = new Set(selectedCards.map((c) => c._actionFamily || inferAdviceActionFamily(c)));
  const thisActionFamily = card._actionFamily || inferAdviceActionFamily(card);
  const actionDiversityBonus = selectedCards.length && !selectedActionFamilies.has(thisActionFamily) ? 0.10 : 0;
  const actionRepeatPenalty = selectedActionFamilies.has(thisActionFamily) ? 0.07 : 0;

  return (
    0.35 * (problemFitScore * 0.6 + uncoveredBonus * 0.4) +
    0.20 * actionabilityScore +
    0.15 * specificityScore +
    0.10 * transferabilityScore +
    0.10 * roleFitScore +
    0.08 * roleSignalScore +
    0.05 * retrievalScore +
    topicDiversityBonus -
    actionRepeatPenalty +
    actionDiversityBonus -
    universalOnlyPenalty
  );
}

function stableCardScore(card, targetProblemTags = [], coveredTags = new Set(), selectedCards = []) {
  return (
    adviceSelectionScore(card, targetProblemTags, coveredTags, selectedCards) +
    dbPriorityScore(card) +
    0.035 * qualityNormalized(card.mentorQualityScore) +
    0.025 * qualityNormalized(card.feedbackScore) +
    0.020 * ({ high: 1, medium: 0.65, low: 0.25 }[normalizeTerm(card.confidence)] || 0.5) +
    0.010 * Number(card.safeToShowFree || false)
  );
}

function compareCardsStable(a, b, targetProblemTags = [], coveredTags = new Set(), selectedCards = []) {
  const diff = stableCardScore(b, targetProblemTags, coveredTags, selectedCards) -
    stableCardScore(a, targetProblemTags, coveredTags, selectedCards);
  if (Math.abs(diff) > 1e-9) return diff;
  return stableAdviceKey(a).localeCompare(stableAdviceKey(b));
}

function selectTopAdviceForMentor(mentorBucket, targetProblemTags, count, coveredTags = new Set(), internalAtsResult = {}) {
  const selected = [];
  const cards = [...(mentorBucket.cards || [])]
    .filter((card) => isGovernedAdviceDisplayable(card, internalAtsResult))
    .filter((card) => isActionPreconditionAllowed(card, internalAtsResult))
    .filter((card) => isResumeGroundedAdvice(card, internalAtsResult));
  const usedDiagnosisTags = new Set();
  while (selected.length < count && cards.length) {
    cards.sort((a, b) => compareCardsStable(a, b, targetProblemTags, coveredTags, selected));
    const card = cards.shift();
    const item = toAdviceItem(card, targetProblemTags, selected.length, true, internalAtsResult, usedDiagnosisTags);
    selected.push(item);
    item.relatedProblemTags.forEach((tag) => coveredTags.add(tag));
  }
  if (selected.length < count) {
    selected.push(...fallbackAdviceItems(internalAtsResult, count - selected.length, coveredTags));
  }
  return selected.slice(0, count);
}

function normalizeFreeAdviceLanes(adviceItems = [], internalAtsResult = {}) {
  const priorityOrder = ["high", "medium", "low"];
  const byPriority = new Map();
  const overflow = [];
  for (const item of adviceItems) {
    const priority = priorityOrder.includes(item.priority) ? item.priority : "low";
    if (!byPriority.has(priority)) {
      byPriority.set(priority, item);
    } else {
      overflow.push(item);
    }
  }

  const usedTags = new Set(adviceItems.flatMap((item) => item.relatedProblemTags || []));
  const fallback = fallbackAdviceItems(internalAtsResult, 3, usedTags);
  const result = [];
  for (const priority of priorityOrder) {
    const item = byPriority.get(priority) || overflow.shift() || fallback.shift();
    if (item) result.push(forceAdvicePriority(item, priority));
  }
  return result.slice(0, 3);
}

function normalizeAdviceBundleDiversity(adviceItems = [], candidateItems = [], internalAtsResult = {}, count = 3) {
  const priorityOrder = ["high", "medium", "low"];
  const selected = [];
  const usedAdviceIds = new Set();

  function tryAdd(item) {
    if (!item || selected.length >= count) return false;
    if (item.adviceId && usedAdviceIds.has(item.adviceId)) return false;
    if (!canAddToTwelveAdviceBundle(item, selected)) return false;
    selected.push(item);
    if (item.adviceId) usedAdviceIds.add(item.adviceId);
    return true;
  }

  for (const item of adviceItems) {
    tryAdd(item);
  }

  const usedTags = new Set(selected.flatMap((item) => item.relatedProblemTags || []));
  const fallbackPool = fallbackAdviceItems(internalAtsResult, Math.max(count * 3, 9), usedTags);
  for (const item of [...candidateItems, ...fallbackPool]) {
    if (selected.length >= count) break;
    tryAdd(item);
  }

  for (const item of adviceItems) {
    if (selected.length >= count) break;
    if (!item?.adviceId || !usedAdviceIds.has(item.adviceId)) {
      selected.push(item);
      if (item?.adviceId) usedAdviceIds.add(item.adviceId);
    }
  }

  return selected.slice(0, count).map((item, index) =>
    forceAdvicePriority(item, priorityOrder[index] || item.priority || "medium")
  );
}

function normalizeFreeAdviceVisibleDiversity(adviceItems = [], candidateItems = [], targetProblemTags = [], internalAtsResult = {}) {
  const priorityOrder = ["high", "medium", "low"];
  const selected = [];
  const usedIds = new Set();
  const hasMissingSummaryProblem = targetProblemTags.some((item) => (item.tag || item) === "missing_summary");
  if (hasMissingSummaryProblem) {
    const missingSummaryAdvice = fallbackAdviceForObligation({
      id: "missing_summary",
      tag: "missing_summary",
      dimension: "F",
      severity: "high",
      message: "简历缺少 Summary 段落，HR 和 ATS 需要先有一条清晰的岗位定位线索。",
      targetSection: "summary",
      coverageFamily: "positioning",
    }, {
      roleName: internalAtsResult.jobTitle || internalAtsResult.profile?.targetRole || "目标岗位",
      targetRole: internalAtsResult.jobTitle || internalAtsResult.profile?.targetRole || "目标岗位",
      topMissingKeywords: internalAtsResult.topMissingKeywords || internalAtsResult.priorityMissingKeywords,
    });
    if (canAddVisibleAdvice(missingSummaryAdvice, selected, targetProblemTags)) {
      selected.push(missingSummaryAdvice);
      if (missingSummaryAdvice.adviceId) usedIds.add(missingSummaryAdvice.adviceId);
    }
  }
  for (const item of adviceItems) {
    if (!item || (item.adviceId && usedIds.has(item.adviceId))) continue;
    if (!canAddVisibleAdvice(item, selected, targetProblemTags)) continue;
    selected.push(item);
    if (item.adviceId) usedIds.add(item.adviceId);
    if (selected.length >= 3) break;
  }
  for (const item of [...candidateItems, ...fallbackAdviceItems(internalAtsResult, 30, new Set())]) {
    if (selected.length >= 3) break;
    if (!item || (item.adviceId && usedIds.has(item.adviceId))) continue;
    if (!canAddVisibleAdvice(item, selected, targetProblemTags)) continue;
    selected.push(item);
    if (item.adviceId) usedIds.add(item.adviceId);
  }
  for (const item of [...candidateItems, ...fallbackAdviceItems(internalAtsResult, 30, new Set())]) {
    if (selected.length >= 3) break;
    if (!item || (item.adviceId && usedIds.has(item.adviceId))) continue;
    if (!canAddVisibleAdviceRelaxed(item, selected, targetProblemTags)) continue;
    selected.push(item);
    if (item.adviceId) usedIds.add(item.adviceId);
  }
  const ordered = hasMissingSummaryProblem
    ? selected.slice(0, 3).sort((a, b) => {
        const aCreate = visibleAdviceIntent(a) === "summary_creation" ? 1 : 0;
        const bCreate = visibleAdviceIntent(b) === "summary_creation" ? 1 : 0;
        if (aCreate !== bCreate) return bCreate - aCreate;
        const aSummaryOptimize = visibleAdviceIntent(a) === "summary_positioning" ? 1 : 0;
        const bSummaryOptimize = visibleAdviceIntent(b) === "summary_positioning" ? 1 : 0;
        if (aSummaryOptimize !== bSummaryOptimize) return aSummaryOptimize - bSummaryOptimize;
        return 0;
      })
    : selected.slice(0, 3);
  return ordered.map((item, index) =>
    forceAdvicePriority(item, priorityOrder[index] || item.priority || "medium")
  );
}

const BIG_TECH_COMPANIES = new Set([
  "Google", "Amazon", "Meta", "Microsoft", "Apple", "NVIDIA", "OpenAI",
  "ByteDance", "TikTok", "Uber", "Airbnb", "LinkedIn", "Spotify", "Robinhood",
  "Goldman Sachs", "JPMorgan", "JPMorgan Chase", "Morgan Stanley", "BlackRock",
  "McKinsey", "BCG", "Deloitte", "Accenture",
]);

function mentorMatchScore(bucket, targetProblemTags, targetRoleFamily = "") {
  const cards = bucket.cards || [];
  if (!cards.length) return 0;

  // Top-k average card score (not sum — prevents large buckets winning by volume)
  const topK = Math.min(3, cards.length);
  const cardScores = cards
    .map((card) => ({ score: stableCardScore(card, targetProblemTags, new Set(), []), key: stableAdviceKey(card) }))
    .sort((a, b) => (b.score - a.score) || a.key.localeCompare(b.key))
    .map((item) => item.score);
  const avgTopKScore = cardScores.slice(0, topK).reduce((s, v) => s + v, 0) / topK;

  // Weighted problem coverage (severity-aware)
  const covered = new Set();
  for (const card of cards) relatedTagsForCard(card, targetProblemTags).forEach((tag) => covered.add(tag));
  const totalSeverity = targetProblemTags.reduce((s, p) => s + severityWeight(p.severity || "medium"), 0) || 1;
  const coveredSeverity = targetProblemTags
    .filter((p) => covered.has(p.tag))
    .reduce((s, p) => s + severityWeight(p.severity || "medium"), 0);
  const weightedCoverage = coveredSeverity / totalSeverity;

  // Role fit: bonus not penalty — cross-domain is OK if coverage is high
  const bucketFamilies = bucket.roleFamilies || [];
  const normalized = normalizeTerm(targetRoleFamily || "");
  const roleFitScore = (bucketFamilies.includes("universal") || (normalized && bucketFamilies.includes(normalized))) ? 1.0 : 0.4;

  // Advice diversity: reward buckets with varied topic clusters
  const clusters = new Set(cards.map((c) => c._topicCluster || inferTopicCluster(c)));
  const diversityScore = Math.min(1, clusters.size / 3);

  return (
    0.35 * weightedCoverage +
    0.25 * avgTopKScore +
    0.20 * roleFitScore +
    0.10 * diversityScore +
    0.10 * qualityNormalized(cards[0]?.retrieval_score)
  );
}

function selectDiverseMentors(mentorBuckets, targetCount, targetProblemTags = [], targetRoleFamily = "") {
  const selected = [];
  const usedCompanies = new Set();
  const usedIntents = new Set();
  const sorted = [...mentorBuckets].sort((a, b) => {
    const diff = mentorMatchScore(b, targetProblemTags, targetRoleFamily) - mentorMatchScore(a, targetProblemTags, targetRoleFamily);
    if (Math.abs(diff) > 1e-9) return diff;
    const aKey = `${a.company || ""}:${a.mentorName || ""}:${stableAdviceKey(a.cards?.[0] || {})}`;
    const bKey = `${b.company || ""}:${b.mentorName || ""}:${stableAdviceKey(b.cards?.[0] || {})}`;
    return aKey.localeCompare(bKey);
  });

  // Pass 1: prefer unique company + unique primary intent
  for (const bucket of sorted) {
    if (selected.length >= targetCount) break;
    const company = bucket.company || "unknown";
    const primaryIntent = bucket.cards[0]?.adviceIntent || "resume_ats";
    const companyConflict = usedCompanies.has(company) && company !== "Amazon";
    const intentConflict = usedIntents.has(primaryIntent) && selected.length < targetCount - 1;
    if (companyConflict || intentConflict) continue;
    selected.push(bucket);
    usedCompanies.add(company);
    usedIntents.add(primaryIntent);
  }

  // Pass 2: fill remaining slots ignoring company uniqueness, still avoid same intent
  for (const bucket of sorted) {
    if (selected.length >= targetCount) break;
    if (selected.includes(bucket)) continue;
    const primaryIntent = bucket.cards[0]?.adviceIntent || "resume_ats";
    if (usedIntents.has(primaryIntent)) continue;
    selected.push(bucket);
    usedIntents.add(primaryIntent);
  }

  // Pass 3: fill any remaining with best-scoring buckets not yet selected
  for (const bucket of sorted) {
    if (selected.length >= targetCount) break;
    if (!selected.includes(bucket)) selected.push(bucket);
  }

  return selected.slice(0, targetCount);
}

function mentorFromBucket(bucket, adviceItems, targetProblemTags, index) {
  const coveredTags = [...calculateAdviceCoverage(adviceItems, targetProblemTags)];
  return {
    mentorId: bucket.mentorId || `mentor_${index + 1}`,
    mentorName: bucket.mentorName || `${String.fromCharCode(89 - index)}导师`,
    company: bucket.company || "MentorX",
    companyLogo: bucket.companyLogo || null,
    mentorTitle: bucket.mentorTitle || "简历策略师",
    badges: bucket.badges || ["ATS 简历", "导师知识库"],
    careerPathDisplay: bucket.careerPathDisplay || null,
    matchReason: buildMatchReason(coveredTags),
    matchedProblems: coveredTags,
    adviceItems,
  };
}

function buildMatchReason(tags = []) {
  if (tags.some((tag) => /keyword|hard_skill|priority/.test(tag))) return "这位导师最匹配你当前的 JD 关键词和岗位匹配问题。";
  if (tags.some((tag) => /summary|title|role|position/.test(tag))) return "这位导师更擅长处理岗位定位和 Summary 表达问题。";
  if (tags.some((tag) => /experience|evidence|measurable|result/.test(tag))) return "这位导师能帮助你把经历证据写得更像目标岗位。";
  return "这位导师的建议与你当前 ATS 简历问题高度相关。";
}

function fallbackMentor(index, internalAtsResult, coveredTags = new Set()) {
  const adviceItems = fallbackAdviceItems(internalAtsResult, 3, coveredTags);
  return mentorFromBucket({
    ...DEFAULT_FREE_MENTOR_PROFILE,
    mentorId: index === 0 ? DEFAULT_FREE_MENTOR_PROFILE.mentorId : `fallback_mentor_${index + 1}`,
    mentorName: index === 0 ? DEFAULT_FREE_MENTOR_PROFILE.mentorName : `${String.fromCharCode(89 - index)} 导师`,
    mentorTitle: ["ATS / JD 关键词策略师", "简历内容优化师", "岗位定位顾问", "经历成果表达师"][index] || "简历策略师",
  }, adviceItems, problemTagsFromInternal(internalAtsResult), index);
}

function selectFreeMentorPlan(candidates, internalAtsResult) {
  const targetProblemTags = problemTagsFromInternal(internalAtsResult).slice(0, 6);
  const profile = internalAtsResult.profile || {};
  const roleFamily = profile.roleFamily || "";
  const userProfile = { roleFamily, problemTags: targetProblemTags };

  let roleSafeRejected = 0;
  // Step 1: filter eligible free candidates
  const eligibleCandidates = candidates.filter((card) =>
    (card.unlockTier === "free" || card.safeToShowFree) &&
    FREE_HIGH_RISK_INTENTS.has(card.adviceIntent) &&
    card.adviceIntent !== "application_timing" &&
    !["interview_prep", "behavioral_interview"].includes(card.adviceScope) &&
    (!card.retrievalScope || card.retrievalScope === "resume_edit")
  ).filter((card) => {
    const safe = isAdviceRoleSafe(card, internalAtsResult.jobTitle || profile.targetRole, roleFamily);
    if (!safe) roleSafeRejected += 1;
    return safe;
  })
    .filter((card) => isCardAlignedWithTargetProblems(card, targetProblemTags))
    .filter((card) => isGovernedAdviceDisplayable(card, internalAtsResult))
    .filter((card) => isActionPreconditionAllowed(card, internalAtsResult))
    .filter((card) => isResumeGroundedAdvice(card, internalAtsResult));

  // Annotate each candidate with transferability scope + topic cluster (cached to avoid recomputation)
  for (const card of eligibleCandidates) {
    card._transferabilityScope = card._transferabilityScope || inferAdviceTransferabilityScope(card);
    card._topicCluster = card._topicCluster || inferTopicCluster(card);
    card._actionFamily = card._actionFamily || canonicalActionFamilyOf(card);
    card._actionDepth = card._actionDepth || actionDepthOf(card);
  }

  // Step 2: Issue-first — pick one free card for each priority lane.
  const rankedProblems = [...targetProblemTags].sort(sortProblemsStable);
  const laneOrder = ["p0", "p1", "p2"];
  const selectedCards = [];
  const selectedLanes = [];
  const usedCardIds = new Set();
  const usedProblemTags = new Set();
  const usedProblemFamilies = new Set();
  const usedActionFamilies = new Set();
  const coveredTags = new Set();

  function nextProblemForLane(lane) {
    const exactDiverse = rankedProblems.find((problem) =>
      !usedProblemTags.has(problem.tag) &&
      !usedProblemFamilies.has(problemFamilyForTag(problem.tag)) &&
      priorityLaneFromSeverity(problem.severity) === lane
    );
    if (exactDiverse) return exactDiverse;
    const anyDiverse = rankedProblems.find((problem) =>
      !usedProblemTags.has(problem.tag) && !usedProblemFamilies.has(problemFamilyForTag(problem.tag))
    );
    if (anyDiverse) return anyDiverse;
    const exact = rankedProblems.find((problem) =>
      !usedProblemTags.has(problem.tag) && priorityLaneFromSeverity(problem.severity) === lane
    );
    return exact || rankedProblems.find((problem) => !usedProblemTags.has(problem.tag)) || null;
  }

  function bestCardForProblem(problem) {
    if (!problem) return null;
    const exactActionDiverse = eligibleCandidates
      .filter((card) => !usedCardIds.has(card.adviceId))
      .filter((card) => relatedTagsForCard(card, targetProblemTags).includes(problem.tag))
      .filter((card) => !usedActionFamilies.has(canonicalActionFamilyOf(card)))
      .sort((a, b) => compareCardsStable(a, b, [problem], coveredTags, selectedCards))[0] || null;
    if (exactActionDiverse) return exactActionDiverse;
    return eligibleCandidates
      .filter((card) => !usedCardIds.has(card.adviceId))
      .filter((card) => relatedTagsForCard(card, targetProblemTags).includes(problem.tag))
      .sort((a, b) => compareCardsStable(a, b, [problem], coveredTags, selectedCards))[0] || null;
  }

  for (const lane of laneOrder) {
    if (selectedCards.length >= 3) break;
    const problem = nextProblemForLane(lane);
    const bestCard = bestCardForProblem(problem);
    if (bestCard) {
      selectedCards.push(bestCard);
      selectedLanes.push(lane);
      usedCardIds.add(bestCard.adviceId);
      usedActionFamilies.add(canonicalActionFamilyOf(bestCard));
      if (problem?.tag) usedProblemTags.add(problem.tag);
      if (problem?.tag) usedProblemFamilies.add(problemFamilyForTag(problem.tag));
      relatedTagsForCard(bestCard, targetProblemTags).forEach((t) => coveredTags.add(t));
    }
  }

  // Step 3: Fill remaining slots with diverse high-score candidates
  if (selectedCards.length < 3) {
    const remaining = eligibleCandidates
      .filter((card) => !usedCardIds.has(card.adviceId))
      .sort((a, b) => compareCardsStable(a, b, targetProblemTags, coveredTags, selectedCards));
    for (const card of remaining) {
      if (selectedCards.length >= 3) break;
      const lane = laneOrder.find((item) => !selectedLanes.includes(item)) || "p2";
      selectedCards.push(card);
      selectedLanes.push(lane);
      usedCardIds.add(card.adviceId);
      usedActionFamilies.add(canonicalActionFamilyOf(card));
      relatedTagsForCard(card, targetProblemTags).forEach((t) => usedProblemFamilies.add(problemFamilyForTag(t)));
      relatedTagsForCard(card, targetProblemTags).forEach((t) => coveredTags.add(t));
    }
  }

  // Step 4: Convert to advice items
  const usedDiagnosisTags = new Set();
  let adviceItems = selectedCards.map((card, i) => {
    const item = toAdviceItem(card, targetProblemTags, i, true, internalAtsResult, usedDiagnosisTags);
    forceAdvicePriority(item, priorityForLane(selectedLanes[i] || laneOrder[i] || "p2"));
    const meta = generateAdviceExplanationMetadata(card, userProfile);
    item.matchReason = meta.matchReason;
    item.mentorFitType = meta.mentorFitType;
    item.topicCluster = meta.topicCluster;
    item.confidenceScore = meta.confidenceScore;
    item.adviceTransferScope = meta.adviceTransferScope;
    return item;
  });

  const alternativeItems = eligibleCandidates
    .filter((card) => !usedCardIds.has(card.adviceId))
    .sort((a, b) => compareCardsStable(a, b, targetProblemTags, coveredTags, selectedCards))
    .slice(0, 18)
    .map((card, i) => {
      const item = toAdviceItem(card, targetProblemTags, i, true, internalAtsResult, new Set());
      const meta = generateAdviceExplanationMetadata(card, userProfile);
      item.matchReason = meta.matchReason;
      item.mentorFitType = meta.mentorFitType;
      item.topicCluster = meta.topicCluster;
      item.confidenceScore = meta.confidenceScore;
      item.adviceTransferScope = meta.adviceTransferScope;
      return item;
    });

  adviceItems = normalizeFreeAdviceLanes(adviceItems, internalAtsResult);
  adviceItems = normalizeAdviceBundleDiversity(adviceItems, alternativeItems, internalAtsResult, 3);
  adviceItems = normalizeFreeAdviceVisibleDiversity(adviceItems, alternativeItems, targetProblemTags, internalAtsResult);
  adviceItems = avoidRepeatedPerspectives(adviceItems);

  // Step 5: Choose displayed mentor — pick best bucket that covers most problems
  let plan;
  if (eligibleCandidates.length === 0 && selectedCards.length === 0) {
    plan = fallbackMentor(0, internalAtsResult);
  } else {
    const buckets = groupAdviceByMentor(eligibleCandidates.length > 0 ? eligibleCandidates : candidates);
    const roleSafeBuckets = buckets.filter((b) => isBucketRoleSafe(b, roleFamily));
    const candidateBuckets = roleSafeBuckets.length > 0 ? roleSafeBuckets : buckets;
    const bestBucket = selectDiverseMentors(candidateBuckets, 1, targetProblemTags, roleFamily)[0];

    const mergedBucket = bestBucket ? {
      ...DEFAULT_FREE_MENTOR_PROFILE,
      ...bestBucket,
      company: bestBucket.company || DEFAULT_FREE_MENTOR_PROFILE.company,
      companyLogo: bestBucket.companyLogo || null,
      mentorTitle: bestBucket.mentorTitle || DEFAULT_FREE_MENTOR_PROFILE.mentorTitle,
      careerPathDisplay: bestBucket.careerPathDisplay || null,
    } : { ...DEFAULT_FREE_MENTOR_PROFILE };

    plan = mentorFromBucket(mergedBucket, adviceItems, targetProblemTags, 0);
  }

  plan.mentorLogoPool = buildMentorLogoPoolFromItems(adviceItems);
  if (!plan.mentorLogoPool.length) {
    plan.mentorLogoPool = buildMentorLogoPoolFromCandidates(eligibleCandidates.length > 0 ? eligibleCandidates : candidates, 12);
  }

  Object.defineProperty(plan, "debug", {
    enumerable: false,
    value: {
      roleSafeRejected,
      freeAdviceSources: (plan.adviceItems || []).map((item) => item.source || "db"),
      issueFirst: true,
      problemsRanked: rankedProblems.map((p) => p.tag),
      actionPreconditionRejected: internalAtsResult._actionPreconditionRejected || {},
    },
  });
  return plan;
}

function buildFreeMentorAdvicePlan({ candidates = [], internalAtsResult = {}, publicReport = null } = {}) {
  return selectFreeMentorPlan(candidates, internalAtsResult, publicReport);
}

function bundleFamilyStats(items = []) {
  const counts = new Map();
  const depths = new Map();
  for (const item of items) {
    const family = canonicalActionFamilyOf(item);
    const depth = actionDepthOf(item);
    counts.set(family, (counts.get(family) || 0) + 1);
    if (!depths.has(family)) depths.set(family, new Set());
    depths.get(family).add(depth);
  }
  return { counts, depths };
}

function normalizedBundleVisibleText(value = "") {
  return String(value || "")
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[，。；、,.!?;:："'“”‘’（）()\[\]{}<>]/g, "")
    .trim();
}

function canAddToTwelveAdviceBundle(item = {}, existingItems = []) {
  const family = canonicalActionFamilyOf(item);
  const depth = actionDepthOf(item);
  const stats = bundleFamilyStats(existingItems);
  const count = stats.counts.get(family) || 0;
  if (count >= 2) return false;
  if (count >= 1 && (stats.depths.get(family) || new Set()).has(depth)) return false;
  const itemAction = normalizedBundleVisibleText(item.action || item.actionSummary || item.generalized_action || item.generalizedAction);
  const itemTitle = normalizedBundleVisibleText(item.title || item.canonicalTitle || item.canonical_title);
  for (const existing of existingItems) {
    const existingAction = normalizedBundleVisibleText(existing.action || existing.actionSummary || existing.generalized_action || existing.generalizedAction);
    const existingTitle = normalizedBundleVisibleText(existing.title || existing.canonicalTitle || existing.canonical_title);
    if (itemAction && existingAction && itemAction.length >= 18 && itemAction === existingAction) return false;
    if (count >= 1 && itemTitle && existingTitle && itemTitle === existingTitle) return false;
  }
  return true;
}

function visibleAdviceText(item = {}) {
  return [
    item.title,
    item.currentDiagnosis,
    item.problemSummary,
    item.action,
    item.actionSummary,
    item.mentorLens,
    item.reason,
    item.hrPerspective,
    ...(item.evidence || []),
  ].filter(Boolean).join(" ");
}

function visibleAdviceIntent(item = {}) {
  const family = canonicalActionFamilyOf(item);
  const text = visibleAdviceText(item).toLowerCase();
  if (family === "summary_creation" || /missing_summary|缺少\s*summary|新增\s*summary|补上\s*summary|add\s+(?:a\s+)?summary/.test(text)) return "summary_creation";
  if (family === "profile_links" || /linkedin|github|portfolio|project link|可验证|链接|入口|header/.test(text)) return "profile_links";
  if (family === "education_signal" || /education|course|certificate|lab\/project|课程|证书|训练|教育背景|junior/.test(text)) return "education_training";
  if (family === "quantified_impact" || /量化|结果表达|职责描述|规模|频率|效率|impact|metrics?|数字/.test(text)) return "quantified_result";
  if (family === "skills_section" || /skills.*顺序|skills.*前半段|重排.*skills|技能.*顺序|技能.*前半段/.test(text)) return "skills_order";
  if (family === "jd_keyword_alignment" || /jd.*关键词|关键词.*jd|核心.*关键词|岗位关键词|skills.*关键词/.test(text)) return "jd_keywords";
  if (family === "summary_positioning" || /summary|objective|岗位原词|目标岗位导向|定位/.test(text)) return "summary_positioning";
  if (family === "experience_evidence" || /experience|bullet|经历|项目证据|方法\/工具/.test(text)) return "experience_evidence";
  return family || "overall";
}

function isLowValueGenericFallbackAdvice(item = {}) {
  const text = visibleAdviceText(item);
  return /优化建议/.test(String(item.title || "")) &&
    /围绕.+重新检查.+把最相关的关键词、职责和结果证据写得更明确/.test(text);
}

function hasExplicitProfileLinkProblem(targetProblemTags = []) {
  return targetProblemTags.some((item) => {
    const text = [
      item.tag,
      item.coverageFamily,
      item.targetSection,
      item.message,
      ...(item.keywords || []),
    ].filter(Boolean).join(" ").toLowerCase();
    return /linkedin|github|portfolio|profile_links|project_link|contact_info|missing_.*link|header.*link/.test(text);
  });
}

function canAddVisibleAdvice(item = {}, existingItems = [], targetProblemTags = []) {
  if (isLowValueGenericFallbackAdvice(item)) return false;
  if (!canAddToTwelveAdviceBundle(item, existingItems)) return false;
  const intent = visibleAdviceIntent(item);
  const intentCount = existingItems.filter((existing) => visibleAdviceIntent(existing) === intent).length;
  const hasSkillsOrder = existingItems.some((existing) => visibleAdviceIntent(existing) === "skills_order");
  if (intent === "profile_links" && !hasExplicitProfileLinkProblem(targetProblemTags)) return false;
  if (["summary_creation", "summary_positioning", "quantified_result", "education_training", "profile_links"].includes(intent) && intentCount >= 1) return false;
  if (intent === "jd_keywords" && (intentCount >= 1 || hasSkillsOrder)) return false;
  return true;
}

function canAddVisibleAdviceRelaxed(item = {}, existingItems = [], targetProblemTags = []) {
  if (isLowValueGenericFallbackAdvice(item)) return false;
  if (!canAddToTwelveAdviceBundle(item, existingItems)) return false;
  const intent = visibleAdviceIntent(item);
  const intentCount = existingItems.filter((existing) => visibleAdviceIntent(existing) === intent).length;
  if (intent === "profile_links" && !hasExplicitProfileLinkProblem(targetProblemTags)) return false;
  if (["summary_creation", "summary_positioning", "quantified_result", "education_training", "profile_links"].includes(intent) && intentCount >= 1) return false;
  if (intent === "jd_keywords" && intentCount >= 1) return false;
  return true;
}

function canAddHardTopUpAdvice(item = {}, existingItems = [], targetProblemTags = []) {
  if (isLowValueGenericFallbackAdvice(item)) return false;
  const intent = visibleAdviceIntent(item);
  if (intent === "profile_links" && !hasExplicitProfileLinkProblem(targetProblemTags)) return false;
  const itemAction = normalizedBundleVisibleText(item.action || item.actionSummary);
  const itemTitle = normalizedBundleVisibleText(item.title);
  for (const existing of existingItems) {
    const existingAction = normalizedBundleVisibleText(existing.action || existing.actionSummary);
    const existingTitle = normalizedBundleVisibleText(existing.title);
    if (item.adviceId && existing.adviceId === item.adviceId) return false;
    if (itemAction && existingAction && itemAction.length >= 18 && itemAction === existingAction) return false;
    if (itemTitle && existingTitle && itemTitle === existingTitle) return false;
  }
  return true;
}

function normalizePaidAdviceVisibleDiversity(paidItems = [], freeItems = [], targetProblemTags = [], internalAtsResult = {}) {
  const selected = [];
  const usedIds = new Set(freeItems.map((item) => item.adviceId).filter(Boolean));
  for (const item of paidItems) {
    if (!item || (item.adviceId && usedIds.has(item.adviceId))) continue;
    if (!canAddVisibleAdvice(item, [...freeItems, ...selected], targetProblemTags)) continue;
    selected.push(item);
    if (item.adviceId) usedIds.add(item.adviceId);
    if (selected.length >= 9) return selected;
  }

  const fallbackPool = fallbackAdviceItems(internalAtsResult, 60, new Set());
  for (const item of fallbackPool) {
    if (selected.length >= 9) break;
    if (!item || (item.adviceId && usedIds.has(item.adviceId))) continue;
    if (!canAddVisibleAdvice(item, [...freeItems, ...selected], targetProblemTags)) continue;
    selected.push(item);
    if (item.adviceId) usedIds.add(item.adviceId);
  }
  return selected.slice(0, 9);
}

function cleanDisplayExample(example = "") {
  const text = String(example || "").trim();
  if (!text) return "";
  if (/^[（(]?\s*无具体示例\s*[）)]?$/i.test(text)) return "";
  if (/^\?{3,}$/.test(text)) return "";
  if (/^(?:n\/a|none|null|undefined|-|—)$/i.test(text)) return "";
  return text;
}

function displayLabelForAdvice(item = {}) {
  const intent = visibleAdviceIntent(item);
  const family = canonicalActionFamilyOf(item);
  const labels = {
    summary_creation: "开头定位",
    summary_positioning: "开头定位",
    jd_keywords: "JD 关键词",
    jd_keyword_alignment: "JD 关键词",
    keyword_visibility: "JD 关键词",
    jd_terminology: "JD 关键词",
    skills_order: "技能区块",
    skills_section: "技能区块",
    experience_evidence: "经历证据",
    project_evidence: "项目证据",
    quantified_result: "量化成果",
    quantified_impact: "量化成果",
    education_training: "教育证书",
    education_signal: "教育证书",
    cross_functional_delivery: "协作交付",
    business_reporting: "报告产出",
    process_improvement: "流程改进",
    manager_assist_evidence: "协助证据",
    learning_adaptability: "学习适应",
    customer_business_exposure: "客户业务",
    format_cleanup: "格式结构",
    section_structure: "格式结构",
    profile_links: "资料链接",
    transferable_framing: "岗位语言",
  };
  return labels[intent] || labels[family] || "简历修改";
}

function fallbackPerspectiveForFamily(item = {}, role = "mentor") {
  const family = canonicalActionFamilyOf(item);
  const mentor = {
    education_signal: "这条要把课程、证书或训练写成岗位能力证据；只列课程名不够，要说明它支撑了哪项职责。",
    quantified_impact: "这条要把 impact 放到经历里，用数量、频率、规模或效率说明贡献，避免只写负责和参与。",
    cross_functional_delivery: "这条不要只写 teamwork，要写清楚协作对象、推进动作和最后交付物。",
    business_reporting: "报告类经历要写清楚分析对象、报告产出和服务的判断，否则只像工具使用记录。",
    process_improvement: "流程改进要回到真实任务里，写发现了什么低效点、怎么整理或优化、留下了什么结果。",
    manager_assist_evidence: "assist 后面要有具体任务和交付物，才会像能接住日常运营或支持工作的候选人。",
    learning_adaptability: "学习适应力最好用一段新任务经历证明，而不是只在 Summary 里自我评价。",
    customer_business_exposure: "客户或业务意识要写到具体对象和需求里，让人看懂你支持了什么业务场景。",
    summary_creation: "没有 Summary 时，先搭出岗位定位入口；后续关键词和经历证据才有承载位置。",
    summary_positioning: "岗位定位要先收束主线，让开头、技能和最靠前经历都指向同一个目标岗位。",
    jd_keyword_alignment: "关键词不要只堆在 Skills，最好回到真实经历里，让 ATS 扫得到，HR 也看得到证据。",
  };
  const hr = {
    education_signal: "我会看教育信息能不能补足岗位训练证据；课程、证书和 lab/project 要和目标职责有关系。",
    quantified_impact: "我会优先看结果和规模；只有职责没有数字时，很难判断实际贡献。",
    cross_functional_delivery: "我不会只因为写了 teamwork 就加分；要看到你和谁协作、推动了什么、交付了什么。",
    business_reporting: "我会问这份分析最后给谁看、用来做什么；能讲清产出，经历才更像工作能力。",
    process_improvement: "我会看候选人有没有发现问题和优化流程的意识，而不是只完成被分配的任务。",
    manager_assist_evidence: "我会看 assist 后面到底是什么事；写清楚任务和产出，才像能马上上手的人。",
    learning_adaptability: "我想看到你过去怎么学新东西并完成交付，而不是只看到一句愿意学习。",
    customer_business_exposure: "我会看你是否理解服务对象和业务需求；只写内部任务会少一层岗位感。",
    summary_creation: "我第一眼会看简历开头能不能说明你投什么岗位；没有 Summary 时，后面的信息更容易被读散。",
    summary_positioning: "我会看标题、Summary、技能排序和前几条经历是不是指向同一岗位。",
    jd_keyword_alignment: "我会用 JD 关键词快速确认基本匹配；核心词缺失时，第一轮就容易显得不贴合。",
  };
  return (role === "hr" ? hr : mentor)[family] || (role === "hr"
    ? "我会看这条修改能不能直接降低筛选成本，而不是只让文字更好看。"
    : "这条建议要回到真实经历里，写出目标岗位能读懂的职责、证据和结果。");
}

function perspectiveMatchesFamily(text = "", item = {}) {
  const family = canonicalActionFamilyOf(item);
  const value = String(text || "").toLowerCase();
  const itemContext = [
    item.title,
    item.currentDiagnosis,
    item.problemSummary,
    item.action,
    item.actionSummary,
  ].filter(Boolean).join(" ").toLowerCase();
  if (family === "quantified_impact" &&
      /新增用户|销售增长|识别率|sales growth|new users|recognition rate/.test(value) &&
      !/新增用户|销售增长|识别率|sales growth|new users|recognition rate/.test(itemContext)) {
    return false;
  }
  const checks = {
    education_signal: /education|course|certificate|training|lab|project|课程|证书|训练|教育|项目/,
    quantified_impact: /量化|数字|数量|频率|规模|效率|结果|成果|贡献|impact|metric|result/,
    cross_functional_delivery: /协作|协调|跨部门|对象|推进|交付|team|stakeholder|collaborat|coordinate/,
    business_reporting: /报告|报表|分析|汇总|产出|决策|report|analysis|dashboard|summary/,
    process_improvement: /流程|优化|改进|效率|规范|process|workflow|improv|efficien/,
    manager_assist_evidence: /assist|support|协助|支持|经理|主管|任务|产出|交付/,
    learning_adaptability: /学习|适应|新任务|上手|learn|adapt|training/,
    customer_business_exposure: /客户|用户|业务|服务|需求|customer|client|user|business|service/,
    summary_creation: /summary|开头|定位|岗位|入口/,
    summary_positioning: /summary|定位|岗位|主线|目标/,
    jd_keyword_alignment: /jd|ats|关键词|技能|匹配|keyword|skills/,
  };
  return checks[family] ? checks[family].test(value) : true;
}

/**
 * Return the approved humanized mentor insight for the current display mode.
 * Raw mode may use legacy fields for migration compatibility; generalized mode
 * must use the explicit generalized field only.
 * Returns "" when absent or not approved.
 */
function resolvedApprovedDbMentorInsight(item = {}, context = {}) {
  return cleanAndTruncate(dbHumanizedPerspectiveForMode(item, context, "mentor"), 180, "");
}

function sanitizePerspectiveForDisplay(text = "", item = {}, role = "mentor") {
  const cleaned = String(text || "")
    .replace(/^(导师|HR)\s*/i, "")
    .trim();
  if (!cleaned || !perspectiveMatchesFamily(cleaned, item)) {
    return fallbackPerspectiveForFamily(item, role);
  }
  return cleaned;
}

function sanitizeEvidenceForDisplay(item = {}, internalAtsResult = {}) {
  const family = canonicalActionFamilyOf(item);
  const explicit = Array.isArray(item.evidence) ? item.evidence : [];
  const familyEvidence = {
    summary_creation: ["缺少 Summary", "岗位定位入口不足", "需要先补结构"],
    summary_positioning: ["岗位定位", "开头主线", "目标岗位"],
    jd_keyword_alignment: ["JD 关键词", "ATS 匹配", "经历证据"],
    skills_section: ["Skills 排序", "技能区块", "JD 关键词"],
    experience_evidence: ["经历证据", "技能使用场景", "岗位职责"],
    project_evidence: ["项目证据", "交付物", "岗位相关性"],
    quantified_impact: ["量化结果", "成果表达", "影响规模"],
    education_signal: ["课程/证书", "教育训练", "岗位能力证据"],
    cross_functional_delivery: ["协作对象", "推进动作", "交付物"],
    business_reporting: ["报告产出", "分析对象", "业务判断"],
    process_improvement: ["流程改进", "效率优化", "文档沉淀"],
    manager_assist_evidence: ["协助对象", "任务细节", "交付结果"],
    learning_adaptability: ["快速学习", "新任务", "交付证据"],
    customer_business_exposure: ["客户/用户", "业务需求", "服务场景"],
    format_cleanup: ["ATS 可读性", "格式一致", "时间线"],
    section_structure: ["Section 顺序", "岗位主线", "信息优先级"],
    profile_links: ["资料链接", "可验证入口", "Header 信息"],
    transferable_framing: ["可迁移能力", "岗位语言", "经历叙事"],
  };
  if (familyEvidence[family]) return familyEvidence[family].slice(0, 3);
  return explicit.length ? explicit.slice(0, 3) : buildAdviceEvidence(item, null, internalAtsResult);
}

function rewriteSummaryActionForMissingSummary(item = {}, internalAtsResult = {}) {
  const tags = new Set(item.relatedProblemTags || []);
  const hasMissingSummary = tags.has("missing_summary");
  if (!hasMissingSummary || visibleAdviceIntent(item) === "summary_creation") return item;
  const targetRole = displayTargetRole(internalAtsResult);
  const intent = visibleAdviceIntent(item);
  if (intent === "summary_positioning") {
    return {
      ...item,
      action: `在新建的 Summary 中自然加入 ${targetRole}，再用一句话连接你最相关的经历、技能和 JD 核心职责。`,
      actionSummary: `在新建的 Summary 中自然加入 ${targetRole}，再用一句话连接你最相关的经历、技能和 JD 核心职责。`,
    };
  }
  if (intent === "jd_keywords") {
    return {
      ...item,
      action: `先建好 Summary，再把 ${targetRole} 和真实掌握的 JD 核心关键词分配到 Summary、Skills 与最相关的 Experience bullet。`,
      actionSummary: `先建好 Summary，再把 ${targetRole} 和真实掌握的 JD 核心关键词分配到 Summary、Skills 与最相关的 Experience bullet。`,
    };
  }
  return item;
}

function sanitizeAdviceItemForDisplay(item = {}, internalAtsResult = {}) {
  const patched = rewriteSummaryActionForMissingSummary(item, internalAtsResult);
  const example = cleanDisplayExample(patched.example || patched.E_example || "");
  // Prefer approved humanized_mentor_insight; only fall through to family-match sanitize if absent.
  const approvedDbMentor = resolvedApprovedDbMentorInsight(patched);
  const mentorText = approvedDbMentor || patched.mentorInsight || patched.mentorLens || patched.reason || "";
  const resolvedMentor = approvedDbMentor
    ? approvedDbMentor
    : sanitizePerspectiveForDisplay(mentorText, patched, "mentor");
  const hrText = patched.hrPerspective || patched.HR_os || patched.hrPov || patched.recruiterPerspective || "";
  return {
    ...patched,
    example,
    mentorLens: resolvedMentor,
    mentorInsight: resolvedMentor,
    reason: resolvedMentor,
    hrPerspective: sanitizePerspectiveForDisplay(hrText, patched, "hr"),
    HR_os: sanitizePerspectiveForDisplay(hrText, patched, "hr"),
    evidence: sanitizeEvidenceForDisplay(patched, internalAtsResult),
    displayAdviceType: displayLabelForAdvice(patched),
    topicCluster: displayLabelForAdvice(patched),
  };
}

function normalizeAdviceBundleForDisplay(items = [], internalAtsResult = {}, options = {}) {
  const limit = options.limit || items.length;
  const maxPerIntent = options.maxPerIntent || (limit <= 3 ? 1 : 2);
  const targetProblemTags = options.targetProblemTags || problemTagsFromInternal(internalAtsResult);
  const hasMissingSummary = targetProblemTags.some((item) => (item.tag || item) === "missing_summary") ||
    items.some((item) => (item.relatedProblemTags || []).includes("missing_summary"));
  const selected = [];
  const intentCounts = new Map();
  const familyDepths = new Map();
  const usedIds = new Set();

  function add(item) {
    if (!item) return false;
    item = sanitizeAdviceItemForDisplay(item, internalAtsResult);
    if (!isDisplayableByFamilyRoleGuard(item, internalAtsResult)) return false;
    if (item.adviceId && usedIds.has(item.adviceId)) return false;
    const intent = visibleAdviceIntent(item);
    const family = canonicalActionFamilyOf(item);
    const depth = actionDepthOf(item);
    if ((intentCounts.get(intent) || 0) >= maxPerIntent) return false;
    if (!familyDepths.has(family)) familyDepths.set(family, new Set());
    if ((familyDepths.get(family) || new Set()).has(depth)) return false;
    selected.push(item);
    if (item.adviceId) usedIds.add(item.adviceId);
    intentCounts.set(intent, (intentCounts.get(intent) || 0) + 1);
    familyDepths.get(family).add(depth);
    return true;
  }

  if (hasMissingSummary) {
    const existingSummary = items.find((item) => visibleAdviceIntent(item) === "summary_creation") ||
      fallbackAdviceForObligation({
        id: "missing_summary",
        tag: "missing_summary",
        dimension: "F",
        severity: "high",
        message: "简历缺少 Summary 段落，HR 和 ATS 需要先有一条清晰的岗位定位线索。",
        targetSection: "summary",
        coverageFamily: "positioning",
      }, {
        roleName: displayTargetRole(internalAtsResult),
        targetRole: displayTargetRole(internalAtsResult),
        topMissingKeywords: internalAtsResult.topMissingKeywords || internalAtsResult.priorityMissingKeywords,
      });
    add({ ...existingSummary, priority: "high" });
  }

  const dependencyOrder = {
    summary_creation: 0,
    jd_keywords: hasMissingSummary ? 1 : 2,
    summary_positioning: hasMissingSummary ? 2 : 0,
  };
  const ordered = [...items].sort((a, b) => {
    const aIntent = visibleAdviceIntent(a);
    const bIntent = visibleAdviceIntent(b);
    const aDep = dependencyOrder[aIntent] ?? 5;
    const bDep = dependencyOrder[bIntent] ?? 5;
    if (aDep !== bDep) return aDep - bDep;
    return severityWeight(b.priority || "medium") - severityWeight(a.priority || "medium");
  });

  for (const item of ordered) {
    if (selected.length >= limit) break;
    add(item);
  }
  return selected.slice(0, limit).map((item, index) => {
    if (index === 0 && hasMissingSummary && visibleAdviceIntent(item) === "summary_creation") {
      return forceAdvicePriority(item, "high");
    }
    return item;
  });
}

function finalPremiumTopUpAdviceItems(internalAtsResult = {}) {
  const profile = internalAtsResult.profile || {};
  const roleName = internalAtsResult.jobTitle || profile.targetRole || "目标岗位";
  return [
    {
      adviceId: "fb_business_reporting_output",
      title: "把分析经历写成业务报告产出",
      mentorLens: "管培生 JD 里的 analyze data / create reports 不只是会用工具，而是能把信息整理成管理者能用的报告或建议。",
      currentDiagnosis: "简历里有 data analysis 和 reporting 信号，但还可以更清楚说明这些分析服务了什么业务判断或管理动作。",
      action: "把一条数据或研究经历改写成「分析对象 + 报告/总结产出 + 支持的决策或改进」；如果是课程或项目，也要写清楚最终交付物。",
      reason: "这能直接对齐 analyze data、create reports 和 assist managers 的职责，比单独列 data analysis 更有岗位感。",
      HR_os: "我会问这份分析最后给谁看、用来做什么；能讲清楚产出，经历就更像工作能力。",
      hrPerspective: "我会问这份分析最后给谁看、用来做什么；能讲清楚产出，经历就更像工作能力。",
      evidence: ["Data analysis", "Reporting output", "业务决策"],
      relatedProblemTags: ["reporting_output_gap", "weak_experience_keyword_evidence", "low_jd_keyword_match"],
      canonicalActionFamily: "business_reporting",
      actionDepth: "proof",
      targetSection: "experience",
      priority: "medium",
      source: "fallback",
    },
    {
      adviceId: "fb_process_improvement_framing",
      title: "补出流程改进视角",
      mentorLens: `${roleName} 的价值不只是完成任务，还包括观察流程、发现问题、提出改进建议。`,
      currentDiagnosis: "简历目前对 process improvement 的表达不够突出，容易让经历停留在执行层面。",
      action: "从经历里找一件你整理、检查、协调或汇总过的任务，补一句你发现了什么低效点、如何优化步骤、或给团队留下了什么更清楚的流程/文档。",
      reason: "这能把执行型经历提升到管理训练岗位更看重的流程意识和改进意识。",
      HR_os: "管培生要有一点 owner 视角；如果你能看到流程哪里可以改，会比只说完成任务更有潜力。",
      hrPerspective: "管培生要有一点 owner 视角；如果你能看到流程哪里可以改，会比只说完成任务更有潜力。",
      evidence: ["Process improvement", "Owner mindset", "流程意识"],
      relatedProblemTags: ["process_improvement_gap", "weak_target_role_alignment", "low_content_quality"],
      canonicalActionFamily: "process_improvement",
      actionDepth: "rewrite",
      targetSection: "experience",
      priority: "medium",
      source: "fallback",
    },
    {
      adviceId: "fb_manager_assist_tasks",
      title: "把协助经理任务写具体",
      mentorLens: "JD 写 assist department managers，简历里就要让人看到你能接住具体任务，而不是只写 support 或 assist。",
      currentDiagnosis: "简历对 assist managers / day-to-day tasks 的对应证据还不够明确。",
      action: "把一条 support 类经历改成具体任务：你协助谁、处理了什么资料或流程、产出了什么文档/报告/跟进结果。",
      reason: "这能把笼统的协助能力变成可读的岗位证据，适合 entry-level 管培生筛选。",
      HR_os: "我会看 assist 后面到底是什么事；写清楚任务和产出，才像能马上上手的人。",
      hrPerspective: "我会看 assist 后面到底是什么事；写清楚任务和产出，才像能马上上手的人。",
      evidence: ["Assist managers", "任务细节", "交付结果"],
      relatedProblemTags: ["manager_assist_evidence_gap", "weak_experience_keyword_evidence", "weak_target_role_alignment"],
      canonicalActionFamily: "manager_assist_evidence",
      actionDepth: "evidence",
      targetSection: "experience",
      priority: "medium",
      source: "fallback",
    },
    {
      adviceId: "fb_learning_adaptability_evidence",
      title: "把学习适应力写成证据",
      mentorLens: "willingness to learn 不能只放在 Summary 里自我评价，最好用一段经历证明你进入新任务后怎么学、怎么交付。",
      currentDiagnosis: "简历还没有把学习适应力写成具体证据，这对 trainee 类岗位会影响潜力判断。",
      action: "选一段新领域或新任务经历，补出「第一次接触什么内容 + 如何快速上手 + 最后完成什么交付」。",
      reason: "这比直接写 fast learner 更可信，也更符合 Management Trainee 的轮岗逻辑。",
      HR_os: "管培生会不断换场景；我想看到你过去怎么学新东西，而不是只看到一句愿意学习。",
      hrPerspective: "管培生会不断换场景；我想看到你过去怎么学新东西，而不是只看到一句愿意学习。",
      evidence: ["快速学习", "适应能力", "交付证据"],
      relatedProblemTags: ["learning_adaptability_gap", "rotation_readiness_gap", "weak_target_role_alignment"],
      canonicalActionFamily: "learning_adaptability",
      actionDepth: "proof",
      targetSection: "experience",
      priority: "low",
      source: "fallback",
    },
    {
      adviceId: "fb_customer_business_exposure",
      title: "补出客户与业务一线意识",
      mentorLens: "Management Trainee 会接触 sales、customer service 和 operations，简历最好体现你理解一线业务和用户/客户需求。",
      currentDiagnosis: "简历目前更多是在写任务本身，还可以补出这些任务和客户、用户、部门需求或业务目标之间的关系。",
      action: "选一条沟通、服务、调研或报告经历，补清楚对象是谁、他们需要什么、你如何整理信息或跟进问题，以及这件事如何支持服务质量或业务运转。",
      reason: "这能让经历更贴近轮岗岗位的一线业务语境，而不是只停留在后台分析或课程项目。",
      HR_os: "管培生最终要理解业务现场；如果你能说明自己怎么面对需求和问题，会比只写内部任务更完整。",
      hrPerspective: "管培生最终要理解业务现场；如果你能说明自己怎么面对需求和问题，会比只写内部任务更完整。",
      evidence: ["Customer service", "业务现场", "需求理解"],
      relatedProblemTags: ["customer_service_exposure_gap", "weak_soft_skill_evidence", "weak_target_role_alignment"],
      canonicalActionFamily: "customer_business_exposure",
      actionDepth: "delivery",
      targetSection: "experience",
      priority: "low",
      source: "fallback",
    },
  ];
}

function selectPremiumMentorPlan(candidates, internalAtsResult, freeMentorPlan = null) {
  const profile = internalAtsResult.profile || {};
  const targetProblemTags = obligationsFromInternal(internalAtsResult);
  const roleFamily = profile.roleFamily || "";
  const userProfile = { roleFamily, problemTags: targetProblemTags };

  // Annotate candidates with scope + cluster
  for (const card of candidates) {
    card._transferabilityScope = card._transferabilityScope || inferAdviceTransferabilityScope(card);
    card._topicCluster = card._topicCluster || inferTopicCluster(card);
    card._actionFamily = card._actionFamily || canonicalActionFamilyOf(card);
    card._actionDepth = card._actionDepth || actionDepthOf(card);
  }

  const eligibleCandidates = candidates.filter((card) =>
    FREE_HIGH_RISK_INTENTS.has(card.adviceIntent) &&
    !["interview_prep", "behavioral_interview"].includes(card.adviceScope) &&
    (!card.retrievalScope || card.retrievalScope === "resume_edit") &&
    isAdviceRoleSafe(card, internalAtsResult.jobTitle || profile.targetRole, roleFamily)
  )
    .filter((card) => isCardAlignedWithTargetProblems(card, targetProblemTags))
    .filter((card) => isGovernedAdviceDisplayable(card, internalAtsResult))
    .filter((card) => isActionPreconditionAllowed(card, internalAtsResult))
    .filter((card) => isResumeGroundedAdvice(card, internalAtsResult));

  const coveredTags = new Set();
  const usedAdviceIds = new Set();
  const freeItems = (freeMentorPlan?.adviceItems || []).slice(0, 3);
  freeItems.forEach((item) => {
    if (item.adviceId) usedAdviceIds.add(item.adviceId);
    (item.relatedProblemTags || []).forEach((tag) => coveredTags.add(tag));
  });

  let paidItems = selectGlobalAdviceItems(
    eligibleCandidates,
    targetProblemTags,
    9,
    coveredTags,
    internalAtsResult,
    { ...userProfile, seedAdviceItems: freeItems },
    usedAdviceIds,
    { allowGenericFallbackTemplates: false }
  );

  if (paidItems.length < 9) {
    const genericSupplementCandidates = candidates
      .filter((card) => !usedAdviceIds.has(card.adviceId))
      .filter((card) => normalizeTerm(card.actionSpecificity || card.action_specificity) === "generic")
      .filter((card) => normalizeTerm(card.displayActionMode || card.display_action_mode) === "raw")
      .filter((card) => normalizeTerm(card.actionReviewStatus || card.action_review_status) === "auto_classified")
      .filter((card) => normalizeTerm(card.confidence) !== "low")
      .filter((card) =>
        FREE_HIGH_RISK_INTENTS.has(card.adviceIntent) &&
        !["interview_prep", "behavioral_interview"].includes(card.adviceScope) &&
        (!card.retrievalScope || card.retrievalScope === "resume_edit") &&
        isAdviceRoleSafe(card, internalAtsResult.jobTitle || profile.targetRole, roleFamily)
      )
      .filter((card) => isGovernedAdviceDisplayable(card, internalAtsResult))
      .filter((card) => isActionPreconditionAllowed(card, internalAtsResult))
      .filter((card) => isResumeGroundedAdvice(card, internalAtsResult));
    const supplementItems = selectGlobalAdviceItems(
      genericSupplementCandidates,
      targetProblemTags,
      9 - paidItems.length,
      coveredTags,
      internalAtsResult,
      { ...userProfile, seedAdviceItems: [...freeItems, ...paidItems] },
      usedAdviceIds,
      { allowFallback: false }
    );
    paidItems.push(...supplementItems);
  }

  if (paidItems.length < 9) {
    const fallbackSupplementItems = selectGlobalAdviceItems(
      [],
      targetProblemTags,
      9 - paidItems.length,
      coveredTags,
      internalAtsResult,
      { ...userProfile, seedAdviceItems: [...freeItems, ...paidItems] },
      usedAdviceIds,
      { allowGenericFallbackTemplates: true }
    );
    paidItems.push(...fallbackSupplementItems);
  }

  const allInitialItems = [...freeItems, ...paidItems];
  let coveredObligations = calculateObligationCoverage(allInitialItems, targetProblemTags);
  const allAdviceIds = new Set(allInitialItems.map((item) => item.adviceId).filter(Boolean));
  const orderedObligations = [...targetProblemTags]
    .filter((item) => item.required !== false)
    .sort((a, b) => {
      const severityDiff = severityWeight(b.severity) - severityWeight(a.severity);
      if (Math.abs(severityDiff) > 1e-9) return severityDiff;
      const aDim = a.source === "dimensions" ? 1 : 0;
      const bDim = b.source === "dimensions" ? 1 : 0;
      if (aDim !== bDim) return bDim - aDim;
      const aKw = a.source === "priorityMissingKeywords" ? 1 : 0;
      const bKw = b.source === "priorityMissingKeywords" ? 1 : 0;
      if (aKw !== bKw) return bKw - aKw;
      return String(a.id || a.tag).localeCompare(String(b.id || b.tag));
    });

  for (const obligation of orderedObligations) {
    if (paidItems.length >= 9 && coveredObligations.has(obligation.id || obligation.tag)) continue;
    if (coveredObligations.has(obligation.id || obligation.tag)) continue;
    const coverCandidate = eligibleCandidates
      .filter((card) => !allAdviceIds.has(card.adviceId))
      .filter((card) => relatedTagsForCard(card, targetProblemTags).includes(obligation.tag))
      .sort((a, b) => compareCardsStable(a, b, [obligation], coveredTags, []))[0];
    let newItem = null;
    if (coverCandidate) {
      newItem = toAdviceItem(coverCandidate, targetProblemTags, paidItems.length, true, internalAtsResult, new Set());
      allAdviceIds.add(coverCandidate.adviceId);
    } else {
      newItem = fallbackAdviceForObligation(obligation, {
        roleName: internalAtsResult.jobTitle || profile.targetRole || "目标岗位",
        targetRole: internalAtsResult.jobTitle || profile.targetRole || "目标岗位",
        topMissingKeywords: internalAtsResult.topMissingKeywords || internalAtsResult.priorityMissingKeywords,
      });
    }
    if (!newItem) continue;
    if (paidItems.some((item) => item.adviceId === newItem.adviceId) || freeItems.some((item) => item.adviceId === newItem.adviceId)) continue;
    if (!canAddVisibleAdviceRelaxed(newItem, [...freeItems, ...paidItems], targetProblemTags)) continue;
    if (paidItems.length < 9) {
      paidItems.push(newItem);
    } else {
      const replaceIndex = paidItems.findIndex((item) => item.priority === "low" || item.source !== "fallback");
      if (replaceIndex === -1) continue;
      paidItems[replaceIndex] = newItem;
    }
    coveredObligations = calculateObligationCoverage([...freeItems, ...paidItems], targetProblemTags);
  }

  if (paidItems.length < 9) {
    const finalFallbackPool = fallbackAdviceItems(internalAtsResult, 30, new Set());
    for (const item of finalFallbackPool) {
      if (paidItems.length >= 9) break;
      if (!item || paidItems.some((existing) => existing.adviceId === item.adviceId) || freeItems.some((existing) => existing.adviceId === item.adviceId)) continue;
      if (!canAddVisibleAdviceRelaxed(item, [...freeItems, ...paidItems], targetProblemTags)) continue;
      paidItems.push(item);
    }
  }

  paidItems = normalizePaidAdviceVisibleDiversity(paidItems, freeItems, targetProblemTags, internalAtsResult).slice(0, 9);
  const displayBundleItems = normalizeAdviceBundleForDisplay(
    avoidRepeatedPerspectives([...freeItems, ...paidItems]),
    internalAtsResult,
    { limit: 12, maxPerIntent: 2, targetProblemTags }
  );
  const displayFreeItems = displayBundleItems.slice(0, freeItems.length);
  const displayPaidItems = displayBundleItems.slice(freeItems.length);

  const logoPool = [
    ...buildMentorLogoPoolFromItems([...displayFreeItems, ...displayPaidItems]),
    ...buildMentorLogoPoolFromCandidates(eligibleCandidates, 16),
  ].reduce((acc, item) => {
    if (item.company && item.companyLogo && !acc.some((existing) => existing.company === item.company)) acc.push(item);
    return acc;
  }, []).slice(0, 16);

  const mentors = [
    mentorFromBucket({
      mentorId: "free_advice_bundle",
      mentorName: "导师建议",
      company: "MentorX",
      companyLogo: null,
      mentorTitle: "简历策略组",
      badges: ["免费建议", "问题优先"],
    }, displayFreeItems, targetProblemTags, 0),
    mentorFromBucket({ mentorId: "paid_advice_bundle_1", mentorName: "付费建议 1", company: "MentorX", mentorTitle: "简历策略组" }, displayPaidItems.slice(0, 3), targetProblemTags, 1),
    mentorFromBucket({ mentorId: "paid_advice_bundle_2", mentorName: "付费建议 2", company: "MentorX", mentorTitle: "简历策略组" }, displayPaidItems.slice(3, 6), targetProblemTags, 2),
    mentorFromBucket({ mentorId: "paid_advice_bundle_3", mentorName: "付费建议 3", company: "MentorX", mentorTitle: "简历策略组" }, displayPaidItems.slice(6, 9), targetProblemTags, 3),
  ].map((mentor) => ({ ...mentor, mentorLogoPool: logoPool }));

  // ── 補漏：確保高優先 obligation 至少被一條建議覆蓋 ──────────────
  const allAdviceItems = mentors.flatMap((m) => m.adviceItems || []);
  const allCovered = calculateObligationCoverage(allAdviceItems, targetProblemTags);
  const uncoveredTags = targetProblemTags.filter((p) => p.required !== false && !allCovered.has(p.id || p.tag));

  if (uncoveredTags.length > 0) {
    // 找出還有空間的導師（adviceItems < 3 的不存在，所以替換最低分那條）
    // 策略：在每個導師的 candidates 池裡找能覆蓋 uncoveredTags 的建議，替換得分最低的
    for (const problem of uncoveredTags) {
      const tag = problem.tag;
      if (allCovered.has(problem.id || tag)) continue;
      // 找能覆蓋這個 tag 的候選
      const coverCandidate = eligibleCandidates
        .filter((card) => !allAdviceItems.some((a) => a.adviceId === card.adviceId))
        .filter((card) => relatedTagsForCard(card, targetProblemTags).includes(tag))
        .sort((a, b) => compareCardsStable(a, b, [problem], allCovered, []))[0];
      const fallbackItem = !coverCandidate ? fallbackAdviceForObligation(problem, {
        roleName: internalAtsResult.jobTitle || profile.targetRole || "目标岗位",
        targetRole: internalAtsResult.jobTitle || profile.targetRole || "目标岗位",
        topMissingKeywords: internalAtsResult.topMissingKeywords || internalAtsResult.priorityMissingKeywords,
      }) : null;
      // 找最合適的導師（優先選和這個 card 同一個 mentorName 的，或最後一個導師）
      const targetMentor = (coverCandidate && mentors.find((m) => m.mentorName === coverCandidate.mentorName)) || mentors[mentors.length - 1];
      if (!targetMentor || !targetMentor.adviceItems) continue;
      if (targetMentor.adviceItems.length === 0) {
        const newItem = coverCandidate
          ? toAdviceItem(coverCandidate, targetProblemTags, 0, true, internalAtsResult, new Set())
          : fallbackItem;
        if (newItem && isDisplayableByFamilyRoleGuard(newItem, internalAtsResult) && canAddVisibleAdviceRelaxed(newItem, allAdviceItems, targetProblemTags)) {
          const sanitized = sanitizeAdviceItemForDisplay(newItem, internalAtsResult);
          targetMentor.adviceItems.push(sanitized);
          allAdviceItems.push(sanitized);
        }
        allCovered.add(problem.id || tag);
        continue;
      }
      // 把這個 mentor 的最低優先級建議換掉
      const toReplace = targetMentor.adviceItems.reduce((a, b) =>
        (severityWeight(a.priority) < severityWeight(b.priority) ? a : b)
      );
      const newItem = coverCandidate
        ? toAdviceItem(coverCandidate, targetProblemTags, targetMentor.adviceItems.indexOf(toReplace), true, internalAtsResult, new Set())
        : fallbackItem;
      const idx = targetMentor.adviceItems.indexOf(toReplace);
      const bundleWithoutReplace = allAdviceItems.filter((item) => item !== toReplace);
      if (newItem && idx !== -1 && isDisplayableByFamilyRoleGuard(newItem, internalAtsResult) && canAddVisibleAdviceRelaxed(newItem, bundleWithoutReplace, targetProblemTags)) {
        const sanitized = sanitizeAdviceItemForDisplay(newItem, internalAtsResult);
        targetMentor.adviceItems[idx] = sanitized;
        allAdviceItems.push(sanitized);
      }
      allCovered.add(problem.id || tag);
    }
  }

  const finalBundle = normalizeAdviceBundleForDisplay(
    mentors.flatMap((mentor) => mentor.adviceItems || []),
    internalAtsResult,
    { limit: 12, maxPerIntent: 2, targetProblemTags }
  );
  const finalMentors = mentors.slice(0, 4).map((mentor, index) => ({
    ...mentor,
    adviceItems: finalBundle.slice(index * 3, index * 3 + 3),
  }));

  const normalizedMentors = normalizePremiumAdvicePriorities(finalMentors.map((mentor) => ({
    ...mentor,
    adviceItems: mentor.adviceItems.slice(0, 3),
  })));
  Object.defineProperty(normalizedMentors, "debug", {
    enumerable: false,
    value: {
      actionPreconditionRejected: internalAtsResult._actionPreconditionRejected || {},
    },
  });
  return normalizedMentors;
}

function buildCoverageSummary(selectedAdviceItems, internalAtsResult) {
  const problems = problemTagsFromInternal(internalAtsResult);
  const target = problems.map((item) => item.tag);
  const covered = [...calculateAdviceCoverage(selectedAdviceItems, problems)];
  const uncovered = target.filter((tag) => !covered.includes(tag));
  const obligations = obligationsFromInternal(internalAtsResult);
  const requiredObligations = obligations.filter((item) => item.required !== false);
  const coveredObligations = [...calculateObligationCoverage(selectedAdviceItems, requiredObligations)];
  const targetObligationIds = requiredObligations.map((item) => item.id || item.tag);
  const uncoveredObligations = targetObligationIds.filter((id) => !coveredObligations.includes(id));
  return {
    totalProblemsDetected: target.length,
    problemsCovered: covered.length,
    coverageRatio: targetObligationIds.length ? Number((coveredObligations.length / targetObligationIds.length).toFixed(3)) : (target.length ? Number((covered.length / target.length).toFixed(3)) : 1),
    coveredProblemTags: covered,
    uncoveredProblemTags: uncovered,
    totalObligationsDetected: targetObligationIds.length,
    obligationsCovered: coveredObligations.length,
    coveredObligationIds: coveredObligations,
    uncoveredObligationIds: uncoveredObligations,
  };
}

function buildLockedAdvicePreview(premiumMentorPlan = [], internalAtsResult = {}) {
  const totalMentorCount = 4;
  const actualAdviceCount = premiumMentorPlan.reduce((sum, mentor) => sum + ((mentor.adviceItems || []).length), 0);
  const actualLockedAdviceCount = premiumMentorPlan.slice(1, 4).reduce((sum, mentor) => sum + ((mentor.adviceItems || []).length), 0);
  const totalAdviceCount = actualAdviceCount;
  const roleFamily = normalizeTerm(internalAtsResult.profile?.roleFamily || internalAtsResult.jobTitle || "");
  const topics = roleFamily === "accounting" || roleFamily === "finance"
    ? ["Accounting 关键词补充位置", "Summary 岗位定位强化", "Experience bullet 优化", "岗位匹配与投递策略"]
    : roleFamily === "software_engineer"
      ? ["技术关键词补充位置", "Summary 工程定位强化", "Experience bullet 优化", "项目与系统设计表达"]
      : ["关键词补充位置", "Summary 定位强化", "Experience bullet 优化", "岗位匹配策略"];

  const lockedMentors = (premiumMentorPlan.slice(1, 4) || []).map((mentor) => {
    // Derive generic topic labels without leaking specific advice titles
    const items = mentor.adviceItems || [];
    const previewTopics = [...new Set(
      items.slice(0, 3).map((item) => {
        const sec = item.targetSection || "";
        const tags = item.relatedProblemTags || [];
        if (/keyword|jd|ats/i.test(sec) || tags.some((t) => /keyword|jd|hard_skill/.test(t))) return "关键词策略";
        if (/summary|headline/i.test(sec) || tags.some((t) => /summary|title|role/.test(t))) return "Summary 定位";
        if (/experience|bullet/i.test(sec) || tags.some((t) => /experience|evidence/.test(t))) return "经历描述优化";
        if (/skill/i.test(sec)) return "技能区块";
        if (/education/i.test(sec)) return "教育背景";
        return "岗位匹配策略";
      })
    )].slice(0, 3);
    return {
      mentorId: mentor.mentorId,
      mentorName: mentor.mentorName,
      company: mentor.company,
      companyLogo: mentor.companyLogo || null,
      mentorTitle: mentor.mentorTitle,
      careerPathDisplay: mentor.careerPathDisplay || null,
      lockedAdviceCount: items.length,
      previewTopics,
    };
  });

  return {
    lockedMentorCount: Math.max(0, totalMentorCount - 1),
    lockedAdviceCount: actualLockedAdviceCount,
    totalMentorCount,
    totalAdviceCount,
    topics,
    lockedMentors,
    mentorLogoPool: premiumMentorPlan[0]?.mentorLogoPool || buildMentorLogoPoolFromItems(premiumMentorPlan.flatMap((mentor) => mentor.adviceItems || [])),
    message: actualLockedAdviceCount
      ? `解锁后查看 ${actualLockedAdviceCount} 条付费深度建议，与免费建议共同覆盖你的主要 ATS 问题与分段修改路径。`
      : "当前免费建议已覆盖主要可行动作；若后续匹配到更多高质量导师建议，会继续补充到报告中。",
  };
}

/**
 * Build public-safe evidence chips for a single advice item.
 * Returns max 3 qualitative descriptors — no raw scores or internal metric values.
 *
 * @param {object} adviceItem  - The advice item (new schema)
 * @param {object|null} publicReport - The public ATS report (unused for now; reserved)
 * @param {object} internalAtsResult - Internal ATS result (used only for tag presence, not values)
 */
function buildAdviceEvidence(adviceItem, publicReport, internalAtsResult = {}) {
  // If the item already carries explicit evidence chips, honour them
  if (Array.isArray(adviceItem.evidence) && adviceItem.evidence.length) {
    return adviceItem.evidence.slice(0, 3);
  }
  const tags = adviceItem.relatedProblemTags || [];
  const chips = [];
  if (tags.some((t) => /job_title|exact_title/.test(t))) chips.push("缺少目标岗位原词");
  if (tags.some((t) => /jd_keyword|hard_skill|keyword_gap|priority_keyword/.test(t))) chips.push("JD Match 偏低");
  if (tags.some((t) => /experience_keyword|skills_only|evidence/.test(t))) chips.push("Experience 缺少关键词证据");
  if (tags.some((t) => /summary|role_alignment|target_role/.test(t))) chips.push("Summary 岗位定位不清晰");
  if (tags.some((t) => /measurable|result|impact/.test(t))) chips.push("Bullet 量化结果不足");
  if (tags.some((t) => /linkedin/.test(t))) chips.push("LinkedIn 链接缺失");
  if (tags.some((t) => /portfolio/.test(t))) chips.push("Portfolio 链接缺失");
  return chips.slice(0, 3);
}

/** @deprecated Use buildAdviceEvidence instead */
function buildPublicSafeEvidence(item, atsResult = {}) {
  return buildAdviceEvidence(item, null, atsResult);
}

function formatPublicFreeMentorAdvice(freeMentorPlan, internalAtsResult = {}) {
  const displayItems = avoidRepeatedPerspectives((freeMentorPlan.adviceItems || []).map((item) => {
    // Prefer approved humanized_mentor_insight from DB; fall back to tone-template pipeline.
    const mentorPerspective = resolvedApprovedDbMentorInsight(item)
      || humanizeMentorInsight(item, { internalAtsResult });
    const hrPerspective = humanizeHrPerspective(item, { internalAtsResult });
    return {
      ...item,
      mentorLens: mentorPerspective,
      mentorInsight: mentorPerspective,
      reason: item.reason || mentorPerspective,
      hrPerspective,
      HR_os: hrPerspective,
    };
  }));
  const normalizedDisplayItems = normalizeAdviceBundleForDisplay(displayItems, internalAtsResult, {
    limit: 3,
    maxPerIntent: 1,
    targetProblemTags: problemTagsFromInternal(internalAtsResult).slice(0, 6),
  });
  return {
    mentorId: freeMentorPlan.mentorId,
    mentorName: freeMentorPlan.mentorName,
    company: freeMentorPlan.company,
    companyLogo: freeMentorPlan.companyLogo || null,
    mentorTitle: freeMentorPlan.mentorTitle,
    careerPathDisplay: freeMentorPlan.careerPathDisplay || null,
    badges: freeMentorPlan.badges || [],
    matchReason: freeMentorPlan.matchReason,
    matchedProblems: freeMentorPlan.matchedProblems || [],
    mentorLogoPool: freeMentorPlan.mentorLogoPool || buildMentorLogoPoolFromItems(normalizedDisplayItems || []),
    adviceItems: normalizedDisplayItems.slice(0, 3).map((item) => {
      // Resolve canonical new-schema fields, supporting both native and adapted cards
      const currentDiagnosis = normalizeDisplayDiagnosis(item.currentDiagnosis || item.problemSummary || "");
      const action = normalizeDisplayActionLanguage(item.action || item.actionSummary || "", item, "优先把目标岗位关键词、相关技能和经历证据放到 Summary、Skills 和 Experience 中。");
      const hrPerspective = sanitizePerspectiveForDisplay(item.hrPerspective || item.HR_os || humanizeHrPerspective(item, { internalAtsResult }), item, "hr");
      const mentorPerspective = resolvedApprovedDbMentorInsight(item)
        || sanitizePerspectiveForDisplay(item.mentorInsight || item.mentorLens || humanizeMentorInsight(item, { internalAtsResult }), item, "mentor");
      const displayItem = {
        adviceId: item.adviceId,
        title: normalizeDisplayTitle(item.title, item),
        // ── New schema fields ──
        mentorLens: mentorPerspective,
        currentDiagnosis,
        action,
        reason: mentorPerspective,
        evidence: sanitizeEvidenceForDisplay(item, internalAtsResult),
        // ── Explanation metadata (issue-first) ──
        matchReason: item.matchReason || "",
        mentorFitType: item.mentorFitType || "",
        topicCluster: item.displayAdviceType || item.topicCluster || inferTopicCluster(item),
        confidenceScore: item.confidenceScore || null,
        adviceTransferScope: item.adviceTransferScope || "",
        canonicalActionFamily: canonicalActionFamilyOf(item),
        actionDepth: actionDepthOf(item),
        actionDisplayModeUsed: item.actionDisplayModeUsed || "",
        // ── Backward-compat aliases ──
        problemSummary: currentDiagnosis,
        actionSummary: action,
        targetSection: item.targetSection || "overall",
        relatedProblemTags: item.relatedProblemTags || [],
        priority: item.priority || "medium",
        // Rich mentor voice fields
        mentorInsight: mentorPerspective,
        example: cleanDisplayExample(item.example || item.E_example || ""),
        hrPerspective,
        HR_os: hrPerspective,
        source: item.source || "db",
        mentorSource: item.mentorSource || null,
      };
      return sanitizeAdviceItemForDisplay(applyProblemCoherencePatch(displayItem, internalAtsResult), internalAtsResult);
    }),
  };
}

function formatPremiumMentorReport(premiumMentorPlan, internalAtsResult) {
  const allInputItems = premiumMentorPlan.slice(0, 4).flatMap((mentor) => mentor.adviceItems || []);
  const displayItemsById = new Map(avoidRepeatedPerspectives(allInputItems.map((item) => {
    // Prefer approved humanized_mentor_insight from DB; fall back to tone-template pipeline.
    const mentorPerspective = resolvedApprovedDbMentorInsight(item)
      || humanizeMentorInsight(item, { internalAtsResult });
    const hrPerspective = humanizeHrPerspective(item, { internalAtsResult });
    return {
      ...item,
      mentorLens: mentorPerspective,
      mentorInsight: mentorPerspective,
      reason: mentorPerspective,
      hrPerspective,
      HR_os: hrPerspective,
    };
  })).map((item) => [item.adviceId || `${item.title}:${item.action || item.actionSummary}`, item]));
  const rawMentors = premiumMentorPlan.slice(0, 4).map((mentor) => ({
    ...mentor,
    adviceItems: (mentor.adviceItems || []).slice(0, 3).map((item) => {
      item = displayItemsById.get(item.adviceId || `${item.title}:${item.action || item.actionSummary}`) || item;
      const currentDiagnosis = normalizeDisplayDiagnosis(item.currentDiagnosis || item.problemSummary || "");
      const action = normalizeDisplayActionLanguage(item.action || item.actionSummary || "", item, "优先把目标岗位关键词、相关技能和经历证据放到 Summary、Skills 和 Experience 中。");
      const hrPerspective = sanitizePerspectiveForDisplay(item.hrPerspective || item.HR_os || humanizeHrPerspective(item, { internalAtsResult }), item, "hr");
      const mentorPerspective = resolvedApprovedDbMentorInsight(item)
        || sanitizePerspectiveForDisplay(item.mentorInsight || item.mentorLens || humanizeMentorInsight(item, { internalAtsResult }), item, "mentor");
      const displayItem = {
        adviceId: item.adviceId,
        title: normalizeDisplayTitle(item.title, item),
        // New schema fields
        mentorLens: mentorPerspective,
        currentDiagnosis,
        action,
        reason: mentorPerspective,
        evidence: sanitizeEvidenceForDisplay(item, internalAtsResult),
        // Explanation metadata
        matchReason: item.matchReason || "",
        mentorFitType: item.mentorFitType || "",
        topicCluster: item.displayAdviceType || item.topicCluster || inferTopicCluster(item),
        confidenceScore: item.confidenceScore || null,
        adviceTransferScope: item.adviceTransferScope || "",
        canonicalActionFamily: canonicalActionFamilyOf(item),
        actionDepth: actionDepthOf(item),
        actionDisplayModeUsed: item.actionDisplayModeUsed || "",
        // Backward compat
        problemSummary: currentDiagnosis,
        actionSummary: action,
        // Paid-only premium fields
        mentorInsight: mentorPerspective,
        example: cleanDisplayExample(item.example || ""),
        hrPerspective,
        HR_os: hrPerspective,
        targetSection: item.targetSection || "overall",
        relatedProblemTags: item.relatedProblemTags || [],
        priority: item.priority || "medium",
        source: item.source,
        mentorSource: item.mentorSource || null,
      };
      return sanitizeAdviceItemForDisplay(applyProblemCoherencePatch(displayItem, internalAtsResult), internalAtsResult);
    }),
  }));
  const normalizedAllAdviceItems = normalizeAdviceBundleForDisplay(rawMentors.flatMap((mentor) => mentor.adviceItems), internalAtsResult, {
    limit: 12,
    maxPerIntent: 2,
    targetProblemTags: obligationsFromInternal(internalAtsResult),
  });
  const mentors = rawMentors.map((mentor, index) => ({
    ...mentor,
    adviceItems: normalizedAllAdviceItems.slice(index * 3, index * 3 + 3),
  }));
  const allAdviceItems = mentors.flatMap((mentor) => mentor.adviceItems);
  return {
    mentors,
    allAdviceItems,
    freeAdviceItems: allAdviceItems.slice(0, 3),
    paidAdviceItems: allAdviceItems.slice(3, 12),
    mentorLogoPool: premiumMentorPlan[0]?.mentorLogoPool || buildMentorLogoPoolFromItems(allAdviceItems),
    coverageSummary: buildCoverageSummary(allAdviceItems, internalAtsResult),
  };
}

const KNOWLEDGE_COMPANY_PATTERN = /(amazon|aws|google|meta|facebook|microsoft|apple|netflix|tiktok|bytedance|adobe|salesforce|oracle|nvidia|tesla|goldman|jpmorgan|morgan stanley|blackrock|capital one|deloitte|kpmg|ey|pwc|mckinsey|bcg|四大|大厂|大廠|big tech|faang|药厂|藥廠|pharma|cro|hedge fund|对冲基金|對沖基金|buy side|sell side|consumer electronics|消费电子|消費電子)/i;
const KNOWLEDGE_INDUSTRY_PATTERN = /(多家公司|不同公司|同类公司|同類公司|岗位JD|崗位JD|JD分析|岗位通常|崗位通常|行业|行業|赛道|賽道|普遍|常见|常見|核心required|核心技能|required技能|preferred技能|加分项|加分項)/i;
const KNOWLEDGE_PREFERENCE_PATTERN = /(偏好|看重|重视|重視|倾向|傾向|喜欢|喜歡|要求|门槛|門檻|筛选|篩選|录用|錄用|招募|招聘|面试|面試|考察|评估|評估|人才|候选人|候選人|画像|标准|標準|prefer|preferred|qualification|look for|value|hire|hiring|interview|screening|candidate|talent|bar)/i;
const KNOWLEDGE_ACTION_PATTERN = /(建议你|建議你|你需要|你应该|你應該|你的简历|你的簡歷|简历中|簡歷中|在\s*(summary|skills|experience)|写进|寫進|放进|放進|补充到|補充到|添加|删除|刪除|改成|改写|改寫|重写|重寫|bullet|resume bullet|copy|复制|複製)/i;

function getInsiderRetrievalQuery(options = {}) {
  const internal = options.internalAtsResult || {};
  const fromInternal = internal.retrievalQuery || {};
  const explicit = options.retrievalQuery || {};
  const profile = internal.profile || {};
  const targetRole = explicit.targetRole || fromInternal.targetRole || profile.targetRole || internal.jobTitle || "";
  const roleFamily = explicit.roleFamily || fromInternal.roleFamily || profile.roleFamily || inferRoleFamilyFromJobTitle(targetRole);
  return {
    ...fromInternal,
    ...explicit,
    targetRole,
    roleFamily,
    priorityKeywords: [
      ...splitCsv(explicit.priorityKeywords),
      ...splitCsv(fromInternal.priorityKeywords),
      ...(internal.topMissingKeywords || []),
      ...(internal.topMissingKw || []),
      ...(internal.priorityMissingKeywords || []).map((item) => item.term || item),
    ].filter(Boolean),
    filters: {
      ...(fromInternal.filters || {}),
      ...(explicit.filters || {}),
      roleFamily: [
        ...splitCsv(fromInternal.filters?.roleFamily),
        ...splitCsv(explicit.filters?.roleFamily),
        roleFamily,
      ].filter(Boolean),
      targetRoles: [
        ...splitCsv(fromInternal.filters?.targetRoles),
        ...splitCsv(explicit.filters?.targetRoles),
        targetRole,
      ].filter(Boolean),
    },
    queryText: [
      explicit.queryText,
      fromInternal.queryText,
      targetRole,
      roleFamily,
      internal.jdText,
    ].filter(Boolean).join(" "),
  };
}

function companyOrIndustryReferenced(row = {}, text = "") {
  const company = String(row.mentor_company || "").trim();
  if (company && text.toLowerCase().includes(company.toLowerCase())) return true;
  return KNOWLEDGE_COMPANY_PATTERN.test(text) || KNOWLEDGE_INDUSTRY_PATTERN.test(text);
}

function insiderKnowledgeType(text = "") {
  if (/面试|面試|interview|算法|algorithm|system design|case/i.test(text)) return "interview_standard";
  if (/phd|博士|cpa|gpa|证书|證書|certification|学历|學歷|degree/i.test(text)) return "credential_expectation";
  if (/人才|候选人|候選人|画像|candidate|talent|background/i.test(text)) return "talent_profile";
  if (/四大|药厂|藥廠|pharma|cro|hedge fund|对冲基金|對沖基金|buy side|sell side|大厂|大廠|big tech/i.test(text)) return "industry_pattern";
  return "company_preference";
}

function knowledgeTitleForTip(row = {}, text = "") {
  const label = row.mentor_company || "目标公司";
  const type = insiderKnowledgeType(text);
  if (type === "interview_standard") return `${label} 的面试考察重点`;
  if (type === "credential_expectation") return `${label} 相关岗位的背景门槛`;
  if (type === "talent_profile") return `${label} 偏好的人才画像`;
  if (type === "industry_pattern") return `${label} 所在赛道的招聘规律`;
  return `${label} 的候选人偏好`;
}

function insiderKnowledgeRelevance(row = {}, retrievalQuery = {}) {
  const text = rowText(row);
  const roleFamilies = queryRoleFamilies(retrievalQuery);
  const roleScore = Math.max(
    overlapScore(roleFamilies, row.role_family),
    overlapScore(retrievalQuery.filters?.targetRoles || [], row.target_roles),
    overlapScore([retrievalQuery.targetRole, retrievalQuery.roleFamily].filter(Boolean), text)
  );
  const keywordScore = Math.max(
    overlapScore(retrievalQuery.priorityKeywords || [], row.keywords),
    textTermOverlapScore(retrievalQuery.priorityKeywords || [], text)
  );
  const targetText = [retrievalQuery.targetRole, retrievalQuery.roleFamily, retrievalQuery.queryText].filter(Boolean).join(" ");
  const inferredScore = overlapScore([inferRoleFamilyFromJobTitle(targetText)].filter(Boolean), row.role_family);
  return Math.min(1, 0.55 * roleScore + 0.35 * keywordScore + 0.25 * inferredScore);
}

function hasInsiderRoleFocusMismatch(row = {}, retrievalQuery = {}) {
  const insight = String(row.I_insight || "").toLowerCase();
  const target = `${retrievalQuery.targetRole || ""} ${retrievalQuery.roleFamily || ""}`.toLowerCase();
  const targetIsData = /\b(data|business|bi|analytics|analyst)\b|数据|分析/.test(target);
  const targetIsTech = /\b(software|swe|sde|backend|frontend|machine learning|ml|mle|ai engineer)\b|软件|后端|前端|机器学习/.test(target);
  const targetIsFinance = /\b(account|audit|tax|finance|financial|fp&a)\b|会计|审计|财务|金融/.test(target);

  if (targetIsData && /\b(solution engineer|software engineer|backend engineer|frontend engineer|full stack|sde|mle|machine learning engineer|hardware engineer)\b|后端工程师|前端工程师|硬件工程师|解决方案工程师|全栈|轉碼|转码|技术选型|技術選型/.test(insight)) return true;
  if (targetIsTech && /\b(cpa|audit|tax|accounting|financial analyst|marketing analyst|statistician)\b|审计|税务|会计|统计师/.test(insight)) return true;
  if (targetIsFinance && /\b(software engineer|backend|frontend|mle|machine learning engineer|ux designer|portfolio)\b|后端|前端|机器学习|作品集/.test(insight)) return true;
  return false;
}

function isDisplayableInsiderKnowledge(row = {}, retrievalQuery = {}) {
  const insight = String(row.I_insight || "").trim();
  if (insight.length < 35) return false;
  if (!companyOrIndustryReferenced(row, insight)) return false;
  if (!KNOWLEDGE_PREFERENCE_PATTERN.test(insight)) return false;
  if (KNOWLEDGE_ACTION_PATTERN.test(insight)) return false;
  if (/\bhr\b|招聘方/i.test(insight) && !KNOWLEDGE_COMPANY_PATTERN.test(insight)) return false;
  if (hasInsiderRoleFocusMismatch(row, retrievalQuery)) return false;
  if (hasCrossRoleUnsafeAdvice(row, retrievalQuery.roleFamily, retrievalQuery.targetRole)) return false;
  if (hasConflictingRoleExamples(row, retrievalQuery)) return false;
  if ((retrievalQuery.targetRole || retrievalQuery.roleFamily) && insiderKnowledgeRelevance(row, retrievalQuery) < 0.12) return false;
  return true;
}

function buildInsiderKnowledgeTip(row = {}, retrievalQuery = {}) {
  const insight = cleanAndTruncate(row.I_insight || "", 280);
  const relevance = insiderKnowledgeRelevance(row, retrievalQuery);
  retrievalQuery = {
    ...retrievalQuery,
    targetRole: displayLabelForRoleTerm(retrievalQuery.targetRole || retrievalQuery.roleFamily),
    roleFamily: "",
    priorityKeywords: [...new Set(splitCsv(retrievalQuery.priorityKeywords))]
      .filter((term) => keywordMatchesInsight(term, insight))
      .map(keywordDisplayLabel)
      .filter(Boolean),
  };
  const targetRole = retrievalQuery.targetRole || retrievalQuery.roleFamily || "你的目标岗位";
  const matchedKeywords = [...new Set(splitCsv(retrievalQuery.priorityKeywords))]
    .filter((term) => term && insight.toLowerCase().includes(String(term).toLowerCase()))
    .slice(0, 3);
  const relevanceReason = `与你申请的 ${targetRole} 方向相关。`;
  return {
    company: row.mentor_company,
    companyLogo: resolveCompanyLogo(row.mentor_company),
    industryLabel: row.L1 || row.topic || "",
    knowledgeTitle: knowledgeTitleForTip(row, insight),
    insight,
    relevanceReason,
    sourceMentorName: row.mentor_name || "",
    sourceMentorTitle: row.mentor_title || "",
    sourceTopic: row.topic || row.L1 || "",
    sourceAdviceId: row.chunk_id || (row.id ? `seg_${row.id}` : ""),
    knowledgeType: insiderKnowledgeType(insight),
    score: Number(Math.min(1, relevance + Number(row.mentor_quality_score || 0) * 0.25).toFixed(3)),
  };
}

// ── Company / Industry Knowledge Tips ─────────────────────────────────────────
// Surfaces knowledge-style company or industry hiring patterns. These are not
// mentor advice items and should not be rendered as HR/mentor perspectives.
function buildGeneralInsiderTips(retrievalQuery = {}, limit = 4) {
  const targetRole = displayLabelForRoleTerm(retrievalQuery.targetRole || retrievalQuery.roleFamily);
  const base = [
    {
      knowledgeTitle: "ATS 往往先读结构，再读内容",
      insight: "很多筛选系统会先用 section 标题、日期、职位名和关键词位置判断简历结构；如果 Skills、Experience、Projects 的边界不清楚，后面的关键词即使出现，也可能被归到错误语境里。",
      knowledgeType: "industry_pattern",
    },
    {
      knowledgeTitle: "招聘方会看关键词出现的位置",
      insight: "同一个关键词出现在 Skills 和出现在 Experience 里的权重感不一样；只在技能栏出现，容易被当作会用工具，放在经历结果里，才更像真实做过相关任务。",
      knowledgeType: "talent_profile",
    },
    {
      knowledgeTitle: "JD 的前几条职责通常不是随机排序",
      insight: "很多岗位描述会把最常筛选的职责和 required skills 放在前半段；如果简历最上方没有回应这些高优先级信号，即使后面内容不错，也可能在快速扫描时被低估。",
      knowledgeType: "credential_expectation",
    },
    {
      knowledgeTitle: "过度贴合单一 JD 也可能扣分",
      insight: "简历如果把某一份 JD 的词逐条硬塞进去，反而会显得像关键词堆砌；更稳的做法是覆盖同类岗位都会反复出现的核心信号，让简历对一组相似岗位都有解释力。",
      knowledgeType: "company_preference",
    },
  ];
  return base.slice(0, Math.max(1, limit)).map((tip, index) => ({
    company: "通用招聘规律",
    companyLogo: "",
    industryLabel: "跨行业筛选",
    ...tip,
    relevanceReason: `与你申请的 ${targetRole} 方向相关。`,
    sourceMentorName: "",
    sourceMentorTitle: "",
    sourceTopic: "通用招聘筛选",
    sourceAdviceId: `general_insider_${index + 1}`,
    score: Number((0.35 - index * 0.01).toFixed(3)),
    source: "fallback",
  }));
}

async function retrieveInsiderTips(options = {}) {
  const { limit = 4 } = options;
  const retrievalQuery = getInsiderRetrievalQuery(options);
  const pool = db.getPool();
  const knowledgeKeywords = [
    "偏好", "看重", "重视", "倾向", "喜欢", "要求", "门槛", "筛选",
    "录用", "招募", "招聘", "面试", "考察", "评估", "人才", "候选人",
    "画像", "标准", "prefer", "preferred", "qualification", "look for",
    "value", "hiring", "interview", "screening", "candidate", "talent",
  ];

  const sql = `
    SELECT
      id, chunk_id, mentor_name, mentor_title, mentor_company, topic, "L1", "L2",
      "P_mentor", "A_action", "I_insight", "H_hook", "E_example",
      role_family, target_roles, keywords, retrieval_text, advice_card_title,
      user_problem_summary, action_summary, mentor_quality_score
    FROM segments
    WHERE
      mentor_company IS NOT NULL AND mentor_company != ''
      AND mentor_quality_score >= 0.6
      AND "I_insight" IS NOT NULL
      AND LENGTH("I_insight") > 34
      AND LOWER("I_insight") LIKE ANY($1::text[])
    ORDER BY mentor_quality_score DESC
    LIMIT 160
  `;

  let rows;
  try {
    const result = await pool.query(sql, [knowledgeKeywords.map((kw) => `%${kw.toLowerCase()}%`)]);
    rows = result.rows;
  } catch (err) {
    console.error("[insider-tips] query error:", err.message);
    return buildGeneralInsiderTips(retrievalQuery, limit);
  }

  const tips = rows
    .filter((row) => isDisplayableInsiderKnowledge(row, retrievalQuery))
    .map((row) => buildInsiderKnowledgeTip(row, retrievalQuery))
    .filter((tip) => tip.insight.length > 30 && tip.score >= 0.18)
    .sort((a, b) => b.score - a.score);

  const seenCompanies = new Set();
  const selected = [];
  for (const tip of tips) {
    const companyKey = normalizeTerm(tip.company || tip.industryLabel || "");
    if (companyKey && seenCompanies.has(companyKey)) continue;
    if (companyKey) seenCompanies.add(companyKey);
    selected.push(tip);
    if (selected.length >= limit) break;
  }
  return selected.length ? selected : buildGeneralInsiderTips(retrievalQuery, limit);
}

module.exports = {
  FALLBACK_FREE_ADVICE,
  ACCOUNTING_FALLBACK_FREE_ADVICE,
  splitCsv,
  overlapScore,
  includesAny,
  normalizeTerm,
  inferRoleFamilyFromJobTitle,
  inferAdviceScope,
  inferAdviceIntent,
  inferAdviceActionFamily,
  inferAdviceTransferabilityScope,
  inferTopicCluster,
  inferMentorFitType,
  generateAdviceExplanationMetadata,
  careerGroupOf,
  careerGroupsForRow,
  hasCrossRoleUnsafeAdvice,
  getActionabilityScore,
  getSpecificityScore,
  getTransferabilityScore,
  getProblemFitScore,
  ROLE_SENSITIVITY_BY_PROBLEM_TAG,
  isEligibleForAtsResumeReport,
  isAdviceRoleSafe,
  isCardAlignedWithTargetProblems,
  extractGroundingTermsFromAdvice,
  isResumeGroundedAdvice,
  isGovernedAdviceDisplayable,
  sanitizeCompoundAdviceText,
  actionPreconditionGate,
  canonicalActionFamilyOf,
  actionDepthOf,
  canAddToTwelveAdviceBundle,
  hasConflictingRoleExamples,
  calculateRoleMismatchPenalty,
  calculateRetrievalScore,
  buildMatchedReasons,
  retrieveStrictCandidates,
  retrieveFallbackCandidates,
  retrieveMentorAdvice,
  retrieveInsiderTips,
  isDisplayableInsiderKnowledge,
  buildInsiderKnowledgeTip,
  buildGeneralInsiderTips,
  selectFreeAdvice,
  selectPaidAdvice,
  cleanAndTruncate,
  groupAdviceByMentor,
  buildFreeMentorAdvicePlan,
  selectFreeMentorPlan,
  selectPremiumMentorPlan,
  calculateAdviceCoverage,
  selectDiverseMentors,
  selectTopAdviceForMentor,
  buildCoverageSummary,
  buildLockedAdvicePreview,
  buildAdviceEvidence,
  buildPublicSafeEvidence,
  isSystemPlaceholderAdviceText,
  isMostlyEnglishAction,
  normalizeDisplayActionLanguage,
  normalizeDisplayTitle,
  normalizeDisplayDiagnosis,
  humanizeMentorInsight,
  humanizeHrPerspective,
  avoidRepeatedPerspectives,
  formatPublicFreeMentorAdvice,
  formatPremiumMentorReport,
  formatAdviceCard,
  formatAdviceCardForPublic,
  truncateAtSentence,
  _resolveCompanyLogo: resolveCompanyLogo,
};
