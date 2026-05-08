# 本地 AI ATS 评分系统 · 快速启动指南

## 🎯 概述

这个系统集成了**本地运行的 AI 模型**（Ollama）来进行简历 ATS 评分。无需调用任何云 API，所有数据在本地处理。

**架构：**
```
浏览器 (index.html) 
  ↓
Node.js Express 服务器 (server.js)
  ↓
本地 AI 模型 (Ollama + Mistral)
  ↓
ATS 评分结果 (JSON)
```

---

## ⚙️ 前置条件

### 1. 安装 Node.js
- 下载：[nodejs.org](https://nodejs.org) → LTS 版本
- 验证：`node --version` 应返回 v18+ 或更高

### 2. 安装 Ollama（必须）
- **下载地址：** [ollama.ai](https://ollama.ai)
- 选择对应系统：macOS / Linux / Windows

### 3. 下载模型
安装完 Ollama 后，打开终端/命令行，运行：

```bash
ollama pull mistral
```

这会下载 Mistral 模型（约 4GB，首次运行需要等待）。

> 💡 可选模型：`ollama pull llama2`（官方 Llama 2）、`ollama pull neural-chat`（更快的推理）等

### 4. 启动 Ollama 服务
Ollama 安装后，应该会自动在后台运行。验证：

```bash
curl http://localhost:11434/api/tags
```

如果返回 JSON，说明 Ollama 服务正常运行。

---

## 🚀 快速启动

### Windows
1. **双击** `START.bat`
2. 脚本会自动：
   - 安装 npm 包（首次）
   - 启动 Node.js 服务器
3. 打开浏览器访问 **http://localhost:3000**

### macOS / Linux
```bash
# 终端中进入项目目录
cd /path/to/Resume-Agent-MVP

# 安装依赖（首次）
npm install

# 启动服务器
npm start
```

---

## 📋 使用流程

### 第一次使用

1. **准备简历文件**
   - 支持格式：
     - ✅ **PDF** (`.pdf`) — 自动提取文本
     - ✅ **Word** (`.docx` / `.doc`) — 自动解析
     - ✅ **纯文本** (`.txt`) — 直接上传
   - 无需提前转换格式！

2. **访问应用**
   - 打开 http://localhost:3000
   - 填写表单：
     - **上传简历** → 选择 PDF / Word / TXT 文件
     - **目标岗位** → 如 "Product Manager" / "Software Engineer"
     - **岗位 JD**（可选）→ 贴上岗位描述

3. **提交评分**
   - 点击 **"30 秒生成诊断报告"**
   - 系统会自动：
     - ① 解析文件内容（PDF/DOCX → 纯文本）
     - ② 调用 AI 进行 ATS 评分
     - ③ 返回详细结果
   - 通常总耗时 15-45 秒（取决于文件大小和 AI 响应）
   - 结果会自动跳转到诊断页面

4. **查看结果**
   - 页面展示 ATS 评分（0-100）
   - 风险等级（低/中/高）
   - 分项得分（A-E 五维度）
   - 关键问题 + 优先修改建议

---

## 🔧 ATS 评分标准

按照严格口径：

| 维度 | 满分 | 说明 |
|------|------|------|
| **A** | 20 | 解析与格式兼容性（能否被 ATS 系统识别） |
| **B** | 20 | 信息完整性与结构组织（内容是否完整清晰） |
| **C** | 35 | 内容质量与成果表达（成果是否具体量化） |
| **D** | 15 | 岗位关键词与 ATS 匹配性（是否包含 JD 关键词） |
| **E** | 10 | 最终投递完成度（是否完整可投递） |

**总分 = A + B + C + D + E = 100 分**

---

## 📝 常见问题

### Q: "无法连接到 Ollama"
**A:** 
- 检查 Ollama 是否运行：`curl http://localhost:11434/api/tags`
- Windows：查看任务栏是否有 Ollama 图标
- 重启 Ollama 服务

### Q: "评分很慢"
**A:** 
- Mistral 首次推理需要加载到显存，通常 10-30 秒
- 后续评分会快一些（缓存）
- 可改用更小的模型：`ollama pull neural-chat`

### Q: "无法读取 Word/PDF 文件"
**A:** 
- 系统支持 **PDF** (`.pdf`)、**Word** (`.docx` / `.doc`) 和 **纯文本** (`.txt`)
- 确保文件格式正确，文件大小 < 50MB
- 如遇到错误，检查：
  - 是否有 npm 包完整安装：`npm install`
  - 如果是 **扫描版 PDF**（纯图片），无法提取文本
  - 可尝试转换为 DOCX 后再上传

### Q: "能否调用云 API 或其他模型？"
**A:** 
当前用的是 Ollama 的本地推理。未来可扩展为：
- Azure OpenAI / Anthropic Claude（修改 ats-scorer.js）
- 其他本地模型（改 `MODEL = "xxx"`）

---

## 🛠️ 开发

### 项目结构
```
Resume-Agent-MVP/
├── server.js                 # Express 服务器入口
├── ats-scorer.js             # ATS 评分核心逻辑（调用 Ollama）
├── file-parser.js            # 文件解析模块（PDF/DOCX/TXT）
├── package.json              # npm 依赖
├── START.bat                 # Windows 启动脚本
├── START.ps1                 # PowerShell 启动脚本
├── ATS-SETUP.md              # 本文档
├── index.html                # 首页（表单）
├── result.html               # 结果页（ATS 分数展示）
├── assets/
│   ├── api-client.js         # 前端 API 调用（包括文件上传）
│   ├── app.js                # 页面交互逻辑
│   ├── styles.css            # 样式
│   └── mock-data.js          # Mock 数据（原型参考）
```

### 修改 Prompt
编辑 `ats-scorer.js` 第 8-26 行的 `ATS_PROMPT`：

```javascript
const ATS_PROMPT = `你是...`; // 修改这里
```

### 调试
```bash
# 查看详细日志
NODE_DEBUG=* npm start

# 直接测试 ATS 评分
curl -X POST http://localhost:3000/api/score-resume \
  -H "Content-Type: application/json" \
  -d '{"resumeText": "我是...简历文本...", "jobTitle": "PM", "jdText": ""}'
```

---

## 📊 输出示例

**ATS 评分结果 JSON：**
```json
{
  "basicScore": 75,
  "riskLevel": "中",
  "scoringBasis": "有 JD · 保守评估",
  "itemScores": {
    "A": 18,  // 格式兼容性
    "B": 19,  // 信息完整性
    "C": 28,  // 内容质量
    "D": 7,   // 岗位匹配
    "E": 9    // 投递完成度
  },
  "keyProblems": [
    "缺少具体的项目成果量化（如转化率、性能提升）",
    "JD 中 'Product Strategy' 关键词未出现",
    "工作成就描述多用被动语态，不够突出个人贡献",
    "没有清晰的职业进阶轨迹"
  ],
  "suggestions": [
    "补充 Top 3 项目的 STAR 法则描述（Situation-Task-Action-Result）",
    "在摘要部分突出 'Product Manager', 'Strategy' 等 JD 高频词",
    "改写 bullet 为主动语态，量化成果（如 '提升用户留存 15%'）"
  ]
}
```

---

## 🔐 隐私与安全

- ✅ **完全本地处理**：简历文本不上传到任何云服务
- ✅ **离线运行**：无需互联网连接（只需首次下载模型）
- ✅ **开源透明**：所有代码可见，可自由修改

---

## 📞 问题排查

如遇到问题，检查以下清单：

- [ ] Ollama 已安装且服务在运行（端口 11434）
- [ ] Node.js 版本 >= 14
- [ ] npm install 已执行
- [ ] 防火墙允许 localhost:3000 和 localhost:11434
- [ ] 简历文件为 .txt 格式（或粘贴文本）

---

## 📚 扩展方向

未来可以：
1. **多模型支持**：让用户选择 Mistral / Llama2 / 其他模型
2. **批量评分**：支持一次性评分多份简历
3. **自定义 Prompt**：根据公司需求定制评分标准
4. **评分历史**：保存历次评分记录
5. **导出报告**：生成 PDF 版诊断报告

---

**最后更新：2026-05-07**  
**技术栈：Node.js + Express + Ollama + Vanilla JS**
