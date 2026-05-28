import { getSupabaseClient } from './supabase';

const RECEIPTS_BUCKET = 'receipts';
const BENEFIT_RECEIPTS_BUCKET = 'benefit-receipts';

function dataUrlToBlob(dataUrl: string): { blob: Blob; ext: string } {
  const mimeMatch = dataUrl.match(/^data:([^;]+);/);
  const mimeType = mimeMatch ? mimeMatch[1] : 'application/octet-stream';
  const base64Data = dataUrl.split(',')[1];
  const bytes = atob(base64Data);
  const arr = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
  const blob = new Blob([arr], { type: mimeType });
  const ext = mimeType.includes('pdf') ? 'pdf' : mimeType.includes('png') ? 'png' : mimeType.includes('webp') ? 'webp' : 'jpg';
  return { blob, ext };
}

export async function uploadReceiptImage(
  claimId: string,
  itemId: string,
  dataUrl: string,
  mimeType: string
): Promise<string> {
  const ext = mimeType.includes('pdf') ? 'pdf' : mimeType.includes('png') ? 'png' : mimeType.includes('webp') ? 'webp' : 'jpg';
  const path = `${claimId}/${itemId}.${ext}`;
  const { blob } = dataUrlToBlob(dataUrl);
  const supabase = getSupabaseClient();
  const { error } = await supabase.storage.from(RECEIPTS_BUCKET).upload(path, blob, { upsert: true });
  if (error) throw error;
  const { data } = supabase.storage.from(RECEIPTS_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

export async function uploadBase64Receipt(
  claimId: string,
  itemId: string,
  base64: string,
  mimeType: string
): Promise<string> {
  const dataUrl = `data:${mimeType};base64,${base64}`;
  return uploadReceiptImage(claimId, itemId, dataUrl, mimeType);
}

export async function uploadBenefitReceiptFile(claimId: string, itemId: string, dataUrl: string): Promise<string> {
  const { blob, ext } = dataUrlToBlob(dataUrl);
  const path = `${claimId}/${itemId}.${ext}`;
  const supabase = getSupabaseClient();
  const { error } = await supabase.storage.from(BENEFIT_RECEIPTS_BUCKET).upload(path, blob, { upsert: true });
  if (error) throw error;
  const { data } = supabase.storage.from(BENEFIT_RECEIPTS_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
