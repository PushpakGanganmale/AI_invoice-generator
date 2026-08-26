import express from "express";
import Groq from "groq-sdk";
import dotenv from "dotenv";

dotenv.config();

const router = express.Router();

/* =========================================================
   GROQ CONFIGURATION
========================================================= */

if (!process.env.GROQ_API_KEY) {
  console.warn("WARNING: GROQ_API_KEY is not configured");
}

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

/* =========================================================
   POST /generate
========================================================= */

router.post("/generate", async (req, res) => {
  try {
    const { prompt } = req.body;

    /* -----------------------------------------------------
       VALIDATE INPUT
    ----------------------------------------------------- */

    if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
      return res.status(400).json({
        success: false,
        message: "Prompt is required",
      });
    }

    /* -----------------------------------------------------
       AI PROMPT
    ----------------------------------------------------- */

    const userPrompt = `
You are an invoice data extraction system.

Convert the user's natural-language invoice request into structured invoice data.

Return ONLY valid JSON.

Do NOT return:
- Markdown
- Code blocks
- Explanations
- Comments
- Extra text

Return EXACTLY this structure:

{
  "client": {
    "name": "",
    "email": "",
    "address": "",
    "phone": ""
  },
  "items": [
    {
      "description": "",
      "qty": 1,
      "unitPrice": 0
    }
  ],
  "taxPercent": 18
}

RULES:

1. Extract the customer/client name if provided.
2. Extract email if provided.
3. Extract phone number if provided.
4. Extract address if provided.
5. Extract every product or service separately.
6. Never put the entire user sentence into "description".
7. "description" must contain only the product or service name.
8. Extract quantity into "qty".
9. Extract price PER UNIT into "unitPrice".
10. If the user says "each", the stated price is the unit price.
11. If quantity is not provided, use 1.
12. If price is not provided, use 0.
13. Do not invent missing information.
14. Do not calculate subtotal or total.
15. Use numbers for qty, unitPrice and taxPercent.
16. Use 18 for taxPercent unless the user explicitly specifies another tax percentage.
17. If multiple products/services are mentioned, create separate items.
18. Preserve the meaning of the user's request.
19. Do not include currency symbols inside numeric values.

EXAMPLE 1:

Input:
2 laptops 50000 each for Rahul Sharma

Output:
{
  "client": {
    "name": "Rahul Sharma",
    "email": "",
    "address": "",
    "phone": ""
  },
  "items": [
    {
      "description": "Laptop",
      "qty": 2,
      "unitPrice": 50000
    }
  ],
  "taxPercent": 18
}

EXAMPLE 2:

Input:
3 chairs 2000 each and 2 tables 5000 each for Amit

Output:
{
  "client": {
    "name": "Amit",
    "email": "",
    "address": "",
    "phone": ""
  },
  "items": [
    {
      "description": "Chair",
      "qty": 3,
      "unitPrice": 2000
    },
    {
      "description": "Table",
      "qty": 2,
      "unitPrice": 5000
    }
  ],
  "taxPercent": 18
}

EXAMPLE 3:

Input:
Create invoice for John, 5 website development services at 10000 each. Email john@gmail.com

Output:
{
  "client": {
    "name": "John",
    "email": "john@gmail.com",
    "address": "",
    "phone": ""
  },
  "items": [
    {
      "description": "Website development service",
      "qty": 5,
      "unitPrice": 10000
    }
  ],
  "taxPercent": 18
}

EXAMPLE 4:

Input:
Invoice for ABC Company, 10 shirts at 800 each, 5 shoes at 2000 each, GST 12%

Output:
{
  "client": {
    "name": "ABC Company",
    "email": "",
    "address": "",
    "phone": ""
  },
  "items": [
    {
      "description": "Shirt",
      "qty": 10,
      "unitPrice": 800
    },
    {
      "description": "Shoes",
      "qty": 5,
      "unitPrice": 2000
    }
  ],
  "taxPercent": 12
}

NOW PROCESS THIS USER INPUT:

${prompt}
`;

    /* -----------------------------------------------------
       CALL GROQ
    ----------------------------------------------------- */

    const completion = await groq.chat.completions.create({
      model: "openai/gpt-oss-20b",

      messages: [
        {
          role: "system",
          content:
            "You are a strict invoice data extraction API. Return only valid JSON.",
        },
        {
          role: "user",
          content: userPrompt,
        },
      ],

      temperature: 0,

      response_format: {
        type: "json_object",
      },
    });

    /* -----------------------------------------------------
       GET AI RESPONSE
    ----------------------------------------------------- */

    const text =
      completion.choices?.[0]?.message?.content?.trim() || "";

    console.log("=================================");
    console.log("RAW AI OUTPUT");
    console.log("=================================");
    console.log(text);

    if (!text) {
      return res.status(500).json({
        success: false,
        message: "AI returned an empty response",
      });
    }

    /* -----------------------------------------------------
       PARSE JSON
    ----------------------------------------------------- */

    let parsed;

    try {
      parsed = JSON.parse(text);
    } catch (error) {
      console.error("JSON PARSE ERROR:", error);
      console.error("RAW AI RESPONSE:", text);

      return res.status(500).json({
        success: false,
        message: "AI returned invalid JSON",
        raw: text,
      });
    }

    /* -----------------------------------------------------
       NORMALIZE CLIENT
    ----------------------------------------------------- */

    const client = {
      name:
        typeof parsed.client?.name === "string"
          ? parsed.client.name.trim()
          : "",

      email:
        typeof parsed.client?.email === "string"
          ? parsed.client.email.trim()
          : "",

      address:
        typeof parsed.client?.address === "string"
          ? parsed.client.address.trim()
          : "",

      phone:
        typeof parsed.client?.phone === "string"
          ? parsed.client.phone.trim()
          : "",
    };

    /* -----------------------------------------------------
       VALIDATE ITEMS
    ----------------------------------------------------- */

    if (!Array.isArray(parsed.items)) {
      return res.status(400).json({
        success: false,
        message: "AI could not identify invoice items",
      });
    }

    const items = parsed.items
      .map((item) => {
        const qty = Number(item.qty);
        const unitPrice = Number(item.unitPrice);

        return {
          description:
            typeof item.description === "string"
              ? item.description.trim()
              : "",

          qty:
            Number.isFinite(qty) && qty > 0
              ? qty
              : 1,

          unitPrice:
            Number.isFinite(unitPrice) && unitPrice >= 0
              ? unitPrice
              : 0,
        };
      })
      .filter((item) => item.description);

    if (items.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No valid invoice items were found",
      });
    }

    /* -----------------------------------------------------
       TAX
    ----------------------------------------------------- */

    let taxPercent = Number(parsed.taxPercent);

    if (
      !Number.isFinite(taxPercent) ||
      taxPercent < 0
    ) {
      taxPercent = 18;
    }

    /* -----------------------------------------------------
       CALCULATE TOTALS
    ----------------------------------------------------- */

    const subtotal = items.reduce(
      (sum, item) =>
        sum + item.qty * item.unitPrice,
      0
    );

    const tax =
      (subtotal * taxPercent) / 100;

    const total = subtotal + tax;

    /* -----------------------------------------------------
       FINAL RESPONSE
    ----------------------------------------------------- */

    return res.status(200).json({
      success: true,

      data: {
        client,

        items,

        taxPercent,

        subtotal: Number(
          subtotal.toFixed(2)
        ),

        tax: Number(
          tax.toFixed(2)
        ),

        total: Number(
          total.toFixed(2)
        ),
      },
    });
  } catch (err) {
    /* -----------------------------------------------------
       ERROR LOGGING
    ----------------------------------------------------- */

    console.error(
      "================================="
    );

    console.error(
      "AI INVOICE GENERATION ERROR"
    );

    console.error(
      "================================="
    );

    console.error(
      "Message:",
      err.message
    );

    console.error(
      "Status:",
      err.status
    );

    console.error(
      "Code:",
      err.code
    );

    console.error(
      "Type:",
      err.type
    );

    console.error(
      "Full error:",
      err
    );

    return res.status(500).json({
      success: false,
      message:
        err.message ||
        "Something went wrong in AI generation",
      status: err.status || 500,
      code: err.code || null,
    });
  }
});

/* =========================================================
   EXPORT
========================================================= */

export default router;