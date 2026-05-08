/* =====================================================================
   Resume Fix MVP · 共享 JS
   - 状态: localStorage
   - 跨页跳转
   - 简历报告导出 (.md)
   ===================================================================== */

const STORE_KEY = "resumeFixMVP";
let isSubmitting = false; // 防止重复提交

const Store = {
  get(){
    try {
      const data = localStorage.getItem(STORE_KEY);
      return data ? JSON.parse(data) : {};
    } catch(e) {
      console.error("[Store] 读取失败:", e);
      return {};
    }
  },
  set(patch){
    try {
      const next = { ...this.get(), ...patch };
      const json = JSON.stringify(next);
      localStorage.setItem(STORE_KEY, json);
      console.log("[Store] 保存成功:", next);
      return next;
    } catch(e) {
      console.error("[Store] 保存失败:", e);
      throw new Error("本地存储失败，请检查浏览器设置");
    }
  },
  clear(){
    try {
      localStorage.removeItem(STORE_KEY);
      console.log("[Store] 已清空");
    } catch(e) {
      console.error("[Store] 清空失败:", e);
    }
  }
};

/* —— Loader overlay —— */
function showLoader(text, subtext){
  let overlay = document.querySelector(".loader-overlay");
  if (!overlay){
    overlay = document.createElement("div");
    overlay.className = "loader-overlay";
    overlay.innerHTML = `
      <div class="loader-container">
        <div class="loader-dots"><span></span><span></span><span></span></div>
        <div class="loader-text"></div>
        <div class="loader-subtext"></div>
      </div>
    `;
    document.body.appendChild(overlay);

    // 添加样式
    const style = document.createElement("style");
    style.textContent = `
      .loader-overlay {
        position: fixed;
        inset: 0;
        background: rgba(24, 24, 22, 0.85);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 9999;
        opacity: 0;
        pointer-events: none;
        transition: opacity 0.3s ease;
      }
      .loader-overlay.show {
        opacity: 1;
        pointer-events: auto;
      }
      .loader-container {
        text-align: center;
        color: #f6f3ec;
      }
      .loader-dots {
        display: flex;
        gap: 8px;
        justify-content: center;
        margin-bottom: 20px;
      }
      .loader-dots span {
        width: 12px;
        height: 12px;
        border-radius: 50%;
        background: #a8d5ba;
        animation: bounce 1.4s infinite ease-in-out both;
      }
      .loader-dots span:nth-child(1) { animation-delay: -0.32s; }
      .loader-dots span:nth-child(2) { animation-delay: -0.16s; }
      @keyframes bounce {
        0%, 80%, 100% { transform: scale(0.6); opacity: 0.5; }
        40% { transform: scale(1); opacity: 1; }
      }
      .loader-text {
        font-size: 18px;
        font-weight: 600;
        margin-bottom: 8px;
      }
      .loader-subtext {
        font-size: 14px;
        opacity: 0.75;
      }
    `;
    document.head.appendChild(style);
  }
  overlay.querySelector(".loader-text").textContent = text || "处理中…";
  overlay.querySelector(".loader-subtext").textContent = subtext || "";
  overlay.classList.add("show");
}
function hideLoader(){
  const o = document.querySelector(".loader-overlay");
  if (o) o.classList.remove("show");
}

/* —— Submit resume (home) —— */
async function submitResume(form){
  if (isSubmitting) {
    console.log("[Submit] 已有提交在进行中，忽略本次点击");
    return false;
  }

  const file = form.elements["resume"].files[0];
  const job = form.elements["job"].value.trim();
  const jd  = form.elements["jd"].value.trim();
  const errorBox = form.querySelector(".form-error");
  const submitBtn = form.querySelector('button[type="submit"]');

  console.log("[Submit] 开始提交简历");
  console.log("[Submit] 文件:", file?.name, "岗位:", job);

  if (!file){ errorBox.textContent = "请先上传你的简历文件"; errorBox.classList.add("show"); return false; }
  if (!job){  errorBox.textContent = "目标岗位不能为空"; errorBox.classList.add("show"); return false; }
  // JD 选填:不校验

  errorBox.classList.remove("show");
  isSubmitting = true;
  if (submitBtn) submitBtn.disabled = true;

  try {
    showLoader("准备文件…", "读取简历内容…");
    console.log("[Submit] 开始读取文件...");
    const resumeText = await readResumeFile(file);
    console.log("[Submit] 文件读取成功，长度:", resumeText.length);

    showLoader("正在评分…", "AI 分析中…");
    console.log("[Submit] 开始调用 ATS API...");
    const atsResult = await scoreResumeAPI(resumeText, job, jd);
    console.log("[Submit] ATS 评分完成:", atsResult);

    const formattedResult = formatATSResult(atsResult);

    Store.set({
      resumeName: file.name,
      jobTitle: job,
      jdText: jd,
      resumeText: resumeText,
      atsResult: formattedResult,
      submittedAt: Date.now(),
      isPaid: false
    });

    console.log("[Submit] 数据已保存，准备跳转...");
    showLoader("✓ 完成！", "3 秒后跳转…");
    setTimeout(() => {
      console.log("[Submit] 跳转到 login.html");
      window.location.href = "login.html";
    }, 1200);
  } catch (error) {
    console.error("[Submit Error] 详细信息:", error);
    console.error("[Submit Error] 错误消息:", error.message);
    console.error("[Submit Error] Stack:", error.stack);
    const msg = "❌ " + (error.message || "未知错误");
    errorBox.textContent = msg;
    errorBox.classList.add("show");
    hideLoader();
    toast(msg);
    isSubmitting = false;
    if (submitBtn) submitBtn.disabled = false;
  }

  return false; // prevent default submit
}

/* —— File upload UI —— */
function bindFileUpload(){
  const wrap = document.querySelector(".file-upload");
  if (!wrap) return;
  const input = wrap.querySelector('input[type="file"]');
  const text = wrap.querySelector(".file-upload-text");
  const defaultText = text ? text.textContent : "";
  input.addEventListener("change", () => {
    const f = input.files[0];
    if (f){
      wrap.classList.add("has-file");
      text.textContent = "✓ " + f.name;
    } else {
      wrap.classList.remove("has-file");
      text.textContent = defaultText;
    }
  });
}

/* —— Login mock —— */
function mockLogin(btn){
  btn.disabled = true;
  btn.innerHTML = '<span class="btn-icon" style="background:rgba(255,255,255,.3);">●</span> 登录中…';
  Store.set({ userId: "mock_" + Date.now() });
  setTimeout(() => { window.location.href = "analyzing.html"; }, 800);
}

/* —— Payment mock —— */
function mockPayment(btn){
  btn.disabled = true;
  btn.textContent = "支付确认中…";
  showLoader("正在确认支付…", "解锁全部 4 位导师建议");
  setTimeout(() => {
    Store.set({ isPaid: true, paidAt: Date.now() });
    window.location.href = "report.html";
  }, 1800);
}

/* —— Guard: 没提交简历就别进 result/payment/report —— */
function guardSubmitted(){
  const s = Store.get();
  console.log("[Guard] 检查用户状态:", s);

  if (!s.resumeName || !s.jobTitle){
    console.warn("[Guard] 数据不完整，重定向到首页");
    console.warn("[Guard] resumeName:", s.resumeName);
    console.warn("[Guard] jobTitle:", s.jobTitle);
    window.location.href = "index.html";
  } else {
    console.log("[Guard] ✓ 用户已提交简历，允许继续");
  }
}
function guardPaid(){
  const s = Store.get();
  if (!s.isPaid){
    window.location.href = "result.html";
  }
}

/* —— Report: 拼 Markdown 并下载 —— */
function buildMarkdown(){
  const M = window.MOCK;
  const s = Store.get();
  const target = s.jobTitle || `${M.job.company} · ${M.job.title}`;

  const lines = [];
  lines.push(`# ${M.student.school || "学生"} 简历诊断报告`);
  lines.push("");
  lines.push(`> 目标岗位:**${target}**  `);
  lines.push(`> 生成时间:${M.generatedAt}  `);
  lines.push(`> 来源:MentorX · Powered by Vibe ID`);
  lines.push("");
  lines.push("---");
  lines.push("");
  lines.push("## 一、整体诊断");
  lines.push("");
  lines.push(`- **总评分**:${M.scores.overall}/100(大厂面邀线 ${M.scores.targetScore})`);
  lines.push(`- **ATS 通过率**:${M.scores.ats}%`);
  lines.push(`- **JD 关键词匹配**:${M.scores.keywordMatch}%`);
  lines.push(`- **JD 整体契合度**:${M.scores.jdFit}%`);
  lines.push(`- **同岗位排名**:TOP ${M.scores.rankingPercentile}%`);
  lines.push(`- **岗位竞争**:${M.scores.competitorCount.toLocaleString()} 人投递,录取率 ${M.scores.admitRate}%`);
  lines.push(`- **薪资水平**:当前简历对应 ${M.scores.salaryNow},顶级 Offer 线 ${M.scores.salaryTop}`);
  lines.push("");
  lines.push("**核心问题**:" + M.summary.coreIssue);
  lines.push("");
  lines.push("---");
  lines.push("");

  lines.push("## 二、技能匹配 (JD vs 简历)");
  lines.push("");
  lines.push("| 技能 | 重要度 | 状态 |");
  lines.push("|---|---|---|");
  const statusLabel = { have: "✓ 已具备", weak: "⚠ 需补强", missing: "✕ 缺失" };
  M.skillGap.forEach(s => {
    lines.push(`| ${s.name} | ${s.weight} | ${statusLabel[s.status]} |`);
  });
  lines.push("");
  lines.push("---");
  lines.push("");

  lines.push("## 三、4 位大厂导师建议");
  lines.push("");
  M.mentors.forEach((m, idx) => {
    lines.push(`### 导师 ${idx + 1}:${m.fullName} · ${m.title}`);
    lines.push(`*辅导过 ${m.students} 位学弟学妹 · ${m.tags.join(" / ")}*`);
    lines.push("");
    lines.push(`> ${stripHTML(m.msg)}`);
    lines.push("");
    lines.push("**修改建议**:");
    m.suggestions.forEach((sug, i) => {
      lines.push(`${i + 1}. ${stripHTML(sug)}`);
    });
    lines.push("");
    lines.push("**简历吸睛视角**:");
    lines.push(`> ${stripHTML(m.highlight)}`);
    lines.push("");
    lines.push("---");
    lines.push("");
  });

  lines.push("## 四、Before / After 改写示范");
  lines.push("");
  M.beforeAfter.forEach((ba, i) => {
    lines.push(`### ${i + 1}. ${ba.title}`);
    lines.push("");
    lines.push("**❌ 原版:**");
    ba.before.forEach(t => lines.push(`- ${stripHTML(t)}`));
    lines.push("");
    lines.push("**✓ 改写:**");
    ba.after.forEach(t => lines.push(`- ${stripHTML(t)}`));
    lines.push("");
  });

  lines.push("---");
  lines.push("");
  lines.push("## 使用建议");
  lines.push("");
  lines.push("把这份报告整段复制给 ChatGPT / Claude,然后说:");
  lines.push("");
  lines.push("> 我是 [你的姓名],目标岗位是 [目标岗位]。这是 4 位大厂导师对我简历的诊断。");
  lines.push("> 请基于这些建议,帮我重写简历。我的原始简历内容如下:[粘贴你的简历]");
  lines.push("");
  lines.push("---");
  lines.push("");
  lines.push("*想要 1-on-1 真人导师深度咨询?扫码加客服微信 `mentorx-zhushou`,享 9 折老学员价。*");
  lines.push("");
  lines.push("> By MentorX · 蔓藤教育 · 1300+ 大厂导师 · 30,000+ 一对一辅导");

  return lines.join("\n");
}

function stripHTML(html){
  return String(html).replace(/<[^>]+>/g, "");
}

function exportReport(){
  const md = buildMarkdown();
  const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const fileName = `MentorX-简历诊断报告-${new Date().toISOString().slice(0,10)}.md`;
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast("报告已下载到本地 · " + fileName);
}

function copyReport(){
  const md = buildMarkdown();
  if (navigator.clipboard && navigator.clipboard.writeText){
    navigator.clipboard.writeText(md).then(
      () => toast("已复制完整报告到剪贴板,可直接粘贴给 LLM"),
      () => fallbackCopy(md)
    );
  } else {
    fallbackCopy(md);
  }
}
function fallbackCopy(text){
  const ta = document.createElement("textarea");
  ta.value = text; document.body.appendChild(ta);
  ta.select();
  try { document.execCommand("copy"); toast("已复制到剪贴板"); }
  catch(e){ toast("复制失败,请手动选择下载 .md 文件"); }
  document.body.removeChild(ta);
}

/* —— Tiny toast —— */
function toast(msg){
  let t = document.querySelector(".__toast");
  if (!t){
    t = document.createElement("div");
    t.className = "__toast";
    t.style.cssText = `
      position: fixed; left: 50%; bottom: 96px;
      transform: translateX(-50%);
      background: var(--ink); color: var(--paper-warm);
      padding: 12px 18px; border-radius: 999px;
      font-size: 13px; font-weight: 500;
      box-shadow: var(--shadow-pop);
      z-index: 200;
      max-width: 90vw; text-align: center;
      opacity: 0; transition: opacity .2s ease;
      pointer-events: none;
    `;
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.style.opacity = "1";
  clearTimeout(t.__hide);
  t.__hide = setTimeout(() => { t.style.opacity = "0"; }, 2400);
}

/* Auto-init */
document.addEventListener("DOMContentLoaded", () => {
  console.log("[App] 页面加载完成，绑定事件");
  bindFileUpload();

  // 调试：确保 submitResume 可用
  if (typeof submitResume === "function") {
    console.log("[App] ✓ submitResume 函数已加载");
  } else {
    console.error("[App] ❌ submitResume 函数未定义！");
  }

  // 调试：监听表单和按钮
  const form = document.querySelector("form");
  if (form) {
    console.log("[App] ✓ 表单已找到");

    // 在表单上监听
    form.addEventListener("submit", (e) => {
      console.log("[App] [Form] submit 事件触发");
    });

    // 在按钮上监听
    const submitBtn = form.querySelector('button[type="submit"]');
    if (submitBtn) {
      console.log("[App] ✓ 提交按钮已找到");
      submitBtn.addEventListener("click", (e) => {
        console.log("[App] [Button] click 事件触发");
      });
    } else {
      console.error("[App] ❌ 找不到提交按钮");
    }
  } else {
    console.error("[App] ❌ 找不到表单");
  }
});
