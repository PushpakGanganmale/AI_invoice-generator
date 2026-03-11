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

    /* -------- CALCULATE PAYMENT AMOUNT -------- */

    let amount = invoice.remainingAmount || invoice.total;

    if (!amount || amount <= 0) {
      const subtotal = (invoice.items || []).reduce(
        (sum, item) => sum + (item.qty || 0) * (item.unitPrice || 0),
        0
      );

      const tax = (subtotal * (invoice.taxPercent || 0)) / 100;

      amount = subtotal + tax;
    }

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

    invoice.paidAmount = (invoice.paidAmount || 0) + Number(amount);

    invoice.remainingAmount = Math.max(
      invoice.total - invoice.paidAmount,
      0
    );

    if (invoice.remainingAmount <= 0) {
      invoice.status = "paid";
    } else {
      invoice.status = "partially_paid";
    }

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