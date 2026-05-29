const Store = window.Store || {
  get() { try { return JSON.parse(localStorage.getItem("resumeFixMVP") || "{}"); } catch { return {}; } }
};

if (typeof guardSubmitted === 'function') {
  guardSubmitted();
} else {
  const s0 = Store.get();
  if (!s0.resumeName) { window.location.href = "/"; }
}

const s = Store.get();
const atsResult = s.atsResult || {};

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

  const jdMatch = atsResult.jdMatchRatio ?? atsResult.raw?.scores?.jdMatch?.score;
  const breakdown = atsResult.keywordBreakdown || [];
  let kwHTML = `<div style="font-size:13px;font-weight:700;color:var(--ink);margin-bottom:10px;padding-bottom:8px;border-bottom:1px dashed var(--line);">关键词对比${jdMatch != null ? ` <span style="color:${jdMatch>=60?"var(--good)":jdMatch>=40?"#e9a84c":"var(--rose)"};font-family:var(--mono);font-size:13px;"> · JD 匹配度 ${jdMatch}%</span>` : ""}</div>`;

  if (breakdown.length) {
    kwHTML += breakdown.map(cat => {
      const matchedPills = cat.matched.slice(0,15).map(k=>`<span style="display:inline-block;padding:3px 8px;border-radius:99px;background:rgba(106,191,123,.15);color:#2d7a4a;font-size:12px;font-weight:500;margin:2px;">${escapeHtml(k)}</span>`).join("");
      const missingPills = cat.missing.slice(0,15).map(k=>`<span style="display:inline-block;padding:3px 8px;border-radius:99px;background:rgba(224,112,112,.12);color:#b02020;font-size:12px;font-weight:500;margin:2px;">${escapeHtml(k)}</span>`).join("");
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
    if (missingKw.length) kwHTML += `<div><div style="font-size:11px;color:var(--ink-soft);font-family:var(--mono);letter-spacing:.04em;margin-bottom:4px;">缺口关键词</div><div style="display:flex;flex-wrap:wrap;gap:4px;">${missingKw.slice(0,15).map(k=>`<span style="display:inline-block;padding:3px 8px;border-radius:99px;background:rgba(224,112,112,.12);color:#b02020;font-size:12px;">${escapeHtml(k)}</span>`).join("")}</div></div>`;
  }
  const kwSection = document.getElementById("atsKeywordSection");
  if (kwSection) kwSection.innerHTML = kwHTML;

  const problems = atsResult.keyProblems || [];
  const probSection = document.getElementById("atsProblemsSection");
  if (problems.length && probSection) {
    probSection.innerHTML = `
      <div style="font-size:13px;font-weight:600;color:var(--rose);margin-bottom:8px;">🔍 关键问题</div>
      <ul style="list-style:none;padding:0;margin:0;font-size:13px;">
        ${problems.slice(0,6).map(p=>`<li style="margin-bottom:8px;padding-left:18px;position:relative;line-height:1.5;"><span style="position:absolute;left:0;color:var(--rose);">●</span>${escapeHtml(p)}</li>`).join("")}
      </ul>`;
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
  if (insightEl) insightEl.innerHTML = `<span class="ico">💡</span>你已掌握 <b>${have}/${skills.length}</b> 项核心技能，还有 <b>${weak} 项</b>待补强。${weak > 0 ? "招聘官 8 秒就能看出你没用岗位语言写简历，建议重点补强缺失关键词。" : "技能覆盖率良好，建议进一步量化成果。"}`;
}
(async function loadSkills(){
  const jobTitle = s.jobTitle || "";
  const resumeText = s.resumeText || "";
  if (!jobTitle) return;
  try {
    const url = "/api/position-skills?jobTitle=" + encodeURIComponent(jobTitle)
                + "&resumeText=" + encodeURIComponent(resumeText.substring(0, 3000));
    const resp = await fetch(url);
    if (!resp.ok) return;
    const data = await resp.json();
    if (data.found && data.skills && data.skills.length > 0) renderSkillList(data.skills);
  } catch(e){ console.warn("[Skills]", e.message); }
})();

// ── 4. Mentors ──
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
    high:   { dot:"#EF4444", bg:"#FEF2F2", color:"#B91C1C", border:"#FECACA", label:"P0 必改" },
    medium: { dot:"#F97316", bg:"#FFF7ED", color:"#C2410C", border:"#FED7AA", label:"P1 建议优化" },
    low:    { dot:"#3B82F6", bg:"#EFF6FF", color:"#1D4ED8", border:"#BFDBFE", label:"P2 可加分" },
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
  const logo = m.companyLogo
    ? `<img src="${escapeAttr(m.companyLogo)}" alt="${escapeHtml(m.company||'')}" style="width:48px;height:48px;object-fit:contain;border-radius:10px;background:#fff;padding:5px;border:1px solid #EDE9DC;">`
    : avatarCircle(m.company, 48);
  const firstTag = (m.badges||[])[0] || "";
  const restTags = (m.badges||[]).slice(1);
  const allTags = (m.badges||[]);
  const advice = (m.adviceItems||[]).slice(0,3).map((item,i)=>renderAdviceItem(item,i)).join("");
  return `
    <article style="background:#FFFDF6;border:1px solid #EDE9DC;border-radius:22px;padding:24px;box-shadow:0 2px 12px rgba(0,0,0,0.06);margin-bottom:16px;">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:10px;margin-bottom:18px;">
        <div style="display:flex;align-items:flex-start;gap:14px;flex:1;min-width:0;">
          ${logo}
          <div style="flex:1;min-width:0;">
            <div style="font-weight:700;font-size:14px;color:#111827;line-height:1.3;">${escapeHtml(m.company||"")}</div>
            <div style="font-size:13px;color:#6B7280;margin-top:2px;">${escapeHtml(m.mentorName||"导师")} · ${escapeHtml(m.mentorTitle||"")}</div>
            ${m.careerPathDisplay ? `<div style="font-size:11px;color:#9CA3AF;margin-top:4px;">${escapeHtml(m.careerPathDisplay)}</div>` : ""}
            ${restTags.length ? `<div style="display:flex;flex-wrap:wrap;gap:5px;margin-top:6px;">${restTags.map(t=>`<span style="font-size:11px;padding:2px 8px;border-radius:99px;background:#F0F7F2;color:#2A6041;border:1px solid #D1E7D9;">${escapeHtml(t)}</span>`).join("")}</div>` : ""}
          </div>
        </div>
        ${firstTag ? `<span style="flex-shrink:0;font-size:11px;font-weight:600;padding:3px 10px;border-radius:99px;background:#EEF2FF;color:#4338CA;border:1px solid #C7D2FE;">${escapeHtml(firstTag)}</span>` : ""}
      </div>
      <div style="height:1px;background:#EDE9DC;margin:0 0 20px;"></div>
      <div>${advice}</div>
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;border-top:1px solid #EDE9DC;margin-top:20px;padding-top:14px;">
        <div style="display:flex;flex-wrap:wrap;gap:6px;">${allTags.map(t=>`<span style="font-size:11px;padding:2px 9px;border-radius:99px;background:#F3F4F6;color:#6B7280;">${escapeHtml(t)}</span>`).join("")}</div>
        <span style="font-size:12px;color:#9CA3AF;font-weight:500;">导师 ${idx+1} / 4</span>
      </div>
    </article>
  `;
}

const premiumMentors = s.premiumMentors;
const legacyMentors = s.mentorAdvice;
const mentorsListEl = document.getElementById("mentorsList");
if (mentorsListEl) {
  if (premiumMentors && premiumMentors.length > 0) {
    mentorsListEl.innerHTML = premiumMentors.map((m,i)=>renderPremiumMentorCard(m,i)).join("");
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
