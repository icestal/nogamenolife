# -*- coding: utf-8 -*-
# 本机跑 Steam 家庭组 API(替代浏览器油猴):
#   用法: STEAM_TOKEN=<token> [STEAMID=<steamid64>] python fetch_family.py
#   token 由成员在登录的浏览器 F12 里从 ajaxgetasyncconfig 获取(不写死、不落文件)
# 输出: family_library.tsv(appid \t 中文名),并打印原始 app 字段供检查 owner 等
import json, os, sys, time, urllib.parse, urllib.request

STEAMID = os.environ.get('STEAMID', '76561198354643514')  # 老胡
TOKEN = os.environ.get('STEAM_TOKEN', '')
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'family_library.tsv')

if not TOKEN:
    print('未提供 token。请在浏览器 F12 登录后执行:\n'
          "fetch('https://store.steampowered.com/pointssummary/ajaxgetasyncconfig?_t='+Date.now(),"
          "{credentials:'include'}).then(r=>r.json()).then(d=>copy(d.webapi_token))")
    sys.exit(1)


def api(path, params):
    url = 'https://api.steampowered.com/' + path + '?format=json&' + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    for attempt in range(1, 4):
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                raw = r.read().decode('utf-8', 'replace')
            if raw.lstrip().startswith('<'):
                raise RuntimeError('返回 HTML(前 300 字):' + raw[:300])
            return json.loads(raw)
        except Exception as e:
            print(f'  第{attempt}次失败: {e}')
            if attempt < 3:
                time.sleep(2)
    return None


print(f'① 家庭组… steamid={STEAMID}')
g = api('IFamilyGroupsService/GetFamilyGroupForUser/v1',
        {'access_token': TOKEN, 'steamid': STEAMID})
if not g:
    sys.exit('家庭组接口失败,见上方错误')
gr = g.get('response', g)
fid = gr.get('family_groupid') or gr.get('family_group_id') or gr.get('nFamilyGroupID')
if not fid:
    sys.exit('未找到家庭组,原始响应:\n' + json.dumps(g, ensure_ascii=False)[:800])
print(f'家庭组 ID: {fid}')

print('② 共享库游戏…')
a = api('IFamilyGroupsService/GetSharedLibraryApps/v1',
        {'access_token': TOKEN, 'steamid': STEAMID, 'family_groupid': fid,
         'include_own': 'true', 'include_free': 'false', 'include_excluded': 'false',
         'include_non_games': 'false', 'language': 'schinese', 'max_apps': '5000'})
if not a:
    sys.exit('共享库接口失败,见上方错误')
r = a.get('response', a)
apps = r.get('apps', []) if isinstance(r, dict) else r
if isinstance(apps, dict):  # 兼容 {id: name} 形式
    apps = [{'appid': int(k), 'name': v if isinstance(v, str) else (v or {}).get('name', '')}
            for k, v in apps.items()]
print(f'获取到 {len(apps)} 款游戏')

# 打印第一条 app 的所有字段,检查 owner 等附加信息
if apps:
    print('首条 app 字段:', sorted(apps[0].keys()) if isinstance(apps[0], dict) else type(apps[0]))

lines = []
for x in apps:
    if isinstance(x, dict):
        appid = x.get('appid') or x.get('app_id') or x.get('id')
        name = x.get('name') or x.get('app_name') or ''
        owner = x.get('owner') or x.get('owner_steamid') or x.get('ownerid') or ''
    else:
        appid, name, owner = x, '', ''
    lines.append((str(appid), str(name), str(owner)))

# 若 owner 字段非空则三列输出,否则两列
has_owner = any(row[2] for row in lines)
with open(OUT, 'w', encoding='utf-8-sig', newline='') as f:
    for appid, name, owner in lines:
        f.write('\t'.join([appid, name] + ([owner] if has_owner else [])) + '\n')
print(f'完成!已写 {OUT}({len(lines)} 行' + (' ,含 owner 字段' if has_owner else '') + ')')
