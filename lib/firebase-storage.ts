import { ref, uploadString, getDownloadURL } from 'firebase/storage';
import { getFirebaseStorage } from './firebase';

const RECEIPTS_PREFIX = 'receipts';

export async function uploadReceiptImage(
  claimId: string,
  itemId: string,
  dataUrl: string,
  mimeType: string
): Promise<string> {
  const storage = getFirebaseStorage();
  const ext = mimeType.includes('pdf') ? 'pdf' : 'jpg';
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
