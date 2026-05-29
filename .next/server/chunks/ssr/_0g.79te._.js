module.exports=[47283,(a,b,c)=>{b.exports=a.r(96665)},90408,a=>{"use strict";var b=a.i(87924),c=a.i(47283);a.s(["default",0,function(){return(0,b.jsxs)(b.Fragment,{children:[(0,b.jsxs)("div",{className:"page",children:[(0,b.jsxs)("div",{className:"brandbar",children:[(0,b.jsx)("div",{className:"brand",children:(0,b.jsx)("img",{src:"/logo/cropped-cropped-WechatIMG231-1.png",alt:"MentorX 蔓藤教育",className:"brand-img"})}),(0,b.jsx)("div",{className:"brand-meta",style:{fontSize:"10px",letterSpacing:".08em"},children:"分析中…"})]}),(0,b.jsxs)("header",{className:"analyzing-head fade-in",children:[(0,b.jsx)("div",{className:"analyzing-icon"}),(0,b.jsxs)("div",{children:[(0,b.jsx)("h1",{children:"AI 智能分析中"}),(0,b.jsx)("p",{children:"正在结合导师经验深度分析简历"})]})]}),(0,b.jsxs)("div",{className:"progress-card fade-in",children:[(0,b.jsxs)("div",{className:"progress-card-row",children:[(0,b.jsxs)("div",{className:"left",children:[(0,b.jsx)("span",{className:"spinner-ring"}),(0,b.jsx)("span",{children:"深度分析中"})]}),(0,b.jsxs)("div",{className:"right",children:[(0,b.jsx)("span",{children:"约 20–35 秒"}),(0,b.jsxs)("span",{className:"pct",children:[(0,b.jsx)("span",{id:"pct",children:"0"}),"%"]})]})]}),(0,b.jsx)("div",{className:"progress-bar",children:(0,b.jsx)("div",{className:"progress-fill-anim",id:"progressFill"})}),(0,b.jsx)("div",{className:"progress-substatus",id:"subStatus",children:"正在解析简历内容…"})]}),(0,b.jsxs)("div",{className:"steps-card fade-in",children:[(0,b.jsx)("h3",{children:"分析进度"}),(0,b.jsxs)("ul",{className:"steps-list",id:"stepsList",children:[(0,b.jsxs)("li",{"data-state":"pending",children:[(0,b.jsx)("span",{className:"step-icon"}),(0,b.jsxs)("div",{className:"step-body",children:[(0,b.jsx)("strong",{children:"解析简历"}),(0,b.jsx)("p",{children:"提取简历内容、结构与关键信息"})]}),(0,b.jsx)("span",{className:"step-status",children:"等待"})]}),(0,b.jsxs)("li",{"data-state":"pending",children:[(0,b.jsx)("span",{className:"step-icon"}),(0,b.jsxs)("div",{className:"step-body",children:[(0,b.jsx)("strong",{children:"匹配导师"}),(0,b.jsx)("p",{children:"从 1,300+ 导师经验中筛选最相关背景"})]}),(0,b.jsx)("span",{className:"step-status",children:"等待"})]}),(0,b.jsxs)("li",{"data-state":"pending",children:[(0,b.jsx)("span",{className:"step-icon"}),(0,b.jsxs)("div",{className:"step-body",children:[(0,b.jsx)("strong",{children:"ATS 评分"}),(0,b.jsx)("p",{children:"评估简历在目标岗位的竞争力与通过率"})]}),(0,b.jsx)("span",{className:"step-status",children:"等待"})]}),(0,b.jsxs)("li",{"data-state":"pending",children:[(0,b.jsx)("span",{className:"step-icon"}),(0,b.jsxs)("div",{className:"step-body",children:[(0,b.jsx)("strong",{children:"生成建议"}),(0,b.jsx)("p",{children:"结合导师视角输出个性化优化建议"})]}),(0,b.jsx)("span",{className:"step-status",children:"等待"})]})]}),(0,b.jsxs)("div",{className:"steps-card-foot",children:[(0,b.jsxs)("span",{children:["已用时 ",(0,b.jsx)("span",{id:"elapsed",children:"0"}),"s"]}),(0,b.jsx)("span",{children:"请保持网络连接"})]})]})]}),(0,b.jsx)(c.default,{src:"/assets/app.js",strategy:"beforeInteractive"}),(0,b.jsx)(c.default,{id:"analyzing-logic",strategy:"afterInteractive",children:`
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
      `})]})}])}];

//# sourceMappingURL=_0g.79te._.js.map