import { GoogleGenAI, Type } from "@google/genai";
import { Expense, ExpenseCategory, ClaimItem } from "../types";
import { GEMINI_MODEL } from "../constants";

const getAI = () =>
  new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY || process.env.API_KEY || '',
  });

// --- Audit Logic ---

const EXPENSE_SCHEMA = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      date: { type: Type.STRING, description: "YYYY-MM-DD format" },
      merchant: { type: Type.STRING },
      amount: { type: Type.NUMBER },
      currency: { type: Type.STRING, description: "ISO currency code, e.g. USD, CNY" },
      category: { type: Type.STRING, enum: ["COMPANY", "PERSONAL"] },
      reasoning: { type: Type.STRING, description: "Brief reason for classification" },
    },
    required: ["date", "merchant", "amount", "currency", "category", "reasoning"],
  },
};

const SYSTEM_INSTRUCTION = `
You are an expert financial auditor. 
Your task is to extract credit card transaction details from bank statements (text or image).
For each transaction, classify it as 'COMPANY' (Business expenses, Travel, Software, Office Supplies, Meals with clients) or 'PERSONAL' (Groceries, Entertainment, Personal subscriptions, Clothing).
Be strict. Netflix/Spotify is usually Personal. Airlines/Uber/AWS/WeWork is usually Company.
Return raw JSON.
`;

export const processStatementImage = async (base64Image: string, mimeType: string): Promise<Expense[]> => {
  const ai = getAI();
  
  const response = await ai.models.generateContent({
    model: GEMINI_MODEL,
    contents: {
      parts: [
        { inlineData: { data: base64Image, mimeType: mimeType } },
        { text: "Extract all transactions from this statement image." }
      ]
    },
    config: {
      systemInstruction: SYSTEM_INSTRUCTION,
      responseMimeType: "application/json",
      responseSchema: EXPENSE_SCHEMA,
    }
  });

  const raw = JSON.parse(response.text || "[]");
  return raw.map((item: any) => ({
    ...item,
    id: crypto.randomUUID(),
    hasReceipt: false 
  }));
};

export const processStatementText = async (text: string): Promise<Expense[]> => {
  const ai = getAI();
  
  const response = await ai.models.generateContent({
    model: GEMINI_MODEL,
    contents: `Extract transactions from this text:\n${text}`,
    config: {
      systemInstruction: SYSTEM_INSTRUCTION,
      responseMimeType: "application/json",
      responseSchema: EXPENSE_SCHEMA,
    }
  });

  const raw = JSON.parse(response.text || "[]");
  return raw.map((item: any) => ({
    ...item,
    id: crypto.randomUUID(),
    hasReceipt: false
  }));
};

export const chatWithAudit = async (expenses: Expense[], question: string): Promise<string> => {
  const ai = getAI();
  
  const context = JSON.stringify(expenses.map(e => ({
    date: e.date,
    merchant: e.merchant,
    amount: e.amount,
    cat: e.category,
    hasReceipt: e.hasReceipt
  })));

  const prompt = `
    Context: Current Audit Expense List:
    ${context}

    User Question: ${question}

    Answer the question as an auditor. Focus on compliance, missing receipts, and spending trends.
  `;

  const response = await ai.models.generateContent({
    model: GEMINI_MODEL,
    contents: prompt,
  });

  return response.text || "Unable to analyze current data.";
};

// --- Reimbursement Logic ---

const SINGLE_RECEIPT_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    page: { type: Type.NUMBER, description: "1-based page number of this receipt in the document" },
    date: { type: Type.STRING, description: "YYYY-MM-DD" },
    merchant: { type: Type.STRING },
    amount: { type: Type.NUMBER },
    currency: { type: Type.STRING },
    description: { type: Type.STRING, description: "Short description of the expense item(s)" },
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
        "Other"
      ]
    },
  },
  required: ["date", "merchant", "amount", "category"],
};

const RECEIPTS_ARRAY_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    receipts: {
      type: Type.ARRAY,
      description: "List of all invoices/receipts found in the document.",
      items: SINGLE_RECEIPT_SCHEMA,
    },
  },
  required: ["receipts"],
};

const normalizeReceiptMimeType = (mime: string): string => {
  if (!mime || mime.toLowerCase().includes('pdf')) return 'application/pdf';
  return mime;
};

export const processReceiptImage = async (base64Image: string, mimeType: string): Promise<ClaimItem[]> => {
  const ai = getAI();
  const mime = normalizeReceiptMimeType(mimeType);
  const response = await ai.models.generateContent({
    model: GEMINI_MODEL,
    contents: {
      parts: [
        { inlineData: { data: base64Image, mimeType: mime } },
        {
          text: "Extract ALL invoices/receipts from this document for a reimbursement claim form. "
            + "If the PDF or image contains multiple invoices (e.g. 5 invoices on 5 pages), extract EACH one as a separate item in the receipts array. "
            + "Do not skip any invoice. Return empty receipts array only if no invoice/receipt is found."
        }
      ]
    },
    config: {
      systemInstruction: "You are a finance assistant. Extract ALL invoices/receipts from the document. "
        + "A multi-page PDF may contain one invoice per page - extract every single one. "
        + "If language is Chinese, translate description to English or keep it concise. Map category to the closest option available.",
      responseMimeType: "application/json",
      responseSchema: RECEIPTS_ARRAY_SCHEMA,
    }
  });

  const raw = JSON.parse(response.text || '{"receipts":[]}');
  const receipts = Array.isArray(raw.receipts) ? raw.receipts : [];
  const receiptImage = `data:${mime};base64,${base64Image}`;

  return receipts.map((r: Record<string, unknown>, index: number) => ({
    id: crypto.randomUUID(),
    date: r.date || new Date().toISOString().split('T')[0],
    merchant: r.merchant || "Unknown Merchant",
    amount: r.amount ?? 0,
    currency: r.currency || "USD",
    category: r.category || "Other",
    description: r.description || "Expense item",
    receiptImage,
    receiptPage: r.page != null ? Number(r.page) : index + 1,
  }));
};