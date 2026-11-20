#!/usr/bin/env python3
"""
Retail Store Inventory and Sales Analysis System
Database Interop Bridge for Java Backend & SQLite
Provides high-performance, transactional JSON-based SQL execution.
"""

import sys
import os
import json
import sqlite3
import argparse

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)
DB_PATH = os.path.join(PROJECT_ROOT, "database", "retail_store.db")

def get_connection():
    if not os.path.exists(DB_PATH):
        # Auto initialize DB if missing
        init_script = os.path.join(PROJECT_ROOT, "database", "init_db.py")
        if os.path.exists(init_script):
            import subprocess
            subprocess.run([sys.executable, init_script], check=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    # Enable foreign keys
    conn.execute("PRAGMA foreign_keys = ON")
    return conn

def execute_query(sql, params):
    conn = get_connection()
    try:
        cursor = conn.cursor()
        cursor.execute(sql, params)
        rows = cursor.fetchall()
        result = [dict(row) for row in rows]
        conn.close()
        return {"status": "success", "data": result, "count": len(result)}
    except Exception as e:
        conn.close()
        return {"status": "error", "message": str(e)}

def execute_update(sql, params):
    conn = get_connection()
    try:
        cursor = conn.cursor()
        cursor.execute(sql, params)
        conn.commit()
        affected = cursor.rowcount
        last_id = cursor.lastrowid
        conn.close()
        return {"status": "success", "affected": affected, "last_id": last_id}
    except Exception as e:
        conn.close()
        return {"status": "error", "message": str(e)}

def execute_sale_transaction(payload):
    """
    Atomic Transaction for Sales Billing:
    1. Check stock availability for all items
    2. Prevent sales exceeding available stock
    3. Decrement stock for all items
    4. Insert sales header record
    5. Insert sale_items records
    6. Insert stock_logs records
    7. Commit transaction
    """
    conn = get_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("BEGIN TRANSACTION")

        items = payload.get("items", [])
        if not items:
            conn.rollback()
            return {"status": "error", "message": "Sale cart is empty."}

        # Step 1 & 2: Check stock availability
        for item in items:
            p_id = item["product_id"]
            qty = int(item["quantity"])
            if qty <= 0:
                conn.rollback()
                return {"status": "error", "message": f"Invalid quantity {qty} for product ID {p_id}."}

            cursor.execute("SELECT id, name, price, stock_quantity FROM products WHERE id = ?", (p_id,))
            prod = cursor.fetchone()
            if not prod:
                conn.rollback()
                return {"status": "error", "message": f"Product ID {p_id} not found."}

            avail = prod["stock_quantity"]
            if qty > avail:
                conn.rollback()
                return {
                    "status": "error",
                    "code": "INSUFFICIENT_STOCK",
                    "product_id": p_id,
                    "product_name": prod["name"],
                    "available_stock": avail,
                    "requested_quantity": qty,
                    "message": f"Insufficient stock for '{prod['name']}'. Available: {avail}, Requested: {qty}."
                }

        # Step 3: Insert Sales Header
        inv_no = payload.get("invoice_number")
        worker_id = payload.get("worker_id")
        worker_name = payload.get("worker_name", "Staff")
        customer_name = payload.get("customer_name", "Walk-in Customer")
        customer_phone = payload.get("customer_phone", "")
        total_amount = float(payload.get("total_amount", 0.0))
        discount_amount = float(payload.get("discount_amount", 0.0))
        tax_amount = float(payload.get("tax_amount", 0.0))
        final_amount = float(payload.get("final_amount", 0.0))
        payment_method = payload.get("payment_method", "CASH")

        cursor.execute(
            """INSERT INTO sales (invoice_number, worker_id, worker_name, customer_name, customer_phone,
                                  total_amount, discount_amount, tax_amount, final_amount, payment_method)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (inv_no, worker_id, worker_name, customer_name, customer_phone,
             total_amount, discount_amount, tax_amount, final_amount, payment_method)
        )
        sale_id = cursor.lastrowid

        # Step 4, 5 & 6: Deduct stock, insert sale_items and stock_logs
        inserted_items = []
        for item in items:
            p_id = item["product_id"]
            qty = int(item["quantity"])

            cursor.execute("SELECT name, category, price, stock_quantity FROM products WHERE id = ?", (p_id,))
            prod = cursor.fetchone()
            p_name = prod["name"]
            p_cat = prod["category"]
            p_price = float(prod["price"])
            prev_stock = prod["stock_quantity"]
            new_stock = prev_stock - qty
            subtotal = round(p_price * qty, 2)

            # Insert line item
            cursor.execute(
                """INSERT INTO sale_items (sale_id, product_id, product_name, category, unit_price, quantity, subtotal)
                   VALUES (?, ?, ?, ?, ?, ?, ?)""",
                (sale_id, p_id, p_name, p_cat, p_price, qty, subtotal)
            )

            # Update product stock
            cursor.execute(
                """UPDATE products SET stock_quantity = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?""",
                (new_stock, p_id)
            )

            # Insert stock audit log
            cursor.execute(
                """INSERT INTO stock_logs (product_id, change_type, quantity_changed, previous_stock, new_stock, changed_by, notes)
                   VALUES (?, 'SALE', ?, ?, ?, ?, ?)""",
                (p_id, -qty, prev_stock, new_stock, worker_name, f"Billed in Sale #{inv_no}")
            )

            inserted_items.append({
                "product_id": p_id,
                "product_name": p_name,
                "unit_price": p_price,
                "quantity": qty,
                "subtotal": subtotal,
                "remaining_stock": new_stock
            })

        conn.commit()
        conn.close()

        return {
            "status": "success",
            "sale_id": sale_id,
            "invoice_number": inv_no,
            "final_amount": final_amount,
            "items": inserted_items,
            "message": "Sale transaction completed and stock updated successfully."
        }

    except Exception as e:
        conn.rollback()
        conn.close()
        return {"status": "error", "message": f"Transaction failed: {str(e)}"}

def main():
    raw_input = ""
    if len(sys.argv) >= 2:
        raw_input = sys.argv[1]
    else:
        # Read from stdin
        raw_input = sys.stdin.read().strip()

    if not raw_input:
        print(json.dumps({"status": "error", "message": "No input payload provided via argv or stdin"}))
        return

    try:
        req = json.loads(raw_input)
    except Exception as e:
        print(json.dumps({"status": "error", "message": f"Invalid JSON payload: {e}"}))
        return

    action = req.get("action")
    params = req.get("params", [])

    if action == "query":
        res = execute_query(req.get("sql", ""), params)
    elif action == "execute":
        res = execute_update(req.get("sql", ""), params)
    elif action == "sale_transaction":
        res = execute_sale_transaction(req.get("payload", {}))
    else:
        res = {"status": "error", "message": f"Unknown action: {action}"}

    print(json.dumps(res))

if __name__ == "__main__":
    main()
