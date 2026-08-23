#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
银招雷达 · 链接健康检查 (check_links.py)
========================================
检查 data/banks.js 中所有银行招聘官网链接 与 data/positions.js 中公告链接
的可用性，输出健康报告，识别死链（DNS 失败/404）与疑似被反爬拦截的站点。

注意：HTTP 412/403/超时 的站点在用户浏览器中通常仍可正常打开（反爬只拦脚本），
只有 DNS 失败(000) 和 HTTP 404 才属于真正的死链，需要修正 URL。

用法:
  python collector/check_links.py              # 全量检查
  python collector/check_links.py --timeout 8  # 自定义单页超时
"""
import argparse
import json
import os
import ssl
import sys
import urllib.request
import urllib.error
from concurrent.futures import ThreadPoolExecutor

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from jslib import load_js  # noqa: E402
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36"

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


def check(url, timeout):
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "*/*"})
    try:
        with urllib.request.urlopen(req, timeout=timeout, context=ssl_ctx()) as resp:
            code = resp.status
            return code, ""
    except urllib.error.HTTPError as e:
        return e.code, ""
    except urllib.error.URLError as e:
        reason = getattr(e, "reason", "")
        if isinstance(reason, ssl.SSLCertVerificationError):
            return 0, "TLS_CERT"
        msg = str(reason)
        if "getaddrinfo" in msg or "Name or service not known" in msg or "11001" in msg:
            return 0, "DNS_FAIL"
        return 0, msg[:40]
    except Exception as e:  # noqa: BLE001
        return 0, str(e)[:40]


def main():
    ap = argparse.ArgumentParser(description="银招雷达链接健康检查")
    ap.add_argument("--timeout", type=int, default=8)
    args = ap.parse_args()

    banks = load_js(os.path.join(BASE_DIR, "data", "banks.js"))
    positions = load_js(os.path.join(BASE_DIR, "data", "positions.js"))

    targets = []
    for b in banks:
        targets.append(("BANK", b["id"], b["name"], b["recruit_url"]))
    ann_set = set()
    for p in positions:
        if p.get("ann") and p["ann"] not in ann_set:
            ann_set.add(p["ann"])
            targets.append(("ANN", p["bank"], p["type"][:18], p["ann"]))

    print("银招雷达链接健康检查  %d 家银行官网 + %d 个公告链接\n" % (len(banks), len(ann_set)))

    results = []
    with ThreadPoolExecutor(max_workers=10) as ex:
        for t in targets:
            code, note = check(t[3], args.timeout)
            results.append((t, code, note))

    dead = [r for r in results if r[1] == 0 and r[2] == "DNS_FAIL"]
    nf = [r for r in results if r[1] == 404]
    blocked = [r for r in results if r[1] in (403, 412)]
    timeout = [r for r in results if r[1] == 0 and r[2] not in ("DNS_FAIL", "TLS_CERT")]

    def fmt(r):
        t, code, note = r
        return "  [%s] %s | %s\n      %s -> %s %s" % (t[0], t[1], t[2], t[3], code or "FAIL", note)

    if dead:
        print("❌ 死链（DNS 解析失败，任何浏览器都打不开）: %d 个" % len(dead))
        for r in dead:
            print(fmt(r))
    if nf:
        print("\n❌ HTTP 404（页面不存在）: %d 个" % len(nf))
        for r in nf:
            print(fmt(r))
    if blocked:
        print("\n⚠️ 反爬拦截 403/412（浏览器通常可打开，脚本被拦）: %d 个" % len(blocked))
        for r in blocked:
            print(fmt(r))
    if timeout:
        print("\n⚠️ 超时/其他失败（浏览器可能可打开）: %d 个" % len(timeout))
        for r in timeout:
            print(fmt(r))

    ok = len(results) - len(dead) - len(nf)
    print("\n总计 %d 个链接：可用 %d / 死链 %d / 404 %d / 反爬 %d / 超时 %d"
          % (len(results), ok, len(dead), len(nf), len(blocked), len(timeout)))


if __name__ == "__main__":
    main()
