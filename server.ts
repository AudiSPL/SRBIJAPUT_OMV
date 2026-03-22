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

  // Gmail Configuration
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  });

  const sendDailySummary = async (toEmail?: string) => {
    console.log("Triggering summary email...");
    try {
      // Fetch data from Google Sheets
      const sheetUrl = "https://docs.google.com/spreadsheets/d/1taPBLXDC4KEjyzQ5K8lJ_amB15Fa0azraEc_XEcaa_E/export?format=csv&gid=0";
      const response = await fetch(sheetUrl);
      const csvData = await response.text();

      // Simple summary calculation
      const lines = csvData.split("\n").slice(1);
      let totalSpend = 0;
      lines.forEach(line => {
        const parts = line.split(",");
        if (parts.length > 1) {
          totalSpend += parseFloat(parts[1]) || 0;
        }
      });

      const mailOptions = {
        from: process.env.GMAIL_USER,
        to: toEmail || "milossavin@gmail.com",
        subject: `SrbijaPut Fleet - Dnevni Izveštaj - ${new Date().toLocaleDateString()}`,
        html: `
          <div style="font-family: sans-serif; padding: 20px; color: #333;">
            <h2 style="color: #3b82f6;">SrbijaPut OMV Fleet Intelligence</h2>
            <p>Pregled potrošnje za današnji dan:</p>
            <div style="background: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
              <p style="margin: 0; font-size: 14px; color: #666;">Ukupna potrošnja</p>
              <h1 style="margin: 5px 0; color: #111;">${new Intl.NumberFormat('sr-RS', { style: 'currency', currency: 'RSD' }).format(totalSpend)}</h1>
            </div>
            <p>Za detaljniji pregled, posetite <a href="${process.env.APP_URL || '#'}" style="color: #3b82f6;">Dashboard</a>.</p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
            <p style="font-size: 12px; color: #999;">Ovo je automatski generisan izveštaj.</p>
          </div>
        `,
      };

      await transporter.sendMail(mailOptions);
      console.log("Email sent successfully!");
    } catch (error) {
      console.error("Error sending email:", error);
    }
  };

  // Schedule daily email at 8:00 AM
  cron.schedule("0 8 * * *", () => {
    sendDailySummary();
  });

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  app.post("/api/send-summary", async (req, res) => {
    const { email } = req.body;
    await sendDailySummary(email);
    res.json({ message: "Email sent" });
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
