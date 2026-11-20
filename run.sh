#!/usr/bin/env bash
# ======================================================================
# Retail Store Inventory and Sales Analysis System
# Linux & macOS One-Click Start Script
# ======================================================================

set -e

echo "======================================================================"
echo " Retail Store Inventory and Sales Analysis System"
echo " Java HTTP Backend | Relational DBMS | Python Analytics Engine"
echo "======================================================================"
echo ""

# 1. Check Python
if ! command -v python3 &> /dev/null; then
    if ! command -v python &> /dev/null; then
        echo "[ERROR] Python 3 is not installed or not in PATH!"
        exit 1
    fi
    PYTHON_CMD="python"
else
    PYTHON_CMD="python3"
fi
echo "[OK] Python detected: $($PYTHON_CMD --version)"

# 2. Check Java
if ! command -v java &> /dev/null; then
    echo "[ERROR] Java is not installed or not in PATH!"
    exit 1
fi
echo "[OK] Java detected: $(java -version 2>&1 | head -n 1)"

# 3. Initialize SQLite Database if missing
if [ ! -f "database/retail_store.db" ]; then
    echo ""
    echo "[INFO] Initializing and seeding database..."
    $PYTHON_CMD database/init_db.py
else
    echo "[OK] Database found: database/retail_store.db"
fi

# 4. Compile Java Backend
echo ""
echo "[INFO] Compiling Java backend classes..."
mkdir -p bin
javac -encoding UTF-8 -d bin src/retail/*.java
echo "[OK] Java classes compiled successfully."

# 5. Launch Java Server
echo ""
echo "======================================================================"
echo " Starting RetailFlow Server at http://localhost:8080/"
echo " Press CTRL+C to stop the server."
echo "======================================================================"
echo ""

# Try to open browser
if command -v xdg-open &> /dev/null; then
    xdg-open "http://localhost:8080/" &
elif command -v open &> /dev/null; then
    open "http://localhost:8080/" &
fi

java -cp bin retail.RetailStoreServer 8080
