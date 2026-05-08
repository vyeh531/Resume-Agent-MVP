const pdf = require("pdf-parse");
const mammoth = require("mammoth");

/**
 * 解析 PDF 文件，提取文本
 * @param {Buffer} fileBuffer - PDF 文件内容
 * @returns {Promise<string>} 提取的文本
 */
async function parsePDF(fileBuffer) {
  try {
    console.log("[PDF] 开始解析...");
    const data = await pdf(fileBuffer);
    const text = data.text;

    if (!text || text.trim().length === 0) {
      throw new Error(
        "PDF 中未找到文本内容（可能是扫描版 PDF）"
      );
    }

    console.log(
      `[PDF] 解析完成，提取 ${text.length} 字符`
    );
    return text;
  } catch (error) {
    console.error("[PDF] 解析失败:", error.message);
    throw new Error(
      `PDF 解析失败: ${error.message}`
    );
  }
}

/**
 * 解析 DOCX 文件，提取文本
 * @param {Buffer} fileBuffer - DOCX 文件内容
 * @returns {Promise<string>} 提取的文本
 */
async function parseDocx(fileBuffer) {
  try {
    console.log("[DOCX] 开始解析...");
    const result = await mammoth.extractRawText({
      buffer: fileBuffer,
    });
    const text = result.value;

    if (!text || text.trim().length === 0) {
      throw new Error("DOCX 中未找到文本内容");
    }

    console.log(
      `[DOCX] 解析完成，提取 ${text.length} 字符`
    );
    return text;
  } catch (error) {
    console.error("[DOCX] 解析失败:", error.message);
    throw new Error(
      `Word 文件解析失败: ${error.message}`
    );
  }
}

module.exports = {
  parsePDF,
  parseDocx,
};
