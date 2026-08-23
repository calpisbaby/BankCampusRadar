/* ============================================================
   银招雷达 · BankCampus Radar — 前端应用逻辑
   纯原生 JS，无依赖；数据来自 data/*.js（采集器每日更新）
   ============================================================ */
(function () {
  "use strict";

  /* ---------- 常量与全局 ---------- */
  var META = {}, BANKS = [], POSITIONS = [];
  var TODAY = "";   // 以数据更新日作为"今天"（loadRadar 时按当前雷达刷新）
  var NEW_WINDOW_DAYS = 7;
  var RADAR_MODE = "bank";          // bank | consulting
  var L = {};                       // 当前雷达的文案标签
  var LEVEL_ORDER = [], TYPE_ORDER = [];

  var FAV_KEY = "yinzhao.favs.v1";
  var favs = loadFavs();

  /* 城市 → 省份 映射（覆盖数据中出现的地点） */
  var CITY_PROV = {
    "北京": "北京", "上海": "上海", "天津": "天津", "重庆": "重庆",
    "深圳": "广东", "广州": "广东", "珠海": "广东", "佛山": "广东", "东莞": "广东",
    "杭州": "浙江", "宁波": "浙江", "温州": "浙江",
    "南京": "江苏", "苏州": "江苏", "无锡": "江苏", "常州": "江苏",
    "成都": "四川", "武汉": "湖北", "西安": "陕西", "长沙": "湖南",
    "郑州": "河南", "济南": "山东", "青岛": "山东", "烟台": "山东", "威海": "山东",
    "沈阳": "辽宁", "大连": "辽宁", "哈尔滨": "黑龙江", "长春": "吉林",
    "福州": "福建", "厦门": "福建", "泉州": "福建", "合肥": "安徽", "南昌": "江西",
    "昆明": "云南", "贵阳": "贵州", "兰州": "甘肃", "乌鲁木齐": "新疆",
    "南宁": "广西", "海口": "海南", "太原": "山西", "石家庄": "河北",
    "呼和浩特": "内蒙古", "银川": "宁夏", "西宁": "青海", "拉萨": "西藏",
    "香港": "港澳台及海外", "澳门": "港澳台及海外", "台湾": "港澳台及海外",
    "新加坡": "港澳台及海外", "伦敦": "港澳台及海外", "纽约": "港澳台及海外", "东京": "港澳台及海外"
  };
  var REGION_ORDER = ["华北", "东北", "华东", "华中", "华南", "西南", "西北", "港澳台及海外"];
  var REGION_PROV = {
    "华北": ["北京", "天津", "河北", "山西", "内蒙古"],
    "东北": ["辽宁", "吉林", "黑龙江"],
    "华东": ["上海", "江苏", "浙江", "安徽", "福建", "江西", "山东"],
    "华中": ["河南", "湖北", "湖南"],
    "华南": ["广东", "广西", "海南"],
    "西南": ["重庆", "四川", "贵州", "云南", "西藏"],
    "西北": ["陕西", "甘肃", "青海", "宁夏", "新疆"],
    "港澳台及海外": ["港澳台及海外"]
  };
  var LEVEL_ORDER = [];
  var TYPE_ORDER = [];
  var BATCH_ORDER = ["秋招提前批", "秋招正式批", "春招提前批", "春招正式批"];

  /* ---------- 图标 ---------- */
  var I = {
    pin: '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>',
    edu: '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 10 12 5 2 10l10 5 10-5Z"/><path d="M6 12v5c0 1.7 2.7 3 6 3s6-1.3 6-3v-5"/></svg>',
    cal: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>',
    clock: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
    star: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1L12 2Z"/></svg>',
    ext: '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><path d="M15 3h6v6"/><path d="M10 14 21 3"/></svg>',
    doc: '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6"/></svg>',
    back: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5"/><path d="m12 19-7-7 7-7"/></svg>',
    bank: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-6 9 6v2H3V9Z"/><path d="M5 11v8M10 11v8M14 11v8M19 11v8M3 21h18"/></svg>',
    batch: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3v3M16 3v3"/><rect x="4" y="5" width="16" height="16" rx="2"/><path d="M4 11h16"/></svg>',
    wave: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 3a9 9 0 0 1 9 9M12 3v0M3 12a9 9 0 0 1 9-9M12 3v0M3 12h0M21 12h0M12 21a9 9 0 0 1-9-9M12 21v0M21 12a9 9 0 0 1-9 9"/></svg>',
    search: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>'
  };

  /* ---------- 工具函数 ---------- */
  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  function todayTs() { return new Date(TODAY + "T00:00:00").getTime(); }
  function dateTs(d) { return new Date(d + "T00:00:00").getTime(); }
  function daysUntil(d) {
    return Math.round((dateTs(d) - todayTs()) / 86400000);
  }
  function isOpen(p) {
    if (p.status === "closed") return false;
    return daysUntil(p.dead) >= 0;
  }
  function isNew(p) {
    if (!p.first_seen) return false;
    var d = Math.round((todayTs() - dateTs(p.first_seen)) / 86400000);
    return d >= 0 && d < NEW_WINDOW_DAYS;
  }
  function isTodayNew(p) { return !!p.first_seen && p.first_seen === TODAY; }
  function bankById(id) {
    for (var i = 0; i < BANKS.length; i++) if (BANKS[i].id === id) return BANKS[i];
    return null;
  }
  function positionById(id) {
    for (var i = 0; i < POSITIONS.length; i++) if (POSITIONS[i].id === id) return POSITIONS[i];
    return null;
  }
  function provOfLoc(loc) {
    if (loc === "全国") return "全国";
    return CITY_PROV[loc] || "其他";
  }
  function loadFavs() {
    try { return JSON.parse(localStorage.getItem(FAV_KEY)) || []; } catch (e) { return []; }
  }
  function saveFavs() { localStorage.setItem(FAV_KEY, JSON.stringify(favs)); }
  function isFav(id) { return favs.indexOf(id) >= 0; }
  function toggleFav(id) {
    var i = favs.indexOf(id);
    if (i >= 0) favs.splice(i, 1); else favs.push(id);
    saveFavs(); refreshNavFav();
    return isFav(id);
  }

  /* ---------- 筛选状态 ---------- */
  var F = { province: "全部", city: "全部", type: "全部", level: "全部", year: "全部", batch: "全部", search: "", status: "all", special: null, bank: "全部" };

  function matchLoc(p, f) {
    if (f.province !== "全部") {
      var hit = false;
      for (var i = 0; i < p.locs.length; i++) {
        if (p.locs[i] === "全国") { hit = true; break; }
        if (provOfLoc(p.locs[i]) === f.province) { hit = true; break; }
      }
      if (!hit) return false;
    }
    if (f.city !== "全部") {
      var hitC = false;
      for (var j = 0; j < p.locs.length; j++) {
        if (p.locs[j] === "全国" || p.locs[j] === f.city) { hitC = true; break; }
      }
      if (!hitC) return false;
    }
    return true;
  }
  function matchSearch(p, q) {
    if (!q) return true;
    var bank = bankById(p.bank);
    if (!bank) return false;
    var hay = (bank.name + " " + bank.short + " " + (bank.alias || "")).toLowerCase();
    var tokens = q.toLowerCase().split(/\s+/).filter(Boolean);
    for (var i = 0; i < tokens.length; i++) if (hay.indexOf(tokens[i]) < 0) return false;
    return true;
  }
  function filteredPositions() {
    var out = [];
    for (var i = 0; i < POSITIONS.length; i++) {
      var p = POSITIONS[i], bank = bankById(p.bank);
      if (!bank) continue;
      if (F.type !== "全部" && bank.type !== F.type) continue;
      if (F.level !== "全部" && p.level !== F.level) continue;
      if (F.year !== "全部" && String(p.year) !== F.year) continue;
      if (F.batch !== "全部" && p.batch !== F.batch) continue;
      if (F.status === "open" && !isOpen(p)) continue;
      if (F.status === "closed" && isOpen(p)) continue;
      if (F.special === "fav" && !isFav(p.id)) continue;
      if (F.special === "new" && !isTodayNew(p)) continue;
      if (F.bank !== "全部" && p.bank !== F.bank) continue;
      if (!matchLoc(p, F)) continue;
      if (!matchSearch(p, F.search)) continue;
      out.push(p);
    }
    out.sort(function (a, b) {
      var ba = bankById(a.bank), bb = bankById(b.bank);
      if (ba.rank !== bb.rank) return ba.rank - bb.rank;
      var d = dateTs(b.open) - dateTs(a.open);
      if (d !== 0) return d;
      return a.id < b.id ? -1 : 1;
    });
    return out;
  }

  /* ---------- 双雷达模式 ---------- */
  function labelsOf(mode) {
    if (mode === "consulting") {
      return {
        unit: "公司", navBank: "公司库", kpiBank: "招聘公司家数", kpiHq: "其中总部岗位",
        kpiFavUnit: "家公司", typeLabel: "公司类型", searchLabel: "公司名称",
        searchPh: "模糊搜索，如：安永 / 德勤 / 蚂蚁",
        note: "按四大 → MBB → 其他咨询/金融科技排序",
        banksTitle: "公司库", banksMetaUnit: "家机构", orgCol: "公司名称",
        sheetName: "咨询雷达岗位导出",
        rankBadge: function (o) { return o.type; }
      };
    }
    return {
      unit: "银行", navBank: "银行库", kpiBank: "招聘银行家数", kpiHq: "其中总行岗位",
      kpiFavUnit: "家银行", typeLabel: "银行类型", searchLabel: "银行名称",
      searchPh: "模糊搜索，如：工商 / 招商 / 汇丰",
      note: "按中国银行业协会 2025 百强排名排序",
      banksTitle: "银行库", banksMetaUnit: "家银行", orgCol: "银行名称",
      sheetName: "银招雷达岗位导出",
      rankBadge: function (o) { return o.rank >= 200 ? "外资" : "百强 " + o.rank; }
    };
  }
  function applyLabels() {
    $("brandName").textContent = META.app_name || (RADAR_MODE === "consulting" ? "咨询雷达" : "银招雷达");
    $("brandEn").textContent = RADAR_MODE === "consulting" ? "Consulting Radar" : "BankCampus Radar";
    $("brandTagline").textContent = RADAR_MODE === "consulting" ? "咨询 · 校招 全量监测工作台" : "银行秋招 · 春招 全量监测工作台";
    $("navHome").href = "#/radar/" + RADAR_MODE;
    $("navBankLink").textContent = L.navBank;
    $("kpiBankWord").textContent = L.kpiBank;
    $("kpiHqWord").textContent = L.kpiHq;
    $("kpiFavBankWord").textContent = L.kpiFavUnit;
    $("filterTypeWord").textContent = L.typeLabel;
    $("filterSearchWord").textContent = L.searchLabel;
    $("fSearch").placeholder = L.searchPh;
    $("resultNote").textContent = L.note;
    $("banksTitle").textContent = L.banksTitle;
    $("banksTotalWord").textContent = L.banksMetaUnit;
    $("favBanksWord").textContent = L.kpiFavUnit;
    $("updateDate").textContent = META.updated_at || "—";
    $("footUpdate").textContent = (META.app_name || "招聘雷达") + " v" + (META.version || "1.0") + " · 数据更新至 " + (META.updated_at || "—") + " · 起始于 " + (META.data_start || "—") + " · 监测机构 " + (META.bank_count || META.firm_count || BANKS.length) + " 家 · 数据源 " + (META.source_count || "—") + " 个";
    $("footRankNote").textContent = META.rank_note || "";
    document.title = (META.app_name || "招聘雷达") + " · 校招监测工作台";
  }
  function loadRadar(mode) {
    RADAR_MODE = mode;
    if (mode === "consulting") {
      BANKS = window.FIRMS || [];
      POSITIONS = (window.FPOSITIONS || []).map(function (p) {
        return Object.assign({}, p, { bank: p.firm });  // 归一化 bank 字段，复用同一套渲染/筛选逻辑
      });
      META = window.FMETA || {};
      TYPE_ORDER = ["四大会计师事务所", "顶级战略咨询", "咨询公司", "金融科技公司"];
      LEVEL_ORDER = ["中国大陆总部", "区域办公室", "子公司"];
    } else {
      BANKS = window.BANKS || [];
      POSITIONS = window.POSITIONS || [];
      META = window.META || {};
      TYPE_ORDER = ["国有银行", "股份制银行", "城商行", "农商行", "外资行"];
      LEVEL_ORDER = ["总行", "境内分支行", "港澳台及海外机构", "子公司"];
    }
    TODAY = META.updated_at || new Date().toISOString().slice(0, 10);
    L = labelsOf(mode);
    F = { province: "全部", city: "全部", type: "全部", level: "全部", year: "全部", batch: "全部", search: "", status: "all", special: null, bank: "全部" };
    try { sessionStorage.setItem("radar.mode", mode); } catch (e) {}
    applyLabels();
    buildSelectOptions();
    refreshCitySelect();
    refreshNavFav();
  }

  /* ---------- 筛选下拉框初始化 ---------- */
  function buildSelectOptions() {
    var provs = [];
    REGION_ORDER.forEach(function (r) {
      REGION_PROV[r].forEach(function (pr) { provs.push({ region: r, name: pr }); });
    });
    var years = [];
    POSITIONS.forEach(function (p) { if (years.indexOf(String(p.year)) < 0) years.push(String(p.year)); });
    years.sort(function (a, b) { return +b - +a; });

    fillSelect($("fProvince"), [{ v: "全部", t: "全国（全部地区）" }].concat(provs.map(function (x) {
      return { v: x.name, t: "[" + x.region + "] " + x.name };
    })));
    fillSelect($("fType"), [{ v: "全部", t: "全部类型" }].concat(TYPE_ORDER.map(function (t) { return { v: t, t: t }; })));
    fillSelect($("fLevel"), [{ v: "全部", t: "全部层级" }].concat(LEVEL_ORDER.map(function (t) { return { v: t, t: t }; })));
    fillSelect($("fYear"), [{ v: "全部", t: "全部时间" }].concat(years.map(function (y) { return { v: y, t: y + " 年公告" }; })));
    fillSelect($("fBatch"), [{ v: "全部", t: "全部批次" }].concat(BATCH_ORDER.map(function (t) { return { v: t, t: t }; })));
  }
  function fillSelect(sel, opts) {
    sel.innerHTML = opts.map(function (o) { return '<option value="' + esc(o.v) + '">' + esc(o.t) + "</option>"; }).join("");
  }
  function refreshCitySelect() {
    var citySel = $("fCity");
    if (F.province === "全部") { citySel.hidden = true; citySel.innerHTML = ""; F.city = "全部"; return; }
    var cities = [];
    POSITIONS.forEach(function (p) {
      p.locs.forEach(function (l) {
        if (l === "全国") return;
        if (provOfLoc(l) === F.province && cities.indexOf(l) < 0) cities.push(l);
      });
    });
    if (F.province === "港澳台及海外") cities = ["香港", "澳门", "新加坡", "伦敦"];
    cities.sort(function (a, b) { return a.localeCompare(b, "zh"); });
    var opts = [{ v: "全部", t: F.province + " · 全部城市" }].concat(cities.map(function (c) { return { v: c, t: c }; }));
    fillSelect(citySel, opts);
    if (cities.indexOf(F.city) < 0) F.city = "全部";
    citySel.value = F.city;
    citySel.hidden = false;
  }

  /* ---------- 统计 ---------- */
  function computeStats() {
    var open = 0, hq = 0, bankSet = {}, typeSet = {}, dailyNew = 0;
    POSITIONS.forEach(function (p) {
      if (isOpen(p)) {
        open++;
        bankSet[p.bank] = 1;
        typeSet[bankById(p.bank).type] = 1;
        if (p.level === "总行") hq++;
      }
      if (p.first_seen === TODAY) dailyNew++;
    });
    var favBanks = {};
    favs.forEach(function (id) { var p = positionById(id); if (p) favBanks[p.bank] = 1; });
    return {
      open: open, hq: hq, banks: Object.keys(bankSet).length,
      bankTypes: Object.keys(typeSet).length,
      fav: favs.length, favBanks: Object.keys(favBanks).length,
      dailyNew: dailyNew
    };
  }
  function renderStats() {
    var s = computeStats();
    $("kpiOpen").textContent = s.open;
    $("kpiHq").textContent = s.hq;
    $("kpiBank").textContent = s.banks;
    $("kpiBankType").textContent = s.bankTypes;
    $("kpiFav").textContent = s.fav;
    $("kpiFavBank").textContent = s.favBanks;
    $("kpiNew").textContent = s.dailyNew;
  }
  function refreshNavFav() {
    var n = favs.length;
    $("navFavCount").textContent = n;
    $("navFavCount").style.display = n ? "inline-block" : "none";
  }

  /* ---------- 行渲染 ---------- */
  function deadlineTag(p) {
    if (!isOpen(p)) return '<span class="dead-tag done">已截止</span>';
    var d = daysUntil(p.dead);
    if (d <= 3) return '<span class="dead-tag urgent">剩 ' + d + ' 天</span>';
    if (d <= 7) return '<span class="dead-tag warn">剩 ' + d + ' 天</span>';
    return '<span class="dead-tag ok">剩 ' + d + ' 天</span>';
  }
  function rankBadge(bank) {
    if (bank.rank >= 200) return '<div class="rank-badge foreign">外资</div>';
    var cls = bank.rank <= 10 ? "rank-badge top" : "rank-badge";
    return '<div class="rank-badge ' + cls + '">' + bank.rank + "<small>百强</small></div>";
  }
  function posRow(p, opts) {
    opts = opts || {};
    var bank = bankById(p.bank);
    var newTag = isNew(p) ? '<span class="chip type-new">NEW</span>' : "";
    var favOn = isFav(p.id) ? " on" : "";
    var row = document.createElement("div");
    row.className = "pos-row" + (isOpen(p) ? "" : " closed");
    row.dataset.id = p.id;
    row.innerHTML =
      '<div class="rank-cell">' + rankBadge(bank) + "</div>" +
      '<div class="bank-cell">' +
        '<div class="bank-name">' + esc(bank.name) + "</div>" +
        '<div class="bank-tags">' +
          '<span class="chip type-bank">' + esc(bank.type) + "</span>" +
          '<span class="chip type-level">' + esc(p.level) + "</span>" +
          newTag +
        "</div>" +
      "</div>" +
      '<div class="type-cell">' +
        '<div class="pos-type">' + esc(p.type) + "</div>" +
        '<div class="pos-batch">' + p.target + "届 · " + esc(p.batch) + "</div>" +
      "</div>" +
      '<div class="info-cell">' +
        '<span class="edu-chip">' + I.edu + esc(p.edu) + "</span>" +
        '<span class="loc-line" title="' + esc(p.locs.join(" / ")) + '">' + I.pin + "<b>" + esc(p.locs.join(" / ")) + "</b></span>" +
      "</div>" +
      '<div class="dead-cell">' +
        '<div class="dead-date">' + esc(p.dead) + "</div>" +
        deadlineTag(p) +
      "</div>" +
      '<div class="actions-cell">' +
        '<a class="act-btn" title="' + (p.url ? "直达该岗位投递/详情页" : "银行招聘官网") + '" href="' + esc(p.url || bank.recruit_url) + '" target="_blank" rel="noopener" data-act="url">' + I.ext + (p.url ? "投递岗位" : "招聘官网") + "</a>" +
        '<a class="act-btn" title="银行官方招聘公告" href="' + esc(p.ann || bank.recruit_url) + '" target="_blank" rel="noopener" data-act="ann">' + I.doc + "公告</a>" +
        '<button class="act-btn star' + favOn + '" title="收藏星标" data-act="star">' + I.star + "</button>" +
      "</div>";
    row.addEventListener("click", function (e) {
      var t = e.target;
      var act = t.closest && t.closest("[data-act]");
      if (act) {
        e.stopPropagation();
        if (act.dataset.act === "star") {
          var on = toggleFav(p.id);
          act.classList.toggle("on", on);
          renderStats();
          return;
        }
        return; // 官网/公告为 <a>，交由浏览器新标签打开
      }
      location.hash = "#/p/" + p.id;
    });
    return row;
  }
  function renderList(container, items, emptyMsg) {
    container.innerHTML = "";
    if (!items.length) {
      var e = document.createElement("div");
      e.className = "empty-state";
      e.innerHTML = '<div class="empty-icon">' + I.search + "</div>" +
        '<div class="empty-title">' + esc(emptyMsg || "没有符合条件的岗位") + "</div>" +
        '<div class="empty-sub">试试放宽筛选条件，或重置全部筛选</div>' +
        '<button class="btn-reset" id="emptyReset">重置筛选</button>';
      container.appendChild(e);
      var btn = $("emptyReset");
      if (btn) btn.addEventListener("click", resetFilters);
      return;
    }
    var frag = document.createDocumentFragment();
    items.forEach(function (p) { frag.appendChild(posRow(p)); });
    container.appendChild(frag);
  }

  /* ---------- 工作台 ---------- */
  function renderHome() {
    var items = filteredPositions();
    renderList($("positionList"), items, "没有符合条件的岗位");
    $("resultCount").textContent = items.length;
    updateSpecialChip();
    renderStats();
  }
  function updateSpecialChip() {
    var chip = $("specialChip"), txt = $("specialChipText");
    if (F.special === "fav") { chip.hidden = false; txt.textContent = "仅看已收藏"; }
    else if (F.special === "new") { chip.hidden = false; txt.textContent = "仅看今日新增"; }
    else if (F.bank !== "全部") {
      var b = bankById(F.bank);
      chip.hidden = false; txt.textContent = "仅看" + (b ? b.name : F.bank) + "岗位";
    } else { chip.hidden = true; }
  }

  /* ---------- 详情页 ---------- */
  function renderDetail(id) {
    var p = positionById(id);
    var el = $("view-detail");
    if (!p) {
      el.innerHTML = '<div class="empty-state"><div class="empty-title">岗位不存在或已被归档</div><button class="btn-reset" onclick="location.hash=\'#/\'">返回工作台</button></div>';
      el.hidden = false;
      return;
    }
    var bank = bankById(p.bank);
    var favOn = isFav(p.id);
    var d = daysUntil(p.dead);
    var deadHtml = isOpen(p)
      ? (d <= 3 ? '<span class="i-value urgent">' + esc(p.dead) + "（剩 " + d + " 天）</span>" : '<span class="i-value">' + esc(p.dead) + "（剩 " + d + " 天）</span>")
      : '<span class="i-value">' + esc(p.dead) + "（已截止）</span>";
    var others = POSITIONS.filter(function (x) { return x.bank === p.bank && x.id !== p.id; });
    others.sort(function (a, b) { return dateTs(b.open) - dateTs(a.open); });
    others = others.slice(0, 4);
    var duties = p.duty.split(/[。；;]/).filter(Boolean).map(function (s) { return s.trim(); });
    if (!duties.length) duties = [p.duty];

    var html = "";
    html += '<div class="detail-head"><button class="btn-back" id="btnBack">' + I.back + "返回</button></div>";
    html += '<div class="detail-card">';
    html += '<div class="detail-hero">' +
      '<div class="bank-logo" style="background:' + esc(bank.color) + '">' + esc(bank.short.charAt(0)) + "</div>" +
      '<div class="hero-text">' +
        '<div class="hero-name">' + esc(bank.name) +
          '<span class="rank-badge ' + (bank.rank <= 10 ? "top" : "") + '" style="font-size:13px;height:26px;min-width:44px;border-radius:7px">' + (bank.rank >= 200 ? "外资" : "百强 " + bank.rank) + "</span>" +
        "</div>" +
        '<div class="hero-meta">' +
          '<span class="chip type-bank">' + esc(bank.type) + "</span>" +
          '<span class="chip type-level">' + esc(p.level) + "</span>" +
          '<span class="chip type-level" style="background:var(--gold-soft);color:var(--gold-deep)">' + p.target + "届 · " + esc(p.batch) + "</span>" +
        "</div>" +
      "</div>" +
      '<div class="hero-actions">' +
        '<button class="hero-star' + (favOn ? " on" : "") + '" id="heroStar">' + I.star + '<span>' + (favOn ? "已收藏" : "收藏") + "</span></button>" +
        '<span class="hero-note">' + esc(p.src) + "监测 · " + esc(p.first_seen) + " 首次发现</span>" +
      "</div>" +
    "</div>";
    html += '<div class="info-grid">' +
      '<div class="info-item"><div class="info-icon">' + I.bank + '</div><div class="i-body"><div class="i-label">岗位名称</div><div class="i-value">' + esc(p.type) + "</div></div></div>" +
      '<div class="info-item"><div class="info-icon">' + I.batch + '</div><div class="i-body"><div class="i-label">招聘批次</div><div class="i-value">' + esc(p.batch) + "</div></div></div>" +
      '<div class="info-item"><div class="info-icon">' + I.cal + '</div><div class="i-body"><div class="i-label">招聘时间</div><div class="i-value">' + p.target + "届 · " + p.year + " 年公告</div></div></div>" +
      '<div class="info-item"><div class="info-icon">' + I.pin + '</div><div class="i-body"><div class="i-label">工作地点</div><div class="i-value"><span class="loc-chips">' + p.locs.map(function (l) { return '<span class="loc-chip">' + esc(l) + "</span>"; }).join("") + "</span></div></div></div>" +
      '<div class="info-item"><div class="info-icon">' + I.clock + '</div><div class="i-body"><div class="i-label">开放时间</div><div class="i-value">' + esc(p.open) + "</div></div></div>" +
      '<div class="info-item"><div class="info-icon">' + I.clock + '</div><div class="i-body"><div class="i-label">投递截止</div>' + deadHtml + "</div></div>" +
      '<div class="info-item"><div class="info-icon" style="background:var(--gold-soft);color:var(--gold-deep)">' + I.edu + '</div><div class="i-body"><div class="i-label">最低学历</div><div class="i-value">' + esc(p.edu) + "</div></div></div>" +
    "</div>";
    html += '<div class="detail-section"><div class="section-title"><span class="bar"></span>工作职责</div><ul class="duty-list">' +
      duties.map(function (s) { return "<li>" + esc(s) + "。</li>"; }).join("") + "</ul></div>";
    html += '<div class="detail-section"><div class="section-title"><span class="bar"></span>注意事项</div><div class="note-box">' +
      esc(p.note) + " 官方招聘不收取任何费用，谨防以“内推”“保过”为名的诈骗行为；请务必通过下方官方链接投递简历。</div></div>";
    html += '<div class="detail-section"><div class="section-title"><span class="bar"></span>招聘链接</div><div class="link-grid">' +
      (p.url ? '<a class="link-card" href="' + esc(p.url) + '" target="_blank" rel="noopener">' + I.ext + '<span>岗位投递页面<span class="lk-sub">直达该岗位网申/详情页</span></span></a>' : "") +
      '<a class="link-card" href="' + esc(bank.recruit_url) + '" target="_blank" rel="noopener">' + I.ext + '<span>银行招聘官网<span class="lk-sub">' + esc(bank.recruit_url) + "</span></span></a>" +
      '<a class="link-card" href="' + esc(p.ann || bank.recruit_url) + '" target="_blank" rel="noopener">' + I.doc + '<span>招聘公告<span class="lk-sub">官方公告页（每日采集刷新）</span></span></a>' +
      '<span class="link-card">' + I.wave + '<span>官方招聘公众号<span class="lk-sub">微信搜索「' + esc(bank.wechat || bank.name + "招聘") + '」</span></span></span>' +
    "</div></div>";
    html += '<div class="detail-section"><div class="section-title"><span class="bar"></span>' + esc(bank.short) + "其他岗位推荐</div>";
    html += others.length
      ? '<div class="rec-grid">' + others.map(function (o) {
          var st = isOpen(o) ? (daysUntil(o.dead) <= 7 ? '<span class="rc-status urgent">剩 ' + daysUntil(o.dead) + " 天</span>" : '<span class="rc-status open">开放中</span>') : '<span class="rc-status closed">已截止</span>';
          return '<a class="rec-card" href="#/p/' + esc(o.id) + '">' +
            '<div class="rc-type">' + esc(o.type) + "</div>" +
            '<div class="rc-meta"><span>' + esc(o.edu) + "</span><span>" + esc(o.locs.join("/")) + "</span><span>截止 " + esc(o.dead) + "</span></div>" +
            st + "</a>";
        }).join("") + "</div>"
      : '<div class="note-box" style="background:var(--surface-2);border-color:var(--border);color:var(--muted)">该银行暂无其他已收录岗位，可前往招聘官网查看完整岗位列表。</div>';
    html += "</div>";
    html += '<div class="detail-foot"><span>信息来源：' + esc(p.src) + " · 首次发现于 " + esc(p.first_seen) + "</span><span>" + esc(META.disclaimer) + "</span></div>";
    html += "</div>";
    el.innerHTML = html;
    el.hidden = false;

    $("btnBack").addEventListener("click", function () { history.length > 1 ? history.back() : (location.hash = "#/"); });
    $("heroStar").addEventListener("click", function () {
      var on = toggleFav(p.id);
      this.classList.toggle("on", on);
      this.querySelector("span").textContent = on ? "已收藏" : "收藏";
      renderStats();
    });
  }

  /* ---------- 收藏夹 ---------- */
  function renderFav() {
    var items = [];
    favs.forEach(function (id) { var p = positionById(id); if (p) items.push(p); });
    items.sort(function (a, b) {
      var ba = bankById(a.bank), bb = bankById(b.bank);
      return ba.rank - bb.rank;
    });
    $("favTotal").textContent = items.length;
    var bset = {};
    items.forEach(function (p) { bset[p.bank] = 1; });
    $("favBanks").textContent = Object.keys(bset).length;
    renderList($("favList"), items, "收藏夹还是空的");
    $("btnClearFav").onclick = function () {
      if (confirm("确定清空全部收藏吗？")) { favs = []; saveFavs(); refreshNavFav(); renderFav(); renderStats(); }
    };
  }

  /* ---------- 银行库与侧边栏 ---------- */
  function openCountOf(bankId) {
    var n = 0;
    POSITIONS.forEach(function (p) { if (p.bank === bankId && isOpen(p)) n++; });
    return n;
  }
  function renderBanks() {
    var list = $("banksList");
    list.innerHTML = "";
    $("banksTotal").textContent = BANKS.length;
    var sorted = BANKS.slice().sort(function (a, b) { return a.rank - b.rank; });
    var frag = document.createDocumentFragment();
    sorted.forEach(function (b) {
      var card = document.createElement("div");
      card.className = "bank-card";
      card.innerHTML =
        '<div class="bc-logo" style="background:' + esc(b.color) + '">' + esc(b.short.charAt(0)) + "</div>" +
        '<div class="bc-main">' +
          '<div class="bc-name">' + esc(b.name) +
            '<span class="rank-badge ' + (b.rank <= 10 ? "top" : "") + '" style="font-size:11px;height:22px;min-width:36px;border-radius:6px">' + esc(L.rankBadge(b)) + "</span>" +
          "</div>" +
          '<div class="bc-meta">成立 <b>' + esc((b.info && b.info.founded) || "-") + "</b> · 总部 <b>" + esc((b.info && b.info.hq) || b.city) + "</b> · 在招 <b>" + openCountOf(b.id) + "</b> 岗</div>" +
          '<div class="bc-tags"><span class="chip type-bank">' + esc(b.type) + '</span><span class="chip type-level">公众号：' + esc(b.wechat || "-") + "</span></div>" +
        "</div>";
      card.addEventListener("click", function () { openSidebar(b); });
      frag.appendChild(card);
    });
    list.appendChild(frag);
  }
  function openSidebar(bank) {
    var sb = $("bankSidebar");
    var info = bank.info || {};
    sb.innerHTML =
      '<div class="sb-head">' +
        '<div class="sb-logo" style="background:' + esc(bank.color) + '">' + esc(bank.short.charAt(0)) + "</div>" +
        '<div class="sb-name">' + esc(bank.name) +
          "<small>" + esc(bank.type) + (bank.rank < 200 ? " · 中银协百强第 " + bank.rank + " 位" : " · 外资行") + "</small></div>" +
        '<button class="sb-close" id="sbClose">×</button>' +
      "</div>" +
      '<div class="sb-body">' +
        '<div class="sb-facts">' +
          '<div class="sb-fact"><div class="f-label">成立时间</div><div class="f-value">' + esc(info.founded || "-") + "</div></div>" +
          '<div class="sb-fact"><div class="f-label">总部</div><div class="f-value">' + esc(info.hq || bank.city) + "</div></div>" +
          '<div class="sb-fact"><div class="f-label">机构类型</div><div class="f-value">' + esc(bank.type) + "</div></div>" +
          '<div class="sb-fact"><div class="f-label">当前在招</div><div class="f-value">' + openCountOf(bank.id) + " 个岗位</div></div>" +
        "</div>" +
        '<div class="sb-desc">' + esc(info.desc || "暂无简介") + "</div>" +
        '<div class="sb-links">' +
          '<a class="sb-link" href="#/positions?bank=' + esc(bank.id) + '">' + I.search + "<span>查看该银行全部岗位</span></a>" +
          '<a class="sb-link" href="' + esc(bank.recruit_url) + '" target="_blank" rel="noopener">' + I.ext + "<span>招聘官网<span class=\"lk-sub\">" + esc(bank.recruit_url) + "</span></span></a>" +
        "</div>" +
      "</div>";
    sb.hidden = false;
    $("sidebarMask").hidden = false;
    $("sbClose").onclick = closeSidebar;
  }
  function closeSidebar() {
    $("bankSidebar").hidden = true;
    $("sidebarMask").hidden = true;
  }

  /* ---------- 筛选事件 ---------- */
  function bindFilters() {
    $("fProvince").addEventListener("change", function () {
      F.province = this.value; F.city = "全部"; refreshCitySelect(); renderHome();
    });
    $("fCity").addEventListener("change", function () { F.city = this.value; renderHome(); });
    $("fType").addEventListener("change", function () { F.type = this.value; renderHome(); });
    $("fLevel").addEventListener("change", function () { F.level = this.value; renderHome(); });
    $("fYear").addEventListener("change", function () { F.year = this.value; renderHome(); });
    $("fBatch").addEventListener("change", function () { F.batch = this.value; renderHome(); });
    $("fSearch").addEventListener("input", function () {
      F.search = this.value.trim();
      $("btnClearSearch").style.display = F.search ? "flex" : "none";
      renderHome();
    });
    $("btnClearSearch").addEventListener("click", function () {
      $("fSearch").value = ""; F.search = "";
      this.style.display = "none";
      renderHome();
    });
    $("btnReset").addEventListener("click", resetFilters);
    $("specialChipClear").addEventListener("click", function () {
      F.special = null; F.bank = "全部";
      renderHome();
      try { history.replaceState(null, "", "#/positions"); } catch (e) { location.hash = "#/positions"; }
    });
    document.querySelectorAll(".kpi-clickable").forEach(function (card) {
      card.addEventListener("click", function () { location.hash = card.dataset.go; });
    });
    $("sidebarMask").addEventListener("click", closeSidebar);
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") closeSidebar();
    });
    document.querySelectorAll(".seg-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        document.querySelectorAll(".seg-btn").forEach(function (b) { b.classList.remove("active"); });
        this.classList.add("active");
        F.status = this.dataset.status;
        renderHome();
      });
    });
  }
  function resetFilters() {
    F = { province: "全部", city: "全部", type: "全部", level: "全部", year: "全部", batch: "全部", search: "", status: "all", special: null, bank: "全部" };
    $("fProvince").value = "全部"; $("fCity").value = "全部";
    $("fType").value = "全部"; $("fLevel").value = "全部";
    $("fYear").value = "全部"; $("fBatch").value = "全部";
    $("fSearch").value = ""; $("btnClearSearch").style.display = "none";
    document.querySelectorAll(".seg-btn").forEach(function (b) { b.classList.toggle("active", b.dataset.status === "all"); });
    refreshCitySelect();
    renderHome();
  }

  function ensureModeForPosition(pid) {
    if (positionById(pid)) return true;
    if (RADAR_MODE === "bank" && window.FPOSITIONS && window.FPOSITIONS.some(function (p) { return p.id === pid; })) {
      loadRadar("consulting"); return true;
    }
    if (RADAR_MODE === "consulting" && window.POSITIONS && window.POSITIONS.some(function (p) { return p.id === pid; })) {
      loadRadar("bank"); return true;
    }
    return false;
  }
  function ensureModeForOrg(oid) {
    if (bankById(oid)) return true;
    if (RADAR_MODE === "bank" && window.FIRMS && window.FIRMS.some(function (f) { return f.id === oid; })) {
      loadRadar("consulting"); return true;
    }
    if (RADAR_MODE === "consulting" && window.BANKS && window.BANKS.some(function (b) { return b.id === oid; })) {
      loadRadar("bank"); return true;
    }
    return false;
  }

  /* ---------- 路由 ---------- */
  function route() {
    var h = location.hash || "#/";
    var qIdx = h.indexOf("?");
    var path = qIdx >= 0 ? h.slice(0, qIdx) : h;
    var query = {};
    if (qIdx >= 0) {
      h.slice(qIdx + 1).split("&").forEach(function (kv) {
        var p = kv.split("=");
        if (p[0]) query[p[0]] = decodeURIComponent(p[1] || "");
      });
    }
    var views = ["landing", "home", "detail", "fav", "banks"];
    views.forEach(function (v) { $("view-" + v).hidden = true; });
    closeSidebar();
    var navActive = "home";
    if (h === "#/" || h === "#" || h === "") {
      // 向导页（起始页）
      $("view-landing").hidden = false;
      navActive = "";
    } else if (h.indexOf("#/radar/") === 0) {
      // 切换雷达并进入工作台
      var mode = h.slice(8);
      if (mode !== "bank" && mode !== "consulting") mode = "bank";
      if (mode !== RADAR_MODE) loadRadar(mode);
      renderHome();
      $("view-home").hidden = false;
      navActive = "home";
    } else if (h.indexOf("#/p/") === 0) {
      ensureModeForPosition(decodeURIComponent(h.slice(4)));
      renderDetail(decodeURIComponent(h.slice(4)));
      navActive = "home";
    } else if (path === "#/fav") {
      renderFav();
      $("view-fav").hidden = false;
      navActive = "fav";
    } else if (path === "#/banks" || path.indexOf("#/banks/") === 0) {
      if (path.indexOf("#/banks/") === 0) ensureModeForOrg(decodeURIComponent(path.slice(8)));
      renderBanks();
      $("view-banks").hidden = false;
      navActive = "banks";
      if (path.indexOf("#/banks/") === 0) {
        var bid = decodeURIComponent(path.slice(8));
        var bank = bankById(bid);
        if (bank) openSidebar(bank);
      }
    } else {
      // 工作台 / 岗位库（支持 ?status=open|fav=1|new=1|bank=xxx）
      if (!POSITIONS.length && RADAR_MODE === "bank") loadRadar("bank");
      if (query.status === "open" || query.status === "closed") {
        F.status = query.status;
        document.querySelectorAll(".seg-btn").forEach(function (b) {
          b.classList.toggle("active", b.dataset.status === F.status);
        });
      }
      if (query.fav === "1") F.special = "fav";
      else if (query.new === "1") F.special = "new";
      if (query.bank) F.bank = query.bank;
      renderHome();
      $("view-home").hidden = false;
      navActive = path === "#/positions" ? "positions" : "home";
    }
    document.querySelectorAll(".nav-link").forEach(function (a) {
      a.classList.toggle("active", a.dataset.route === navActive);
    });
    window.scrollTo(0, 0);
  }

  /* ---------- 导出 Excel（当前筛选结果） ---------- */
  function exportExcel() {
    var items = filteredPositions();
    if (!items.length) { alert("当前筛选结果为空，无可导出数据"); return; }
    var rows = [[L.orgCol, "分支机构名称", "岗位名称", "投递截止日期", "投递链接", "招聘批次", "招聘时间"]];
    items.forEach(function (p) {
      var b = bankById(p.bank);
      rows.push([
        b ? b.name : p.bank,
        p.org || (p.level === "总行" || p.level === "中国大陆总部" ? "总部" : "—"),
        p.type,
        p.dead || "",
        p.url || p.ann || (b ? b.recruit_url : ""),
        p.batch || "",
        (p.open || "") + (p.dead ? " ~ " + p.dead : "")
      ]);
    });
    var bin = window.xlsxBuild(rows, L.sheetName);
    var arr = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i) & 0xff;
    var blob = new Blob([arr], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = (RADAR_MODE === "consulting" ? "咨询雷达_岗位导出_" : "银招雷达_岗位导出_") + (META.updated_at || "export") + ".xlsx";
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
  }

  /* ---------- 初始化 ---------- */
  function init() {
    var saved = "bank";
    try { saved = sessionStorage.getItem("radar.mode") || "bank"; } catch (e) {}
    if (saved !== "consulting") saved = "bank";
    loadRadar(saved);
    if (!POSITIONS.length) {
      document.body.insertAdjacentHTML("afterbegin", '<div style="background:#C0392B;color:#fff;padding:8px 20px;font-size:13px">数据加载失败：data/positions.js 为空，请检查文件。</div>');
      return;
    }
    bindFilters();
    $("btnExport").addEventListener("click", exportExcel);
    window.addEventListener("hashchange", route);
    route();
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
