'use client';
import Script from 'next/script';

export default function LoginPage() {
  return (
    <>
      <style>{`
        .login-wrap{display:flex;flex-direction:column;min-height:80vh;justify-content:center;align-items:stretch}
        .wechat-icon{width:88px;height:88px;margin:0 auto 22px;background:linear-gradient(135deg,#07c160,#2f6b4f);border-radius:24px;display:grid;place-items:center;color:#fff;font-family:var(--serif);font-weight:700;font-size:44px;box-shadow:0 18px 32px -12px rgba(7,193,96,.45);position:relative}
        .wechat-icon::after{content:"";position:absolute;inset:-3px;border-radius:26px;border:2px solid rgba(255,255,255,.9);pointer-events:none}
        .login-title{font-family:var(--serif);font-weight:700;font-size:26px;line-height:1.2;text-align:center;letter-spacing:-.015em;margin:0 0 8px}
        .login-sub{text-align:center;color:var(--ink-soft);font-size:14px;margin:0 0 28px}
        .login-progress{display:flex;gap:6px;justify-content:center;margin-bottom:24px}
        .login-progress span{width:24px;height:4px;border-radius:2px;background:var(--paper-deep)}
        .login-progress span.active{background:var(--jade)}
        .login-resume-mini{background:var(--paper-warm);border:1px solid var(--line);border-radius:var(--r-md);padding:14px 16px;margin-bottom:22px;display:flex;align-items:center;gap:12px}
        .login-resume-mini .icon{width:36px;height:36px;border-radius:8px;background:var(--jade-soft);color:var(--jade);display:grid;place-items:center;font-size:16px;flex-shrink:0}
        .login-resume-mini .info{flex:1;min-width:0}
        .login-resume-mini .name{font-weight:600;font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        .login-resume-mini .meta{font-size:11px;color:var(--ink-mute);margin-top:2px}
        .login-foot{text-align:center;margin-top:18px;font-size:11px;color:var(--ink-mute);line-height:1.7}
        .login-foot a{color:var(--ink-soft);text-decoration:underline;text-decoration-style:dotted}
        .login-tip{background:var(--jade-soft);border:1px solid #b8d6bd;border-radius:var(--r-md);padding:12px 14px;font-size:13px;color:var(--jade);margin-top:22px;display:flex;align-items:flex-start;gap:8px;line-height:1.5}
      `}</style>

      <div className="page">
        <div className="brandbar">
          <div className="brand">
            <img src="/logo/MentorX.png" alt="MentorX 蔓藤教育" className="brand-img" />
          </div>
          <div className="brand-meta" style={{fontSize:'10px',letterSpacing:'.08em'}}>2 / 5</div>
        </div>

        <div className="login-wrap fade-in">
          <div className="login-progress">
            <span className="active"></span>
            <span className="active"></span>
            <span></span>
            <span></span>
            <span></span>
          </div>
          <div className="wechat-icon">微</div>
          <h1 className="login-title">最后一步,登录领报告</h1>
          <p className="login-sub">用微信登录,3 秒到诊断结果</p>

          <div className="login-resume-mini" id="resumeMini">
            <div className="icon">📄</div>
            <div className="info">
              <div className="name" id="resumeFileName">简历加载中…</div>
              <div className="meta" id="resumeJobTitle">目标岗位</div>
            </div>
            <span className="pill pill-jade"><span className="dot"></span>已分析</span>
          </div>

          <button className="btn btn-jade btn-block" onClick={(e) => window.mockLogin && window.mockLogin(e.currentTarget)}>
            <span style={{fontSize:'18px'}}>微</span> 微信一键登录
          </button>

          <div className="login-tip">
            <span style={{flexShrink:0}}>🔒</span>
            <span>我们不会公开你的简历,所有内容仅用于本次诊断。</span>
          </div>

          <div className="login-foot">
            登录代表你同意 <a href="#">《用户协议》</a> 和 <a href="#">《隐私政策》</a><br/>
            遇到问题?联系客服 <span style={{color:'var(--rose)'}}>mentorx-zhushou</span>
          </div>
        </div>
      </div>

      <Script id="login-logic" strategy="afterInteractive">{`
        (function(){
          const s = JSON.parse(localStorage.getItem("resumeFixMVP") || "{}");
          if (s.resumeName) document.getElementById("resumeFileName").textContent = s.resumeName;
          else document.getElementById("resumeFileName").textContent = "(未检测到简历,请回到首页上传)";
          if (s.jobTitle) document.getElementById("resumeJobTitle").textContent = "目标岗位:" + s.jobTitle;
        })();
        window.mockLogin = function(btn){
          btn.disabled = true;
          showLoader("正在登录…", "3 秒即将跳转…");
          Store.set({ userId: "mock_" + Date.now(), loginAt: Date.now() });
          setTimeout(() => { hideLoader(); window.location.href = "/result"; }, 800);
        };
      `}</Script>
    </>
  );
}
