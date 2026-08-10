// ============================================================
// Steam 游戏中英文名批量抓取(F12 版 v4:单请求 + 断点续传 + 限流自适应)
// 修复:批量 appids=440,570 已被 Steam 拒绝(400),只能逐个请求
// 修复:1200ms 间隔超限流(200 请求/5分钟),跑到一半被 429 锁死
// 策略:默认 1800ms(安全线内);遇 429 休息 5 分钟冷却,之后自动放慢速度
// 持久化:appid 列表 + 已抓结果都存 localStorage,中断/刷新后重跑自动续抓
// 产出: games_i18n.tsv (appid \t 中文名 \t 英文名)
// ============================================================
(async function () {
  var DELAY_MS = 1800; // 限流间隔(安全线内,约 33 请求/分钟,不会触发 429)
  var KEY = 'i18n_appids_f12';
  var RES_KEY = 'i18n_results_f12';

  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  // 解析:空格/逗号/换行/制表符分隔,自动去重
  function parseIds(s) {
    var seen = {}, out = [];
    String(s || '').split(/[\s,，;；\n\t]+/).forEach(function (x) {
      var n = parseInt(x, 10);
      if (!isNaN(n) && !seen[n]) { seen[n] = 1; out.push(n); }
    });
    return out;
  }

  // 从剪贴板读取 appid 列表(需先复制,并让页面获得焦点)
  async function readClipboard() {
    try {
      var ids = parseIds(await navigator.clipboard.readText());
      return ids.length ? ids : null;
    } catch (e) { return null; }
  }

  // ---- 读状态:appid 列表 + 已抓结果 ----
  var ids = parseIds(localStorage.getItem(KEY) || '');
  var results = {};
  try { results = JSON.parse(localStorage.getItem(RES_KEY) || '{}'); } catch (e) {}

  var doneCount = function () {
    return ids.filter(function (id) { return results[id] && (results[id].cn !== null || results[id].en !== null); }).length;
  };

  if (ids.length) {
    var d = doneCount();
    var c = String(prompt('已存 ' + ids.length + ' 个 AppID,已抓 ' + d + ' 款。\n\n[回车] 继续抓剩下的\n[new] 换新列表(清空已抓)\n[clear] 清空重来') || '').trim().toLowerCase();
    if (c === 'new') {
      results = {}; localStorage.removeItem(RES_KEY);
      ids = (await readClipboard()) || [];
    } else if (c === 'clear') {
      results = {}; localStorage.removeItem(RES_KEY);
      localStorage.removeItem(KEY);
      ids = (await readClipboard()) || [];
    }
  } else {
    console.log('首次运行:请先复制 appids 到剪贴板,点击本页面空白处,再运行。');
    ids = (await readClipboard()) || [];
  }
  if (!ids.length) { console.log('没有有效 AppID,中止'); return; }
  localStorage.setItem(KEY, ids.join(' '));

  var estMin = Math.ceil(ids.length * 2 * DELAY_MS / 60000);
  console.log('共 ' + ids.length + ' 款。开始抓取(逐个请求,预计约 ' + estMin + ' 分钟,挂着别关页面;中断后重跑会自动续抓)…');

  // ---- 当前实际间隔(遇 429 会加倍,直至 4000ms 上限)----
  var delay = DELAY_MS;

  // ---- 单请求抓一个名字,失败重试 + 限流冷却 + 速度自适应 ----
  async function fetchName(id, lang) {
    var url = 'https://store.steampowered.com/api/appdetails?appids=' + id + (lang ? '&l=' + lang : '');
    for (var attempt = 1; attempt <= 5; attempt++) {
      try {
        var res = await fetch(url);
        if (res.status === 429) {
          delay = Math.min(delay * 2, 4000); // 永久放慢,避免再触发
          console.log('限流,休息 5 分钟冷却,之后间隔自动改为 ' + delay + 'ms…');
          await sleep(300000);
          continue;
        }
        if (!res.ok) { await sleep(delay * 2); continue; }
        var j = await res.json();
        var item = j[String(id)];
        await sleep(delay); // 每个请求后都等,控制请求率
        if (item && item.success && item.data) return item.data.name;
        return null; // 下架/无此游戏,永久无名
      } catch (e) {
        await sleep(delay);
      }
    }
    return null;
  }

  // ---- 只抓未完成的 ----
  var todo = ids.filter(function (id) { return !(results[id] && (results[id].cn !== null || results[id].en !== null)); });
  if (!todo.length) console.log('全部已抓完,直接输出。');

  for (var i = 0; i < todo.length; i++) {
    var id = String(todo[i]);
    var en = await fetchName(id, '');
    var cn = await fetchName(id, 'schinese');
    results[id] = { cn: cn, en: en };
    if ((i + 1) % 10 === 0) {
      localStorage.setItem(RES_KEY, JSON.stringify(results));
      console.log('进度 ' + (i + 1) + '/' + todo.length + ' 款(已抓 ' + (doneCount() + i + 1) + '/' + ids.length + ')');
    }
  }
  localStorage.setItem(RES_KEY, JSON.stringify(results));

  // ---- 输出 TSV:appid \t 中文名 \t 英文名 ----
  var lines = ids.map(function (id) {
    var r = results[id] || {};
    return id + '\t' + (r.cn || '') + '\t' + (r.en || '');
  });
  var blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/tab-separated-values;charset=utf-8' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url; a.download = 'games_i18n.tsv';
  document.body.appendChild(a); a.click();
  setTimeout(function () { document.body.removeChild(a); URL.revokeObjectURL(url); }, 1000);

  var missing = lines.filter(function (l) { return !l.split('\t')[1] && !l.split('\t')[2]; }).length;
  console.log('完成!已下载 games_i18n.tsv,共 ' + lines.length + ' 行' + (missing ? ',其中 ' + missing + ' 款没抓到名字(多为已下架)。' : ',全部都有名字。'));
})();
