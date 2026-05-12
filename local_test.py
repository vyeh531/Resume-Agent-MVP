#!/usr/bin/env python3
"""
local_test.py — Resume-Agent MVP 本地測試腳本
使用 Ollama 本地 LLM（無需 API key）對 test_mvp 裡每個 candidate 跑：
  1. ATS 評分
  2. 4 個導師 × 3 條建議 = 12 條建議
  3. 簡歷修改前後對比 (before/after)
輸出: test_results/report.html + test_results/results.json

用法:
  python local_test.py                         # 自動偵測 Ollama 模型
  python local_test.py --model qwen2.5:7b      # 指定模型
  python local_test.py --candidate bob         # 只跑某個人
"""

import os
import sys
import json
import re
import time
import sqlite3
import shutil
import argparse
import textwrap
import requests
from pathlib import Path
from datetime import datetime

# ── 路徑設定 ────────────────────────────────────────────────
SCRIPT_DIR   = Path(__file__).parent
DB_PATH      = SCRIPT_DIR / "mentor_kb-v5.db"
OUT_DIR      = SCRIPT_DIR / "test_results"
OLLAMA_URL   = "http://localhost:11434"

# 自動尋找 test_mvp（依序嘗試常見位置）
def _find_test_mvp() -> Path:
    candidates = [
        Path.home() / "Desktop" / "test_mvp",                        # Desktop（主要位置）
        Path(__file__).parent.parent / "test_mvp",                   # 同層目錄
        Path(__file__).parent.parent.parent / "Desktop" / "test_mvp",# 其他深度
    ]
    for p in candidates:
        if p.exists():
            return p
    return Path.home() / "Desktop" / "test_mvp"   # 預設（可能不存在）

TEST_MVP_DIR = _find_test_mvp()

OUT_DIR.mkdir(exist_ok=True)

# ── Ollama 相關 ──────────────────────────────────────────────
def get_available_models():
    try:
        r = requests.get(f"{OLLAMA_URL}/api/tags", timeout=5)
        r.raise_for_status()
        models = [m["name"] for m in r.json().get("models", [])]
        return models
    except Exception as e:
        return []

def call_ollama(model: str, system: str, user: str, temperature=0.3) -> str:
    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user",   "content": user},
        ],
        "stream": False,
        "options": {
            "temperature": temperature,
            "num_predict": 4096,
        }
    }
    try:
        r = requests.post(f"{OLLAMA_URL}/api/chat", json=payload, timeout=300)
        r.raise_for_status()
        return r.json()["message"]["content"].strip()
    except requests.exceptions.ConnectionError:
        raise RuntimeError(
            "❌ 無法連接 Ollama。請先執行: ollama serve\n"
            "   下載模型: ollama pull qwen2.5:7b"
        )
    except Exception as e:
        raise RuntimeError(f"Ollama 呼叫失敗: {e}")

# ── PDF 文字擷取 ──────────────────────────────────────────────
def extract_pdf_text(pdf_path: Path) -> str:
    try:
        import pdfplumber
        with pdfplumber.open(str(pdf_path)) as pdf:
            pages = [p.extract_text() or "" for p in pdf.pages]
        return "\n".join(pages).strip()
    except ImportError:
        pass
    try:
        from pypdf import PdfReader
        reader = PdfReader(str(pdf_path))
        return "\n".join(p.extract_text() or "" for p in reader.pages).strip()
    except Exception as e:
        raise RuntimeError(f"PDF 解析失敗: {e}")

# ── SQLite 知識庫 ─────────────────────────────────────────────
def load_kb(job_title: str = ""):
    """從 mentor_kb-v5.db 取出 segments 和 before_after_pairs"""
    if not DB_PATH.exists():
        print(f"  ⚠️  找不到 {DB_PATH}，跳過知識庫")
        return [], []

    # 複製到 /tmp 避免 WAL 鎖定
    tmp_db = Path("/tmp/mentor_kb_local.db")
    shutil.copy2(str(DB_PATH), str(tmp_db))
    wal = Path(str(DB_PATH) + "-wal")
    shm = Path(str(DB_PATH) + "-shm")
    if wal.exists(): shutil.copy2(str(wal), str(tmp_db) + "-wal")
    if shm.exists(): shutil.copy2(str(shm), str(tmp_db) + "-shm")

    conn = sqlite3.connect(str(tmp_db))
    conn.row_factory = sqlite3.Row
    kw = f"%{job_title.lower()}%"

    # Tier1: universal + keyword match
    segments = conn.execute(
        "SELECT * FROM segments WHERE generality='universal' AND (confidence='high' OR confidence IS NULL)"
        " AND (LOWER(topic) LIKE ? OR LOWER(L1) LIKE ? OR LOWER(L2) LIKE ?)"
        " ORDER BY background_fit DESC LIMIT 8",
        (kw, kw, kw)
    ).fetchall()

    # Fallback: universal top
    if len(segments) < 5:
        extra = conn.execute(
            "SELECT * FROM segments WHERE generality='universal' AND (confidence='high' OR confidence IS NULL)"
            " ORDER BY background_fit DESC LIMIT 10"
        ).fetchall()
        seen = {s["id"] for s in segments}
        for s in extra:
            if s["id"] not in seen:
                segments.append(s)

    segments = list(segments)[:12]

    # Before/after pairs
    pairs = conn.execute(
        "SELECT * FROM before_after_pairs ORDER BY RANDOM() LIMIT 12"
    ).fetchall()

    conn.close()
    return segments, list(pairs)

# ── ATS 評分 ──────────────────────────────────────────────────
ATS_SYSTEM = """你是一套嚴格的 ATS 簡歷評分系統。只根據簡歷文字進行評分，不虛構資訊。

評分採用 100 分制：
  A 解析與格式兼容性       20分
  B 信息完整性與結構組織   20分
  C 內容質量與成果表達     35分
  D 岗位關鍵詞與ATS匹配性  15分
  E 最終投遞完成度         10分

風險等級輸出：低 / 中 / 高

請按以下格式輸出（不要輸出其他任何內容）：
---ATS_RESULT_START---
基礎分: <數字>/100
風險等級: <低|中|高>
評分口徑: <是否提供JD；若無寫"通用方向估算">
分項得分:
  A: <分數>/20 — <一句說明>
  B: <分數>/20 — <一句說明>
  C: <分數>/35 — <一句說明>
  D: <分數>/15 — <一句說明>
  E: <分數>/10 — <一句說明>
關鍵問題:
  1. <問題>
  2. <問題>
  3. <問題>
  4. <問題>
優先修改建議:
  1. <建議>
  2. <建議>
  3. <建議>
提分預期: <如 +8~12分，或"暫無明確空間">
---ATS_RESULT_END---"""

def score_ats(model: str, resume_text: str, job_title: str, jd_text: str) -> dict:
    parts = [f"[簡歷]\n{resume_text[:3000]}"]
    if job_title:
        parts.append(f"\n[目標崗位]\n{job_title}")
    if jd_text:
        parts.append(f"\n[崗位JD]\n{jd_text[:2000]}")
    parts.append("\n請開始評分：")

    raw = call_ollama(model, ATS_SYSTEM, "".join(parts))
    return parse_ats(raw)

def parse_ats(text: str) -> dict:
    # Extract block between markers (or use full text)
    m = re.search(r"---ATS_RESULT_START---([\s\S]*?)---ATS_RESULT_END---", text)
    block = m.group(1) if m else text

    result = {
        "rawResponse": block,
        "basicScore":  None,
        "riskLevel":   None,
        "scoringBasis": None,
        "itemScores":  {},
        "keyProblems": [],
        "suggestions": [],
        "improvementExpectation": None,
    }

    # Score
    sm = re.search(r"基礎分[：:]\s*(\d+)\s*/\s*100", block) or \
         re.search(r"(\d+)\s*/\s*100", block)
    if sm: result["basicScore"] = int(sm.group(1))

    # Risk
    rm = re.search(r"風險等級[：:]\s*(低|中|高)", block)
    if rm: result["riskLevel"] = rm.group(1)

    # Scoring basis
    bm = re.search(r"評分口徑[：:]\s*(.+)", block)
    if bm: result["scoringBasis"] = bm.group(1).strip()

    # Item scores
    for letter in "ABCDE":
        im = re.search(rf"{letter}:\s*(\d+)/\d+\s*[—-]\s*(.+)", block)
        if im:
            result["itemScores"][letter] = {
                "score": int(im.group(1)),
                "comment": im.group(2).strip()
            }

    # Key problems
    problems_block = re.search(r"關鍵問題[：:]?\s*([\s\S]*?)(?=優先修改建議|$)", block)
    if problems_block:
        for line in problems_block.group(1).split("\n"):
            m = re.match(r"\s*\d+[.、。]\s*(.+)", line)
            if m: result["keyProblems"].append(m.group(1).strip())

    # Suggestions
    sugg_block = re.search(r"優先修改建議[：:]?\s*([\s\S]*?)(?=提分預期|$)", block)
    if sugg_block:
        for line in sugg_block.group(1).split("\n"):
            m = re.match(r"\s*\d+[.、。]\s*(.+)", line)
            if m: result["suggestions"].append(m.group(1).strip())

    # Improvement expectation
    ie_m = re.search(r"提分預期[：:]\s*(.+)", block)
    if ie_m: result["improvementExpectation"] = ie_m.group(1).strip()

    return result

# ── 導師建議 ──────────────────────────────────────────────────
MENTOR_SYSTEM = """你是一個資深職業顧問 AI。
你的任務是根據簡歷和崗位，模擬 4 位來自不同頂尖公司的導師，每位給出 3 條具體建議（含修改前後對比）。

輸出格式：只輸出一個合法的 JSON 陣列（不加 markdown 代碼框、不加任何說明），結構如下：
[
  {
    "name": "導師姓名（英文）",
    "company": "Google|Amazon|Goldman Sachs|McKinsey|Meta|Apple|Microsoft 其中一個",
    "role": "職位（中文）",
    "avatar": "一個 emoji",
    "tag": "20字內標籤（中文）",
    "credentials": ["資歷pill1", "資歷pill2", "資歷pill3"],
    "career_path": "職業路徑（中文，用 → 分隔）",
    "adviceList": [
      {
        "priority": "P0 必改",
        "issue": "核心問題標題（25字內）",
        "strategy": "[公司名]在篩選[崗位]時，...（60-120字）",
        "current": "此份簡歷的具體不足（60-100字）",
        "advice": "(1) 第一步 (2) 第二步 (3) 第三步（合計80-140字）",
        "beforeAfter": {
          "before": "原版英文簡歷句子（弱）",
          "after": "改寫後的英文簡歷句子（強）"
        }
      },
      { "priority": "P1 重要", ... },
      { "priority": "P2 建議", ... }
    ]
  },
  { 4個導師，每人3條建議 }
]

規則：
- 4 個導師來自不同公司，關注不同問題維度
- before 和 after 必須是英文簡歷句子
- after 中若有估算數字，用[[雙括號]]標注
- 其餘字段用中文
"""

def get_mentor_advice(model: str, resume_text: str, job_title: str,
                       ats_score, key_problems: list,
                       segments: list, pairs: list) -> list:

    seg_text = "\n".join(
        f"[S{i+1}] {dict(s).get('generality','')}\n"
        f"  主題:{dict(s).get('topic','')}\n"
        f"  洞察:{str(dict(s).get('I_insight',''))[:100]}\n"
        f"  行動:{str(dict(s).get('A_action',''))[:90]}"
        for i, s in enumerate(segments[:8])
    )

    pair_text = "\n".join(
        f"[P{i+1}] 前:{str(dict(p).get('before',''))[:80]} | 後:{str(dict(p).get('after',''))[:100]} | 理由:{str(dict(p).get('reason',''))[:60]}"
        for i, p in enumerate(pairs[:8])
    )

    problems_str = "\n".join(f"{i+1}. {p}" for i, p in enumerate(key_problems[:5]))

    user_prompt = (
        f"目標崗位: {job_title or '未指定'} | ATS: {ats_score or '?'}/100\n"
        f"關鍵問題:\n{problems_str}\n\n"
        f"知識庫片段（參考）:\n{seg_text}\n\n"
        f"改寫案例（參考）:\n{pair_text}\n\n"
        f"簡歷摘要（前2000字）:\n{resume_text[:2000]}\n\n"
        f"請輸出 4 位導師的建議 JSON："
    )

    raw = call_ollama(model, MENTOR_SYSTEM, user_prompt, temperature=0.4)

    # Parse JSON
    try:
        cleaned = re.sub(r"^```[a-z]*\n?", "", raw, flags=re.IGNORECASE)
        cleaned = re.sub(r"\n?```$", "", cleaned).strip()
        m = re.search(r"\[[\s\S]*\]", cleaned)
        mentors = json.loads(m.group(0) if m else cleaned)
        return mentors
    except json.JSONDecodeError as e:
        print(f"    ⚠️  JSON 解析失敗: {e}")
        print(f"    原始輸出前300字: {raw[:300]}")
        return []

# ── 主流程 ────────────────────────────────────────────────────
def process_candidate(model: str, folder: Path) -> dict:
    name = folder.name
    print(f"\n{'='*50}")
    print(f"  處理: {name}")
    print(f"{'='*50}")

    # 找 PDF 和 JD
    pdfs = list(folder.glob("*.pdf")) + list(folder.glob("*.PDF"))
    txts = list(folder.glob("*.txt"))

    if not pdfs:
        print(f"  ❌ 找不到 PDF，跳過")
        return None

    pdf_path = pdfs[0]
    jd_path  = txts[0] if txts else None

    print(f"  📄 簡歷: {pdf_path.name}")
    print(f"  📋 JD:   {jd_path.name if jd_path else '無'}")

    # 擷取文字
    print("  🔍 解析 PDF...")
    try:
        resume_text = extract_pdf_text(pdf_path)
        print(f"      → {len(resume_text)} 字元")
    except Exception as e:
        print(f"  ❌ PDF 解析錯誤: {e}")
        return None

    jd_text = ""
    job_title = ""
    if jd_path:
        raw_jd = jd_path.read_text(encoding="utf-8", errors="ignore")
        jd_text = raw_jd
        # 嘗試抓崗位名
        m = re.search(r"【崗位[^】]*】[：:]?\s*(.+)", raw_jd)
        if m:
            job_title = m.group(1).strip().split("\n")[0]
            print(f"  🎯 目標崗位: {job_title}")

    # ── ATS 評分 ──────────────────────────────────
    print("  📊 ATS 評分中...")
    t0 = time.time()
    ats_result = score_ats(model, resume_text, job_title, jd_text)
    print(f"      → 分數: {ats_result['basicScore']}/100  風險: {ats_result['riskLevel']}  ({time.time()-t0:.1f}s)")

    # ── 知識庫 ──────────────────────────────────
    print("  📚 查詢知識庫...")
    segments, pairs = load_kb(job_title)
    print(f"      → {len(segments)} segments, {len(pairs)} before/after pairs")

    # ── 導師建議 ──────────────────────────────────
    print("  🎓 生成 4 位導師建議（12 條）...")
    t0 = time.time()
    mentors = get_mentor_advice(
        model, resume_text, job_title,
        ats_result["basicScore"],
        ats_result["keyProblems"],
        segments, pairs
    )
    n_advice = sum(len(m.get("adviceList", [])) for m in mentors) if mentors else 0
    print(f"      → {len(mentors)} 導師, {n_advice} 條建議  ({time.time()-t0:.1f}s)")

    return {
        "candidate": name,
        "pdf": str(pdf_path.name),
        "jobTitle": job_title,
        "timestamp": datetime.now().isoformat(),
        "ats": ats_result,
        "mentors": mentors,
    }

# ── HTML 報告生成 ─────────────────────────────────────────────
def risk_color(level):
    return {"低": "#22c55e", "中": "#f59e0b", "高": "#ef4444"}.get(level or "", "#94a3b8")

def score_bar(score, max_score=100):
    pct = int(score / max_score * 100) if score else 0
    color = "#22c55e" if pct >= 70 else "#f59e0b" if pct >= 50 else "#ef4444"
    return f'<div style="background:#e2e8f0;border-radius:4px;height:8px;width:100%;"><div style="background:{color};height:8px;border-radius:4px;width:{pct}%;"></div></div>'

PRIORITY_COLORS = {
    "P0 必改": "#ef4444",
    "P1 重要": "#f59e0b",
    "P2 建議": "#3b82f6",
}

def build_html(results: list, model: str) -> str:
    generated = datetime.now().strftime("%Y-%m-%d %H:%M")

    cards = []
    for r in results:
        if not r:
            continue
        ats = r["ats"]
        score = ats.get("basicScore") or 0
        risk  = ats.get("riskLevel") or "未知"
        mentors = r.get("mentors") or []

        # Item scores table
        item_rows = ""
        labels = {"A":"解析/格式", "B":"完整性/結構", "C":"內容質量", "D":"關鍵詞匹配", "E":"投遞完成度"}
        maxes  = {"A":20, "B":20, "C":35, "D":15, "E":10}
        for letter, label in labels.items():
            s = ats.get("itemScores", {}).get(letter, {})
            sc = s.get("score", "?")
            cm = s.get("comment", "")
            pct = int(sc / maxes[letter] * 100) if isinstance(sc, int) else 0
            bar_color = "#22c55e" if pct >= 70 else "#f59e0b" if pct >= 50 else "#ef4444"
            item_rows += f"""
            <tr>
              <td style="padding:6px 8px;font-weight:600;color:#475569;">{letter}</td>
              <td style="padding:6px 8px;color:#64748b;">{label}</td>
              <td style="padding:6px 8px;text-align:center;font-weight:700;">{sc}/{maxes[letter]}</td>
              <td style="padding:6px 8px;width:120px;">
                <div style="background:#e2e8f0;border-radius:4px;height:6px;">
                  <div style="background:{bar_color};height:6px;border-radius:4px;width:{pct}%;"></div>
                </div>
              </td>
              <td style="padding:6px 8px;color:#64748b;font-size:13px;">{cm}</td>
            </tr>"""

        # Key problems
        problems_html = "".join(
            f'<li style="margin:4px 0;color:#64748b;">{p}</li>'
            for p in ats.get("keyProblems", [])
        )
        # Suggestions
        sugg_html = "".join(
            f'<li style="margin:4px 0;color:#64748b;">{s}</li>'
            for s in ats.get("suggestions", [])
        )

        # Mentor cards
        mentor_cards_html = ""
        for mentor in mentors:
            advice_items = ""
            for adv in mentor.get("adviceList", []):
                pri    = adv.get("priority", "P2 建議")
                pcolor = PRIORITY_COLORS.get(pri, "#3b82f6")
                before = adv.get("beforeAfter", {}).get("before", "")
                after  = adv.get("beforeAfter", {}).get("after", "")
                # highlight [[...]]
                after_h = re.sub(r"\[\[(.+?)\]\]",
                    r'<span style="background:#fef3c7;padding:0 2px;border-radius:2px;">\1</span>',
                    after)

                advice_items += f"""
                <div style="border:1px solid #e2e8f0;border-radius:8px;padding:14px;margin-bottom:10px;">
                  <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
                    <span style="background:{pcolor};color:white;padding:2px 8px;border-radius:12px;font-size:12px;font-weight:700;">{pri}</span>
                    <span style="font-weight:600;color:#1e293b;">{adv.get('issue','')}</span>
                  </div>
                  <p style="font-size:13px;color:#64748b;margin:4px 0;"><b>策略：</b>{adv.get('strategy','')}</p>
                  <p style="font-size:13px;color:#64748b;margin:4px 0;"><b>現狀：</b>{adv.get('current','')}</p>
                  <p style="font-size:13px;color:#334155;margin:4px 0;"><b>建議：</b>{adv.get('advice','')}</p>
                  <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px;">
                    <div style="background:#fef2f2;border-radius:6px;padding:8px;">
                      <div style="font-size:11px;font-weight:700;color:#ef4444;margin-bottom:4px;">✗ BEFORE</div>
                      <div style="font-size:12px;color:#475569;font-family:monospace;">{before}</div>
                    </div>
                    <div style="background:#f0fdf4;border-radius:6px;padding:8px;">
                      <div style="font-size:11px;font-weight:700;color:#22c55e;margin-bottom:4px;">✓ AFTER</div>
                      <div style="font-size:12px;color:#475569;font-family:monospace;">{after_h}</div>
                    </div>
                  </div>
                </div>"""

            mentor_cards_html += f"""
            <div style="border:1px solid #e2e8f0;border-radius:12px;padding:16px;background:#fafafa;">
              <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px;">
                <span style="font-size:32px;">{mentor.get('avatar','👤')}</span>
                <div>
                  <div style="font-weight:700;color:#1e293b;">{mentor.get('name','')}
                    <span style="font-size:12px;background:#dbeafe;color:#1d4ed8;padding:2px 6px;border-radius:4px;margin-left:6px;">{mentor.get('company','')}</span>
                  </div>
                  <div style="font-size:13px;color:#64748b;">{mentor.get('role','')} · {mentor.get('career_path','')}</div>
                  <div style="margin-top:4px;">{"".join(f'<span style="font-size:11px;background:#f1f5f9;color:#475569;padding:2px 6px;border-radius:4px;margin-right:4px;">{c}</span>' for c in mentor.get('credentials',[]))}</div>
                </div>
              </div>
              {advice_items}
            </div>"""

        cards.append(f"""
        <div id="cand-{r['candidate']}" style="margin-bottom:40px;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.06);">
          <!-- Header -->
          <div style="background:linear-gradient(135deg,#1e293b,#334155);color:white;padding:20px 24px;display:flex;align-items:center;justify-content:space-between;">
            <div>
              <h2 style="margin:0;font-size:20px;">{r['candidate'].title()}</h2>
              <div style="font-size:13px;opacity:.7;margin-top:2px;">{r.get('jobTitle','') or '崗位未知'} · {r.get('pdf','')}</div>
            </div>
            <div style="text-align:right;">
              <div style="font-size:36px;font-weight:800;">{score}</div>
              <div style="font-size:12px;opacity:.7;">ATS 分數 / 100</div>
              <div style="margin-top:4px;">
                <span style="background:{risk_color(risk)};color:white;padding:2px 8px;border-radius:8px;font-size:12px;font-weight:700;">{risk}風險</span>
              </div>
            </div>
          </div>

          <!-- ATS Section -->
          <div style="padding:20px 24px;border-bottom:1px solid #e2e8f0;">
            <h3 style="margin:0 0 14px;color:#1e293b;">📊 ATS 分項評分</h3>
            <table style="width:100%;border-collapse:collapse;font-size:14px;">
              <thead><tr style="background:#f8fafc;">
                <th style="padding:6px 8px;text-align:left;color:#94a3b8;font-size:12px;">項目</th>
                <th style="padding:6px 8px;text-align:left;color:#94a3b8;font-size:12px;">類別</th>
                <th style="padding:6px 8px;text-align:center;color:#94a3b8;font-size:12px;">得分</th>
                <th style="padding:6px 8px;color:#94a3b8;font-size:12px;">進度</th>
                <th style="padding:6px 8px;text-align:left;color:#94a3b8;font-size:12px;">說明</th>
              </tr></thead>
              <tbody>{item_rows}</tbody>
            </table>
            <p style="font-size:13px;color:#64748b;margin:10px 0 0;"><b>評分口徑：</b>{ats.get('scoringBasis','')}</p>
            <p style="font-size:13px;color:#64748b;margin:4px 0;"><b>提分預期：</b>{ats.get('improvementExpectation','')}</p>
          </div>

          <!-- Problems & Suggestions -->
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:0;border-bottom:1px solid #e2e8f0;">
            <div style="padding:16px 24px;border-right:1px solid #e2e8f0;">
              <h4 style="margin:0 0 8px;color:#ef4444;">🚨 關鍵問題</h4>
              <ul style="margin:0;padding-left:16px;">{problems_html}</ul>
            </div>
            <div style="padding:16px 24px;">
              <h4 style="margin:0 0 8px;color:#3b82f6;">✅ 優先修改建議</h4>
              <ul style="margin:0;padding-left:16px;">{sugg_html}</ul>
            </div>
          </div>

          <!-- Mentors -->
          <div style="padding:20px 24px;">
            <h3 style="margin:0 0 16px;color:#1e293b;">🎓 4 位導師 · 12 條建議</h3>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
              {mentor_cards_html}
            </div>
          </div>
        </div>""")

    nav_links = "".join(
        f'<a href="#cand-{r["candidate"]}" style="padding:6px 12px;background:#f1f5f9;border-radius:6px;color:#334155;text-decoration:none;font-size:13px;">'
        f'{r["candidate"].title()} — {r["ats"].get("basicScore","?")}分</a> '
        for r in results if r
    )

    all_cards = "\n".join(cards)

    return f"""<!DOCTYPE html>
<html lang="zh-TW">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Resume-Agent 本地測試報告</title>
<style>
  * {{ box-sizing: border-box; }}
  body {{ font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background:#f8fafc; margin:0; padding:24px; color:#1e293b; }}
  a {{ color: #3b82f6; }}
</style>
</head>
<body>
<div style="max-width:1200px;margin:0 auto;">
  <div style="background:linear-gradient(135deg,#0f172a,#1e3a5f);color:white;border-radius:16px;padding:28px;margin-bottom:28px;">
    <h1 style="margin:0;font-size:26px;">🤖 Resume-Agent 本地測試報告</h1>
    <p style="margin:8px 0 0;opacity:.7;">模型: {model} · 生成時間: {generated} · 候選人數: {len([r for r in results if r])}</p>
  </div>
  <div style="margin-bottom:24px;display:flex;flex-wrap:wrap;gap:8px;">
    {nav_links}
  </div>
  {all_cards}
</div>
</body>
</html>"""

# ── 入口 ──────────────────────────────────────────────────────
def main():
    parser = argparse.ArgumentParser(description="Resume-Agent 本地測試 (Ollama)")
    parser.add_argument("--model", default="", help="Ollama 模型名稱 (預設自動偵測)")
    parser.add_argument("--candidate", default="", help="只跑某個候選人 (資料夾名)")
    parser.add_argument("--data-dir", default="", help="test_mvp 資料夾路徑")
    args = parser.parse_args()

    # 資料夾
    data_dir = Path(args.data_dir) if args.data_dir else TEST_MVP_DIR
    if not data_dir.exists():
        print(f"❌ 找不到測試資料夾: {data_dir}")
        print(f"   請用 --data-dir 指定路徑，例如:")
        print(f"   python local_test.py --data-dir C:\\Users\\你的名字\\Desktop\\test_mvp")
        sys.exit(1)

    print(f"📁 資料夾: {data_dir}")

    # Ollama 模型
    models = get_available_models()
    if not models:
        print("\n❌ 無法連接 Ollama 或沒有已安裝模型")
        print("   請先:")
        print("   1. 安裝 Ollama: https://ollama.com")
        print("   2. 下載模型:  ollama pull qwen2.5:7b")
        print("   3. 啟動服務:  ollama serve")
        sys.exit(1)

    print(f"🦙 可用 Ollama 模型: {', '.join(models)}")

    if args.model:
        model = args.model
    else:
        # 偏好順序
        preferred = ["qwen2.5:7b", "qwen2.5", "qwen3", "llama3.2", "llama3",
                     "mistral", "gemma3", "gemma2", "phi3", "phi4"]
        model = models[0]
        for pref in preferred:
            for m in models:
                if pref.lower() in m.lower():
                    model = m
                    break
            else:
                continue
            break

    print(f"✅ 使用模型: {model}\n")

    # 找候選人資料夾
    folders = sorted([f for f in data_dir.iterdir() if f.is_dir()])
    if args.candidate:
        folders = [f for f in folders if f.name.lower() == args.candidate.lower()]
        if not folders:
            print(f"❌ 找不到候選人: {args.candidate}")
            sys.exit(1)

    print(f"👥 候選人: {[f.name for f in folders]}")

    results = []
    for folder in folders:
        try:
            result = process_candidate(model, folder)
            results.append(result)
        except RuntimeError as e:
            print(f"  ❌ 錯誤: {e}")
            results.append(None)
        except KeyboardInterrupt:
            print("\n⏸  已中斷")
            break

    # 儲存 JSON
    json_path = OUT_DIR / "results.json"
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(results, f, ensure_ascii=False, indent=2)
    print(f"\n💾 JSON 結果: {json_path}")

    # 生成 HTML
    valid = [r for r in results if r]
    if valid:
        html = build_html(valid, model)
        html_path = OUT_DIR / "report.html"
        with open(html_path, "w", encoding="utf-8") as f:
            f.write(html)
        print(f"📄 HTML 報告: {html_path}")
        print(f"\n✅ 完成！共 {len(valid)} 位候選人")
        print(f"   開啟報告: {html_path}")
    else:
        print("\n⚠️  沒有成功的結果")

if __name__ == "__main__":
    main()
