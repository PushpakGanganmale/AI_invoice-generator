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

    console.log("Create order request for invoice:", invoiceId);

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

    const amount = invoice.remainingAmount ?? invoice.total;

    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid payment amount",
      });
    }

    const order = await razorpay.orders.create({
      amount: Math.round(Number(amount) * 100),
      currency: "INR",
      receipt: `invoice_${invoice._id}`,
    });

    console.log("Razorpay order created:", order.id);

    res.json({
      success: true,
      order,
    });

  } catch (error) {
    console.error("Create Order Error:", error);

    res.status(500).json({
      success: false,
      message: "Payment initialization failed",
      error: error.message,
    });
  }
};

/* ---------------- UPDATE PAYMENT ---------------- */

export const updatePayment = async (req, res) => {
  try {
    const { invoiceId, amount } = req.body;

    console.log("Update payment:", invoiceId, amount);

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

    invoice.remainingAmount = invoice.total - invoice.paidAmount;

    invoice.status =
      invoice.remainingAmount <= 0 ? "paid" : "partially_paid";

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
      error: error.message,
    });
  }
};