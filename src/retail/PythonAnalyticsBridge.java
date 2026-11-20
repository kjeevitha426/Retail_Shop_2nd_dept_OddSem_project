package retail;

import java.io.BufferedReader;
import java.io.File;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

/**
 * PythonAnalyticsBridge executes the Python Analytics Engine with dynamic inputs
 * and returns the preprocessed KPIs, table breakdown, and Matplotlib Base64 visualization.
 */
public class PythonAnalyticsBridge {

    private static String pythonCmd = "python";
    private static File analyticsScriptFile;

    static {
        File currentDir = new File(System.getProperty("user.dir"));
        File candidate1 = new File(currentDir, "python" + File.separator + "analytics_engine.py");
        File candidate2 = new File(currentDir.getParentFile(), "python" + File.separator + "analytics_engine.py");

        if (candidate1.exists()) {
            analyticsScriptFile = candidate1;
        } else if (candidate2.exists()) {
            analyticsScriptFile = candidate2;
        } else {
            analyticsScriptFile = new File("python/analytics_engine.py");
        }
    }

    public static void setPythonCommand(String cmd) {
        pythonCmd = cmd;
    }

    /**
     * Executes Python analytics engine passing JSON configuration via arguments.
     * @param jsonInput Dynamic parameters (type, product_id, category, from_date, to_date)
     * @return JSON response string with chart_base64 and analytical insights
     */
    public static String runDynamicAnalysis(String jsonInput) {
        try {
            ProcessBuilder pb = new ProcessBuilder(
                    pythonCmd,
                    analyticsScriptFile.getAbsolutePath()
            );
            pb.redirectErrorStream(false);
            Process process = pb.start();

            try (OutputStream os = process.getOutputStream()) {
                os.write(jsonInput.getBytes(StandardCharsets.UTF_8));
                os.flush();
            }

            // Read stdout
            StringBuilder sb = new StringBuilder();
            try (BufferedReader reader = new BufferedReader(new InputStreamReader(process.getInputStream(), StandardCharsets.UTF_8))) {
                String line;
                while ((line = reader.readLine()) != null) {
                    sb.append(line);
                }
            }

            // Read stderr in case of errors
            StringBuilder errSb = new StringBuilder();
            try (BufferedReader errReader = new BufferedReader(new InputStreamReader(process.getErrorStream(), StandardCharsets.UTF_8))) {
                String line;
                while ((line = errReader.readLine()) != null) {
                    errSb.append(line).append("\n");
                }
            }

            int exitCode = process.waitFor();
            String response = sb.toString().trim();

            if (exitCode != 0 || response.isEmpty()) {
                if (!response.isEmpty() && response.startsWith("{") && response.endsWith("}")) {
                    return response;
                }

                String errMsg = errSb.toString().trim();
                if (errMsg.isEmpty()) {
                    errMsg = response;
                }
                return "{\"status\": \"error\", \"message\": \"Python analytics error (exit code " + exitCode + "): " + DatabaseManager.escapeJson(errMsg) + "\"}";
            }

            return response;

        } catch (Exception e) {
            e.printStackTrace();
            return "{\"status\": \"error\", \"message\": \"Failed to run Python analytics engine: " + DatabaseManager.escapeJson(e.getMessage()) + "\"}";
        }
    }
}
