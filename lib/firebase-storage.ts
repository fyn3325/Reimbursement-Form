import { ref, uploadString, getDownloadURL } from 'firebase/storage';
import { getFirebaseStorage } from './firebase';

const RECEIPTS_PREFIX = 'receipts';
const BENEFIT_RECEIPTS_PREFIX = 'benefit-receipts';

async function uploadDataUrlFile(prefix: string, claimId: string, itemId: string, dataUrl: string): Promise<string> {
  const storage = getFirebaseStorage();
  const mimeMatch = dataUrl.match(/^data:([^;]+);/);
  const mimeType = mimeMatch ? mimeMatch[1] : 'application/octet-stream';
  const ext = mimeType.includes('pdf')
    ? 'pdf'
    : mimeType.includes('png')
      ? 'png'
      : mimeType.includes('webp')
        ? 'webp'
        : 'jpg';
  const path = `${prefix}/${claimId}/${itemId}.${ext}`;
  const storageRef = ref(storage, path);
  await uploadString(storageRef, dataUrl, 'data_url');
  return getDownloadURL(storageRef);
}

export async function uploadReceiptImage(
  claimId: string,
  itemId: string,
  dataUrl: string,
  mimeType: string
): Promise<string> {
  // Keep signature for existing reimbursement flow.
  const ext = mimeType.includes('pdf')
    ? 'pdf'
    : mimeType.includes('png')
      ? 'png'
      : mimeType.includes('webp')
        ? 'webp'
        : 'jpg';
  const storage = getFirebaseStorage();
  const path = `${RECEIPTS_PREFIX}/${claimId}/${itemId}.${ext}`;
  const storageRef = ref(storage, path);
  await uploadString(storageRef, dataUrl, 'data_url');
  return getDownloadURL(storageRef);
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
  return uploadDataUrlFile(BENEFIT_RECEIPTS_PREFIX, claimId, itemId, dataUrl);
}
