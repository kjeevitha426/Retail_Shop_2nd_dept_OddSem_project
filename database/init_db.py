#!/usr/bin/env python3
"""
Retail Store Inventory and Sales Analysis System
Database Initializer and Realistic Seed Data Generator
Compatible with SQLite 3
"""

import sqlite3
import os
import random
from datetime import datetime, timedelta

DB_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(DB_DIR, "retail_store.db")
SCHEMA_PATH = os.path.join(DB_DIR, "schema.sql")

def hash_password(password: str) -> str:
    """Simple SHA-256 hash for secure credential storage."""
    import hashlib
    return hashlib.sha256(password.encode('utf-8')).hexdigest()

def init_database(force_recreate: bool = False):
    if force_recreate and os.path.exists(DB_PATH):
        try:
            os.remove(DB_PATH)
            print(f"[INFO] Removed existing database: {DB_PATH}")
        except Exception as e:
            print(f"[WARN] Could not remove existing DB: {e}")

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    # Read and apply schema
    with open(SCHEMA_PATH, "r", encoding="utf-8") as f:
        schema_sql = f.read()
    cursor.executescript(schema_sql)

    # Check if data already exists
    cursor.execute("SELECT COUNT(*) FROM users")
    if cursor.fetchone()[0] > 0 and not force_recreate:
        print("[INFO] Database already initialized with data.")
        conn.close()
        return

    print("[INFO] Seeding initial users...")
    users = [
        ("admin", hash_password("admin123"), "Store Administrator", "ADMIN"),
        ("worker", hash_password("worker123"), "Cashier Worker Alex", "WORKER"),
        ("john_pos", hash_password("worker123"), "John Inventory Associate", "WORKER"),
    ]
    cursor.executemany(
        "INSERT INTO users (username, password_hash, full_name, role) VALUES (?, ?, ?, ?)",
        users
    )

    print("[INFO] Seeding initial products across diverse categories...")
    products = [
        # Electronics
        ("PRD-101", "Wireless Noise-Canceling Headphones", "Electronics", 129.99, 45, 10, "Over-ear bluetooth 5.3 headphones with ANC"),
        ("PRD-102", "USB-C Fast Charging Hub 65W", "Electronics", 34.50, 80, 15, "Multi-port GaN fast charger with 3 ports"),
        ("PRD-103", "Mechanical Gaming Keyboard RGB", "Electronics", 79.99, 22, 8, "Tactile blue switch RGB backlit mechanical keyboard"),
        ("PRD-104", "Smart Fitness Tracker Band", "Electronics", 49.99, 6, 12, "Waterproof health tracker with heart rate monitor (LOW STOCK)"),
        ("PRD-105", "4K Ultra HD Action Camera", "Electronics", 159.00, 3, 5, "Waterproof 4K 60fps action cam with dual screen (CRITICAL STOCK)"),

        # Groceries
        ("PRD-201", "Organic Cold Pressed Olive Oil 1L", "Groceries", 18.50, 110, 20, "Extra virgin pure Mediterranean cold-pressed olive oil"),
        ("PRD-202", "Artisan Roasted Coffee Beans 500g", "Groceries", 14.99, 65, 15, "100% Arabica dark roast whole coffee beans"),
        ("PRD-203", "Almond Butter Creamy 350g", "Groceries", 9.25, 50, 10, "Non-GMO all natural roasted almond butter"),
        ("PRD-204", "Gluten-Free Rolled Oats 1kg", "Groceries", 6.50, 8, 15, "Organic gluten-free certified rolled porridge oats (LOW STOCK)"),
        ("PRD-205", "Pure Himalayan Rock Salt 1kg", "Groceries", 4.20, 150, 25, "Coarse pink mineral crystals for gourmet cooking"),

        # Apparel
        ("PRD-301", "Premium Supima Cotton T-Shirt", "Apparel", 24.99, 90, 20, "Breathable 100% long-staple organic cotton tee"),
        ("PRD-302", "Slim Fit Denim Jeans Classic", "Apparel", 54.00, 38, 10, "Stretchable durable indigo blue denim jeans"),
        ("PRD-303", "Thermal Fleece Winter Jacket", "Apparel", 89.90, 4, 10, "Windproof water-resistant lightweight thermal coat (CRITICAL STOCK)"),
        ("PRD-304", "Athletic Running Crew Socks (3-Pack)", "Apparel", 12.50, 75, 15, "Moisture wicking cushioned athletic socks"),
        ("PRD-305", "Canvas Everyday Casual Backpack", "Apparel", 39.99, 18, 5, "Vintage water-repellent canvas laptop daypack"),

        # Home & Kitchen
        ("PRD-401", "Stainless Steel French Press 1L", "Home & Kitchen", 28.00, 32, 8, "Double-wall insulated coffee & tea maker"),
        ("PRD-402", "Non-Stick Ceramic Frying Pan 28cm", "Home & Kitchen", 42.50, 15, 6, "Eco-friendly toxin-free scratch resistant skillet"),
        ("PRD-403", "Bamboo Cutting Board Set of 3", "Home & Kitchen", 26.90, 40, 10, "Natural antimicrobial organic cutting boards"),
        ("PRD-404", "Vacuum Insulated Steel Tumbler 750ml", "Home & Kitchen", 19.99, 7, 12, "24-hour cold / 12-hour hot beverage tumbler (LOW STOCK)"),
        ("PRD-405", "Electric Gooseneck Pour-Over Kettle", "Home & Kitchen", 59.95, 2, 5, "Precise variable temperature control kettle (CRITICAL STOCK)"),

        # Personal Care
        ("PRD-501", "Hydrating Facial Moisturizer 100ml", "Personal Care", 16.50, 60, 15, "Hyaluronic acid and ceramides soothing lotion"),
        ("PRD-502", "Botanical Tea Tree Shampoo 400ml", "Personal Care", 11.80, 85, 20, "Purifying scalp relief sulfate-free shampoo"),
        ("PRD-503", "Natural Mineral Sunscreen SPF 50", "Personal Care", 21.00, 5, 10, "Reef-safe broad spectrum water resistant sunblock (LOW STOCK)"),
        ("PRD-504", "Sonic Electric Toothbrush USB", "Personal Care", 36.00, 25, 8, "40,000 VPM vibration 5 brushing modes"),
        ("PRD-505", "Lavender Essential Aromatherapy Oil", "Personal Care", 13.50, 45, 10, "Pure therapeutic grade steam-distilled lavender oil"),
    ]

    cursor.executemany(
        """INSERT INTO products (product_code, name, category, price, stock_quantity, low_stock_threshold, description)
           VALUES (?, ?, ?, ?, ?, ?, ?)""",
        products
    )

    # Initial stock logs
    cursor.execute("SELECT id, stock_quantity FROM products")
    seeded_products = cursor.fetchall()
    stock_logs = [
        (p_id, 'RESTOCK', qty, 0, qty, 'Initial System Setup', 'Initial inventory load')
        for p_id, qty in seeded_products
    ]
    cursor.executemany(
        """INSERT INTO stock_logs (product_id, change_type, quantity_changed, previous_stock, new_stock, changed_by, notes)
           VALUES (?, ?, ?, ?, ?, ?, ?)""",
        stock_logs
    )

    print("[INFO] Seeding realistic historical sales transactions (last 30 days)...")
    customer_names = [
        "Emily Watson", "Michael Chang", "Sarah Jenkins", "David Miller",
        "Aarav Patel", "Jessica Taylor", "Robert Garcia", "Olivia Brown",
        "Daniel Wilson", "Sophia Martinez", "Liam Anderson", "Chloe Thomas"
    ]
    payment_methods = ["CASH", "CREDIT_CARD", "DEBIT_CARD", "UPI_MOBILE"]
    
    # Fetch inserted products
    cursor.execute("SELECT id, product_code, name, category, price FROM products")
    prod_lookup = cursor.fetchall()

    random.seed(42)  # Deterministic seed for reproducible testing
    now = datetime.now()
    invoice_seq = 1001

    # Generate 45 realistic historical sales spread over the past 30 days
    for day_offset in range(30, -1, -1):
        # 1 to 3 sales per day
        num_sales_today = random.randint(1, 3)
        day_date = now - timedelta(days=day_offset, hours=random.randint(1, 8), minutes=random.randint(1, 55))

        for _ in range(num_sales_today):
            inv_no = f"INV-{day_date.strftime('%Y%m%d')}-{invoice_seq}"
            invoice_seq += 1
            cust_name = random.choice(customer_names)
            cust_phone = f"+1-555-{random.randint(100, 999)}-{random.randint(1000, 9999)}"
            pay_method = random.choice(payment_methods)
            worker_id = random.choice([2, 3])  # worker Alex or John
            worker_name = "Cashier Worker Alex" if worker_id == 2 else "John Inventory Associate"

            # Select 1 to 4 distinct items
            num_items = random.randint(1, 4)
            chosen_items = random.sample(prod_lookup, num_items)

            total_amount = 0.0
            line_items = []

            for item in chosen_items:
                p_id, p_code, p_name, p_cat, p_price = item
                qty = random.randint(1, 3)
                subtotal = round(p_price * qty, 2)
                total_amount += subtotal
                line_items.append((p_id, p_name, p_cat, p_price, qty, subtotal))

            discount = round(total_amount * 0.05, 2) if total_amount > 100 else 0.0
            tax = round((total_amount - discount) * 0.08, 2)  # 8% sales tax
            final_amount = round(total_amount - discount + tax, 2)

            date_str = day_date.strftime("%Y-%m-%d %H:%M:%S")

            cursor.execute(
                """INSERT INTO sales (invoice_number, worker_id, worker_name, customer_name, customer_phone,
                                      total_amount, discount_amount, tax_amount, final_amount, payment_method, sale_date)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (inv_no, worker_id, worker_name, cust_name, cust_phone,
                 total_amount, discount, tax, final_amount, pay_method, date_str)
            )
            sale_id = cursor.lastrowid

            for li in line_items:
                cursor.execute(
                    """INSERT INTO sale_items (sale_id, product_id, product_name, category, unit_price, quantity, subtotal)
                       VALUES (?, ?, ?, ?, ?, ?, ?)""",
                    (sale_id, li[0], li[1], li[2], li[3], li[4], li[5])
                )

    conn.commit()
    conn.close()
    print(f"[SUCCESS] Database successfully initialized and seeded at: {DB_PATH}")

if __name__ == "__main__":
    init_database(force_recreate=True)
