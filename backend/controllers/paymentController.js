import Razorpay from "razorpay";
import Invoice from "../models/invoiceModel.js";

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

/* ---------------- CREATE ORDER ---------------- */

export const createOrder = async (req, res) => {
  try {
    const { invoiceId } = req.body;

    if (!invoiceId) {
      return res.status(400).json({
        success: false,
        message: "Invoice ID is required",
      });
    }

    const invoice = await Invoice.findById(invoiceId);

    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: "Invoice not found",
      });
    }

    /* -------- BLOCK IF ALREADY FULLY PAID -------- */

    if (invoice.status === "paid") {
      return res.status(400).json({
        success: false,
        message: "Invoice is already fully paid",
      });
    }

    /* -------- CALCULATE CORRECT REMAINING AMOUNT -------- */

    // Always calculate fresh from total - paidAmount
    const correctRemaining = Math.max(
      (invoice.total || 0) - (invoice.paidAmount || 0),
      0
    );

    const amount = correctRemaining > 0 ? correctRemaining : invoice.total;

    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid payment amount",
      });
    }

    /* -------- CREATE RAZORPAY ORDER -------- */

    const order = await razorpay.orders.create({
      amount: Math.round(Number(amount) * 100),
      currency: "INR",
      receipt: `invoice_${invoice._id}`,
    });

    res.json({
      success: true,
      order,
      remainingAmount: amount, // ✅ send to frontend so it knows exact amount
    });

  } catch (error) {
    console.error("Create Order Error:", error);

    res.status(500).json({
      success: false,
      message: "Payment initialization failed",
    });
  }
};

/* ---------------- UPDATE PAYMENT ---------------- */

export const updatePayment = async (req, res) => {
  try {
    const { invoiceId, amount } = req.body;

    if (!invoiceId || !amount) {
      return res.status(400).json({
        success: false,
        message: "Invoice ID and amount required",
      });
    }

    const invoice = await Invoice.findById(invoiceId);

    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: "Invoice not found",
      });
    }

    /* -------- BLOCK IF ALREADY FULLY PAID -------- */

    if (invoice.status === "paid") {
      return res.status(400).json({
        success: false,
        message: "Invoice is already fully paid",
      });
    }

    /* -------- UPDATE PAID AMOUNT -------- */

    invoice.paidAmount = (invoice.paidAmount || 0) + Number(amount);

    // pre("save") hook will auto-calculate remainingAmount and status
    await invoice.save();

    res.json({
      success: true,
      invoice,
    });

  } catch (error) {
    console.error("Payment Update Error:", error);

    res.status(500).json({
      success: false,
      message: "Payment update failed",
    });
  }
};