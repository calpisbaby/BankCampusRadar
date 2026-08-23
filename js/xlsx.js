/* ============================================================
 * 银招雷达 · 极简 XLSX 生成器（零依赖，ZIP store 无压缩法）
 * 兼容 Excel / WPS / LibreOffice；浏览器与 Node 均可运行
 * ============================================================ */
(function (root) {
  "use strict";

  // UTF-8 编码为 "binary string"
  function utf8b(s) {
    if (typeof unescape === "function") {
      return unescape(encodeURIComponent(s));
    }
    return Buffer.from(s, "utf8").toString("latin1");
  }

  // CRC32 表
  var crcTbl = (function () {
    var t = [], c;
    for (var n = 0; n < 256; n++) {
      c = n;
      for (var k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      t[n] = c >>> 0;
    }
    return t;
  })();

  function crc32(s) {
    var c = 0xFFFFFFFF;
    for (var i = 0; i < s.length; i++) c = crcTbl[(c ^ s.charCodeAt(i)) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  }

  function colName(i) {
    var s = "";
    i++;
    while (i > 0) {
      s = String.fromCharCode(65 + ((i - 1) % 26)) + s;
      i = Math.floor((i - 1) / 26);
    }
    return s;
  }

  function escXml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");
  }

  // 生成 worksheet XML（inlineStr 方式，免 sharedStrings）
  function sheetXml(rows) {
    var xml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>';
    for (var r = 0; r < rows.length; r++) {
      xml += '<row r="' + (r + 1) + '">';
      for (var c = 0; c < rows[r].length; c++) {
        var v = (rows[r][c] == null) ? "" : String(rows[r][c]);
        xml += '<c r="' + colName(c) + (r + 1) + '" t="inlineStr"><is><t xml:space="preserve">' +
          escXml(v) + "</t></is></c>";
      }
      xml += "</row>";
    }
    return xml + "</sheetData></worksheet>";
  }

  function xlsxBuild(rows, sheetName) {
    var name = sheetName || "Sheet1";
    var files = [
      { name: "[Content_Types].xml", data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
          '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
          '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
          '<Default Extension="xml" ContentType="application/xml"/>' +
          '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
          '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
          "</Types>" },
      { name: "_rels/.rels", data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
          '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
          '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
          "</Relationships>" },
      { name: "xl/workbook.xml", data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
          '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
          '<sheets><sheet name="' + escXml(name) + '" sheetId="1" r:id="rId1"/></sheets></workbook>' },
      { name: "xl/_rels/workbook.xml.rels", data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
          '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
          '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>' +
          "</Relationships>" },
      { name: "xl/worksheets/sheet1.xml", data: sheetXml(rows) }
    ];

    var body = [], central = [], offset = 0;
    files.forEach(function (f) {
      var nameB = utf8b(f.name);
      var data = utf8b(f.data);
      var crc = crc32(data);
      var nl = nameB.length, dl = data.length;

      // Local File Header (PK\x03\x04)
      body.push(0x50, 0x4B, 0x03, 0x04, 20, 0, 0, 0, 0, 0, 0, 0, 0, 0);
      [crc & 0xFF, (crc >>> 8) & 0xFF, (crc >>> 16) & 0xFF, (crc >>> 24) & 0xFF].forEach(function (b) { body.push(b); });
      [dl & 0xFF, (dl >>> 8) & 0xFF, (dl >>> 16) & 0xFF, (dl >>> 24) & 0xFF].forEach(function (b) { body.push(b); });
      [dl & 0xFF, (dl >>> 8) & 0xFF, (dl >>> 16) & 0xFF, (dl >>> 24) & 0xFF].forEach(function (b) { body.push(b); });
      [nl & 0xFF, (nl >>> 8) & 0xFF].forEach(function (b) { body.push(b); });
      body.push(0, 0);  // extra len
      for (var i = 0; i < nameB.length; i++) body.push(nameB.charCodeAt(i));
      for (var j = 0; j < data.length; j++) body.push(data.charCodeAt(j));

      // Central Directory (PK\x01\x02)
      var ch = [0x50, 0x4B, 0x01, 0x02, 20, 0, 20, 0, 0, 0, 0, 0, 0, 0, 0, 0];
      [crc & 0xFF, (crc >>> 8) & 0xFF, (crc >>> 16) & 0xFF, (crc >>> 24) & 0xFF].forEach(function (b) { ch.push(b); });
      [dl & 0xFF, (dl >>> 8) & 0xFF, (dl >>> 16) & 0xFF, (dl >>> 24) & 0xFF].forEach(function (b) { ch.push(b); });
      [dl & 0xFF, (dl >>> 8) & 0xFF, (dl >>> 16) & 0xFF, (dl >>> 24) & 0xFF].forEach(function (b) { ch.push(b); });
      [nl & 0xFF, (nl >>> 8) & 0xFF].forEach(function (b) { ch.push(b); });
      ch.push(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0);  // extra(2) comment(2) disk(2) internal(2) external(4)
      [offset & 0xFF, (offset >>> 8) & 0xFF, (offset >>> 16) & 0xFF, (offset >>> 24) & 0xFF].forEach(function (b) { ch.push(b); });
      for (var k = 0; k < nameB.length; k++) ch.push(nameB.charCodeAt(k));
      central = central.concat(ch);

      offset += 30 + nl + dl;
    });

    // EOCD (PK\x05\x06)
    var total = files.length;
    var cdSize = central.length;
    var eocd = [0x50, 0x4B, 0x05, 0x06, 0, 0, 0, 0];
    [total & 0xFF, (total >>> 8) & 0xFF].forEach(function (b) { eocd.push(b); });
    [total & 0xFF, (total >>> 8) & 0xFF].forEach(function (b) { eocd.push(b); });
    [cdSize & 0xFF, (cdSize >>> 8) & 0xFF, (cdSize >>> 16) & 0xFF, (cdSize >>> 24) & 0xFF].forEach(function (b) { eocd.push(b); });
    [offset & 0xFF, (offset >>> 8) & 0xFF, (offset >>> 16) & 0xFF, (offset >>> 24) & 0xFF].forEach(function (b) { eocd.push(b); });
    eocd.push(0, 0);

    var all = body.concat(central, eocd);
    var bin = "";
    for (var m = 0; m < all.length; m++) bin += String.fromCharCode(all[m]);
    return bin;
  }

  root.xlsxBuild = xlsxBuild;
  if (typeof module !== "undefined" && module.exports) module.exports = { xlsxBuild: xlsxBuild };
})(typeof window !== "undefined" ? window : globalThis);
