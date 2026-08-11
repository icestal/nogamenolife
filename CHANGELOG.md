# 更新日志 · 只买不玩康复中心

> 每次推送前在此追加一条(最新在上)。数据类更新顺手记游戏数量变化。

## 2026-08-11 · 新增成员木贰/老梁 + 1554 款全量 + 标签系统上线
- **家庭组扩到 5 人**:新成员木贰/老梁加入,家庭共享库 1240 款(含 owner 分布)。merge.py 成员表 + OWNER_MAP 同步更新(临时成员 76561199841374927 不入库)。
- **总量 815→1554**:5 人个人库合并重建 `appids_all.txt`,新增 751 款;剔除 12 款工具(RPG Maker/Aimlabs/SAO Utils/无损缩放/RetroArch/Bongo Cat 等,累计 18 款),`games_tools.tsv` 备查。
- **小黑盒补中文 378 款**:`fetch_xiaoheihe_missing.py` 新增——遍历缺中文的新游戏,查 302-title 补入 `games_i18n.tsv`(0.25s/款限速),全库缺中文剩 161 款(工具/DLC/免费/测试服)。
- **标签系统上线**:`tags_rules.tsv` 规则库(现 31 个标签)→ merge.py 遍历全量打标,输出 `tags` 数组(支持一游多标签)。全库 **219 款命中**,新增系列(全面战争/三国/拳皇/死亡空间/死亡搁浅/战锤)自动进标签。`DRY_RUN=1` 模式输出 `games_dry.json` 不碰正式数据。
- **index.html**:卡片名下方显示标签小章,搜索支持 tags 匹配;`sw.js` v4→v5。
- 全库 **1554 款,可共享 1387**;新增 751 款封面 722 款有 header(缺的走 hero 回退)。

## 2026-08-10 · 小黑盒补中文 + 剔除6款工具 + 封面回退 + 共享误标修复
- **中文名补全 388 款**:发现小黑盒 `share_game_detail` 的 302 跳转 `title` 参数可当查询通道(无登录/无token/无批量接口),821 款全量实测零失败。Steam 官方未本地化的游戏(空洞骑士/半条命2等)靠它补上中文,cn 含中文 345→731。
- **剔除 6 款非游戏**:tModLoader / 3DMark / Blender / Wallpaper Engine / Jackbox Megapicker / 虚拟桌宠模拟器(工具·软件),总量 **821→815**。被剔除清单存 `games_tools.tsv` 备查,恢复可查回。
- **修复可共享误标**:`exclude_reason=3`(Steam 家庭共享排除的免费游戏)不再亮"可共享"角标,5 款免费游戏(未转变者/奇异人生等)修正。
- **封面回退**:部分新上架 app 无 `header.jpg`,加载失败自动回退 `library_hero.jpg`(实测 29 款缺 header、24 款可救,5 款双缺仍占位),`sw.js` v3→v4。
- `merge.py`:cn 改"第一个含中文候选"(family 官方中文→i18n 小黑盒→name);`share` 需排除 exclude=3。

## 2026-08-10 · 821 款中英文名全量 + 家庭组可共享标记
- **中英文名全量抓齐**:F12 版 `userscript_i18n_f12.js`(单请求+断点续传+限流自适应),821 款中英文一步到位,`games_i18n.tsv` 全覆盖(缺 13 款下架/临时)。
  - 注:批量 `appids=440,570` 已被 Steam 拒绝(400),只能逐个请求;间隔 1800ms 保安全,429 自动冷却 5 分钟+永久放慢。
- **家庭组 API 全字段版** `userscript_family_f12.js`:`family_library_full.tsv` = appid/中文名/英文名/owners(steamid 区分成员)/exclude_reason。一次拉全组可共享库,秒级。
- **merge.py 重构**:以 `appids_all.txt`(821 款)为总量基准 → family_library 优先给"可共享"+owners → games_i18n 补缺 → games_raw 兜底 name。
- **index.html**:卡片加绿色「可共享」角标(在家庭组共享内的显示);不可共享不标注,避免误导(小寒未入组的游戏等她入组后自动变可共享)。
- 全库 **821 款,531 款可共享**;不可共享 290 款 = 小寒未入组部分 + 第三方账户(育碧/EA/R星/动视) + 免费在线游戏。

## 2026-08-10 · 家庭组 API 拉取链路验证(备用)
- 验证了创意方法:登录态自动拿 webapi_token + IFamilyGroupsService 两个接口,一次拉全共享库、`language=schinese` 直接给中文名,替代"各成员拉库 + 抓 i18n"两步。
- 实测(老胡+ZZZ 两人组):539 款共享库,中文名一步到位。
- **注意:小寒未加入家庭组,当前非全量**;小寒入组后一个成员跑一次即得完整库。
- 文件:`fetch_family.py`(本机)、`userscript_family_f12.js`(F12 版,已验证可跑)、`userscript_family.js`(油猴版,备用)。
- 本次数据更新仍走暴力猴 i18n 流程(`appids_all.txt` 821 款)。

## 2026-08-10 · 油猴脚本 v2.0 重写:通用版(不写死 AppID)
- 废弃 v1.x 内嵌 821 款 id+name 数组的做法。改为:**运行时弹窗输入 AppID**,`GM_setValue` 持久化,二次使用回车沿用,不用改代码。
- 入口 `@match` 含 store.steampowered.com / steamcommunity.com / steamdb.info 三域,默认在 **store.steampowered.com** 运行(数据同源、无跨域最顺)。
- 改用 `GM_xmlhttpRequest` 跨域请求 Steam 官方 API(appdetails,`filters=basic`),不受 CORS 限制,任意页面通用。
- 批量请求加速:每批 20 个 AppID,821 款双语言约 5 分钟内完成。
- 配套新增 `appids_all.txt`(821 个 AppID,首次全量粘入用);`油猴执行说明.md` 同步更新。

## 2026-08-10 · 卡片名显示优化:中文为主+英文小字
- `index.html` 卡片名逻辑重写:有中文显示中文,同时有真实英文名时在下方附一行英文小字(dim 色);只有英文则显示英文。
- 解决原先 `cn / name` 形式在 cn 与 name 相同时可能重复、双语都要时信息拥挤的问题。
- 逻辑验证:半条命2+Half-Life 2 ✓ / 吸血鬼猎人(仅中文) ✓ / DOOM(仅英文) ✓ / 空洞骑士+Hollow Knight ✓。
- 注:英文小字依赖 `games_i18n.tsv` 抓到真实英文名,当前 en 多回退 name,i18n 全量抓取后效果最佳。

## 2026-08-10 · 油猴脚本支持增量模式
- `userscript_i18n.js` v1.1:新增 `ONLY_APPIDS` 变量,留空=全量抓 821 款;填 appid 数组=只抓这几款(增量,几分钟)。
- 用途:中英文名数据后续按增量补抓,不必每次全量重跑 20 分钟。

## 2026-08-10 · 搜索升级:中英文 + 系列/别名 + 同系列排序
- `games.json` 新增字段 `cn`/`en`/`aliases`/`series`(821 款)。
- `games_tags.tsv` 新增:轨迹/伊苏/柚子社/KEY社/空洞骑士/刺客信条/无主之地/地铁/DOOM 等数十个系列与别名,共 377 款。
- `index.html` 搜索支持中英文名、别名、系列,同系列结果聚类排序。
- `sw.js` 缓存版本 v2→v3。
- ZZZ 新增 2 款:吸血鬼猎人(2206270)、God Of Weapons(2342950),全库 819→821 款。
- 注:中英文名数据需成员浏览器跑油猴脚本抓取(`games_i18n.tsv` 待生成)。

## 2026-08-09 · 初始版本:家庭库 819 款上线
- 三位成员(老胡/小寒/ZZZ)清单合并为查询站,`games.json` 819 款。
- PWA 支持:可安装、离线缓存、games.json 网络优先(刷新即更新)。
- 上线地址:https://icestal.github.io/nogamenolife/
