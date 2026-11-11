@echo off
rem Abre el PANEL DE ADMINISTRACION en esta computadora (entorno de prueba de Supabase).
cd /d "%~dp0"
set "PATH=C:\Program Files\nodejs;%PATH%"
where npm >nul 2>nul
if errorlevel 1 (
  echo No se encontro Node.js. Hace falta instalarlo para abrir el panel.
  pause
  exit /b 1
)
if not exist node_modules (
  echo Preparando por primera vez, puede tardar un minuto...
  call npm install
)
if not exist .env.local (
  echo Falta el archivo .env.local con los datos de Supabase.
  pause
  exit /b 1
)
echo.
echo El panel se abre en Chrome en http://localhost:5173/admin
echo Para cerrarlo, cerra esta ventana.
echo.
call npm run dev -- --open /admin
pause
