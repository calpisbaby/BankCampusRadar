# 银招雷达 · 数据采集模块

每日自动巡检 48 家银行（覆盖国有银行 6 家、股份制银行 12 家、城商行 14 家、农商行 4 家、外资行 12 家）的招聘官网与校招页面，发现新发布的秋招/春招公告与岗位。

## 运行方式

```bash
# 每日全量巡检（含对新公告页面做字段提取）
python collector/collect.py --deep --timeout 12

# 快速联调（只巡检前 N 家）
python collector/collect.py --limit 6

# 链接健康体检（48 家银行官网 + 全部公告链接；死链/404 需修复）
python collector/check_links.py

# 审核通过后合并入库（将 pending 合并进 data/positions.js）
python collector/commit_pending.py --dry-run   # 先预览
python collector/commit_pending.py             # 正式入库（只处理 approved:true 的条目）
python collector/commit_pending.py --all       # 处理所有条目
```

数据流：

```
银行招聘官网 / 校招页 (bank_sources.json)
   │  collect.py 每日抓取 + 关键词识别 + 快照比对
   ▼
collector/cache/pending_announcements.json   ← 新增公告待审核（含 --deep 草稿字段）
   │  cron 智能体审核/补全字段（type/edu/locs/open/dead/batch/year/target/duty/note）
   ▼  commit_pending.py
data/positions.js  ← 历史库（2024-09 至今，只追加不删除）
data/meta.js       ← 更新时间、银行数等

链接体检（check_links.py）：
  48 家银行 recruit_url + 全部 ann 链接 → 死链(DNS)/404 报告
  死链修复：改 data/banks.js + data/positions.js + bank_sources.json 三处，重跑确认
  注：403/412 反爬与超时不视为死链（浏览器可正常打开）
```

## 审核约定

- `collect.py` 的字段提取是启发式的（best-effort），入库前由智能体人工核对公告原文。
- 条目在 `pending_announcements.json` 中标记 `"approved": true` 才会被 `commit_pending.py` 入库。
- 非应届校招公告（如社会招聘、海外高层次人才招聘）直接删除该条目即可，不会入库。
- 入库按 `(bank, type, dead, target)` 去重；历史数据只追加、不修改、不删除。

## 官方招聘公众号清单（微信搜索关注，作为官网抓取的补充渠道）

| 银行类型 | 公众号 |
|---|---|
| 国有银行 | 工商银行人才招聘 · 建设银行人才招聘 · 农业银行人才招聘 · 中国银行人才招聘 · 交通银行微招聘 · 邮储银行人才招聘 |
| 股份制银行 | 招商银行招聘 · 兴业银行招聘 · 浦发银行招聘 · 中信银行招聘 · 民生银行招聘 · 光大银行招聘 · 平安银行招聘 · 华夏银行招聘 · 广发银行招聘 · 浙商银行招聘 · 恒丰银行招聘 · 渤海银行招聘 |
| 城商行 | 北京银行招聘 · 上海银行招聘 · 江苏银行招聘 · 南京银行人才招聘 · 宁波银行招聘 · 徽商银行招聘 · 成都银行招聘 · 杭州银行招聘 · 长沙银行招聘 · 天津银行招聘 · 郑州银行招聘 · 青岛银行招聘 · 中原银行招聘 · 厦门国际银行招聘 |
| 农商行 | 上海农商银行人才招聘 · 北京农商银行招聘 · 重庆农商银行招聘 · 广州农商银行招聘 |
| 外资行 | 汇丰中国人才招聘 · 渣打银行招聘 · 花旗中国招聘 · 东亚中国人才招聘 · 星展中国招聘 · 大华银行招聘 · 华侨银行中国招聘 · 恒生中国招聘 · 德意志银行招聘 · 摩根大通中国招聘 · 南洋商业银行招聘 · 富邦华一银行招聘 |

> 注：公众号文章无法被网页采集器直接抓取，采用"人工/智能体定期核验 + 官网公告交叉验证"的方式纳入数据。每个工作日巡检时，智能体会抽查公众号最新推文并与官网公告对照。

## 已知限制

1. 部分银行官网为 JS 动态渲染（Vue/React），`urllib` 只能拿到静态 HTML；此类站点依赖：
   - 站点提供的静态公告列表页 / sitemap；
   - 或由 cron 智能体用浏览器工具补充抓取。
2. 旧版 TLS 的站点（工行、农行、交行等）已在采集器中兼容（`OP_LEGACY_SERVER_CONNECT`）。
3. 招聘批次、届别的推断规则：公告含"2027届"字样时，秋招公告年≈届别-1，春招公告年≈届别；如公告含具体日期则优先用公告日期。
