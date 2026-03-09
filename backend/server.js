import express from "express";
import cors from "cors";
import "dotenv/config";
import path from "path";

import { clerkMiddleware, requireAuth } from "@clerk/express";

import { connectDB } from "./config/db.js";

import invoiceRouter from "./routes/invoiceRouter.js";
import bussinessProfileRouter from "./routes/bussinessProfileRouter.js";
import aiInvoiceRouter from "./routes/aiInvoiceRouter.js";

const app = express();
const port = process.env.PORT || 4000;

/* ---------------- MIDDLEWARE ---------------- */

app.use(
  cors({
    origin: "http://localhost:5173",
    credentials: true,
  })
);

app.use(express.json({ limit: "20mb" }));
app.use(express.urlencoded({ extended: true, limit: "20mb" }));

app.use(clerkMiddleware());

/* ---------------- STATIC FILES ---------------- */

app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

/* ---------------- TEST ROUTES ---------------- */

app.get("/", (req, res) => {
  res.send("API Working");
});

app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

/* ---------------- API ROUTES ---------------- */

app.use("/api/invoices", requireAuth(), invoiceRouter);

app.use("/api/business-profile", requireAuth(), bussinessProfileRouter);

app.use("/api/ai-invoices", requireAuth(), aiInvoiceRouter);

/* ---------------- START SERVER ---------------- */

const startServer = async () => {
  try {
    await connectDB();

    app.listen(port, () => {
      console.log(`🚀 Server running on http://localhost:${port}`);
    });

  } catch (err) {
    console.error("Server start error:", err);
  }
};

startServer();