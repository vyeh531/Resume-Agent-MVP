window.Store = window.Store || {
  get() { try { return JSON.parse(localStorage.getItem("resumeFixMVP") || "{}"); } catch { return {}; } }
};

if (typeof guardSubmitted === 'function') {
  guardSubmitted();
} else {
  const s0 = window.Store.get();
  if (!s0.resumeName) { window.location.href = "/"; }
}

const s = window.Store.get();
const atsResult = s.atsResult || {};
const mentorsSection = document.getElementById("mentors");
if (mentorsSection) {
  const num = mentorsSection.querySelector(".section-num");
  const title = mentorsSection.querySelector(".section-title");
  if (num) num.textContent = "03 · 12 条导师建议";
  if (title) title.textContent = "按你的简历问题优先匹配";
}

function priorityClass(p){
  if (p && p.startsWith("P0")) return "";
  if (p && p.startsWith("P1")) return "priority-tag--p1";
  if (p && p.startsWith("P2")) return "priority-tag--p2";
  return "";
}
function escapeAttr(str){ return String(str).replace(/'/g,"&apos;").replace(/"/g,"&quot;"); }
function escapeHtml(s){
  return String(s||"").replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
}
function getJdMatchRatio(ats) {
  const value = ats?.jdMatchRatio ?? ats?.raw?.jdMatchRatio ?? ats?.raw?.metrics?.jdMatchRatio ?? ats?.metrics?.jdMatchRatio;
  return value !== null && value !== undefined && value !== "" ? Math.round(Number(value)) : null;
}
function uniqueList(items) {
  const seen = new Set();
  return (items || []).filter(Boolean).filter((item) => {
    const key = String(item).trim();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
function getTargetJobTitle() {
  const candidates = [s.jobTitle, atsResult.jobTitle, atsResult.raw && atsResult.raw.jobTitle];
  return candidates.find(v => v && !/依\s*JD|自动识别|unknown|^目标岗位$/i.test(String(v))) || "";
}
function formatTargetJobForProblem(jobTitle) {
  const cleaned = String(jobTitle || "")
    .replace(/\([^)]*\)/g, "")
    .replace(/\b(internship|intern|co-op|coop)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
  if (/\bmachine learning engineer\b/i.test(cleaned)) return "Machine Learning Engineer";
  return cleaned || "目标岗位";
}
function repairTargetRoleProblem(text) {
  const target = formatTargetJobForProblem(getTargetJobTitle());
  return String(text || "")
    .replace(/目标岗位像是「[^」]+」/g, `目标岗位是「${target}」`)
    .replace(/目标岗位是「数据科学家」/g, `目标岗位是「${target}」`);
}
function normalizeProblemList() {
  return uniqueList([
    ...(atsResult.keyProblems || []),
    ...(atsResult.problems || []),
    ...(atsResult.raw?.keyProblems || []),
    ...(atsResult.raw?.problems || []),
    ...((atsResult.topProblems || []).map(item => item.message || item.title).filter(Boolean)),
    ...((atsResult.raw?.topProblems || []).map(item => item.message || item.title).filter(Boolean)),
  ].map(repairTargetRoleProblem));
}
function normalizeSuggestionList() {
  const missingKw = uniqueList([
    ...(atsResult.topMissingKw || []),
    ...(atsResult.topMissingKeywords || []),
    ...(atsResult.raw?.topMissingKw || []),
    ...(atsResult.raw?.topMissingKeywords || []),
  ]).slice(0, 8);
  const fallbackSuggestions = [
    missingKw.length ? `优先补齐 JD 缺失关键词：${missingKw.join("、")}。` : "",
    "把目标岗位关键词写进 Summary、Skills 和最相关的 Experience bullet，避免只堆在技能列表。",
    "将每段核心经历改成「动作 + 方法/工具 + 量化结果」结构，让 ATS 和招聘官都能看到岗位证据。",
  ];
  return uniqueList([
    ...(atsResult.suggestions || []),
    ...(atsResult.raw?.suggestions || []),
    ...((atsResult.structuredSuggestions || []).map(item => item.action || item.actionSummary || item.title).filter(Boolean)),
    ...((atsResult.raw?.structuredSuggestions || []).map(item => item.action || item.actionSummary || item.title).filter(Boolean)),
    ...fallbackSuggestions,
  ]);
}
function renderAtsProblemItem(text) {
  return `<li style="margin-bottom:10px;padding-left:20px;position:relative;line-height:1.5;"><span style="position:absolute;left:0;top:8px;width:6px;height:6px;border-radius:50%;background:var(--rose);"></span>${escapeHtml(text)}</li>`;
}
function renderAtsSuggestionItem(text) {
  return `<li style="margin-bottom:10px;padding-left:20px;position:relative;line-height:1.5;"><span style="position:absolute;left:0;top:8px;width:6px;height:6px;border-radius:50%;background:var(--jade);"></span>${escapeHtml(text)}</li>`;
}
function buildSkillsFromJD() {
  const breakdown = atsResult.keywordBreakdown || atsResult.raw?.keywordBreakdown || [];
  const seen = new Set();
  const skills = [];
  for (const cat of breakdown) {
    for (const term of (cat.matched || [])) {
      const name = String(term).trim();
      const key = name.toLowerCase();
      if (!name || seen.has(key)) continue;
      seen.add(key);
      skills.push({ name, status: "have" });
    }
    for (const term of (cat.missing || [])) {
      const name = String(term).trim();
      const key = name.toLowerCase();
      if (!name || seen.has(key)) continue;
      seen.add(key);
      skills.push({ name, status: "weak" });
    }
  }
  for (const term of [
    ...(atsResult.topMissingKw || []),
    ...(atsResult.topMissingKeywords || []),
    ...(atsResult.raw?.topMissingKw || []),
    ...(atsResult.raw?.topMissingKeywords || []),
  ]) {
    const name = String(term).trim();
    const key = name.toLowerCase();
    if (!name || seen.has(key)) continue;
    seen.add(key);
    skills.push({ name, status: "weak" });
  }
  return { skills, seen };
}
function renderMentorLogoMarquee(pool) {
  const logos = (pool || []).filter(item => item && item.companyLogo).slice(0, 16);
  if (!logos.length) return "";
  const chips = [...logos, ...logos].map(item => `
    <div class="mentor-logo-chip" title="${escapeAttr(item.company || "")}">
      <img src="${escapeAttr(item.companyLogo)}" alt="${escapeAttr(item.company || "")}">
    </div>
  `).join("");
  return `<div class="logo-marquee" aria-label="Mentor company logos"><div class="logo-marquee-track">${chips}</div></div>`;
}
function formatMentorName(name){
  if (!name) return "X导师";
  const parts = name.trim().split(/\s+/);
  const last = parts[parts.length - 1] || parts[0];
  return last[0].toUpperCase() + "导师";
}
function formatAdvice(text){
  if (!text) return "";
  const parts = String(text).split(/(?=\(\d+\))/);
  if (parts.length <= 1) return highlightFake(text);
  return parts.map(p => p.trim()).filter(Boolean)
    .map(p => `<div style="margin-bottom:5px;">${highlightFake(p)}</div>`)
    .join("");
}
function highlightFake(text){
  if (!text) return "";
  return String(text).replace(/\[\[([^\]]+)\]\]/g,
    '<mark style="background:rgba(232,160,107,.22);color:var(--apricot,#e8a06b);border-radius:3px;padding:0 2px;font-weight:600;" title="AI 估算数据，仅供参考">$1</mark>'
  );
}
function copyMentorExample(btn){
  const raw = btn.getAttribute("data-content").replace(/&apos;/g,"'").replace(/&quot;/g,'"');
  const text = raw.replace(/\[\[([^\]]+)\]\]/g,"$1");
  if (navigator.clipboard) navigator.clipboard.writeText(text).then(
    () => { btn.innerHTML = "✓ 已复制"; setTimeout(() => btn.innerHTML = "📋 复制", 2000); }
  );
}
window.copyMentorExample = copyMentorExample;

// ── 1. Summary ──
const issueText = atsResult.riskLevel === "低"
  ? "✓ ATS 兼容性良好（" + (atsResult.atsScore||"?") + "/100），简历格式清晰规范。"
  : atsResult.riskLevel === "中"
  ? "⚠ ATS 兼容性中等（" + (atsResult.atsScore||"?") + "/100），建议优化格式和关键词。"
  : atsResult.atsScore
  ? "❌ ATS 兼容性偏低（" + atsResult.atsScore + "/100），需要重点修改。"
  : "";
const coreIssueEl = document.getElementById("coreIssue");
if (coreIssueEl) coreIssueEl.textContent = issueText;

const headlineEl = document.querySelector(".report-headline .num");
if (headlineEl && atsResult.atsScore) headlineEl.textContent = atsResult.atsScore;

// ── 2. ATS 详细分数 ──
(function renderAtsDetail() {
  const raw = atsResult.raw?.dimensions || atsResult.dimensions || {};
  const dimKeys = ["A","B","C","D","E","F"];
  const dimLabels = { A:"格式规范", B:"基本资料", C:"内容质量", D:"JD匹配", E:"市场适配", F:"经验匹配" };

  const dimHTML = dimKeys.map(k => {
    const d = raw[k]; if (!d) return "";
    const pct = Math.round((d.score / d.max) * 100);
    const color = pct >= 70 ? "var(--good,#6abf7b)" : pct >= 45 ? "#e9a84c" : "var(--rose,#e07070)";
    return `
      <div style="background:rgba(255,255,255,.5);border-radius:8px;padding:10px 8px;text-align:center;">
        <div style="font-size:11px;color:var(--ink-soft);margin-bottom:4px;">${k} · ${dimLabels[k]}</div>
        <div style="font-size:17px;font-weight:700;color:${color};font-family:var(--mono);">${d.score}<span style="font-size:11px;color:var(--ink-mute);">/${d.max}</span></div>
        <div style="height:4px;border-radius:99px;background:rgba(0,0,0,.08);margin-top:6px;overflow:hidden;">
          <div style="width:${pct}%;height:100%;background:${color};border-radius:99px;"></div>
        </div>
      </div>`;
  }).join("");
  const dimGrid = document.getElementById("atsDimGrid");
  if (dimGrid) dimGrid.innerHTML = dimHTML;

  const jdMatch = getJdMatchRatio(atsResult);
  const breakdown = atsResult.keywordBreakdown || atsResult.raw?.keywordBreakdown || [];
  let kwHTML = `<div style="font-size:13px;font-weight:700;color:var(--ink);margin-bottom:10px;padding-bottom:8px;border-bottom:1px dashed var(--line);">JD 关键词覆盖${jdMatch != null ? ` <span style="color:${jdMatch>=60?"var(--good)":jdMatch>=40?"#e9a84c":"var(--rose)"};font-family:var(--mono);font-size:13px;"> · 覆盖率 ${jdMatch}%</span>` : ""}</div>`;

  if (breakdown.length) {
    kwHTML += breakdown.map(cat => {
      const matchedPills = (cat.matched || []).map(k=>`<span style="display:inline-block;padding:3px 8px;border-radius:99px;background:rgba(106,191,123,.15);color:#2d7a4a;font-size:12px;font-weight:500;margin:2px;">${escapeHtml(k)}</span>`).join("");
      const missingPills = (cat.missing || []).map(k=>`<span style="display:inline-block;padding:3px 8px;border-radius:99px;background:rgba(224,112,112,.12);color:#b02020;font-size:12px;font-weight:500;margin:2px;">${escapeHtml(k)}</span>`).join("");
      const total = cat.total || (cat.matched.length + cat.missing.length);
      const pct = total ? Math.round((cat.matched.length / total) * 100) : 0;
      const pctColor = pct>=70?"var(--good)":pct>=40?"#e9a84c":"var(--rose)";
      return `
        <div style="margin-bottom:14px;">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
            <span style="font-size:12px;font-weight:700;color:var(--ink);font-family:var(--mono);letter-spacing:.04em;text-transform:uppercase;">${escapeHtml(cat.label)}</span>
            <span style="font-size:12px;font-weight:700;font-family:var(--mono);color:${pctColor};">${cat.matched.length}/${total}</span>
          </div>
          ${matchedPills ? `<div style="margin-bottom:4px;"><span style="font-size:10px;color:var(--ink-mute);font-family:var(--mono);letter-spacing:.03em;">✓ 已命中</span><div style="margin-top:3px;">${matchedPills}</div></div>` : ""}
          ${missingPills ? `<div><span style="font-size:10px;color:var(--ink-mute);font-family:var(--mono);letter-spacing:.03em;">✗ 未命中</span><div style="margin-top:3px;">${missingPills}</div></div>` : ""}
        </div>`;
    }).join("");
  } else {
    const missingKw = atsResult.topMissingKw || atsResult.raw?.topMissingKw || [];
    if (missingKw.length) kwHTML += `<div><div style="font-size:11px;color:var(--ink-soft);font-family:var(--mono);letter-spacing:.04em;margin-bottom:4px;">缺口关键词</div><div style="display:flex;flex-wrap:wrap;gap:4px;">${missingKw.map(k=>`<span style="display:inline-block;padding:3px 8px;border-radius:99px;background:rgba(224,112,112,.12);color:#b02020;font-size:12px;">${escapeHtml(k)}</span>`).join("")}</div></div>`;
  }
  const kwSection = document.getElementById("atsKeywordSection");
  if (kwSection) kwSection.innerHTML = kwHTML;

  const problems = normalizeProblemList();
  const suggestions = normalizeSuggestionList();
  const probSection = document.getElementById("atsProblemsSection");
  if (probSection) {
    probSection.innerHTML = `
      ${problems.length ? `<div style="font-size:13px;font-weight:600;color:var(--rose);margin-bottom:8px;">🔍 关键问题</div>
      <ul style="list-style:none;padding:0;margin:0;font-size:13px;">
        ${problems.map(renderAtsProblemItem).join("")}
      </ul>` : ""}
      ${suggestions.length ? `<div style="font-size:13px;font-weight:600;color:var(--jade);margin:14px 0 8px;">✨ 优先建议</div>
      <ul style="list-style:none;padding:0;margin:0;font-size:13px;">
        ${suggestions.map(renderAtsSuggestionItem).join("")}
      </ul>` : ""}`;
  }
})();

// ── 3. Skills ──
const labelMap = {
  have: `<span class="pill pill-good"><span class="dot"></span>已具备</span>`,
  weak: `<span class="pill pill-warn"><span class="dot"></span>待补强</span>`
};
function renderSkillList(skills){
  const skillListEl = document.getElementById("skillList");
  if (!skillListEl) return;
  skillListEl.innerHTML = skills.map(sk => `
    <li class="skill-row">
      <div class="skill-name"><span class="priority">#${sk.priority}</span>${escapeHtml(sk.name)}</div>
      ${labelMap[sk.status] || ""}
    </li>
  `).join("");
  const have = skills.filter(sk => sk.status === "have").length;
  const weak = skills.filter(sk => sk.status === "weak").length;
  const insightEl = document.querySelector(".ai-insight-diagnosis");
  if (insightEl) insightEl.innerHTML = `<span class="ico">💡</span>你已掌握 <b>${have}/${skills.length}</b> 项 JD 技能关键词，还有 <b>${weak} 项</b>待补强。${weak > 0 ? "招聘官会优先看简历是否使用岗位语言，建议把缺失关键词写进 Summary、Skills 和相关经历证据里。" : "技能覆盖率良好，建议进一步量化成果。"}`;
}
(async function loadSkills(){
  const jobTitle = s.jobTitle || atsResult.jobTitle || (atsResult.raw && atsResult.raw.jobTitle) || "";
  const resumeText = s.resumeText || "";
  const { skills: jdSkills, seen } = buildSkillsFromJD();
  let dbSkills = [];
  try {
    if (jobTitle) {
      const url = "/api/position-skills?jobTitle=" + encodeURIComponent(jobTitle)
                  + "&resumeText=" + encodeURIComponent(resumeText.substring(0, 3000));
      const resp = await fetch(url);
      if (resp.ok) {
        const data = await resp.json();
        if (data.found && data.skills) {
          dbSkills = data.skills.filter(sk => sk.name && !seen.has(sk.name.toLowerCase()));
        }
      }
    }
  } catch(e){ console.warn("[Skills]", e.message); }
  const merged = [...jdSkills, ...dbSkills].map((sk, i) => ({ priority: i + 1, name: sk.name, status: sk.status }));
  if (merged.length > 0) renderSkillList(merged);
})();

// ── 4. Mentors ──
// Re-render ATS keyword, problems, and suggestions without preview caps.
(function renderFullAtsLists() {
  const kwSection = document.getElementById("atsKeywordSection");
  if (kwSection) {
    const jdMatch = getJdMatchRatio(atsResult);
    const breakdown = atsResult.keywordBreakdown || atsResult.raw?.keywordBreakdown || [];
    let kwHTML = `<div style="font-size:13px;font-weight:700;color:var(--ink);margin-bottom:10px;padding-bottom:8px;border-bottom:1px dashed var(--line);">JD 关键词覆盖${jdMatch != null ? ` <span style="color:${jdMatch>=60?"var(--good)":jdMatch>=40?"#e9a84c":"var(--rose)"};font-family:var(--mono);font-size:13px;"> · 覆盖率 ${jdMatch}%</span>` : ""}</div>`;
    if (breakdown.length) {
      kwHTML += breakdown.map(cat => {
        const matched = cat.matched || [];
        const missing = cat.missing || [];
        const total = cat.total || matched.length + missing.length;
        const pct = total ? Math.round((matched.length / total) * 100) : 0;
        const pctColor = pct>=70 ? "var(--good)" : pct>=40 ? "#e9a84c" : "var(--rose)";
        const matchedPills = matched.map(k => `<span style="display:inline-block;padding:3px 8px;border-radius:99px;background:rgba(106,191,123,.15);color:#2d7a4a;font-size:12px;font-weight:500;margin:2px;">${escapeHtml(k)}</span>`).join("");
        const missingPills = missing.map(k => `<span style="display:inline-block;padding:3px 8px;border-radius:99px;background:rgba(224,112,112,.12);color:#b02020;font-size:12px;font-weight:500;margin:2px;">${escapeHtml(k)}</span>`).join("");
        return `<div style="margin-bottom:14px;">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
            <span style="font-size:12px;font-weight:700;color:var(--ink);font-family:var(--mono);letter-spacing:.04em;text-transform:uppercase;">${escapeHtml(cat.label || "JD Keywords")}</span>
            <span style="font-size:12px;font-weight:700;font-family:var(--mono);color:${pctColor};">${matched.length}/${total}</span>
          </div>
          ${matchedPills ? `<div style="margin-bottom:4px;"><span style="font-size:10px;color:var(--ink-mute);font-family:var(--mono);letter-spacing:.03em;">✓ 已命中</span><div style="margin-top:3px;">${matchedPills}</div></div>` : ""}
          ${missingPills ? `<div><span style="font-size:10px;color:var(--ink-mute);font-family:var(--mono);letter-spacing:.03em;">× 未命中</span><div style="margin-top:3px;">${missingPills}</div></div>` : ""}
        </div>`;
      }).join("");
    } else {
      const missingKw = uniqueList([...(atsResult.topMissingKw || []), ...(atsResult.raw?.topMissingKw || [])]);
      if (missingKw.length) {
        kwHTML += `<div><div style="font-size:11px;color:var(--ink-soft);font-family:var(--mono);letter-spacing:.04em;margin-bottom:4px;">缺口关键词</div><div style="display:flex;flex-wrap:wrap;gap:4px;">${missingKw.map(k=>`<span style="display:inline-block;padding:3px 8px;border-radius:99px;background:rgba(224,112,112,.12);color:#b02020;font-size:12px;">${escapeHtml(k)}</span>`).join("")}</div></div>`;
      }
    }
    kwSection.innerHTML = kwHTML;
  }

  const probSection = document.getElementById("atsProblemsSection");
  if (probSection) {
    const problems = normalizeProblemList();
    const suggestions = normalizeSuggestionList();
    probSection.innerHTML = `
      ${problems.length ? `<div style="font-size:13px;font-weight:600;color:var(--rose);margin-bottom:8px;">🔍 关键问题</div>
      <ul style="list-style:none;padding:0;margin:0;font-size:13px;">${problems.map(renderAtsProblemItem).join("")}</ul>` : ""}
      ${suggestions.length ? `<div style="font-size:13px;font-weight:600;color:var(--jade);margin:14px 0 8px;">✨ 优先建议</div>
      <ul style="list-style:none;padding:0;margin:0;font-size:13px;">${suggestions.map(renderAtsSuggestionItem).join("")}</ul>` : ""}`;
  }
})();

const sectionLabelMap = {
  summary:"Summary", skills:"Skills", experience:"Experience",
  projects:"Projects", education:"Education", overall:"Overall"
};
function sectionLabel(sec){ return sectionLabelMap[sec] || "Overall"; }

function priorityLabel(p){
  if(!p) return "medium";
  if(p==="high"||p==="P0"||p==="critical") return "high";
  if(p==="medium"||p==="P1") return "medium";
  return "low";
}
function priorityBadge(p){
  const lv = priorityLabel(p);
  const cfg = {
    high:   { dot:"#EF4444", bg:"#FEF2F2", color:"#B91C1C", border:"#FECACA", label:"必改" },
    medium: { dot:"#F97316", bg:"#FFF7ED", color:"#C2410C", border:"#FED7AA", label:"建议改" },
    low:    { dot:"#3B82F6", bg:"#EFF6FF", color:"#1D4ED8", border:"#BFDBFE", label:"补充" },
  };
  const c = cfg[lv] || cfg.medium;
  return `<span style="display:inline-flex;align-items:center;gap:5px;font-size:11px;font-weight:600;padding:3px 10px;border-radius:99px;background:${c.bg};color:${c.color};border:1px solid ${c.border};"><span style="width:6px;height:6px;border-radius:50%;background:${c.dot};flex-shrink:0;"></span>${c.label}</span>`;
}

function renderAdviceItem(item, idx) {
  const insight = item.mentorInsight || "";
  const example = item.example || "";
  const hrPerspective = item.hrPerspective || "";
  const divider = idx > 0
    ? `<div style="height:1px;background:linear-gradient(to right,transparent,#DDD6CA,transparent);margin:24px 0;"></div>`
    : "";
  const problemSummary = item.problemSummary || item.currentDiagnosis || "";
  const actionSummary = item.actionSummary || item.action || "";
  return `
    <div style="margin-top:${idx>0?'0':'12px'};">
      ${divider}
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;flex-wrap:wrap;">
        ${priorityBadge(item.priority)}
        <span style="font-size:11px;color:#9CA3AF;font-weight:500;">导师建议 ${idx+1}</span>
        <span style="margin-left:auto;font-size:11px;font-weight:600;padding:3px 10px;border-radius:99px;background:#EEF2FF;color:#4338CA;border:1px solid #C7D2FE;flex-shrink:0;">${escapeHtml(sectionLabel(item.targetSection))}</span>
      </div>
      <h4 style="margin:0 0 14px;font-size:16px;font-weight:700;color:#111827;line-height:1.4;">${escapeHtml(item.title)}</h4>
      ${problemSummary ? `<div style="display:flex;gap:10px;background:#F8F7F4;border-left:3px solid #D1C9B8;border-radius:0 10px 10px 0;padding:12px 14px;margin-bottom:10px;"><span style="font-size:15px;flex-shrink:0;margin-top:1px;">💡</span><div><div style="font-size:11px;font-weight:700;color:#78350F;margin-bottom:4px;">你的现状</div><p style="margin:0;font-size:13px;line-height:1.65;color:#44403C;">${escapeHtml(problemSummary)}</p></div></div>` : ""}
      ${actionSummary ? `<div style="display:flex;gap:10px;background:#F0FDF4;border-left:3px solid #4ADE80;border-radius:0 10px 10px 0;padding:12px 14px;margin-bottom:10px;"><span style="font-size:15px;flex-shrink:0;margin-top:1px;">⚡</span><div><div style="font-size:11px;font-weight:700;color:#15803D;margin-bottom:4px;">建议你先做</div><p style="margin:0;font-size:13px;line-height:1.65;color:#166534;">${escapeHtml(actionSummary)}</p></div></div>` : ""}
      ${insight ? `<div style="background:#F5F3FF;border-left:3px solid #C4B5FD;border-radius:0 10px 10px 0;padding:12px 14px;margin-bottom:10px;"><div style="font-size:11px;font-weight:700;color:#6D28D9;margin-bottom:4px;">导师视角</div><p style="margin:0;font-size:13px;line-height:1.65;color:#4C1D95;">${escapeHtml(insight)}</p></div>` : ""}
      ${example ? `<div class="advice-example"><div class="advice-example-head"><div class="title"><span class="check">✓</span><span>改写示例</span></div><button class="copy-btn" onclick="copyMentorExample(this)" data-content='${escapeAttr(example)}'>📋 复制</button></div><div class="advice-example-body"><span style="font-size:13px;font-weight:500;line-height:1.6;font-family:var(--mono,monospace);">${escapeHtml(example)}</span></div></div>` : ""}
      ${hrPerspective ? `<div style="background:#F5F3FF;border-left:3px solid #C4B5FD;border-radius:0 10px 10px 0;padding:12px 14px;margin-top:8px;"><div style="font-size:11px;font-weight:700;color:#6D28D9;margin-bottom:4px;">HR 视角</div><p style="margin:0;font-size:13px;line-height:1.65;color:#4C1D95;">${escapeHtml(hrPerspective)}</p></div>` : ""}
    </div>
  `;
}

function avatarCircle(company, size) {
  const colors = ["#6366F1","#10B981","#F59E0B","#EF4444","#8B5CF6","#0EA5E9","#F97316","#EC4899"];
  const idx = (company||"M").charCodeAt(0) % colors.length;
  const initial = (company||"M")[0].toUpperCase();
  return `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${colors[idx]};display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:${Math.round(size*0.35)}px;flex-shrink:0;">${initial}</div>`;
}

function renderPremiumMentorCard(m, idx) {
  const allTags = (m.badges||[]);
  const advice = (m.adviceItems||[]).slice(0,3).map((item,i)=>renderAdviceItem(item,i)).join("");
  const companyMeta = [m.company, m.mentorTitle].filter(Boolean).join(" · ");
  return `
    <article style="background:#FFFDF6;border:1px solid #EDE9DC;border-radius:22px;padding:24px;box-shadow:0 2px 12px rgba(0,0,0,0.06);margin-bottom:16px;">
      <div style="display:flex;align-items:flex-start;gap:12px;margin-bottom:18px;">
        <div class="mentor-avatar-placeholder" style="width:48px;height:48px;border-radius:50%;background:#F3F4F6;border:1px solid #EDE9DC;flex-shrink:0;"></div>
        <div style="flex:1;min-width:0;">
        <div style="font-weight:700;font-size:18px;color:#111827;line-height:1.2;">${escapeHtml(m.mentorName||"导师")}</div>
        ${companyMeta ? `<div style="font-size:12px;color:#9CA3AF;margin-top:4px;">${escapeHtml(companyMeta)}</div>` : ""}
        ${m.careerPathDisplay ? `<div style="font-size:12px;color:#9CA3AF;margin-top:2px;">${escapeHtml(m.careerPathDisplay)}</div>` : ""}
        </div>
      </div>
      <div style="height:1px;background:#EDE9DC;margin:0 0 20px;"></div>
      <div>${advice}</div>
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;border-top:1px solid #EDE9DC;margin-top:20px;padding-top:14px;">
        <span style="font-size:12px;color:#9CA3AF;font-weight:500;">导师 ${idx+1} / 4</span>
      </div>
    </article>
  `;
}

function renderAdviceBundle(items, logoPool) {
  const advice = (items || []).slice(0, 12).map((item, i) => renderAdviceItem(item, i)).join("");
  return `
    ${renderMentorLogoMarquee(logoPool)}
    <article style="background:#FFFDF6;border:1px solid #EDE9DC;border-radius:22px;padding:24px;box-shadow:0 2px 12px rgba(0,0,0,0.06);margin-bottom:16px;">
      <div>${advice}</div>
    </article>
  `;
}

function adviceIdentity(item) {
  return String(item?.adviceId || item?.id || `${item?.title || ""}|${item?.action || item?.actionSummary || ""}`).trim();
}
function collectReportAdviceItems() {
  const sources = [
    ...(s.premiumAdviceItems || []),
    ...(atsResult.raw?.premiumAdviceItems || []),
    ...((s.premiumMentors || []).flatMap(m => m.adviceItems || [])),
    ...((atsResult.raw?.premiumMentors || []).flatMap(m => m.adviceItems || [])),
    ...(s.freeMentorAdvice?.adviceItems || []),
    ...(atsResult.raw?.freeMentorAdvice?.adviceItems || []),
    ...((s.mentorAdvice || []).flatMap(m => m.adviceItems || m.adviceList || [])),
  ];
  const seen = new Set();
  const items = [];
  for (const item of sources) {
    const key = adviceIdentity(item);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    items.push(item);
    if (items.length >= 12) break;
  }
  const fallbackSuggestions = normalizeSuggestionList();
  let fallbackIndex = 0;
  while (items.length < 12 && fallbackSuggestions.length) {
    const text = fallbackSuggestions[fallbackIndex % fallbackSuggestions.length];
    items.push({
      adviceId: `report-fallback-${items.length + 1}`,
      title: `简历优化建议 ${items.length + 1}`,
      currentDiagnosis: "当前报告可用的导师建议不足 12 条，系统基于 ATS 诊断补充了这一条优先行动。",
      action: text,
      targetSection: "overall",
      priority: items.length < 4 ? "high" : "medium",
      topicCluster: "ATS 诊断",
    });
    fallbackIndex += 1;
  }
  return items.slice(0, 12);
}

const FIT_TYPE_CONFIG = {
  same_role: { label:"同职位导师", bg:"#EFF6FF", color:"#1D4ED8", border:"#BFDBFE" },
  same_industry: { label:"同产业导师", bg:"#F0FDF4", color:"#15803D", border:"#BBF7D0" },
  same_function: { label:"同职能导师", bg:"#F0FDF4", color:"#166534", border:"#BBF7D0" },
  cross_domain_high_relevance: { label:"跨领域高相关", bg:"#FFF7ED", color:"#92400E", border:"#FDE68A" },
  recruiter_perspective: { label:"HR 视角", bg:"#FFF1F2", color:"#9F1239", border:"#FECDD3" },
};

function renderAdviceItem(item, i) {
  const diagnosis = item.currentDiagnosis || item.problemSummary || "";
  const action = item.action || item.actionSummary || "";
  const insight = item.mentorInsight || "";
  const hrPov = item.hrPerspective || "";
  const fitType = item.mentorFitType || "";
  const rawTopicCluster = item.topicCluster || sectionLabel(item.targetSection);
  const topicCluster = /ATS\s*通用建议/i.test(String(rawTopicCluster)) ? "" : rawTopicCluster;
  const example = item.example || "";
  const fitCfg = FIT_TYPE_CONFIG[fitType];
  const fitChip = fitCfg
    ? `<span style="display:inline-flex;align-items:center;font-size:11px;font-weight:600;padding:3px 9px;border-radius:99px;background:${fitCfg.bg};color:${fitCfg.color};border:1px solid ${fitCfg.border};">${fitCfg.label}</span>`
    : "";
  const evidenceChips = (item.evidence || []).length
    ? `<div style="display:flex;flex-wrap:wrap;gap:5px;margin-top:7px;">${item.evidence.map(e => `<span style="font-size:11px;padding:2px 8px;border-radius:99px;background:#F3F4F6;color:#6B7280;border:1px solid #E5E7EB;">${escapeHtml(e)}</span>`).join("")}</div>`
    : "";
  const divider = i > 0
    ? `<div style="height:1px;background:linear-gradient(to right,transparent,rgba(0,0,0,0.07),transparent);margin:22px 0;"></div>`
    : "";

  return `${divider}
    <div style="margin-top:${i > 0 ? "0" : "4px"};">
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:10px;flex-wrap:wrap;">
        ${priorityBadge(item.priority)}
        ${topicCluster ? `<span style="font-size:11px;font-weight:600;padding:3px 9px;border-radius:99px;background:#EEF2FF;color:#4338CA;border:1px solid #C7D2FE;">${escapeHtml(topicCluster)}</span>` : ""}
        ${fitChip}
      </div>
      <h4 style="margin:0 0 13px;font-size:15px;font-weight:700;color:#111827;line-height:1.4;"><span style="display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:50%;background:#111827;color:#fff;font-size:11px;margin-right:8px;vertical-align:1px;">${i + 1}</span>${escapeHtml(item.title)}</h4>
      ${diagnosis ? `<div style="margin-bottom:11px;">
        <div style="display:flex;align-items:center;gap:6px;margin-bottom:5px;">
          <span style="width:3px;height:14px;background:#D4A574;border-radius:2px;flex-shrink:0;"></span>
          <span style="font-size:11px;font-weight:700;color:#92400E;letter-spacing:.02em;">你的现状</span>
        </div>
        <p style="margin:0 0 0 9px;font-size:13px;line-height:1.65;color:#44403C;">${escapeHtml(diagnosis)}</p>
        ${evidenceChips ? `<div style="margin-left:9px;">${evidenceChips}</div>` : ""}
      </div>` : ""}
      ${action ? `<div style="background:#F6FEF9;border:1px solid #D1FAE5;border-radius:12px;padding:12px 14px;margin-bottom:10px;">
        <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px;">
          <span style="width:18px;height:18px;border-radius:50%;background:#059669;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;font-size:9px;color:#fff;font-weight:700;">✓</span>
          <span style="font-size:11px;font-weight:700;color:#065F46;letter-spacing:.02em;">建议你先做</span>
        </div>
        <p style="margin:0;font-size:13px;line-height:1.65;color:#065F46;font-weight:600;">${escapeHtml(action)}</p>
      </div>` : ""}
      ${(insight || hrPov) ? `<div style="background:#FAFAF9;border:1px solid rgba(0,0,0,0.05);border-radius:10px;padding:11px 13px;margin-top:8px;">
        <div style="font-size:10.5px;font-weight:700;color:#9CA3AF;margin-bottom:8px;letter-spacing:.05em;text-transform:uppercase;">补充视角</div>
        ${insight ? `<div style="${hrPov ? "margin-bottom:8px;" : ""}"><span style="font-size:11px;font-weight:600;color:#6D28D9;background:#F5F3FF;padding:2px 7px;border-radius:99px;margin-right:6px;">导师</span><span style="font-size:12.5px;line-height:1.6;color:#374151;">${escapeHtml(insight)}</span></div>` : ""}
        ${hrPov ? `<div><span style="font-size:11px;font-weight:600;color:#B45309;background:#FFFBEB;padding:2px 7px;border-radius:99px;margin-right:6px;">HR</span><span style="font-size:12.5px;line-height:1.6;color:#374151;">${escapeHtml(hrPov)}</span></div>` : ""}
      </div>` : ""}
      ${example ? `<div class="advice-example" style="margin-top:10px;"><div class="advice-example-head"><div class="title"><span class="check">✓</span><span>改写示例</span></div><button class="copy-btn" onclick="copyMentorExample(this)" data-content='${escapeAttr(example)}'>📋 复制</button></div><div class="advice-example-body"><span style="font-size:13px;font-weight:500;line-height:1.6;font-family:var(--mono,monospace);">${escapeHtml(example)}</span></div></div>` : ""}
    </div>`;
}

const premiumMentors = s.premiumMentors;
const premiumAdviceItems = collectReportAdviceItems();
const mentorLogoPool = s.mentorLogoPool || s.lockedAdvicePreview?.mentorLogoPool || s.freeMentorAdvice?.mentorLogoPool || [];
const legacyMentors = s.mentorAdvice;
const mentorsListEl = document.getElementById("mentorsList");
if (mentorsListEl) {
  if (premiumAdviceItems && premiumAdviceItems.length > 0) {
    mentorsListEl.innerHTML = renderAdviceBundle(premiumAdviceItems, mentorLogoPool);
  } else if (legacyMentors && legacyMentors.length > 0) {
    mentorsListEl.innerHTML = legacyMentors.map((m,i)=>renderPremiumMentorCard(m,i)).join("");
  } else {
    mentorsListEl.innerHTML = `<p style="color:var(--ink-soft);font-size:14px;padding:16px 0;">导师建议加载失败，请返回首页重新提交简历。</p>`;
  }
}

// ── 5. PDF Export ──
function exportPDF(){
  if (!window.html2pdf) { alert("PDF 库未加载，请刷新重试"); return; }
  const btn = document.querySelector('.export-card .btn');
  const orig = btn ? btn.innerHTML : "";
  if (btn) { btn.disabled = true; btn.innerHTML = '⏳ 正在生成 PDF…'; }
  document.body.classList.add('exporting');
  const opt = {
    margin: [10, 8, 10, 8],
    filename: "MentorX-诊断报告-" + new Date().toISOString().slice(0,10) + ".pdf",
    image: { type: 'jpeg', quality: 0.95 },
    html2canvas: { scale: 2, useCORS: true, logging: false, backgroundColor: '#f6f3ec', windowWidth: 480 },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
    pagebreak: { mode: ['css', 'legacy'], avoid: '.section, .mentor-card-v2, .advice-example, .service-card' }
  };
  html2pdf().set(opt).from(document.querySelector('.page')).save()
    .then(() => { document.body.classList.remove('exporting'); if(btn){btn.disabled=false;btn.innerHTML=orig;} })
    .catch(err => { console.error(err); document.body.classList.remove('exporting'); if(btn){btn.disabled=false;btn.innerHTML=orig;} });
}
window.exportPDF = exportPDF;
