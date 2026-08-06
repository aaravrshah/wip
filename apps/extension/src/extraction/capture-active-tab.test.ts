import { beforeEach, describe, expect, test, vi } from 'vitest';

import { captureActiveTab } from './capture-active-tab';

const tabs = { query: vi.fn() };
const scripting = { executeScript: vi.fn() };

describe('active-tab capture boundary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('chrome', { tabs, scripting });
  });

  test('executes the extractor only in the user-selected tab main frame', async () => {
    tabs.query.mockResolvedValue([{ id: 42, url: 'https://jobs.example.invalid/fictional-role' }]);
    scripting.executeScript.mockResolvedValue([
      {
        result: {
          status: 'unsupported',
          reason: 'Fictional test result.',
          sourceUrl: 'https://jobs.example.invalid/fictional-role',
        },
      },
    ]);

    await expect(captureActiveTab()).resolves.toMatchObject({
      status: 'unsupported',
      reason: 'Fictional test result.',
    });
    expect(tabs.query).toHaveBeenCalledWith({ active: true, lastFocusedWindow: true });
    expect(scripting.executeScript).toHaveBeenCalledWith(
      expect.objectContaining({ target: { tabId: 42, frameIds: [0] } }),
    );
  });

  test('does not inject into restricted browser pages', async () => {
    tabs.query.mockResolvedValue([{ id: 42, url: 'chrome://extensions/' }]);

    await expect(captureActiveTab()).resolves.toMatchObject({ status: 'unsupported' });
    expect(scripting.executeScript).not.toHaveBeenCalled();
  });
});
