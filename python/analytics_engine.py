#!/usr/bin/env python3
"""
Retail Store Inventory and Sales Analysis System
Advanced Python Analytics Engine with Dynamic Inputs & Matplotlib Visualizations
Preprocesses sales & inventory data using Pandas, returns JSON with Base64 charts & metrics.
"""

import sys
import os
import tempfile
# Ensure Matplotlib uses a writable temp config directory to suppress stderr warnings
os.environ.setdefault('MPLCONFIGDIR', os.path.join(tempfile.gettempdir(), 'matplotlib_retail'))

import json
import sqlite3
import base64
import io
import argparse
from datetime import datetime, timedelta
import pandas as pd
import numpy as np
import matplotlib
matplotlib.use('Agg')  # Headless backend for web/server rendering
import matplotlib.pyplot as plt
import matplotlib.ticker as ticker

# Setup paths
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)
DB_PATH = os.path.join(PROJECT_ROOT, "database", "retail_store.db")

# Style configurations for modern, elegant dark-slate dashboard visuals
plt.style.use('dark_background')
BG_COLOR = "#0f172a"       # Slate 900
CARD_BG = "#1e293b"        # Slate 800
TEXT_COLOR = "#f8fafc"     # Slate 50
MUTED_TEXT = "#94a3b8"     # Slate 400
GRID_COLOR = "#334155"     # Slate 700
ACCENT_PRIMARY = "#38bdf8" # Sky 400
ACCENT_SUCCESS = "#34d399" # Emerald 400
ACCENT_WARNING = "#fbbf24" # Amber 400
ACCENT_DANGER = "#f87171"  # Red 400
ACCENT_PURPLE = "#a78bfa"  # Violet 400

ANALYSIS_TYPES = (
    "daily_trend",
    "product_performance",
    "category_distribution",
    "stock_vs_sales",
    "low_stock_risk",
    "product_deep_dive",
)


def get_connection():
    if not os.path.exists(DB_PATH):
        raise FileNotFoundError(f"Database not found at {DB_PATH}")
    return sqlite3.connect(DB_PATH)


def parse_filter_date(value, field_name):
    if value is None or not str(value).strip():
        return None

    try:
        return datetime.strptime(str(value).strip(), "%Y-%m-%d").date()
    except ValueError as exc:
        raise ValueError(f"{field_name} must use YYYY-MM-DD format.") from exc


def format_fig_to_base64(fig) -> str:
    """Converts a Matplotlib figure into a Base64-encoded PNG string."""
    buf = io.BytesIO()
    fig.savefig(buf, format='png', bbox_inches='tight', dpi=130, facecolor=BG_COLOR, edgecolor='none')
    plt.close(fig)
    buf.seek(0)
    img_b64 = base64.b64encode(buf.read()).decode('utf-8')
    return f"data:image/png;base64,{img_b64}"

def run_analysis(analysis_type="daily_trend", product_id=None, category=None, date_from=None, date_to=None):
    """
    Main analytics pipeline:
    1. Query database based on dynamic parameters
    2. Preprocess with Pandas
    3. Generate custom visualization
    4. Compile KPI stats & return JSON
    """
    if analysis_type not in ANALYSIS_TYPES:
        raise ValueError(f"Unsupported analysis type: {analysis_type}")

    start_date = parse_filter_date(date_from, "from_date")
    end_date = parse_filter_date(date_to, "to_date")
    if start_date and end_date and start_date > end_date:
        raise ValueError("from_date must be on or before to_date.")

    product_filter = None
    if product_id is not None and str(product_id).strip().upper() != "ALL":
        try:
            product_filter = int(product_id)
        except (TypeError, ValueError) as exc:
            raise ValueError("product_id must be a valid product ID or ALL.") from exc
        if product_filter <= 0:
            raise ValueError("product_id must be a positive product ID.")

    category_filter = None
    if category is not None and str(category).strip().upper() != "ALL":
        category_filter = str(category).strip()
        if not category_filter:
            category_filter = None

    if analysis_type == "product_deep_dive" and product_filter is None:
        raise ValueError("Select a product to run the product deep-dive analysis.")

    conn = get_connection()

    # Load tables into DataFrames
    query_sales = """
        SELECT s.id as sale_id, s.invoice_number, s.worker_name, s.customer_name,
               s.total_amount, s.discount_amount, s.tax_amount, s.final_amount,
               s.payment_method, s.sale_date,
               si.id as item_id, si.product_id, si.product_name, si.category,
               si.unit_price, si.quantity, si.subtotal
        FROM sales s
        JOIN sale_items si ON s.id = si.sale_id
    """
    df_sales = pd.read_sql_query(query_sales, conn)
    df_products = pd.read_sql_query("SELECT * FROM products", conn)
    conn.close()

    # Preprocessing
    df_sales['sale_date'] = pd.to_datetime(df_sales['sale_date'])
    df_sales['date_only'] = df_sales['sale_date'].dt.date

    # Apply dynamic filters
    if start_date:
        df_sales = df_sales[df_sales['date_only'] >= start_date]

    if end_date:
        df_sales = df_sales[df_sales['date_only'] <= end_date]

    if category_filter:
        category_matches = df_products['category'].astype(str).str.casefold() == category_filter.casefold()
        if not category_matches.any():
            raise ValueError(f"Unknown category: {category_filter}")
        df_sales = df_sales[df_sales['category'].astype(str).str.casefold() == category_filter.casefold()]
        df_products = df_products[category_matches]

    selected_product_name = None
    if product_filter is not None:
        selected_product = df_products[df_products['id'] == product_filter]
        if selected_product.empty:
            raise ValueError(f"Product ID {product_filter} was not found in the selected category.")
        selected_product_name = str(selected_product.iloc[0]['name'])
        df_sales = df_sales[df_sales['product_id'] == product_filter]
        df_products = selected_product

    # Overall KPIs
    total_revenue = float(df_sales['subtotal'].sum()) if not df_sales.empty else 0.0
    total_units_sold = int(df_sales['quantity'].sum()) if not df_sales.empty else 0
    unique_orders = int(df_sales['sale_id'].nunique()) if not df_sales.empty else 0
    order_headers = df_sales.drop_duplicates(subset=['sale_id'])
    avg_order_value = round(float(order_headers['final_amount'].mean()), 2) if unique_orders > 0 else 0.0
    total_stock = int(df_products['stock_quantity'].sum())
    total_inventory_value = float((df_products['stock_quantity'] * df_products['price']).sum())
    low_stock_count = int((df_products['stock_quantity'] <= df_products['low_stock_threshold']).sum())
    out_of_stock_count = int((df_products['stock_quantity'] == 0).sum())

    top_product_name = "N/A"
    if not df_sales.empty:
        prod_grp = df_sales.groupby('product_name')['subtotal'].sum()
        if not prod_grp.empty:
            top_product_name = prod_grp.idxmax()

    kpis = {
        "total_revenue": round(total_revenue, 2),
        "total_units_sold": total_units_sold,
        "unique_orders": unique_orders,
        "avg_order_value": avg_order_value,
        "total_stock": total_stock,
        "total_inventory_value": round(total_inventory_value, 2),
        "low_stock_count": low_stock_count,
        "out_of_stock_count": out_of_stock_count,
        "top_product": top_product_name,
        "date_range_applied": f"{df_sales['date_only'].min() if not df_sales.empty else 'N/A'} to {df_sales['date_only'].max() if not df_sales.empty else 'N/A'}"
    }

    filters_applied = {
        "product_id": product_filter,
        "product_name": selected_product_name,
        "category": category_filter,
        "from_date": start_date.isoformat() if start_date else None,
        "to_date": end_date.isoformat() if end_date else None,
        "inventory_snapshot": "current"
    }

    # Generate Visualization based on analysis_type
    chart_base64 = ""
    table_data = []

    sales_analyses = ("daily_trend", "product_performance", "category_distribution", "product_deep_dive")
    if df_sales.empty and analysis_type in sales_analyses:
        return {
            "status": "success",
            "message": "No sales found for the selected filters.",
            "analysis_type": analysis_type,
            "filters": filters_applied,
            "kpis": kpis,
            "chart_base64": "",
            "table_data": []
        }

    if analysis_type == "daily_trend":
        # Group by day
        daily = df_sales.groupby('date_only').agg(
            revenue=('subtotal', 'sum'),
            units=('quantity', 'sum'),
            orders=('sale_id', 'nunique')
        ).reset_index()
        daily = daily.sort_values('date_only')
        calendar_days = pd.date_range(
            start=daily['date_only'].min(),
            end=daily['date_only'].max(),
            freq='D'
        ).date
        daily = daily.set_index('date_only').reindex(calendar_days, fill_value=0)
        daily.index.name = 'date_only'
        daily = daily.reset_index()
        daily['rolling_rev'] = daily['revenue'].rolling(window=3, min_periods=3).mean()

        fig, ax1 = plt.subplots(figsize=(10, 4.8), facecolor=BG_COLOR)
        ax1.set_facecolor(CARD_BG)

        # Revenue Bars
        bars = ax1.bar(range(len(daily)), daily['revenue'], color=ACCENT_PRIMARY, alpha=0.6, width=0.55, label='Daily Gross Revenue ($)')
        
        # A rolling average is only a trend when it contains multiple full windows.
        if daily['rolling_rev'].notna().sum() > 1:
            ax1.plot(range(len(daily)), daily['rolling_rev'], color=ACCENT_WARNING, linewidth=2.5, marker='o', markersize=4, label='3-Day Rolling Avg ($)')

        ax1.set_xlabel("Date", color=MUTED_TEXT, fontsize=10, labelpad=8)
        ax1.set_ylabel("Gross Revenue ($)", color=ACCENT_PRIMARY, fontsize=10)
        ax1.tick_params(axis='x', colors=MUTED_TEXT, labelsize=8, rotation=35)
        ax1.tick_params(axis='y', colors=ACCENT_PRIMARY, labelsize=9)
        ax1.yaxis.set_major_formatter(ticker.StrMethodFormatter('${x:,.0f}'))

        # Set x tick labels with formatting
        dates_str = [d.strftime('%b %d') for d in daily['date_only']]
        ax1.set_xticks(range(len(daily)))
        # Show subset of ticks if many
        step = max(1, len(daily) // 10)
        ax1.set_xticks(range(0, len(daily), step))
        ax1.set_xticklabels([dates_str[i] for i in range(0, len(daily), step)])
        if len(daily) == 1:
            ax1.set_xlim(-1, 1)
        else:
            ax1.set_xlim(-0.5, len(daily) - 0.5)

        # Secondary axis for units sold
        ax2 = ax1.twinx()
        ax2.plot(range(len(daily)), daily['units'], color=ACCENT_SUCCESS, linestyle='--', marker='s', markersize=4, label='Units Sold')
        ax2.set_ylabel("Units Sold", color=ACCENT_SUCCESS, fontsize=10)
        ax2.tick_params(axis='y', colors=ACCENT_SUCCESS, labelsize=9)
        ax2.grid(False)

        # Title and grid
        ax1.grid(True, linestyle=':', alpha=0.3, color=GRID_COLOR)
        plt.title("Daily Sales Revenue & Units Sold Over Time", fontsize=13, fontweight='bold', color=TEXT_COLOR, pad=15)
        
        # Combined legend
        lines1, labels1 = ax1.get_legend_handles_labels()
        lines2, labels2 = ax2.get_legend_handles_labels()
        ax1.legend(lines1 + lines2, labels1 + labels2, loc='upper left', framealpha=0.4, facecolor=CARD_BG, edgecolor=GRID_COLOR, fontsize=8)

        chart_base64 = format_fig_to_base64(fig)
        
        # Preprocessed table data
        for _, row in daily.iterrows():
            table_data.append({
                "Date": str(row['date_only']),
                "Gross Revenue ($)": f"${row['revenue']:,.2f}",
                "Units Sold": int(row['units']),
                "Transactions": int(row['orders']),
                "3-Day Rolling Avg ($)": f"${row['rolling_rev']:,.2f}" if pd.notna(row['rolling_rev']) else ""
            })

    elif analysis_type == "product_performance":
        # Group by product
        prod_perf = df_sales.groupby(['product_id', 'product_name', 'category']).agg(
            revenue=('subtotal', 'sum'),
            units_sold=('quantity', 'sum'),
            avg_price=('unit_price', 'mean')
        ).reset_index().sort_values('revenue', ascending=True)

        top_10 = prod_perf.tail(10)

        fig, ax = plt.subplots(figsize=(10, 5), facecolor=BG_COLOR)
        ax.set_facecolor(CARD_BG)

        y_pos = range(len(top_10))
        bars = ax.barh(y_pos, top_10['revenue'], color=ACCENT_PRIMARY, height=0.6, alpha=0.85, edgecolor=ACCENT_PRIMARY)
        
        # Annotate revenue on bars
        for idx, bar in enumerate(bars):
            val = bar.get_width()
            units = top_10.iloc[idx]['units_sold']
            ax.text(val + max(top_10['revenue']) * 0.015, bar.get_y() + bar.get_height()/2,
                    f"${val:,.0f} ({units} pcs)", va='center', color=TEXT_COLOR, fontsize=8, fontweight='bold')

        ax.set_yticks(y_pos)
        # Shorten product names if long
        names = [n[:28] + '...' if len(n) > 28 else n for n in top_10['product_name']]
        ax.set_yticklabels(names, color=TEXT_COLOR, fontsize=8.5)
        ax.set_xlabel("Total Gross Sales ($)", color=MUTED_TEXT, fontsize=10, labelpad=8)
        ax.xaxis.set_major_formatter(ticker.StrMethodFormatter('${x:,.0f}'))
        ax.tick_params(axis='x', colors=MUTED_TEXT, labelsize=9)
        ax.grid(True, linestyle=':', alpha=0.3, color=GRID_COLOR, axis='x')
        plt.title("Top Selling Products Ranked by Revenue & Volume", fontsize=13, fontweight='bold', color=TEXT_COLOR, pad=15)

        chart_base64 = format_fig_to_base64(fig)

        # Preprocessed table
        for _, row in prod_perf.sort_values('revenue', ascending=False).iterrows():
            table_data.append({
                "Product": row['product_name'],
                "Category": row['category'],
                "Units Sold": int(row['units_sold']),
                "Gross Revenue": f"${row['revenue']:,.2f}",
                "Avg Price": f"${row['avg_price']:,.2f}"
            })

    elif analysis_type == "category_distribution":
        cat_perf = df_sales.groupby('category').agg(
            revenue=('subtotal', 'sum'),
            units=('quantity', 'sum')
        ).reset_index().sort_values('revenue', ascending=False)

        fig, ax = plt.subplots(figsize=(8.5, 4.8), facecolor=BG_COLOR)
        ax.set_facecolor(CARD_BG)

        colors = [ACCENT_PRIMARY, ACCENT_SUCCESS, ACCENT_PURPLE, ACCENT_WARNING, ACCENT_DANGER]
        wedges, texts, autotexts = ax.pie(
            cat_perf['revenue'],
            labels=cat_perf['category'],
            autopct='%1.1f%%',
            startangle=140,
            colors=colors[:len(cat_perf)],
            textprops=dict(color=TEXT_COLOR, fontsize=9),
            wedgeprops=dict(width=0.45, edgecolor=BG_COLOR, linewidth=2)  # Donut chart
        )

        for autotext in autotexts:
            autotext.set_color('#ffffff')
            autotext.set_fontweight('bold')

        plt.title("Revenue Share Distribution by Product Category", fontsize=13, fontweight='bold', color=TEXT_COLOR, pad=15)
        chart_base64 = format_fig_to_base64(fig)

        for _, row in cat_perf.iterrows():
            pct = (row['revenue'] / total_revenue) * 100 if total_revenue > 0 else 0
            table_data.append({
                "Category": row['category'],
                "Gross Revenue ($)": f"${row['revenue']:,.2f}",
                "Units Sold": int(row['units']),
                "Share (%)": f"{pct:.1f}%"
            })

    elif analysis_type == "stock_vs_sales":
        # Merge products with sales quantities
        sales_qty = df_sales.groupby('product_id')['quantity'].sum().reset_index()
        merged = pd.merge(df_products, sales_qty, left_on='id', right_on='product_id', how='left').fillna({'quantity': 0})
        merged = merged.sort_values('stock_quantity', ascending=False)

        fig, ax = plt.subplots(figsize=(10, 5), facecolor=BG_COLOR)
        ax.set_facecolor(CARD_BG)

        x = np.arange(len(merged))
        width = 0.38

        rects1 = ax.bar(x - width/2, merged['stock_quantity'], width, label='Current Stock Available', color=ACCENT_PRIMARY, alpha=0.85)
        rects2 = ax.bar(x + width/2, merged['quantity'], width, label='Total Units Sold', color=ACCENT_SUCCESS, alpha=0.85)

        ax.set_ylabel("Quantity (Units)", color=MUTED_TEXT, fontsize=10)
        ax.set_xlabel("Product Code", color=MUTED_TEXT, fontsize=10, labelpad=8)
        ax.set_xticks(x)
        ax.set_xticklabels(merged['product_code'], rotation=45, color=MUTED_TEXT, fontsize=8)
        if len(merged) == 1:
            ax.set_xlim(-1, 1)
        else:
            ax.set_xlim(-0.5, len(merged) - 0.5)
        ax.tick_params(axis='y', colors=MUTED_TEXT)
        ax.grid(True, linestyle=':', alpha=0.3, color=GRID_COLOR, axis='y')
        ax.legend(framealpha=0.4, facecolor=CARD_BG, edgecolor=GRID_COLOR, fontsize=9)
        plt.title("Inventory Availability vs. Sales Demand Comparison", fontsize=13, fontweight='bold', color=TEXT_COLOR, pad=15)

        chart_base64 = format_fig_to_base64(fig)

        for _, row in merged.iterrows():
            table_data.append({
                "Code": row['product_code'],
                "Product Name": row['name'],
                "Current Stock": int(row['stock_quantity']),
                "Units Sold": int(row['quantity']),
                "Status": "Critical" if row['stock_quantity'] <= 5 else ("Low" if row['stock_quantity'] <= row['low_stock_threshold'] else "Healthy")
            })

    elif analysis_type == "low_stock_risk":
        # Focus on items at or near low stock threshold
        low_stock_df = df_products[df_products['stock_quantity'] <= df_products['low_stock_threshold'] * 1.5].sort_values('stock_quantity')

        fig, ax = plt.subplots(figsize=(10, 4.8), facecolor=BG_COLOR)
        ax.set_facecolor(CARD_BG)

        y_pos = range(len(low_stock_df))
        colors = [ACCENT_DANGER if s <= 5 else (ACCENT_WARNING if s <= t else ACCENT_PRIMARY)
                  for s, t in zip(low_stock_df['stock_quantity'], low_stock_df['low_stock_threshold'])]

        bars = ax.barh(y_pos, low_stock_df['stock_quantity'], color=colors, height=0.55, alpha=0.9)
        
        # Plot safety threshold markers
        for idx, (_, row) in enumerate(low_stock_df.iterrows()):
            ax.scatter(row['low_stock_threshold'], idx, color='#ffffff', s=40, zorder=5, marker='|')

        ax.set_yticks(y_pos)
        names = [f"[{r['product_code']}] {r['name'][:22]}" for _, r in low_stock_df.iterrows()]
        ax.set_yticklabels(names, color=TEXT_COLOR, fontsize=8.5)
        ax.set_xlabel("Units Available (White line indicates threshold)", color=MUTED_TEXT, fontsize=9.5, labelpad=8)
        ax.tick_params(axis='x', colors=MUTED_TEXT)
        ax.grid(True, linestyle=':', alpha=0.3, color=GRID_COLOR, axis='x')
        plt.title("Urgent Stock Depletion Risk & Reorder Alerts", fontsize=13, fontweight='bold', color=TEXT_COLOR, pad=15)

        chart_base64 = format_fig_to_base64(fig)

        for _, row in low_stock_df.iterrows():
            urgency = "CRITICAL (< 5)" if row['stock_quantity'] <= 5 else "LOW STOCK"
            table_data.append({
                "Product": row['name'],
                "Category": row['category'],
                "Available Stock": int(row['stock_quantity']),
                "Threshold": int(row['low_stock_threshold']),
                "Urgency": urgency,
                "Restock Needed": int(row['low_stock_threshold'] * 3 - row['stock_quantity'])
            })

    elif analysis_type == "product_deep_dive":
        # Specific product timeline
        prod_sales = df_sales.sort_values('sale_date')
        daily_prod = prod_sales.groupby('date_only').agg(
            revenue=('subtotal', 'sum'),
            units=('quantity', 'sum')
        ).reset_index()

        daily_prod['cum_units'] = daily_prod['units'].cumsum()
        daily_prod['cum_rev'] = daily_prod['revenue'].cumsum()

        fig, ax1 = plt.subplots(figsize=(10, 4.8), facecolor=BG_COLOR)
        ax1.set_facecolor(CARD_BG)

        # Plot cumulative revenue
        ax1.plot(range(len(daily_prod)), daily_prod['cum_rev'], color=ACCENT_PRIMARY, linewidth=2.5, marker='o', label='Cumulative Gross Revenue ($)')
        ax1.set_ylabel("Cumulative Gross Revenue ($)", color=ACCENT_PRIMARY, fontsize=10)
        ax1.yaxis.set_major_formatter(ticker.StrMethodFormatter('${x:,.0f}'))
        ax1.tick_params(axis='y', colors=ACCENT_PRIMARY)

        # Secondary axis for daily units
        ax2 = ax1.twinx()
        ax2.bar(range(len(daily_prod)), daily_prod['units'], color=ACCENT_SUCCESS, alpha=0.4, width=0.4, label='Daily Units Sold')
        ax2.set_ylabel("Units Sold per Day", color=ACCENT_SUCCESS, fontsize=10)
        ax2.tick_params(axis='y', colors=ACCENT_SUCCESS)
        ax2.grid(False)

        dates_str = [d.strftime('%b %d') for d in daily_prod['date_only']]
        ax1.set_xticks(range(len(daily_prod)))
        step = max(1, len(daily_prod) // 8)
        ax1.set_xticks(range(0, len(daily_prod), step))
        ax1.set_xticklabels([dates_str[i] for i in range(0, len(daily_prod), step)], rotation=30, color=MUTED_TEXT, fontsize=8)
        if len(daily_prod) == 1:
            ax1.set_xlim(-1, 1)
        else:
            ax1.set_xlim(-0.5, len(daily_prod) - 0.5)

        prod_title = selected_product_name
        plt.title(f"Dynamic Performance Trajectory: {prod_title}", fontsize=12.5, fontweight='bold', color=TEXT_COLOR, pad=15)
        ax1.grid(True, linestyle=':', alpha=0.3, color=GRID_COLOR)

        chart_base64 = format_fig_to_base64(fig)

        for _, row in daily_prod.iterrows():
            table_data.append({
                "Date": str(row['date_only']),
                "Daily Units": int(row['units']),
                "Daily Gross Revenue": f"${row['revenue']:,.2f}",
                "Cumulative Units": int(row['cum_units']),
                "Cumulative Gross Revenue": f"${row['cum_rev']:,.2f}"
            })

    return {
        "status": "success",
        "analysis_type": analysis_type,
        "filters": filters_applied,
        "kpis": kpis,
        "chart_base64": chart_base64,
        "table_data": table_data
    }

def main():
    parser = argparse.ArgumentParser(description="Retail Store Sales & Inventory Python Analytics")
    parser.add_argument("--type", default="daily_trend", choices=ANALYSIS_TYPES)
    parser.add_argument("--product-id", default=None)
    parser.add_argument("--category", default=None)
    parser.add_argument("--from-date", default=None)
    parser.add_argument("--to-date", default=None)
    parser.add_argument("--json-input", default=None, help="Pass parameters as a single JSON string")

    args = parser.parse_args()

    a_type = args.type
    p_id = args.product_id
    cat = args.category
    d_from = args.from_date
    d_to = args.to_date

    json_input = args.json_input
    if json_input is None and not sys.stdin.isatty():
        json_input = sys.stdin.read().strip() or None

    if json_input:
        try:
            params = json.loads(json_input)
            a_type = params.get("type", a_type)
            p_id = params.get("product_id", p_id)
            cat = params.get("category", cat)
            d_from = params.get("from_date", d_from)
            d_to = params.get("to_date", d_to)
        except Exception as e:
            print(json.dumps({"status": "error", "message": f"Invalid JSON input: {e}"}))
            sys.exit(1)

    try:
        result = run_analysis(
            analysis_type=a_type,
            product_id=p_id,
            category=cat,
            date_from=d_from,
            date_to=d_to
        )
        print(json.dumps(result))
    except Exception as e:
        import traceback
        err_msg = traceback.format_exc()
        print(json.dumps({"status": "error", "message": str(e), "trace": err_msg}))
        sys.exit(1)

if __name__ == "__main__":
    main()
