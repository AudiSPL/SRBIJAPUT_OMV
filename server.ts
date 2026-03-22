import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import cron from "node-cron";
import nodemailer from "nodemailer";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Mock Email Automation Logic
  // In a real app, you'd use a service like Resend or SendGrid
  const sendDailySummary = async () => {
    console.log("Triggering daily summary email at 08:00 AM...");
    // Logic to fetch data, generate HTML, and send via nodemailer
    // const transporter = nodemailer.createTransport({...});
    // await transporter.sendMail({...});
  };

  // Schedule daily email at 8:00 AM
  cron.schedule("0 8 * * *", () => {
    sendDailySummary();
  });

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Proxy endpoint for Google Sheets CSV to avoid CORS issues if any
  app.get("/api/data", async (req, res) => {
    try {
      const sheetUrl = "https://docs.google.com/spreadsheets/d/1taPBLXDC4KEjyzQ5K8lJ_amB15Fa0azraEc_XEcaa_E/export?format=csv&gid=0";
      const response = await fetch(sheetUrl);
      if (!response.ok) throw new Error("Failed to fetch sheet data");
      const csvData = await response.text();
      res.header("Content-Type", "text/csv");
      res.send(csvData);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
