// ============================================================
// Steam 家庭库完整字段抓取(F12 版 v2,无需油猴)
// 在 store.steampowered.com 登录状态下,F12 → Console 粘贴回车
// 自动: 拿 token → 找家庭组 → 拉两次共享库(english + schinese) → 合并中英文名+owners+排除原因
// 产出: family_library_full.tsv (appid \t 中文名 \t 英文名 \t owners \t exclude_reason)
// 首条记录会打印全部字段,用于确认 API 极限信息
// ============================================================
(async function () {
  var steamid = prompt('SteamID64', '76561198354643514') || '76561198354643514';
  steamid = steamid.trim();
  if (!/^\d{17}$/.test(steamid)) { console.log('SteamID64 格式不对,中止'); return; }

  var T = Date.now();
  var d = await (await fetch('https://store.steampowered.com/pointssummary/ajaxgetasyncconfig?_t=' + T, { credentials: 'include' })).json();
  var token = d.data && d.data.webapi_token;
  if (!token) { console.log('没拿到 token,确认已登录商店?'); return; }
  console.log('① Token OK');

  function api(path, params) {
    var qs = Object.keys(params).map(function (k) {
      return k + '=' + encodeURIComponent(params[k]);
    }).join('&');
    return fetch('https://api.steampowered.com/' + path + '?format=json&' + qs).then(function (r) { return r.json(); });
  }

  console.log('② 找家庭组…');
  var g = await api('IFamilyGroupsService/GetFamilyGroupForUser/v1', { access_token: token, steamid: steamid });
  var gr = g.response || g;
  var fid = gr.family_groupid || gr.family_group_id || gr.nFamilyGroupID;
  if (!fid) { console.log('没找到家庭组:' + JSON.stringify(g).substring(0, 400)); return; }
  console.log('家庭组 ID:', fid);

  console.log('③ 拉共享库(english + schinese)…');
  async function pull(lang) {
    var a = await api('IFamilyGroupsService/GetSharedLibraryApps/v1', {
      access_token: token, steamid: steamid, family_groupid: fid,
      include_own: 'true', include_free: 'false', include_excluded: 'false',
      include_non_games: 'false', language: lang, max_apps: '5000'
    });
    var r = a.response || a;
    return Array.isArray(r.apps) ? r.apps : [];
  }

  var en = await pull('english');
  var cn = await pull('schinese');
  console.log('英文 ' + en.length + ' 款,中文 ' + cn.length + ' 款');

  // ---- 探查:首条记录的完整字段 ----
  var probe = en[0] || cn[0];
  if (probe) {
    console.log('全部字段:', Object.keys(probe).join(', '));
    console.log('首条完整内容:', JSON.stringify(probe));
  }

  // ---- 合并中英文 + owners + exclude_reason ----
  var cnMap = {};
  cn.forEach(function (x) { cnMap[x.appid] = x.name; });
  var lines = en.map(function (x) {
    var appid = x.appid || x.app_id || x.id;
    var owners = Array.isArray(x.owner_steamids) ? x.owner_steamids.join(',') : '';
    return appid + '\t' + (cnMap[appid] || '') + '\t' + (x.name || '') + '\t' + owners + '\t' + (x.exclude_reason || '');
  });

  var blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/tab-separated-values;charset=utf-8' });
  var url = URL.createObjectURL(blob);
  var el = document.createElement('a');
  el.href = url; el.download = 'family_library_full.tsv';
  document.body.appendChild(el); el.click();
  setTimeout(function () { document.body.removeChild(el); URL.revokeObjectURL(url); }, 1000);
  console.log('完成!已下载 family_library_full.tsv,共 ' + lines.length + ' 行。把文件路径/内容和上面的字段列表发我');
})().catch(function (e) { console.error('[错误]', e); alert('出错:' + e.message); });
