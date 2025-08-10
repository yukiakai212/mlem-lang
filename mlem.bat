@echo off
setlocal enabledelayedexpansion

REM Check if argument is provided
if "%~1"=="" (
    echo Usage: %~nx0 ^<file.mlem^>
    exit /b 1
)

REM Get the directory of this script
set SCRIPT_DIR=%~dp0

REM Input file (relative or absolute)
set INPUT_FILE=%~1

REM Call cli.js with Node
node "%SCRIPT_DIR%cli.js" "%INPUT_FILE%"

endlocal
