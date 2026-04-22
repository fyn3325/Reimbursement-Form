import { GoogleGenAI, Type } from '@google/genai';

const json = (body: object, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });

const SINGLE_RECEIPT_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    page: { type: Type.NUMBER, description: '1-based page number of this receipt in the document' },
    date: { type: Type.STRING, description: 'YYYY-MM-DD' },
    merchant: { type: Type.STRING },
    amount: { type: Type.NUMBER },
    currency: { type: Type.STRING },
    description: { type: Type.STRING, description: 'Short description of the expense item(s)' },
    category: {
      type: Type.STRING,
      enum: [
        'Staff Welfare',
        'Repair Maintenance - Office Equipment',
        'Retail Supplies',
        'Pantry',
        'Cleaning',
        'Purchase - Packaging',
        'Postage',
        'Other',
      ],
    },
  },
  required: ['date', 'merchant', 'amount', 'category'],
};

const RECEIPTS_ARRAY_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    receipts: {
      type: Type.ARRAY,
      description: 'List of all invoices/receipts found in the document. Extract each invoice as a separate item.',
      items: SINGLE_RECEIPT_SCHEMA,
    },
  },
  required: ['receipts'],
};

function normalizeMime(mime: string): string {
  if (!mime || mime.toLowerCase().includes('pdf')) return 'application/pdf';
  return mime;
}

async function processReceipt(base64Image: string, mimeType: string, apiKey: string) {
  const ai = new GoogleGenAI({ apiKey });
  const mime = normalizeMime(mimeType);
  const response = await ai.models.generateContent({
    model: 'gemini-2.0-flash',
    contents: {
      parts: [
        { inlineData: { data: base64Image, mimeType: mime } },
        {
          text: 'Extract ALL invoices/receipts from this document for a reimbursement claim form. '
            + 'If the PDF or image contains multiple invoices (e.g. 5 invoices on 5 pages), extract EACH one as a separate item in the receipts array. '
            + 'Do not skip any invoice. Return empty receipts array only if no invoice/receipt is found.',
        },
      ],
    },
    config: {
      systemInstruction:
        'You are a finance assistant. Extract ALL invoices/receipts from the document. '
        + 'A multi-page PDF may contain one invoice per page - extract every single one. '
        + 'If language is Chinese, translate description to English or keep it concise. Map category to the closest option available.',
      responseMimeType: 'application/json',
      responseSchema: RECEIPTS_ARRAY_SCHEMA,
    },
  });

  const raw = JSON.parse(response.text || '{"receipts":[]}');
  const receipts = Array.isArray(raw.receipts) ? raw.receipts : [];
  const receiptImage = `data:${mime};base64,${base64Image}`;

  return receipts.map((r: Record<string, unknown>, index: number) => ({
    id: crypto.randomUUID(),
    date: r.date || new Date().toISOString().split('T')[0],
    merchant: r.merchant || 'Unknown Merchant',
    amount: r.amount ?? 0,
    currency: r.currency || 'USD',
    category: r.category || 'Other',
    description: r.description || 'Expense item',
    receiptImage,
    receiptPage: r.page != null ? Number(r.page) : index + 1,
  }));
}

export async function POST(request: Request) {
  try {
    const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
    if (!apiKey) {
      return json(
        {
          error: 'Receipt processing failed',
          details: 'Set GEMINI_API_KEY in Vercel Environment Variables, then redeploy.',
        },
        503
      );
    }

    let body: { base64Image?: string; mimeType?: string };
    try {
      body = await request.json();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return json({ error: 'Invalid JSON body', details: msg }, 400);
    }

    const { base64Image, mimeType } = body;
    if (!base64Image || !mimeType) {
      return json({ error: 'Missing base64Image or mimeType' }, 400);
    }

    const items = await processReceipt(base64Image, mimeType, apiKey);
    return json(items, 200);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return json({ error: 'Receipt processing failed', details: message }, 500);
  }
}
