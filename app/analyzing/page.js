'use client';
import Script from 'next/script';

export default function AnalyzingPage() {
  return (
    <>
      <div className="page">
        <div className="brandbar">
          <div className="brand">
            <img src="/logo/MentorX.png" alt="MentorX 蔓藤教育" className="brand-img" />
          </div>
          <div className="brand-meta" style={{fontSize:'10px',letterSpacing:'.08em'}}>分析中…</div>
        </div>

        <header className="analyzing-head fade-in">
          <div className="analyzing-icon"></div>
          <div>
            <h1>AI 智能分析中</h1>
            <p>正在结合导师经验深度分析简历</p>
          </div>
        </header>

        <div className="progress-card fade-in">
          <div className="progress-card-row">
            <div className="left">
              <span className="spinner-ring"></span>
              <span>深度分析中</span>
            </div>
            <div className="right">
              <span>约 20–35 秒</span>
              <span className="pct"><span id="pct">0</span>%</span>
            </div>
          </div>
          <div className="progress-bar">
            <div className="progress-fill-anim" id="progressFill"></div>
          </div>
          <div className="progress-substatus" id="subStatus">正在解析简历内容…</div>
        </div>

        <div className="steps-card fade-in">
          <h3>分析进度</h3>
          <ul className="steps-list" id="stepsList">
            <li data-state="pending">
              <span className="step-icon"></span>
              <div className="step-body"><strong>解析简历</strong><p>提取简历内容、结构与关键信息</p></div>
              <span className="step-status">等待</span>
            </li>
            <li data-state="pending">
              <span className="step-icon"></span>
              <div className="step-body"><strong>匹配导师</strong><p>从 1,300+ 导师经验中筛选最相关背景</p></div>
              <span className="step-status">等待</span>
            </li>
            <li data-state="pending">
              <span className="step-icon"></span>
              <div className="step-body"><strong>ATS 评分</strong><p>评估简历在目标岗位的竞争力与通过率</p></div>
              <span className="step-status">等待</span>
            </li>
            <li data-state="pending">
              <span className="step-icon"></span>
              <div className="step-body"><strong>生成建议</strong><p>结合导师视角输出个性化优化建议</p></div>
              <span className="step-status">等待</span>
            </li>
          </ul>
          <div className="steps-card-foot">
            <span>已用时 <span id="elapsed">0</span>s</span>
            <span>请保持网络连接</span>
          </div>
        </div>
      </div>

      <Script id="analyzing-logic" strategy="afterInteractive">{`
        guardSubmitted();
        const totalSeconds = 16;
        const startedAt = Date.now();
        const pctEl = document.getElementById("pct");
        const fillEl = document.getElementById("progressFill");
        const subStatusEl = document.getElementById("subStatus");
        const elapsedEl = document.getElementById("elapsed");
        const stepEls = document.querySelectorAll("#stepsList li");
        const subStatuses = [
          { from: 0,  text: "正在解析简历内容…" },
          { from: 25, text: "正在评估 ATS 兼容性…" },
          { from: 50, text: "正在匹配导师经验…" },
          { from: 75, text: "正在生成个性化建议…" },
          { from: 92, text: "即将完成…" }
        ];
        const stepBoundaries = [25, 55, 80, 100];
        const tick = setInterval(() => {
          const elapsed = (Date.now() - startedAt) / 1000;
          const pct = Math.min(100, Math.floor((elapsed / totalSeconds) * 100));
          pctEl.textContent = pct;
          fillEl.style.width = pct + "%";
          elapsedEl.textContent = Math.floor(elapsed);
          for (let i = subStatuses.length - 1; i >= 0; i--){
            if (pct >= subStatuses[i].from){ subStatusEl.textContent = subStatuses[i].text; break; }
          }
          stepEls.forEach((li, idx) => {
            const myEnd = stepBoundaries[idx];
            const prevEnd = idx === 0 ? 0 : stepBoundaries[idx - 1];
            const status = li.querySelector(".step-status");
            if (pct >= myEnd){ li.dataset.state = "done"; status.textContent = "完成"; }
            else if (pct >= prevEnd){ li.dataset.state = "active"; status.textContent = "进行中…"; }
            else { li.dataset.state = "pending"; status.textContent = "等待"; }
          });
          if (pct >= 100){ clearInterval(tick); setTimeout(() => { window.location.href = "/result"; }, 700); }
        }, 200);
      `}</Script>
    </>
  );
}
