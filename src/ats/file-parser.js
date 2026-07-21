"use strict";

// Use the lib path directly to avoid pdf-parse's index.js running a test-file
// read on import (which crashes in serverless environments where module.parent
// is undefined and isDebugMode evaluates to true).
const pdf = require("pdf-parse/lib/pdf-parse.js");
const mammoth = require("mammoth");
const JSZip = require("jszip");

const PARSER_CONCURRENCY = Math.max(1, Number(process.env.PARSER_CONCURRENCY || 2));
let activeParserJobs = 0;
const parserQueue = [];

function withParserSlot(task) {
  return new Promise((resolve, reject) => {
    parserQueue.push({ task, resolve, reject });
    drainParserQueue();
  });
}

function drainParserQueue() {
  while (activeParserJobs < PARSER_CONCURRENCY && parserQueue.length) {
    const job = parserQueue.shift();
    activeParserJobs += 1;
    Promise.resolve()
      .then(job.task)
      .then(job.resolve, job.reject)
      .finally(() => {
        activeParserJobs -= 1;
        drainParserQueue();
      });
  }
}

function hasPdfSignature(fileBuffer) {
  return Buffer.isBuffer(fileBuffer) && fileBuffer.slice(0, 5).toString("utf8") === "%PDF-";
}

function hasZipSignature(fileBuffer) {
  return Buffer.isBuffer(fileBuffer) &&
    fileBuffer.length >= 4 &&
    fileBuffer[0] === 0x50 &&
    fileBuffer[1] === 0x4b &&
    (fileBuffer[2] === 0x03 || fileBuffer[2] === 0x05 || fileBuffer[2] === 0x07) &&
    (fileBuffer[3] === 0x04 || fileBuffer[3] === 0x06 || fileBuffer[3] === 0x08);
}

async function parsePDF(fileBuffer) {
  if (!hasPdfSignature(fileBuffer)) {
    throw new Error("Invalid PDF file.");
  }
  const data = await pdf(fileBuffer);
  const text = data.text || "";
  if (!text.trim()) {
    throw new Error("PDF 中没有可解析的文字，可能是扫描版 PDF。");
  }
  return text;
}

async function parseDocx(fileBuffer) {
  if (!hasZipSignature(fileBuffer)) {
    throw new Error("Invalid DOCX file.");
  }
  if (await docxContainsHiddenText(fileBuffer)) {
    throw new Error("DOCX contains hidden text.");
  }
  const result = await mammoth.extractRawText({ buffer: fileBuffer });
  const text = result.value || "";
  if (!text.trim()) {
    throw new Error("DOCX 中没有可解析的文字。");
  }
  return text;
}

async function docxContainsHiddenText(fileBuffer) {
  const zip = await JSZip.loadAsync(fileBuffer);
  const filesToInspect = Object.keys(zip.files).filter((name) =>
    /^word\/(?:document|styles|header\d+|footer\d+)\.xml$/i.test(name)
  );
  for (const name of filesToInspect) {
    const xml = await zip.files[name].async("string");
    if (/<w:vanish\b|<w:webHidden\b/i.test(xml)) return true;
  }
  return false;
}

async function parseUploadedFile(file) {
  if (!file) throw new Error("请上传 PDF、DOCX 或 TXT 简历。");
  const name = file.originalname.toLowerCase();
  if (name.endsWith(".pdf")) return withParserSlot(() => parsePDF(file.buffer));
  if (name.endsWith(".docx")) return withParserSlot(() => parseDocx(file.buffer));
  if (name.endsWith(".txt")) return file.buffer.toString("utf-8");
  throw new Error("暂不支持该文件格式，请上传 PDF、DOCX 或 TXT。");
}

module.exports = {
  parsePDF,
  parseDocx,
  parseUploadedFile,
  hasPdfSignature,
  hasZipSignature,
  docxContainsHiddenText
};
