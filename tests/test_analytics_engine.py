import sqlite3
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "python"))
import analytics_engine


def create_database():
    connection = sqlite3.connect(":memory:")
    connection.executescript(
        """
        CREATE TABLE products (
            id INTEGER PRIMARY KEY,
            product_code TEXT,
            name TEXT,
            category TEXT,
            price REAL,
            stock_quantity INTEGER,
            low_stock_threshold INTEGER
        );
        CREATE TABLE sales (
            id INTEGER PRIMARY KEY,
            invoice_number TEXT,
            worker_name TEXT,
            customer_name TEXT,
            total_amount REAL,
            discount_amount REAL,
            tax_amount REAL,
            final_amount REAL,
            payment_method TEXT,
            sale_date TEXT
        );
        CREATE TABLE sale_items (
            id INTEGER PRIMARY KEY,
            sale_id INTEGER,
            product_id INTEGER,
            product_name TEXT,
            category TEXT,
            unit_price REAL,
            quantity INTEGER,
            subtotal REAL
        );
        INSERT INTO products VALUES
            (1, 'SKU-1', 'Product One', 'Tools', 10, 5, 2),
            (2, 'SKU-2', 'Product Two', 'Tools', 20, 7, 3);
        INSERT INTO sales VALUES
            (1, 'INV-1', 'Cashier', 'Customer', 20, 0, 2, 22, 'CASH', '2026-01-10 10:00:00'),
            (2, 'INV-2', 'Cashier', 'Customer', 30, 0, 2.4, 32.4, 'CASH', '2026-01-10 11:00:00'),
            (3, 'INV-3', 'Cashier', 'Customer', 60, 0, 4.8, 64.8, 'CASH', '2026-01-12 12:00:00');
        INSERT INTO sale_items VALUES
            (1, 1, 1, 'Product One', 'Tools', 10, 2, 20),
            (2, 2, 1, 'Product One', 'Tools', 10, 1, 10),
            (3, 2, 2, 'Product Two', 'Tools', 20, 1, 20),
            (4, 3, 2, 'Product Two', 'Tools', 20, 3, 60);
        """
    )
    return connection


class AnalyticsEngineTests(unittest.TestCase):
    def run_with_test_database(self, **filters):
        with patch.object(analytics_engine, "get_connection", side_effect=create_database):
            return analytics_engine.run_analysis(**filters)

    def test_overall_daily_analysis_aggregates_all_products_by_date(self):
        result = self.run_with_test_database(analysis_type="daily_trend")

        self.assertEqual(result["kpis"]["total_revenue"], 110)
        self.assertEqual(result["kpis"]["total_units_sold"], 7)
        self.assertEqual(result["kpis"]["unique_orders"], 3)
        self.assertEqual(result["kpis"]["avg_order_value"], 39.73)
        self.assertEqual(
            [row["Date"] for row in result["table_data"]],
            ["2026-01-10", "2026-01-11", "2026-01-12"],
        )
        self.assertEqual(result["table_data"][1]["Gross Revenue ($)"], "$0.00")
        self.assertEqual(result["table_data"][2]["3-Day Rolling Avg ($)"], "$36.67")
        self.assertTrue(result["chart_base64"].startswith("data:image/png;base64,"))

    def test_single_day_analysis_returns_a_single_day_chart_and_summary(self):
        result = self.run_with_test_database(
            analysis_type="daily_trend",
            date_from="2026-01-10",
            date_to="2026-01-10",
        )

        self.assertEqual(len(result["table_data"]), 1)
        self.assertEqual(result["table_data"][0]["Gross Revenue ($)"], "$50.00")
        self.assertEqual(result["table_data"][0]["3-Day Rolling Avg ($)"], "")
        self.assertTrue(result["chart_base64"].startswith("data:image/png;base64,"))

    def test_product_deep_dive_applies_product_and_inclusive_date_filters(self):
        result = self.run_with_test_database(
            analysis_type="product_deep_dive",
            product_id="1",
            date_from="2026-01-10",
            date_to="2026-01-10",
        )

        self.assertEqual(result["kpis"]["total_revenue"], 30)
        self.assertEqual(result["kpis"]["total_units_sold"], 3)
        self.assertEqual(result["kpis"]["unique_orders"], 2)
        self.assertEqual(result["kpis"]["avg_order_value"], 27.2)
        self.assertEqual(result["kpis"]["total_stock"], 5)
        self.assertEqual(result["table_data"][0]["Daily Units"], 3)
        self.assertEqual(result["filters"]["product_name"], "Product One")

    def test_product_performance_lists_products_within_the_selected_dates(self):
        result = self.run_with_test_database(
            analysis_type="product_performance",
            date_from="2026-01-10",
            date_to="2026-01-10",
        )

        self.assertEqual(
            [row["Product"] for row in result["table_data"]],
            ["Product One", "Product Two"],
        )
        self.assertEqual(result["kpis"]["total_revenue"], 50)

    def test_deep_dive_requires_a_product_and_date_range_must_be_valid(self):
        with self.assertRaisesRegex(ValueError, "Select a product"):
            self.run_with_test_database(analysis_type="product_deep_dive")

        with self.assertRaisesRegex(ValueError, "on or before"):
            self.run_with_test_database(
                analysis_type="daily_trend",
                date_from="2026-01-12",
                date_to="2026-01-10",
            )

    def test_empty_date_filter_returns_zero_sales_without_stale_chart_data(self):
        result = self.run_with_test_database(
            analysis_type="daily_trend",
            date_from="2026-02-01",
            date_to="2026-02-01",
        )

        self.assertEqual(result["status"], "success")
        self.assertEqual(result["kpis"]["total_revenue"], 0)
        self.assertEqual(result["table_data"], [])
        self.assertEqual(result["chart_base64"], "")


if __name__ == "__main__":
    unittest.main()
