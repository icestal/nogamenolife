# -*- coding: utf-8 -*-
# 小黑盒补缺中文名: 遍历 games_dry.json 中缺中文的新游戏 → 小黑盒 302-title → 写入 games_i18n.tsv
# 用法: python fetch_xiaoheihe_missing.py [--all]
#   默认只补"新增缺中文"的游戏(相对 appids_all.txt.bak 的旧基准)
#   --all  = 补全部缺中文(旧游戏里也可能有个别漏的)
import json, os, sys, re, time
import urllib.parse
import requests

def has_cjk(s):
    return any('一' <= c <= '鿿' for c in (s or ''))

OLD_IDS = set()
if os.path.exists('appids_all.txt.bak'):
    OLD_IDS = set(int(x) for x in open('appids_all.txt.bak').read().split() if x.isdigit())

# 1. 读 dry 输出,收集缺中文的 appid
games = json.load(open('games_dry.json', encoding='utf-8'))['games']
missing = []
for g in games:
    if has_cjk(g['cn']):
        continue
    if not sys.argv.count('--all') and g['id'] in OLD_IDS:
        continue  # 默认只补新增
    missing.append(g)

print('待补中文:', len(missing))

# 2. 读现有 i18n
i18n = {}
if os.path.exists('games_i18n.tsv'):
    for line in open('games_i18n.tsv', encoding='utf-8-sig'):
        p = line.rstrip('\n').split('\t')
        if p and p[0].isdigit():
            i18n[int(p[0])] = (p[1:] + ['', ''])[:2]  # [cn, en]

# 3. 逐个查小黑盒
new_cn = 0
no_cn = []
for idx, g in enumerate(missing, 1):
    aid = g['id']
    if aid in i18n and has_cjk(i18n[aid][0]):
        continue  # 已有中文,跳过
    try:
        r = requests.get(
            'https://api.xiaoheihe.cn/game/share_game_detail?appid=%s&game_type=pc' % aid,
            allow_redirects=False, timeout=10,
            headers={'User-Agent': 'Mozilla/5.0'})
        loc = r.headers.get('Location', '')
        m = re.search(r'[?&]title=([^&]+)', loc)
        cn = urllib.parse.unquote(m.group(1)) if m else ''
    except Exception as e:
        cn = ''
    if cn and has_cjk(cn):
        if aid in i18n:
            if not i18n[aid][0]:
                i18n[aid][0] = cn
        else:
            i18n[aid] = [cn, g['en'] or g['name']]
        new_cn += 1
    else:
        no_cn.append(aid)
    if idx % 50 == 0:
        print('  ... %d/%d 已查,新中文 %d' % (idx, len(missing), new_cn), flush=True)
    time.sleep(0.25)

# 4. 写回 i18n(保留原顺序,新增排末尾)
out = open('games_i18n.tsv', 'w', encoding='utf-8')
if os.path.exists('games_i18n.tsv'):
    for line in open('games_i18n.tsv', encoding='utf-8-sig'):
        out.write(line if line.endswith('\n') else line + '\n')
for aid in sorted(i18n):
    cn, en = i18n[aid]
    out.write('%d\t%s\t%s\n' % (aid, cn, en))
out.close()

print('完成: 新增中文 %d 款,仍缺 %d 款' % (new_cn, len(no_cn)))
if no_cn:
    print('仍缺中文的 appid:', ','.join(str(x) for x in no_cn[:80]))
