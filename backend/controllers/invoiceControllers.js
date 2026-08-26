import mongoose from "mongoose";
import Razorpay from "razorpay";
import Invoice from "../models/invoiceModel.js";

/* =========================================================
   RAZORPAY
========================================================= */

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

/* =========================================================
   HELPERS
========================================================= */

function computeTotals(items = [], taxPercent = 0) {
  const subtotal = items.reduce((sum, item) => {
    const qty = Number(item.qty) || 0;
    const unitPrice = Number(item.unitPrice) || 0;

    return sum + qty * unitPrice;
  }, 0);

  const taxRate = Number(taxPercent) || 0;

  const tax = (subtotal * taxRate) / 100;

  return {
    subtotal: Number(subtotal.toFixed(2)),
    tax: Number(tax.toFixed(2)),
    total: Number((subtotal + tax).toFixed(2)),
  };
}

function generateInvoiceNumber() {
  const timestamp = Date.now().toString(36).toUpperCase();

  const random = Math.random()
    .toString(36)
    .substring(2, 6)
    .toUpperCase();

  return `INV-${timestamp}-${random}`;
}

/* =========================================================
   CREATE INVOICE
========================================================= */

export async function createInvoice(req, res) {
  try {
    const userId = req.auth?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "User not authenticated",
      });
    }

    const body = req.body || {};

    const items = Array.isArray(body.items)
      ? body.items.map((item) => ({
          description: item.description || "",
          qty: Number(item.qty) || 1,
          unitPrice: Number(item.unitPrice) || 0,
        }))
      : [];

    if (items.length === 0) {
      return res.status(400).json({
        success: false,
        message: "At least one invoice item is required",
      });
    }

    const taxPercent = Number(body.taxPercent) || 0;

    const totals = computeTotals(items, taxPercent);

    const invoiceData = {
      ...body,

      owner: userId,

      items,

      taxPercent,

      invoiceNumber:
        typeof body.invoiceNumber === "string" &&
        body.invoiceNumber.trim()
          ? body.invoiceNumber.trim()
          : generateInvoiceNumber(),

      ...totals,
    };

    const invoice = await Invoice.create(invoiceData);

    return res.status(201).json({
      success: true,
      data: invoice,
    });
  } catch (err) {
    console.error("Create Invoice Error:", err);

    if (err.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "Duplicate invoice number",
      });
    }

    return res.status(500).json({
      success: false,
      message: err.message || "Failed to create invoice",
    });
  }
}

/* =========================================================
   GET ALL INVOICES
========================================================= */

export async function getInvoices(req, res) {
  try {
    const userId = req.auth?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const { invoiceNumber } = req.query;

    const query = {
      owner: userId,
    };

    if (invoiceNumber) {
      query.invoiceNumber = {
        $regex: invoiceNumber,
        $options: "i",
      };
    }

    const invoices = await Invoice.find(query)
      .sort({ createdAt: -1 })
      .lean();

    return res.json({
      success: true,
      count: invoices.length,
      data: invoices,
    });
  } catch (err) {
    console.error("getInvoices error:", err);

    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
}

/* =========================================================
   GET SINGLE INVOICE
========================================================= */

export async function getInvoiceById(req, res) {
  try {
    const userId = req.auth?.userId;
    const id = req.params.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    let query = {
      owner: userId,
      invoiceNumber: id,
    };

    if (mongoose.Types.ObjectId.isValid(id)) {
      query = {
        owner: userId,
        $or: [
          {
            _id: id,
          },
          {
            invoiceNumber: id,
          },
        ],
      };
    }

    const invoice = await Invoice.findOne(query);

    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: "Invoice not found",
      });
    }

    return res.json({
      success: true,
      data: invoice,
    });
  } catch (err) {
    console.error("GET invoice error:", err);

    return res.status(500).json({
      success: false,
      message: "Error fetching invoice",
    });
  }
}

/* =========================================================
   UPDATE INVOICE
========================================================= */

export async function updateInvoice(req, res) {
  try {
    const userId = req.auth?.userId;
    const id = req.params.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    let updateData = {
      ...req.body,
    };

    /* -----------------------------------------------------
       NORMALIZE ITEMS
    ----------------------------------------------------- */

    if (Array.isArray(updateData.items)) {
      updateData.items = updateData.items.map((item) => ({
        description: item.description || "",
        qty: Number(item.qty) || 1,
        unitPrice: Number(item.unitPrice) || 0,
      }));
    }

    /* -----------------------------------------------------
       RECALCULATE TOTALS
    ----------------------------------------------------- */

    if (
      Array.isArray(updateData.items) ||
      updateData.taxPercent !== undefined
    ) {
      const items = Array.isArray(updateData.items)
        ? updateData.items
        : [];

      const taxPercent = Number(updateData.taxPercent) || 0;

      const totals = computeTotals(items, taxPercent);

      updateData = {
        ...updateData,
        taxPercent,
        ...totals,
      };
    }

    /* -----------------------------------------------------
       FIND INVOICE
    ----------------------------------------------------- */

    let query = {
      owner: userId,
      invoiceNumber: id,
    };

    if (mongoose.Types.ObjectId.isValid(id)) {
      query = {
        owner: userId,
        $or: [
          {
            _id: id,
          },
          {
            invoiceNumber: id,
          },
        ],
      };
    }

    const updated = await Invoice.findOneAndUpdate(
      query,
      updateData,
      {
        new: true,
        runValidators: true,
      }
    );

    if (!updated) {
      return res.status(404).json({
        success: false,
        message: "Invoice not found",
      });
    }

    /* -----------------------------------------------------
       RAZORPAY ORDER
    ----------------------------------------------------- */

    if (updated.total > 0) {
      try {
        const order = await razorpay.orders.create({
          amount: Math.round(updated.total * 100),
          currency: "INR",
          receipt: updated.invoiceNumber,
        });

        updated.razorpayOrderId = order.id;

        await updated.save();
      } catch (razorpayError) {
        console.error("Razorpay order creation error:", razorpayError);

        return res.status(500).json({
          success: false,
          message: "Invoice updated but Razorpay order creation failed",
          invoice: updated,
        });
      }
    }

    return res.json({
      success: true,
      data: updated,
    });
  } catch (err) {
    console.error("Update invoice error:", err);

    return res.status(500).json({
      success: false,
      message: err.message || "Failed to update invoice",
    });
  }
}

/* =========================================================
   DELETE INVOICE
========================================================= */

export async function deleteInvoice(req, res) {
  try {
    const userId = req.auth?.userId;
    const id = req.params.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    let invoice = null;

    /* -----------------------------------------------------
       DELETE BY OBJECT ID
    ----------------------------------------------------- */

    if (mongoose.Types.ObjectId.isValid(id)) {
      invoice = await Invoice.findOneAndDelete({
        _id: id,
        owner: userId,
      });
    }

    /* -----------------------------------------------------
       DELETE BY INVOICE NUMBER
    ----------------------------------------------------- */

    if (!invoice) {
      invoice = await Invoice.findOneAndDelete({
        invoiceNumber: id,
        owner: userId,
      });
    }

    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: "Invoice not found",
      });
    }

    return res.json({
      success: true,
      message: "Invoice deleted successfully",
    });
  } catch (err) {
    console.error("Delete invoice error:", err);

    return res.status(500).json({
      success: false,
      message: "Error deleting invoice",
    });
  }
}