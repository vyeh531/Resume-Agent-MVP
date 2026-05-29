const Store = window.Store || {
  get() { try { return JSON.parse(localStorage.getItem("resumeFixMVP") || "{}"); } catch { return {}; } }
};

if (typeof guardSubmitted === 'function') {
  guardSubmitted();
} else {
  const s0 = Store.get();
  if (!s0.resumeName) { window.location.href = "/"; }
}

const M = window.MOCK;
const s = Store.get();
const atsResult = s.atsResult || {};

  function atsRiskText(risk) {
    if (risk === "低") return "低风险";
    if (risk === "中") return "中风险";
    if (risk === "高") return "高风险";
    return risk || "未评级";
  }

  function dimensionRows(ats) {
    const dimensions = ats.dimensions || ats.raw?.dimensions || {};
    return Object.entries(dimensions).map(([key, value]) => ({
      key,
      label: value.label || key,
      score: value.score ?? 0,
      max: value.max ?? 100,
      pct: value.max ? Math.round((Number(value.score || 0) / Number(value.max)) * 100) : 0
    }));
  }

  function buildAtsTileRows(ats) {
    const rows = dimensionRows(ats).map((item) => ({
      k: `${item.key} · ${item.label}`,
      v: `${item.score}/${item.max}`,
      note: `${item.pct}% · ${item.pct >= 70 ? "表现较好" : item.pct >= 50 ? "需要优化" : "优先修改"}`
    }));
    if (ats.jdMatchRatio !== null && ats.jdMatchRatio !== undefined) {
      rows.unshift({
        k: "JD 关键词匹配",
        v: `${ats.jdMatchRatio}%`,
        note: (ats.topMissingKw || []).length
          ? `缺口关键词：${ats.topMissingKw.slice(0, 6).join("、")}`
          : "未发现明显关键词缺口"
      });
    }
    rows.unshift({
      k: "总分 / 风险",
      v: `${ats.atsScore}/100`,
      note: `${atsRiskText(ats.riskLevel)} · ${ats.scoringBasis || "ATS System 评分"}`
    });
    return rows;
  }

  // 如果有 ATS 评分结果，更新显示
  if (atsResult.atsScore) {
    M.scores.ats = atsResult.atsScore;
    M.atsBreakdown = buildAtsTileRows(atsResult);
    M.summary.coreIssue = atsResult.keyProblems && atsResult.keyProblems.length
      ? atsResult.keyProblems[0]
      : `ATS ${atsRiskText(atsResult.riskLevel)}（${atsResult.atsScore}/100），请优先查看 ATS 诊断中的分项得分和修改建议。`;

    console.log("[Result] ATS 评分已加载:", atsResult);
  }

  // ===== Summary =====
  document.getElementById("targetJob").textContent = "目标:" + (s.jobTitle || M.job.title);

  // Parse real education info from resume text
  (function setStudentInfo() {
    const text = s.resumeText || "";

    // School name: handle "University of X at Y", "X University", "X College", etc.
    // Stop at newline, comma, city-state pattern, or multiple spaces (avoid eating city name)
    function extractSchool(t) {
      const patterns = [
        // "University/College/Institute of X (at Y)?" — institution keyword FIRST
        /\b((?:University|College|Institute|School)\s+of\s+[A-Z][A-Za-z]+(?:\s+(?:at|in)\s+[A-Z][A-Za-z]+)?)/,
        // "X University / College / School / Institute" — institution keyword LAST
        /\b([A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+){0,4}\s+(?:University|College|School|Institute))\b/,
      ];
      for (const p of patterns) {
        const m = t.match(p);
        if (m) return m[1].trim();
      }
      return null;
    }

    // Graduation year: look for explicit markers first, then fall back to a year near degree keywords
    function extractYear(t) {
      const explicit = t.match(/(?:Class of|Expected[:\s]+|Graduation[:\s]+|Graduating[:\s]+)(\b20\d{2}\b)/i);
      if (explicit) return explicit[1];
      const nearDegree = t.match(/(?:B\.?S\.?|B\.?A\.?|M\.?S\.?|M\.?A\.?|Bachelor|Master|PhD|Ph\.D)[^\n]{0,80}?\b(20\d{2})\b/i);
      if (nearDegree) return nearDegree[1];
      // date range like "Aug 2021 – May 2025" near education
      const range = t.match(/\b(20\d{2})\s*[-–]\s*(20\d{2}|Present|Current)/i);
      if (range) return range[2] === "Present" || range[2] === "Current" ? range[1] : range[2];
      return null;
    }

    // Major / field of study
    function extractMajor(t) {
      const m = t.match(/(?:B\.?S\.?|B\.?A\.?|M\.?S\.?|M\.?A\.?|Bachelor(?:'s)?|Master(?:'s)?|PhD|Ph\.D)[,.\s]+(?:of\s+)?(?:Science|Arts|Engineering|Applied\s+\w+)?\s*(?:in\s+)?([A-Z][A-Za-z &,\-]+?)(?:\n|,(?!\s*[A-Z]{2}\b)|;|  |\(|\d)/);
      return m ? m[1].trim().replace(/\s+/g, " ").replace(/,\s*$/, "") : null;
    }

    const school = extractSchool(text);
    const year   = extractYear(text);
    const major  = extractMajor(text);

    const parts = [];
    if (year) parts.push(year + "届");
    if (school) parts.push(school);
    if (major && major.length < 50) parts.push(major);
    document.getElementById("studentInfo").textContent = parts.length ? parts.join(" · ") : (s.resumeName || "已上传简历");
  })();
  document.getElementById("coreIssue").textContent = M.summary.coreIssue;

  // 更新标题中的 ATS 评分
  if (atsResult.atsScore) {
    document.getElementById("atsHeadlineScore").textContent = atsResult.atsScore;
    console.log("[Result] 标题评分已更新:", atsResult.atsScore);
  }

  document.getElementById("rankPct").textContent = M.scores.rankingPercentile + "%";
  document.getElementById("atsScore").textContent = M.scores.ats;
  document.getElementById("salaryRange").textContent = M.scores.salaryNow;
  document.getElementById("salaryTop").textContent = M.scores.salaryTop;
  document.getElementById("compCount").textContent = M.scores.competitorCount.toLocaleString();
  document.getElementById("admitRate").textContent = M.scores.admitRate;

  function renderRows(arr){
    return arr.map(r => `
      <div class="detail-row"><span class="k">${r.k}</span><span class="v">${r.v}</span></div>
      <div style="font-size: 12px; color: var(--ink-mute); margin: -2px 0 6px; line-height:1.4;">${r.note}</div>
    `).join("");
  }
  document.getElementById("rankDetail").innerHTML   = renderRows(M.rankingBreakdown);
  document.getElementById("atsDetail").innerHTML    = renderRows(M.atsBreakdown);
  document.getElementById("salaryDetail").innerHTML = renderRows(M.salaryBreakdown);
  document.getElementById("compDetail").innerHTML   = renderRows(M.compBreakdown);

  // ── 從 DB 撈真實薪資數據，填入 SALARY tile ──────────────────
  (async function loadSalaryFromDB() {
    const jobTitle = s.jobTitle || "";
    if (!jobTitle) return;
    try {
      const resp = await fetch(`/api/position-salary?jobTitle=${encodeURIComponent(jobTitle)}`);
      if (!resp.ok) return;
      const data = await resp.json();
      if (!data.found || !data.salary_range) return;

      console.log("[Salary] DB match:", data.position_title, data.salary_range);

      // salary_range 格式解析：支援 "$80K-$120K", "80000-150000", "80K~150K" 等
      const raw = data.salary_range;
      const nums = raw.match(/[\d,]+\.?\d*/g);
      if (!nums || nums.length === 0) return;

      // 把數字標準化為 K 格式
      function toK(n) {
        const v = parseFloat(n.replace(/,/g, ""));
        return v >= 1000 ? Math.round(v / 1000) + "K" : n;
      }

      const low  = toK(nums[0]);
      const high = nums[1] ? toK(nums[1]) : low;
      const mid  = nums[1] ? Math.round((parseFloat(nums[0].replace(/,/g,'')) + parseFloat(nums[1].replace(/,/g,''))) / 2) : null;
      const midK = mid ? toK(String(mid)) : null;

      // 更新 tile 主數字 & 頂線 & 標題
      document.getElementById("salaryRange").textContent = "$" + low;
      document.getElementById("salaryTop").textContent   = "$" + high;
      const hlTop = document.getElementById("headlineSalaryTop");
      if (hlTop) hlTop.textContent = "$" + high;

      // 更新 detail breakdown（保留 note 文字不動）
      const detailRows = [
        { k: "当前简历水平",     v: "$" + low,              note: M.salaryBreakdown[0]?.note || "" },
        { k: "面试加分线",       v: midK ? "$" + midK : "$" + low, note: M.salaryBreakdown[1]?.note || "" },
        { k: "顶级 Offer 线",    v: "$" + high,             note: M.salaryBreakdown[2]?.note || "" },
      ];
      document.getElementById("salaryDetail").innerHTML = renderRows(detailRows);
      console.log("[Salary] Updated:", low, "~", high);
    } catch (e) {
      console.warn("[Salary] Failed to load from DB:", e.message);
    }
  })();

  // ===== Skill X/10 — 從 DB 撈真實技能，與 resume 比對 =====
  const labelMap = {
    have: `<span class="pill pill-good"><span class="dot"></span>已具备</span>`,
    weak: `<span class="pill pill-warn"><span class="dot"></span>待补强</span>`
  };
  function renderSkillRow(sk){
    return `
      <li class="skill-row">
        <div class="skill-name"><span class="priority">#${sk.priority}</span>${sk.name}</div>
        ${labelMap[sk.status] || ""}
      </li>
    `;
  }
  function renderSkillSection(skills) {
    const have = skills.filter(sk => sk.status === "have").length;
    const weak = skills.filter(sk => sk.status === "weak").length;
    const total = skills.length;
    document.getElementById("skillHave").textContent  = have;
    document.getElementById("skillTotal").textContent = total;
    document.getElementById("skillSummary").innerHTML = `
      <span class="skill-have" style="flex: ${have}"></span>
      <span class="skill-weak" style="flex: ${weak}"></span>
    `;
    document.getElementById("skillListTop3").innerHTML    = skills.slice(0, 3).map(renderSkillRow).join("");
    document.getElementById("skillPaywallList").innerHTML = skills.slice(3).map(renderSkillRow).join("");
  }

  // 先用 mock 資料顯示，等 API 回來再替換
  renderSkillSection(M.skillGap);

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
      console.log("[Skills] DB match:", data.position_title, data.skills);
      renderSkillSection(data.skills);
    } catch (e) {
      console.warn("[Skills] Failed to load from DB:", e.message);
    }
  })();

  // Toggle paywall
  const expandBtn = document.getElementById("skillExpandToggle");
  const paywallEl = document.getElementById("skillPaywall");
  let paywallOpen = false;
  expandBtn.addEventListener("click", () => {
    paywallOpen = !paywallOpen;
    paywallEl.hidden = !paywallOpen;
    expandBtn.innerHTML = paywallOpen
      ? "收起 ↑"
      : "查看全部 Top 10 技能 ↓";
  });

  function stripHtml(html){ return String(html).replace(/<br\s*\/?>/g, "\n").replace(/<[^>]+>/g, ""); }
  function escapeAttr(s){ return String(s || "").replace(/'/g, "&apos;").replace(/"/g, "&quot;"); }
  function escapeHtml(s){
    return String(s || "").replace(/[&<>"']/g, ch => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[ch]));
  }
  function copyExample(btn){
    const raw = btn.getAttribute("data-content").replace(/&apos;/g, "'").replace(/&quot;/g, '"');
    // Strip [[...]] markers when copying
    const text = raw.replace(/\[\[([^\]]+)\]\]/g, "$1");
    if (navigator.clipboard){
      navigator.clipboard.writeText(text).then(
        () => { btn.innerHTML = "✓ 已复制"; setTimeout(() => btn.innerHTML = "📋 复制", 2000); }
      );
    }
  }
  window.copyExample = copyExample;

  function priorityClass(p){
    if (!p) return "";
    if (p.startsWith("P0")) return "";
    if (p.startsWith("P1")) return "priority-tag--p1";
    if (p.startsWith("P2")) return "priority-tag--p2";
    return "";
  }

  // "Sarah Chen" → "C导师"
  function formatMentorName(name) {
    if (!name) return "X导师";
    const parts = name.trim().split(/\s+/);
    const last = parts[parts.length - 1] || parts[0];
    return last[0].toUpperCase() + "导师";
  }

  // Split "(1) step (2) step (3) step" into separate lines
  function formatAdvice(text) {
    if (!text) return "";
    const parts = String(text).split(/(?=\(\d+\))/);
    if (parts.length <= 1) return highlightFake(text);
    return parts.map(p => p.trim()).filter(Boolean)
      .map(p => `<div style="margin-bottom:5px;">${highlightFake(p)}</div>`)
      .join("");
  }

  // Highlight [[fake numbers]] in amber
  function highlightFake(text) {
    if (!text) return "";
    return String(text).replace(/\[\[([^\]]+)\]\]/g,
      '<mark style="background:rgba(232,160,107,.22);color:var(--apricot,#e8a06b);border-radius:3px;padding:0 2px;font-weight:600;" title="AI 估算数据，仅供参考">$1</mark>'
    );
  }

  // ===== Shared: render one advice group (P0/P1/P2 block) =====
  function renderAdviceGroup(item, copyHandler) {
    const ba = item.beforeAfter || {};
    const hasFake = (ba.after || "").includes("[[");
    return `
      <div class="priority-issue" style="margin-top:14px;">
        <span class="priority-tag ${priorityClass(item.priority)}">${item.priority || "P0 必改"}</span>
        <span class="priority-text">${item.issue || ""}</span>
      </div>
      ${item.strategy ? `<div class="advice-section" style="margin-top:12px;"><h4>导师筛选策略</h4><p>${highlightFake(item.strategy)}</p></div>` : ""}
      ${item.current ? `<div class="advice-section advice-section--plain"><h4>你的现状</h4><p>${highlightFake(item.current)}</p></div>` : ""}
      <div class="advice-section advice-section--plain"><h4>建议</h4><div style="font-size:14px;line-height:1.7;">${formatAdvice(item.advice || "")}</div></div>
      ${ba.after ? `
      <div class="advice-example">
        <div class="advice-example-head">
          <div class="title"><span class="check">✓</span><span>改写示例</span></div>
          <button class="copy-btn" onclick="${copyHandler}(this)" data-content='${escapeAttr(ba.after)}'>📋 复制</button>
        </div>
        <div class="advice-example-body">
          ${ba.before ? `<div style="margin-bottom:8px;"><span class="label" style="color:var(--rose,#e07070);">改写前：</span><br/><span style="font-size:13px;color:var(--ink-soft);font-family:var(--mono,monospace);">${ba.before}</span></div>` : ""}
          <div><span class="label">改写后：</span><br/><span style="font-size:13px;font-weight:500;line-height:1.6;font-family:var(--mono,monospace);">${highlightFake(ba.after)}</span></div>
          ${hasFake ? `<div style="margin-top:8px;font-size:11px;color:var(--ink-mute);font-family:var(--mono);"><mark style="background:rgba(232,160,107,.22);color:var(--apricot,#e8a06b);border-radius:3px;padding:0 2px;font-size:10px;">橙色数字</mark> 为 AI 估算，请替换为你的真实数据</div>` : ""}
        </div>
      </div>` : ""}
    `;
  }

  // ===== Mentor header HTML (shared) =====
  function renderMentorHeader(m) {
    const creds = Array.isArray(m.credentials) ? m.credentials : (m.tag ? [m.tag] : []);
    const logo = m.avatar || (m.company && m.company[0]) || "M";
    return `
      <header class="mentor-detail-head">
        <div class="company-logo" style="font-size:${m.avatar?'22px':'14px'};width:44px;height:44px;display:flex;align-items:center;justify-content:center;border-radius:50%;background:rgba(168,213,186,.25);font-weight:700;">${logo}</div>
        <div class="info">
          <div class="company">${m.company || ""}</div>
          <div class="role">${formatMentorName(m.name)} · ${m.role || ""}</div>
        </div>
      </header>
      <div class="cred-pills" style="margin-top:10px;">
        ${creds.map(c => `<span class="cred-pill">${c}</span>`).join("")}
      </div>
      ${m.career_path ? `<div style="margin-top:8px;font-size:12px;color:var(--ink-soft);"><b style="color:var(--ink);font-size:11px;font-family:var(--mono);letter-spacing:.04em;">职业路径</b>　${m.career_path}</div>` : ""}
    `;
  }

  function problemLabel(tag) {
    const labels = {
      low_jd_keyword_match: "JD Match 偏低",
      low_hard_skill_match: "关键词缺失",
      missing_priority_keywords: "关键词缺失",
      missing_exact_job_title: "岗位定位不清",
      weak_summary_role_alignment: "岗位定位不清",
      weak_target_role_alignment: "岗位定位不清",
      weak_experience_keyword_evidence: "经历证据不足",
      keywords_only_in_skills: "经历证据不足",
      resume_not_tailored_to_jd: "未针对 JD"
    };
    return labels[tag] || String(tag || "").replace(/_/g, " ");
  }

  function renderAtsEvidence() {
    const dims = atsResult.dimensions || atsResult.raw?.dimensions || {};
    const jdScore = atsResult.raw?.scores?.jdMatch?.score ?? atsResult.jdMatchRatio;
    const chips = [
      jdScore !== null && jdScore !== undefined ? `JD Match ${jdScore}${String(jdScore).includes("%") ? "" : "%"}` : "",
      dims.D ? `D ${dims.D.score}/${dims.D.max}` : "",
      dims.F ? `F ${dims.F.score}/${dims.F.max}` : ""
    ].filter(Boolean);
    if (!chips.length) return "";
    return `<div class="cred-pills" style="margin-top:10px;">${chips.map(c => `<span class="cred-pill">${escapeHtml(c)}</span>`).join("")}</div>`;
  }

  function renderApiMentorHeader(m) {
    const badges = Array.isArray(m.badges) ? m.badges : [];
    const logo = m.companyLogo
      ? `<img src="${escapeHtml(m.companyLogo)}" alt="${escapeHtml(m.company || "mentor")}" style="width:44px;height:44px;object-fit:contain;border-radius:8px;background:#fff;padding:6px;">`
      : `<div class="company-logo" style="font-size:14px;width:44px;height:44px;display:flex;align-items:center;justify-content:center;border-radius:50%;background:rgba(168,213,186,.25);font-weight:700;">${escapeHtml((m.company || "M")[0])}</div>`;
    return `
      <header class="mentor-detail-head">
        ${logo}
        <div class="info">
          <div class="company">${escapeHtml(m.company || "Amazon")}</div>
          <div class="role">${escapeHtml(m.mentorName || "Y 导师")} · ${escapeHtml(m.mentorTitle || "简历策略师")}</div>
        </div>
      </header>
      ${m.careerPathDisplay ? `<div style="margin-top:8px;font-size:12px;color:var(--ink-soft);"><span style="color:var(--ink);font-weight:600;font-size:11px;font-family:var(--mono);letter-spacing:.04em;">职业路径</span>　${escapeHtml(m.careerPathDisplay)}</div>` : `<div class="cred-pills" style="margin-top:10px;">${badges.map(c => `<span class="cred-pill">${escapeHtml(c)}</span>`).join("")}</div>`}
    `;
  }

  function renderPriorityBadge(item) {
    const label = item.priorityLabel || (
      item.priority === "high" || item.priority === "critical" ? "P0 必改" :
      item.priority === "medium" ? "P1 建议改" :
      item.priority === "low" ? "P2 加分项" : "P1 建议改"
    );
    const styles = {
      "P0 必改":    "background:#fdd8d8;color:#b02020;border:1.5px solid #e07070;",
      "P1 建议改":  "background:#fde8c8;color:#8a4500;border:1.5px solid #e9a84c;",
      "P2 加分项":  "background:#d4f0de;color:#2d6a46;border:1.5px solid #6abf7b;",
    };
    const s = styles[label] || styles["P1 建议改"];
    return `<span style="${s}padding:3px 9px;border-radius:99px;font-size:11px;font-weight:700;font-family:var(--mono);letter-spacing:.04em;flex-shrink:0;">${label}</span>`;
  }

  function renderApiAdviceItem(item, i) {
    const sectionPill = item.targetSection
      ? `<span class="cred-pill">${escapeHtml(sectionLabel(item.targetSection))}</span>`
      : "";

    // New-schema fields (gracefully omit empty sections)
    const mentorLens = item.mentorLens || "";
    const currentDiagnosis = item.currentDiagnosis || item.problemSummary || "";
    const action = item.action || item.actionSummary || "";
    const reason = item.reason || "";
    const evidenceChips = (item.evidence || []).length
      ? `<div class="cred-pills" style="margin-top:8px;">${(item.evidence).map(e => `<span class="cred-pill">${escapeHtml(e)}</span>`).join("")}</div>`
      : "";

    const mentorLensHtml = mentorLens ? `
      <div style="margin:10px 0 6px;">
        <div style="font-size:11px;font-weight:700;color:var(--ink-soft);font-family:var(--mono);letter-spacing:.06em;text-transform:uppercase;margin-bottom:4px;">导师筛选视角</div>
        <p style="margin:0;color:var(--ink-soft);font-size:13px;line-height:1.65;">${escapeHtml(mentorLens)}</p>
      </div>` : "";

    const diagnosisHtml = currentDiagnosis ? `
      <div style="margin:10px 0 6px;">
        <div style="font-size:11px;font-weight:700;color:var(--ink-soft);font-family:var(--mono);letter-spacing:.06em;text-transform:uppercase;margin-bottom:4px;">你的现状</div>
        <p style="margin:0;color:var(--ink);font-size:13px;line-height:1.65;">${escapeHtml(currentDiagnosis)}</p>
        ${evidenceChips}
      </div>` : "";

    const actionHtml = action ? `
      <div style="margin:10px 0 6px;padding:10px 12px;background:rgba(168,213,186,.13);border-radius:8px;border-left:3px solid rgba(100,180,130,.5);">
        <div style="font-size:11px;font-weight:700;color:var(--ink-soft);font-family:var(--mono);letter-spacing:.06em;text-transform:uppercase;margin-bottom:4px;">建议你先做</div>
        <p style="margin:0;color:var(--ink);font-size:13px;line-height:1.7;font-weight:600;">${escapeHtml(action)}</p>
      </div>` : "";

    const reasonHtml = reason ? `
      <div style="margin:10px 0 0;">
        <div style="font-size:11px;font-weight:700;color:var(--ink-soft);font-family:var(--mono);letter-spacing:.06em;text-transform:uppercase;margin-bottom:4px;">为什么这样改有效？</div>
        <p style="margin:0;color:var(--ink-soft);font-size:13px;line-height:1.65;">${escapeHtml(reason)}</p>
      </div>` : "";

    return `
      <div class="advice-section advice-section--plain" style="margin-top:14px;">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;flex-wrap:wrap;">
          ${renderPriorityBadge(item)}
          <h4 style="margin:0;font-size:15px;font-weight:700;">导师建议 ${i + 1}</h4>
          ${sectionPill ? `<div class="cred-pills" style="margin-left:auto;">${sectionPill}</div>` : ""}
        </div>
        <div style="font-weight:700;font-size:15px;margin-bottom:4px;line-height:1.4;">${escapeHtml(item.title)}</div>
        ${mentorLensHtml}${diagnosisHtml}${actionHtml}${reasonHtml}
      </div>
    `;
  }

  // ===== Render free mentor (1 mentor, 3 advice groups) =====
  function renderFreeMentor(m) {
    if (Array.isArray(m.adviceItems)) {
      document.getElementById("mentorFree").innerHTML =
        renderApiMentorHeader(m) +
        m.adviceItems.slice(0, 3).map(renderApiAdviceItem).join("");
      return;
    }
    if (m && Array.isArray(m.adviceItems)) {
      renderFreeMentorPlan(m);
      return;
    }
    const adviceList = Array.isArray(m.adviceList) && m.adviceList.length > 0
      ? m.adviceList
      : [{ priority: m.priority, issue: m.issue, strategy: m.strategy, current: m.current, advice: m.advice, beforeAfter: m.beforeAfter || {} }];
    const groups = adviceList.map((item, i) => {
      const divider = i > 0 ? `<hr style="border:none;border-top:1px dashed var(--line);margin:18px 0 2px;">` : "";
      return divider + renderAdviceGroup(item, "copyExample");
    }).join("");
    document.getElementById("mentorFree").innerHTML = renderMentorHeader(m) + groups;
  }

  function sectionLabel(section) {
    const labels = {
      summary: "Summary",
      skills: "Skills",
      experience: "Experience",
      projects: "Projects",
      education: "Education",
      overall: "Overall",
    };
    return labels[section] || "Overall";
  }

  function problemLabel(tag) {
    const labels = {
      low_jd_keyword_match: "JD Match 偏低",
      low_hard_skill_match: "核心技能缺失",
      missing_exact_job_title: "岗位原词缺失",
      weak_summary_role_alignment: "岗位定位不清",
      weak_experience_keyword_evidence: "经历证据不足",
      keywords_only_in_skills: "关键词只在 Skills",
      low_measurable_results: "量化成果偏弱",
      missing_linkedin: "LinkedIn 缺失",
      missing_portfolio: "Portfolio 缺失",
      resume_not_tailored_to_jd: "简历未贴合 JD",
    };
    return labels[tag] || String(tag || "").replace(/_/g, " ");
  }

  function renderAtsEvidenceChips(ats) {
    const raw = ats?.raw || ats || {};
    const chips = [];
    const jdScore = raw.scores?.jdMatch?.score;
    const dimD = raw.dimensions?.D;
    const dimF = raw.dimensions?.F;
    if (jdScore !== undefined) chips.push(`JD Match ${jdScore}/100`);
    if (dimD) chips.push(`D 关键词 ${dimD.score}/${dimD.max}`);
    if (dimF) chips.push(`F 职位相关 ${dimF.score}/${dimF.max}`);
    return chips.map(c => `<span class="cred-pill">${escapeHtml(c)}</span>`).join("");
  }

  function renderFreeMentorPlan(m) {
    const logo = m.companyLogo
      ? `<img src="${escapeAttr(m.companyLogo)}" alt="" style="width:44px;height:44px;border-radius:50%;object-fit:contain;">`
      : `<div class="company-logo" style="font-size:14px;width:44px;height:44px;display:flex;align-items:center;justify-content:center;border-radius:50%;background:rgba(168,213,186,.25);font-weight:700;">${escapeHtml((m.company || "M")[0])}</div>`;
    const badges = (m.badges || []).map(b => `<span class="cred-pill">${escapeHtml(b)}</span>`).join("");
    const problemChips = (m.matchedProblems || []).slice(0, 5).map(p => `<span class="cred-pill">${escapeHtml(problemLabel(p))}</span>`).join("");
    const adviceHtml = (m.adviceItems || []).slice(0, 3).map((item, index) =>
      renderApiAdviceItem(item, index)
    ).join("");
    document.getElementById("mentorFree").innerHTML = `
      <div style="font-size:12px;color:var(--ink-soft);font-family:var(--mono);margin-bottom:10px;">导师 1 / 4 · 免费试读</div>
      <header class="mentor-detail-head">
        ${logo}
        <div class="info">
          <div class="company">${escapeHtml(m.company || "")}</div>
          <div class="role">${escapeHtml(m.mentorName || "Y导师")} · ${escapeHtml(m.mentorTitle || "简历策略师")}</div>
        </div>
      </header>
      <div class="cred-pills" style="margin-top:10px;">${badges}</div>
      ${adviceHtml}
    `;
  }

  // ===== Render locked mentors (blurred preview of 3 remaining) =====
  function renderLockedMentors(mentors) {
    const html = mentors.map(m => {
      const creds = Array.isArray(m.credentials) ? m.credentials : (m.tag ? [m.tag] : []);
      const logo = m.avatar || (m.company && m.company[0]) || "M";
      // Preview text from first advice group
      const firstAdvice = (Array.isArray(m.adviceList) && m.adviceList[0]) || m;
      const preview = (firstAdvice.strategy || firstAdvice.advice || "").slice(0, 80);
      return `
        <article class="locked-mentor-v2">
          <header class="head">
            <div class="company-logo" style="font-size:${m.avatar?'20px':'13px'};width:40px;height:40px;display:flex;align-items:center;justify-content:center;border-radius:50%;background:rgba(168,213,186,.25);font-weight:700;">${logo}</div>
            <div class="info">
              <div class="company-name">${m.company || ""}</div>
              <div class="role-line">${formatMentorName(m.name)} · ${m.role || ""}</div>
            </div>
          </header>
          ${m.career_path ? `<div style="margin:4px 0 6px;font-size:11px;color:var(--ink-soft);">${m.career_path}</div>` : ""}
          <div class="cred-pills" style="margin:6px 0;">
            ${creds.map(c => `<span class="cred-pill">${c}</span>`).join("")}
          </div>
          <div class="blur-area">
            <div class="blur-content">${preview}…</div>
            <div class="lock-cta">
              <div class="lock-icon">🔒</div>
              <div class="lock-text">解锁查看完整 3 组建议</div>
            </div>
          </div>
        </article>
      `;
    }).join("");
    document.getElementById("lockedMentorsArea").innerHTML = html;
  }

  function renderLockedAdvicePreview(preview) {
    if (!preview) return;
    const lockedMentors = preview.lockedMentors || [];
    if (lockedMentors.length > 0) {
      const cards = lockedMentors.map(m => {
        const logo = m.companyLogo
          ? `<img src="${escapeAttr(m.companyLogo)}" alt="${escapeHtml(m.company || '')}" style="width:44px;height:44px;object-fit:contain;border-radius:8px;background:#fff;padding:5px;">`
          : `<div style="font-size:14px;width:44px;height:44px;display:flex;align-items:center;justify-content:center;border-radius:50%;background:rgba(168,213,186,.25);font-weight:700;">${escapeHtml((m.company || "M")[0])}</div>`;
        const topicPills = (m.previewTopics || []).map(t => `<span class="cred-pill">${escapeHtml(t)}</span>`).join("");
        const adviceCountLabel = m.lockedAdviceCount ? `${m.lockedAdviceCount} 条建议` : "3 条建议";
        return `
          <article class="locked-mentor-v2" style="position:relative;overflow:hidden;">
            <header class="head" style="display:flex;align-items:center;gap:12px;">
              ${logo}
              <div class="info">
                <div class="company-name">${escapeHtml(m.company || "")}</div>
                <div class="role-line">${escapeHtml(m.mentorName || "导师")} · ${escapeHtml(m.mentorTitle || "简历策略师")}</div>
              </div>
            </header>
            ${m.careerPathDisplay ? `<div style="margin:8px 0 6px;font-size:12px;color:var(--ink-soft);"><span style="color:var(--ink);font-weight:600;font-size:11px;font-family:var(--mono);letter-spacing:.04em;">职业路径</span>　${escapeHtml(m.careerPathDisplay)}</div>` : ""}
            <div style="margin:8px 0 6px;font-size:12px;font-weight:600;color:var(--ink-soft);font-family:var(--mono);letter-spacing:.04em;">涵盖方向 · ${adviceCountLabel}</div>
            <div class="cred-pills" style="margin-bottom:10px;">${topicPills}</div>
            <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(246,243,236,.55);backdrop-filter:blur(1px);">
              <div style="text-align:center;">
                <div style="font-size:20px;margin-bottom:4px;">🔒</div>
                <div style="font-size:12px;font-weight:600;color:var(--ink);">解锁查看完整建议</div>
              </div>
            </div>
          </article>
        `;
      }).join("");
      document.getElementById("lockedMentorsArea").innerHTML = cards;
    } else {
      const topics = (preview.topics || []).map(t => `<span class="cred-pill">${escapeHtml(t)}</span>`).join("");
      document.getElementById("lockedMentorsArea").innerHTML = `
        <article class="locked-mentor-v2">
          <div style="font-weight:800;margin-bottom:8px;">还有 ${preview.lockedMentorCount ?? 3} 位导师未解锁</div>
          <div style="color:var(--ink-soft);line-height:1.7;">
            还有 ${preview.lockedAdviceCount ?? 9} 条建议未解锁<br/>
            完整报告共 ${preview.totalMentorCount ?? 4} 位导师 · ${preview.totalAdviceCount ?? 12} 条建议
          </div>
          <div class="cred-pills" style="margin-top:10px;">${topics}</div>
          <p style="margin:12px 0 0;color:var(--ink-soft);">${escapeHtml(preview.message || "解锁后查看完整导师建议。")}</p>
        </article>
      `;
    }
  }

  // ===== 读取 localStorage 中已生成的导师建议 =====
  (function renderMentorAdvice() {
    const publicFreeMentor = s.freeMentorAdvice || s.atsResult?.raw?.freeMentorAdvice || s.atsResult?.freeMentorAdvice;
    const lockedPreview = s.lockedAdvicePreview || s.atsResult?.raw?.lockedAdvicePreview || s.atsResult?.lockedAdvicePreview;
    if (publicFreeMentor) {
      renderFreeMentor(publicFreeMentor);
      renderLockedAdvicePreview(lockedPreview);
      return;
    }
    const mentors = s.mentorAdvice;
    if (mentors && mentors.length > 0) {
      console.log("[Mentor] 从 localStorage 读取", mentors.length, "位导师");
      renderFreeMentor(mentors[0]);
      if (mentors.length > 1) renderLockedMentors(mentors.slice(1));
      return;
    }
    console.warn("[Mentor] localStorage 无导师建议");
    document.getElementById("mentorFree").innerHTML = `<p style="color:var(--ink-soft);font-size:14px;padding:16px 0;">暂无导师建议，请返回首页重新提交简历。</p>`;
  })();

  // ===== ATS 评分详情 =====
  if (atsResult && atsResult.atsScore) {
    console.log("[Result] 渲染 ATS 评分详情", atsResult);
    document.getElementById("atsDetailSection").removeAttribute("hidden");

    const items = dimensionRows(atsResult);
    const missingKw = atsResult.topMissingKw || atsResult.raw?.topMissingKw || atsResult.raw?.topMissingKeywords || [];
    const jdMatch = atsResult.jdMatchRatio ?? atsResult.raw?.jdMatchRatio;

    document.getElementById("atsSystemSummary").innerHTML = [
      jdMatch !== null && jdMatch !== undefined ? `<div><b>JD 关键词匹配：</b>${jdMatch}%</div>` : "",
      missingKw.length ? `<div><b>缺口关键词：</b>${missingKw.slice(0, 10).join("、")}</div>` : "",
      atsResult.formatPenaltyTriggered ? `<div style="color:var(--rose);"><b>格式处罚：</b>${(atsResult.formatPenaltyReason || []).join("；")}</div>` : "",
    ].filter(Boolean).join("");

    // 用 ATS System dimensions 覆盖上方 ATS tile
    (function renderAtsDetail() {
      const metrics = buildAtsTileRows(atsResult);

      function barColor(p) {
        return p >= 70 ? "var(--jade, #6abf7b)" : p >= 50 ? "#e9a84c" : "var(--rose, #e07070)";
      }

      document.getElementById("atsDetail").innerHTML = metrics.map(m => `
        <div style="margin-bottom: 12px;">
          <div style="display:flex; justify-content:space-between; align-items:baseline; margin-bottom:4px;">
            <span style="font-size:13px; font-weight:600;">${m.k}</span>
            <span style="font-size:14px; font-weight:700;">${m.v}</span>
          </div>
          <div style="font-size:12px; color: var(--ink-mute); line-height:1.4;">${m.note}</div>
          ${m.v.endsWith("%") ? `
          <div style="background:rgba(0,0,0,.08); border-radius:99px; height:6px; overflow:hidden;">
            <div style="width:${parseInt(m.v, 10) || 0}%; height:100%; border-radius:99px; background:${barColor(parseInt(m.v, 10) || 0)}; transition:width .4s;"></div>
          </div>
          ` : ""}
        </div>
      `).join("");
    })();

    // atsItemScores grid replaced by radar chart above

    const dimensionProblems = atsResult.dimensionProblems || {};
    const dimensionProblemHTML = items
      .map((item) => {
        const list = dimensionProblems[item.key] || [];
        if (!list.length) return "";
        return `
          <details style="border-top:1px dashed var(--line); padding:8px 0;">
            <summary style="cursor:pointer; font-size:13px; font-weight:600; color:var(--ink);">
              ${item.key} · ${item.label} 的具体问题 (${list.length})
            </summary>
            <ul style="list-style:none; padding:8px 0 0; margin:0; font-size:12px; color:var(--ink-soft); line-height:1.5;">
              ${list.slice(0, 8).map((text, index) => `
                <li style="margin-bottom:6px; padding-left:18px; position:relative;">
                  <span style="position:absolute; left:0; color:var(--rose);">${index + 1}.</span>${text}
                </li>
              `).join("")}
            </ul>
          </details>
        `;
      })
      .join("");
    document.getElementById("atsDimensionProblems").innerHTML = dimensionProblemHTML
      ? `<h4 style="font-size:13px; font-weight:600; margin:4px 0 6px; color:var(--ink);">各维度具体问题</h4>${dimensionProblemHTML}`
      : "";

    // 六边形雷达图
    (function renderRadar() {
      const cx = 120, cy = 110, R = 80;
      const dimKeys = ["A","B","C","D","E","F"];
      const dimLabels = {
        A: "格式规范", B: "基本资料", C: "内容质量",
        D: "JD匹配", E: "市场适配", F: "经验匹配"
      };
      const raw = atsResult.raw?.dimensions || atsResult.dimensions || {};
      const dims = dimKeys.map(k => {
        const d = raw[k];
        return d ? { score: d.score, max: d.max, pct: Math.round((d.score / d.max) * 100) } : { score: 0, max: 1, pct: 0 };
      });
      const angle = (i) => (Math.PI / 3) * i - Math.PI / 2;
      const pt = (i, r) => [cx + r * Math.cos(angle(i)), cy + r * Math.sin(angle(i))];

      let svg = "";
      [0.25, 0.5, 0.75, 1].forEach(frac => {
        const pts = dimKeys.map((_, i) => pt(i, R * frac).join(",")).join(" ");
        svg += `<polygon points="${pts}" fill="none" stroke="rgba(0,0,0,.08)" stroke-width="1"/>`;
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
      document.getElementById("atsRadarChart").innerHTML = svg;

      // Total score top-left
      const totalEl = document.getElementById("atsTotalScore");
      if (totalEl) {
        const sc = atsResult.atsScore;
        const scoreColor = sc >= 75 ? "var(--jade,#6abf7b)" : sc >= 55 ? "#e9a84c" : "var(--rose,#e07070)";
        totalEl.innerHTML = `<span style="color:${scoreColor};">${sc}</span><span style="font-size:13px;color:var(--ink-soft);font-weight:500;">/100</span>`;
      }

      // Risk badge with border
      const risk = atsResult.riskLevel || "";
      const riskMap = {
        "低": { label: "低风险", bg: "#d4f0de", color: "#2d7a4a", border: "#2d7a4a" },
        "中": { label: "中风险", bg: "#fde8c8", color: "#b05e00", border: "#b05e00" },
        "高": { label: "高风险", bg: "#fdd8d8", color: "#b02020", border: "#b02020" },
        "low":    { label: "低风险", bg: "#d4f0de", color: "#2d7a4a", border: "#2d7a4a" },
        "medium": { label: "中风险", bg: "#fde8c8", color: "#b05e00", border: "#b05e00" },
        "high":   { label: "高风险", bg: "#fdd8d8", color: "#b02020", border: "#b02020" },
      };
      const r = riskMap[risk] || riskMap[risk?.toLowerCase()] || { label: risk || "风险未知", bg: "#eee", color: "#666", border: "#999" };
      const badge = document.getElementById("atsRiskBadge");
      badge.textContent = r.label;
      badge.style.background = r.bg;
      badge.style.color = r.color;
      badge.style.border = `1.5px solid ${r.border}`;
    })();

    // 关键问题（前3可见，其余blur+锁）
    if (atsResult.keyProblems && atsResult.keyProblems.length > 0) {
      const problems = atsResult.keyProblems.slice(0, 6);
      const problemHTML = problems.map((p, i) => {
        const blur = i >= 3;
        return `
          <li style="margin-bottom:10px;padding-left:20px;position:relative;line-height:1.5;${blur ? "filter:blur(4px);user-select:none;pointer-events:none;" : ""}">
            <span style="position:absolute;left:0;color:var(--rose);font-weight:600;">●</span>
            ${(p || '').trim()}
          </li>`;
      }).join("");
      const hasLocked = problems.length > 3;
      document.getElementById("atsProblems").innerHTML = problemHTML
        + (hasLocked ? `<li style="list-style:none;text-align:center;margin-top:4px;font-size:12px;color:var(--ink-soft);">🔒 解锁查看完整问题列表</li>` : "");
    } else {
      document.getElementById("atsProblems").innerHTML = '<li style="color:var(--ink-soft);">暂无关键问题记录</li>';
    }

    // 优先建议（前3可见，其余blur+锁）
    if (atsResult.suggestions && atsResult.suggestions.length > 0) {
      const suggs = atsResult.suggestions.slice(0, 6);
      const suggestionHTML = suggs.map((s, i) => {
        const blur = i >= 3;
        return `
          <li style="margin-bottom:10px;padding-left:20px;position:relative;line-height:1.5;${blur ? "filter:blur(4px);user-select:none;pointer-events:none;" : ""}">
            <span style="position:absolute;left:0;color:var(--jade);font-weight:600;">✓</span>
            ${(s || '').trim()}
          </li>`;
      }).join("");
      const hasLocked = suggs.length > 3;
      document.getElementById("atsSuggestions").innerHTML = suggestionHTML
        + (hasLocked ? `<li style="list-style:none;text-align:center;margin-top:4px;font-size:12px;color:var(--ink-soft);">🔒 解锁查看完整建议</li>` : "");
    } else {
      document.getElementById("atsSuggestions").innerHTML = '<li style="color:var(--ink-soft);">暂无建议</li>';
    }

    // Chevron toggle for details
    ["atsProblemsDetails", "atsSuggestionsDetails"].forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      const chevId = id === "atsProblemsDetails" ? "atsProblemsChev" : "atsSuggestionsChev";
      el.addEventListener("toggle", () => {
        const chev = document.getElementById(chevId);
        if (chev) chev.style.transform = el.open ? "rotate(0deg)" : "rotate(-90deg)";
      });
    });

  }
