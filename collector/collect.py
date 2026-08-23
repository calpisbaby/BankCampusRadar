#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
银招雷达 · 每日采集器 (collect.py)
=================================
纯标准库实现，无需 pip 安装任何依赖。

职责（每日巡检，由 cron 触发）:
  1. 遍历 collector/bank_sources.json 中所有银行招聘官网/校招页
  2. 抓取页面文本，识别"校招/秋招/春招/管培生/招聘公告"类链接与时间线索
  3. 与上次快照 (collector/cache/snapshot.json) 比对，找出"新增公告"
  4. 可选 --deep: 对新增公告页面做启发式字段提取（学历/地点/截止/批次/届别）
  5. 新增公告追加到 collector/cache/pending_announcements.json
     （由 cron 智能体审核后经 commit_pending.py 合并进 data/positions.js）
  6. 向 stdout 输出巡检报告（cron 智能体据此生成每日摘要）

用法:
  python collector/collect.py                # 全量巡检
  python collector/collect.py --limit 6      # 只巡检前 6 家银行(联调)
  python collector/collect.py --deep         # 对新增公告页面做字段提取
  python collector/collect.py --timeout 12   # 单页超时秒数(默认 15)
"""
import argparse
import hashlib
import html
import json
import os
import re
import ssl
import sys
import urllib.request
import urllib.error
from datetime import date, datetime

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
COLLECTOR_DIR = os.path.join(BASE_DIR, "collector")
CACHE_DIR = os.path.join(COLLECTOR_DIR, "cache")
SOURCES_FILE = os.path.join(COLLECTOR_DIR, "bank_sources.json")
SNAPSHOT_FILE = os.path.join(CACHE_DIR, "snapshot.json")
PENDING_FILE = os.path.join(CACHE_DIR, "pending_announcements.json")

UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36"

# 兼容国内银行网站常见的旧版 TLS 重协商（OpenSSL 3 默认拦截）
_SSL_CTX = None


def ssl_ctx():
    global _SSL_CTX
    if _SSL_CTX is None:
        _SSL_CTX = ssl.create_default_context()
        try:
            _SSL_CTX.options |= getattr(ssl, "OP_LEGACY_SERVER_CONNECT", 0x4)
        except Exception:  # noqa: BLE001
            pass
        _SSL_CTX.check_hostname = False
        _SSL_CTX.verify_mode = ssl.CERT_NONE
    return _SSL_CTX

# 招聘公告关键词
KEYWORDS = [
    "校园招聘", "校招", "秋招", "春招", "管培生", "招聘公告", "招募",
    "20\\d{2}届", "Global Graduate", "Graduate Program", "Internship",
    "Analyst Program", "校园大使",
]
KEYWORD_RE = re.compile("|".join(KEYWORDS), re.IGNORECASE)

# 日期提取
DATE_IN_TITLE_RE = re.compile(r"(20\d{2})\s*届")
DATE_ISO_RE = re.compile(r"(20\d{2})[年./-](\d{1,2})[月./-](\d{1,2})")

# 城市清单（用于启发式地点提取）
CITIES = ["北京", "上海", "广州", "深圳", "天津", "重庆", "杭州", "宁波", "南京", "苏州",
          "成都", "武汉", "西安", "长沙", "郑州", "济南", "青岛", "大连", "沈阳", "哈尔滨",
          "福州", "厦门", "合肥", "南昌", "昆明", "贵阳", "兰州", "乌鲁木齐", "南宁", "海口",
          "太原", "石家庄", "呼和浩特", "银川", "西宁", "拉萨", "香港", "澳门", "新加坡", "伦敦", "纽约", "东京"]

# 岗位类型关键词（启发式）
TYPE_KEYWORDS = [
    "管培生", "管理培训生", "信息技术", "金融科技", "FinTech", "科技菁英",
    "客户经理", "综合柜员", "柜面", "业务营销", "市场营销", "数据分析",
    "综合业务", "销售", "运营", "财富管理", "私人银行", "投资银行", "金融市场",
    "风险管理", "合规", "审计", "Global Graduate", "International Graduate",
    "Analyst", "Internship", "暑期实习",
]

# 批次关键词
BATCH_KEYWORDS = [
    ("春招提前批", ["春招提前批", "春季校园招聘提前批"]),
    ("春招正式批", ["春招正式批", "春季校园招聘", "春季招聘", "春招"]),
    ("秋招提前批", ["秋招提前批", "秋季校园招聘提前批", "提前批", "校招提前批"]),
    ("秋招正式批", ["秋招正式批", "秋季校园招聘", "秋季招聘", "秋招", "校园招聘", "校招"]),
]

LEVEL_KEYWORDS = [
    ("总行", ["总行", "总行管培生"]),
    ("境内分支行", ["分行", "分支机构", "一级分行"]),
    ("港澳台及海外机构", ["港澳台", "海外机构", "境外", "香港分行", "澳门"]),
    ("子公司", ["子公司", "金科", "理财子公司", "金融科技公司"]),
]


def log(msg):
    print(msg, flush=True)


def http_get(url, timeout):
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "text/html,*/*"})
    try:
        with urllib.request.urlopen(req, timeout=timeout, context=ssl_ctx()) as resp:
            raw = resp.read()
    except urllib.error.HTTPError as e:
        return None, "HTTP %s" % e.code
    except urllib.error.URLError as e:
        return None, "URL %s" % e.reason
    except Exception as e:  # noqa: BLE001
        return None, "%s" % e
    # 解码：优先 utf-8，乱码则回退 gb18030
    for enc in ("utf-8", "gb18030"):
        try:
            return raw.decode(enc), None
        except (UnicodeDecodeError, LookupError):
            continue
    return raw.decode("utf-8", errors="ignore"), None


def absolutize(base, href):
    from urllib.parse import urljoin
    if not href:
        return None
    href = href.strip()
    if href.startswith(("javascript:", "#", "mailto:")):
        return None
    return urljoin(base, href)


def clean_text(s):
    s = re.sub(r"<[^>]+>", " ", s)
    s = html.unescape(s)
    s = re.sub(r"\s+", " ", s).strip()
    return s


def extract_links(page_text, base_url):
    """从 HTML 中提取 (链接, 锚文本) 列表。"""
    out = []
    for m in re.finditer(r'<a[^>]+href=["\']([^"\']+)["\'][^>]*>(.*?)</a>', page_text, re.S | re.I):
        href, anchor = m.group(1), clean_text(m.group(2))
        url = absolutize(base_url, href)
        if url and anchor:
            out.append((url, anchor[:120]))
    return out


def detect_candidates(bank, page_text, base_url, today_iso):
    """从页面中识别校招公告候选链接。"""
    cands = []
    links = extract_links(page_text, base_url)
    # 页面正文关键词命中数（用于置信度）
    body_hits = len(KEYWORD_RE.findall(page_text))
    seen = set()
    # 泛化锚文本（导航/栏目入口，非具体公告）需要更严格的判定
    GENERIC_ANCHORS = {"招聘公告", "校园招聘", "社会招聘", "更多", "更多>>", "查看更多", "查看详情", "进入", "在线投递", "立即申请"}
    for url, anchor in links:
        if url in seen:
            continue
        seen.add(url)
        if not KEYWORD_RE.search(anchor):
            continue
        anchor_t = anchor.strip()
        if len(anchor_t) < 5 or anchor_t in GENERIC_ANCHORS:
            continue
        # 具体公告需命中"届别/年度/季节/项目名"等特征，避免栏目页误报
        if not re.search(r"20\d{2}\s*届|20\d{2}\s*年|秋招|春招|校招|管培|实习生|Intern|Graduate|Analyst|校园招聘计划|招聘计划|提前批|Global", anchor_t, re.I):
            continue
        title = anchor_t[:90]
        year_m = DATE_IN_TITLE_RE.search(title) or DATE_IN_TITLE_RE.search(page_text[:4000])
        date_iso = None
        if year_m:
            # 以"届别-1年"近似公告年（秋招公告年在届别前一年；春招同一年）
            y = int(year_m.group(1))
            date_iso = "%d-09-01" % (y - 1)
        m2 = DATE_ISO_RE.search(title)
        if m2:
            y, mo, d = int(m2.group(1)), int(m2.group(2)), int(m2.group(3))
            date_iso = "%04d-%02d-%02d" % (y, mo, d)
        cands.append({
            "bank_id": bank["bank_id"],
            "bank_name": bank["name"],
            "title": title,
            "url": url,
            "detected_date": date_iso or today_iso,
            "body_hits": body_hits,
            "found": today_iso,
        })
    return cands


def heuristic_extract(page_text, candidate):
    """对公告页做启发式字段提取（best-effort，供人工/智能体审核）。"""
    text = clean_text(page_text)
    out = {"draft": True}

    # 学历
    if re.search(r"博士", text):
        out["edu"] = "博士"
    elif re.search(r"硕士", text):
        out["edu"] = "硕士及以上"
    elif re.search(r"本科", text):
        out["edu"] = "本科及以上"

    # 截止日期
    dead = None
    for pat in [
        r"截止[日期]*[：:\s]*(\d{4})[年./-](\d{1,2})[月./-](\d{1,2})",
        r"(\d{4})[年./-](\d{1,2})[月./-](\d{1,2})[日]?[前止]",
        r"网申[截止]*[：:\s]*(\d{4})[年./-](\d{1,2})[月./-](\d{1,2})",
        r"报名[截止]*[：:\s]*(\d{4})[年./-](\d{1,2})[月./-](\d{1,2})",
    ]:
        m = re.search(pat, text)
        if m:
            dead = "%04d-%02d-%02d" % (int(m.group(1)), int(m.group(2)), int(m.group(3)))
            break
    if dead:
        out["deadline"] = dead

    # 批次与届别
    for label, kws in BATCH_KEYWORDS:
        if any(k in text for k in kws):
            out["batch"] = label
            break
    tm = re.search(r"(20\d{2})\s*届", text)
    if tm:
        out["target"] = int(tm.group(1))

    # 层级
    for label, kws in LEVEL_KEYWORDS:
        if any(k in text for k in kws):
            out["level"] = label
            break

    # 地点
    found = [c for c in CITIES if c in text]
    if found:
        out["locs"] = found[:4]

    # 岗位类型
    for kw in TYPE_KEYWORDS:
        if kw in text:
            out["type"] = kw
            break

    fields = sum(1 for k in ("edu", "deadline", "batch", "target", "level", "locs", "type") if k in out)
    out["confidence"] = min(1.0, fields / 6.0)
    return out


def main():
    ap = argparse.ArgumentParser(description="银招雷达每日采集器")
    ap.add_argument("--limit", type=int, default=0, help="只巡检前 N 家银行（0=全部）")
    ap.add_argument("--timeout", type=int, default=15, help="单页超时秒数")
    ap.add_argument("--deep", action="store_true", help="对新增公告页面做字段提取")
    args = ap.parse_args()

    os.makedirs(CACHE_DIR, exist_ok=True)
    with open(SOURCES_FILE, "r", encoding="utf-8") as f:
        sources = json.load(f)
    if args.limit:
        sources = sources[: args.limit]

    snapshot = {}
    if os.path.exists(SNAPSHOT_FILE):
        with open(SNAPSHOT_FILE, "r", encoding="utf-8") as f:
            snapshot = json.load(f)

    pending = []
    if os.path.exists(PENDING_FILE):
        with open(PENDING_FILE, "r", encoding="utf-8") as f:
            pending = json.load(f)

    today_iso = date.today().isoformat()
    log("=" * 64)
    log("银招雷达 每日巡检  %s  （%d 家银行 / %d 个数据源）" % (today_iso, len(sources), sum(len(s["feeds"]) for s in sources)))
    log("=" * 64)

    new_count = 0
    ok_sources = 0
    fail_sources = 0
    for bank in sources:
        bank_new = 0
        for feed in bank["feeds"]:
            page, err = http_get(feed, args.timeout)
            if err:
                log("  [%s] %s  → %s" % (bank["bank_id"], feed, err))
                fail_sources += 1
                continue
            ok_sources += 1
            cands = detect_candidates(bank, page, feed, today_iso)
            for c in cands:
                key = hashlib.sha1(("%s|%s|%s" % (c["bank_id"], c["title"], c["url"])).encode("utf-8")).hexdigest()
                if key in snapshot:
                    continue
                snapshot[key] = c["found"]
                if args.deep:
                    detail, err2 = http_get(c["url"], args.timeout)
                    if detail:
                        c["fields"] = heuristic_extract(detail, c)
                c["hash"] = key
                pending.append(c)
                new_count += 1
                bank_new += 1
        if bank_new:
            log("  [%s] %s  → 新增公告 %d 条" % (bank["bank_id"], bank["name"], bank_new))
        else:
            log("  [%s] %s  → 无新增" % (bank["bank_id"], bank["name"]))

    with open(SNAPSHOT_FILE, "w", encoding="utf-8") as f:
        json.dump(snapshot, f, ensure_ascii=False, indent=1)
    with open(PENDING_FILE, "w", encoding="utf-8") as f:
        json.dump(pending, f, ensure_ascii=False, indent=1)

    log("-" * 64)
    log("巡检完成：成功源 %d / 失败源 %d / 新增公告 %d 条 / 待审核 %d 条"
        % (ok_sources, fail_sources, new_count, len(pending)))
    if new_count:
        log("新增公告明细：")
        for c in pending[-new_count:]:
            fld = ""
            if c.get("fields"):
                fld = "  [%s|%s|%s|%s]" % (c["fields"].get("batch", "?"),
                                            c["fields"].get("target", "?"),
                                            c["fields"].get("type", "?"),
                                            c["fields"].get("deadline", "?"))
            log("  • %s：%s%s\n    %s" % (c["bank_name"], c["title"], fld, c["url"]))
    log("提示：审核 collector/cache/pending_announcements.json 后运行 commit_pending.py 合并入库")


if __name__ == "__main__":
    main()
