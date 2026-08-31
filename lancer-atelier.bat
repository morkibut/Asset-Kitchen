@echo off
rem ══ Asset Kitchen — lanceur double-clic ══════════════════════════════════
rem  Ce fichier est la cible du raccourci du bureau. Il fait trois choses :
rem  il refuse de lancer deux fois, il recompile l'interface si les sources
rem  ont bouge, puis il demarre le serveur. Fermer la fenetre arrete l'atelier.
chcp 65001 >nul
setlocal
cd /d "%~dp0"
title Asset Kitchen — atelier

rem  Les outils Windows sont appeles par leur chemin complet : un PATH exotique
rem  (Git Bash, MSYS) fournit un autre `timeout` et le lanceur derape.
set "SYS=%SystemRoot%\System32"

echo.
echo   Asset Kitchen — atelier de production d'assets 2D
echo.

rem ── Deja lance ? On ouvre l'onglet, on ne relance pas. ───────────────────
%SYS%\netstat.exe -an | %SYS%\findstr.exe /c:"127.0.0.1:8420" | %SYS%\findstr.exe /i "LISTENING" >nul
if not errorlevel 1 goto :deja_la

rem ── L'environnement Python ──────────────────────────────────────────────
if not exist ".venv\Scripts\python.exe" goto :sans_venv

rem ── L'interface : recompilee seulement si une source est plus recente ───
if not exist "interface\dist\index.html" goto :compiler
powershell -NoProfile -Command "$r=(Get-Item 'interface/dist/index.html').LastWriteTimeUtc; $n=Get-ChildItem 'interface/src','interface/index.html','interface/package.json','interface/vite.config.ts' -Recurse -File -ErrorAction SilentlyContinue | Where-Object { $_.LastWriteTimeUtc -gt $r -and $_.Name -notmatch '\.test\.' }; if ($n) { exit 1 }; exit 0"
if errorlevel 1 goto :compiler
goto :lancer

:compiler
%SYS%\where.exe npm >nul 2>&1
if errorlevel 1 goto :sans_npm
if exist "interface\node_modules" goto :build
echo   Interface — premiere compilation, installation des paquets...
pushd interface
call npm install
popd

:build
echo   Interface — les sources ont bouge, compilation...
pushd interface
call npm run build
set "SORTIE=%ERRORLEVEL%"
popd
if not "%SORTIE%"=="0" goto :echec_build
echo   Interface — a jour.
echo.
goto :lancer

rem ── Le serveur ──────────────────────────────────────────────────────────
:lancer
echo   Le navigateur s'ouvre tout seul dans une seconde.
echo   Pour arreter l'atelier : fermez cette fenetre.
echo.
".venv\Scripts\python.exe" -m atelier
set "SORTIE=%ERRORLEVEL%"
if not "%SORTIE%"=="0" goto :echec_serveur
exit /b 0

rem ── Ce qui peut manquer, dit en clair ───────────────────────────────────
rem ── Un atelier repond deja : deux cas, et ils ne se disent pas pareil ────
rem
rem  Corrige le 31 aout 2026, sur un signalement. Cette branche imprimait une
rem  ligne et se refermait en deux secondes : l'auteur voyait sa fenetre
rem  disparaitre sans avoir le temps de lire, et concluait que l'atelier avait
rem  plante. Il n'avait pas plante — il tournait depuis trois heures. Le vrai
rem  probleme etait ailleurs et personne ne le disait : ce vieil atelier fait
rem  tourner du code perime pendant que l'interface, elle, vient d'etre
rem  recompilee. On compare donc l'heure de demarrage du serveur a la date des
rem  sources, et on le dit.
:deja_la
powershell -NoProfile -Command "try { $c = Get-NetTCPConnection -LocalPort 8420 -State Listen -ErrorAction Stop | Select-Object -First 1; $d = (Get-Process -Id $c.OwningProcess -ErrorAction Stop).StartTime; $n = Get-ChildItem 'atelier' -Recurse -File -Filter *.py -ErrorAction SilentlyContinue | Where-Object { $_.LastWriteTime -gt $d }; if ($n) { exit 1 } } catch { }; exit 0"
if errorlevel 1 goto :deja_la_perime

echo   L'atelier tourne deja sur le port 8420 — j'ouvre l'onglet.
start "" "http://127.0.0.1:8420"
rem  ping et non timeout : timeout exige une vraie console et refuse de
rem  tourner des que l'entree est redirigee. Trois pings font deux secondes,
rem  le temps de lire la ligne avant que la fenetre se referme.
%SYS%\ping.exe -n 3 127.0.0.1 >nul
exit /b 0

:deja_la_perime
echo   [!] Un atelier tourne deja sur le port 8420, mais il a demarre AVANT
echo       tes dernieres modifications du serveur. Il fait donc tourner du
echo       code perime, pendant que l'interface, elle, vient d'etre recompilee.
echo.
echo   Rien n'a plante. Ce qu'il faut faire, dans cet ordre :
echo.
echo       1. Fermer la fenetre noire de CET atelier-la (pas celle-ci).
echo       2. Relancer ce fichier.
echo       3. Recharger l'onglet du navigateur.
echo.
echo   J'ouvre quand meme l'onglet, mais il parle encore au vieil atelier.
start "" "http://127.0.0.1:8420"
echo.
pause
exit /b 0

:sans_venv
echo   [x] L'environnement Python est absent : le dossier .venv n'existe pas.
echo.
echo   A faire une fois, dans ce dossier :
echo.
echo       uv venv --python 3.11
echo       uv pip install -e ".[dev]"
echo.
pause
exit /b 1

:sans_npm
if exist "interface\dist\index.html" goto :npm_absent_dist_la
echo   [x] npm est introuvable et l'interface n'a jamais ete compilee.
echo       Installez Node.js (nodejs.org), puis relancez ce fichier.
echo.
pause
exit /b 1

:npm_absent_dist_la
echo   [!] npm est introuvable : je sers l'interface deja compilee,
echo       qui peut etre en retard sur le code.
echo.
goto :lancer

:echec_build
echo.
echo   [x] La compilation de l'interface a echoue (code %SORTIE%).
echo       Les messages de npm sont juste au-dessus.
echo.
pause
exit /b %SORTIE%

:echec_serveur
echo.
echo   [x] L'atelier s'est arrete sur une erreur (code %SORTIE%).
echo.
pause
exit /b %SORTIE%
