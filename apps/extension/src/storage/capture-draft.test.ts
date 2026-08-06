import { beforeEach, describe, expect, test, vi } from 'vitest';

import type { StoredCaptureDraft } from './capture-draft';
import { clearCaptureDraft, loadCaptureDraft, saveCaptureDraft } from './capture-draft';

const session = {
  get: vi.fn(),
  set: vi.fn(),
  remove: vi.fn(),
};

const stored: StoredCaptureDraft = {
  idempotencyKey: 'extension-capture:fictional-test',
  draft: {
    extractorVersion: 'wip-extractor/1.0.0',
    selectedSource: 'semantic',
    sourceUrl: 'https://jobs.example.invalid/fictional',
    role: 'Fictional Role',
    company: 'Fictional Company',
    stage: 'saved',
    workplace: 'unspecified',
    descriptionHtml: '<p>Fictional job description for a storage test.</p>',
    descriptionText: 'Fictional job description for a storage test.',
    fieldEvidence: {
      description: { source: 'semantic', confidence: 'medium' },
    },
    warnings: [],
  },
};

describe('temporary capture draft storage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('chrome', { storage: { session } });
  });

  test('uses session storage and can remove the entire temporary draft', async () => {
    session.get.mockResolvedValue({ 'wip.captureDraft.v1': stored });
    session.set.mockResolvedValue(undefined);
    session.remove.mockResolvedValue(undefined);

    await saveCaptureDraft(stored);
    await expect(loadCaptureDraft()).resolves.toEqual(stored);
    await clearCaptureDraft();

    expect(session.set).toHaveBeenCalledWith({ 'wip.captureDraft.v1': stored });
    expect(session.remove).toHaveBeenCalledWith('wip.captureDraft.v1');
  });
});
