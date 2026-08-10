// ==UserScript==
// @name         Steam 游戏中英文名批量抓取(通用版)
// @namespace    icestal
// @version      2.0
// @description  弹窗输入 AppID 列表→批量抓 Steam 官方中英文名→下载 TSV。AppID 用 GM_setValue 持久化,二次使用回车沿用,无需改代码。
// @match        https://steamdb.info/*
// @match        https://store.steampowered.com/*
// @match        https://steamcommunity.com/*
// @grant        GM_setValue
// @grant        GM_getValue
// ==/UserScript==

(function () {
  'use strict';

  var DELAY_MS = 1600; // 限流间隔(Steam API 约 200 请求/5分钟/IP)
  var BATCH = 20; // 每批 AppID 数(批量请求加速:821 款双语言约 5 分钟内)
  var STORE = 'i18n_appids'; // GM_setValue 存储键,脚本自动记住 AppID

  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  // 解析用户粘贴的 id:支持空格/逗号/换行/制表符分隔,自动去重
  function parseIds(s) {
    var seen = {}, out = [];
    String(s || '').split(/[\s,，;；\n\t]+/).forEach(function (x) {
      var n = parseInt(x, 10);
      if (!isNaN(n) && !seen[n]) { seen[n] = 1; out.push(n); }
    });
    return out;
  }

  // 原生 fetch 封装成 Promise:脚本在 store 页运行,api/appdetails 是同域,不需要 GM_xmlhttpRequest
  // (改用 fetch 可避开篡改猴"权限受限"导致 GM_xmlhttpRequest 全部失败的坑)
  function xhr(url) {
    return new Promise(function (resolve, reject) {
      var ctrl = new AbortController();
      var timer = setTimeout(function () { ctrl.abort(); }, 30000);
      fetch(url, { signal: ctrl.signal }).then(function (r) {
        return r.text();
      }).then(function (t) {
        clearTimeout(timer); resolve(t);
      }).catch(function (e) {
        clearTimeout(timer); reject(e);
      });
    });
  }

  // 抓一批 AppID 的中文(cn)或英文(en)名,失败自动重试 3 次
  async function fetchBatch(ids, lang) {
    var url = 'https://store.steampowered.com/api/appdetails?appids=' + ids.join(',') +
              (lang === 'cn' ? '&l=schinese' : '&l=english');
    for (var attempt = 1; attempt <= 3; attempt++) {
      try {
        var j = JSON.parse(await xhr(url));
        var out = {};
        for (var i = 0; i < ids.length; i++) {
          var item = j[String(ids[i])];
          out[ids[i]] = (item && item.success && item.data) ? item.data.name : null;
        }
        return out;
      } catch (e) {
        if (attempt < 3) await sleep(DELAY_MS * 2);
      }
    }
    return null; // 3 次仍失败,交给调用方记录
  }

  // 交互:读取已保存的 AppID,弹窗让用户选择沿用/覆盖/清空
  function getIds() {
    var saved = GM_getValue(STORE, null);
    if (Array.isArray(saved) && saved.length) {
      var choice = prompt(
        '上次已保存 ' + saved.length + ' 个 AppID。\n\n' +
        '[回车] 沿用这 ' + saved.length + ' 个\n' +
        '[new] 粘贴新列表覆盖\n' +
        '[clear] 清空后重新输入'
      );
      if (choice === null) return null;
      var c = String(choice).trim().toLowerCase();
      if (c === 'new') return promptNew();
      if (c === 'clear') { GM_setValue(STORE, null); return promptNew(); }
      return saved; // 回车或其他 → 沿用
    }
    return promptNew();

    // 弹窗粘贴新 AppID 列表,识别有效数字后持久化
    function promptNew() {
      var input = prompt('粘贴 AppID 列表\n(空格/逗号/换行分隔,如: 2206270 2342950 1030300)');
      if (input === null) return null;
      var ids = parseIds(input);
      if (!ids.length) { alert('没有识别到有效 AppID'); return null; }
      GM_setValue(STORE, ids);
      return ids;
    }
  }

  async function run() {
    var ids = getIds();
    if (!ids || !ids.length) { console.log('已取消或无可抓取 AppID'); return; }

    console.log('开始抓取 ' + ids.length + ' 款,每批 ' + BATCH + ' 个,保持页面打开…');
    var batches = [];
    for (var i = 0; i < ids.length; i += BATCH) batches.push(ids.slice(i, i + BATCH));

    var cnAll = {}, enAll = {}, failed = [], done = 0;
    for (var b = 0; b < batches.length; b++) {
      var batch = batches[b];
      var cn = await fetchBatch(batch, 'cn');
      if (cn) { Object.assign(cnAll, cn); } else { failed.push(batch); }
      await sleep(DELAY_MS);

      var en = await fetchBatch(batch, 'en');
      if (en) { Object.assign(enAll, en); } else { failed.push(batch); }
      await sleep(DELAY_MS);

      done += batch.length;
      console.log('进度 ' + done + '/' + ids.length + ' 款');
    }

    // 产出 TSV:appid \t 中文名 \t 英文名(缺的留空)
    var lines = ids.map(function (id) {
      return id + '\t' + (cnAll[id] || '') + '\t' + (enAll[id] || '');
    });
    var blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/tab-separated-values;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = 'games_i18n.tsv';
    document.body.appendChild(a); a.click();
    setTimeout(function () { document.body.removeChild(a); URL.revokeObjectURL(url); }, 1000);

    console.log('完成!已下载 games_i18n.tsv,共 ' + lines.length + ' 行。');
    if (failed.length) {
      console.log('以下批次抓取失败(3 次重试后),可把这些 AppID 重新喂给脚本再跑一次:');
      failed.forEach(function (f) { console.log('  ' + f.join(',')); });
    } else {
      console.log('全部成功,无缺失。');
    }
  }

  run();
})();
