// 数据完整性验证脚本 (node validate.js)
const fs = require('fs');
const vm = require('vm');
const path = require('path');
// 兼容本地 Windows 与 CI Linux：基于脚本自身位置解析数据文件
const base = path.resolve(__dirname) + '/';
function load(f) {
  const ctx = { window: {} };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(base + f, 'utf8'), ctx);
  return ctx.window;
}
const W = Object.assign({}, load('data/banks.js'), load('data/positions.js'), load('data/meta.js'));
const BANKS = W.BANKS, POS = W.POSITIONS, META = W.META;

let fail = 0;
function check(ok, msg) { console.log((ok ? 'OK  ' : 'FAIL') + ' ' + msg); if (!ok) fail++; }

check(Array.isArray(BANKS) && BANKS.length > 0, `银行数=${BANKS.length}`);
check(Array.isArray(POS) && POS.length > 0, `岗位数=${POS.length}`);

const byType = {}; BANKS.forEach(x => byType[x.type] = (byType[x.type] || 0) + 1);
console.log('  类型分布:', JSON.stringify(byType));
const byBatch = {}; POS.forEach(x => byBatch[x.batch] = (byBatch[x.batch] || 0) + 1);
console.log('  批次分布:', JSON.stringify(byBatch));
const byYear = {}; POS.forEach(x => byYear[x.year] = (byYear[x.year] || 0) + 1);
console.log('  公告年分布:', JSON.stringify(byYear));
const byLevel = {}; POS.forEach(x => byLevel[x.level] = (byLevel[x.level] || 0) + 1);
console.log('  层级分布:', JSON.stringify(byLevel));

check(new Set(POS.map(x => x.id)).size === POS.length, '岗位 ID 唯一');
check(POS.every(x => BANKS.some(b => b.id === x.bank)), 'bank 引用有效');
check(POS.every(x => /^\d{4}-\d{2}-\d{2}$/.test(x.open) && /^\d{4}-\d{2}-\d{2}$/.test(x.dead)), '日期格式合法');

// 排名连续性（百强部分）
const ranked = BANKS.filter(x => x.rank < 200).sort((a, b) => a.rank - b.rank);
check(ranked[0].rank === 1 && ranked.length >= 36, `百强名单银行=${ranked.length}家, rank 1 = ${ranked[0].name}`);

// 截止"今日"(META.updated_at) 开放数
const today = new Date(META.updated_at + 'T00:00:00').getTime();
const open = POS.filter(x => new Date(x.dead + 'T00:00:00').getTime() >= today && x.status !== 'closed');
check(open.length > 5, `今日开放岗位=${open.length} | 覆盖银行=${new Set(open.map(x => x.bank)).size}`);
const n7 = POS.filter(x => { const d = (today - new Date(x.first_seen + 'T00:00:00').getTime()) / 86400000; return d >= 0 && d < 7; });
check(n7.length > 0, `近7日新增=${n7.length}`);

// 收藏/搜索测试
check(JSON.stringify(META).includes('银招雷达'), 'META 加载');
console.log(fail === 0 ? '\n全部检查通过 ✓' : `\n${fail} 项检查失败 ✗`);
process.exit(fail === 0 ? 0 : 1);
