# -*- coding: utf-8 -*-
"""银招雷达 · JS 数据文件解析助手
data/*.js 为 `window.X = [ { id: "..", ... } ];` 形式（键未加引号），
本模块将其转换为合法 JSON 供 Python 脚本（check_links / commit_pending）使用。
"""
import json
import re


def load_js(path):
    with open(path, encoding="utf-8") as f:
        content = f.read()
    m = re.search(r"=\s*(\[.*\])\s*;", content, re.S)
    if not m:
        raise ValueError("无法在 %s 中找到数组定义" % path)
    js = m.group(1)
    # 去掉整行注释（数据文件里的分组注释；不影响行内 https:// 等）
    js = re.sub(r"^\s*//.*$", "", js, flags=re.M)
    # 给未加引号的键补引号（值内的 URL/冒号不受影响：它们前一个字符是引号而非 { 或 ,）
    js = re.sub(r'([{,]\s*)([A-Za-z_$][A-Za-z0-9_$]*)\s*:', r'\1"\2":', js)
    return json.loads(js)
