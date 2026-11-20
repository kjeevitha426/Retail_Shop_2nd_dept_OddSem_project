# Retail Store Inventory and Sales Analysis System

A comprehensive, full-stack retail management and intelligence platform developed using **Java**, **Relational DBMS (SQLite & MySQL compatible)**, and **Python (Pandas & Matplotlib)** with a responsive **HTML5/CSS3/JavaScript** frontend.

---

## 🌟 Key Features & Functional Requirements

| # | Requirement | Implementation Details |
|---|---|---|
| **1** | **Maintain Product Details** | Complete SKU catalog tracking Product ID, SKU Code, Name, Category, Price, Stock Quantity, Low-Stock Safety Threshold, Description, and Timestamps. |
| **2** | **Record Sales Transactions** | POS checkout terminal recording invoice number, line items, quantities sold, cashier name, customer details, tax (8%), discounts, payment method, and exact timestamps. |
| **3** | **Automatic Stock Updates** | Atomic database transaction automatically decrements available stock quantities in real-time when sales are processed. Stock audit logs (`stock_logs`) track every modification. |
| **4** | **Stock Availability Validation** | Real-time frontend and backend stock validation prevents adding items or processing transactions that exceed available physical stock. Returns immediate warnings and aborts with `INSUFFICIENT_STOCK`. |
| **5** | **Comprehensive Reports** | **Daily Sales Report** (gross, discounts, tax, net, transaction log, top items), **Product Availability Report** (total SKUs, units on hand, inventory valuation, category breakdown), and **Low-Stock Alerts** (critical items, safety deficits, 1-click restock). |
| **6** | **Python Dynamic Analytics** | Python analytics engine powered by **Pandas** and **Matplotlib**. Features interactive inputs (Analysis Model, Product Selector, Category Filter, Date Range) generating publication-ready charts (Base64 PNG) and preprocessed statistical tables. |
| **7** | **Role-Based Access Control** | Dedicated dashboards and navigation menus: **Store Worker** (POS Billing, Stock Lookups, Restock Updates) and **Store Admin** (All Worker capabilities + Dynamic Python Analytics, Product CRUD, System Reports, Inventory Auditing). |
| **8** | **Demo Logins & Registration** | 1-Click Demo Login buttons for fast evaluation (`Admin` and `Worker`), plus a full user registration form with role selection. |

---

## 🔐 Demo Credentials

Quick 1-click login buttons are available directly on the login page:

| Role | Username | Password | Permissions |
|---|---|---|---|
| **Store Administrator** | `admin` | `admin123` | Full access: Overview KPIs, POS Billing, Add/Edit/Delete Products, Restock, Python Dynamic Analytics, Reports Center. |
| **Store Associate / Worker** | `worker` | `worker123` | Store worker access: POS Billing Terminal, Stock Lookups, Restock Inventory, Receipt Generation. |

*(You can also register brand-new Worker or Admin accounts at any time via the registration tab).*

---

## 🏗️ System Architecture

```
                            +-------------------------------------------+
                            |            HTML5 / CSS3 / ES6             |
                            |        Responsive Modern Web UI           |
                            |  (POS Terminal, Analytics, Inventory)     |
                            +---------------------+---------------------+
                                                  |
                                            REST / HTTP JSON
                                                  |
                                                  v
                            +-------------------------------------------+
                            |           Java Backend Server             |
                            |   (com.sun.net.httpserver.HttpServer)     |
                            |  - Auth & Role-Based Session Controller   |
                            |  - Product & Stock Management Controller  |
                            |  - Sales Billing Transaction Controller   |
                            |  - Reports Aggregation Controller         |
                            +----------+---------------------+----------+
                                       |                     |
                              Direct Execution        Subprocess Bridge
                                       |                     |
                                       v                     v
                   +---------------------------+   +---------------------------+
                   |      Relational DBMS      |   | Python Analytics Engine   |
                   |   (SQLite / ANSI SQL)     |   |     (Pandas & Matplotlib) |
                   | - products, sales, users  |<--| - Retrieves database data  |
                   | - sale_items, stock_logs  |   | - Preprocesses data       |
                   +---------------------------+   | - Generates dynamic charts|
                                                   +---------------------------+
```

---

## 📁 Project Directory Structure

```
RetailStoreSystem/
│
├── database/
│   ├── schema.sql                 # DDL & Index definitions (SQLite & ANSI SQL)
│   ├── schema_mysql.sql           # MySQL/MariaDB compatible DDL & schema
│   ├── init_db.py                 # Automated DB initialization & realistic seed data
│   └── retail_store.db            # SQLite database file (auto-generated)
│
├── src/
│   └── retail/
│       ├── RetailStoreServer.java # Java HTTP Server & REST API endpoints
│       ├── DatabaseManager.java   # Database interop, SQL transactions & hashing
│       └── PythonAnalyticsBridge.java # Dynamic Python analytics invocation bridge
│
├── python/
│   ├── analytics_engine.py        # Python analytics engine (Pandas preprocessing, Matplotlib charts)
│   └── db_helper.py               # Fast transactional database bridge for Java
│
├── web/
│   ├── index.html                 # Router entry point (redirects to login/dashboard)
│   ├── login.html                 # Demo login buttons & user registration tabs
│   ├── dashboard.html             # Unified dashboard (POS, Stock, Analytics, Reports)
│   ├── css/
│   │   ├── style.css              # Core modern design system, variables & glassmorphism
│   │   └── dashboard.css          # POS layout, thermal receipt, charts & cards
│   └── js/
│       ├── app.js                 # Authentication, navigation, roles, toast alerts
│       ├── billing.js             # POS terminal, live stock checks, cart, checkout
│       ├── inventory.js           # Inventory catalog, restock, add/edit/delete modals
│       ├── analytics.js           # Dynamic Python analytics filters & chart rendering
│       └── reports.js             # Daily sales, availability, and low-stock reports
│
├── run.bat                        # Windows 1-Click launcher
├── run.sh                         # Linux / macOS 1-Click launcher
└── README.md                      # Documentation & user manual
```

---

## 🚀 Quick Start Instructions

### Prerequisites
- **Java**: JDK 8, 11, 17, 21, or higher.
- **Python**: Python 3.8+ with `pandas` and `matplotlib` installed (`pip install pandas matplotlib`).

### Running on Windows
Simply double-click or run from Command Prompt / PowerShell:
```cmd
run.bat
```
*This script automatically checks Python and Java, compiles the Java backend, seeds the database, launches the server at `http://localhost:8080/`, and opens your default browser.*

### Running on Linux / macOS
Make the script executable and run:
```bash
chmod +x run.sh
./run.sh
```

### Manual Execution (Step-by-Step)
If you prefer running commands manually:

1. **Initialize the Database:**
   ```bash
   python database/init_db.py
   ```

2. **Compile the Java Backend:**
   ```bash
   mkdir -p bin
   javac -encoding UTF-8 -d bin src/retail/*.java
   ```

3. **Start the Java HTTP Server:**
   ```bash
   java -cp bin retail.RetailStoreServer 8080
   ```

4. **Open in Browser:**
   Navigate to [http://localhost:8080/](http://localhost:8080/) in any web browser.

---

## 📊 Dynamic Python Analytics Models

The system provides 6 dynamic analytics models accessible to Administrators:

1. **Daily Sales Revenue & Units Trend**: Time-series visualization with dual axes showing daily gross revenue bars, 3-day rolling trendlines, and unit volume markers.
2. **Top Selling Products by Revenue & Volume**: Ranked horizontal bar chart highlighting bestselling products, unit volumes, and revenue contribution.
3. **Category Share Distribution (Donut Chart)**: Percentage revenue distribution across categories (Electronics, Groceries, Apparel, Home & Kitchen, Personal Care).
4. **Inventory Availability vs. Sales Demand**: Comparative dual-bar chart showing current shelf stock against total consumer demand to detect fast vs. slow movers.
5. **Urgent Stock Depletion Risk & Reorder Alerts**: Color-coded urgency heatmap showing items near or below safety threshold, with projected reorder requirements.
6. **Product Deep-Dive Trajectory**: Detailed cumulative revenue curves and daily unit velocity for any individual selected SKU.

---

## 🗄️ Database Schema Details

- **`users`**: User authentication, SHA-256 hashed passwords, and `ADMIN` / `WORKER` role flags.
- **`products`**: Product ID, SKU Code, Name, Category, Price, Stock Quantity, Low-Stock Safety Threshold, Description.
- **`sales`**: Sales transaction master record (Invoice number, cashier name, customer name, subtotal, discount, tax, final total, payment method, timestamp).
- **`sale_items`**: Line items for each invoice (Sale ID, Product ID, Name, Category, Unit Price, Quantity, Subtotal).
- **`stock_logs`**: Complete audit trail recording stock adjustments (`SALE`, `RESTOCK`, `ADJUSTMENT`), previous quantity, new quantity, staff member, and notes.

---

## 📄 License
Educational & Commercial Use Open License. Developed for the Retail Store Inventory and Sales Analysis System project.
