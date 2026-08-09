# -*- coding: utf-8 -*-
# 只买不玩康复中心 · 合并各成员库 TSV → games.json
# 可选数据源:games_i18n.tsv(appid\t中文名\t英文名)、games_tags.tsv(appid\t系列\t别名...)
import json, os, datetime

MEMBERS = ["老胡", "小寒", "ZZZ"]
files = {
    "老胡": "games_raw_laohu.tsv",
    "小寒": "games_raw_xiaohan.tsv",
    "ZZZ": "games_raw_zzz.tsv",
}

def load_tsv(fp, columns=0):
    """读可选数据源。返回 {appid: [列1, 列2, ...]}。文件不存在则返回空 dict。
    columns=0 表示读取全部剩余列(可变列)。"""
    out = {}
    if not os.path.exists(fp):
        return out
    with open(fp, encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith('#'):
                continue
            parts = line.split('\t')
            if len(parts) >= 1 and parts[0].isdigit():
                appid = int(parts[0])
                if columns > 0:
                    # 固定列:不足的列补空串
                    row = parts[1:columns] + [''] * (columns - (len(parts) - 1))
                else:
                    row = parts[1:]
                out[appid] = row
    return out

# 中英文名(appid -> [cn, en])
i18n = load_tsv('games_i18n.tsv', 2)
# 系列/别名(appid -> [series, alias1, alias2...])
tags = load_tsv('games_tags.tsv')

games = {}
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
                name = parts[1]
                if appid not in games:
                    games[appid] = {"name": name, "owners": set()}
                games[appid]["owners"].add(m)

result = []
for appid in sorted(games):
    g = games[appid]
    owners = [m for m in MEMBERS if m in g["owners"]]

    # 中英文名:i18n 有则用,缺则回退 name
    row = i18n.get(appid, ['', ''])
    cn = row[0] or g["name"]
    en = row[1] or g["name"]

    # 系列/别名
    trow = tags.get(appid, [])
    series = trow[0] if trow else ''
    aliases = trow[1:] if len(trow) > 1 else []

    result.append({
        "id": appid,
        "name": g["name"],
        "cn": cn,
        "en": en,
        "aliases": aliases,
        "series": series,
        "owners": owners,
    })

data = {
    "site": {"title": "只买不玩康复中心"},
    "updated": datetime.date.today().isoformat(),
    "games": result,
}
with open('games.json', 'w', encoding='utf-8') as f:
    json.dump(data, f, ensure_ascii=False, indent=2)

print("合并完成：共 %d 款游戏（i18n %d 条，tags %d 条）" % (len(result), len(i18n), len(tags)))
