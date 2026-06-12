window.Store = window.Store || {
  get() { try { return JSON.parse(localStorage.getItem("resumeFixMVP") || "{}"); } catch { return {}; } }
};

if (typeof guardSubmitted === 'function') {
  guardSubmitted();
} else {
  const s0 = window.Store.get();
  if (!s0.resumeName) { window.location.href = "/"; }
}

const s = window.Store.get();
const atsResult = s.atsResult || {};
if (s.reportId && s.reportAccessToken && (!s.premiumKeywordBreakdown || !s.premiumAdviceItems || !Array.isArray(s.companyInsiderTips) || s.companyInsiderTips.length < 1)) {
  fetch(`/api/v1/reports/${encodeURIComponent(s.reportId)}/unlock`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reportAccessToken: s.reportAccessToken }),
  })
    .then((res) => res.ok ? res.json() : null)
    .then((data) => {
      const premiumReport = data?.premiumReport;
      if (!premiumReport) return;
      window.Store.set({
        premiumMentors: premiumReport.mentors || null,
        premiumAdviceItems: premiumReport.allAdviceItems || null,
        premiumKeywordBreakdown: premiumReport.keywordBreakdown || null,
        missingKeywordChecklist: premiumReport.missingKeywordChecklist || null,
        sectionFixPlan: premiumReport.sectionFixPlan || null,
        problemTags: premiumReport.problemTags || null,
        detailedSuggestions: premiumReport.detailedSuggestions || null,
        mentorLogoPool: premiumReport.mentorLogoPool || s.mentorLogoPool || null,
        companyInsiderTips: premiumReport.companyInsiderTips || [],
      });
      window.location.reload();
    })
    .catch(() => {});
}
const mentorsSection = document.getElementById("mentors");
if (mentorsSection) {
  const num = mentorsSection.querySelector(".section-num");
  const title = mentorsSection.querySelector(".section-title");
  if (num) num.textContent = "04 · 完整导师建议";
  if (title) title.textContent = "按你的简历问题优先匹配";
}

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
const STATIC_MENTOR_COMPANY_LOGOS = [
  { company: "Amazon", companyLogo: "/logos/Amazon.png" },
  { company: "Amazon Web Services", companyLogo: "/logos/Amazon Web Services, Inc.png" },
  { company: "Google", companyLogo: "/logos/google.png" },
  { company: "Meta", companyLogo: "/logos/Meta.png" },
  { company: "Microsoft", companyLogo: "/logos/Microsoft.png" },
  { company: "Apple", companyLogo: "/logos/Apple.png" },
  { company: "NVIDIA", companyLogo: "/logos/NVIDIA.png" },
  { company: "Intel", companyLogo: "/logos/Intel.png" },
  { company: "Qualcomm", companyLogo: "/logos/Qualcomm.png" },
  { company: "Cisco", companyLogo: "/logos/Cisco.png" },
  { company: "IBM", companyLogo: "/logos/IBM.jpg" },
  { company: "Oracle", companyLogo: "/logos/Oracle.png" },
  { company: "Salesforce", companyLogo: "/logos/Salesforce.png" },
  { company: "Adobe", companyLogo: "/logos/Adobe.png" },
  { company: "Intuit", companyLogo: "/logos/Intuit.png" },
  { company: "Snowflake", companyLogo: "/logos/Snowflake.png" },
  { company: "Spotify", companyLogo: "/logos/Spotify.png" },
  { company: "Uber", companyLogo: "/logos/Uber.jpg" },
  { company: "Robinhood", companyLogo: "/logos/Robinhood.png" },
  { company: "OpenAI", companyLogo: "/logos/OpenAI.png" },
  { company: "ByteDance", companyLogo: "/logos/ByteDance.png" },
  { company: "TikTok", companyLogo: "/logos/Tiktok.png" },
  { company: "SAP", companyLogo: "/logos/SAP.png" },
  { company: "Goldman Sachs", companyLogo: "/logos/Goldman Sachs.png" },
  { company: "JPMorgan Chase", companyLogo: "/logos/JPMorganChase.png" },
  { company: "Morgan Stanley", companyLogo: "/logos/Morgan Stanley.png" },
  { company: "BlackRock", companyLogo: "/logos/BlackRock.png" },
  { company: "Capital One", companyLogo: "/logos/Capital One.png" },
  { company: "Bank of America", companyLogo: "/logos/Bank of America.png" },
  { company: "Citigroup", companyLogo: "/logos/Citigroup.png" },
  { company: "American Express", companyLogo: "/logos/American Express.png" },
  { company: "State Street", companyLogo: "/logos/State Street.png" },
  { company: "McKinsey", companyLogo: "/logos/McKinsey & Company.png" },
  { company: "BCG", companyLogo: "/logos/Boston Consulting Group.png" },
  { company: "Deloitte", companyLogo: "/logos/Deloitte.png" },
  { company: "KPMG", companyLogo: "/logos/KPMG.png" },
  { company: "EY", companyLogo: "/logos/EY.png" },
  { company: "PwC", companyLogo: "/logos/PRICE WATERHOUSE COOPERS.png" },
  { company: "Accenture", companyLogo: "/logos/Accenture.png" },
  { company: "BDO", companyLogo: "/logos/BDO.png" },
  { company: "Applied Materials", companyLogo: "/logos/Applied Materials.png" },
  { company: "KLA", companyLogo: "/logos/KLA.png" },
  { company: "Lam Research", companyLogo: "/logos/Lam Research.png" },
  { company: "Marvell", companyLogo: "/logos/Marvell.png" },
  { company: "TSMC", companyLogo: "/logos/TSMC.png" },
  { company: "Texas Instruments", companyLogo: "/logos/Texas Instruments.png" },
  { company: "Cirrus Logic", companyLogo: "/logos/Cirrus Logic.png" },
  { company: "NXP", companyLogo: "/logos/NXP Semiconductors.png" },
  { company: "Renesas", companyLogo: "/logos/Renesas Electronics.png" },
  { company: "Skyworks", companyLogo: "/logos/Skyworks.png" },
  { company: "Johnson & Johnson", companyLogo: "/logos/Johnson & Johnson.png" },
  { company: "Merck", companyLogo: "/logos/Merck.png" },
  { company: "Bristol Myers Squibb", companyLogo: "/logos/Bristol Myers Squibb.png" },
  { company: "Amgen", companyLogo: "/logos/Amgen.png" },
  { company: "Biogen", companyLogo: "/logos/Biogen.png" },
  { company: "Moderna", companyLogo: "/logos/Moderna.png" },
  { company: "AbbVie", companyLogo: "/logos/AbbVie.png" },
  { company: "Humana", companyLogo: "/logos/Humana.png" },
  { company: "CVS Health", companyLogo: "/logos/CVS Health.png" },
  { company: "Kaiser Permanente", companyLogo: "/logos/Kaiser Permanente.png" },
  { company: "Tesla", companyLogo: "/logos/Tesla.png" },
  { company: "Ford", companyLogo: "/logos/Ford Motor Company.png" },
  { company: "General Motors", companyLogo: "/logos/General Motors.png" },
  { company: "Nissan", companyLogo: "/logos/Nissan.png" },
  { company: "Volvo", companyLogo: "/logos/Volvo Group.png" },
  { company: "John Deere", companyLogo: "/logos/John Deere.png" },
  { company: "General Electric", companyLogo: "/logos/General Electric.png" },
  { company: "Bosch", companyLogo: "/logos/Bosch Group.png" },
  { company: "Walmart", companyLogo: "/logos/Walmart.png" },
  { company: "Target", companyLogo: "/logos/Target.png" },
  { company: "Costco", companyLogo: "/logos/Costco.png" },
  { company: "Nordstrom", companyLogo: "/logos/Nordstrom.png" },
  { company: "Kroger", companyLogo: "/logos/Kroger.png" },
  { company: "Disney", companyLogo: "/logos/Disney.png" },
  { company: "Sony", companyLogo: "/logos/Sony AI America Inc.png" },
  { company: "FedEx", companyLogo: "/logos/FedEx.png" },
  { company: "Amtrak", companyLogo: "/logos/Amtrak.png" },
  // Finance – variants & additions
  { company: "Barclays", companyLogo: "/logos/Barclays.png" },
  { company: "RBC", companyLogo: "/logos/RBC Royal Bank.png" },
  { company: "RBC Royal Bank", companyLogo: "/logos/RBC Royal Bank.png" },
  { company: "Royal Bank of Canada", companyLogo: "/logos/RBC Royal Bank.png" },
  { company: "Scotiabank", companyLogo: "/logos/Scotiabank.png" },
  { company: "Wells Fargo", companyLogo: "/logos/Wells_Fargo.png" },
  { company: "Visa", companyLogo: "/logos/Visa.png" },
  { company: "UBS", companyLogo: "/logos/UBS.png" },
  { company: "Pimco", companyLogo: "/logos/PIMCO.png" },
  { company: "PIMCO", companyLogo: "/logos/PIMCO.png" },
  { company: "Credit Suisse", companyLogo: "/logos/Credit_Suisse.png" },
  { company: "JP Morgan Chase", companyLogo: "/logos/JPMorganChase.png" },
  { company: "J.P. Morgan", companyLogo: "/logos/JPMorganChase.png" },
  { company: "Bank of America Merrill Lynch", companyLogo: "/logos/Bank of America.png" },
  { company: "BOA", companyLogo: "/logos/Bank of America.png" },
  { company: "Citi", companyLogo: "/logos/Citigroup.png" },
  { company: "E&Y", companyLogo: "/logos/EY.png" },
  { company: "Ernst & Young", companyLogo: "/logos/EY.png" },
  { company: "PricewaterhouseCoopers", companyLogo: "/logos/PRICE WATERHOUSE COOPERS.png" },
  { company: "BCG", companyLogo: "/logos/Boston Consulting Group.png" },
  { company: "Boston Consulting Group", companyLogo: "/logos/Boston Consulting Group.png" },
  { company: "McKinsey & Company", companyLogo: "/logos/McKinsey & Company.png" },
  // Tech – missing popular companies
  { company: "Facebook", companyLogo: "/logos/Meta.png" },
  { company: "LinkedIn", companyLogo: "/logos/LinkedIn.png" },
  { company: "Broadcom", companyLogo: "/logos/Broadcom.png" },
  { company: "Roblox", companyLogo: "/logos/Roblox.png" },
  { company: "eBay", companyLogo: "/logos/eBay.png" },
  { company: "Yelp", companyLogo: "/logos/Yelp.png" },
  { company: "Western Digital", companyLogo: "/logos/Western_Digital.png" },
  { company: "Compass", companyLogo: "/logos/Compass.png" },
  { company: "IQVIA", companyLogo: "/logos/IQVIA.png" },
  { company: "Verizon", companyLogo: "/logos/Verizon.png" },
  { company: "T-Mobile", companyLogo: "/logos/T-Mobile.png" },
  { company: "Hewlett Packard Enterprise", companyLogo: "/logos/Hewlett Packard Enterprise.png" },
  { company: "salesforce", companyLogo: "/logos/Salesforce.png" },
  { company: "AWS", companyLogo: "/logos/Amazon Web Services, Inc.png" },
  { company: "GM", companyLogo: "/logos/General Motors.png" },
  { company: "GE", companyLogo: "/logos/General Electric.png" },
  // Additional tech & other
  { company: "Netflix", companyLogo: "/logos/Netflix.png" },
  { company: "Stripe", companyLogo: "/logos/Stripe.png" },
  { company: "Lyft", companyLogo: "/logos/Lyft.png" },
  { company: "Airbnb", companyLogo: "/logos/Airbnb.png" },
  { company: "Palantir", companyLogo: "/logos/Palantir.png" },
  { company: "Databricks", companyLogo: "/logos/Databricks.png" },
  { company: "Workday", companyLogo: "/logos/Workday.png" },
  { company: "ServiceNow", companyLogo: "/logos/ServiceNow.png" },
  { company: "Atlassian", companyLogo: "/logos/Atlassian.png" },
  { company: "Zoom", companyLogo: "/logos/Zoom.png" },
  { company: "Slack", companyLogo: "/logos/Slack.png" },
  { company: "Twitter", companyLogo: "/logos/Twitter.png" },
  { company: "Pinterest", companyLogo: "/logos/Pinterest.png" },
  { company: "Coinbase", companyLogo: "/logos/Coinbase.png" },
  { company: "DoorDash", companyLogo: "/logos/DoorDash.png" },
  { company: "Instacart", companyLogo: "/logos/Instacart.png" },
  { company: "Square", companyLogo: "/logos/Square.png" },
  { company: "Rivian", companyLogo: "/logos/Rivian.png" },
  { company: "Waymo", companyLogo: "/logos/Waymo.png" },
  { company: "Lockheed Martin", companyLogo: "/logos/Lockheed_Martin.png" },
  { company: "Raytheon", companyLogo: "/logos/Raytheon.png" },
  { company: "Boeing", companyLogo: "/logos/Boeing.png" },
  { company: "Northrop Grumman", companyLogo: "/logos/Northrop_Grumman.png" },
  { company: "Medtronic", companyLogo: "/logos/Medtronic.png" },
  { company: "Abbott", companyLogo: "/logos/Abbott.png" },
  { company: "Pfizer", companyLogo: "/logos/Pfizer.png" },
  { company: "Eli Lilly", companyLogo: "/logos/Eli_Lilly.png" },
  { company: "Genentech", companyLogo: "/logos/Genentech.png" },
  { company: "Gilead", companyLogo: "/logos/Gilead.png" },
  { company: "23andMe", companyLogo: "/logos/23andMe.svg" },
  { company: "Bill.com", companyLogo: "/logos/Bill.com.png" },
  { company: "BILL", companyLogo: "/logos/Bill.com.png" },
  { company: "BILL Holdings", companyLogo: "/logos/Bill.com.png" },
  { company: "Polarr", companyLogo: "/logos/Polarr.png" },
  { company: "Polarr/Facebook", companyLogo: "/logos/Polarr.png" },
  { company: "Structuretx", companyLogo: "/logos/Structure Therapeutics.png" },
  { company: "Structure Therapeutics", companyLogo: "/logos/Structure Therapeutics.png" },
];
function getJdMatchRatio(ats) {
  const value = ats?.jdMatchRatio ?? ats?.raw?.jdMatchRatio ?? ats?.raw?.metrics?.jdMatchRatio ?? ats?.metrics?.jdMatchRatio;
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  return Math.round(number > 0 && number <= 1 ? number * 100 : number);
}
function uniqueList(items) {
  const seen = new Set();
  return (items || []).filter(Boolean).filter((item) => {
    const key = String(item).trim();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
function normalizeAtsListText(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/\d+(?:\.\d+)?\s*%/g, "<pct>")
    .replace(/\d+/g, "<num>")
    .replace(/[，。、“”‘’：；（）()[\]{}<>"'`~!@#$%^&*_+=|\\/?.:,;\-\s]/g, "")
    .trim();
}
function atsListTopicKey(text) {
  const value = String(text || "");
  const lower = value.toLowerCase();
  const normalized = normalizeAtsListText(value);
  const has = (pattern) => pattern.test(value) || pattern.test(lower);
  // \u2500\u2500 fine-grained keys checked first \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  // "\u628a\u5173\u952e\u8bcd/\u6280\u80fd\u5199\u8fdb\u7ecf\u5386\u8981\u70b9" \u2014 suggestions 5/6/7 all collapse here
  if (has(/\u628a.{0,10}(?:\u5173\u952e\u8bcd|\u6280\u80fd|\u539f\u8bcd).{0,15}(?:\u5199\u8fdb|\u653e\u8fdb|\u8fc1\u79fb|\u8865\u8fdb|\u52a0\u8fdb).{0,15}(?:\u7ecf\u5386|\u8981\u70b9|\u6280\u80fd\u680f|\u7b80\u4ecb)|\u628a.{0,6}\u6280\u80fd\u680f.{0,10}\u8fc1\u79fb|\u8865\u9f50.{0,20}(?:\u5c97\u4f4d)?\u5173\u952e\u8bcd|\u8fc1\u79fb.{0,8}\u7ecf\u5386\u8981\u70b9/i)) return "keyword-placement";
  // "\u6dfb\u52a0/\u91cd\u5199\u4e2a\u4eba\u7b80\u4ecb" \u2014 suggestions 1 & 3 / problem "\u7f3a\u5c11\u4e2a\u4eba\u7b80\u4ecb" all collapse here
  if (has(/(?:\u6dfb\u52a0|\u5148\u5199|\u91cd\u5199|\u65b0\u589e|\u7f3a\u5c11).{0,6}\u4e2a\u4eba\u7b80\u4ecb|\u4e2a\u4eba\u7b80\u4ecb.{0,6}(?:\u6bb5\u843d|\u6dfb\u52a0|\u65b0\u589e|\u7f3a\u5931)|\u5148.{0,4}\u4e2a\u4eba\u7b80\u4ecb\u6bb5\u843d/i)) return "write-summary";
  // "\u6574\u4f53\u91cd\u6392/\u91cd\u65b0\u7ec4\u7ec7" \u2014 separate from positioning
  if (has(/\u91cd\u6392.{0,8}\u7b80\u5386|\u6574\u4f53.{0,8}\u91cd\u65b0\u7ec4\u7ec7|\u56f4\u7ed5\u76ee\u6807\u5c97\u4f4d.{0,6}\u91cd\u65b0|\u4e3b\u7ebf\u4e0d\u591f\u6e05\u695a/i)) return "structure-reorganize";
  // "\u7edf\u4e00headline/\u5c97\u4f4d\u8bed\u8a00\u4e00\u81f4\u6027"
  if (has(/\u7edf\u4e00.{0,10}(?:headline|\u4e2a\u4eba\u7b80\u4ecb|\u7ecf\u5386\u6807\u9898)|headline.{0,6}\u5c97\u4f4d|\u804c\u4f4d\u540d\u79f0.{0,6}\u4e00\u81f4|\u5c97\u4f4d\u540d\u79f0.{0,6}\u4e0d\u591f\u4e00\u81f4/i)) return "headline-consistency";
  // "\u88ab\u52a8\u8bed\u6001/\u91cd\u590d\u52a8\u8bcd"
  if (has(/\u88ab\u52a8(?:\u8bed\u6001|\u53e5)|\u6539\u6210\u4e3b\u52a8|\u4e3b\u52a8\u8d21\u732e|\u91cd\u590d.{0,4}\u52a8\u4f5c\u52a8\u8bcd|\u52a8\u8bcd.{0,4}\u5c42\u6b21|\u66ff\u6362.{0,4}\u52a8\u8bcd/i)) return "verbs-passive";
  // "\u5730\u70b9/\u5de5\u4f5c\u6388\u6743/relocation"
  if (has(/\u5730\u70b9.{0,6}\u5de5\u4f5c\u6388\u6743|relocation|\u5de5\u4f5c\u6388\u6743|\u5230\u5c97\u65b9\u5f0f|work\s*authorization/i)) return "location-auth";
  // "\u7b80\u5386\u4e0d\u591f\u65b0/\u9700\u8981\u66f4\u65b0"
  if (has(/\u4e0d\u591f\u65b0|\u66f4\u65b0.{0,6}\u5f53\u524d\u72b6\u6001|\u7b80\u5386\u5185\u5bb9.{0,4}\u65b0|\u6700\u8fd1\u7ecf\u5386.{0,6}\u4e0d\u591f|\u66f4\u65b0.{0,20}(?:\u7ecf\u5386|\u9879\u76ee|\u65e5\u671f)/i)) return "recency";
  // "\u534f\u4f5c/\u8f6f\u6280\u80fd/\u9886\u5bfc\u529b"
  if (has(/\u534f\u4f5c|\u6c9f\u901a|\u9886\u5bfc\u529b|stakeholder|soft.{0,4}skill|\u8f6f\u6280\u80fd/i)) return "soft-skills";
  // \u2500\u2500 broad buckets \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  if (has(/summary|\u4e2a\u4eba\u7b80\u4ecb|\u5b9a\u4f4d|\u76ee\u6807\u5c97\u4f4d|\u539f\u8bcd|job\s*title|target\s*role/i)) return "positioning";
  if (has(/jd|keyword|\u5173\u952e\u8bcd|\u6280\u80fd|\u5de5\u5177|\u9886\u57df\u8bcd|\u5339\u914d|\u8986\u76d6|\u7f3a\u5931|\u8865\u9f50/i)) return "keywords";
  if (has(/\u91cf\u5316|\u6210\u679c|\u7ed3\u679c|\u5f71\u54cd|\u6548\u7387|\u767e\u5206\u6bd4|\u91d1\u989d|impact|result|measurable/i)) return "impact";
  if (has(/bullet|\u7ecf\u5386|\u8bc1\u636e|\u9879\u76ee|action\s*\+\s*method|\u52a8\u4f5c|\u65b9\u6cd5/i)) return "experience-evidence";
  if (has(/\u65f6\u95f4\u5012\u5e8f|chronolog|\u65e5\u671f|\u5e74\u4efd/i)) return "chronology";
  if (has(/\u4e2d\u56fd|\u7f8e\u56fd|\u975e\u76ee\u6807\u5e02\u573a|us-based|willing\s*to\s*relocate|relocat/i)) return "market-fit";
  if (has(/email|phone|linkedin|github|portfolio|\u8054\u7cfb|\u90ae\u7bb1|\u4f5c\u54c1\u96c6|\u94fe\u63a5/i)) return "profile-links";
  if (has(/\u683c\u5f0f|\u6587\u4ef6|format|file/i)) return "format";
  if (has(/intern|internship|\u5b9e\u4e60|\u65f6\u957f\u4e0d\u8db3|\u77ed\u671f/i)) return "tenure";
  if (has(/helped|assisted|responsible|led|built|optimized|\u52a8\u8bcd|\u4e3b\u52a8/i)) return "verbs";
  return normalized || lower.trim();
}
function dedupeAtsList(items, options = {}) {
  const { max = Infinity, topicDedupe = true } = options;
  const seenExact = new Set();
  const seenTopics = new Set();
  const output = [];
  for (const item of items || []) {
    const text = String(item || "").trim();
    if (!text) continue;
    const exactKey = normalizeAtsListText(text) || text.toLowerCase();
    const topicKey = atsListTopicKey(text);
    if (seenExact.has(exactKey)) continue;
    if (topicDedupe && seenTopics.has(topicKey)) continue;
    seenExact.add(exactKey);
    seenTopics.add(topicKey);
    output.push(text);
    if (output.length >= max) break;
  }
  return output;
}
function getKeywordBreakdown() {
  return s.premiumKeywordBreakdown || atsResult.raw?.premiumKeywordBreakdown || atsResult.keywordBreakdown || atsResult.raw?.keywordBreakdown || [];
}
function getMissingKeywordChecklist() {
  return Array.isArray(s.missingKeywordChecklist) ? s.missingKeywordChecklist : [];
}
function getJdKeywordCount(ats) {
  const explicit = ats?.keywordMatchCount || ats?.raw?.keywordMatchCount;
  if (explicit && Number.isFinite(Number(explicit.total)) && Number(explicit.total) > 0) {
    return { matched: Number(explicit.matched || 0), total: Number(explicit.total) };
  }
  const count = getKeywordBreakdown().reduce((acc, cat = {}) => {
    const matched = Array.isArray(cat.matched) ? cat.matched.length : Number(cat.matched || 0);
    const missing = Array.isArray(cat.missing) ? cat.missing.length : 0;
    const total = Number(cat.total || matched + missing);
    acc.matched += matched;
    acc.total += total;
    return acc;
  }, { matched: 0, total: 0 });
  return count.total > 0 ? count : null;
}
function formatJdKeywordCount(ats) {
  const count = getJdKeywordCount(ats);
  return count ? `${count.matched}/${count.total}` : "--";
}
function formatJdKeywordMatchValue(ats) {
  const count = getJdKeywordCount(ats);
  if (!count || !count.total) return "--";
  return `${count.matched}/${count.total}`;
}
function formatJdKeywordMatchPercent(ats) {
  const ratio = getJdMatchRatio(ats);
  if (ratio !== null) return ratio + "%";
  const count = getJdKeywordCount(ats);
  if (!count || !count.total) return "--";
  return Math.round((count.matched / count.total) * 100) + "%";
}
function atsRiskText(risk) {
  if (risk === "低") return "低风险";
  if (risk === "中") return "中风险";
  if (risk === "高") return "高风险";
  return risk || "未评级";
}
function riskToneClass(risk) {
  const text = String(risk || "");
  if (/高|high|severe|red/i.test(text)) return "risk-high";
  if (/中|medium|mid|moderate|orange|yellow/i.test(text)) return "risk-medium";
  if (/低|low|green/i.test(text)) return "risk-low";
  return "risk-pending";
}
function renderRows(arr) {
  return (arr || []).map(r => `
    <div class="detail-row"><span class="k">${escapeHtml(r.k)}</span><span class="v">${escapeHtml(r.v)}</span></div>
    <div class="detail-note">${escapeHtml(r.note)}</div>
  `).join("");
}
function renderStackedRows(arr) {
  return (arr || []).map(r => `
    <div class="detail-row detail-row-stacked">
      <span class="k">${escapeHtml(r.k)}</span>
      <span class="v">${escapeHtml(r.v)}</span>
      <span class="detail-note">${escapeHtml(r.note)}</span>
    </div>
  `).join("");
}
function getStoredJdText() {
  return s.jdText || atsResult.jdText || atsResult.raw?.jdText || "";
}
function getStoredLocation() {
  return s.location || s.jobLocation || atsResult.location || atsResult.raw?.location || "";
}
function getStoredResumeText() {
  return s.resumeText || atsResult.resumeText || atsResult.raw?.resumeText || "";
}
function inferSalaryRoleFamilyFromText(text) {
  const value = String(text || "");
  if (/\b(software engineer|software developer|sde|swe|frontend|front-end|backend|back-end|full stack|full-stack|react|node\.?js|typescript|java|python developer)\b|软件|前端|后端|全栈/i.test(value)) return "software_engineering";
  if (/\b(data analyst|business analyst|business intelligence|bi analyst|data scientist|analytics|sql|tableau|power bi|dashboard|machine learning|ml engineer|mle)\b|数据分析|商业分析|数据科学|机器学习|算法/i.test(value)) return "data_analytics";
  if (/\b(product manager|associate product manager|apm|product owner|roadmap|user research|product strategy)\b|产品经理|产品负责人/i.test(value)) return "product_management";
  if (/\b(financial analyst|finance|accounting|accountant|audit|tax|fp&a|valuation|quickbooks|gaap)\b|会计|审计|财务|金融分析/i.test(value)) return "finance_accounting";
  if (/\b(marketing|growth|social media|campaign|content marketing|seo|sem|brand)\b|市场|营销|增长|社媒|内容运营/i.test(value)) return "marketing";
  if (/\b(supply chain|logistics analyst|operations analyst|inventory|fulfillment|procurement)\b|供应链|库存|履约|物流分析/i.test(value)) return "supply_chain_operations";
  if (/\b(logistics|operations support|pickup|dispatch|warehouse|delivery|parcel|fleet)\b|揽收|调度|仓库|物流|末端|运营支持/i.test(value)) return "logistics_operations_support";
  if (/\b(business operations|operations specialist|program coordinator|project coordinator|operations coordinator)\b|业务运营|项目协调|运营专员/i.test(value)) return "business_operations";
  return "";
}
function getSalaryRoleFamily() {
  const primaryText = [getTargetJobTitle(), atsResult.profile?.targetRole, atsResult.raw?.profile?.targetRole, getStoredResumeText()].filter(Boolean).join(" ");
  return inferSalaryRoleFamilyFromText(primaryText)
    || atsResult.profile?.roleFamily
    || atsResult.raw?.profile?.roleFamily
    || atsResult.roleFamily
    || atsResult.raw?.roleFamily
    || "";
}
function getSalaryTargetRole() {
  return atsResult.profile?.targetRole || atsResult.raw?.profile?.targetRole || getTargetJobTitle() || "";
}
function formatConfidenceLabel(confidence) {
  const key = String(confidence || "").toLowerCase();
  if (key === "high") return "高";
  if (key === "medium") return "中等";
  if (key === "low") return "较低";
  return "中等";
}
function formatSalaryBasisNote(data) {
  const locationSource = String(data.matched_location_source || "").toLowerCase();
  const market = locationSource === "explicit"
    ? `${data.matched_location || "United States"} 地区`
    : "全美市场";
  return `基于此方向与${market}估算。`;
}
function salarySourceDisplayNote() {
  return "数据来源：美国官方职业薪资资料（BLS/O*NET），按相近岗位赛道估算。";
}
function salaryUnavailableRows() {
  return [
    { k:"薪资成长潜力", v:"待校准", note:"暂未匹配到足够明确的岗位赛道，薪资成长区间需要进一步校准。" },
    { k:"展示原则", v:"不使用 mock 薪资", note:"不会把 $120K/$200K 这类示例数字当作真实薪资或长期上限。" },
  ];
}
function getRoleSignalText() {
  return [
    getTargetJobTitle(),
    s.jobTitle,
    atsResult.jobTitle,
    atsResult.profile?.roleFamily,
    atsResult.raw?.profile?.roleFamily,
    atsResult.roleFamily,
    atsResult.raw?.roleFamily,
    atsResult.raw?.jobTitle,
    getStoredJdText(),
    ...(atsResult.topMissingKw || []),
    ...(atsResult.raw?.topMissingKw || []),
  ].filter(Boolean).join(" ").toLowerCase();
}
function buildReportAiImpactTrend() {
  const text = getRoleSignalText();
  if (!text.trim()) {
    return {
      level: "待校准",
      caption: "需要更多岗位信息",
      rows: [
        { k:"容易被自动化", v:"待判断", note:"需要更明确的岗位职责后再判断。" },
        { k:"更有价值的能力", v:"判断力与协作", note:"优先写出你如何处理复杂问题，而不是只列日常任务。" },
        { k:"简历应强化", v:"成果证据", note:"补充能体现判断、协作、优化结果的经历。" },
      ],
    };
  }
  const opsSignal = /(logistics|operations|dispatch|warehouse|delivery|parcel|customer support|揽收|调度|仓库|物流|快递|客服|运营|报表|成本控制)/i.test(text);
  const techSignal = /(software|engineer|machine learning|ai engineer|data scientist|product manager|developer|软件|算法|产品经理|数据科学)/i.test(text);
  const adminSignal = /(data entry|clerk|administrative|assistant|basic report|documentation|scheduling|文员|行政|录入|基础报表|重复报表|数据整理|标准流程)/i.test(text);
  if (adminSignal && !techSignal) {
    return {
      level: "高影响",
      caption: "标准化任务会被自动化",
      rows: [
        { k:"容易被自动化", v:"基础录入、重复整理、模板化沟通", note:"这类任务更容易被工具接管或压缩。" },
        { k:"更有价值的能力", v:"问题判断、流程改进、跨团队沟通", note:"需要证明你不只是执行流程，也能优化流程。" },
        { k:"简历应强化", v:"效率提升、错误率下降、流程优化结果", note:"用数字写出你带来的改进。" },
      ],
    };
  }
  if (opsSignal) {
    return {
      level: "中等影响",
      caption: "重复任务会被自动化",
      rows: [
        { k:"容易被自动化", v:"重复报表、基础数据整理、标准流程提醒", note:"AI 会先压缩低判断、可模板化的日常工作。" },
        { k:"更有价值的能力", v:"异常判断、跨团队协同、流程优化、数据决策", note:"越能处理例外情况和协调现场资源，越不容易被工具替代。" },
        { k:"简历应强化", v:"数据发现问题、优化调度、降低成本、提升完成率", note:"把工作写成判断和改进，而不是只写执行任务。" },
      ],
    };
  }
  if (techSignal) {
    return {
      level: "低-中等影响",
      caption: "AI 更像效率工具",
      rows: [
        { k:"容易被自动化", v:"资料整理、初稿生成、基础分析", note:"AI 会提升执行速度，但不直接替代完整判断。" },
        { k:"更有价值的能力", v:"复杂决策、产品/业务判断、跨团队影响", note:"能定义问题和推动结果的人更有优势。" },
        { k:"简历应强化", v:"决策依据、业务影响、规模化成果", note:"突出你如何用工具和数据做出更好的判断。" },
      ],
    };
  }
  return {
    level: "中等影响",
    caption: "部分流程会被自动化",
    rows: [
      { k:"容易被自动化", v:"重复整理、标准沟通、基础分析", note:"AI 会优先影响低判断、重复性强的工作。" },
      { k:"更有价值的能力", v:"业务判断、协作推进、结果负责", note:"未来更看重能把问题推进到结果的人。" },
      { k:"简历应强化", v:"问题、行动、结果", note:"用清楚的证据说明你解决了什么问题。" },
    ],
  };
}
function getTargetJobTitle() {
  const candidates = [s.jobTitle, atsResult.jobTitle, atsResult.raw && atsResult.raw.jobTitle];
  const raw = candidates.find(v => v && !/依\s*JD|自动识别|unknown|^目标岗位$/i.test(String(v))) || "";
  return normalizeDisplayTargetJob(raw);
}
function normalizeDisplayTargetJob(value) {
  return String(value || "")
    .replace(/^\s*【(?:岗位|职位|职称|职务|招聘岗位|应聘岗位)】\s*[：:]\s*/i, "")
    .replace(/^\s*(?:目标岗位|岗位|职位|职称|职务|招聘岗位|应聘岗位)\s*[：:\-–]\s*/i, "")
    .replace(/\s*\((?:junior|senior|entry[-\s]?level|full[-\s]?time|part[-\s]?time|internship|intern|co-?op|new\s*grad)[^)]*\)\s*$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}
function formatTargetJobForProblem(jobTitle) {
  const cleaned = String(jobTitle || "")
    .replace(/\([^)]*\)/g, "")
    .replace(/\b(internship|intern|co-op|coop)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
  if (/\bmachine learning engineer\b/i.test(cleaned)) return "Machine Learning Engineer";
  return cleaned || "目标岗位";
}
function repairTargetRoleProblem(text) {
  const target = formatTargetJobForProblem(getTargetJobTitle());
  return String(text || "")
    .replace(/目标岗位像是「[^」]+」/g, `目标岗位是「${target}」`)
    .replace(/目标岗位是「数据科学家」/g, `目标岗位是「${target}」`);
}
function problemTextFromTag(item) {
  if (!item || typeof item === "string") return item || "";
  return item.message || item.title || item.evidence || item.tag || "";
}
function normalizeProblemListLegacy() {
  return uniqueList([
    ...(atsResult.keyProblems || []),
    ...(atsResult.problems || []),
    ...(atsResult.raw?.keyProblems || []),
    ...(atsResult.raw?.problems || []),
    ...((atsResult.topProblems || []).map(item => item.message || item.title).filter(Boolean)),
    ...((atsResult.raw?.topProblems || []).map(item => item.message || item.title).filter(Boolean)),
  ].map(repairTargetRoleProblem));
}
function reportSummarySuggestionFallback() {
  return "添加个人简介段落：用 2-3 句话说明你的背景、核心技能和目标岗位，这是系统和招聘方第一眼读到的内容，也有助于提升关键词覆盖。";
}
function reportKeywordSuggestionFallback() {
  return "优先补齐岗位描述匹配缺口：只补真实经历能支撑的工具、领域词和动作词，分别放进技能栏和最相关的经历要点。";
}
function reportBulletSuggestionFallback() {
  return "将每段核心经历改成「动作 + 方法/工具 + 量化结果」结构，让系统和招聘方都能看到岗位证据。";
}
function reportSuggestionFallbacks() {
  return [
    ...(hasMissingSummarySignal() ? [reportSummarySuggestionFallback()] : []),
    reportKeywordSuggestionFallback(),
    reportBulletSuggestionFallback(),
    "调整开头定位和经历顺序，让目标岗位的主线更容易被读到。",
  ];
}
function simplifySuggestionText(text) {
  const value = String(text || "").trim();
  if (!value) return "";
  if (/Add a 2-3 line Summary section first/i.test(value)) return hasMissingSummarySignal() ? reportSummarySuggestionFallback() : "";
  if (/Prioritize missing role keywords/i.test(value)) return reportKeywordSuggestionFallback();
  if (/Rewrite top bullets/i.test(value)) return reportBulletSuggestionFallback();
  return value
    .replace(/exact phrase/gi, "精确岗位原词")
    .replace(/Summary section/gi, "个人简介段落")
    .replace(/\bSummary\b/g, "个人简介")
    .replace(/Experience bullet/gi, "经历要点")
    .replace(/\bSkills\b/g, "技能栏")
    .replace(/\bJD\b/g, "岗位描述")
    .replace(/\bATS\b/g, "系统")
    .replace(/\bHR\b/g, "招聘方")
    .replace(/target role/gi, "目标岗位")
    .replace(/role keywords/gi, "岗位关键词")
    .replace(/real project or work evidence/gi, "真实项目或工作证据")
    .replace(/action, method, and measurable result/gi, "动作、方法和量化结果")
    .replace(/Experience/g, "经历")
    .replace(/bullet/g, "要点")
    .replace(/个人简介\s*\/\s*个人简介段落/g, "个人简介段落")
    .replace(/个人简介\s*\/\s*个人简介/g, "个人简介")
    .replace(/岗位描述\s+关键词/g, "岗位描述关键词")
    .replace(/要点\s+的/g, "要点的")
    .replace(/系统\s+和\s+招聘方/g, "系统和招聘方")
    .replace(/招聘方\s+和\s+系统/g, "招聘方和系统")
    .replace(/\s+(个人简介段落|个人简介)/g, "$1")
    .replace(/个人简介\s+段落/g, "个人简介段落")
    .replace(/(系统和招聘方)\s+/g, "$1")
    .replace(/(招聘方和系统)\s+/g, "$1")
    .replace(/这是\s+系统和招聘方/g, "这是系统和招聘方")
    .replace(/影响\s+系统/g, "影响系统")
    .replace(/只看\s+技能栏/g, "只看技能栏")
    .replace(/影响系统\s+对/g, "影响系统对")
    .replace(/技能栏\s+很难/g, "技能栏很难")
    .replace(/招聘方\s+可能/g, "招聘方可能");
}
function normalizeSuggestionListLegacy() {
  const missingKw = uniqueList([
    ...(atsResult.topMissingKw || []),
    ...(atsResult.topMissingKeywords || []),
    ...(atsResult.raw?.topMissingKw || []),
    ...(atsResult.raw?.topMissingKeywords || []),
  ]).slice(0, 8);
  const fallbackSuggestions = [
    missingKw.length ? `优先补齐 JD 缺失技能：${missingKw.join("、")}。` : "",
    "把目标岗位关键词写进个人简介、技能栏和最相关的经历要点，避免只堆在技能列表。",
    "将每段核心经历改成「动作 + 方法/工具 + 量化结果」结构，让 ATS 和招聘官都能看到岗位证据。",
  ];
  return uniqueList([
    ...(atsResult.suggestions || []),
    ...(atsResult.raw?.suggestions || []),
    ...Object.values(s.sectionFixPlan || {}).flat().map(item => item.message || item.action || item.actionSummary || item.title).filter(Boolean),
    ...((atsResult.structuredSuggestions || []).map(item => item.action || item.actionSummary || item.title).filter(Boolean)),
    ...((atsResult.raw?.structuredSuggestions || []).map(item => item.action || item.actionSummary || item.title).filter(Boolean)),
    ...fallbackSuggestions,
  ]);
}
function normalizeSuggestionList() {
  const missingKw = uniqueList([
    ...(atsResult.topMissingKw || []),
    ...(atsResult.topMissingKeywords || []),
    ...(atsResult.raw?.topMissingKw || []),
    ...(atsResult.raw?.topMissingKeywords || []),
  ]).slice(0, 8);
  const fallbackSuggestions = [
    missingKw.length ? "优先补齐岗位描述中的缺失技能：只保留真实经历能支撑的工具、领域词和动作词，并写入对应段落。" : "",
    ...reportSuggestionFallbacks(),
  ];
  const structuredSource = [
    ...Object.values(s.sectionFixPlan || {}).flat().map(item => item.message || item.action || item.actionSummary || item.title).filter(Boolean),
    ...(s.detailedSuggestions || []).map(item => item.message || item.action || item.actionSummary || item.title).filter(Boolean),
    ...((atsResult.structuredSuggestions || []).map(item => item.action || item.actionSummary || item.title).filter(Boolean)),
    ...((atsResult.raw?.structuredSuggestions || []).map(item => item.action || item.actionSummary || item.title).filter(Boolean)),
  ];
  const raw = [
    ...structuredSource,
    ...(structuredSource.length ? [] : [
      ...(atsResult.suggestions || []),
      ...(atsResult.raw?.suggestions || []),
    ]),
  ]
    .map(simplifySuggestionText)
    .filter(Boolean);
  const items = dedupeAtsList(raw, { topicDedupe: true });
  for (const item of reportSuggestionFallbacks()) {
    if (items.length >= 3) break;
    const nextItems = dedupeAtsList([...items, item], { topicDedupe: true });
    if (nextItems.length > items.length) items.push(item);
  }
  return dedupeAtsList(items, { topicDedupe: true });
}
function reportProblemFallbacks() {
  return [
    "岗位描述关键词匹配仍有提升空间。",
    "简历定位需要更贴近目标岗位。",
    "经历证据需要更清楚地支撑核心技能。",
  ];
}
function normalizeProblemList() {
  const tagItems = [
    ...(s.problemTags || []),
    ...(atsResult.problemTags || []),
    ...(atsResult.raw?.problemTags || []),
  ].map(problemTextFromTag)
    .map(repairTargetRoleProblem)
    .map(simplifySuggestionText)
    .filter(Boolean);
  if (tagItems.length) return dedupeAtsList(tagItems, { topicDedupe: true });

  const raw = [
    ...(atsResult.keyProblems || []),
    ...(atsResult.problems || []),
    ...(atsResult.raw?.keyProblems || []),
    ...(atsResult.raw?.problems || []),
    ...((atsResult.topProblems || []).map(item => item.message || item.title).filter(Boolean)),
    ...((atsResult.raw?.topProblems || []).map(item => item.message || item.title).filter(Boolean)),
  ]
    .map(repairTargetRoleProblem)
    .map(simplifySuggestionText)
    .filter(Boolean);
  const items = dedupeAtsList(raw, { topicDedupe: true });
  for (const item of reportProblemFallbacks()) {
    if (items.length >= 3) break;
    const nextItems = dedupeAtsList([...items, item], { topicDedupe: true });
    if (nextItems.length > items.length) items.push(item);
  }
  return dedupeAtsList(items, { topicDedupe: true });
}
function renderAtsProblemItem(text) {
  return `<li style="margin-bottom:10px;padding-left:20px;position:relative;line-height:1.5;"><span style="position:absolute;left:0;top:8px;width:6px;height:6px;border-radius:50%;background:var(--bad);"></span>${escapeHtml(text)}</li>`;
}
function renderExpandableAtsProblems(sectionEl, problems, visibleCount = 5) {
  if (!sectionEl) return;
  if (!problems.length) {
    sectionEl.innerHTML = "";
    return;
  }
  const hiddenCount = Math.max(0, problems.length - visibleCount);
  const items = problems.map((problem, index) => {
    const item = renderAtsProblemItem(problem);
    if (index < visibleCount) return item;
    return item.replace("<li ", '<li class="ats-problem-extra" hidden ');
  }).join("");
  const toggle = hiddenCount
    ? `<button type="button" class="skill-expand-toggle ats-problem-toggle" style="margin-top:2px;">&#26597;&#30475;&#20840;&#37096;</button>`
    : "";
  sectionEl.innerHTML = `
    <div style="font-size:13px;font-weight:600;color:var(--bad);margin-bottom:8px;">&#128269; &#20851;&#38190;&#38382;&#39064;</div>
    <ul style="list-style:none;padding:0;margin:0;font-size:13px;">${items}</ul>
    ${toggle}`;
  const toggleBtn = sectionEl.querySelector(".ats-problem-toggle");
  if (!toggleBtn) return;
  let open = false;
  toggleBtn.onclick = () => {
    open = !open;
    sectionEl.querySelectorAll(".ats-problem-extra").forEach((el) => {
      el.hidden = !open;
    });
    toggleBtn.innerHTML = open
      ? "&#25910;&#36215; &#8593;"
      : "&#26597;&#30475;&#20840;&#37096;";
  };
}
function renderAtsSuggestionItem(text) {
  return `<li style="margin-bottom:10px;padding-left:20px;position:relative;line-height:1.5;"><span style="position:absolute;left:0;top:8px;width:6px;height:6px;border-radius:50%;background:var(--jade);"></span>${escapeHtml(text)}</li>`;
}
function normalizeTerms(value) {
  const raw = Array.isArray(value) ? value : [value];
  return raw.flatMap((item) => {
    const text = typeof item === "string" ? item : (item?.term || item?.name || "");
    return splitKeywordText(text);
  }).map((item) => String(item).trim()).filter(Boolean);
}

function splitKeywordText(text) {
  let value = String(text || "").trim();
  if (!value) return [];
  value = value
    .replace(/machine learningimage generationdebugging/gi, "machine learning,image generation,debugging")
    .replace(/machine learningimage generation/gi, "machine learning,image generation")
    .replace(/image generationdebugging/gi, "image generation,debugging");
  if (/[、,;；|]/.test(value)) return value.split(/[、,;；|]/).map((item) => item.trim()).filter(Boolean);
  return [value];
}

const KEYWORD_CATEGORY_CONFIG = {
  skill_tool: { label: "技能/工具" },
  responsibility_scene: { label: "职责/场景" },
  domain_business: { label: "行业/业务词" },
  soft_collab: { label: "软技能/协作词" },
};
const CATEGORY_LABEL_TO_GROUP = {
  "核心技能": "skill_tool",
  "工具 / 技术": "skill_tool",
  "工具/技术": "skill_tool",
  "领域词": "domain_business",
  "动作词": "responsibility_scene",
  "加分项": "responsibility_scene",
};
function categoryGroupForTerm(term, sourceKey = "", sourceLabel = "") {
  const text = String(term || "").toLowerCase();
  if (CATEGORY_LABEL_TO_GROUP[sourceLabel]) return CATEGORY_LABEL_TO_GROUP[sourceLabel];
  if (["core_skills", "tools", "hard_skills"].includes(sourceKey)) return "skill_tool";
  if (["domain_keywords"].includes(sourceKey)) return "domain_business";
  if (["action_verbs", "nice_to_have"].includes(sourceKey)) return "responsibility_scene";
  if (/(communication|collaboration|stakeholder|cross-functional|leadership|teamwork|沟通|协作|协调|跨部门|客服|客户|抗压)/i.test(term)) return "soft_collab";
  if (/(excel|sql|python|tableau|power\s*bi|quickbooks|gaap|aws|gcp|azure|jira|figma|system|系统|工具|报表|数据分析|成本控制|调度|报告制作|kpi|数据|分析)/i.test(term)) return "skill_tool";
  if (/(负责|创建|指派|调度|监控|优化|协同|值班|应急|流程|卸车|分拨|support|manage|analyze|coordinate|report|track)/i.test(term)) return "responsibility_scene";
  if (/(行业|业务|揽收|物流|快递|仓库|warehouse|logistics|parcel|delivery|运营|末端|区域)/i.test(term)) return "domain_business";
  return "domain_business";
}
function placementForKeyword(term, group, sourceKey = "") {
  const text = String(term || "").toLowerCase();
  if (sourceKey === "summary" || (/(title|岗位|职位|summary|定位|目标)/i.test(term) && !/(工具|系统|数据)/i.test(term))) {
    return { label: "放 Summary", className: "keyword-use--summary" };
  }
  if (group === "skill_tool" || ["core_skills", "tools"].includes(sourceKey)) {
    return { label: "放 Skills", className: "keyword-use--skills" };
  }
  if (group === "responsibility_scene" || /(负责|创建|指派|调度|监控|优化|协同|值班|应急|support|manage|analyze|coordinate|report|track)/i.test(term)) {
    return { label: "写进经历要点", className: "keyword-use--experience" };
  }
  if (group === "soft_collab") {
    return { label: "写进经历要点", className: "keyword-use--experience" };
  }
  if (/(公司|福利|地点|城市|全职|兼职|remote|onsite)/i.test(text)) {
    return { label: "只作参考，不建议硬塞", className: "keyword-use--reference" };
  }
  return { label: "只作参考，不建议硬塞", className: "keyword-use--reference" };
}
function keywordItemKey(item) {
  return String(item?.name || "").trim().toLowerCase();
}
function buildKeywordItems() {
  const items = [];
  const seen = new Set();
  const add = (name, status, sourceKey = "", sourceLabel = "", priority = 50) => {
    normalizeTerms(name).forEach((term) => {
      const clean = String(term || "").trim();
      if (!clean) return;
      const key = clean.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      const group = categoryGroupForTerm(clean, sourceKey, sourceLabel);
      const placement = placementForKeyword(clean, group, sourceKey);
      items.push({ name: clean, status, sourceKey, sourceLabel, group, placement, priority });
    });
  };
  getMissingKeywordChecklist().forEach((item, index) => {
    const term = item?.term || item?.name || item;
    const where = String(item?.whereToAdd || "").toLowerCase();
    const sourceKey = /experience/.test(where) ? "action_verbs" : /summary/.test(where) ? "summary" : /skills?/.test(where) || item?.category === "hard_skill" ? "core_skills" : "";
    add(term, "weak", sourceKey, "", index);
  });
  getKeywordBreakdown().forEach((cat, catIndex) => {
    const sourceKey = cat.key || "";
    const sourceLabel = cat.label || "";
    normalizeTerms(cat.missing || []).forEach((term, index) => add(term, "weak", sourceKey, sourceLabel, catIndex * 20 + index));
    normalizeTerms(cat.matched || []).forEach((term, index) => add(term, "have", sourceKey, sourceLabel, 100 + catIndex * 20 + index));
  });
  uniqueList([
    ...(atsResult.topMissingKw || []),
    ...(atsResult.topMissingKeywords || []),
    ...(atsResult.raw?.topMissingKw || []),
    ...(atsResult.raw?.topMissingKeywords || []),
  ]).forEach((term, index) => add(term, "weak", "", "", index + 5));
  return items.sort((a, b) => {
    if (a.status !== b.status) return a.status === "weak" ? -1 : 1;
    const aSkill = a.group === "skill_tool" ? 0 : 1;
    const bSkill = b.group === "skill_tool" ? 0 : 1;
    if (aSkill !== bSkill) return aSkill - bSkill;
    return a.priority - b.priority;
  });
}
function primaryKeywordItems(items) {
  const skillItems = items.filter((item) => item.group === "skill_tool");
  const source = skillItems.length >= 2 ? skillItems : items;
  return source.slice(0, 5);
}
function hasReliableSkillClassification(items) {
  return items.some((item) => item.group === "skill_tool");
}
function renderMentorLogoMarquee(pool) {
  const source = (pool && pool.length ? pool : STATIC_MENTOR_COMPANY_LOGOS);
  const logos = (source || []).filter(item => item && item.companyLogo).slice(0, 80);
  if (!logos.length) return "";
  const chips = [...logos, ...logos].map(item => `
    <div class="mentor-logo-chip" title="${escapeAttr(item.company || "")}">
      <img src="${escapeAttr(item.companyLogo)}" alt="${escapeAttr(item.company || "")}">
    </div>
  `).join("");
  return `<div class="logo-marquee" aria-label="Mentor company logos"><div class="logo-marquee-track">${chips}</div></div>`;
}
function renderMentorLogoIntro(pool) {
  return `
    <div class="mentor-logo-intro" id="mentorLogoIntro">
      <p class="mentor-logo-copy">由 MentorX 导师知识库中的真实大厂经验交叉匹配，系统会优先挑出最贴合你简历问题的建议。</p>
    </div>`;
}

function collectMentorLogoPool() {
  const pools = [
    ...(s.mentorLogoPool || []),
    ...(s.lockedAdvicePreview?.mentorLogoPool || []),
    ...(s.freeMentorAdvice?.mentorLogoPool || []),
    ...(s.premiumMentors || []).map((m) => ({ company: m.company, companyLogo: m.companyLogo })),
    ...(atsResult.raw?.premiumMentors || []).map((m) => ({ company: m.company, companyLogo: m.companyLogo })),
    ...(atsResult.raw?.freeMentorAdvice?.mentorLogoPool || []),
  ];
  const seen = new Set();
  return pools.filter((item) => {
    const key = `${item?.company || ""}|${item?.companyLogo || ""}`;
    if (!item?.companyLogo || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
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
    '<mark style="background:rgba(180,126,219,.22);color:var(--apricot,#B47EDB);border-radius:3px;padding:0 2px;font-weight:600;" title="AI 估算数据，仅供参考">$1</mark>'
  );
}
function plainTextFromHtml(text) {
  return String(text || "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>|<\/div>|<\/li>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
function firstTextValue(values) {
  for (const value of values) {
    const text = plainTextFromHtml(value).trim();
    if (text) return text;
  }
  return "";
}
function reportResumeText() {
  return firstTextValue([
    s.resumeText,
    atsResult.resumeText,
    atsResult.raw?.resumeText,
    atsResult.rawResumeText,
  ]);
}
function rewriteExampleKeywords(item = {}) {
  const rawValues = [
    item.targetSection,
    item.title,
    item.problemSummary,
    item.currentDiagnosis,
    item.actionSummary,
    item.action,
    item.topicCluster,
    item.displayAdviceType,
    item.canonicalActionFamily,
    ...(item.relatedProblemTags || []),
    ...(item.evidence || []),
    ...(Array.isArray(item.keywords) ? item.keywords : String(item.keywords || "").split(/[,\s]+/)),
  ];
  const combined = rawValues.filter(Boolean).join(" ").toLowerCase();
  const words = new Set();
  combined.replace(/[a-z][a-z0-9+#.-]{2,}/g, (word) => {
    if (!/^(the|and|for|with|from|this|that|into|your|resume|advice|summary|experience|skills|overall)$/.test(word)) {
      words.add(word);
    }
    return word;
  });
  const conceptTerms = [
    [/keyword|jd|skill|skills|hard_skill|tools?/, ["skill", "skills", "tool", "tools", "sql", "python", "excel", "tableau", "dashboard", "report"]],
    [/summary|position|role|title|alignment/, ["summary", "objective", "candidate", "role", "position"]],
    [/experience|evidence|bullet|project|result|impact/, ["project", "built", "led", "managed", "created", "analyzed", "developed", "improved", "supported"]],
    [/measurable|quant|metric|result|impact/, ["increased", "reduced", "improved", "optimized", "metrics", "kpi", "%"]],
    [/github|portfolio|linkedin|contact/, ["github", "portfolio", "linkedin", "email", "phone"]],
    [/education|coursework|gpa/, ["education", "coursework", "gpa", "degree"]],
  ];
  conceptTerms.forEach(([pattern, terms]) => {
    if (pattern.test(combined)) terms.forEach((term) => words.add(term));
  });
  return [...words].slice(0, 30);
}
function resumeRewriteCandidates(text) {
  const normalized = plainTextFromHtml(text)
    .replace(/\r/g, "\n")
    .replace(/[•●▪◆]/g, "\n- ")
    .replace(/\t/g, " ");
  const lines = normalized
    .split(/\n+/)
    .map((line) => line.replace(/\s+/g, " ").replace(/^[-–—*]\s*/, "").trim())
    .filter(Boolean);
  const candidates = [];
  lines.forEach((line) => {
    if (line.length <= 220) {
      candidates.push(line);
      return;
    }
    line.split(/(?<=[.!?。；;])\s+/).forEach((part) => {
      const clean = part.trim();
      if (clean) candidates.push(clean);
    });
  });
  return candidates
    .map((line) => line.trim())
    .filter((line) => line.length >= 12 && line.length <= 260)
    .slice(0, 160);
}
function inferRewriteBefore(item = {}) {
  const text = reportResumeText();
  if (!text) return "";
  const keywords = rewriteExampleKeywords(item);
  const candidates = resumeRewriteCandidates(text);
  if (!candidates.length) return "";
  let best = { score: 0, value: "" };
  candidates.forEach((candidate) => {
    const lower = candidate.toLowerCase();
    let score = 0;
    keywords.forEach((kw) => {
      if (kw === "%") {
        if (/%|\d/.test(candidate)) score += 0.5;
      } else if (lower.includes(kw)) {
        score += kw.length > 5 ? 2 : 1;
      }
    });
    if (/^(experience|project|work|internship|skills|summary|education)$/i.test(candidate)) score -= 3;
    if (/^[A-Z][A-Za-z\s/&+-]{2,40}$/.test(candidate) && !/[.,;:]|\d/.test(candidate)) score -= 2;
    if (/^(led|built|created|managed|analyzed|developed|designed|implemented|supported|coordinated|conducted|prepared|improved|optimized)\b/i.test(candidate)) score += 0.75;
    if (candidate.length > 180) score -= 0.5;
    if (score > best.score) best = { score, value: candidate };
  });
  return best.score >= 1.5 ? best.value : "";
}
function isMissingSummaryRewriteItem(item = {}) {
  const tags = item.relatedProblemTags || [];
  const text = [
    item.adviceId,
    item.title,
    item.targetSection,
    item.problemSummary,
    item.currentDiagnosis,
    item.actionSummary,
    item.action,
    item.canonicalActionFamily,
  ].filter(Boolean).join(" ");
  return tags.includes("missing_summary") ||
    item.canonicalActionFamily === "summary_creation" ||
    /missing_summary|先补上\s*Summary|缺少\s*Summary|没有\s*Summary|新增\s*2-3\s*行\s*Summary|add\s+(?:a\s+)?summary/i.test(text);
}
function buildRewriteExample(item = {}) {
  const explicitBefore = firstTextValue([
    item.rewriteExample?.before,
    item.beforeAfter?.before,
    item.before,
  ]);
  const explicitAfter = firstTextValue([
    item.rewriteExample?.after,
    item.beforeAfter?.after,
    item.after,
  ]);
  const example = /^[（(]?\s*无具体示例\s*[）)]?$/i.test(String(item.example || "").trim()) ? "" : item.example;
  const inferredBefore = isMissingSummaryRewriteItem(item)
    ? "\u7121Summary"
    : inferRewriteBefore(item);
  return {
    before: explicitBefore || inferredBefore || "待 AI 生成原句定位",
    after: explicitAfter || firstTextValue([example]) || "待 AI 生成改写句",
  };
}
function renderRewriteExampleCard(item = {}) {
  return "";
  const rewrite = buildRewriteExample(item);
  return `<div class="advice-example" style="margin-top:10px;">
    <div class="advice-example-head">
      <div class="title"><span class="check">&#10003;</span><span>&#25913;&#20889;&#31034;&#20363;</span></div>
      <button class="copy-btn" onclick="copyMentorExample(this)" data-content='${escapeAttr(rewrite.after)}'>&#128203; &#22797;&#21046;&#25913;&#21518;</button>
    </div>
    <div class="advice-example-body">
      <div class="advice-example-row advice-example-row--before">
        <span class="label">改前</span>
        <p>${escapeHtml(rewrite.before)}</p>
      </div>
      <div class="advice-example-row advice-example-row--after">
        <span class="label">改后</span>
        <p>${escapeHtml(rewrite.after)}</p>
      </div>
    </div>
  </div>`;
}
function copyMentorExample(btn){
  const raw = btn.getAttribute("data-content").replace(/&apos;/g,"'").replace(/&quot;/g,'"');
  const text = raw.replace(/\[\[([^\]]+)\]\]/g,"$1");
  if (navigator.clipboard) navigator.clipboard.writeText(text).then(
    () => {
      const original = btn.getAttribute("data-label") || btn.innerHTML;
      btn.setAttribute("data-label", original);
      btn.innerHTML = "&#10003; &#24050;&#22797;&#21046;";
      setTimeout(() => btn.innerHTML = original, 2000);
    }
  );
}
window.copyMentorExample = copyMentorExample;

// ── 1. Summary ──
const atsScore = atsResult.atsScore || 0;
const issueProblems = normalizeProblemList();
const issueText = issueProblems.length
  ? issueProblems[0]
  : atsScore
    ? `ATS ${atsRiskText(atsResult.riskLevel)}（${atsScore}/100），请优先查看 ATS 诊断中的分项得分和修改建议。`
    : "";
const coreIssueEl = document.getElementById("coreIssue");
if (coreIssueEl) coreIssueEl.textContent = issueText;

const headlineEl = document.getElementById("reportHeadlineScore") || document.querySelector(".report-headline .num");
if (headlineEl) headlineEl.textContent = atsScore || "--";

// ── 1.5. Result-page metrics, fully expanded for report ──
(function renderReportDataMetrics() {
  const jdMatchValue = formatJdKeywordMatchValue(atsResult);
  const rankPctEl = document.getElementById("reportRankPct");
  if (rankPctEl) rankPctEl.textContent = jdMatchValue;

  const atsTileEl = document.getElementById("reportAtsScore");
  if (atsTileEl) atsTileEl.textContent = atsScore || "--";
  const riskCaptionEl = document.getElementById("reportAtsRiskCaption");
  if (riskCaptionEl) {
    const riskLabel = atsRiskText(atsResult.riskLevel);
    riskCaptionEl.textContent = riskLabel;
    riskCaptionEl.classList.remove("risk-high", "risk-medium", "risk-low", "risk-pending");
    riskCaptionEl.classList.add(riskToneClass(riskLabel));
  }

  const rankDetailEl = document.getElementById("reportRankDetail");
  if (rankDetailEl) {
    rankDetailEl.innerHTML = renderRows([
      { k:"JD 关键词匹配", v: formatJdKeywordCount(atsResult), note:"已覆盖 / JD 关键词总数。" },
      { k:"整体覆盖率", v: formatJdKeywordMatchPercent(atsResult), note:"基于目标 JD 的关键词覆盖情况估算。" },
    ]) + renderStackedRows([
      { k:"主要缺口", v:"下方岗位描述关键词清单已整理关键词与放置建议。", note:"报告页会直接展示当前可用的完整分析内容。" },
    ]);
  }

  const atsDetailEl = document.getElementById("reportAtsDetail");
  if (atsDetailEl) {
    atsDetailEl.innerHTML = renderRows([
      { k:"ATS 总分", v: atsScore ? `${atsScore}/100` : "--", note: atsRiskText(atsResult.riskLevel) },
      { k:"JD 关键词匹配", v: formatJdKeywordCount(atsResult), note:"已覆盖 / JD 关键词总数" },
      { k:"简历质量", v: (atsResult.dimensions?.C?.score ?? atsResult.raw?.dimensions?.C?.score ?? "--") + "/" + (atsResult.dimensions?.C?.max ?? atsResult.raw?.dimensions?.C?.max ?? 12), note:"内容质量与成果表达" },
    ]);
  }

  const aiTrend = buildReportAiImpactTrend();
  const aiLevelEl = document.getElementById("reportAiImpactLevel");
  const aiCaptionEl = document.getElementById("reportAiImpactCaption");
  const aiDetailEl = document.getElementById("reportAiImpactDetail");
  if (aiLevelEl) {
    aiLevelEl.textContent = aiTrend.level;
    aiLevelEl.classList.remove("ai-impact-low", "ai-impact-medium", "ai-impact-high", "ai-impact-pending");
    const levelText = String(aiTrend.level || "");
    aiLevelEl.classList.add(/高/.test(levelText) ? "ai-impact-high" : /低/.test(levelText) ? "ai-impact-low" : /中/.test(levelText) ? "ai-impact-medium" : "ai-impact-pending");
  }
  if (aiCaptionEl) aiCaptionEl.textContent = aiTrend.caption;
  if (aiDetailEl) aiDetailEl.innerHTML = renderStackedRows(aiTrend.rows);

  (function syncTileRowHeights() {
    const tiles = Array.from(document.querySelectorAll("#reportDataTiles .tile"));
    if (!tiles.length) return;

    function measureExpandedTileHeight(tile) {
      const rect = tile.getBoundingClientRect();
      const clone = tile.cloneNode(true);
      clone.open = true;
      clone.style.position = "absolute";
      clone.style.visibility = "hidden";
      clone.style.pointerEvents = "none";
      clone.style.left = "-9999px";
      clone.style.top = "0";
      clone.style.width = `${rect.width}px`;
      clone.style.minHeight = "";
      clone.style.height = "auto";
      document.body.appendChild(clone);
      const height = clone.offsetHeight;
      clone.remove();
      return height;
    }

    function measureClosedTileHeight(tile) {
      const rect = tile.getBoundingClientRect();
      const clone = tile.cloneNode(true);
      clone.open = false;
      clone.style.position = "absolute";
      clone.style.visibility = "hidden";
      clone.style.pointerEvents = "none";
      clone.style.left = "-9999px";
      clone.style.top = "0";
      clone.style.width = `${rect.width}px`;
      clone.style.minHeight = "";
      clone.style.height = "auto";
      document.body.appendChild(clone);
      const height = clone.offsetHeight;
      clone.remove();
      return height;
    }

    function updateAllRows() {
      tiles.forEach(tile => {
        tile.classList.remove("is-row-equal-height");
        tile.style.minHeight = "";
      });

      const closedBaseHeight = Math.max(...tiles.map(measureClosedTileHeight));
      tiles.forEach(tile => {
        if (!tile.open) tile.style.minHeight = `${closedBaseHeight}px`;
      });

      for (let i = 0; i < tiles.length; i += 2) {
        const pair = tiles.slice(i, i + 2);
        const rowHeight = Math.max(...pair.map(measureExpandedTileHeight));
        const openTiles = pair.filter(tile => tile.open);
        const targets = openTiles.length === pair.length ? pair : openTiles;
        targets.forEach(tile => {
          tile.classList.add("is-row-equal-height");
          tile.style.minHeight = `${rowHeight}px`;
        });
      }
    }

    tiles.forEach(tile => tile.addEventListener("toggle", updateAllRows));
    window.addEventListener("resize", updateAllRows);
    updateAllRows();
  })();
})();

(async function loadReportSalaryTrajectory() {
  const salaryRangeEl = document.getElementById("reportSalaryRange");
  const salaryTopEl = document.getElementById("reportSalaryTop");
  const headlineSalaryTopEl = document.getElementById("reportHeadlineSalaryTop");
  const salaryDetailEl = document.getElementById("reportSalaryDetail");
  const showSalaryFallback = () => {
    if (salaryRangeEl) salaryRangeEl.textContent = "待校准";
    if (salaryTopEl) salaryTopEl.textContent = "需补充";
    if (headlineSalaryTopEl) headlineSalaryTopEl.textContent = "待校准";
    if (salaryDetailEl) salaryDetailEl.innerHTML = renderRows(salaryUnavailableRows());
    window.dispatchEvent(new Event("resize"));
  };
  const jobTitle = getTargetJobTitle() || s.jobTitle || atsResult.jobTitle || atsResult.raw?.jobTitle || "";
  const jdText = getStoredJdText();
  const location = getStoredLocation();
  const resumeText = getStoredResumeText();
  const roleFamily = getSalaryRoleFamily();
  const targetRole = getSalaryTargetRole();
  if (!jobTitle && !jdText) {
    showSalaryFallback();
    return;
  }
  try {
    const resp = await fetch("/api/position-salary", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobTitle, jdText, location, resumeText, roleFamily, targetRole }),
    });
    if (!resp.ok) {
      showSalaryFallback();
      return;
    }
    const data = await resp.json();
    if (data.trajectory_source !== "benchmark" || !data.three_year_range || !data.five_year_range) {
      showSalaryFallback();
      return;
    }
    if (salaryRangeEl) salaryRangeEl.textContent = data.three_year_range;
    if (salaryTopEl) salaryTopEl.textContent = data.five_year_range;
    if (headlineSalaryTopEl) headlineSalaryTopEl.textContent = data.top_range || data.five_year_range;
    const rows = [];
    if (data.jd_salary) {
      rows.push({ k:"JD 标注薪资", v:data.jd_salary, note:"这是 JD 中写明的薪资，不等同于长期成长上限。" });
    }
    rows.push(
      { k:"当前赛道参考", v:data.current_range || "待校准", note:formatSalaryBasisNote(data) },
      { k:"3 年成长区间", v:data.three_year_range, note:"若持续积累目标岗位相关经验和可验证成果，3 年内可参考这个区间。" },
      { k:"5 年成长区间", v:data.five_year_range, note:"代表同类岗位中经验更成熟、职责更完整时的市场参考。" },
      { k:"同赛道高分位", v:data.top_range || data.five_year_range, note:salarySourceDisplayNote() }
    );
    if (salaryDetailEl) salaryDetailEl.innerHTML = renderRows(rows);
    window.dispatchEvent(new Event("resize"));
  } catch (e) {
    console.warn("[Report salary]", e.message);
    showSalaryFallback();
  }
})();

// ── 2. ATS 详细分数 ──
(function renderAtsDetail() {
  const raw = atsResult.raw?.dimensions || atsResult.dimensions || {};
  const dimKeys = ["A","B","C","D","E","F"];
  const dimLabels = { A:"格式规范", B:"基本资料", C:"内容质量", D:"技能匹配", E:"市场适配", F:"经验匹配" };
  const jdKeywordCount = formatJdKeywordCount(atsResult);

  const svgEl = document.getElementById("atsRadarChart");
  if (svgEl) {
    const cx = 120, cy = 110, R = 80;
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
    const dataPts = dims.map((d, i) => pt(i, R * d.pct / 100).join(",")).join(" ");
    svg += `<polygon points="${dataPts}" fill="rgba(83,51,166,.16)" stroke="var(--jade,#5333A6)" stroke-width="2" stroke-linejoin="round"/>`;
    dims.forEach((d, i) => {
      const [dx, dy] = pt(i, R * d.pct / 100);
      const [lx, ly] = pt(i, R + 22);
      const anchor = lx < cx - 4 ? "end" : lx > cx + 4 ? "start" : "middle";
      const color = d.pct >= 70 ? "var(--good,#1F7A4D)" : d.pct >= 45 ? "var(--warn,#B25E00)" : "var(--bad,#B3261E)";
      svg += `<circle cx="${dx}" cy="${dy}" r="4" fill="${color}"/>`;
      svg += `<text x="${lx}" y="${ly}" text-anchor="${anchor}" font-size="11" font-weight="600" fill="var(--ink-soft)" font-family="var(--sans)">${dimLabels[dimKeys[i]]}</text>`;
      svg += `<text x="${lx}" y="${ly + 13}" text-anchor="${anchor}" font-size="12" font-weight="800" fill="${color}" font-family="var(--sans)">${d.score}/${d.max}</text>`;
    });
    svgEl.innerHTML = svg;
  }

  const totalEl = document.getElementById("atsTotalScore");
  if (totalEl && atsResult.atsScore) {
    const sc = atsResult.atsScore;
    const scoreColor = sc >= 75 ? "var(--good,#1F7A4D)" : sc >= 55 ? "var(--warn,#B25E00)" : "var(--bad,#B3261E)";
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

  const sysSummaryEl = document.getElementById("atsSystemSummary");
  if (sysSummaryEl) {
    sysSummaryEl.innerHTML = [
      jdKeywordCount !== "--" ? `<div><b>JD 关键词覆盖：</b>${jdKeywordCount}</div>` : "",
      atsResult.formatPenaltyTriggered ? `<div style="color:var(--bad);"><b>格式处罚：</b>${(atsResult.formatPenaltyReason || []).join("；")}</div>` : "",
    ].filter(Boolean).join("");
  }

  const problems = normalizeProblemList();
  const suggestions = normalizeSuggestionList();
  const probSection = document.getElementById("atsProblemsSection");
  renderExpandableAtsProblems(probSection, problems);
  return;
  if (probSection) {
    probSection.innerHTML = `
      ${problems.length ? `<div style="font-size:13px;font-weight:600;color:var(--bad);margin-bottom:8px;">&#128269; &#20851;&#38190;&#38382;&#39064;</div>
      <ul style="list-style:none;padding:0;margin:0;font-size:13px;">
        ${problems.map(renderAtsProblemItem).join("")}
      </ul>` : ""}`;
  }
})();

// ── 3. Skills ──
const labelMap = {
  have: `<span class="pill pill-good"><span class="dot"></span>已具备</span>`,
  weak: `<span class="pill pill-warn"><span class="dot"></span>待补强</span>`
};
function renderSkillRow(sk) {
  const placement = sk.placement || placementForKeyword(sk.name, sk.group, sk.sourceKey);
  return `<li class="skill-row">
    <div class="skill-name"><span class="priority">#${sk.priority}</span>${escapeHtml(sk.name)}</div>
    <div class="skill-meta">
      <span class="keyword-use ${placement.className}">${escapeHtml(placement.label)}</span>
      ${labelMap[sk.status] || ""}
    </div>
  </li>`;
}
function renderSkillList(skills){
  const skillListEl = document.getElementById("skillList");
  if (!skillListEl) return;
  const visibleCount = 10;
  const visibleSkills = skills.slice(0, visibleCount);
  const hiddenSkills = skills.slice(visibleCount);
  skillListEl.innerHTML = [
    ...visibleSkills.map(renderSkillRow),
    ...hiddenSkills.map((sk) => renderSkillRow(sk).replace('<li class="skill-row">', '<li class="skill-row report-skill-extra" hidden>')),
  ].join("");
  const expandBtn = document.getElementById("reportSkillExpandToggle");
  if (expandBtn) {
    expandBtn.hidden = hiddenSkills.length === 0;
    expandBtn.textContent = "查看更多 ↓";
    let open = false;
    expandBtn.onclick = () => {
      open = !open;
      skillListEl.querySelectorAll(".report-skill-extra").forEach((el) => {
        el.hidden = !open;
      });
      expandBtn.textContent = open ? "收起 ↑" : "查看更多 ↓";
    };
  }
  const jdCount = getJdKeywordCount(atsResult);
  const have = jdCount ? jdCount.matched : skills.filter(sk => sk.status === "have").length;
  const total = jdCount ? jdCount.total : skills.length;
  const weak = Math.max(0, total - have);
  const insightEl = document.querySelector(".ai-insight-diagnosis");
  if (insightEl) insightEl.innerHTML = `<span class="ico">💡</span>你已掌握 <b>${have}/${total}</b> 项岗位描述关键词，还有 <b>${weak} 项</b>待补强。${weak > 0 ? "优先处理可放进技能栏、个人简介和经历要点的技能/工具/能力词，避免把所有关键词平铺硬塞。" : "关键词覆盖率良好，建议进一步量化成果。"}`;
}
function renderKeywordCategories(items) {
  const detailsEl = document.getElementById("jdKeywordDetails");
  const listEl = document.getElementById("jdKeywordCategoryList");
  const expandBtn = document.getElementById("jdKeywordExpandToggle");
  if (!detailsEl || !listEl) return;
  if (!items.length) {
    detailsEl.hidden = true;
    listEl.innerHTML = "";
    if (expandBtn) expandBtn.hidden = true;
    return;
  }
  detailsEl.hidden = false;
  const VISIBLE = 10;
  const chipHtml = (item, hidden) =>
    `<span class="jd-keyword-chip ${item.status === "have" ? "is-have" : ""}"${hidden ? " hidden" : ""} title="${escapeAttr(item.placement.label)}">
      <span class="state"></span><b>${escapeHtml(item.name)}</b>
      <span class="keyword-use ${item.placement.className}">${escapeHtml(item.placement.label)}</span>
    </span>`;
  listEl.innerHTML = items.map((item, i) => chipHtml(item, i >= VISIBLE)).join("");
  if (expandBtn) {
    const hiddenCount = Math.max(0, items.length - VISIBLE);
    expandBtn.hidden = hiddenCount === 0;
    expandBtn.textContent = "查看更多 ↓";
    let open = false;
    expandBtn.onclick = () => {
      open = !open;
      listEl.querySelectorAll(".jd-keyword-chip").forEach((el, i) => {
        el.hidden = !open && i >= VISIBLE;
      });
      expandBtn.textContent = open ? "收起 ↑" : "查看更多 ↓";
    };
  }
}
(async function loadSkills(){
  const keywordItems = buildKeywordItems();
  const reliableSkills = hasReliableSkillClassification(keywordItems);
  const displayItems = keywordItems.map((sk, i) => ({ ...sk, priority: i + 1 }));
  const titleEl = document.getElementById("reportSkillSectionTitle");
  const descEl = document.getElementById("reportSkillSectionDesc");
  if (titleEl) titleEl.textContent = "JD Keyword 清单";
  if (descEl) {
    descEl.textContent = "这些是系统从 JD 中识别出的关键词。优先把待补强项写进 Summary、Skills 或 Experience。";
  }
  renderKeywordCategories(keywordItems);
  if (displayItems.length > 0 || getJdKeywordCount(atsResult)) {
    renderSkillList(displayItems);
  } else {
    const skillListEl = document.getElementById("skillList");
    const insightEl = document.querySelector(".ai-insight-diagnosis");
    if (skillListEl) skillListEl.innerHTML = "";
    if (insightEl) insightEl.innerHTML = `<span class="ico">💡</span>暂未识别到稳定的 JD 关键词。建议先确认 JD 文本是否包含岗位职责、任职要求和工具/技能信息。`;
  }
})();

// ── 4. Mentors ──
// Re-render ATS keyword, problems, and suggestions without preview caps.
(function renderFullAtsLists() {
  const kwSection = document.getElementById("atsKeywordSection");
  if (kwSection) {
    const breakdown = getKeywordBreakdown();
    const jdKeywordCount = formatJdKeywordCount(atsResult);
    let kwHTML = `<div style="font-size:13px;font-weight:700;color:var(--ink);margin-bottom:10px;padding-bottom:8px;border-bottom:1px dashed var(--line);">JD 技能覆盖${jdKeywordCount !== "--" ? ` <span style="color:var(--ink);font-family:var(--mono);font-size:13px;"> · 已具备 ${jdKeywordCount}</span>` : ""}</div>`;
    if (breakdown.length) {
      kwHTML += breakdown.map(cat => {
        const matched = normalizeTerms(cat.matched || []);
        const missing = normalizeTerms(cat.missing || []);
        const total = cat.total || matched.length + missing.length;
        const pct = total ? Math.round((matched.length / total) * 100) : 0;
        const pctColor = pct>=70 ? "var(--good)" : pct>=40 ? "var(--warn)" : "var(--bad)";
        const matchedPills = matched.map(k => `<span style="display:inline-block;padding:3px 8px;border-radius:99px;background:rgba(106,191,123,.15);color:#2d7a4a;font-size:12px;font-weight:500;margin:2px;">${escapeHtml(k)}</span>`).join("");
        const missingPills = missing.map(k => `<span style="display:inline-block;padding:3px 8px;border-radius:99px;background:rgba(224,112,112,.12);color:#b02020;font-size:12px;font-weight:500;margin:2px;">${escapeHtml(k)}</span>`).join("");
        return `<div style="margin-bottom:14px;">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
            <span style="font-size:12px;font-weight:700;color:var(--ink);font-family:var(--mono);letter-spacing:.04em;text-transform:uppercase;">${escapeHtml(cat.label || "JD Keywords")}</span>
            <span style="font-size:12px;font-weight:700;font-family:var(--mono);color:${pctColor};">${matched.length}/${total}</span>
          </div>
          ${matchedPills ? `<div style="margin-bottom:4px;"><span style="font-size:10px;color:var(--ink-mute);font-family:var(--mono);letter-spacing:.03em;">✓ 已命中</span><div style="margin-top:3px;">${matchedPills}</div></div>` : ""}
          ${missingPills ? `<div><span style="font-size:10px;color:var(--ink-mute);font-family:var(--mono);letter-spacing:.03em;">× 未命中</span><div style="margin-top:3px;">${missingPills}</div></div>` : ""}
        </div>`;
      }).join("");
    } else {
      const missingKw = uniqueList([
        ...(atsResult.topMissingKw || []),
        ...(atsResult.raw?.topMissingKw || []),
        ...getMissingKeywordChecklist().map(item => item.term || item.name),
      ]);
      if (missingKw.length) {
        kwHTML += `<div><div style="font-size:11px;color:var(--ink-soft);font-family:var(--mono);letter-spacing:.04em;margin-bottom:4px;">待补关键词</div><div style="display:flex;flex-wrap:wrap;gap:4px;">${missingKw.map(k=>`<span style="display:inline-block;padding:3px 8px;border-radius:99px;background:rgba(224,112,112,.12);color:#b02020;font-size:12px;">${escapeHtml(k)}</span>`).join("")}</div></div>`;
      }
    }
    kwSection.innerHTML = kwHTML;
  }

  const probSection = document.getElementById("atsProblemsSection");
  if (probSection) {
    const problems = normalizeProblemList();
    const suggestions = normalizeSuggestionList();
    renderExpandableAtsProblems(probSection, problems);
    return;
    probSection.innerHTML = `
      ${problems.length ? `<div style="font-size:13px;font-weight:600;color:var(--bad);margin-bottom:8px;">&#128269; &#20851;&#38190;&#38382;&#39064;</div>
      <ul style="list-style:none;padding:0;margin:0;font-size:13px;">${problems.map(renderAtsProblemItem).join("")}</ul>` : ""}`;
  }
})();

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
    high:   { dot:"#EF4444", bg:"#FEF2F2", color:"#B91C1C", border:"#FECACA", label:"必改" },
    medium: { dot:"#F97316", bg:"#FFF7ED", color:"#C2410C", border:"#FED7AA", label:"建议改" },
    low:    { dot:"#8B82A8", bg:"#F7F3FC", color:"#5F567A", border:"#E6DEF2", label:"补充" },
  };
  const c = cfg[lv] || cfg.medium;
  return `<span style="display:inline-flex;align-items:center;gap:5px;font-size:11px;font-weight:600;padding:3px 10px;border-radius:99px;background:${c.bg};color:${c.color};border:1px solid ${c.border};"><span style="width:6px;height:6px;border-radius:50%;background:${c.dot};flex-shrink:0;"></span>${c.label}</span>`;
}

function renderAdviceItem(item, idx) {
  const insight = item.mentorInsight || "";
  const hrPerspective = item.hrPerspective || item.HR_os || item.hrPov || item.recruiterPerspective || HR_PERSPECTIVE_LOOKUP.get(String(item.adviceId || "")) || HR_PERSPECTIVE_LOOKUP.get(adviceIdentity(item)) || fallbackHrPerspective(item);
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
        <span style="margin-left:auto;font-size:11px;font-weight:600;padding:3px 10px;border-radius:99px;background:#F0E8FA;color:#5333A6;border:1px solid #E6DEF2;flex-shrink:0;">${escapeHtml(item.displayAdviceType || item.topicCluster || sectionLabel(item.targetSection))}</span>
      </div>
      <h4 style="margin:0 0 14px;font-size:16px;font-weight:700;color:#111827;line-height:1.4;">${escapeHtml(item.title)}</h4>
      ${problemSummary ? `<div style="display:flex;gap:10px;background:#F8F7F4;border-left:3px solid #D1C9B8;border-radius:0 10px 10px 0;padding:12px 14px;margin-bottom:10px;"><span style="font-size:15px;flex-shrink:0;margin-top:1px;">💡</span><div><div style="font-size:11px;font-weight:700;color:#78350F;margin-bottom:4px;">你的现状</div><p style="margin:0;font-size:13px;line-height:1.65;color:#44403C;">${escapeHtml(problemSummary)}</p></div></div>` : ""}
      ${actionSummary ? `<div style="display:flex;gap:10px;background:#F0FDF4;border-left:3px solid #4ADE80;border-radius:0 10px 10px 0;padding:12px 14px;margin-bottom:10px;"><span style="font-size:15px;flex-shrink:0;margin-top:1px;">⚡</span><div><div style="font-size:11px;font-weight:700;color:#15803D;margin-bottom:4px;">建议你先做</div><p style="margin:0;font-size:13px;line-height:1.65;color:#166534;">${escapeHtml(actionSummary)}</p></div></div>` : ""}
      ${insight ? `<div style="background:#F5F3FF;border-left:3px solid #C4B5FD;border-radius:0 10px 10px 0;padding:12px 14px;margin-bottom:10px;"><div style="font-size:11px;font-weight:700;color:#6D28D9;margin-bottom:4px;">导师视角</div><p style="margin:0;font-size:13px;line-height:1.65;color:#4C1D95;">${escapeHtml(insight)}</p></div>` : ""}
      ${renderRewriteExampleCard(item)}
      ${hrPerspective ? `<div style="background:#F5F3FF;border-left:3px solid #C4B5FD;border-radius:0 10px 10px 0;padding:12px 14px;margin-top:8px;"><div style="font-size:11px;font-weight:700;color:#6D28D9;margin-bottom:4px;">HR</div><p style="margin:0;font-size:13px;line-height:1.65;color:#4C1D95;">${escapeHtml(hrPerspective)}</p></div>` : ""}
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
  const allTags = (m.badges||[]);
  const advice = (m.adviceItems||[]).slice(0,3).map((item,i)=>renderAdviceItem(item,i)).join("");
  const companyMeta = [m.company, m.mentorTitle].filter(Boolean).join(" · ");
  return `
    <article style="background:#FFFFFF;border:1px solid #E6DEF2;border-radius:22px;padding:24px;box-shadow:0 2px 12px rgba(0,0,0,0.06);margin-bottom:16px;">
      <div style="display:flex;align-items:flex-start;gap:12px;margin-bottom:18px;">
        <div class="mentor-avatar-placeholder" style="width:48px;height:48px;border-radius:50%;background:#F3F4F6;border:1px solid #E6DEF2;flex-shrink:0;"></div>
        <div style="flex:1;min-width:0;">
        <div style="font-weight:700;font-size:18px;color:#111827;line-height:1.2;">${escapeHtml(m.mentorName||"导师")}</div>
        ${companyMeta ? `<div style="font-size:12px;color:#9CA3AF;margin-top:4px;">${escapeHtml(companyMeta)}</div>` : ""}
        ${m.careerPathDisplay ? `<div style="font-size:12px;color:#9CA3AF;margin-top:2px;">${escapeHtml(m.careerPathDisplay)}</div>` : ""}
        </div>
      </div>
      <div style="height:1px;background:#E6DEF2;margin:0 0 20px;"></div>
      <div>${advice}</div>
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;border-top:1px solid #E6DEF2;margin-top:20px;padding-top:14px;">
        <span style="font-size:12px;color:#9CA3AF;font-weight:500;">导师 ${idx+1} / 4</span>
      </div>
    </article>
  `;
}

function renderAdviceBundle(items, logoPool) {
  const advice = (items || []).slice(0, 12).map((item, i) => renderAdviceItem(item, i)).join("");
  return `
    <article style="background:#FFFFFF;border:1px solid #E6DEF2;border-radius:22px;padding:24px;box-shadow:0 2px 12px rgba(0,0,0,0.06);margin-bottom:16px;">
      <div>${advice}</div>
    </article>
  `;
}

function getCompanyLogo(company) {
  if (!company) return "";
  const lower = company.toLowerCase();
  const match = STATIC_MENTOR_COMPANY_LOGOS.find(item => item.company && item.company.toLowerCase() === lower);
  return match ? match.companyLogo : "";
}

function renderMentorGroupHeader(mentor, groupIdx, totalGroups) {
  const logoUrl = mentor.companyLogo || getCompanyLogo(mentor.company);
  const mentorDisplayName = mentor.mentorName || "X导师";
  const logoHtml = logoUrl
    ? `<div style="width:56px;height:56px;border-radius:10px;background:#fff;border:1px solid #E6DEF2;display:flex;align-items:center;justify-content:center;padding:7px;flex-shrink:0;"><img src="${escapeAttr(logoUrl)}" alt="${escapeAttr(mentor.company||"")}" style="max-width:100%;max-height:100%;object-fit:contain;"></div>`
    : avatarCircle(mentor.company || mentorDisplayName, 56);
  return `
    <div style="display:flex;align-items:center;gap:12px;padding-bottom:16px;border-bottom:1px solid #E6DEF2;margin-bottom:20px;">
      ${logoHtml}
      <div style="flex:1;min-width:0;">
        <div style="font-weight:700;font-size:17px;color:#111827;line-height:1.2;">${escapeHtml(mentorDisplayName)}</div>
        ${mentor.company ? `<div style="font-size:12px;color:#6B7280;margin-top:3px;">${escapeHtml(mentor.company)}</div>` : ""}
        ${mentor.mentorTitle ? `<div style="font-size:11px;color:#9CA3AF;margin-top:2px;">${escapeHtml(mentor.mentorTitle)}</div>` : ""}
      </div>
      <span style="font-size:11px;color:#9CA3AF;font-weight:500;flex-shrink:0;">导师 ${groupIdx+1} / ${totalGroups}</span>
    </div>`;
}

function renderMentorGroup(mentor, groupIdx, totalGroups) {
  const adviceItems = (mentor.adviceItems || []).filter(item => !isUnsafeReportAdvice(item));
  if (!adviceItems.length) return "";
  const advice = adviceItems.map((item, i) => renderAdviceItem(item, i)).join("");
  return `
    <article style="background:#FFFFFF;border:1px solid #E6DEF2;border-radius:22px;padding:24px;box-shadow:0 2px 12px rgba(0,0,0,0.06);margin-bottom:16px;">
      ${renderMentorGroupHeader(mentor, groupIdx, totalGroups)}
      <div>${advice}</div>
    </article>`;
}

function renderMentorGrouped(mentors) {
  const valid = (mentors || []).filter(m => (m.adviceItems || []).some(item => !isUnsafeReportAdvice(item)));
  return valid.map((m, i) => renderMentorGroup(m, i, valid.length)).join("");
}

function flattenAllAdviceItems() {
  const seen = new Set();
  const out = [];
  const sources = [
    ...(s.premiumAdviceItems || []),
    ...((s.premiumMentors || []).flatMap(m => m.adviceItems || [])),
  ];
  for (const item of sources) {
    if (isUnsafeReportAdvice(item)) continue;
    const key = item.adviceId || adviceIdentity(item);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(item);
    if (out.length >= 12) break;
  }
  return out;
}

function groupAdviceItemsByMentor(items) {
  const mentorBuckets = new Map();
  const fallback = [];
  for (const item of (items || [])) {
    const src = item.mentorSource;
    const company = src?.company || "";
    const mentorName = src?.mentorName || "";
    if (!company && !mentorName) {
      fallback.push(item);
      continue;
    }
    const key = company || mentorName;
    if (!mentorBuckets.has(key)) {
      mentorBuckets.set(key, {
        mentorName,
        company,
        companyLogo: src?.companyLogo || getCompanyLogo(company),
        mentorTitle: src?.mentorTitle || "",
        adviceItems: [],
      });
    }
    mentorBuckets.get(key).adviceItems.push(item);
  }
  return { mentorGroups: [...mentorBuckets.values()], fallback };
}

function renderMentorGroupedFromAdviceItems() {
  const items = flattenAllAdviceItems();
  const { mentorGroups, fallback } = groupAdviceItemsByMentor(items);
  const allGroups = fallback.length
    ? [{ mentorName: "MentorX 导师", company: "MentorX", companyLogo: "/logo/MentorX.png", mentorTitle: "简历修改导师", adviceItems: fallback }, ...mentorGroups]
    : mentorGroups;
  if (!allGroups.length) return `<p style="color:var(--ink-soft);font-size:14px;padding:16px 0;">导师建议加载失败，请返回首页重新提交简历。</p>`;
  return allGroups.map((g, i) => renderMentorGroup(g, i, allGroups.length)).join("");
}

function adviceIdentity(item) {
  return String(item?.adviceId || item?.id || `${item?.title || ""}|${item?.action || item?.actionSummary || ""}`).trim();
}
function collectHrPerspectiveLookup() {
  const lookup = new Map();
  const sources = [
    ...(s.premiumAdviceItems || []),
    ...(atsResult.raw?.premiumAdviceItems || []),
    ...((s.premiumMentors || []).flatMap(m => m.adviceItems || m.adviceList || [])),
    ...((atsResult.raw?.premiumMentors || []).flatMap(m => m.adviceItems || m.adviceList || [])),
    ...(s.freeMentorAdvice?.adviceItems || []),
    ...(atsResult.raw?.freeMentorAdvice?.adviceItems || []),
    ...((s.mentorAdvice || []).flatMap(m => m.adviceItems || m.adviceList || [])),
  ];
  sources.forEach((item) => {
    const hr = item?.hrPerspective || item?.HR_os || item?.hrPov || item?.recruiterPerspective || "";
    if (!hr) return;
    [item.adviceId, item.id, adviceIdentity(item)].filter(Boolean).forEach((key) => {
      if (!lookup.has(String(key))) lookup.set(String(key), hr);
    });
  });
  return lookup;
}
const HR_PERSPECTIVE_LOOKUP = collectHrPerspectiveLookup();
function fallbackHrPerspective(item = {}) {
  const action = item.action || item.actionSummary || item.title || "这条修改建议";
  return `HR 会把这里当作快速筛选信号：如果简历没有体现「${String(action).slice(0, 42)}」这一点，候选人与 JD 的匹配感会被削弱。`;
}
function isUnsafeReportAdvice(item) {
  const text = [
    item?.title,
    item?.currentDiagnosis,
    item?.problemSummary,
    item?.action,
    item?.actionSummary,
    item?.mentorInsight,
    item?.mentorLens,
    item?.I_insight,
    item?.P_mentor,
    item?.example,
    item?.hrPerspective,
    item?.HR_os,
  ].filter(Boolean).join(" ").toLowerCase();
  return /绿卡|green card|工作身份|work authorization|holder|quant research|risk quant|mfe|sharpe ratio|embedded system|computer vision|ba方向|ba\s*\/\s*da|da\s*\/\s*ba/i.test(text);
}
function hasMissingSummarySignal() {
  const sources = [
    ...(atsResult.problemTags || []),
    ...(atsResult.raw?.problemTags || []),
    ...(atsResult.diagnosticObligations || []),
    ...(atsResult.raw?.diagnosticObligations || []),
    ...(atsResult.problems || []),
    ...(atsResult.raw?.problems || []),
  ];
  return sources.some((item) => {
    const tag = typeof item === "string" ? item : item?.tag || item?.id || item?.problemTag || "";
    const text = typeof item === "string" ? item : [item?.message, item?.title, item?.evidence].filter(Boolean).join(" ");
    return /missing_summary|缺少\s*summary|没有\s*summary|add\s+(?:a\s+)?summary/i.test(`${tag} ${text}`);
  }) || atsResult.diagnostics?.searchability?.hasSummary === false || atsResult.raw?.diagnostics?.searchability?.hasSummary === false;
}
function normalizeMissingSummaryAdviceItem(item = {}) {
  const tags = item.relatedProblemTags || [];
  const text = [item.title, item.action, item.actionSummary, item.currentDiagnosis, item.problemSummary, item.mentorInsight, item.reason].filter(Boolean).join(" ");
  const talksAboutSummaryKeyword = /summary/i.test(text) && /岗位原词|目标岗位原词|exact (?:target )?(?:job )?title|target title|job title|keyword|关键词|定位|目标岗位/i.test(text);
  if (!tags.includes("missing_summary") && !(hasMissingSummarySignal() && talksAboutSummaryKeyword)) return item;
  const targetRole = getTargetJobTitle() || s.jobTitle || atsResult.jobTitle || atsResult.profile?.targetRole || atsResult.raw?.jobTitle || "目标岗位";
  const action = `新增 2-3 行 Summary：第一句写目标岗位 ${targetRole}，第二句连接你最相关的经历、技能和可量化成果；先把段落搭起来，再补具体关键词。`;
  return {
    ...item,
    title: "先补上 Summary 段落",
    currentDiagnosis: "原简历目前缺少 Summary 段落；需要先有一个岗位定位入口，再谈把 JD 关键词放进 Summary。",
    problemSummary: "原简历目前缺少 Summary 段落；需要先有一个岗位定位入口，再谈把 JD 关键词放进 Summary。",
    action,
    actionSummary: action,
    mentorInsight: "没有 Summary 时，简历开头缺少岗位定位入口；先搭出这一段，后续目标岗位原词和 JD 关键词才有自然承载位置。",
    hrPerspective: "HR 会先看简历开头是否说明投递方向；缺少 Summary 时，后面的技能和经历更容易被读散。",
    relatedProblemTags: [...new Set(["missing_summary", ...tags.filter((tag) => tag !== "missing_exact_job_title")])],
    canonicalActionFamily: "summary_creation",
    targetSection: "summary",
  };
}
function isMissingSummaryAdvice(item = {}) {
  return item.canonicalActionFamily === "summary_creation" || (item.relatedProblemTags || []).includes("missing_summary");
}
function collectReportAdviceItems() {
  const sources = [
    ...(s.premiumAdviceItems || []),
    ...(atsResult.raw?.premiumAdviceItems || []),
    ...((s.premiumMentors || []).flatMap(m => m.adviceItems || [])),
    ...((atsResult.raw?.premiumMentors || []).flatMap(m => m.adviceItems || [])),
    ...(s.freeMentorAdvice?.adviceItems || []),
    ...(atsResult.raw?.freeMentorAdvice?.adviceItems || []),
    ...((s.mentorAdvice || []).flatMap(m => m.adviceItems || m.adviceList || [])),
  ];
  const seen = new Set();
  const items = [];
  for (const item of sources) {
    if (isUnsafeReportAdvice(item)) continue;
    const normalized = normalizeMissingSummaryAdviceItem(item);
    const key = hasMissingSummarySignal() && isMissingSummaryAdvice(normalized) ? "missing_summary" : adviceIdentity(normalized);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    items.push(normalized);
    if (items.length >= 12) break;
  }
  return items.sort((a, b) => {
    const aMissing = hasMissingSummarySignal() && isMissingSummaryAdvice(a);
    const bMissing = hasMissingSummarySignal() && isMissingSummaryAdvice(b);
    if (aMissing !== bMissing) return aMissing ? -1 : 1;
    return 0;
  }).slice(0, 12);
}

const FIT_TYPE_CONFIG = {
  same_role: { label:"同职位导师", bg:"#F0E8FA", color:"#5333A6", border:"#E6DEF2" },
  same_industry: { label:"同产业导师", bg:"#F0FDF4", color:"#15803D", border:"#BBF7D0" },
  same_function: { label:"同职能导师", bg:"#F0FDF4", color:"#166534", border:"#BBF7D0" },
  cross_domain_high_relevance: { label:"跨领域高相关", bg:"#FFF7ED", color:"#92400E", border:"#FDE68A" },
  recruiter_perspective: { label:"HR", bg:"#FFF1F2", color:"#9F1239", border:"#FECDD3" },
};

function renderAdviceItem(item, i) {
  const diagnosis = item.currentDiagnosis || item.problemSummary || "";
  const action = item.action || item.actionSummary || "";
  const insight = item.mentorInsight || item.mentorLens || item.reason || item.I_insight || item.P_mentor || "";
  const hrPov = item.hrPerspective || item.HR_os || item.hrPov || item.recruiterPerspective || HR_PERSPECTIVE_LOOKUP.get(String(item.adviceId || "")) || HR_PERSPECTIVE_LOOKUP.get(adviceIdentity(item)) || fallbackHrPerspective(item);
  const fitType = item.mentorFitType || "";
  const rawTopicCluster = item.displayAdviceType || item.topicCluster || sectionLabel(item.targetSection);
  const topicCluster = /ATS\s*通用建议/i.test(String(rawTopicCluster)) ? "" : rawTopicCluster;
  const fitCfg = FIT_TYPE_CONFIG[fitType];
  const fitChip = fitCfg
    ? `<span style="display:inline-flex;align-items:center;font-size:11px;font-weight:600;padding:3px 9px;border-radius:99px;background:${fitCfg.bg};color:${fitCfg.color};border:1px solid ${fitCfg.border};">${fitCfg.label}</span>`
    : "";
  const evidenceChips = (item.evidence || []).length
    ? `<div style="display:flex;flex-wrap:wrap;gap:5px;margin-top:7px;">${item.evidence.map(e => `<span style="font-size:11px;padding:2px 8px;border-radius:99px;background:#F3F4F6;color:#6B7280;border:1px solid #E5E7EB;">${escapeHtml(e)}</span>`).join("")}</div>`
    : "";
  const divider = i > 0
    ? `<div style="height:1px;background:linear-gradient(to right,transparent,rgba(0,0,0,0.07),transparent);margin:22px 0;"></div>`
    : "";

  return `${divider}
    <div style="margin-top:${i > 0 ? "0" : "4px"};">
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:10px;flex-wrap:wrap;">
        ${priorityBadge(item.priority)}
        ${topicCluster ? `<span style="font-size:11px;font-weight:600;padding:3px 9px;border-radius:99px;background:#F0E8FA;color:#5333A6;border:1px solid #E6DEF2;">${escapeHtml(topicCluster)}</span>` : ""}
        ${fitChip}
      </div>
      <h4 style="margin:0 0 13px;font-size:15px;font-weight:700;color:#111827;line-height:1.4;"><span style="display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:50%;background:#111827;color:#fff;font-size:11px;margin-right:8px;vertical-align:1px;">${i + 1}</span>${escapeHtml(item.title)}</h4>
      ${diagnosis ? `<div style="margin-bottom:11px;">
        <div style="display:flex;align-items:center;gap:6px;margin-bottom:5px;">
          <span style="width:3px;height:14px;background:#D4A574;border-radius:2px;flex-shrink:0;"></span>
          <span style="font-size:11px;font-weight:700;color:#92400E;letter-spacing:.02em;">你的现状</span>
        </div>
        <p style="margin:0 0 0 9px;font-size:13px;line-height:1.65;color:#44403C;">${escapeHtml(diagnosis)}</p>
        ${evidenceChips ? `<div style="margin-left:9px;">${evidenceChips}</div>` : ""}
      </div>` : ""}
      ${action ? `<div style="background:#F6FEF9;border:1px solid #D1FAE5;border-radius:12px;padding:12px 14px;margin-bottom:10px;">
        <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px;">
          <span style="width:18px;height:18px;border-radius:50%;background:#059669;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;font-size:9px;color:#fff;font-weight:700;">✓</span>
          <span style="font-size:11px;font-weight:700;color:#065F46;letter-spacing:.02em;">建议你先做</span>
        </div>
        <p style="margin:0;font-size:13px;line-height:1.65;color:#065F46;font-weight:600;">${escapeHtml(action)}</p>
      </div>` : ""}
      ${(insight || hrPov) ? `<div style="background:#FAFAF9;border:1px solid rgba(0,0,0,0.05);border-radius:10px;padding:11px 13px;margin-top:8px;">
        <div style="font-size:10.5px;font-weight:700;color:#9CA3AF;margin-bottom:8px;letter-spacing:.05em;text-transform:uppercase;">补充视角</div>
        ${insight ? `<div style="${hrPov ? "margin-bottom:8px;" : ""}"><span style="font-size:11px;font-weight:600;color:#6D28D9;background:#F5F3FF;padding:2px 7px;border-radius:99px;margin-right:6px;">导师</span><span style="font-size:12.5px;line-height:1.6;color:#374151;">${escapeHtml(insight)}</span></div>` : ""}
        ${hrPov ? `<div><span style="font-size:11px;font-weight:600;color:#B45309;background:#FFFBEB;padding:2px 7px;border-radius:99px;margin-right:6px;">HR</span><span style="font-size:12.5px;line-height:1.6;color:#374151;">${escapeHtml(hrPov)}</span></div>` : ""}
      </div>` : ""}
      ${renderRewriteExampleCard(item)}
    </div>`;
}

const premiumMentors = s.premiumMentors;
const premiumAdviceItems = collectReportAdviceItems();
const mentorLogoPool = collectMentorLogoPool();
const legacyMentors = s.mentorAdvice;
if (mentorsSection) {
  const num = mentorsSection.querySelector(".section-num");
  if (num) {
    const legacyAdviceCount = (legacyMentors || []).reduce((sum, mentor) =>
      sum + ((mentor.adviceItems || mentor.adviceList || []).length), 0);
    const adviceCount = (premiumAdviceItems || []).length || legacyAdviceCount;
    num.textContent = adviceCount ? `04 · 完整 ${adviceCount} 条导师建议` : "04 · 完整导师建议";
  }
}
const mentorLogoIntroSlot = document.getElementById("mentorLogoIntroSlot");
if (mentorLogoIntroSlot) {
  mentorLogoIntroSlot.innerHTML = renderMentorLogoIntro(mentorLogoPool);
}
const mentorsListEl = document.getElementById("mentorsList");
if (mentorsListEl) {
  const hasAnyAdvice = (premiumAdviceItems && premiumAdviceItems.length > 0) || (s.premiumMentors || []).some(m => (m.adviceItems || []).length > 0);
  if (hasAnyAdvice) {
    mentorsListEl.innerHTML = renderMentorGroupedFromAdviceItems();
  } else if (legacyMentors && legacyMentors.length > 0) {
    mentorsListEl.innerHTML = legacyMentors.map((m,i)=>renderPremiumMentorCard(m,i)).join("");
  } else {
    mentorsListEl.innerHTML = `<p style="color:var(--ink-soft);font-size:14px;padding:16px 0;">导师建议加载失败，请返回首页重新提交简历。</p>`;
  }
}

// ── 5. Company Insider Tips ──
function renderInsiderTipsSection(tips) {
  if (!tips || tips.length === 0) return '';
  return tips.map((tip) => {
    const logo = tip.companyLogo
      ? `<img src="${tip.companyLogo}" alt="${tip.company}" style="width:48px;height:48px;object-fit:contain;border-radius:8px;background:#fff;padding:4px;box-shadow:0 1px 4px rgba(0,0,0,0.08);" />`
      : `<div style="width:48px;height:48px;border-radius:8px;background:var(--amber-light,#f5e9c8);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:18px;color:var(--amber-dark,#a0620a);">${(tip.company||'?')[0]}</div>`;
    const chipColor = tip.insightType === 'hr'
      ? 'background:rgba(99,102,241,0.10);color:#4338ca;'
      : 'background:rgba(234,88,12,0.10);color:#c2410c;';
    const chipLabel = tip.insightType === 'hr' ? 'HR 视角' : '导师视角';
    const topicLabel = tip.topic ? `<span style="font-size:11px;color:var(--ink-soft);margin-left:6px;">· ${tip.topic}</span>` : '';
    return `
<div style="background:var(--surface,#fff);border-radius:12px;padding:16px 18px;margin-bottom:14px;box-shadow:0 1px 6px rgba(0,0,0,0.06);">
  <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px;">
    ${logo}
    <div style="flex:1;min-width:0;">
      <div style="font-weight:700;font-size:15px;line-height:1.2;">${tip.company}</div>
      <div style="font-size:12px;color:var(--ink-soft);margin-top:2px;">${tip.mentorName}${tip.mentorTitle ? ' · ' + tip.mentorTitle : ''}</div>
    </div>
    <span style="font-size:11px;padding:3px 8px;border-radius:6px;${chipColor}white-space:nowrap;">${chipLabel}</span>
  </div>
  <p style="font-size:14px;line-height:1.65;color:var(--ink);margin:0 0 6px;">${tip.insight}</p>
  ${topicLabel ? `<div style="margin-top:4px;">${topicLabel}</div>` : ''}
</div>`;
  }).join('');
}

// Override legacy insider renderer: these cards are market knowledge, not HR or mentor POV.
function renderInsiderTipsSection(tips) {
  if (!tips || tips.length === 0) return '';
  return tips.map((tip) => {
    const company = tip.company || tip.industryLabel || '公司/行业';
    const title = tip.knowledgeTitle || `${company} 的候选人偏好`;
    const sourceMentor = tip.sourceMentorName || tip.mentorName || '';
    const sourceTitle = tip.sourceMentorTitle || tip.mentorTitle || '';
    const sourceTopic = tip.sourceTopic || tip.topic || '';
    const sourceParts = [company, sourceMentor, sourceTitle].filter(Boolean).join(' · ');
    const isGeneralFallback = tip.source === 'fallback' && /^general_insider_/.test(String(tip.sourceAdviceId || ''));
    const sourceLine = isGeneralFallback
      ? '來自各大公司導師根据通用招聘筛选规律整理'
      : [sourceParts, sourceTopic ? `对应主题：${sourceTopic}` : ''].filter(Boolean).join(' · ');
    const logo = tip.companyLogo
      ? `<img src="${escapeAttr(tip.companyLogo)}" alt="${escapeAttr(company)}" style="width:46px;height:46px;object-fit:contain;border-radius:8px;background:#fff;padding:5px;border:1px solid #E6DEF2;" />`
      : `<div style="width:46px;height:46px;border-radius:8px;background:var(--paper-warm,#FFFFFF);border:1px solid #E6DEF2;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:17px;color:var(--jade,#5333A6);">${escapeHtml(company[0] || '?')}</div>`;
    const typeLabel = {
      company_preference: '公司偏好',
      industry_pattern: '行业规律',
      talent_profile: '人才画像',
      interview_standard: '面试标准',
      credential_expectation: '背景门槛',
    }[tip.knowledgeType] || '小知识';
    return `
<div style="background:#FFFFFF;border:1px solid #E6DEF2;border-radius:12px;padding:16px 18px;margin-bottom:14px;box-shadow:0 1px 6px rgba(0,0,0,0.04);">
  <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px;">
    ${logo}
    <div style="flex:1;min-width:0;">
      <div style="font-weight:800;font-size:15px;line-height:1.25;color:var(--ink);">${escapeHtml(title)}</div>
      <div style="font-size:12px;color:var(--ink-soft);margin-top:3px;">${escapeHtml(company)}${tip.industryLabel ? ' · ' + escapeHtml(tip.industryLabel) : ''}</div>
    </div>
    <span style="font-size:11px;font-weight:700;padding:3px 8px;border-radius:6px;background:rgba(83,51,166,0.10);color:var(--jade,#5333A6);white-space:nowrap;">${escapeHtml(typeLabel)}</span>
  </div>
  <p style="font-size:14px;line-height:1.65;color:var(--ink);margin:0 0 10px;">${escapeHtml(tip.insight)}</p>
  ${sourceLine ? `<div style="font-size:11.5px;color:var(--ink-soft);line-height:1.45;">来源：${escapeHtml(sourceLine)}</div>` : ''}
</div>`;
  }).join('');
}

function buildDefaultCompanyInsiderTips(limit = 4) {
  const targetRole = getTargetJobTitle() || s.jobTitle || atsResult.jobTitle || atsResult.profile?.targetRole || atsResult.raw?.jobTitle || "目标岗位";
  const base = [
    {
      knowledgeTitle: "ATS 往往先读结构，再读内容",
      insight: "很多筛选系统会先用 section 标题、日期、职位名和关键词位置判断简历结构；如果 Skills、Experience、Projects 的边界不清楚，后面的关键词即使出现，也可能被归到错误语境里。",
      knowledgeType: "industry_pattern",
    },
    {
      knowledgeTitle: "招聘方会看关键词出现的位置",
      insight: "同一个关键词出现在 Skills 和出现在 Experience 里的权重感不一样；只在技能栏出现，容易被当作会用工具，放在经历结果里，才更像真实做过相关任务。",
      knowledgeType: "talent_profile",
    },
    {
      knowledgeTitle: "JD 的前几条职责通常不是随机排序",
      insight: "很多岗位描述会把最常筛选的职责和 required skills 放在前半段；如果简历最上方没有回应这些高优先级信号，即使后面内容不错，也可能在快速扫描时被低估。",
      knowledgeType: "credential_expectation",
    },
    {
      knowledgeTitle: "过度贴合单一 JD 也可能扣分",
      insight: "简历如果把某一份 JD 的词逐条硬塞进去，反而会显得像关键词堆砌；更稳的做法是覆盖同类岗位都会反复出现的核心信号，让简历对一组相似岗位都有解释力。",
      knowledgeType: "company_preference",
    },
  ];
  return base.slice(0, Math.max(1, limit)).map((tip, index) => ({
    company: "通用招聘规律",
    companyLogo: "",
    industryLabel: "跨行业筛选",
    ...tip,
    relevanceReason: `与你申请的 ${targetRole} 方向相关。`,
    sourceMentorName: "",
    sourceMentorTitle: "",
    sourceTopic: "通用招聘筛选",
    sourceAdviceId: `general_insider_${index + 1}`,
    score: Number((0.35 - index * 0.01).toFixed(3)),
    source: "fallback",
  }));
}
const insiderTips = Array.isArray(s.companyInsiderTips) && s.companyInsiderTips.length
  ? s.companyInsiderTips
  : buildDefaultCompanyInsiderTips(4);
const insiderEl = document.getElementById('insiderTipsList');
const insiderSection = document.getElementById('insider-tips');
const insiderDivider = document.getElementById('insider-tips-divider');
const serviceNum = document.getElementById('serviceNum');
if (insiderEl && insiderTips.length >= 1) {
  insiderEl.innerHTML = renderInsiderTipsSection(insiderTips);
  if (insiderSection) {
    const num = insiderSection.querySelector('.section-num');
    const title = insiderSection.querySelector('.section-title');
    if (num) num.textContent = '05 · 公司内幕小知识';
    if (title) {
      title.textContent = '帮你看懂大公司真正重视什么样的人才';
      const sectionReason = insiderTips.find((tip) => tip && tip.relevanceReason)?.relevanceReason || '';
      let reasonEl = insiderSection.querySelector('#insiderTipsReason');
      if (sectionReason && !reasonEl) {
        reasonEl = document.createElement('p');
        reasonEl.id = 'insiderTipsReason';
        reasonEl.style.cssText = 'font-size:12.5px;line-height:1.55;color:var(--jade,#5333A6);background:var(--jade-soft,#F0E8FA);border-radius:8px;padding:8px 10px;margin:-4px 0 14px;';
        title.insertAdjacentElement('afterend', reasonEl);
      }
      if (reasonEl) {
        if (sectionReason) {
          reasonEl.textContent = sectionReason;
          reasonEl.style.display = '';
        } else {
          reasonEl.style.display = 'none';
        }
      }
    }
    insiderSection.style.display = '';
  }
  if (insiderDivider) insiderDivider.style.display = '';
  if (serviceNum) serviceNum.textContent = '06 · 升级服务';
} else {
  if (serviceNum) serviceNum.textContent = '05 · 升级服务';
}

// ── 6. PDF Export ──
function aiPdfPlacementLabel(item = {}) {
  const raw = item.placement?.label || item.whereToAdd || "";
  if (/summary/i.test(raw)) return "Summary";
  if (/skills?/i.test(raw)) return "Skills";
  if (/experience|经历/.test(raw)) return "Experience";
  if (/reference|参考/.test(raw)) return "Reference only";
  return raw || "Reference only";
}
function aiPdfPriorityRank(item = {}) {
  const p = String(item.priority || item.priorityLabel || "").toLowerCase();
  if (p === "high" || p === "p0" || /必改|critical/.test(p)) return 0;
  if (p === "medium" || p === "p1" || /建议/.test(p)) return 1;
  return 2;
}
function collectAiPdfKeywords() {
  const items = buildKeywordItems().map((item) => ({
    name: item.name,
    status: item.status === "have" ? "have" : "weak",
    placement: aiPdfPlacementLabel(item),
    group: item.group || "",
  }));
  if (items.length) return items;
  return uniqueList([
    ...(atsResult.topMissingKw || []),
    ...(atsResult.topMissingKeywords || []),
    ...(atsResult.raw?.topMissingKw || []),
    ...(atsResult.raw?.topMissingKeywords || []),
  ]).map((name) => ({
    name,
    status: "weak",
    placement: aiPdfPlacementLabel({ placement: placementForKeyword(name, categoryGroupForTerm(name)) }),
    group: categoryGroupForTerm(name),
  }));
}
function collectAiPdfAdviceItems() {
  const items = collectReportAdviceItems();
  if (items.length) return items.slice().sort((a, b) => aiPdfPriorityRank(a) - aiPdfPriorityRank(b));
  return normalizeSuggestionList().map((text, index) => ({
    title: `修改建议 ${index + 1}`,
    currentDiagnosis: "",
    action: text,
    mentorInsight: "",
    hrPerspective: "",
    priority: index === 0 ? "high" : "medium",
  }));
}
function renderAiPdfKeywordChips(items, status) {
  const filtered = items.filter((item) => item.status === status);
  if (!filtered.length) return `<p>暂无稳定关键词数据。请 AI 优先根据用户上传的原始简历和目标岗位 JD 自行补齐关键词。</p>`;
  return `<div class="ai-pdf-chip-list">${filtered.map((item) => `
    <span class="ai-pdf-chip ${status}">
      <strong>${escapeHtml(item.name)}</strong>
      <span>${escapeHtml(item.placement)}</span>
    </span>`).join("")}</div>`;
}
function renderAiPdfProblems(problems) {
  if (!problems.length) return `<p>暂无明确关键问题。请 AI 按 ATS 可读性、JD 匹配、Summary、Skills、Experience bullet 质量进行整体优化。</p>`;
  return `<ol>${problems.map((problem) => `<li>${escapeHtml(problem)}</li>`).join("")}</ol>`;
}
function renderAiPdfAdvice(adviceItems) {
  if (!adviceItems.length) {
    return `<p>暂无导师建议。请 AI 使用关键词和关键问题，按“动作 + 方法/工具 + 结果/影响”的结构改写简历。</p>`;
  }
  return adviceItems.map((item, index) => {
    const diagnosis = item.currentDiagnosis || item.problemSummary || "";
    const action = item.action || item.actionSummary || "";
    const insight = item.mentorInsight || item.mentorLens || item.reason || item.I_insight || item.P_mentor || "";
    const hrPov = item.hrPerspective || item.HR_os || item.hrPov || item.recruiterPerspective || HR_PERSPECTIVE_LOOKUP.get(String(item.adviceId || "")) || HR_PERSPECTIVE_LOOKUP.get(adviceIdentity(item)) || "";
    const priority = aiPdfPriorityRank(item) === 0 ? "高优先级" : aiPdfPriorityRank(item) === 1 ? "中优先级" : "补充优化";
    return `<div class="ai-pdf-advice">
      <div><span class="ai-pdf-label">${escapeHtml(priority)}</span><span class="ai-pdf-meta">Advice ${index + 1} · ${escapeHtml(sectionLabel(item.targetSection || "overall"))}</span></div>
      <h3>${escapeHtml(item.title || `修改建议 ${index + 1}`)}</h3>
      ${diagnosis ? `<p><strong>AI needs to fix:</strong> ${escapeHtml(diagnosis)}</p>` : ""}
      ${action ? `<p><strong>Rewrite instruction:</strong> ${escapeHtml(action)}</p>` : ""}
      ${insight ? `<p><strong>Mentor rationale:</strong> ${escapeHtml(insight)}</p>` : ""}
      ${hrPov ? `<p><strong>Recruiter signal:</strong> ${escapeHtml(hrPov)}</p>` : ""}
    </div>`;
  }).join("");
}
function buildAiRewritePdfElement() {
  const keywords = collectAiPdfKeywords();
  const weakCount = keywords.filter((item) => item.status === "weak").length;
  const haveCount = keywords.filter((item) => item.status === "have").length;
  const problems = normalizeProblemList();
  const adviceItems = collectAiPdfAdviceItems();
  const targetRole = getTargetJobTitle() || s.jobTitle || atsResult.jobTitle || atsResult.profile?.targetRole || atsResult.raw?.jobTitle || "目标岗位";
  const el = document.createElement("div");
  el.className = "ai-rewrite-pdf";
  el.innerHTML = `
    <div class="ai-pdf-brand">
      <img src="/logo/logo%20banner_no_bg.png" alt="MentorX">
      <div class="ai-pdf-kicker">AI RESUME REWRITE PROMPT PACK</div>
    </div>
    <h1>MentorX AI 简历改写指令包</h1>
    <p>请把这份 PDF 和用户的原始简历一起上传给 ChatGPT / Claude / 豆包等 AI 工具。目标岗位：<strong>${escapeHtml(targetRole)}</strong>。</p>

    <section class="ai-pdf-card ai-pdf-prompt">
      <h2>给 AI 的固定任务</h2>
      <p>你是一位资深简历修改顾问。请读取用户上传的原始简历和本指令包，直接输出一份完整、可投递的新简历。必须保留真实经历，不得编造公司、学校、时间、奖项、项目或指标；没有真实数据时，只优化表达，不虚构数字。请优先自然补入待补强关键词，不要硬塞关键词。</p>
    </section>

    <section class="ai-pdf-card">
      <h2>输出格式要求</h2>
      <ol>
        <li>第一部分：完整新版简历。</li>
        <li>第二部分：关键词覆盖说明，列出哪些关键词已被自然补入。</li>
        <li>第三部分：修改摘要，说明改了哪些段落。</li>
        <li>第四部分：仍需用户补充的信息，只列真实缺失项。</li>
      </ol>
    </section>

    <section class="ai-pdf-card">
      <h2>JD 关键词清单</h2>
      <div class="ai-pdf-grid">
        <div>
          <h3>待补强关键词 (${weakCount})</h3>
          ${renderAiPdfKeywordChips(keywords, "weak")}
        </div>
        <div>
          <h3>已具备关键词 (${haveCount})</h3>
          ${renderAiPdfKeywordChips(keywords, "have")}
        </div>
      </div>
      <p class="ai-pdf-meta">每个关键词后方标注建议放置位置：Summary、Skills、Experience 或 Reference only。</p>
    </section>

    <section class="ai-pdf-card">
      <h2>关键问题</h2>
      ${renderAiPdfProblems(problems)}
    </section>

    <section class="ai-pdf-card">
      <h2>修改建议</h2>
      ${renderAiPdfAdvice(adviceItems)}
    </section>

    <section class="ai-pdf-card">
      <h2>改写规则</h2>
      <ul>
        <li>优先修 Summary、Skills 和 Experience bullets。</li>
        <li>每条经历尽量写成“动作 + 方法/工具 + 结果/影响”。</li>
        <li>补齐 JD keyword，但不能为了关键词牺牲真实度和可读性。</li>
        <li>语言要专业、简洁、ATS 可读，避免空泛形容词。</li>
        <li>去 AI 化：避免模板化、过度工整或夸张的 AI 语气；保留用户真实经历的个人表达，句子长短自然，不要写成一眼能看出是模型生成的履历。</li>
      </ul>
    </section>`;
  return el;
}

function exportPDFLegacy(){
  if (!window.html2pdf) { alert("PDF 库未加载，请刷新重试"); return; }
  const btn = document.querySelector('.export-card .btn');
  const orig = btn ? btn.innerHTML : "";
  if (btn) { btn.disabled = true; btn.innerHTML = '⏳ 正在生成 PDF…'; }
  document.body.classList.add('exporting');
  const opt = {
    margin: [10, 8, 10, 8],
    filename: "MentorX-Resume-Diagnostic-Report.pdf",
    image: { type: 'jpeg', quality: 0.95 },
    html2canvas: { scale: 2, useCORS: true, logging: false, backgroundColor: '#FFFFFF', windowWidth: 480 },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
    pagebreak: { mode: ['css', 'legacy'], avoid: '.section, .mentor-card-v2, .advice-example, .service-card' }
  };
  html2pdf().set(opt).from(document.querySelector('.page')).save()
    .then(() => { document.body.classList.remove('exporting'); if(btn){btn.disabled=false;btn.innerHTML=orig;} })
    .catch(err => { console.error(err); document.body.classList.remove('exporting'); if(btn){btn.disabled=false;btn.innerHTML=orig;} });
}
function waitForReportImages(root) {
  const images = Array.from(root.querySelectorAll("img"));
  return Promise.all(images.map((img) => {
    if (img.complete) return Promise.resolve();
    return new Promise((resolve) => {
      img.addEventListener("load", resolve, { once: true });
      img.addEventListener("error", resolve, { once: true });
    });
  }));
}
function createPdfStage(contentEl) {
  const stage = document.createElement("div");
  stage.setAttribute("data-pdf-stage", "true");
  stage.style.cssText = [
    "position:absolute",
    `top:${Math.max(0, window.scrollY || 0)}px`,
    "left:0",
    "width:794px",
    "min-height:1123px",
    "background:#FFFFFF",
    "z-index:2147483647",
    "pointer-events:none",
    "overflow:visible"
  ].join(";");
  contentEl.style.width = "794px";
  contentEl.style.maxWidth = "794px";
  contentEl.style.margin = "0";
  contentEl.style.transform = "none";
  stage.appendChild(contentEl);
  document.body.appendChild(stage);
  return stage;
}
function buildFullReportPdfElement() {
  const pageEl = document.querySelector(".page");
  if (!pageEl) return null;
  const clone = pageEl.cloneNode(true);
  clone.querySelectorAll(".banner,.export-card,.footnote").forEach((el) => el.remove());
  expandReportCloneForPrint(clone);
  clone.style.width = "794px";
  clone.style.maxWidth = "794px";
  clone.style.margin = "0";
  clone.style.padding = "32px 48px 44px";
  clone.style.boxShadow = "none";
  clone.style.border = "none";
  clone.style.background = "#FFFFFF";
  clone.style.transform = "none";
  return clone;
}
function expandReportCloneForPrint(root) {
  if (!root) return;
  root.querySelectorAll("details").forEach((details) => {
    details.setAttribute("open", "");
  });
  root.querySelectorAll(".report-skill-extra,.ats-problem-extra,.jd-keyword-chip[hidden]").forEach((el) => {
    el.hidden = false;
    el.removeAttribute("hidden");
  });
  root.querySelectorAll(".skill-expand-toggle,.ats-problem-toggle,.jd-keyword-expand").forEach((el) => {
    el.remove();
  });
  root.querySelectorAll(".ats-preview-details").forEach((el) => {
    el.classList.add("is-expanded");
  });
  root.querySelectorAll(".paywall-more").forEach((el) => {
    el.style.display = "block";
  });
}
async function exportPDF(){
  if (!window.html2pdf) { alert("PDF library is still loading. Please refresh and try again."); return; }
  const btn = document.querySelector('.export-card .btn');
  const orig = btn ? btn.innerHTML : "";
  if (btn) { btn.disabled = true; btn.innerHTML = '&#9203; Generating PDF...'; }
  const pageEl = buildFullReportPdfElement();
  if (!pageEl) { if(btn){btn.disabled=false;btn.innerHTML=orig;} return; }
  const stage = createPdfStage(pageEl);
  try {
    if (document.fonts?.ready) await document.fonts.ready;
    await waitForReportImages(pageEl);
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const exportWidth = 794;
    const opt = {
      margin: [0, 0, 0, 0],
      filename: "MentorX-Resume-Diagnostic-Report.pdf",
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#FFFFFF',
        windowWidth: exportWidth,
        scrollX: 0,
        scrollY: 0
      },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      pagebreak: { mode: ['css', 'legacy'], avoid: '.section, .mentor-card-v2, .advice-example, .service-card' }
    };
    await html2pdf().set(opt).from(pageEl).save();
  } catch (err) {
    console.error(err);
  } finally {
    stage.remove();
    if(btn){btn.disabled=false;btn.innerHTML=orig;}
  }
}
async function exportAiRewritePDF(){
  if (!window.html2pdf) { alert("PDF library is still loading. Please refresh and try again."); return; }
  const btn = document.querySelector('.btn-ai-prompt');
  const orig = btn ? btn.innerHTML : "";
  if (btn) { btn.disabled = true; btn.innerHTML = '&#9203; Generating prompt PDF...'; }
  const exportEl = buildAiRewritePdfElement();
  const stage = createPdfStage(exportEl);
  try {
    if (document.fonts?.ready) await document.fonts.ready;
    await waitForReportImages(exportEl);
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const exportWidth = 794;
    const opt = {
      margin: [0, 0, 0, 0],
      filename: "MentorX-AI-Resume-Rewrite-Prompt-Pack.pdf",
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#FFFFFF',
        windowWidth: exportWidth,
        scrollX: 0,
        scrollY: 0
      },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      pagebreak: { mode: ['css', 'legacy'], avoid: '.ai-pdf-card, .ai-pdf-advice' }
    };
    await html2pdf().set(opt).from(exportEl).save();
  } catch (err) {
    console.error(err);
  } finally {
    stage.remove();
    if(btn){btn.disabled=false;btn.innerHTML=orig;}
  }
}
window.exportPDF = exportPDF;
window.exportAiRewritePDF = exportAiRewritePDF;

function collectPrintStyles() {
  return Array.from(document.querySelectorAll('style,link[rel="stylesheet"]'))
    .map((node) => node.outerHTML)
    .join("\n");
}
function printDocumentFromHtml(html, title = "MentorX PDF") {
  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.cssText = [
    "position:fixed",
    "left:-10000px",
    "top:0",
    "width:794px",
    "height:1123px",
    "border:0",
    "opacity:0",
    "pointer-events:none"
  ].join(";");
  document.body.appendChild(iframe);
  const doc = iframe.contentDocument || iframe.contentWindow.document;
  doc.open();
  doc.write(`<!doctype html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>${escapeHtml(title)}</title>
        ${collectPrintStyles()}
        <style>
          @page { size: A4 portrait; margin: 12mm; }
          html, body { margin: 0 !important; padding: 0 !important; background: #FFFFFF !important; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .page { width: 100% !important; max-width: none !important; margin: 0 !important; padding: 0 !important; box-shadow: none !important; border: 0 !important; background: #FFFFFF !important; }
          .banner, .export-card, .footnote { display: none !important; }
          .brandbar { padding: 0 0 14px !important; }
          .brand-img { height: 42px !important; }
          .section { margin: 22px 0 !important; }
          .section-title { font-size: 20px !important; margin: 3px 0 8px !important; }
          .card, .tile, .service-card { border-radius: 12px !important; box-shadow: none !important; }
          .card { padding: 16px !important; }
          .tiles { gap: 10px !important; }
          .section, .card, .tile, .service-card, .advice-example, .ai-pdf-card, .ai-pdf-advice { break-inside: auto !important; page-break-inside: auto !important; }
          h1, h2, h3, .section-title, .ai-pdf-label { break-after: avoid; page-break-after: avoid; }
          .ai-rewrite-pdf { width: 100% !important; max-width: none !important; margin: 0 !important; padding: 0 !important; background: #FFFFFF !important; }
          .ai-rewrite-pdf h1 { font-size: 24px !important; margin: 8px 0 6px !important; }
          .ai-rewrite-pdf h2 { font-size: 16px !important; }
          .ai-rewrite-pdf h3 { font-size: 12.5px !important; }
          .ai-pdf-card { margin: 6px 0 !important; padding: 9px 11px !important; border-radius: 8px !important; box-shadow: none !important; }
          .ai-pdf-card p, .ai-pdf-card li { font-size: 11.5px !important; line-height: 1.5 !important; }
          .ai-pdf-advice { margin-top: 7px !important; padding-top: 7px !important; }
          .ai-pdf-grid { grid-template-columns: 1fr 1fr !important; }
          .ai-pdf-chip { font-size: 10.5px !important; }
        </style>
      </head>
      <body>${html}</body>
    </html>`);
  doc.close();
  const waitForIframeReady = async () => {
    const root = doc.body;
    if (doc.fonts?.ready) await doc.fonts.ready.catch(() => {});
    await waitForReportImages(root);
    await new Promise((resolve) => setTimeout(resolve, 150));
  };

  waitForIframeReady().then(() => {
    const win = iframe.contentWindow;
    const cleanup = () => setTimeout(() => iframe.remove(), 500);
    win.onafterprint = cleanup;
    win.focus();
    win.print();
    setTimeout(cleanup, 3000);
  }).catch((err) => {
    console.error(err);
    iframe.remove();
  });
}
function exportPDFPrint(){
  const pageEl = document.querySelector(".page");
  if (!pageEl) return;
  const clone = pageEl.cloneNode(true);
  clone.querySelectorAll(".banner,.export-card,.footnote").forEach((el) => el.remove());
  expandReportCloneForPrint(clone);
  printDocumentFromHtml(clone.outerHTML, "MentorX-Resume-Diagnostic-Report");
}
function exportAiRewritePDFPrint(){
  const el = buildAiRewritePdfElement();
  printDocumentFromHtml(el.outerHTML, "MentorX-AI-Resume-Rewrite-Prompt-Pack");
}
window.exportPDF = exportPDFPrint;
window.exportAiRewritePDF = exportAiRewritePDFPrint;
