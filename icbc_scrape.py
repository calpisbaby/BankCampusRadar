# ICBC 真实岗位数据采集：解析列表 DOM + Edge 抓详情页
import json
import os
import re
import subprocess
import html as htmlmod

EDGE = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
if not os.path.exists(EDGE):
    EDGE = r"C:\Program Files\Microsoft\Edge\Application\msedge.exe"

DETAIL_BASE = "https://job.icbc.com.cn/pc/index.html#/main/school/postDetail/"


def clean(text):
    text = re.sub(r"<script[\s\S]*?</script>", " ", text)
    text = re.sub(r"<style[\s\S]*?</style>", " ", text)
    text = re.sub(r"<[^>]+>", " ", text)
    return htmlmod.unescape(re.sub(r"\s+", " ", text)).strip()


def parse_list(dom_path):
    """解析列表页 DOM 中的岗位行"""
    t = open(dom_path, encoding="utf-8", errors="ignore").read()
    rows = []
    # ant-table 行: data-row-key="ID" + 单元格
    for m in re.finditer(r'data-row-key="(\d+)"([\s\S]*?)</tr>', t):
        rid = m.group(1)
        cells = re.findall(r'title="([^"]*)"', m.group(2))
        if not cells:
            cells = re.findall(r'<td[^>]*>([\s\S]*?)</td>', m.group(2))
            cells = [clean(c) for c in cells]
        rows.append({"id": rid, "cells": cells[:8]})
    return rows


def fetch_detail(post_id, out_dir):
    url = DETAIL_BASE + post_id
    dom = os.path.join(out_dir, "detail_%s.html" % post_id)
    subprocess.run([EDGE, "--headless", "--disable-gpu", "--virtual-time-budget=9000",
                    "--dump-dom", url], capture_output=True, timeout=90)
    # 上面 stdout 是 DOM；直接重定向到文件更稳
    with open(dom, "w", encoding="utf-8") as f:
        subprocess.run([EDGE, "--headless", "--disable-gpu", "--virtual-time-budget=9000",
                        "--dump-dom", url], stdout=f, stderr=subprocess.DEVNULL, timeout=90)
    text = clean(open(dom, encoding="utf-8", errors="ignore").read())
    return text


def extract_detail(text):
    """从详情页文本提取关键字段"""
    out = {}
    m = re.search(r"收藏岗位\s*(\S+?)\s*报名开始时间", text)
    m2 = re.search(r"报名开始时间\s*(\d{4}-\d{2}-\d{2})\s*报名截止时间\s*(\d{4}-\d{2}-\d{2})", text)
    if m2:
        out["open"], out["dead"] = m2.group(1), m2.group(2)
    m3 = re.search(r"所属机构\s*(\S+?)\s*岗位类型", text)
    if m3:
        out["stru"] = m3.group(1)
    m4 = re.search(r"岗位类型\s*(\S+?)\s*工作地点", text)
    if m4:
        out["type"] = m4.group(1)
    m5 = re.search(r"工作地点\s*([\S]+?)\s*计划招聘人数", text)
    if m5:
        out["loc"] = m5.group(1)
    # 职责：岗位类型与"招聘公告"之间的正文（去标签后）
    m6 = re.search(r"计划招聘人数[^。]*。\s*(.+?)\s*招聘公告", text)
    if m6:
        out["duty"] = m6.group(1).strip()
    m7 = re.search(r"招聘公告\s*([^。]*。)", text)
    if m7:
        out["ann_title"] = m7.group(1).strip()
    # 标题：取"XX分行-岗位名"
    m8 = re.search(r"([\u4e00-\u9fa5A-Za-z0-9（）()]+?分行|总行|本部|支行)[—-]?([\u4e00-\u9fa5A-Za-z0-9（）()、+]+)", text[:600])
    return out


if __name__ == "__main__":
    os.makedirs("icbc_work", exist_ok=True)
    rows = parse_list("icbc_list_dom.html")
    print("列表解析出岗位:", len(rows))
    for r in rows[:12]:
        print(" ", r["id"], "|", " | ".join(r["cells"][:6]))
    json.dump(rows, open("icbc_work/list_rows.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)

    # 抓取重点岗位详情（星辰管培生/科技菁英/客服经理/客户经理）
    targets = [r["id"] for r in rows[:4]] + ["00000000000006105504"]
    results = {}
    for pid in targets:
        print("抓取详情:", pid)
        text = fetch_detail(pid, "icbc_work")
        results[pid] = extract_detail(text)
        print("  ->", json.dumps(results[pid], ensure_ascii=False)[:200])
    json.dump(results, open("icbc_work/details.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print("完成")
