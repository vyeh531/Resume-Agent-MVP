"use strict";


let cachedDictionary = null;

function loadRoleDictionary() {
  if (cachedDictionary) return cachedDictionary;

  try {
    // require() is used so Vercel's bundler automatically includes the JSON
    // in the serverless function package (fs.readFileSync with a dynamic path
    // is not reliably bundled in serverless environments).
    cachedDictionary = require("../../data/ats/ats_role_dictionary.json").roles || [];
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
  roleToProfile
};
