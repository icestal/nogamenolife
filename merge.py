# -*- coding: utf-8 -*-
# 只买不玩康复中心 · 合并 → games.json
# 数据源(全部可选,缺失自动跳过):
#   appids_all.txt          总量清单(第一步导出的 appid 全集,空格分隔,以它为准)
#   family_library_full.tsv 家庭组库(appid\t中文名\t英文名\towners\t排除原因)→ 判定可共享+owner
#   games_i18n.tsv          appid\t中文名\t英文名(补 family 未覆盖的中英文)
#   games_raw_*.tsv         各成员个人库(appid\t游戏名)→ name/owners
#   games_tags.tsv          appid\t系列\t别名...(手工维护)
import json, os, datetime

MEMBERS = ["老胡", "小寒", "ZZZ"]
files = {
    "老胡": "games_raw_laohu.tsv",
    "小寒": "games_raw_xiaohan.tsv",
    "ZZZ": "games_raw_zzz.tsv",
}

# family_library_full 的 owner 是 steamid,映射回成员名;临时成员不入库
OWNER_MAP = {
    "76561198354643514": "老胡",
    "76561199637975845": "小寒",
    "76561198346840276": "ZZZ",
    # 76561199841374927 = 临时成员 → 不在映射里,自动排除
}

def load_tsv(fp, columns=0):
    """读可选数据源。返回 {appid: [列1, 列2, ...]}。文件不存在则返回空 dict。
    columns>0 表示固定列(不足补空串);columns=0 表示读取全部剩余列。"""
    out = {}
    if not os.path.exists(fp):
        return out
    with open(fp, encoding='utf-8-sig') as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith('#'):
                continue
            parts = line.split('\t')
            if len(parts) >= 1 and parts[0].isdigit():
                appid = int(parts[0])
                if columns > 0:
                    # 取前 columns 个剩余列,不足补空串,超了截断
                    row = (parts[1:] + [''] * columns)[:columns]
                else:
                    row = parts[1:]
                out[appid] = row
    return out

def load_family(fp, require_owner):
    """读一个家庭组库文件 → {appid: [cn,en,owners,exclude]}。
    require_owner 非空时,只接受 owner 含这些 steamid 之一的行(用于小寒这种在别人组的成员)。"""
    out = {}
    if not os.path.exists(fp):
        return out
    with open(fp, encoding='utf-8-sig') as f:
        for line in f:
            parts = line.rstrip('\n').split('\t')
            if not parts or not parts[0].isdigit():
                continue
            row = (parts[1:] + [''] * 4)[:4]  # cn, en, owners, exclude_reason
            if require_owner and not any(s in require_owner for s in str(row[2]).split(',')):
                continue  # 别人组共享给她的,不算可共享
            out[int(parts[0])] = row
    return out

def pick_first_cjk(*cands):
    """依次取第一个含中文的候选;都没有则取第一个非空项。
    家庭 API 的 schinese 名对未本地化游戏会回退英文(如 'Hollow Knight'),
    此时用它前面的官方中文 / 后面的 i18n 小黑盒中文,避免英文名挡住中文。"""
    for c in cands:
        if c and any('一' <= ch <= '鿿' for ch in c):
            return c
    for c in cands:
        if c:
            return c
    return ''


# ---- 总量基准:appids_all.txt(没有则回退到成员库合并) ----
all_ids = []
if os.path.exists('appids_all.txt'):
    with open('appids_all.txt', encoding='utf-8') as f:
        all_ids = [int(x) for x in f.read().split() if x.isdigit()]

# ---- 各数据源 ----
# 家庭组库:多个文件合并判定"可共享"
# (文件名, 限定 owner 集合):小寒在别人组,只认 owner 含小寒的行;老胡+ZZZ 组整体认
FAMILY_FILES = [
    ('family_library_full.tsv', None),
    ('family_library_xiaohan.tsv', {'76561199637975845'}),
]
family = {}
for _fp, _ro in FAMILY_FILES:
    family.update(load_family(_fp, _ro))

i18n = load_tsv('games_i18n.tsv', 2)              # [cn, en]
tags = load_tsv('games_tags.tsv')                 # [series, alias...]

# 成员个人库:name + owners
members_games = {}
for m in MEMBERS:
    fp = files[m]
    if not os.path.exists(fp):
        continue
    with open(fp, encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            parts = line.split('\t')
            if len(parts) >= 2 and parts[0].isdigit():
                appid = int(parts[0])
                if appid not in members_games:
                    members_games[appid] = {"name": parts[1], "owners": set()}
                members_games[appid]["owners"].add(m)

# 基准兜底:没有 appids_all.txt 时用成员库合并的全集
if not all_ids:
    all_ids = sorted(members_games)

result = []
for appid in all_ids:
    frow = family.get(appid, ['', '', '', ''])
    irow = i18n.get(appid, ['', ''])
    m = members_games.get(appid, {})

    name = m.get('name', '') or frow[0] or irow[0] or ''
    cn = pick_first_cjk(frow[0], irow[0], name)
    en = frow[1] or irow[1] or name

    # owners:家庭组 owner(steamid→成员名)优先,成员库兜底
    owners = set(m.get('owners', set()))
    if frow[2]:
        for sid in str(frow[2]).split(','):
            sid = sid.strip()
            if sid in OWNER_MAP:
                owners.add(OWNER_MAP[sid])
    owners = [x for x in MEMBERS if x in owners]

    trow = tags.get(appid, [])
    series = trow[0] if trow else ''
    aliases = trow[1:] if len(trow) > 1 else []

    excl = frow[3] if len(frow) > 3 else ''  # 共享排除原因(3=Steam 排除:免费工具/免费游戏不可共享)
    result.append({
        "id": appid,
        "name": name,
        "cn": cn,
        "en": en,
        "aliases": aliases,
        "series": series,
        "owners": owners,
        "share": appid in family and excl != '3',  # 在家庭组且未被 Steam 排除 = 可共享
        "exclude": excl,
    })

result.sort(key=lambda g: g["id"])
data = {
    "site": {"title": "只买不玩康复中心"},
    "updated": datetime.date.today().isoformat(),
    "games": result,
}
with open('games.json', 'w', encoding='utf-8') as f:
    json.dump(data, f, ensure_ascii=False, indent=2)

print("合并完成：共 %d 款（family %d 条可共享，i18n %d 条，tags %d 条）"
      % (len(result), len(family), len(i18n), len(tags)))
