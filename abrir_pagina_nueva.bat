@echo off
rem Abre la pagina nueva (React) en esta computadora. Solo para verla: no publica nada.
cd /d "%~dp0"
set "PATH=C:\Program Files\nodejs;%PATH%"
where npm >nul 2>nul
if errorlevel 1 (
  echo No se encontro Node.js. Hace falta instalarlo para ver la pagina nueva.
  pause
  exit /b 1
)
if not exist node_modules (
  echo Preparando por primera vez, puede tardar un minuto...
  call npm install
)
echo.
echo La pagina se abre en Chrome en http://localhost:5173
echo Para cerrarla, cerra esta ventana.
echo.
call npm run dev -- --open
pause
