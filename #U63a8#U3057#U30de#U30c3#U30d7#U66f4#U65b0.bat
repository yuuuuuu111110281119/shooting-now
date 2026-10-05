@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"

echo ==========================================
echo   推しマップ 更新開始
echo ==========================================
echo.

echo [1/4] 撮影履歴・代表写真を更新しています...
python update_models.py
if errorlevel 1 goto :error

echo.
echo [2/4] Gitに変更を登録しています...
git add shooting_history.json shooting_images
if errorlevel 1 goto :error

echo.
echo [3/4] 変更を確認しています...
git diff --cached --quiet
if not errorlevel 1 goto :nochanges

git commit -m "Update shooting history and photos"
if errorlevel 1 goto :error

echo.
echo [4/4] GitHubへ送信しています...
git push origin main
if errorlevel 1 goto :error

echo.
echo ==========================================
echo   推しマップの更新が完了しました
echo   GitHubへの送信：成功
echo ==========================================
echo.
echo iPhoneで反映されない場合は、URLの末尾に
echo ?v=日付時刻 を付けて開いてください。
echo 例: ?v=20261003-1700
echo.
pause
exit /b 0

:nochanges
echo.
echo ==========================================
echo   更新対象の変更はありませんでした
echo ==========================================
echo.
pause
exit /b 0

:error
echo.
echo ==========================================
echo   更新に失敗しました
echo   上に表示されたエラーを確認してください
echo ==========================================
echo.
pause
exit /b 1
