import express from "express";
import Groq from "groq-sdk";
import dotenv from "dotenv";

dotenv.config();

const router = express.Router();

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

router.post("/generate", async (req, res) => {
  try {

    const { prompt } = req.body;

    if (!prompt) {
      return res.status(400).json({
        success: false,
        message: "Prompt is required",
      });
    }

    const systemPrompt = `
Convert the user request into invoice JSON.

Return ONLY JSON.

{
  "client":{
    "name":"",
    "email":"",
    "address":"",
    "phone":""
  },
  "items":[
    {
      "description":"",
      "qty":1,
      "unitPrice":0
    }
  ]
}

User request:
${prompt}
`;
const completion = await groq.chat.completions.create({
  model: "llama-3.1-8b-instant",
  messages: [
    {
      role: "user",
      content: systemPrompt,
    },
  ],
});

    const text = completion.choices[0].message.content || "";

    const clean = text
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();

    let parsed;

    try {
      parsed = JSON.parse(clean);
    } catch {
      throw new Error("Invalid JSON returned by AI");
    }

    return res.json({
      success: true,
      data: parsed,
    });

  } catch (err) {

    console.error("AI Error:", err.message);

    return res.json({
      success: true,
      data: {
        client: {
          name: "Client",
          email: "",
          address: "",
          phone: "",
        },
        items: [
          {
            description: req.body.prompt || "Service",
            qty: 1,
            unitPrice: 0,
          },
        ],
      },
    });
  }
});

export default router;