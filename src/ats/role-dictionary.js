"use strict";


let cachedDictionary = null;

function loadRoleDictionary() {
  if (cachedDictionary) return cachedDictionary;

  try {
    // require() is used so Vercel's bundler automatically includes the JSON
    // in the serverless function package (fs.readFileSync with a dynamic path
    // is not reliably bundled in serverless environments).
    cachedDictionary = require("../public/ats_role_dictionary.json").roles || [];
  } catch {
    cachedDictionary = [];
  }
  return cachedDictionary;
}

function findRoleDictionaryEntry(jobTitle = "", jdText = "") {
  const roles = loadRoleDictionary();
  if (!roles.length) return null;

  const target = normalize(`${jobTitle} ${jdText}`).slice(0, 5000);
  let best = null;
  let bestScore = 0;

  for (const role of roles) {
    const aliases = [
      role.canonical_role,
      role.position_title_original,
      ...(role.target_role_aliases || [])
    ].filter(Boolean);

    let score = 0;
    for (const alias of aliases) {
      const cleanAlias = normalize(alias);
      if (!cleanAlias) continue;
      if (target.includes(cleanAlias)) score += 8 + cleanAlias.split(/\s+/).length;
      else {
        const overlap = tokenOverlap(cleanAlias, target);
        score += overlap * 4;
      }
    }

    if (score > bestScore) {
      best = role;
      bestScore = score;
    }
  }

  return bestScore >= 3 ? best : null;
}

function roleToProfile(role) {
  if (!role) return null;
  return {
    target_role: unique([
      role.canonical_role,
      role.position_title_original,
      ...(role.target_role_aliases || [])
    ].map(normalize).filter(Boolean)),
    core_skills: unique([...(role.core_skills_required || []), ...(role.secondary_skills || [])].map(normalize)),
    tools: unique((role.tools_technologies || []).map(normalize)),
    action_verbs: unique((role.strong_action_verbs || []).map(normalize)),
    domain_keywords: unique([
      ...(role.domain_keywords || []),
      ...(role.experience_project_signals || []),
      ...(role.deliverables_outputs || [])
    ].map(normalize)),
    nice_to_have: unique([
      ...(role.preferred_certs || []),
      ...(role.education_background_keywords || [])
    ].map(normalize))
  };
}

function inferCanonicalRoleFamily(jobTitle = "", jdText = "") {
  const text = normalize(`${jobTitle} ${jdText}`);
  if (!text) return null;

  const rules = [
    { family: "machine_learning", pattern: /\b(machine learning engineer|ml engineer|mle|deep learning engineer|computer vision engineer)\b/ },
    { family: "ai_engineer", pattern: /\b(ai engineer|artificial intelligence engineer|llm engineer|generative ai engineer|prompt engineer)\b/ },
    { family: "data_scientist", pattern: /\b(data scientist|decision scientist|applied scientist)\b/ },
    { family: "data_engineer", pattern: /\b(data engineer|etl developer|analytics engineer)\b/ },
    { family: "data_analyst", pattern: /\b(data analyst|business intelligence analyst|bi analyst|analytics analyst)\b/ },
    { family: "software_engineer", pattern: /\b(software development engineer|software engineer|software developer|sde|swe|backend engineer|frontend engineer|full stack engineer|full-stack engineer|web developer)\b/ },
    { family: "design_creative", pattern: /\b(graphic designer|visual designer|ui\/ux designer|ux designer|ui designer|product designer|brand designer|motion designer|creative designer)\b/ },
    { family: "product_manager", pattern: /\b(product manager|associate product manager|technical product manager|program manager)\b/ },
    { family: "accounting", pattern: /\b(accountant|accounting|bookkeeper|bookkeeping|audit associate|tax associate|controller|cpa|accounts payable|accounts receivable)\b/ },
    { family: "financial_analyst", pattern: /\b(financial analyst|finance analyst|investment analyst|fp&a|valuation analyst|treasury analyst|risk analyst)\b/ },
    { family: "marketing", pattern: /\b(marketing|growth marketer|campaign manager|seo specialist|content strategist|brand manager)\b/ },
  ];

  return (rules.find((rule) => rule.pattern.test(text)) || {}).family || null;
}

function normalize(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9+#.\s/-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenOverlap(a, b) {
  const aTokens = new Set(a.split(/\s+/).filter((t) => t.length > 2));
  if (!aTokens.size) return 0;
  let hits = 0;
  for (const token of aTokens) {
    if (b.includes(token)) hits += 1;
  }
  return hits / aTokens.size;
}

function unique(items) {
  return [...new Set(items.filter(Boolean))];
}

module.exports = {
  findRoleDictionaryEntry,
  inferCanonicalRoleFamily,
  roleToProfile
};
