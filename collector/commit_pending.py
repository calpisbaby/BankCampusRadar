#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
银招雷达 · 待审公告入库 (commit_pending.py)
==========================================
将 collector/cache/pending_announcements.json 中审核通过的公告
合并进 data/positions.js 历史库，并更新 data/meta.js（更新时间/数量统计）。

审核方式（推荐由 cron 智能体完成）:
  1. collect.py 生成的 pending 条目包含 --deep 提取的 draft 字段
  2. 智能体打开公告 URL 核实，补全/修正字段:
     type(岗位类型) / edu / locs / open / dead / batch / year(公告年) / target(届别) / duty / note
  3. 将条目标记 "approved": true 后保存
  4. 运行本脚本入库

用法:
  python collector/commit_pending.py            # 合并 approved 条目
  python collector/commit_pending.py --all      # 合并所有条目(含未 approved)
  python collector/commit_pending.py --dry-run  # 预览将入库的条目
"""
import argparse
import hashlib
import json
import os
import re
import sys
from datetime import date

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE_DIR = os.path.join(BASE_DIR, "collector", "cache")
PENDING_FILE = os.path.join(CACHE_DIR, "pending_announcements.json")
POSITIONS_FILE = os.path.join(BASE_DIR, "data", "positions.js")
META_FILE = os.path.join(BASE_DIR, "data", "meta.js")

POS_HEADER = """// ============================================================
// 银招雷达 · 岗位历史数据（2024-09 至今）
// 字段说明:
//   id       唯一ID(采集器按 bank+公告标题哈希去重)
//   bank     银行ID(对应 banks.js)
//   type     岗位类型(从招聘公告提取)
//   level    机构层级: 总行|境内分支行|港澳台及海外机构|子公司
//   edu      最低学历要求
//   locs     岗位地点(城市/全国/海外城市)
//   open     开放时间  dead 投递截止日期
//   batch    招聘批次: 秋招提前批|秋招正式批|春招提前批|春招正式批
//   year     公告发布年(筛选"时间"使用, 随数据自动新增)
//   target   招聘届别(2025届/2026届/2027届)
//   duty     工作职责  note 注意事项
//   src      信息来源  ann 招聘公告链接
//   first_seen 首次发现日期(用于"近7日新增"统计)
// 本文件由 collector 每日合并更新(旧数据保留, 新数据追加)
// ============================================================
window.POSITIONS = 
"""


def load_js_array(path, var_name):
    """读取 data/*.js 中的 window.VAR = [...] 数组（JS 对象字面量，含注释、键无引号），返回 list。"""
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()
    m = re.search(r"window\.%s\s*=\s*(\[.*\])\s*;" % var_name, content, re.S)
    if not m:
        sys.exit("FATAL: 无法在 %s 中找到 window.%s 数组" % (path, var_name))
    js = m.group(1)
    js = re.sub(r"(?m)^\s*//.*$", "", js)                      # 去掉行注释
    js = re.sub(r"([{,]\s*)([A-Za-z_][A-Za-z0-9_]*)(\s*:)", r'\1"\2"\3', js)  # 键补引号
    return json.loads(js)


def load_positions():
    return load_js_array(POSITIONS_FILE, "POSITIONS"), open(POSITIONS_FILE, "r", encoding="utf-8").read()


def save_positions(positions):
    body = "[\n" + ",\n".join(json.dumps(p, ensure_ascii=False) for p in positions) + "\n];\n"
    with open(POSITIONS_FILE, "w", encoding="utf-8") as f:
        f.write(POS_HEADER + body)
    print("已写入 %s（共 %d 条岗位）" % (POSITIONS_FILE, len(positions)))


def update_meta(positions, banks_count):
    with open(META_FILE, "r", encoding="utf-8") as f:
        content = f.read()
    today = date.today().isoformat()
    content = re.sub(r'updated_at:\s*"[^"]*"', 'updated_at: "%s"' % today, content)
    content = re.sub(r'bank_count:\s*\d+', "bank_count: %d" % banks_count, content)
    with open(META_FILE, "w", encoding="utf-8") as f:
        f.write(content)
    print("已更新 %s（数据更新至 %s）" % (META_FILE, today))


def build_record(entry, positions):
    bank_id = entry.get("bank_id")
    f = entry.get("fields") or {}
    existing = {p.get("bank") for p in positions}
    if bank_id not in existing:
        print("  ⚠ 银行 %s 不在 banks.js 中，请先在 banks.js 补充银行信息" % bank_id)
        return None
    # 显式字段 > draft 字段
    def pick(k, default=None):
        return entry.get(k) or f.get(k) or default

    type_ = pick("type")
    if not type_:
        return None
    dead = pick("deadline", pick("dead"))
    batch = pick("batch")
    year = pick("year")
    target = pick("target")
    if not (dead and batch):
        return None
    if not year and target:
        year = target - 1 if batch.startswith("秋招") else target
    if not target and year:
        target = year + 1 if batch.startswith("秋招") else year
    locs = pick("locs") or ["全国"]
    if isinstance(locs, str):
        locs = [locs]
    edu = pick("edu") or "本科及以上"
    level = pick("level") or "总行"
    open_ = pick("open") or pick("detected_date") or date.today().isoformat()
    duty = pick("duty") or "%s岗位职责以银行官方招聘公告为准。" % type_
    note = pick("note") or "请以银行官方招聘网站发布的完整公告为准。"
    rec = {
        "id": entry.get("id") or "%s-%s" % (bank_id, hashlib.sha1(("%s|%s|%s" % (bank_id, type_, dead)).encode("utf-8")).hexdigest()[:8]),
        "bank": bank_id,
        "type": type_,
        "level": level,
        "edu": edu,
        "locs": locs,
        "open": open_,
        "dead": dead,
        "batch": batch,
        "year": int(year),
        "target": int(target),
        "duty": duty,
        "note": note,
        "src": "官网",
        "ann": entry.get("url") or "",
        "first_seen": entry.get("found") or date.today().isoformat(),
    }
    return rec


def main():
    ap = argparse.ArgumentParser(description="待审公告入库")
    ap.add_argument("--all", action="store_true", help="合并所有条目（含未 approved）")
    ap.add_argument("--dry-run", action="store_true", help="仅预览不写入")
    ap.add_argument("--force", action="store_true", help="跳过去重强制入库")
    args = ap.parse_args()

    if not os.path.exists(PENDING_FILE):
        print("无待审核文件: %s" % PENDING_FILE)
        return

    with open(PENDING_FILE, "r", encoding="utf-8") as f:
        pending = json.load(f)
    positions, _ = load_positions()
    banks = load_js_array(os.path.join(BASE_DIR, "data", "banks.js"), "BANKS")

    picked = [e for e in pending if args.all or e.get("approved")]
    print("待审核 %d 条，本次处理 %d 条" % (len(pending), len(picked)))
    added = 0
    for e in picked:
        rec = build_record(e, positions)
        if not rec:
            print("  ✗ 跳过（字段不全）: %s - %s" % (e.get("bank_name"), e.get("title", "")[:40]))
            continue
        dup = any(p["id"] == rec["id"] or (p["bank"] == rec["bank"] and p["type"] == rec["type"]
                                            and p["dead"] == rec["dead"] and p["target"] == rec["target"])
                 for p in positions)
        if dup and not args.force:
            print("  · 已存在，跳过: %s - %s" % (rec["bank"], rec["type"]))
            continue
        if args.dry_run:
            print("  + %s | %s | %s届%s | %s | 截止 %s" % (rec["bank"], rec["type"], rec["target"], rec["batch"], "/".join(rec["locs"]), rec["dead"]))
            continue
        positions.append(rec)
        e["committed"] = True
        added += 1

    if args.dry_run:
        print("（dry-run 结束，未写入）")
        return

    if added:
        save_positions(positions)
    update_meta(positions, len(banks))

    remaining = [e for e in pending if not e.get("committed")]
    with open(PENDING_FILE, "w", encoding="utf-8") as f:
        json.dump(remaining, f, ensure_ascii=False, indent=1)
    print("本次入库 %d 条，剩余待审 %d 条" % (added, len(remaining)))


if __name__ == "__main__":
    main()
