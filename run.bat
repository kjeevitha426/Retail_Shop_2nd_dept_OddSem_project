@echo off
TITLE Retail Store Inventory and Sales Analysis System
COLOR 0B

echo ======================================================================
echo   Retail Store Inventory and Sales Analysis System
echo   Java HTTP Backend ^| Relational DBMS ^| Python Analytics Engine
echo ======================================================================
echo.

:: 1. Check Python
python --version >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Python is not found in PATH!
    echo Please install Python 3.8+ and ensure it is added to your system PATH.
    pause
    exit /b 1
)
echo [OK] Python detected.

:: 2. Check Java
java -version >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Java is not found in PATH!
    echo Please install Java JDK 8+ or JDK 17/21 and add it to your system PATH.
    pause
    exit /b 1
)
echo [OK] Java detected.

:: 3. Initialize SQLite Database if missing
if not exist "database\retail_store.db" (
    echo.
    echo [INFO] Initializing and seeding database with realistic products and sales...
    python database\init_db.py
    if %ERRORLEVEL% NEQ 0 (
        echo [ERROR] Failed to initialize database!
        pause
        exit /b 1
    )
) else (
    echo [OK] Database found: database\retail_store.db
)

:: 4. Compile Java Backend
echo.
echo [INFO] Compiling Java backend classes...
if not exist "bin" mkdir bin
javac -encoding UTF-8 -d bin src\retail\*.java
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Java compilation failed!
    pause
    exit /b 1
)
echo [OK] Java backend compiled successfully.

:: 5. Launch Java Server & Open Browser
echo.
echo ======================================================================
echo   Starting RetailFlow Server at http://localhost:8080/
echo   Press CTRL+C anytime to stop the server.
echo ======================================================================
echo.

:: Wait 1 second then open default web browser
start "" http://localhost:8080/

:: Start Java Server on port 8080
java -cp bin retail.RetailStoreServer 8080
pause
