'use client';
import Script from 'next/script';

export default function ReportPage() {
  return (
    <>
      <style>{`
        .report-headline{font-family:var(--serif);font-weight:700;font-size:22px;line-height:1.4;margin:8px 0 8px;letter-spacing:-0.01em;}
        .report-headline .num{font-style:italic;color:var(--indigo);font-size:32px;}
        .report-headline .gap{font-style:italic;color:var(--rose);font-weight:700;}
        .report-issue{font-size:14px;color:var(--ink-soft);line-height:1.6;border-left:3px solid var(--apricot);padding:4px 0 4px 12px;margin:12px 0 0;}
        .export-card{background:linear-gradient(135deg,var(--paper-warm) 0%,var(--jade-soft) 100%);border:1px solid #b8d6bd;border-radius:var(--r-lg);padding:18px 18px 16px;margin:0 0 22px;position:relative;overflow:hidden;box-shadow:var(--shadow-soft);}
        .export-card::before{content:"";position:absolute;right:-30px;top:-30px;width:120px;height:120px;background:radial-gradient(circle,rgba(47,107,79,.18) 0%,transparent 70%);pointer-events:none;}
        .export-card-head{display:flex;align-items:center;gap:10px;margin-bottom:8px;position:relative;}
        .export-card-icon{width:36px;height:36px;border-radius:10px;background:var(--ink);color:var(--paper-warm);display:grid;place-items:center;font-size:16px;flex-shrink:0;}
        .export-card-title{font-family:var(--serif);font-weight:700;font-size:17px;line-height:1.2;}
        .export-card-format-tag{display:inline-block;background:var(--ink);color:var(--paper-warm);font-family:var(--mono);font-size:10px;letter-spacing:.06em;padding:2px 8px;border-radius:6px;margin-left:6px;vertical-align:2px;}
        .export-card-desc{font-size:13px;color:var(--ink);margin:0 0 12px;line-height:1.6;position:relative;font-weight:500;}
        .export-card-perks{list-style:none;padding:0;margin:0 0 16px;display:flex;flex-direction:column;gap:7px;position:relative;}
        .export-card-perks li{display:flex;align-items:center;gap:8px;font-size:13px;font-weight:600;color:var(--ink);line-height:1.4;}
        .export-card-perks .check{width:18px;height:18px;border-radius:50%;background:var(--jade);color:#fff;display:grid;place-items:center;font-size:10px;font-weight:700;flex-shrink:0;}
        .ai-insight{margin:14px 0 16px;padding:14px 16px;background:linear-gradient(135deg,var(--jade-soft) 0%,var(--paper-warm) 100%);border:1px solid #b8d6bd;border-radius:var(--r-md);}
        .ai-insight-diagnosis{font-size:13px;line-height:1.65;color:var(--ink);margin:0;font-weight:500;}
        .ai-insight-diagnosis .ico{margin-right:4px;font-size:15px;}
        .ai-insight-diagnosis b{color:var(--terracotta);font-weight:700;}
        .skill-list{list-style:none;padding:0;margin:0;}
        .skill-row{display:flex;justify-content:space-between;align-items:center;padding:12px 0;border-bottom:1px dashed var(--line);gap:10px;}
        .skill-row:last-child{border-bottom:none;}
        .skill-name{font-size:14px;font-weight:500;}
        .skill-name .priority{font-family:var(--mono);font-size:10px;color:var(--ink-mute);margin-right:8px;}
        .service-card{background:linear-gradient(135deg,var(--paper-warm) 0%,var(--paper-deep) 100%);border:1px solid var(--line);border-radius:var(--r-lg);padding:26px 22px 22px;margin-top:12px;position:relative;overflow:hidden;}
        .service-card::before{content:"";position:absolute;left:-40px;bottom:-40px;width:140px;height:140px;background:radial-gradient(circle,rgba(232,160,107,.22) 0%,transparent 70%);pointer-events:none;}
        .service-card-title{font-family:var(--serif);font-weight:700;font-size:22px;line-height:1.3;text-align:center;margin:0 0 8px;position:relative;letter-spacing:-0.01em;}
        .service-card-title em{color:var(--terracotta);font-style:italic;}
        .service-card-sub{font-size:14px;color:var(--ink-soft);text-align:center;margin:0 0 22px;line-height:1.55;position:relative;}
        .service-list{list-style:none;padding:0;margin:0 0 20px;display:flex;flex-direction:column;gap:10px;position:relative;}
        .service-list li{background:var(--paper-warm);border:1px solid var(--line);border-radius:var(--r-md);padding:14px 16px 14px 50px;position:relative;font-size:13px;line-height:1.5;}
        .service-list li strong{display:block;font-size:14px;color:var(--ink);margin-bottom:2px;}
        .service-list li span{color:var(--ink-soft);}
        .service-list .num-badge{position:absolute;left:14px;top:50%;transform:translateY(-50%);width:26px;height:26px;border-radius:50%;background:var(--terracotta);color:#fff;display:grid;place-items:center;font-family:var(--serif);font-style:italic;font-weight:700;font-size:13px;}
        .service-cta-block{background:var(--paper-warm);border:1px dashed var(--rose);border-radius:var(--r-md);padding:18px 16px;text-align:center;margin-bottom:10px;position:relative;}
        .service-handle{font-family:var(--mono);font-size:12px;color:var(--ink);font-weight:600;margin-top:6px;}
        .service-cta-text{font-size:13px;color:var(--ink);font-weight:600;margin-bottom:4px;}
        .service-foot{font-size:11px;color:var(--ink-mute);text-align:center;line-height:1.6;position:relative;}
        body.exporting .banner, body.exporting .export-card, body.exporting .footnote{display:none!important;}
        body.exporting .page{box-shadow:none!important;border:none!important;margin:0 auto!important;}
      `}</style>

      <div className="page">
        <div className="brandbar">
          <div className="brand">
            <img src="/logo/MentorX.png" alt="MentorX 蔓藤教育" className="brand-img" />
          </div>
          <div className="brand-meta" style={{fontSize:'10px',letterSpacing:'.08em'}}>完整报告</div>
        </div>

        <div className="banner fade-in">
          <div className="banner-check">✓</div>
          <div>已解锁 · 完整报告已为你生成</div>
        </div>

        <div className="export-card">
          <div className="export-card-head">
            <div className="export-card-icon">📄</div>
            <div>
              <div className="export-card-title">完整诊断报告<span className="export-card-format-tag">PDF</span></div>
            </div>
          </div>
          <p className="export-card-desc">把这份 PDF 整段喂给 <b>ChatGPT / Claude / 豆包</b> 等任意 LLM，基于 4 位大厂导师建议<b>自动重写你的简历</b>——不用一句句改，一键产出可投递的新版本。</p>
          <ul className="export-card-perks">
            <li><span className="check">✓</span><span>ATS 通过率 <b>+30%</b>，自动匹配 JD 关键词</span></li>
            <li><span className="check">✓</span><span>面试邀约率 <b>翻倍</b>，简历讲对 PM 的语言</span></li>
            <li><span className="check">✓</span><span>1 份报告反复用，投每个公司都能精准对齐</span></li>
          </ul>
          <button className="btn btn-jade btn-block" onClick={() => window.exportPDF && window.exportPDF()}>
            ⬇ 下载 PDF 报告
          </button>
        </div>

        <section className="section" id="summary">
          <div className="section-num">01 · 整体诊断</div>
          <h2 className="section-title" style={{fontSize:'22px'}}>先看大盘</h2>
          <div className="card card-tight">
            <h3 className="report-headline">
              你的当前简历综合评分 <span className="num">75</span> 分，离获得大厂 <span className="gap">$200K</span> 薪资仍有差距。
            </h3>
            <p className="report-issue" id="coreIssue"></p>
          </div>
          <div className="card card-tight mt-16">
            <div className="section-num" style={{marginBottom:6}}>JD Top 10 技能匹配</div>
            <div className="ai-insight">
              <p className="ai-insight-diagnosis">
                <span className="ico">💡</span>正在加载技能匹配数据…
              </p>
            </div>
            <ul className="skill-list" id="skillList"></ul>
          </div>
        </section>

        <hr className="divider" />

        <section className="section" id="atsDetailSection">
          <div className="section-num">02 · ATS 诊断</div>
          <h2 className="section-title" style={{fontSize:'22px'}}>系统评分详情</h2>
          <div className="card card-tight">
            <div id="atsDimGrid" style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10,marginBottom:16}}></div>
            <div id="atsKeywordSection" style={{marginBottom:14}}></div>
            <div id="atsProblemsSection"></div>
          </div>
        </section>

        <hr className="divider" />

        <section className="section" id="mentors">
          <div className="section-num">03 · 4 位大厂导师建议</div>
          <h2 className="section-title" style={{fontSize:'22px'}}>每个角度都有人帮你看过了</h2>
          <div id="mentorsList"></div>
        </section>

        <hr className="divider" />

        <section className="section" id="service">
          <div className="section-num">04 · 升级服务</div>
          <h2 className="section-title" style={{fontSize:'22px'}}>想走得更远?</h2>
          <div className="service-card">
            <h3 className="service-card-title">加 1 位<em>求职导师</em>，<br/>享端到端专业服务</h3>
            <p className="service-card-sub">从简历到 Offer，一路有人陪。<br/>真人大厂在职导师，匹配你的目标公司 / 岗位 / 学校背景。</p>
            <ul className="service-list">
              <li><span className="num-badge">1</span><strong>求职策略 1v1</strong><span>定位 + 投递时间线 + 公司清单 + 风险评估</span></li>
              <li><span className="num-badge">2</span><strong>简历精修</strong><span>项目级深度改写，逐句对照 JD 优化</span></li>
              <li><span className="num-badge">3</span><strong>模拟面试</strong><span>语音 / 视频实战，高频问题穿透，即时点评</span></li>
              <li><span className="num-badge">4</span><strong>Offer 谈薪</strong><span>多 Offer 取舍 + HR 报价 counter 话术</span></li>
            </ul>
            <div className="service-cta-block">
              <div className="service-cta-text">扫码添加专属求职导师</div>
              <div className="service-handle">客服微信：<b>mentorx-zhushou</b></div>
            </div>
            <div className="service-foot">老学员 9 折优惠 · 不满意 7 天内全额退款 · 支持月度陪跑套餐</div>
          </div>
        </section>

        <div className="footnote">
          报告由 MentorX × AI 联合生成 · 内容仅供参考，不构成 Offer 承诺<br/>
          Powered by <span>Vibe ID</span> · 蔓藤教育 · 2015 至今 · 1,300+ 大厂导师
        </div>
      </div>

      <Script src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js" strategy="lazyOnload" />
      <Script src="/report-logic.js" strategy="afterInteractive" />
    </>
  );
}
