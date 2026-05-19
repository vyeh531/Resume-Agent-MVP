# Resume ATS API

兩個評分引擎，相同請求格式，方便比較。

## 本地啟動

```bash
git clone <repo>
cd Resume-Agent-MVP
npm install
cp .env.example .env          # 填入 ANTHROPIC_API_KEY（AI 引擎才需要）
node server.js                # 預設 http://localhost:3000
```

---

## Endpoints

### `GET /api/v1/ats/health`
確認 server 狀態與 API Key 是否設置。

**回應範例**
```json
{
  "success": true,
  "server": "ok",
  "ruleEngine": "ready",
  "aiEngine": "ready",
  "timestamp": "2026-05-19T10:00:00.000Z"
}
```

---

### `POST /api/v1/ats/rule`  ★ 主要使用，不需 API Key
規則式評分，秒回，不消耗 API Credits。

**維度權重**
| 維度 | 說明 | 滿分 |
|------|------|------|
| A | 格式兼容性 | 15 |
| B | 資訊完整性 | 10 |
| C | 內容品質（量化/動詞/成果） | 25 |
| **D** | **JD 關鍵字匹配（核心）** | **40** |
| E | 投遞完成度 | 10 |
| | **Total** | **100** |

D 佔 40 分——這也是真實 ATS 系統的核心邏輯：有沒有和 JD 說一樣的話。

**方式一：JSON**
```http
POST /api/v1/ats/rule
Content-Type: application/json

{
  "resumeText": "John Smith  john@email.com  ...",
  "jobTitle":   "Software Engineer",
  "jdText":     "We need a SWE with Python, SQL, AWS experience..."
}
```

**方式二：上傳 PDF / DOCX / TXT**
```http
POST /api/v1/ats/rule
Content-Type: multipart/form-data

file:     <resume.pdf>
jobTitle: Software Engineer
jdText:   We need a SWE with Python, SQL, AWS...
```

**回應結構**
```json
{
  "success": true,
  "engine":  "rule-based",
  "data": {
    "total":  52,
    "risk":   "高",
    "dimensions": {
      "A": { "score": 13, "max": 15, "label": "格式兼容性" },
      "B": { "score":  9, "max": 10, "label": "資訊完整性" },
      "C": { "score": 16, "max": 25, "label": "內容品質" },
      "D": { "score":  7, "max": 40, "label": "JD關鍵字匹配（核心）" },
      "E": { "score":  7, "max": 10, "label": "投遞完成度" }
    },
    "jdMatchRatio": 24.5,
    "topMissingKw": ["kubernetes", "ci/cd", "microservices"],
    "problems": [
      "JD 關鍵字匹配率僅 24%（需 ≥50% 通過機篩），D 維度損失 33 分",
      "量化指標僅 2 個（建議 ≥5 個）"
    ],
    "suggestions": [
      "補充 JD 關鍵字（現 24% → 目標 ≥50%）：kubernetes、ci/cd、microservices",
      "加入量化數字（現 2 個 → 目標 ≥5 個）：使用 %、$、K+、倍速等格式",
      "以強動詞開頭每條 bullet，替換 helped/assisted/worked on 等弱動詞"
    ],
    "improvement": "52 → 70（補充 JD 關鍵字 +14、量化成果 +4）"
  },
  "timestamp": "2026-05-19T10:00:00.000Z"
}
```

**分數解讀**
| 分數區間 | 風險 | 含義 |
|---------|------|------|
| 75–100 | 低 | 關鍵字高度匹配，有機會通過機篩 |
| 55–74  | 中 | 部分匹配，需補充關鍵字 |
| < 55   | 高 | 低匹配，機篩大概率被過濾 |

---

### `POST /api/v1/ats/ai`
Claude AI 深度評分。請求格式與 `/api/v1/ats/rule` 完全相同。

- Server 需設置 `ANTHROPIC_API_KEY`（可先用 `/api/v1/ats/health` 確認）
- 約 10–20 秒回應
- 回傳格式與規則引擎一致，另含 `rawResponse`（Claude 完整分析原文）

---

### `POST /api/parse-file`
只做文件解析，回傳純文字。可先把 PDF 轉成文字再貼入評分請求。

```http
POST /api/parse-file
Content-Type: multipart/form-data

file: <resume.pdf>
type: pdf
```

---

## 快速測試（curl）

```bash
# Health check
curl http://localhost:3000/api/v1/ats/health

# 規則評分（JSON）
curl -X POST http://localhost:3000/api/v1/ats/rule \
  -H "Content-Type: application/json" \
  -d '{
    "resumeText": "John Smith  john@gmail.com  linkedin.com/in/john\nExperience\n• Led ML pipeline development, reducing processing time by 40%\n• Built data warehouse serving 5M+ daily users\nEducation: BS Computer Science\nSkills: Python, SQL, AWS, Spark",
    "jobTitle": "Data Engineer",
    "jdText": "Data engineer with Python, SQL, AWS, Spark, Airflow, ETL pipeline experience"
  }'

# 上傳 PDF（規則評分）
curl -X POST http://localhost:3000/api/v1/ats/rule \
  -F "file=@/path/to/resume.pdf" \
  -F "jobTitle=Software Engineer" \
  -F "jdText=Python React Node.js AWS microservices CI/CD Docker Kubernetes"
```

---

## Postman 匯入

1. 開啟 Postman → Import → 選擇 `postman_collection.json`
2. 修改 Collection Variable `base_url` 為你的 server 地址
3. 直接執行 Request 1（規則評分）測試

---

## .env 設置

```env
ANTHROPIC_API_KEY=sk-ant-...    # AI 引擎必填，規則引擎不需要
PORT=3000                        # 可選，預設 3000
```
