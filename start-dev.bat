@echo off
setlocal enabledelayedexpansion

REM ============================================================================
REM MYSTIC TATTOO - Lancement des serveurs de développement (Windows)
REM ============================================================================

set BACKEND_DIR=%~dp0
set FRONTEND_DIR=%BACKEND_DIR%..\mystictattoo
set BACKEND_PORT=4000
set FRONTEND_PORT=3000

if "%1"=="" goto start_all
if "%1"=="stop" goto stop_all
if "%1"=="backend" goto start_backend
if "%1"=="frontend" goto start_frontend
if "%1"=="status" goto show_status
goto help

:start_all
echo.
echo ========================================
echo    MYSTIC TATTOO - Serveurs de Dev
echo ========================================
echo.
call :start_backend
call :start_frontend
call :show_status
goto end

:start_backend
echo [*] Demarrage du Backend sur le port %BACKEND_PORT%...
cd /d "%BACKEND_DIR%"

REM Tuer le processus existant sur le port
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :%BACKEND_PORT% ^| findstr LISTENING') do (
    taskkill /PID %%a /F >nul 2>&1
)

REM Installer les dependances si necessaire
if not exist "node_modules" (
    echo [*] Installation des dependances...
    call npm install --silent
)

REM Lancer le serveur
start /B node index.js > nul 2>&1
timeout /t 3 /nobreak > nul
echo [OK] Backend demarre sur http://localhost:%BACKEND_PORT%
goto :eof

:start_frontend
if not exist "%FRONTEND_DIR%" (
    echo [!] Dossier frontend non trouve
    goto :eof
)

echo [*] Demarrage du Frontend sur le port %FRONTEND_PORT%...
cd /d "%FRONTEND_DIR%"

REM Tuer le processus existant sur le port
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :%FRONTEND_PORT% ^| findstr LISTENING') do (
    taskkill /PID %%a /F >nul 2>&1
)

REM Installer les dependances si necessaire
if not exist "node_modules" (
    echo [*] Installation des dependances...
    call npm install --silent
)

REM Lancer le serveur
start /B npm start > nul 2>&1
echo [OK] Frontend demarre sur http://localhost:%FRONTEND_PORT%
cd /d "%BACKEND_DIR%"
goto :eof

:stop_all
echo [*] Arret des serveurs...

REM Backend
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :%BACKEND_PORT% ^| findstr LISTENING') do (
    taskkill /PID %%a /F >nul 2>&1
)

REM Frontend
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :%FRONTEND_PORT% ^| findstr LISTENING') do (
    taskkill /PID %%a /F >nul 2>&1
)

echo [OK] Serveurs arretes
goto end

:show_status
echo.
echo ========================================
echo              STATUS
echo ========================================
netstat -ano | findstr :%BACKEND_PORT% | findstr LISTENING >nul 2>&1
if %errorlevel%==0 (
    echo Backend:  [RUNNING] http://localhost:%BACKEND_PORT%
) else (
    echo Backend:  [STOPPED]
)

netstat -ano | findstr :%FRONTEND_PORT% | findstr LISTENING >nul 2>&1
if %errorlevel%==0 (
    echo Frontend: [RUNNING] http://localhost:%FRONTEND_PORT%
) else (
    echo Frontend: [STOPPED]
)
echo API Docs: http://localhost:%BACKEND_PORT%/api-docs
echo ========================================
echo.
goto end

:help
echo Usage: start-dev.bat [command]
echo.
echo Commands:
echo   (none)     Lancer backend + frontend
echo   backend    Lancer uniquement le backend
echo   frontend   Lancer uniquement le frontend
echo   stop       Arreter tous les serveurs
echo   status     Afficher le statut
goto end

:end
endlocal
