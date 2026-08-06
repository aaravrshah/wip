import type { ExtractionDraft } from '../extraction/types';

const DRAFT_KEY = 'wip.captureDraft.v1';

export interface StoredCaptureDraft {
  draft: ExtractionDraft;
  idempotencyKey: string;
}

export async function loadCaptureDraft(): Promise<StoredCaptureDraft | undefined> {
  const result = await chrome.storage.session.get(DRAFT_KEY);
  return result[DRAFT_KEY] as StoredCaptureDraft | undefined;
}

export async function saveCaptureDraft(value: StoredCaptureDraft): Promise<void> {
  await chrome.storage.session.set({ [DRAFT_KEY]: value });
}

export async function clearCaptureDraft(): Promise<void> {
  await chrome.storage.session.remove(DRAFT_KEY);
}
