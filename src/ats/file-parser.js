"use strict";

// Use the lib path directly to avoid pdf-parse's index.js running a test-file
// read on import (which crashes in serverless environments where module.parent
// is undefined and isDebugMode evaluates to true).
const pdf = require("pdf-parse/lib/pdf-parse.js");
const mammoth = require("mammoth");

async function parsePDF(fileBuffer) {
  const data = await pdf(fileBuffer);
  const text = data.text || "";
  if (!text.trim()) {
    throw new Error("PDF 中没有可解析的文字，可能是扫描版 PDF。");
  }
  return text;
}

async function parseDocx(fileBuffer) {
  const result = await mammoth.extractRawText({ buffer: fileBuffer });
  const text = result.value || "";
  if (!text.trim()) {
    throw new Error("DOCX 中没有可解析的文字。");
  }
  return text;
}

async function parseUploadedFile(file) {
  if (!file) throw new Error("请上传 PDF、DOCX 或 TXT 简历。");
  const name = file.originalname.toLowerCase();
  if (name.endsWith(".pdf")) return parsePDF(file.buffer);
  if (name.endsWith(".docx")) return parseDocx(file.buffer);
  if (name.endsWith(".txt")) return file.buffer.toString("utf-8");
  throw new Error("暂不支持该文件格式，请上传 PDF、DOCX 或 TXT。");
}

module.exports = {
  parsePDF,
  parseDocx,
  parseUploadedFile
};
