// ==UserScript==
// @name         Steam 家庭库自动抓取(家庭组API版)
// @namespace    icestal
// @version      1.0
// @description  登录 Steam 商店后自动获取 token→家庭组→共享库游戏(appid+中文名),下载 family_library.tsv。steamid 首次弹窗输入,自动记住。
// @match        https://store.steampowered.com/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_xmlhttpRequest
// ==/UserScript==

(function () {
  'use strict';

  var STORE = 'family_steamid';

  // GM_xmlhttpRequest 封装成 Promise(跨域调 api.steampowered.com,不受 CORS 限制)
  function xhr(url) {
    return new Promise(function (resolve, reject) {
      GM_xmlhttpRequest({
        method: 'GET', url: url, timeout: 20000,
        onload: function (r) { resolve(r.responseText); },
        onerror: reject, ontimeout: reject
      });
    });
  }

  // 自动获取 webapi_token(需登录 store.steampowered.com,同域 fetch 带 cookie)
  async function autoToken() {
    var url = 'https://store.steampowered.com/pointssummary/ajaxgetasyncconfig?_t=' + Date.now();
    var resp = await fetch(url, { credentials: 'include' });
    var data = await resp.json();
    if (data && data.webapi_token) {
      console.log('Token 获取成功:', data.webapi_token.substring(0, 8) + '…');
      return data.webapi_token;
    }
    throw new Error('未获取到 webapi_token,请确认已登录 Steam 商店');
  }

  // 调 Steam 家庭组 API(跨域),失败自动重试 3 次
  async function apiGet(path, params) {
    var qs = Object.keys(params).map(function (k) {
      return k + '=' + encodeURIComponent(params[k]);
    }).join('&');
    var url = 'https://api.steampowered.com/' + path + '?format=json&' + qs;
    for (var attempt = 1; attempt <= 3; attempt++) {
      try {
        var text = await xhr(url);
        var trimmed = text.trim();
        if (trimmed.charAt(0) === '<') {
          throw new Error('API 返回 HTML,可能未授权或路径有误');
        }
        return JSON.parse(trimmed);
      } catch (e) {
        if (attempt < 3) await sleep(2000);
        else throw e;
      }
    }
  }

  // steamid 输入/沿用(持久化,二次使用回车沿用)
  function getSteamId() {
    var saved = GM_getValue(STORE, '');
    if (saved && /^\d{17}$/.test(saved)) {
      var c = prompt('已保存 SteamID64:' + saved + '\n[回车] 沿用 / [new] 重新输入');
      if (c === null) return null;
      if (c.trim().toLowerCase() !== 'new') return saved;
    }
    var input = prompt('粘贴你的 SteamID64\n(17 位数字,可在个人资料页地址栏找到)');
    if (input === null) return null;
    var id = input.trim();
    if (!/^\d{17}$/.test(id)) { alert('SteamID64 应为 17 位数字'); return null; }
    GM_setValue(STORE, id);
    return id;
  }

  async function run() {
    var steamid = getSteamId();
    if (!steamid) { console.log('已取消'); return; }

    console.log('① 获取 Token…');
    var token = await autoToken();

    console.log('② 获取家庭组…');
    var g = await apiGet('IFamilyGroupsService/GetFamilyGroupForUser/v1', {
      access_token: token, steamid: steamid
    });
    var gr = g.response || g;
    var familyGroupId = gr.family_groupid || gr.family_group_id || gr.nFamilyGroupID;
    if (!familyGroupId) {
      throw new Error('未找到家庭组:' + JSON.stringify(g).substring(0, 400));
    }
    console.log('家庭组 ID:', familyGroupId);

    console.log('③ 获取共享库游戏…');
    var a = await apiGet('IFamilyGroupsService/GetSharedLibraryApps/v1', {
      access_token: token, steamid: steamid, family_groupid: familyGroupId,
      include_own: 'true', include_free: 'false', include_excluded: 'false',
      include_non_games: 'false', language: 'schinese', max_apps: '5000'
    });
    var r = a.response || a;
    var apps = Array.isArray(r.apps) ? r.apps : [];
    console.log('获取到 ' + apps.length + ' 款游戏');

    // 产出 TSV:appid \t 中文名(缺的留空)
    var lines = apps.map(function (x) {
      var id = x.appid || x.app_id || x.id;
      return id + '\t' + (x.name || x.app_name || '');
    });
    var blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/tab-separated-values;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var el = document.createElement('a');
    el.href = url; el.download = 'family_library.tsv';
    document.body.appendChild(el); el.click();
    setTimeout(function () { document.body.removeChild(el); URL.revokeObjectURL(url); }, 1000);
    console.log('完成!已下载 family_library.tsv,共 ' + lines.length + ' 行');
  }

  run().catch(function (e) {
    console.error('[错误]', e);
    alert('执行出错:' + e.message);
  });
})();
