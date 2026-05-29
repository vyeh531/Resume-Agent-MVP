const STORE_KEY = "resumeFixMVP";
// NOTE: API_BASE is declared in api-client.js (loaded before this file)
let isSubmitting = false;

const Store = {
  get() {
    try { return JSON.parse(localStorage.getItem(STORE_KEY) || "{}"); }
    catch(e) { return {}; }
  },
  set(patch) {
    try {
      const next = { ...this.get(), ...patch };
      localStorage.setItem(STORE_KEY, JSON.stringify(next));
      return next;
    } catch(e) { throw new Error("localStorage failed"); }
  },
  clear() { try { localStorage.removeItem(STORE_KEY); } catch(e) {} }
};
window.Store = Store;

function showLoader(text, subtext) {
  let o = document.querySelector(".loader-overlay");
  if (!o) {
    o = document.createElement("div");
    o.className = "loader-overlay";
    o.innerHTML = '<div class="loader-container"><div class="loader-dots"><span></span><span></span><span></span></div><div class="loader-text"></div><div class="loader-subtext"></div></div>';
    document.body.appendChild(o);
    const s = document.createElement("style");
    s.textContent = ".loader-overlay{position:fixed;inset:0;background:rgba(24,24,22,.88);display:flex;align-items:center;justify-content:center;z-index:9999;opacity:0;pointer-events:none;transition:opacity .3s}.loader-overlay.show{opacity:1;pointer-events:auto}.loader-container{text-align:center;color:#f6f3ec;padding:0 24px}.loader-dots{display:flex;gap:8px;justify-content:center;margin-bottom:20px}.loader-dots span{width:12px;height:12px;border-radius:50%;background:#a8d5ba;animation:ldBounce 1.4s infinite ease-in-out both}.loader-dots span:nth-child(1){animation-delay:-.32s}.loader-dots span:nth-child(2){animation-delay:-.16s}@keyframes ldBounce{0%,80%,100%{transform:scale(.6);opacity:.5}40%{transform:scale(1);opacity:1}}.loader-text{font-size:18px;font-weight:600;margin-bottom:8px}.loader-subtext{font-size:14px;opacity:.7}";
    document.head.appendChild(s);
  }
  o.querySelector(".loader-text").textContent    = text    || "";
  o.querySelector(".loader-subtext").textContent = subtext || "";
  o.classList.add("show");
}
function hideLoader() {
  const o = document.querySelector(".loader-overlay");
  if (o) o.classList.remove("show");
}

async function submitResume(form) {
  if (isSubmitting) return false;
  const file     = form.elements["resume"].files[0];
  const job      = form.elements["job"].value.trim();
  const jd       = form.elements["jd"].value.trim();
  const errorBox = form.querySelector(".form-error");
  const btn      = form.querySelector('button[type="submit"]');
  if (!file) { errorBox.textContent = "请先上传你的简历文件"; errorBox.classList.add("show"); return false; }
  if (!job && !jd) { errorBox.textContent = "请填写目标岗位或粘贴目标岗位 JD，二选一即可"; errorBox.classList.add("show"); return false; }
  errorBox.classList.remove("show");
  isSubmitting = true;
  if (btn) btn.disabled = true;
  try {
    showLoader("准备文件…", "读取简历内容…");
    const resumeText = await readResumeFile(file);
    showLoader("正在分析简历…", "导师正在读取你的简历内容");
    const atsRaw    = await scoreResumeAPI(resumeText, job || null, jd);
    const atsResult = formatATSResult(atsRaw);
    const targetJob = job || atsRaw.jobTitle || "目标岗位";
    Store.set({
      resumeName: file.name,
      jobTitle: targetJob,
      targetLabel: targetJob,
      jdText: jd,
      resumeText,
      atsResult,
      freeMentorAdvice: atsRaw.freeMentorAdvice || null,
      lockedAdvicePreview: atsRaw.lockedAdvicePreview || null,
      premiumMentors: atsRaw.premiumMentors || null,
      submittedAt: Date.now(),
      isPaid: false,
      mentorAdvice: null
    });
    showLoader("诊断完成！", "已匹配免费导师建议，正在跳转报告页面…");
    setTimeout(() => { window.location.href = "/login"; }, 800);
  } catch(err) {
    errorBox.textContent = "❌ " + (err.message || "未知错误");
    errorBox.classList.add("show");
    hideLoader();
    isSubmitting = false;
    if (btn) btn.disabled = false;
  }
  return false;
}

function bindFileUpload() {
  const wrap = document.querySelector(".file-upload");
  if (!wrap) return;
  const input   = wrap.querySelector('input[type="file"]');
  const empty   = document.getElementById("fuEmpty");
  const success = document.getElementById("fuSuccess");
  const fnEl    = document.getElementById("fuFilename");
  const metaEl  = document.getElementById("fuMeta");
  function fmtBytes(b) {
    if (b < 1024)    return b + " B";
    if (b < 1048576) return (b/1024).toFixed(1) + " KB";
    return (b/1048576).toFixed(1) + " MB";
  }
  input.addEventListener("change", () => {
    const f = input.files[0];
    if (f) {
      wrap.classList.add("has-file");
      const ext = f.name.split(".").pop().toUpperCase();
      if (fnEl)   fnEl.textContent   = f.name;
      if (metaEl) metaEl.textContent = ext + " · " + fmtBytes(f.size);
      if (empty)   empty.style.display   = "none";
      if (success) success.style.display = "flex";
    } else {
      wrap.classList.remove("has-file");
      if (empty)   empty.style.display   = "";
      if (success) success.style.display = "none";
    }
  });
}

function mockLogin(btn) {
  btn.disabled = true;
  Store.set({ userId: "mock_" + Date.now() });
  setTimeout(() => { window.location.href = "/result"; }, 800);
}
function mockPayment(btn) {
  btn.disabled = true;
  showLoader("正在确认支付…", "解锁全部 4 位导师建议");
  setTimeout(() => { Store.set({ isPaid: true, paidAt: Date.now() }); window.location.href = "/report"; }, 1800);
}

function guardSubmitted() {
  const s = Store.get();
  if (!s.resumeName || !s.jobTitle) window.location.href = "/";
}
function guardPaid() {
  const s = Store.get();
  if (!s.isPaid) window.location.href = "/result";
}

function buildMarkdown() {
  const M = window.MOCK || {};
  const s = Store.get();
  const sc = M.scores || {};
  const st = M.student || {};
  const lines = [];
  lines.push("# " + (st.school || "Resume") + " Diagnosis");
  lines.push("> Target: **" + (s.jobTitle || "") + "**");
  lines.push("> Source: MentorX x Vibe ID");
  lines.push("");
  lines.push("## ATS Score");
  lines.push("- ATS: " + (sc.ats || "N/A") + "%");
  lines.push("- Ranking: TOP " + (sc.rankingPercentile || "N/A") + "%");
  lines.push("- Salary: " + (sc.salaryNow || "N/A") + " ~ " + (sc.salaryTop || "N/A"));
  return lines.join("\n");
}
function stripHTML(html) { return String(html).replace(/<[^>]+>/g, ""); }
function exportReport() {
  const md = buildMarkdown();
  const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "MentorX-" + new Date().toISOString().slice(0,10) + ".md";
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast("Report downloaded");
}
function copyReport() {
  const md = buildMarkdown();
  if (navigator.clipboard) navigator.clipboard.writeText(md).then(() => toast("Copied"));
}

function toast(msg) {
  let t = document.querySelector(".__toast");
  if (!t) {
    t = document.createElement("div");
    t.className = "__toast";
    t.style.cssText = "position:fixed;left:50%;bottom:96px;transform:translateX(-50%);background:var(--ink);color:var(--paper-warm);padding:12px 18px;border-radius:999px;font-size:13px;font-weight:500;z-index:200;max-width:90vw;text-align:center;opacity:0;transition:opacity .2s;pointer-events:none;";
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.style.opacity = "1";
  clearTimeout(t.__hide);
  t.__hide = setTimeout(() => { t.style.opacity = "0"; }, 2400);
}

function initPage() {
  bindFileUpload();
  console.log("[App] ready");
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initPage);
} else {
  initPage();
}
