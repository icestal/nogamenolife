@echo off
chcp 65001 >nul
title 只买不玩康复中心 - 一键更新
cd /d "d:\software\claude code\steamfamily"

echo [1/4] 合并游戏清单...
python "最新代码\merge.py"
if errorlevel 1 goto :err

echo [2/4] 提交变更...
git add -A
git commit -m "更新游戏库 %date%" >nul 2>&1

echo [3/4] 推送到 GitHub...
git push
if errorlevel 1 goto :err

echo.
echo ==============================
echo  ✅ 推送成功！家人刷新即可看到更新
echo ==============================
pause
exit /b 0

:err
echo.
echo ❌ 出错，请查看上方提示
pause
exit /b 1
