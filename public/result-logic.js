// Store fallback（防止 app.js 還沒載入的 race condition）
const _S = window.Store || {
  get() { try { return JSON.parse(localStorage.getItem("resumeFixMVP") || "{}"); } catch { return {}; } }
};

if (typeof guardSubmitted === 'function') {
  guardSubmitted();
} else {
  if (!_S.get().resumeName) { window.location.href = "/"; }
}

const s = _S.get();
const atsResult = s.atsResult || {};

// ── helpers ──────────────────────────────────────────────────────
function atsRiskText(risk) {
  if (risk === "低") return "低风险";
  if (risk === "中") return "中风险";
  if (risk === "高") return "高风险";
  return risk || "未评级";
}
function escapeHtml(str) {
  return String(str || "").replace(/[&<>"']/g, ch =>
    ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[ch])
  );
}
function escapeAttr(str) { return String(str).replace(/'/g,"&apos;").replace(/"/g,"&quot;"); }

// ── 1. Student info ──────────────────────────────────────────────
(function setStudentInfo() {
  const text = s.resumeText || "";
  const el = document.getElementById("studentInfo");

  // 1. 找 EDUCATION 段落：停在下一個全大寫 section header（如 PROFESSIONAL EXPERIENCE）
  const eduMatch = text.match(
    /\bEDUCATION\b[^\n]*\n([\s\S]{0,2500}?)(?=\n[A-Z]{3}[A-Z\s&,/]{2,}\n|$)/
  );
  const eduText = eduMatch ? eduMatch[1] : text.slice(0, 2000);

  // 2. 直接找 "School... | ...– EndYear\nDegree" 格式的條目
  // 每個條目：含 University/College 的行 + " | " + 日期（包含結束年份）
  //           下一行是 degree 名
  const entryRE = /^(.+?(?:University|College|School|Institute)[^|\n]*)\|[^|\n]*?[-–]\s*(?:[A-Z][a-z]*\s+)?(\d{4})[^\n]*\n([^\n]+)/gm;

  const entries = [];
  let m;
  while ((m = entryRE.exec(eduText)) !== null) {
    // 學校名：去掉 "City, ST" 地址後綴
    let school = m[1]
      .replace(/\s+[A-Z][a-zA-Z.\s]*,\s*[A-Z]{2}\b.*$/, '')  // "New York, NY"
      .replace(/\s+[A-Z][a-z]+,\s*[A-Z]{2}.*$/, '')           // "Stillwater, OK"
      .replace(/^(?:[A-Z]{2,}\s+)+(?=[A-Z][a-z])/, '')        // "LINKEDIN EDUCATION" 前綴
      .trim();

    const endYear = parseInt(m[2]);

    // degree：取 " | " 之前、GPA 之前的部分
    let degree = m[3].split(/\s*\|\s*/)[0].replace(/\bGPA\b.*/i, '').trim();
    if (degree.length > 70) degree = degree.slice(0, 70);

    if (school && endYear) entries.push({ school, endYear, degree });
  }

  // 3. 取 endYear 最大的條目（最新學歷）
  if (!entries.length) {
    if (el) el.textContent = s.resumeName || "已上传简历";
    return;
  }
  const best = entries.reduce((a, b) => b.endYear > a.endYear ? b : a);

  const parts = [];
  if (best.endYear) parts.push(best.endYear + "届");
  if (best.school)  parts.push(best.school);
  if (best.degree)  parts.push(best.degree);
  if (el) el.textContent = parts.join(" · ");
})();

// 目标岗位 pill
const targetJobEl = document.getElementById("targetJob");
if (targetJobEl) {
  const job = s.jobTitle || "";
  targetJobEl.textContent = job ? "目标:" + job : "依 JD 自动识别";
}

// ── 2. 标题分数 & core issue ─────────────────────────────────────
const atsScore = atsResult.atsScore || 0;
const headlineScoreEl = document.getElementById("atsHeadlineScore");
if (headlineScoreEl) headlineScoreEl.textContent = atsScore;

const coreIssueEl = document.getElementById("coreIssue");
if (coreIssueEl) {
  const problems = atsResult.keyProblems || [];
  coreIssueEl.textContent = problems.length
    ? problems[0]
    : atsScore
      ? `ATS ${atsRiskText(atsResult.riskLevel)}（${atsScore}/100），请优先查看 ATS 诊断中的分项得分和修改建议。`
      : "";
}

// ── 3. 4 Tiles（用真實數據）─────────────────────────────────────
// ATS tile：直接用分數
const atsTileEl = document.getElementById("atsScore");
if (atsTileEl) atsTileEl.textContent = atsScore;

// Ranking：根據 ATS 分數推估
const rankPct = atsScore >= 80 ? 15 : atsScore >= 65 ? 32 : atsScore >= 50 ? 50 : 68;
const rankPctEl = document.getElementById("rankPct");
if (rankPctEl) rankPctEl.textContent = rankPct + "%";

// Salary：先顯示空，等 API
const salaryRangeEl = document.getElementById("salaryRange");
const salaryTopEl   = document.getElementById("salaryTop");
const headlineSalaryTopEl = document.getElementById("headlineSalaryTop");
if (salaryRangeEl) salaryRangeEl.textContent = "--";
if (salaryTopEl)   salaryTopEl.textContent   = "--";

// Competition：先顯示空
const compCountEl  = document.getElementById("compCount");
const admitRateEl  = document.getElementById("admitRate");
if (compCountEl)  compCountEl.textContent  = "--";
if (admitRateEl)  admitRateEl.textContent  = "--";

// Detail rows
function renderRows(arr) {
  return (arr || []).map(r => `
    <div class="detail-row"><span class="k">${escapeHtml(r.k)}</span><span class="v">${escapeHtml(r.v)}</span></div>
    <div style="font-size:12px;color:var(--ink-mute);margin:-2px 0 6px;line-height:1.4;">${escapeHtml(r.note)}</div>
  `).join("");
}

// ATS tile detail
const atsDetailEl = document.getElementById("atsDetail");
if (atsDetailEl && atsScore) {
  atsDetailEl.innerHTML = renderRows([
    { k:"ATS 总分", v: atsScore + "/100", note: atsRiskText(atsResult.riskLevel) },
    { k:"JD 匹配度", v: (atsResult.jdMatchRatio ?? "--") + "%", note:"关键词覆盖率" },
    { k:"简历质量", v: (atsResult.dimensions?.C?.score ?? "--") + "/" + (atsResult.dimensions?.C?.max ?? 12), note:"内容质量与成果表达" },
  ]);
}

// Ranking detail
const rankDetailEl = document.getElementById("rankDetail");
if (rankDetailEl) {
  rankDetailEl.innerHTML = renderRows([
    { k:"当前排名估算", v:"TOP " + rankPct + "%", note:"基于 ATS 评分推算" },
    { k:"ATS 分数", v: atsScore + "/100", note: atsRiskText(atsResult.riskLevel) },
  ]);
}

// ── 4. 薪资 & 竞争（从 DB 加载）────────────────────────────────
(async function loadSalaryFromDB() {
  const jobTitle = s.jobTitle || "";
  if (!jobTitle) return;
  try {
    const resp = await fetch(`/api/position-salary?jobTitle=${encodeURIComponent(jobTitle)}`);
    if (!resp.ok) return;
    const data = await resp.json();
    if (!data.found || !data.salary_range) return;
    const raw = data.salary_range;
    const nums = raw.match(/[\d,]+\.?\d*/g);
    if (!nums || nums.length === 0) return;
    function toK(n) {
      const v = parseFloat(n.replace(/,/g, ""));
      return v >= 1000 ? Math.round(v / 1000) + "K" : n;
    }
    const low  = toK(nums[0]);
    const high = nums[1] ? toK(nums[1]) : low;
    if (salaryRangeEl) salaryRangeEl.textContent = "$" + low;
    if (salaryTopEl)   salaryTopEl.textContent   = "$" + high;
    if (headlineSalaryTopEl) headlineSalaryTopEl.textContent = "$" + high;
    const salaryDetailEl = document.getElementById("salaryDetail");
    if (salaryDetailEl) salaryDetailEl.innerHTML = renderRows([
      { k:"当前简历水平", v:"$" + low,  note:"基于岗位市场数据" },
      { k:"顶级 Offer 线", v:"$" + high, note:"优化后可冲击" },
    ]);
  } catch(e) { console.warn("[Salary]", e.message); }
})();

// ── 5. Skills（从 DB 加载）──────────────────────────────────────
const labelMap = {
  have: `<span class="pill pill-good"><span class="dot"></span>已具备</span>`,
  weak: `<span class="pill pill-warn"><span class="dot"></span>待补强</span>`
};
function renderSkillRow(sk) {
  return `<li class="skill-row">
    <div class="skill-name"><span class="priority">#${sk.priority}</span>${escapeHtml(sk.name)}</div>
    ${labelMap[sk.status] || ""}
  </li>`;
}
function renderSkillSection(skills) {
  const have  = skills.filter(sk => sk.status === "have").length;
  const weak  = skills.filter(sk => sk.status === "weak").length;
  const total = skills.length;
  const skillHaveEl   = document.getElementById("skillHave");
  const skillTotalEl  = document.getElementById("skillTotal");
  const skillSummaryEl = document.getElementById("skillSummary");
  const skillListTop3El = document.getElementById("skillListTop3");
  const skillPaywallListEl = document.getElementById("skillPaywallList");
  if (skillHaveEl)    skillHaveEl.textContent  = have;
  if (skillTotalEl)   skillTotalEl.textContent = total;
  if (skillSummaryEl) skillSummaryEl.innerHTML = `
    <span class="skill-have" style="flex:${have}"></span>
    <span class="skill-weak" style="flex:${Math.max(weak, 1)}"></span>`;
  if (skillListTop3El)    skillListTop3El.innerHTML    = skills.slice(0, 3).map(renderSkillRow).join("");
  if (skillPaywallListEl) skillPaywallListEl.innerHTML = skills.slice(3).map(renderSkillRow).join("");
}

(async function loadSkillsFromDB() {
  const jobTitle   = s.jobTitle   || "";
  const resumeText = s.resumeText || "";
  if (!jobTitle) return;
  try {
    const url = `/api/position-skills?jobTitle=${encodeURIComponent(jobTitle)}&resumeText=${encodeURIComponent(resumeText.substring(0, 3000))}`;
    const resp = await fetch(url);
    if (!resp.ok) return;
    const data = await resp.json();
    if (!data.found || !data.skills || data.skills.length === 0) return;
    renderSkillSection(data.skills);
  } catch(e) { console.warn("[Skills]", e.message); }
})();

// Toggle paywall
const expandBtn = document.getElementById("skillExpandToggle");
const paywallEl = document.getElementById("skillPaywall");
if (expandBtn && paywallEl) {
  let open = false;
  expandBtn.addEventListener("click", () => {
    open = !open;
    paywallEl.hidden = !open;
    expandBtn.innerHTML = open ? "收起 ↑" : "查看全部 Top 10 技能 ↓";
  });
}

// ── 6. Mentor 渲染 ────────────────────────────────────────────────
function formatAdvice(text) {
  if (!text) return "";
  const parts = String(text).split(/(?=\(\d+\))/);
  if (parts.length <= 1) return escapeHtml(text);
  return parts.map(p => p.trim()).filter(Boolean)
    .map(p => `<div style="margin-bottom:5px;">${escapeHtml(p)}</div>`)
    .join("");
}
function copyExample(btn) {
  const raw = btn.getAttribute("data-content").replace(/&apos;/g,"'").replace(/&quot;/g,'"');
  if (navigator.clipboard) navigator.clipboard.writeText(raw).then(
    () => { btn.innerHTML = "✓ 已复制"; setTimeout(() => btn.innerHTML = "📋 复制", 2000); }
  );
}
window.copyExample = copyExample;

function sectionLabel(sec) {
  return { summary:"Summary", skills:"Skills", experience:"Experience", projects:"Projects", education:"Education", overall:"Overall" }[sec] || "Overall";
}
function priorityBadge(p) {
  const lv = (p === "high" || p === "critical" || p === "P0") ? "high"
           : (p === "medium" || p === "P1") ? "medium" : "low";
  const cfg = {
    high:   { dot:"#DC2626", bg:"#FFF1F1", color:"#991B1B", border:"#FCA5A5", label:"P0 必改" },
    medium: { dot:"#EA580C", bg:"#FFF7ED", color:"#9A3412", border:"#FDBA74", label:"P1 建议改" },
    low:    { dot:"#2563EB", bg:"#EFF6FF", color:"#1D4ED8", border:"#BFDBFE", label:"P2 加分项" },
  };
  const c = cfg[lv] || cfg.medium;
  return `<span style="display:inline-flex;align-items:center;gap:4px;font-size:11px;font-weight:600;padding:3px 9px;border-radius:99px;background:${c.bg};color:${c.color};border:1px solid ${c.border};letter-spacing:.01em;"><span style="width:5px;height:5px;border-radius:50%;background:${c.dot};flex-shrink:0;"></span>${c.label}</span>`;
}

const FIT_TYPE_CONFIG = {
  same_role:                { label:"同职位导师",  bg:"#EFF6FF", color:"#1D4ED8", border:"#BFDBFE" },
  same_industry:            { label:"同产业导师",  bg:"#F0FDF4", color:"#15803D", border:"#BBF7D0" },
  same_function:            { label:"同职能导师",  bg:"#F0FDF4", color:"#166534", border:"#BBF7D0" },
  cross_domain_high_relevance: { label:"跨领域高相关", bg:"#FFF7ED", color:"#92400E", border:"#FDE68A" },
  ats_universal:            { label:"ATS 通用建议", bg:"#F5F3FF", color:"#5B21B6", border:"#DDD6FE" },
  recruiter_perspective:    { label:"HR 视角",     bg:"#FFF1F2", color:"#9F1239", border:"#FECDD3" },
};

function renderApiAdviceItem(item, i) {
  const diagnosis   = item.currentDiagnosis || item.problemSummary || "";
  const action      = item.action || item.actionSummary || "";
  const insight     = item.mentorInsight || "";
  const hrPov       = item.hrPerspective || "";
  const matchReason = item.matchReason || "";
  const fitType     = item.mentorFitType || "";
  const topicCluster = item.topicCluster || sectionLabel(item.targetSection);

  const fitCfg = FIT_TYPE_CONFIG[fitType];
  const fitChip = fitCfg
    ? `<span style="display:inline-flex;align-items:center;font-size:11px;font-weight:600;padding:3px 9px;border-radius:99px;background:${fitCfg.bg};color:${fitCfg.color};border:1px solid ${fitCfg.border};">${fitCfg.label}</span>` : "";

  const evidenceChips = (item.evidence || []).length
    ? `<div style="display:flex;flex-wrap:wrap;gap:5px;margin-top:7px;">${item.evidence.map(e =>
        `<span style="font-size:11px;padding:2px 8px;border-radius:99px;background:#F3F4F6;color:#6B7280;border:1px solid #E5E7EB;">${escapeHtml(e)}</span>`
      ).join("")}</div>` : "";

  const divider = i > 0
    ? `<div style="height:1px;background:linear-gradient(to right,transparent,rgba(0,0,0,0.07),transparent);margin:22px 0;"></div>` : "";

  return `${divider}
    <div style="margin-top:${i > 0 ? "0" : "4px"};">
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:10px;flex-wrap:wrap;">
        ${priorityBadge(item.priority)}
        ${topicCluster ? `<span style="font-size:11px;font-weight:600;padding:3px 9px;border-radius:99px;background:#EEF2FF;color:#4338CA;border:1px solid #C7D2FE;">${escapeHtml(topicCluster)}</span>` : ""}
        ${fitChip}
      </div>
      ${matchReason ? `<div style="display:flex;align-items:flex-start;gap:7px;background:#FAFAF8;border-radius:8px;padding:7px 10px;margin-bottom:12px;border:1px solid rgba(0,0,0,0.05);"><span style="font-size:11px;flex-shrink:0;opacity:.5;margin-top:1px;">💬</span><p style="margin:0;font-size:11.5px;line-height:1.55;color:#78716C;font-style:italic;">${escapeHtml(matchReason)}</p></div>` : ""}
      <h4 style="margin:0 0 13px;font-size:15px;font-weight:700;color:#111827;line-height:1.4;">${escapeHtml(item.title)}</h4>
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
        ${insight ? `<div style="${hrPov ? "margin-bottom:8px;" : ""}">
          <span style="font-size:11px;font-weight:600;color:#6D28D9;background:#F5F3FF;padding:2px 7px;border-radius:99px;margin-right:6px;">导师</span>
          <span style="font-size:12.5px;line-height:1.6;color:#374151;">${escapeHtml(insight)}</span>
        </div>` : ""}
        ${hrPov ? `<div>
          <span style="font-size:11px;font-weight:600;color:#B45309;background:#FFFBEB;padding:2px 7px;border-radius:99px;margin-right:6px;">HR</span>
          <span style="font-size:12.5px;line-height:1.6;color:#374151;">${escapeHtml(hrPov)}</span>
        </div>` : ""}
      </div>` : ""}
    </div>`;
}

function mentorInitials(name) {
  const clean = String(name || "").replace(/[导师]/g, "").trim();
  return clean.slice(0, 2) || (name || "M").slice(0, 1);
}

function renderFreeMentor(m) {
  const mentorFreeEl = document.getElementById("mentorFree");
  if (!mentorFreeEl || !m) return;

  const name = m.mentorName || "导师";
  const initials = mentorInitials(name);
  const company = m.company || "";
  const title = m.mentorTitle || "";
  const careerPath = m.careerPathDisplay || "";
  const companyMeta = [company, title].filter(Boolean).join(" · ");
  const adviceHtml = (m.adviceItems || []).slice(0, 3).map(renderApiAdviceItem).join("");

  // Covered problem chips (shown as context tags at the top)
  const matchedTags = (m.matchedProblems || []).slice(0, 4).map(t =>
    `<span style="font-size:11px;padding:2px 8px;border-radius:99px;background:#F3F4F6;color:#6B7280;border:1px solid #E5E7EB;">${escapeHtml(String(t).replace(/_/g," "))}</span>`
  ).join("");

  mentorFreeEl.innerHTML = `
    <div style="background:#FFFDF7;border:1px solid rgba(0,0,0,0.07);border-radius:20px;padding:20px 20px 18px;box-shadow:0 1px 6px rgba(0,0,0,0.04);">
      <div style="display:flex;align-items:flex-start;gap:14px;margin-bottom:14px;">
        <div style="width:46px;height:46px;border-radius:50%;background:linear-gradient(135deg,#E8D5B7,#C8A46E);display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:15px;font-weight:700;color:#78350F;letter-spacing:.03em;">${escapeHtml(initials)}</div>
        <div style="flex:1;min-width:0;">
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
            <span style="font-size:18px;font-weight:700;color:#111827;line-height:1.2;">${escapeHtml(name)}</span>
            <span style="flex-shrink:0;font-size:11px;font-weight:600;padding:3px 9px;border-radius:99px;background:#FEF9C3;color:#713F12;border:1px solid #FDE68A;">免费试读</span>
          </div>
          ${companyMeta ? `<div style="font-size:12px;color:#6B7280;margin-top:3px;">${escapeHtml(companyMeta)}</div>` : ""}
          ${careerPath ? `<div style="font-size:11.5px;color:#9CA3AF;margin-top:2px;"><span style="font-weight:600;color:#A8A29E;">职业路径</span> · ${escapeHtml(careerPath)}</div>` : ""}
        </div>
      </div>
      ${matchedTags ? `<div style="display:flex;flex-wrap:wrap;gap:5px;margin-bottom:13px;">${matchedTags}</div>` : ""}
      <div style="height:1px;background:rgba(0,0,0,0.05);margin:0 0 18px;"></div>
      ${adviceHtml}
    </div>`;
}

function renderLockedAdvicePreview(preview) {
  const areaEl = document.getElementById("lockedMentorsArea");
  if (!areaEl || !preview) return;
  const lockedMentors = preview.lockedMentors || [];
  if (lockedMentors.length > 0) {
    areaEl.innerHTML = lockedMentors.map(m => {
      const topics = (m.previewTopics || []).map(t => `<span class="cred-pill">${escapeHtml(t)}</span>`).join("");
      const companyMeta = [m.company, m.mentorTitle].filter(Boolean).join(" · ");
      return `<article class="locked-mentor-v2" style="position:relative;overflow:hidden;">
        <div style="margin-bottom:8px;">
          <div style="font-size:17px;font-weight:700;color:var(--ink);line-height:1.2;">${escapeHtml(m.mentorName || "导师")}</div>
          ${companyMeta ? `<div style="font-size:12px;color:var(--ink-mute);margin-top:3px;">${escapeHtml(companyMeta)}</div>` : ""}
          ${m.careerPathDisplay ? `<div style="font-size:12px;color:var(--ink-soft);margin-top:3px;">${escapeHtml(m.careerPathDisplay)}</div>` : ""}
        </div>
        <div style="font-size:12px;font-weight:600;color:var(--ink-soft);font-family:var(--mono);margin:6px 0 6px;">${m.lockedAdviceCount || 3} 条建议</div>
        <div class="cred-pills" style="margin-bottom:10px;">${topics}</div>
        <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(246,243,236,.6);backdrop-filter:blur(2px);">
          <div style="text-align:center;"><div style="font-size:22px;margin-bottom:4px;">🔒</div><div style="font-size:12px;font-weight:600;">解锁查看完整建议</div></div>
        </div>
      </article>`;
    }).join("");
  }
}

// 读取并渲染导师建议
(function renderMentorAdvice() {
  const freeMentor  = s.freeMentorAdvice || atsResult.raw?.freeMentorAdvice;
  const lockedPrev  = s.lockedAdvicePreview || atsResult.raw?.lockedAdvicePreview;
  if (freeMentor) {
    renderFreeMentor(freeMentor);
    renderLockedAdvicePreview(lockedPrev);
    return;
  }
  const mentorFreeEl = document.getElementById("mentorFree");
  if (mentorFreeEl) mentorFreeEl.innerHTML = `<p style="color:var(--ink-soft);font-size:14px;padding:16px 0;">暂无导师建议，请返回首页重新提交简历。</p>`;
})();

// ── 7. ATS 评分详情 ────────────────────────────────────────────
if (atsResult && atsResult.atsScore) {
  const atsSectionEl = document.getElementById("atsDetailSection");
  if (atsSectionEl) atsSectionEl.removeAttribute("hidden");

  const items = (function dimensionRows(ats) {
    const dims = ats.dimensions || ats.raw?.dimensions || {};
    return Object.entries(dims).map(([key, value]) => ({
      key, label: value.label || key,
      score: value.score ?? 0, max: value.max ?? 100,
      pct: value.max ? Math.round((Number(value.score || 0) / Number(value.max)) * 100) : 0
    }));
  })(atsResult);

  // ATS system summary
  const sysSummaryEl = document.getElementById("atsSystemSummary");
  if (sysSummaryEl) {
    const jdMatch = atsResult.jdMatchRatio ?? atsResult.raw?.jdMatchRatio;
    const missingKw = atsResult.topMissingKw || atsResult.raw?.topMissingKw || [];
    sysSummaryEl.innerHTML = [
      jdMatch != null ? `<div><b>JD 关键词匹配：</b>${jdMatch}%</div>` : "",
      missingKw.length ? `<div><b>缺口关键词：</b>${missingKw.slice(0, 10).join("、")}</div>` : "",
      atsResult.formatPenaltyTriggered ? `<div style="color:var(--rose);"><b>格式处罚：</b>${(atsResult.formatPenaltyReason || []).join("；")}</div>` : "",
    ].filter(Boolean).join("");
  }

  // 六边形雷达图
  (function renderRadar() {
    const svgEl = document.getElementById("atsRadarChart");
    if (!svgEl) return;
    const cx = 120, cy = 110, R = 80;
    const dimKeys = ["A","B","C","D","E","F"];
    const dimLabels = { A:"格式规范", B:"基本资料", C:"内容质量", D:"JD匹配", E:"市场适配", F:"经验匹配" };
    const raw = atsResult.raw?.dimensions || atsResult.dimensions || {};
    const dims = dimKeys.map(k => {
      const d = raw[k];
      return d ? { score:d.score, max:d.max, pct:Math.round((d.score / d.max) * 100) } : { score:0, max:1, pct:0 };
    });
    const angle = (i) => (Math.PI / 3) * i - Math.PI / 2;
    const pt = (i, r) => [cx + r * Math.cos(angle(i)), cy + r * Math.sin(angle(i))];
    let svg = "";
    [0.25, 0.5, 0.75, 1].forEach(frac => {
      svg += `<polygon points="${dimKeys.map((_,i) => pt(i, R * frac).join(",")).join(" ")}" fill="none" stroke="rgba(0,0,0,.08)" stroke-width="1"/>`;
    });
    dimKeys.forEach((_, i) => {
      const [x, y] = pt(i, R);
      svg += `<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" stroke="rgba(0,0,0,.1)" stroke-width="1"/>`;
    });
    const dataPts = dims.map((d, i) => pt(i, R * d.pct / 100).join(",")).join(" ");
    svg += `<polygon points="${dataPts}" fill="rgba(106,191,123,.25)" stroke="var(--jade,#6abf7b)" stroke-width="2"/>`;
    dims.forEach((d, i) => {
      const [dx, dy] = pt(i, R * d.pct / 100);
      const [lx, ly] = pt(i, R + 22);
      const anchor = lx < cx - 4 ? "end" : lx > cx + 4 ? "start" : "middle";
      const color = d.pct >= 70 ? "var(--good,#6abf7b)" : d.pct >= 45 ? "#e9a84c" : "var(--rose,#e07070)";
      svg += `<circle cx="${dx}" cy="${dy}" r="4" fill="${color}"/>`;
      svg += `<text x="${lx}" y="${ly}" text-anchor="${anchor}" font-size="10" fill="var(--ink-soft)" font-family="var(--sans)">${dimLabels[dimKeys[i]]}</text>`;
      svg += `<text x="${lx}" y="${ly + 11}" text-anchor="${anchor}" font-size="10" font-weight="700" fill="${color}" font-family="var(--mono)">${d.score}/${d.max}</text>`;
    });
    svgEl.innerHTML = svg;

    const totalEl = document.getElementById("atsTotalScore");
    if (totalEl) {
      const sc = atsResult.atsScore;
      const scoreColor = sc >= 75 ? "var(--jade,#6abf7b)" : sc >= 55 ? "#e9a84c" : "var(--rose,#e07070)";
      totalEl.innerHTML = `<span style="color:${scoreColor};">${sc}</span><span style="font-size:13px;color:var(--ink-soft);font-weight:500;">/100</span>`;
    }
    const riskMap = {
      "低": { label:"低风险", bg:"#d4f0de", color:"#2d7a4a", border:"#2d7a4a" },
      "中": { label:"中风险", bg:"#fde8c8", color:"#b05e00", border:"#b05e00" },
      "高": { label:"高风险", bg:"#fdd8d8", color:"#b02020", border:"#b02020" },
    };
    const r = riskMap[atsResult.riskLevel] || { label: atsResult.riskLevel || "未知", bg:"#eee", color:"#666", border:"#999" };
    const badgeEl = document.getElementById("atsRiskBadge");
    if (badgeEl) { badgeEl.textContent = r.label; badgeEl.style.background = r.bg; badgeEl.style.color = r.color; badgeEl.style.border = `1.5px solid ${r.border}`; }
  })();

  // 关键问题
  const problemsEl = document.getElementById("atsProblems");
  if (problemsEl && atsResult.keyProblems?.length) {
    problemsEl.innerHTML = atsResult.keyProblems.slice(0, 6).map((p, i) =>
      `<li style="margin-bottom:10px;padding-left:20px;position:relative;line-height:1.5;${i >= 3 ? "filter:blur(4px);user-select:none;" : ""}"><span style="position:absolute;left:0;color:var(--rose);font-weight:600;">●</span>${escapeHtml(p)}</li>`
    ).join("") + (atsResult.keyProblems.length > 3 ? `<li style="list-style:none;text-align:center;font-size:12px;color:var(--ink-soft);">🔒 解锁查看完整问题列表</li>` : "");
  }

  // 优先建议
  const suggestionsEl = document.getElementById("atsSuggestions");
  if (suggestionsEl && atsResult.suggestions?.length) {
    suggestionsEl.innerHTML = atsResult.suggestions.slice(0, 6).map((sg, i) =>
      `<li style="margin-bottom:10px;padding-left:20px;position:relative;line-height:1.5;${i >= 3 ? "filter:blur(4px);user-select:none;" : ""}"><span style="position:absolute;left:0;color:var(--jade);font-weight:600;">✓</span>${escapeHtml(sg)}</li>`
    ).join("") + (atsResult.suggestions.length > 3 ? `<li style="list-style:none;text-align:center;font-size:12px;color:var(--ink-soft);">🔒 解锁查看完整建议</li>` : "");
  }

  // Chevron toggles
  ["atsProblemsDetails", "atsSuggestionsDetails"].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    const chevId = id === "atsProblemsDetails" ? "atsProblemsChev" : "atsSuggestionsChev";
    el.addEventListener("toggle", () => {
      const chev = document.getElementById(chevId);
      if (chev) chev.style.transform = el.open ? "rotate(0deg)" : "rotate(-90deg)";
    });
  });

  // ATS tile detail（覆盖前面的预设）
  if (atsDetailEl) atsDetailEl.innerHTML = renderRows([
    { k:"ATS 总分", v:`${atsResult.atsScore}/100`, note: atsRiskText(atsResult.riskLevel) },
    { k:"JD 关键词匹配", v:`${atsResult.jdMatchRatio ?? "--"}%`, note:"与目标岗位 JD 的匹配程度" },
  ]);
}
