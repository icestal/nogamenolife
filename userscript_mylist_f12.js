// ============================================================
// Steam 个人游戏清单导出(F12 版,无需油猴)
// 目标页(必须是这个): https://steamcommunity.com/profiles/{steamid}/games?tab=all&l=schinese
//   F12 → Console → 粘贴整段 → 回车
// 直接读页面内的 window.rgGames 数组(该页官方数据,最可靠)
// 产出: games_raw_自己.tsv  (appid \t 游戏名), 给 merge.py 当成员个人库用
// 已验证: 2026-08-09 拉老胡库 189 款成功
// ============================================================
(function () {
  'use strict';
  var games = null;
  if (window.rgGames && Array.isArray(window.rgGames)) games = window.rgGames;
  else if (window._rgGamesData && Array.isArray(window._rgGamesData.rgGames)) games = window._rgGamesData.rgGames;

  var out = [];
  if (games) {
    out = games.map(function (g) { return g.appid + '\t' + g.name; });
  } else {
    var seen = {};
    document.querySelectorAll('a[href*="/app/"]').forEach(function (a) {
      var m = (a.getAttribute('href') || '').match(/\/app\/(\d+)/);
      if (m) {
        var name = (a.textContent || '').trim();
        if (name && name.length <= 60 && !seen[m[1]]) seen[m[1]] = name;
      }
    });
    out = Object.keys(seen).map(function (id) { return id + '\t' + seen[id]; });
  }

  if (!out.length) {
    console.log('没抓到数据，确认是在 games?tab=all 页面？(需对方库公开)');
    return;
  }
  console.log('共 ' + out.length + ' 款，样例:\n' + out.slice(0, 5).join('\n'));
  try { copy(out.join('\n')); console.log('（已复制到剪贴板，可直接粘进 tsv）'); } catch (e) {
    // 浏览器禁用剪贴板时回退下载文件
    var blob = new Blob(['﻿' + out.join('\n')], { type: 'text/tab-separated-values;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = 'games_raw_自己.tsv';
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(url); }, 3000);
    console.log('已下载 games_raw_自己.tsv');
  }
})();
