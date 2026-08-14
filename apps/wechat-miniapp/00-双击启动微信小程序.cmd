@echo off
chcp 65001 >nul
set "PROJECT_DIR=%~dp0"
set "WECHAT_CLI=C:\Program Files (x86)\Tencent\微信web开发者工具\cli.bat"

if not exist "%WECHAT_CLI%" (
  echo 未找到微信开发者工具：%WECHAT_CLI%
  echo 请先安装微信开发者工具，或修正本文件中的 WECHAT_CLI 路径。
  pause
  exit /b 1
)

echo 正在打开智慧翼微信小程序：
echo %PROJECT_DIR%
call "%WECHAT_CLI%" open --project "%PROJECT_DIR%" --lang zh

if errorlevel 1 (
  echo.
  echo 启动命令没有被开发者工具接受。
  echo 请在微信开发者工具中打开：设置 ^> 安全设置 ^> 服务端口。
  echo 开启后关闭多余的开发者工具窗口，再双击本文件一次。
  pause
  exit /b 1
)

echo 已发送打开命令。请在开发者工具中点击“编译”。
timeout /t 3 >nul
