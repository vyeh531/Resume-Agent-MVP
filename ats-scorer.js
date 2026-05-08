require("dotenv").config();
const Anthropic = require("@anthropic-ai/sdk");

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// ATS 评分 prompt
const ATS_PROMPT = `你是一套严格口径的 ATS 简历评分系统。你的任务是仅根据简历中可见的文本信息，对该简历进行一致性评分。

请严格遵守以下规则：
1. 不得虚构任何数字、地点、成果、职责或项目细节。
2. 不得因为学校名气、公司品牌或主观印象而额外加分。
3. 若未提供具体岗位 JD，必须标注为"通用方向估算"，并按简历最明显的目标方向保守评分。
4. 评分采用 100 分制，结构如下：A 解析与格式兼容性 20 分；B 信息完整性与结构组织 20 分；C 内容质量与成果表达 35 分；D 岗位关键词与 ATS 匹配性 15 分；E 最终投递完成度 10 分。
5. 风险等级必须输出为低 / 中 / 高之一。
6. 如果信息不足，请按较低分档处理，不做正向推断。

请按以下结构输出：
（1）ATS基础分：X / 100
（2）风险等级：低 / 中 / 高
（3）评分口径：是否提供 JD；若无，则写"通用方向估算"
（4）分项得分：A、B、C、D、E
（5）关键问题：至少 4 条，按影响程度排序
（6）优先修改建议：至少 3 条
（7）提分预期：仅在存在明确补充空间时给出保守区间

请保持语气专业、保守、可复核，不要输出夸张判断。`;

async function callClaude(resumeText, jobTitle, jdText) {
  const fullPrompt = `${ATS_PROMPT}

【简历信息】
${resumeText}

${jobTitle ? `【目标岗位】\n${jobTitle}\n` : ""}

${jdText ? `【岗位 JD】\n${jdText}\n` : ""}

请开始评分：`;

  try {
    console.log("[Claude] 调用 Claude 评分模型...");
    const message = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2000,
      messages: [
        {
          role: "user",
          content: fullPrompt,
        },
      ],
    });

    const response = message.content[0].text;
    console.log("[Claude] 评分完成");
    return response;
  } catch (error) {
    throw new Error(`Claude API 调用失败: ${error.message}`);
  }
}

function parseATSResponse(text) {
  const result = {
    rawResponse: text,
    basicScore: null,
    riskLevel: null,
    scoringBasis: null,
    itemScores: {},
    keyProblems: [],
    suggestions: [],
    improvementExpectation: null,
  };

  console.log("[Parser] Claude 原始响应长度:", text.length);

  // 提取基础分 - 支持 Markdown 格式 **71**
  let scoreMatch = text.match(/（1）.*?ATS.*?基础分[：:]\s*\*?\*?(\d+)\*?\*?\s*\/\s*100/);
  if (!scoreMatch) {
    scoreMatch = text.match(/ATS基础分[：:]\s*\*?\*?(\d+)\*?\*?\s*\/\s*100/);
  }
  if (scoreMatch) {
    result.basicScore = parseInt(scoreMatch[1]);
    console.log("[Parser] 提取基础分:", result.basicScore);
  } else {
    console.warn("[Parser] 未找到基础分");
  }

  // 提取风险等级 - 支持 Markdown **中**
  let riskMatch = text.match(/（2）.*?风险等级[：:]\s*\*?\*?(低|中|高)\*?\*?/);
  if (!riskMatch) {
    riskMatch = text.match(/风险等级[：:]\s*\*?\*?(低|中|高)\*?\*?/);
  }
  if (riskMatch) {
    result.riskLevel = riskMatch[1];
    console.log("[Parser] 提取风险等级:", result.riskLevel);
  } else {
    console.warn("[Parser] 未找到风险等级");
  }

  // 提取评分口径
  const basisMatch = text.match(/（3）.*?评分口径([\s\S]*?)(?=---|\(4\)|$)/);
  if (basisMatch) {
    result.scoringBasis = basisMatch[1].substring(0, 100).trim();
    console.log("[Parser] 提取评分口径:", result.scoringBasis.substring(0, 50));
  }

  // 提取分项得分 - 支持多种格式
  // 表格格式: | **A** | 项目名 | 得分 | 满分 |
  const tableLines = text.split('\n');
  const startIdx = tableLines.findIndex(line => line.includes('分项得分') || line.includes('| 维度'));

  if (startIdx !== -1) {
    for (let i = startIdx; i < Math.min(startIdx + 15, tableLines.length); i++) {
      const line = tableLines[i];
      // 匹配表格行：| **A** | ... | 14 | 20 | 或其他变种
      let match = line.match(/\|\s*\*?\*?([A-E])\*?\*?\s*\|\s*[^|]*\|\s*(\d+)\s*\|\s*\d+\s*\|/);

      // 如果没有找到，尝试其他格式：【A 格式兼容】14/20
      if (!match) {
        match = line.match(/【([A-E])\s*[^】]*】\s*(\d+)\s*\/\s*\d+/);
      }

      // 如果还没找到，尝试：A. 14/20 或 A: 14/20
      if (!match) {
        match = line.match(/^[^\w]*([A-E])[\.:\s]+(\d+)\s*\/\s*\d+/);
      }

      if (match) {
        const key = match[1];
        const score = parseInt(match[2]);
        result.itemScores[key] = score;
        console.log(`[Parser] 提取 ${key}: ${score}`);
      }
    }
  }

  console.log("[Parser] 最终分项得分:", result.itemScores);

  // 如果没有提取到分项得分，根据基础分推算
  if (Object.keys(result.itemScores).length === 0 && result.basicScore) {
    console.warn("[Parser] 无法从 Claude 响应中解析分项得分，使用推算值");
    // 基于总分的比例分配
    const totalScore = result.basicScore;
    const ratio = totalScore / 100;
    result.itemScores = {
      A: Math.round(20 * ratio),
      B: Math.round(20 * ratio),
      C: Math.round(35 * ratio),
      D: Math.round(15 * ratio),
      E: Math.round(10 * ratio),
    };
    console.log("[Parser] 推算分项得分:", result.itemScores);
  }

  // 提取关键问题 - 匹配多种格式
  let problemsMatch = text.match(/（5）[^（]*?关键问题([\s\S]*?)(?=（6）|优先修改建议|$)/i);
  if (!problemsMatch) {
    // 尝试不带（）的格式
    problemsMatch = text.match(/关键问题[：:]([\s\S]*?)(?=优先修改建议|优先建议|建议一|$)/i);
  }

  if (problemsMatch) {
    const problemsText = problemsMatch[1];
    // 按照 **① ... 【...】 或 **① ...【...】 的格式分割
    let problems = problemsText
      .split(/\*?\*?([①②③④⑤⑥⑦⑧⑨⑩])\*?\*?\s*([^【]*?)(?:【[^】]*】)?/g)
      .filter((p) => p.trim().length > 0 && !p.match(/^[①②③④⑤⑥⑦⑧⑨⑩]/))
      .map((p) => {
        const text = p.replace(/\n/g, ' ').trim();
        return text.substring(0, 200);
      })
      .filter((p) => p.length > 5);

    // 如果按照数字分割没有得到结果，尝试按行分割
    if (problems.length === 0) {
      problems = problemsText
        .split('\n')
        .map(p => p.replace(/^[^\w一-鿿]*/, '').trim()) // 移除开头的符号
        .filter(p => p.length > 10) // 只保留足够长的行
        .map(p => p.substring(0, 200));
    }

    result.keyProblems = problems.slice(0, 6);
    console.log("[Parser] 关键问题数:", result.keyProblems.length, result.keyProblems);
  } else {
    console.warn("[Parser] 未找到关键问题部分");
  }

  // 提取优先修改建议 - 匹配多种格式
  let suggestionsMatch = text.match(/（6）[^（]*?优先修改建议([\s\S]*?)(?=（7）|提分预期|$)/i);
  if (!suggestionsMatch) {
    // 尝试不带（）的格式
    suggestionsMatch = text.match(/优先修改建议[：:]([\s\S]*?)(?=提分预期|$)/i);
  }
  if (!suggestionsMatch) {
    // 尝试"优先建议"
    suggestionsMatch = text.match(/优先建议[：:]([\s\S]*?)(?=提分预期|$)/i);
  }

  if (suggestionsMatch) {
    const sugText = suggestionsMatch[1];
    // 按照 **建议一：** 或 **建议一** 的格式分割
    let suggestions = sugText
      .split(/\*?\*?建议[一二三四五六]\*?\*?[：:]/g)
      .filter((s) => s.trim().length > 5)
      .map((s) => {
        // 提取第一行标题
        const lines = s.split('\n').filter(l => l.trim().length > 0);
        const title = (lines[0] || '').replace(/^\*\*/, '').replace(/\*\*$/, '').trim();
        return title.substring(0, 180);
      })
      .filter((s) => s.length > 3);

    // 如果上面的分割没有得到结果，尝试按行分割
    if (suggestions.length === 0) {
      suggestions = sugText
        .split('\n')
        .map(s => s.replace(/^[^\w一-鿿]*/, '').trim())
        .filter(s => s.length > 10)
        .map(s => s.substring(0, 180));
    }

    result.suggestions = suggestions.slice(0, 6);
    console.log("[Parser] 建议数:", result.suggestions.length, result.suggestions);
  } else {
    console.warn("[Parser] 未找到优先修改建议部分");
  }

  // 提取提分预期
  const improvementMatch = text.match(/（7）.*?提分预期([\s\S]*?)$/);
  if (improvementMatch) {
    const lines = improvementMatch[1].split('\n').filter((l) => l.trim().length > 0);
    result.improvementExpectation = (lines[0] || '').trim().substring(0, 100);
    console.log("[Parser] 提分预期:", result.improvementExpectation);
  } else {
    console.warn("[Parser] 未找到提分预期");
  }

  return result;
}

async function scoreResumeATS(resumeText, jobTitle, jdText) {
  if (!resumeText || resumeText.trim().length === 0) {
    throw new Error("简历内容不能为空");
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error(
      "缺少 ANTHROPIC_API_KEY。请在 .env 文件中设置你的 Claude API Key。"
    );
  }

  try {
    // 调用 Claude
    const response = await callClaude(resumeText, jobTitle, jdText);

    // 解析响应
    const parsed = parseATSResponse(response);

    // 如果基础分为 null，设置默认值
    if (parsed.basicScore === null) {
      parsed.basicScore = 60; // 默认分数
    }

    return parsed;
  } catch (error) {
    console.error("[ATS Scorer] Error:", error.message);
    throw error;
  }
}

module.exports = {
  scoreResumeATS,
  parseATSResponse,
};
