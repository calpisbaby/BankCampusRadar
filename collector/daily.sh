#!/bin/bash
# 银招雷达每日巡检入口（供 Hermes cron 调用）
# 输出 = collect.py 巡检报告，注入 cron 智能体 prompt
cd "$(dirname "$0")/.." || exit 1
exec python collector/collect.py --deep --timeout 12 2>&1
