package retail;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpHandler;
import com.sun.net.httpserver.HttpServer;

import java.io.*;
import java.net.InetSocketAddress;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.text.SimpleDateFormat;
import java.util.*;

/**
 * RetailStoreServer: Enterprise Java HTTP REST & Static Web Server.
 * Orchestrates business logic, authentication, stock management, sales transactions,
 * and Python-powered dynamic sales & inventory analytics.
 */
public class RetailStoreServer {

    private static final int DEFAULT_PORT = 8080;
    private static File webRootDir;

    public static void main(String[] args) {
        int port = DEFAULT_PORT;
        if (args.length > 0) {
            try {
                port = Integer.parseInt(args[0]);
            } catch (NumberFormatException ignored) {}
        }

        // Locate web root directory
        File currentDir = new File(System.getProperty("user.dir"));
        File cand1 = new File(currentDir, "web");
        File cand2 = new File(currentDir.getParentFile(), "web");

        if (cand1.exists() && cand1.isDirectory()) {
            webRootDir = cand1;
        } else if (cand2.exists() && cand2.isDirectory()) {
            webRootDir = cand2;
        } else {
            webRootDir = new File("web");
        }

        try {
            HttpServer server = HttpServer.create(new InetSocketAddress(port), 0);

            // API Handlers
            server.createContext("/api/auth/login", new LoginHandler());
            server.createContext("/api/auth/register", new RegisterHandler());
            server.createContext("/api/auth/demo-users", new DemoUsersHandler());

            server.createContext("/api/products/add", new AddProductHandler());
            server.createContext("/api/products/update", new UpdateProductHandler());
            server.createContext("/api/products/delete", new DeleteProductHandler());
            server.createContext("/api/products/categories", new CategoriesHandler());
            server.createContext("/api/products", new ProductsHandler());

            server.createContext("/api/stock/update", new UpdateStockHandler());

            server.createContext("/api/sales/create", new CreateSaleHandler());
            server.createContext("/api/sales/list", new ListSalesHandler());
            server.createContext("/api/sales/details", new SaleDetailsHandler());

            server.createContext("/api/reports/daily", new DailyReportHandler());
            server.createContext("/api/reports/availability", new AvailabilityReportHandler());
            server.createContext("/api/reports/low-stock", new LowStockReportHandler());

            server.createContext("/api/analytics/run", new AnalyticsHandler());

            // Static Web File Handler
            server.createContext("/", new StaticFileHandler());

            server.setExecutor(null); // default executor
            server.start();

            System.out.println("==================================================================");
            System.out.println(" Retail Store Inventory and Sales Analysis System");
            System.out.println(" Backend: Java HTTP Server (Enterprise REST API)");
            System.out.println(" Database: Relational DBMS (SQLite / MySQL Compatible)");
            System.out.println(" Analytics Engine: Python 3 (Pandas, Matplotlib)");
            System.out.println(" Frontend: HTML5 / CSS3 / Modern JavaScript");
            System.out.printf (" Server successfully running at: http://localhost:%d/\n", port);
            System.out.println("==================================================================");

        } catch (IOException e) {
            System.err.println("Failed to start server: " + e.getMessage());
            e.printStackTrace();
        }
    }

    // =========================================================================
    // API HANDLERS
    // =========================================================================

    /**
     * Handles User Login & Demo Login authentication.
     */
    static class LoginHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            if (!handleCorsAndOptions(exchange)) return;
            if (!"POST".equalsIgnoreCase(exchange.getRequestMethod())) {
                sendJsonResponse(exchange, 405, "{\"status\": \"error\", \"message\": \"Method not allowed\"}");
                return;
            }

            String body = readRequestBody(exchange);
            Map<String, String> json = parseSimpleJson(body);
            String username = json.get("username");
            String password = json.get("password");

            if (username == null || password == null || username.trim().isEmpty() || password.trim().isEmpty()) {
                sendJsonResponse(exchange, 400, "{\"status\": \"error\", \"message\": \"Username and password required\"}");
                return;
            }

            String passHash = DatabaseManager.hashPassword(password.trim());
            String sql = "SELECT id, username, full_name, role FROM users WHERE username = ? AND password_hash = ?";
            String params = "[\"" + DatabaseManager.escapeJson(username.trim()) + "\", \"" + passHash + "\"]";

            String result = DatabaseManager.query(sql, params);
            if (result.contains("\"data\": [") && !result.contains("\"data\": []")) {
                sendJsonResponse(exchange, 200, "{\"status\": \"success\", \"message\": \"Login successful\", \"result\": " + result + "}");
            } else {
                sendJsonResponse(exchange, 401, "{\"status\": \"error\", \"message\": \"Invalid username or password\"}");
            }
        }
    }

    /**
     * Handles New User Registration (Worker and Admin).
     */
    static class RegisterHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            if (!handleCorsAndOptions(exchange)) return;
            if (!"POST".equalsIgnoreCase(exchange.getRequestMethod())) {
                sendJsonResponse(exchange, 405, "{\"status\": \"error\", \"message\": \"Method not allowed\"}");
                return;
            }

            String body = readRequestBody(exchange);
            Map<String, String> json = parseSimpleJson(body);
            String username = json.get("username");
            String password = json.get("password");
            String fullName = json.get("full_name");
            String role = json.get("role");

            if (username == null || password == null || fullName == null || role == null ||
                username.trim().isEmpty() || password.trim().isEmpty()) {
                sendJsonResponse(exchange, 400, "{\"status\": \"error\", \"message\": \"All registration fields are required\"}");
                return;
            }

            role = role.trim().toUpperCase();
            if (!"ADMIN".equals(role) && !"WORKER".equals(role)) {
                sendJsonResponse(exchange, 400, "{\"status\": \"error\", \"message\": \"Role must be either ADMIN or WORKER\"}");
                return;
            }

            // Check if username already exists
            String checkSql = "SELECT id FROM users WHERE username = ?";
            String checkParams = "[\"" + DatabaseManager.escapeJson(username.trim()) + "\"]";
            String checkRes = DatabaseManager.query(checkSql, checkParams);
            if (checkRes.contains("\"count\": 1") || (checkRes.contains("\"data\": [") && !checkRes.contains("\"data\": []"))) {
                sendJsonResponse(exchange, 409, "{\"status\": \"error\", \"message\": \"Username already taken. Please choose another.\"}");
                return;
            }

            String passHash = DatabaseManager.hashPassword(password.trim());
            String insertSql = "INSERT INTO users (username, password_hash, full_name, role) VALUES (?, ?, ?, ?)";
            String insertParams = "[\"" + DatabaseManager.escapeJson(username.trim()) + "\", \"" + passHash + "\", \"" +
                    DatabaseManager.escapeJson(fullName.trim()) + "\", \"" + role + "\"]";

            String insertRes = DatabaseManager.execute(insertSql, insertParams);
            if (insertRes.contains("\"status\": \"success\"")) {
                sendJsonResponse(exchange, 201, "{\"status\": \"success\", \"message\": \"User registered successfully as " + role + "\"}");
            } else {
                sendJsonResponse(exchange, 500, "{\"status\": \"error\", \"message\": \"Registration failed: " + DatabaseManager.escapeJson(insertRes) + "\"}");
            }
        }
    }

    /**
     * Provides demo credentials for testing convenience.
     */
    static class DemoUsersHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            if (!handleCorsAndOptions(exchange)) return;
            String json = "{\"status\": \"success\", \"demo_users\": [" +
                    "{\"role\": \"ADMIN\", \"username\": \"admin\", \"password\": \"admin123\", \"description\": \"Full Administrator access with analytics & inventory management\"}," +
                    "{\"role\": \"WORKER\", \"username\": \"worker\", \"password\": \"worker123\", \"description\": \"Store associate & billing cashier access\"}" +
                    "]}";
            sendJsonResponse(exchange, 200, json);
        }
    }

    /**
     * Products list with search, category filtering, and stock availability checks.
     */
    static class ProductsHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            if (!handleCorsAndOptions(exchange)) return;

            Map<String, String> queryParams = parseQueryParams(exchange.getRequestURI().getQuery());
            String category = queryParams.get("category");
            String search = queryParams.get("search");
            String lowStockOnly = queryParams.get("low_stock");

            StringBuilder sql = new StringBuilder("SELECT id, product_code, name, category, price, stock_quantity, low_stock_threshold, description, updated_at FROM products WHERE 1=1 ");
            List<String> paramsList = new ArrayList<>();

            if (category != null && !category.trim().isEmpty() && !"ALL".equalsIgnoreCase(category)) {
                sql.append("AND LOWER(category) = LOWER(?) ");
                paramsList.add("\"" + DatabaseManager.escapeJson(category.trim()) + "\"");
            }

            if (search != null && !search.trim().isEmpty()) {
                sql.append("AND (LOWER(name) LIKE ? OR LOWER(product_code) LIKE ?) ");
                String pattern = "\"%" + DatabaseManager.escapeJson(search.trim().toLowerCase()) + "%\"";
                paramsList.add(pattern);
                paramsList.add(pattern);
            }

            if ("true".equalsIgnoreCase(lowStockOnly)) {
                sql.append("AND stock_quantity <= low_stock_threshold ");
            }

            sql.append("ORDER BY id ASC");
            String paramsJson = "[" + String.join(", ", paramsList) + "]";
            String result = DatabaseManager.query(sql.toString(), paramsJson);

            sendJsonResponse(exchange, 200, result);
        }
    }

    /**
     * Add new product (Admin only).
     */
    static class AddProductHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            if (!handleCorsAndOptions(exchange)) return;
            if (!"POST".equalsIgnoreCase(exchange.getRequestMethod())) {
                sendJsonResponse(exchange, 405, "{\"status\": \"error\", \"message\": \"Method not allowed\"}");
                return;
            }

            String body = readRequestBody(exchange);
            Map<String, String> json = parseSimpleJson(body);

            String code = json.get("product_code");
            String name = json.get("name");
            String category = json.get("category");
            String priceStr = json.get("price");
            String stockStr = json.get("stock_quantity");
            String thresholdStr = json.get("low_stock_threshold");
            String desc = json.get("description");

            if (code == null || name == null || category == null || priceStr == null || stockStr == null) {
                sendJsonResponse(exchange, 400, "{\"status\": \"error\", \"message\": \"Missing required product fields\"}");
                return;
            }

            double price = Double.parseDouble(priceStr);
            int stock = Integer.parseInt(stockStr);
            int threshold = thresholdStr != null ? Integer.parseInt(thresholdStr) : 10;
            if (desc == null) desc = "";

            String sql = "INSERT INTO products (product_code, name, category, price, stock_quantity, low_stock_threshold, description) VALUES (?, ?, ?, ?, ?, ?, ?)";
            String params = String.format("[\"%s\", \"%s\", \"%s\", %.2f, %d, %d, \"%s\"]",
                    DatabaseManager.escapeJson(code),
                    DatabaseManager.escapeJson(name),
                    DatabaseManager.escapeJson(category),
                    price, stock, threshold,
                    DatabaseManager.escapeJson(desc));

            String res = DatabaseManager.execute(sql, params);
            sendJsonResponse(exchange, 200, res);
        }
    }

    /**
     * Update product details.
     */
    static class UpdateProductHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            if (!handleCorsAndOptions(exchange)) return;
            if (!"POST".equalsIgnoreCase(exchange.getRequestMethod())) {
                sendJsonResponse(exchange, 405, "{\"status\": \"error\", \"message\": \"Method not allowed\"}");
                return;
            }

            String body = readRequestBody(exchange);
            Map<String, String> json = parseSimpleJson(body);

            String idStr = json.get("id");
            String name = json.get("name");
            String category = json.get("category");
            String priceStr = json.get("price");
            String thresholdStr = json.get("low_stock_threshold");
            String desc = json.get("description");

            if (idStr == null || name == null || category == null || priceStr == null) {
                sendJsonResponse(exchange, 400, "{\"status\": \"error\", \"message\": \"Missing required update fields\"}");
                return;
            }

            int id = Integer.parseInt(idStr);
            double price = Double.parseDouble(priceStr);
            int threshold = thresholdStr != null ? Integer.parseInt(thresholdStr) : 10;
            if (desc == null) desc = "";

            String sql = "UPDATE products SET name = ?, category = ?, price = ?, low_stock_threshold = ?, description = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?";
            String params = String.format("[\"%s\", \"%s\", %.2f, %d, \"%s\", %d]",
                    DatabaseManager.escapeJson(name),
                    DatabaseManager.escapeJson(category),
                    price, threshold,
                    DatabaseManager.escapeJson(desc),
                    id);

            String res = DatabaseManager.execute(sql, params);
            sendJsonResponse(exchange, 200, res);
        }
    }

    /**
     * Delete product (Admin only).
     */
    static class DeleteProductHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            if (!handleCorsAndOptions(exchange)) return;
            if (!"POST".equalsIgnoreCase(exchange.getRequestMethod())) {
                sendJsonResponse(exchange, 405, "{\"status\": \"error\", \"message\": \"Method not allowed\"}");
                return;
            }

            String body = readRequestBody(exchange);
            Map<String, String> json = parseSimpleJson(body);
            String idStr = json.get("id");
            if (idStr == null) {
                sendJsonResponse(exchange, 400, "{\"status\": \"error\", \"message\": \"Product ID required\"}");
                return;
            }

            int id = Integer.parseInt(idStr);
            String sql = "DELETE FROM products WHERE id = ?";
            String params = "[" + id + "]";
            String res = DatabaseManager.execute(sql, params);
            sendJsonResponse(exchange, 200, res);
        }
    }

    /**
     * Categories list.
     */
    static class CategoriesHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            if (!handleCorsAndOptions(exchange)) return;
            String sql = "SELECT DISTINCT category FROM products ORDER BY category ASC";
            String res = DatabaseManager.query(sql, "[]");
            sendJsonResponse(exchange, 200, res);
        }
    }

    /**
     * Stock Update Handler (Worker & Admin can restock or adjust inventory).
     */
    static class UpdateStockHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            if (!handleCorsAndOptions(exchange)) return;
            if (!"POST".equalsIgnoreCase(exchange.getRequestMethod())) {
                sendJsonResponse(exchange, 405, "{\"status\": \"error\", \"message\": \"Method not allowed\"}");
                return;
            }

            String body = readRequestBody(exchange);
            Map<String, String> json = parseSimpleJson(body);

            String idStr = json.get("product_id");
            String qtyStr = json.get("quantity");
            String changeType = json.get("change_type"); // 'RESTOCK' or 'ADJUSTMENT'
            String changedBy = json.get("changed_by");
            String notes = json.get("notes");

            if (idStr == null || qtyStr == null || changeType == null) {
                sendJsonResponse(exchange, 400, "{\"status\": \"error\", \"message\": \"Product ID, quantity, and change type required\"}");
                return;
            }

            int prodId = Integer.parseInt(idStr);
            int qtyChanged = Integer.parseInt(qtyStr);
            if (changedBy == null) changedBy = "Staff";
            if (notes == null) notes = "Manual stock update";

            // Query current stock
            String prodRes = DatabaseManager.query("SELECT stock_quantity FROM products WHERE id = ?", "[" + prodId + "]");
            int currentStock = 0;
            try {
                // extract stock_quantity
                int idx = prodRes.indexOf("\"stock_quantity\":");
                if (idx != -1) {
                    int endIdx = prodRes.indexOf(",", idx);
                    if (endIdx == -1) endIdx = prodRes.indexOf("}", idx);
                    currentStock = Integer.parseInt(prodRes.substring(idx + 17, endIdx).trim());
                }
            } catch (Exception ignored) {}

            int newStock = currentStock + qtyChanged;
            if (newStock < 0) {
                sendJsonResponse(exchange, 400, "{\"status\": \"error\", \"message\": \"Stock quantity cannot be reduced below zero.\"}");
                return;
            }

            // Update product stock
            String updateSql = "UPDATE products SET stock_quantity = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?";
            DatabaseManager.execute(updateSql, String.format("[%d, %d]", newStock, prodId));

            // Log stock audit trail
            String logSql = "INSERT INTO stock_logs (product_id, change_type, quantity_changed, previous_stock, new_stock, changed_by, notes) VALUES (?, ?, ?, ?, ?, ?, ?)";
            String logParams = String.format("[%d, \"%s\", %d, %d, %d, \"%s\", \"%s\"]",
                    prodId, DatabaseManager.escapeJson(changeType), qtyChanged, currentStock, newStock,
                    DatabaseManager.escapeJson(changedBy), DatabaseManager.escapeJson(notes));
            DatabaseManager.execute(logSql, logParams);

            sendJsonResponse(exchange, 200, String.format("{\"status\": \"success\", \"message\": \"Stock updated successfully\", \"previous_stock\": %d, \"new_stock\": %d}", currentStock, newStock));
        }
    }

    /**
     * Create Sale Transaction (POS Checkout).
     * Atomic transaction: Checks stock availability, decrements stock, records sale items.
     */
    static class CreateSaleHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            if (!handleCorsAndOptions(exchange)) return;
            if (!"POST".equalsIgnoreCase(exchange.getRequestMethod())) {
                sendJsonResponse(exchange, 405, "{\"status\": \"error\", \"message\": \"Method not allowed\"}");
                return;
            }

            String body = readRequestBody(exchange);
            if (body == null || body.trim().isEmpty()) {
                sendJsonResponse(exchange, 400, "{\"status\": \"error\", \"message\": \"Empty sale transaction payload\"}");
                return;
            }

            // Execute atomic sale via DatabaseManager
            String res = DatabaseManager.executeSaleTransaction(body);
            if (res.contains("\"status\": \"success\"")) {
                sendJsonResponse(exchange, 200, res);
            } else if (res.contains("INSUFFICIENT_STOCK")) {
                sendJsonResponse(exchange, 409, res); // 409 Conflict: Insufficient stock
            } else {
                sendJsonResponse(exchange, 400, res);
            }
        }
    }

    /**
     * List recent sales transactions.
     */
    static class ListSalesHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            if (!handleCorsAndOptions(exchange)) return;
            Map<String, String> queryParams = parseQueryParams(exchange.getRequestURI().getQuery());
            String limitStr = queryParams.get("limit");
            int limit = limitStr != null ? Integer.parseInt(limitStr) : 50;

            String sql = "SELECT id, invoice_number, worker_name, customer_name, total_amount, discount_amount, tax_amount, final_amount, payment_method, sale_date FROM sales ORDER BY id DESC LIMIT ?";
            String res = DatabaseManager.query(sql, "[" + limit + "]");
            sendJsonResponse(exchange, 200, res);
        }
    }

    /**
     * Get sale details and line items for receipt printing.
     */
    static class SaleDetailsHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            if (!handleCorsAndOptions(exchange)) return;
            Map<String, String> queryParams = parseQueryParams(exchange.getRequestURI().getQuery());
            String saleIdStr = queryParams.get("id");
            if (saleIdStr == null) {
                sendJsonResponse(exchange, 400, "{\"status\": \"error\", \"message\": \"Sale ID is required\"}");
                return;
            }

            int saleId = Integer.parseInt(saleIdStr);
            String saleSql = "SELECT * FROM sales WHERE id = ?";
            String saleRes = DatabaseManager.query(saleSql, "[" + saleId + "]");

            String itemsSql = "SELECT * FROM sale_items WHERE sale_id = ?";
            String itemsRes = DatabaseManager.query(itemsSql, "[" + saleId + "]");

            String json = String.format("{\"status\": \"success\", \"sale\": %s, \"items\": %s}", saleRes, itemsRes);
            sendJsonResponse(exchange, 200, json);
        }
    }

    /**
     * Daily Sales Report Handler.
     */
    static class DailyReportHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            if (!handleCorsAndOptions(exchange)) return;
            Map<String, String> queryParams = parseQueryParams(exchange.getRequestURI().getQuery());
            String date = queryParams.get("date");
            if (date == null || date.trim().isEmpty()) {
                date = new SimpleDateFormat("yyyy-MM-dd").format(new Date());
            }

            String summarySql = "SELECT COUNT(id) as total_transactions, " +
                    "COALESCE(SUM(total_amount), 0) as gross_sales, " +
                    "COALESCE(SUM(discount_amount), 0) as total_discounts, " +
                    "COALESCE(SUM(tax_amount), 0) as total_tax, " +
                    "COALESCE(SUM(final_amount), 0) as net_sales " +
                    "FROM sales WHERE DATE(sale_date) = ?";
            String summaryRes = DatabaseManager.query(summarySql, "[\"" + date + "\"]");

            String txSql = "SELECT id, invoice_number, worker_name, customer_name, final_amount, payment_method, sale_date " +
                    "FROM sales WHERE DATE(sale_date) = ? ORDER BY id DESC";
            String txRes = DatabaseManager.query(txSql, "[\"" + date + "\"]");

            String topItemsSql = "SELECT si.product_name, si.category, SUM(si.quantity) as total_qty, SUM(si.subtotal) as total_rev " +
                    "FROM sale_items si JOIN sales s ON si.sale_id = s.id " +
                    "WHERE DATE(s.sale_date) = ? GROUP BY si.product_id ORDER BY total_rev DESC LIMIT 5";
            String topItemsRes = DatabaseManager.query(topItemsSql, "[\"" + date + "\"]");

            String json = String.format("{\"status\": \"success\", \"report_date\": \"%s\", \"summary\": %s, \"transactions\": %s, \"top_items\": %s}",
                    date, summaryRes, txRes, topItemsRes);
            sendJsonResponse(exchange, 200, json);
        }
    }

    /**
     * Product Availability Report.
     */
    static class AvailabilityReportHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            if (!handleCorsAndOptions(exchange)) return;

            String kpiSql = "SELECT COUNT(id) as total_products, " +
                    "COALESCE(SUM(stock_quantity), 0) as total_stock_units, " +
                    "COALESCE(SUM(stock_quantity * price), 0) as total_inventory_value, " +
                    "COALESCE(SUM(CASE WHEN stock_quantity <= low_stock_threshold THEN 1 ELSE 0 END), 0) as low_stock_items, " +
                    "COALESCE(SUM(CASE WHEN stock_quantity = 0 THEN 1 ELSE 0 END), 0) as out_of_stock_items " +
                    "FROM products";
            String kpis = DatabaseManager.query(kpiSql, "[]");

            String catSql = "SELECT category, COUNT(id) as product_count, SUM(stock_quantity) as total_stock, SUM(stock_quantity * price) as category_value " +
                    "FROM products GROUP BY category ORDER BY category_value DESC";
            String catBreakdown = DatabaseManager.query(catSql, "[]");

            String json = String.format("{\"status\": \"success\", \"kpis\": %s, \"categories\": %s}", kpis, catBreakdown);
            sendJsonResponse(exchange, 200, json);
        }
    }

    /**
     * Low-Stock Items Report.
     */
    static class LowStockReportHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            if (!handleCorsAndOptions(exchange)) return;

            String sql = "SELECT id, product_code, name, category, price, stock_quantity, low_stock_threshold, " +
                    "(low_stock_threshold - stock_quantity) as deficit_units, " +
                    "CASE WHEN stock_quantity <= 3 THEN 'CRITICAL' WHEN stock_quantity <= low_stock_threshold THEN 'LOW' ELSE 'OK' END as alert_level " +
                    "FROM products WHERE stock_quantity <= low_stock_threshold ORDER BY stock_quantity ASC";
            String res = DatabaseManager.query(sql, "[]");
            sendJsonResponse(exchange, 200, res);
        }
    }

    /**
     * Dynamic Python Analytics Execution Handler.
     */
    static class AnalyticsHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            if (!handleCorsAndOptions(exchange)) return;
            if (!"POST".equalsIgnoreCase(exchange.getRequestMethod())) {
                sendJsonResponse(exchange, 405, "{\"status\": \"error\", \"message\": \"Method not allowed\"}");
                return;
            }

            String body = readRequestBody(exchange);
            if (body == null || body.trim().isEmpty()) {
                body = "{\"type\": \"daily_trend\"}";
            }

            // Run Python Analytics Engine
            String result = PythonAnalyticsBridge.runDynamicAnalysis(body);
            sendJsonResponse(exchange, 200, result);
        }
    }

    // =========================================================================
    // STATIC FILE HANDLER & UTILITIES
    // =========================================================================

    static class StaticFileHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            String path = exchange.getRequestURI().getPath();
            if ("/".equals(path) || path.isEmpty()) {
                path = "/index.html";
            }

            // Normalize path
            if (path.startsWith("/")) {
                path = path.substring(1);
            }

            File targetFile = new File(webRootDir, path);
            // Security check to avoid path traversal
            if (!targetFile.getCanonicalPath().startsWith(webRootDir.getCanonicalPath())) {
                sendJsonResponse(exchange, 403, "{\"status\": \"error\", \"message\": \"Forbidden\"}");
                return;
            }

            if (!targetFile.exists() || targetFile.isDirectory()) {
                // Fallback to index.html for SPA if not found
                File indexFile = new File(webRootDir, "index.html");
                if (indexFile.exists()) {
                    serveFile(exchange, indexFile);
                } else {
                    sendJsonResponse(exchange, 404, "{\"status\": \"error\", \"message\": \"File not found: " + path + "\"}");
                }
                return;
            }

            serveFile(exchange, targetFile);
        }

        private void serveFile(HttpExchange exchange, File file) throws IOException {
            String mimeType = getMimeType(file.getName());
            exchange.getResponseHeaders().set("Content-Type", mimeType);
            exchange.getResponseHeaders().set("Cache-Control", "no-cache, no-store, must-revalidate");

            byte[] bytes = Files.readAllBytes(file.toPath());
            exchange.sendResponseHeaders(200, bytes.length);
            try (OutputStream os = exchange.getResponseBody()) {
                os.write(bytes);
            }
        }

        private String getMimeType(String fileName) {
            String lower = fileName.toLowerCase();
            if (lower.endsWith(".html") || lower.endsWith(".htm")) return "text/html; charset=UTF-8";
            if (lower.endsWith(".css")) return "text/css; charset=UTF-8";
            if (lower.endsWith(".js")) return "application/javascript; charset=UTF-8";
            if (lower.endsWith(".json")) return "application/json; charset=UTF-8";
            if (lower.endsWith(".png")) return "image/png";
            if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
            if (lower.endsWith(".svg")) return "image/svg+xml";
            if (lower.endsWith(".ico")) return "image/x-icon";
            return "text/plain; charset=UTF-8";
        }
    }

    private static boolean handleCorsAndOptions(HttpExchange exchange) throws IOException {
        exchange.getResponseHeaders().set("Access-Control-Allow-Origin", "*");
        exchange.getResponseHeaders().set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
        exchange.getResponseHeaders().set("Access-Control-Allow-Headers", "Content-Type, Authorization");

        if ("OPTIONS".equalsIgnoreCase(exchange.getRequestMethod())) {
            exchange.sendResponseHeaders(204, -1);
            return false;
        }
        return true;
    }

    private static void sendJsonResponse(HttpExchange exchange, int statusCode, String responseJson) throws IOException {
        exchange.getResponseHeaders().set("Content-Type", "application/json; charset=UTF-8");
        exchange.getResponseHeaders().set("Access-Control-Allow-Origin", "*");
        byte[] bytes = responseJson.getBytes(StandardCharsets.UTF_8);
        exchange.sendResponseHeaders(statusCode, bytes.length);
        try (OutputStream os = exchange.getResponseBody()) {
            os.write(bytes);
        }
    }

    private static String readRequestBody(HttpExchange exchange) throws IOException {
        try (InputStream is = exchange.getRequestBody();
             ByteArrayOutputStream baos = new ByteArrayOutputStream()) {
            byte[] buf = new byte[4096];
            int n;
            while ((n = is.read(buf)) != -1) {
                baos.write(buf, 0, n);
            }
            return baos.toString(StandardCharsets.UTF_8);
        }
    }

    private static Map<String, String> parseQueryParams(String query) {
        Map<String, String> map = new HashMap<>();
        if (query == null || query.isEmpty()) return map;
        String[] pairs = query.split("&");
        for (String pair : pairs) {
            int idx = pair.indexOf("=");
            try {
                if (idx > 0) {
                    String k = URLDecoder.decode(pair.substring(0, idx), "UTF-8");
                    String v = URLDecoder.decode(pair.substring(idx + 1), "UTF-8");
                    map.put(k, v);
                } else if (!pair.isEmpty()) {
                    map.put(URLDecoder.decode(pair, "UTF-8"), "");
                }
            } catch (UnsupportedEncodingException ignored) {}
        }
        return map;
    }

    /**
     * Parses simple flat JSON string into key-value map.
     */
    private static Map<String, String> parseSimpleJson(String json) {
        Map<String, String> map = new HashMap<>();
        if (json == null) return map;
        json = json.trim();
        if (json.startsWith("{") && json.endsWith("}")) {
            json = json.substring(1, json.length() - 1);
        }

        // Tokenize top-level keys
        boolean inQuotes = false;
        StringBuilder currentKey = new StringBuilder();
        StringBuilder currentValue = new StringBuilder();
        boolean parsingKey = true;

        for (int i = 0; i < json.length(); i++) {
            char c = json.charAt(i);

            if (c == '\"') {
                inQuotes = !inQuotes;
                continue;
            }

            if (!inQuotes) {
                if (c == ':') {
                    parsingKey = false;
                    continue;
                }
                if (c == ',') {
                    String k = currentKey.toString().trim();
                    String v = currentValue.toString().trim();
                    if (!k.isEmpty()) {
                        map.put(k, v);
                    }
                    currentKey.setLength(0);
                    currentValue.setLength(0);
                    parsingKey = true;
                    continue;
                }
            }

            if (parsingKey) {
                currentKey.append(c);
            } else {
                currentValue.append(c);
            }
        }

        String k = currentKey.toString().trim();
        String v = currentValue.toString().trim();
        if (!k.isEmpty()) {
            map.put(k, v);
        }

        return map;
    }
}
