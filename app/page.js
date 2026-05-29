'use client';
import Script from 'next/script';

export default function HomePage() {
  return (
    <>
      <div className="page">
        <div className="brandbar">
          <div className="brand">
            <img src="/logo/MentorX.png" alt="MentorX 蔓藤教育" className="brand-img" />
          </div>
          <div className="brand-meta" style={{fontSize:'10px',letterSpacing:'.08em'}}>Version: Beta</div>
        </div>

        <section className="hero fade-in">
          <div className="seal"><div className="seal-inner">求职<br/>必胜</div></div>
          <div className="hero-kicker"><span className="dot"></span> 留学求职专属 · 30 秒诊断</div>
          <h1>简历石沉大海?<br/><em>大厂导师 × 智慧核心</em><br/>联合帮你<span className="underline">升级</span>简历。</h1>
          <p className="lede">1,300+ 大厂导师实战经验 × AI 精准分析,30 秒拿到可落地的优化方案。</p>
        </section>

        <section className="section">
          <h2 className="section-title">把简历交给大厂导师</h2>
          <form className="card" onSubmit={(e) => { e.preventDefault(); if (window.submitResume) window.submitResume(e.currentTarget); }} noValidate>
            <div className="input-group">
              <label className="input-label">上传简历</label>
              <label className="file-upload" id="fileUploadLabel">
                <input type="file" name="resume" id="resumeFileInput" accept=".pdf,.doc,.docx,.txt,text/plain" />
                <div className="fu-empty" id="fuEmpty">
                  <div className="fu-icon">📄</div>
                  <div className="fu-main">点击或拖拽上传简历</div>
                  <div className="fu-sub">PDF · Word (.docx/.doc) · 纯文本 (.txt)</div>
                </div>
                <div className="fu-success" id="fuSuccess" style={{display:'none'}}>
                  <div className="fu-icon-done" style={{width:36,height:36,borderRadius:10,background:'rgba(168,213,186,.25)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,fontSize:18}}>📄</div>
                  <div className="fu-info" style={{flex:1,minWidth:0}}>
                    <div className="fu-filename" id="fuFilename" style={{fontWeight:600,fontSize:13,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}></div>
                    <div className="fu-meta" id="fuMeta" style={{fontSize:12,color:'var(--ink-soft)',marginTop:2}}></div>
                  </div>
                  <div style={{display:'flex',alignItems:'center',gap:4,flexShrink:0,fontSize:12,fontWeight:600,color:'var(--jade)'}}>
                    <span style={{width:6,height:6,borderRadius:'50%',background:'var(--jade)',display:'inline-block'}}></span>
                    已上传
                  </div>
                </div>
              </label>
            </div>

            <div className="input-group">
              <label className="input-label">目标岗位 <span className="text-mute" style={{fontWeight:400}}>(与 JD 二选一)</span></label>
              <select className="input" name="job" id="jobSelect" defaultValue="">
                <option value="" disabled>-- 选择目标岗位 --</option>
              </select>
              <span className="input-hint" id="jobSelectHint">加载岗位列表中…</span>
            </div>

            <div className="input-group">
              <label className="input-label">目标岗位 JD <span className="text-mute" style={{fontWeight:400}}>(与目标岗位二选一)</span></label>
              <textarea className="textarea" name="jd" rows="5" placeholder="贴 JD 越完整,诊断越精准…"></textarea>
              <span className="input-hint">支持 LinkedIn / Indeed / Glassdoor / Handshake 等海外 JD</span>
            </div>

            <div className="form-error input-error mb-12"></div>
            <button className="btn btn-jade btn-block" type="submit">
              30 秒生成诊断报告 <span className="btn-icon">→</span>
            </button>
          </form>
        </section>

        <hr className="divider" />

        <section className="section">
          <h2 className="section-title" style={{whiteSpace:'nowrap',fontSize:'clamp(20px,5.6vw,28px)'}}>10 年真实辅导数据,全球独家。</h2>
          <p className="section-desc">蔓藤教育(MentorX)自 2015 年深耕留学求职——<b style={{color:'var(--ink)',fontWeight:700}}>1,300+</b> 大厂导师、<b style={{color:'var(--ink)',fontWeight:700}}>30,000+</b> 场真实辅导。每条建议都从实战中提炼,不是通用模板。</p>
          <div className="philo">
            <article className="philo-card">
              <span className="tag">名企导师</span>
              <div className="num">01</div>
              <h3>导师来自顶级企业</h3>
              <p>Google、Amazon、Goldman Sachs、McKinsey 等全球名企在职导师,覆盖北美、欧洲、中国。</p>
            </article>
            <article className="philo-card">
              <span className="tag">十年数据</span>
              <div className="num">02</div>
              <h3>真实辅导数据驱动</h3>
              <p>每条建议背后是 30,000+ 场真实辅导积累的成功模式,不是 AI 凭空生成。</p>
            </article>
            <article className="philo-card">
              <span className="tag">定制诊断</span>
              <div className="num">03</div>
              <h3>精准匹配你的背景</h3>
              <p>按行业、岗位、背景智能匹配最相关的导师经验,覆盖 CPT/OPT、H-1B 等留学生场景。</p>
            </article>
          </div>
        </section>

        <div className="footnote">
          Powered by <span>Vibe ID</span> · MentorX × 蔓藤教育<br/>
          © 2026 · 不会公开你的简历内容,仅本次诊断使用
        </div>
      </div>

      <Script id="load-positions" strategy="afterInteractive">{`
  (async function loadPositions() {
    const sel  = document.getElementById("jobSelect");
    const hint = document.getElementById("jobSelectHint");
    try {
      const resp = await fetch("/api/positions");
      if (!resp.ok) throw new Error("HTTP " + resp.status);
      const { data } = await resp.json();
      if (!sel || !data) return;
      data.forEach(title => {
        const opt = document.createElement("option");
        opt.value = title;
        opt.textContent = title;
        sel.appendChild(opt);
      });
      if (hint) hint.textContent = "已加载 " + data.length + " 个岗位";
      if (sel) sel.value = "";
    } catch (e) {
      if (hint) hint.textContent = "无法连接服务器";
      if (sel) {
        const txt = document.createElement("input");
        txt.type = "text"; txt.name = "job"; txt.id = "jobSelect"; txt.className = "input";
        txt.placeholder = "例如：Product Manager / Data Analyst";
        sel.parentNode.replaceChild(txt, sel);
      }
    }
  })();
`}</Script>
    </>
  );
}
