# Resume Fix MVP

MentorX × 蔓藤教育 · 简历诊断漏斗 MVP，集成本地 AI ATS 评分系统。

## 快速开始

### 有 AI 支持的版本（推荐）✨

需要 **Ollama** + **Node.js**：

1. **安装 Ollama**  
   - 下载：[ollama.ai](https://ollama.ai)  
   - 拉取模型：`ollama pull mistral`

2. **运行服务器**
   ```bash
   npm install
   npm start
   # 或 PowerShell：.\START.ps1
   # 或 Windows 批处理：START.bat
   ```

3. **打开浏览器**  
   访问 http://localhost:3000

📖 详细指南：见 [ATS-SETUP.md](./ATS-SETUP.md)

### 纯前端版本（无 AI）

**直接双击 `index.html`** 在浏览器里打开即可（使用 mock 数据展示流程）。

> 推荐用 Chrome/Edge，DevTools → Toggle Device Toolbar → iPhone 14 Pro (390×844) 看 mobile 效果。

## 5 步用户流程

```
index.html        →  login.html     →  result.html       →  payment.html   →  report.html
首页 + 表单           微信登录 mock      Dashboard + 锁定卡    扫码 mock 支付      4 位完整 + 导出
```

每页过完一次状态写入 `localStorage` 的 `resumeFixMVP` key,刷新不会丢。

## 重置状态

打开 DevTools → Console:
```js
localStorage.removeItem("resumeFixMVP"); location.href = "index.html";
```

## 文件结构

```
Resume Fix MVP/
├── design-system.html          视觉参考(原 design system 文档)
├── index.html                   首页 = 表单 + MentorX 介绍
├── login.html                   微信登录 mock
├── result.html                  Dashboard + 1 免费导师 + 3 锁定
├── payment.html                 ¥49 微信支付 mock
├── report.html                  完整 4 位导师 + Before/After + 二维码 + 导出 .md
├── README.md                    本文件
└── assets/
    ├── styles.css               设计 token + 组件类
    ├── mobile.css               desktop "手机预览" 增强 + 极窄屏微调
    ├── mock-data.js             所有简历分析的 mock(替换这一份就能接 LLM)
    └── app.js                   表单提交、跳转、loader、导出 .md / 复制
```

## 设计语言

完全沿用 `design-system.html` 的颜色/字体/圆角 token:

- 暖底色 `#f6f3ec` + 墨黑 `#181816`
- 双品牌色:Indigo(权威)+ Jade(学长)
- 红绿信号:Bad / Good / Warn
- 字体:Fraunces 衬线讲故事 / Inter Tight 讲数据 / JetBrains Mono 标徽章
- Mobile-first,`max-width: 480px`,desktop 上居中显示为"手机预览"

## 接入真实数据

`assets/mock-data.js` 是唯一的数据源。接入 LLM 时:

1. 把 `submitResume()` 在 `assets/app.js` 改成 POST 简历到后端
2. 后端调 LLM 拼成同 schema 的 JSON 返回
3. 把返回的 JSON 赋给 `window.MOCK`(或写 `localStorage.MOCK`)

所有页面都读 `window.MOCK`,不需要改 HTML。

## 不在范围

- ❌ 真实 PDF/DOCX 解析
- ❌ 真实 LLM
- ❌ 真实微信登录/支付 SDK
- ❌ 真实二维码(用 CSS 占位)
- ❌ 后端、数据库、用户系统

---

By Eric · MentorX · 2026
