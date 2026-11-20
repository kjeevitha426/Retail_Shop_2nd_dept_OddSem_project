package retail;

import java.io.BufferedReader;
import java.io.File;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;

/**
 * DatabaseManager handles database operations for the Retail Store System.
 * Interfaces with SQLite / DBMS via the high-speed Python DB Interop Bridge.
 */
public class DatabaseManager {

    private static String pythonCmd = "python";
    private static File dbHelperFile;

    static {
        // Detect paths relative to project root
        File currentDir = new File(System.getProperty("user.dir"));
        File candidate1 = new File(currentDir, "python" + File.separator + "db_helper.py");
        File candidate2 = new File(currentDir.getParentFile(), "python" + File.separator + "db_helper.py");

        if (candidate1.exists()) {
            dbHelperFile = candidate1;
        } else if (candidate2.exists()) {
            dbHelperFile = candidate2;
        } else {
            // Default fallback
            dbHelperFile = new File("python/db_helper.py");
        }
    }

    public static void setPythonCommand(String cmd) {
        pythonCmd = cmd;
    }

    /**
     * Executes a JSON request against db_helper.py and returns JSON response string.
     */
    public static String executeBridge(String requestJson) {
        try {
            ProcessBuilder pb = new ProcessBuilder(pythonCmd, dbHelperFile.getAbsolutePath());
            pb.redirectErrorStream(false);
            Process process = pb.start();

            // Write request JSON to stdin
            try (OutputStream os = process.getOutputStream()) {
                os.write(requestJson.getBytes(StandardCharsets.UTF_8));
                os.flush();
            }

            // Read response from stdout
            StringBuilder sb = new StringBuilder();
            try (BufferedReader reader = new BufferedReader(new InputStreamReader(process.getInputStream(), StandardCharsets.UTF_8))) {
                String line;
                while ((line = reader.readLine()) != null) {
                    sb.append(line);
                }
            }

            process.waitFor();
            String response = sb.toString().trim();
            if (response.isEmpty()) {
                return "{\"status\": \"error\", \"message\": \"Empty response from database engine\"}";
            }
            return response;

        } catch (Exception e) {
            e.printStackTrace();
            return "{\"status\": \"error\", \"message\": \"Database execution error: " + escapeJson(e.getMessage()) + "\"}";
        }
    }

    /**
     * Executes a SELECT query and returns JSON array of rows.
     */
    public static String query(String sql, String paramsJson) {
        if (paramsJson == null || paramsJson.trim().isEmpty()) {
            paramsJson = "[]";
        }
        String payload = "{\"action\": \"query\", \"sql\": \"" + escapeJson(sql) + "\", \"params\": " + paramsJson + "}";
        return executeBridge(payload);
    }

    /**
     * Executes an INSERT / UPDATE / DELETE statement.
     */
    public static String execute(String sql, String paramsJson) {
        if (paramsJson == null || paramsJson.trim().isEmpty()) {
            paramsJson = "[]";
        }
        String payload = "{\"action\": \"execute\", \"sql\": \"" + escapeJson(sql) + "\", \"params\": " + paramsJson + "}";
        return executeBridge(payload);
    }

    /**
     * Executes an atomic sale transaction with real-time stock availability check.
     */
    public static String executeSaleTransaction(String salePayloadJson) {
        String payload = "{\"action\": \"sale_transaction\", \"payload\": " + salePayloadJson + "}";
        return executeBridge(payload);
    }

    /**
     * Utility to hash passwords with SHA-256 for secure user authentication.
     */
    public static String hashPassword(String password) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] bytes = md.digest(password.getBytes(StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder();
            for (byte b : bytes) {
                sb.append(String.format("%02x", b));
            }
            return sb.toString();
        } catch (Exception e) {
            return Integer.toHexString(password.hashCode());
        }
    }

    public static String escapeJson(String s) {
        if (s == null) return "";
        return s.replace("\\", "\\\\")
                .replace("\"", "\\\"")
                .replace("\b", "\\b")
                .replace("\f", "\\f")
                .replace("\n", "\\n")
                .replace("\r", "\\r")
                .replace("\t", "\\t");
    }
}
