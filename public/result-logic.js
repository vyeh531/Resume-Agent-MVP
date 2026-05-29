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
  function extractSchool(t) {
    const patterns = [
      /\b((?:University|College|Institute|School)\s+of\s+[A-Z][A-Za-z]+(?:\s+(?:at|in)\s+[A-Z][A-Za-z]+)?)/,
      /\b([A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+){0,4}\s+(?:University|College|School|Institute))\b/,
    ];
    for (const p of patterns) { const m = t.match(p); if (m) return m[1].trim(); }
    return null;
  }
  function extractYear(t) {
    const explicit = t.match(/(?:Class of|Expected[:\s]+|Graduation[:\s]+|Graduating[:\s]+)(\b20\d{2}\b)/i);
    if (explicit) return explicit[1];
    const nearDegree = t.match(/(?:B\.?S\.?|B\.?A\.?|M\.?S\.?|M\.?A\.?|Bachelor|Master|PhD|Ph\.D)[^\n]{0,80}?\b(20\d{2})\b/i);
    if (nearDegree) return nearDegree[1];
    const range = t.match(/\b(20\d{2})\s*[-–]\s*(20\d{2}|Present|Current)/i);
    if (range) return range[2] === "Present" || range[2] === "Current" ? range[1] : range[2];
    return null;
  }
  function extractMajor(t) {
    const m = t.match(/(?:B\.?S\.?|B\.?A\.?|M\.?S\.?|M\.?A\.?|Bachelor(?:'s)?|Master(?:'s)?|PhD|Ph\.D)[,.\s]+(?:of\s+)?(?:Science|Arts|Engineering|Applied\s+\w+)?\s*(?:in\s+)?([A-Z][A-Za-z &,\-]+?)(?:\n|,(?!\s*[A-Z]{2}\b)|;|  |\(|\d)/);
    return m ? m[1].trim().replace(/\s+/g, " ").replace(/,\s*$/, "") : null;
  }
  const school = extractSchool(text);
  const year = extractYear(text);
  const major = extractMajor(text);
  const parts = [];
  if (year) parts.push(year + "届");
  if (school) parts.push(school);
  if (major && major.length < 50) parts.push(major);
  const el = document.getElementById("studentInfo");
  if (el) el.textContent = parts.length ? parts.join(" · ") : (s.resumeName || "已上传简历");
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
    high:   { dot:"#EF4444", bg:"#FEF2F2", color:"#B91C1C", border:"#FECACA", label:"P0 必改" },
    medium: { dot:"#F97316", bg:"#FFF7ED", color:"#C2410C", border:"#FED7AA", label:"P1 建议改" },
    low:    { dot:"#3B82F6", bg:"#EFF6FF", color:"#1D4ED8", border:"#BFDBFE", label:"P2 加分项" },
  };
  const c = cfg[lv] || cfg.medium;
  return `<span style="display:inline-flex;align-items:center;gap:5px;font-size:11px;font-weight:600;padding:3px 10px;border-radius:99px;background:${c.bg};color:${c.color};border:1px solid ${c.border};"><span style="width:6px;height:6px;border-radius:50%;background:${c.dot};flex-shrink:0;"></span>${c.label}</span>`;
}

function renderApiAdviceItem(item, i) {
  const diagnosis = item.currentDiagnosis || item.problemSummary || "";
  const action    = item.action || item.actionSummary || "";
  const insight   = item.mentorInsight || "";
  const example   = item.example || "";
  const hrPov     = item.hrPerspective || "";
  const evidenceChips = (item.evidence || []).length
    ? `<div class="cred-pills" style="margin-top:6px;">${item.evidence.map(e => `<span class="cred-pill">${escapeHtml(e)}</span>`).join("")}</div>` : "";
  const divider = i > 0 ? `<div style="height:1px;background:linear-gradient(to right,transparent,#DDD6CA,transparent);margin:20px 0;"></div>` : "";
  return `${divider}
    <div style="margin-top:${i > 0 ? "0" : "12px"};">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;flex-wrap:wrap;">
        ${priorityBadge(item.priority)}
        <span style="font-size:11px;color:#9CA3AF;font-weight:500;">导师建议 ${i + 1}</span>
        <span style="margin-left:auto;font-size:11px;font-weight:600;padding:3px 10px;border-radius:99px;background:#EEF2FF;color:#4338CA;border:1px solid #C7D2FE;flex-shrink:0;">${escapeHtml(sectionLabel(item.targetSection))}</span>
      </div>
      <h4 style="margin:0 0 12px;font-size:15px;font-weight:700;color:#111827;line-height:1.4;">${escapeHtml(item.title)}</h4>
      ${diagnosis ? `<div style="display:flex;gap:10px;background:#F8F7F4;border-left:3px solid #D1C9B8;border-radius:0 10px 10px 0;padding:12px 14px;margin-bottom:10px;"><span style="font-size:15px;flex-shrink:0;">💡</span><div><div style="font-size:11px;font-weight:700;color:#78350F;margin-bottom:4px;">你的现状</div><p style="margin:0;font-size:13px;line-height:1.65;color:#44403C;">${escapeHtml(diagnosis)}</p>${evidenceChips}</div></div>` : ""}
      ${action ? `<div style="display:flex;gap:10px;background:#F0FDF4;border-left:3px solid #4ADE80;border-radius:0 10px 10px 0;padding:12px 14px;margin-bottom:10px;"><span style="font-size:15px;flex-shrink:0;">⚡</span><div><div style="font-size:11px;font-weight:700;color:#15803D;margin-bottom:4px;">建议你先做</div><p style="margin:0;font-size:13px;line-height:1.65;color:#166534;font-weight:600;">${escapeHtml(action)}</p></div></div>` : ""}
      ${insight ? `<div style="background:#F5F3FF;border-left:3px solid #C4B5FD;border-radius:0 10px 10px 0;padding:12px 14px;margin-bottom:10px;"><div style="font-size:11px;font-weight:700;color:#6D28D9;margin-bottom:4px;">导师视角</div><p style="margin:0;font-size:13px;line-height:1.65;color:#4C1D95;">${escapeHtml(insight)}</p></div>` : ""}
      ${example ? `<div class="advice-example"><div class="advice-example-head"><div class="title"><span class="check">✓</span><span>改写示例</span></div><button class="copy-btn" onclick="copyExample(this)" data-content='${escapeAttr(example)}'>📋 复制</button></div><div class="advice-example-body"><span style="font-size:13px;line-height:1.6;font-family:var(--mono);">${escapeHtml(example)}</span></div></div>` : ""}
      ${hrPov ? `<div style="background:#FFF7ED;border-left:3px solid #FED7AA;border-radius:0 10px 10px 0;padding:10px 14px;margin-top:8px;"><div style="font-size:11px;font-weight:700;color:#C2410C;margin-bottom:3px;">HR 视角</div><p style="margin:0;font-size:12px;line-height:1.6;color:#9A3412;">${escapeHtml(hrPov)}</p></div>` : ""}
    </div>`;
}

function renderFreeMentor(m) {
  const mentorFreeEl = document.getElementById("mentorFree");
  if (!mentorFreeEl || !m) return;
  const logo = m.companyLogo
    ? `<img src="${escapeAttr(m.companyLogo)}" alt="" style="width:44px;height:44px;object-fit:contain;border-radius:8px;background:#fff;padding:5px;border:1px solid #EDE9DC;">`
    : `<div style="width:44px;height:44px;border-radius:50%;background:rgba(168,213,186,.25);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:18px;">${escapeHtml((m.company || "M")[0])}</div>`;
  const badges = (m.badges || []).map(b => `<span class="cred-pill">${escapeHtml(b)}</span>`).join("");
  const adviceHtml = (m.adviceItems || []).slice(0, 3).map(renderApiAdviceItem).join("");
  mentorFreeEl.innerHTML = `
    <header class="mentor-detail-head">
      ${logo}
      <div class="info">
        <div class="company">${escapeHtml(m.company || "")}</div>
        <div class="role">${escapeHtml(m.mentorName || "导师")} · ${escapeHtml(m.mentorTitle || "")}</div>
      </div>
    </header>
    ${m.careerPathDisplay ? `<div style="margin-top:8px;font-size:12px;color:var(--ink-soft);"><b style="font-size:11px;font-family:var(--mono);color:var(--ink);">职业路径</b>　${escapeHtml(m.careerPathDisplay)}</div>` : ""}
    <div class="cred-pills" style="margin-top:10px;">${badges}</div>
    ${adviceHtml}`;
}

function renderLockedAdvicePreview(preview) {
  const areaEl = document.getElementById("lockedMentorsArea");
  if (!areaEl || !preview) return;
  const lockedMentors = preview.lockedMentors || [];
  if (lockedMentors.length > 0) {
    areaEl.innerHTML = lockedMentors.map(m => {
      const logo = m.companyLogo
        ? `<img src="${escapeAttr(m.companyLogo)}" alt="" style="width:44px;height:44px;object-fit:contain;border-radius:8px;background:#fff;padding:5px;">`
        : `<div style="width:44px;height:44px;border-radius:50%;background:rgba(168,213,186,.25);display:flex;align-items:center;justify-content:center;font-weight:700;">${escapeHtml((m.company || "M")[0])}</div>`;
      const topics = (m.previewTopics || []).map(t => `<span class="cred-pill">${escapeHtml(t)}</span>`).join("");
      return `<article class="locked-mentor-v2" style="position:relative;overflow:hidden;">
        <header class="head" style="display:flex;align-items:center;gap:12px;">${logo}
          <div class="info">
            <div class="company-name">${escapeHtml(m.company || "")}</div>
            <div class="role-line">${escapeHtml(m.mentorName || "导师")} · ${escapeHtml(m.mentorTitle || "")}</div>
          </div>
        </header>
        ${m.careerPathDisplay ? `<div style="margin:8px 0 6px;font-size:12px;color:var(--ink-soft);">${escapeHtml(m.careerPathDisplay)}</div>` : ""}
        <div style="font-size:12px;font-weight:600;color:var(--ink-soft);font-family:var(--mono);margin:8px 0 6px;">${m.lockedAdviceCount || 3} 条建议</div>
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
