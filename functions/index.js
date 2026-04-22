import { onRequest } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import { GoogleGenAI, Type } from "@google/genai";

const GEMINI_API_KEY = defineSecret("GEMINI_API_KEY");
const GEMINI_MODEL = "gemini-2.5-flash-lite";

const RECEIPTS_ARRAY_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    receipts: {
      type: Type.ARRAY,
      description: "List of all invoices/receipts found in the document.",
      items: {
        type: Type.OBJECT,
        properties: {
          page: { type: Type.NUMBER, description: "1-based page number of this receipt in the document (1 for first page, 2 for second, etc.)" },
          date: { type: Type.STRING, description: "YYYY-MM-DD" },
          merchant: { type: Type.STRING },
          amount: { type: Type.NUMBER },
          currency: { type: Type.STRING },
          description: { type: Type.STRING },
          category: {
            type: Type.STRING,
            enum: [
              "Staff Welfare",
              "Repair Maintenance - Office Equipment",
              "Retail Supplies",
              "Pantry",
              "Cleaning",
              "Purchase - Packaging",
              "Postage",
              "Other",
            ],
          },
        },
        required: ["date", "merchant", "amount", "category"],
      },
    },
  },
  required: ["receipts"],
};

function normalizeMime(mime) {
  if (!mime || mime.toLowerCase().includes("pdf")) return "application/pdf";
  return mime;
}

export const processReceipt = onRequest(
  { secrets: [GEMINI_API_KEY], cors: true },
  async (req, res) => {
    if (req.method === "OPTIONS") {
      res.set("Access-Control-Allow-Origin", "*");
      res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
      res.set("Access-Control-Allow-Headers", "Content-Type");
      res.status(204).send("");
      return;
    }

    if (req.method !== "POST") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }

    const apiKey = GEMINI_API_KEY.value();
    if (!apiKey) {
      res.status(500).json({ error: "GEMINI_API_KEY not configured" });
      return;
    }

    let body;
    try {
      body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
    } catch {
      res.status(400).json({ error: "Invalid JSON body" });
      return;
    }

    const { base64Image, mimeType } = body;
    if (!base64Image || !mimeType) {
      res.status(400).json({ error: "Missing base64Image or mimeType" });
      return;
    }

    try {
      const ai = new GoogleGenAI({ apiKey });
      const mime = normalizeMime(mimeType);
      const response = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: {
          parts: [
            { inlineData: { data: base64Image, mimeType: mime } },
            {
              text:
                "Extract ALL invoices/receipts from this document for a reimbursement claim form. " +
                "If the PDF or image contains multiple invoices (e.g. 5 invoices on 5 pages), extract EACH one as a separate item in the receipts array. " +
                "Do not skip any invoice. Return empty receipts array only if no invoice/receipt is found.",
            },
          ],
        },
        config: {
          systemInstruction:
            "You are a finance assistant. Extract ALL invoices/receipts from the document. " +
            "A multi-page PDF may contain one invoice per page - extract every single one. " +
            "If language is Chinese, translate description to English or keep it concise. Map category to the closest option available.",
          responseMimeType: "application/json",
          responseSchema: RECEIPTS_ARRAY_SCHEMA,
        },
      });

      const raw = JSON.parse(response.text || '{"receipts":[]}');
      const receipts = Array.isArray(raw.receipts) ? raw.receipts : [];
      const receiptImage = `data:${mime};base64,${base64Image}`;

      const items = receipts.map((r, index) => ({
        id: crypto.randomUUID(),
        date: r.date || new Date().toISOString().split("T")[0],
        merchant: r.merchant || "Unknown Merchant",
        amount: r.amount ?? 0,
        currency: r.currency || "USD",
        category: r.category || "Other",
        description: r.description || "Expense item",
        receiptImage,
        receiptPage: r.page != null ? Number(r.page) : index + 1,
      }));

      res.set("Access-Control-Allow-Origin", "*");
      res.status(200).json(items);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      res.set("Access-Control-Allow-Origin", "*");
      res.status(500).json({
        error: "Receipt processing failed",
        details: message,
      });
    }
  }
);
