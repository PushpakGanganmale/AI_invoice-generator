import Razorpay from "razorpay";
import Invoice from "../models/invoiceModel.js";

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

export const createOrder = async (req, res) => {
  try {

    const { invoiceId } = req.body;

    const invoice = await Invoice.findById(invoiceId);

    if (!invoice) {
      return res.status(404).json({ message: "Invoice not found" });
    }

    const amount = invoice.remainingAmount || invoice.total;

    const order = await razorpay.orders.create({
      amount: Number(amount) * 100,
      currency: "INR",
      receipt: `invoice_${invoice._id}`,
    });

    res.json({
      success: true,
      order,
    });

  } catch (error) {
    console.error("Create Order Error:", error);
    res.status(500).json({ message: "Payment failed" });
  }
};
export const updatePayment = async (req, res) => {
  try {

    const { invoiceId, amount } = req.body;

    const invoice = await Invoice.findById(invoiceId);

    if (!invoice) {
      return res.status(404).json({ message: "Invoice not found" });
    }

    invoice.paidAmount += Number(amount);

    invoice.remainingAmount = invoice.total - invoice.paidAmount;

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
    console.error(error);
    res.status(500).json({ message: "Payment update failed" });
  }
};