import mongoose from "mongoose";
import Invoice from "../models/invoiceModel.js";

/* helper */
function computeTotals(items = [], taxPercent = 0) {
  const subtotal = items.reduce(
    (s, it) => s + (Number(it.qty) || 0) * (Number(it.unitPrice) || 0),
    0
  );

  const tax = (subtotal * Number(taxPercent)) / 100;

  return {
    subtotal: Number(subtotal.toFixed(2)),
    tax: Number(tax.toFixed(2)),
    total: Number((subtotal + tax).toFixed(2)),
  };
}

/* CREATE */
export async function createInvoice(req, res) {
  try {
   const { userId } = req.auth;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "User not authenticated",
      });
    }

    const body = req.body;
    const items = Array.isArray(body.items) ? body.items : [];

    const totals = computeTotals(items, body.taxPercent || 0);

    const invoiceData = {
      ...body,
      owner: userId,
      invoiceNumber: body.invoiceNumber || `INV-${Date.now()}`,
      ...totals,
    };

    const invoice = await Invoice.create(invoiceData);

    res.status(201).json({
      success: true,
      data: invoice,
    });

  } catch (err) {
    console.error("Create Error:", err);

    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
}

/* LIST */
export async function getInvoices(req, res) {
  try {
    const { userId } = req.auth;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const { invoiceNumber } = req.query;

    let query = { owner: userId };

    if (invoiceNumber) {
      query.invoiceNumber = { $regex: invoiceNumber, $options: "i" };
    }

    const invoices = await Invoice.find(query)
      .sort({ createdAt: -1 })
      .lean();

    res.json({
      success: true,
      count: invoices.length,
      data: invoices,
    });

  } catch (err) {
    console.error("getInvoices error:", err);

    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
}

/* GET ONE */
export async function getInvoiceById(req, res) {
  try {
    const { userId } = req.auth;
    const id = req.params.id;

    let query = {
      owner: userId,
      invoiceNumber: id,
    };

    if (mongoose.Types.ObjectId.isValid(id)) {
      query = {
        owner: userId,
        $or: [
          { _id: id },
          { invoiceNumber: id },
        ],
      };
    }

    const inv = await Invoice.findOne(query);

    if (!inv) {
      return res.status(404).json({
        success: false,
        message: "Invoice not found",
      });
    }

    res.json({
      success: true,
      data: inv,
    });

  } catch (err) {
    console.error("GET invoice error:", err);

    res.status(500).json({
      success: false,
      message: "Error fetching invoice",
    });
  }
}

/* UPDATE */
export async function updateInvoice(req, res) {
  try {
    const { userId } = req.auth;h();
    const id = req.params.id;

    let updateData = { ...req.body };

    if (updateData.items || updateData.taxPercent !== undefined) {
      const totals = computeTotals(
        updateData.items || [],
        updateData.taxPercent || 0
      );

      updateData = { ...updateData, ...totals };
    }

    let query = {
      owner: userId,
      invoiceNumber: id,
    };

    if (mongoose.Types.ObjectId.isValid(id)) {
      query = {
        owner: userId,
        $or: [
          { _id: id },
          { invoiceNumber: id },
        ],
      };
    }

    const updated = await Invoice.findOneAndUpdate(
      query,
      updateData,
      { new: true, runValidators: true }
    );

    if (!updated) {
      return res.status(404).json({
        success: false,
        message: "Invoice not found",
      });
    }

    res.json({
      success: true,
      data: updated,
    });

  } catch (err) {
    console.error("Update invoice error:", err);

    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
}

/* DELETE */
export async function deleteInvoice(req, res) {
  try {
    const { userId } = req.auth;
    const id = req.params.id;

    let invoice = null;

    if (mongoose.Types.ObjectId.isValid(id)) {
      invoice = await Invoice.findOneAndDelete({
        _id: id,
        owner: userId,
      });
    }

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

    res.json({
      success: true,
      message: "Invoice deleted successfully",
    });

  } catch (err) {
    console.error("Delete invoice error:", err);

    res.status(500).json({
      success: false,
      message: "Error deleting invoice",
    });
  }
}