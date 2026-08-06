import { extractJobPostingInPage } from './extract-job-posting';
import type { ExtractionResult } from './types';

export async function captureActiveTab(): Promise<ExtractionResult> {
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  if (!tab?.id || !tab.url || !/^https?:\/\//i.test(tab.url)) {
    return {
      status: 'unsupported',
      reason: 'Open a normal HTTP or HTTPS job page, then invoke Wip again.',
      ...(tab?.url ? { sourceUrl: tab.url } : {}),
    };
  }

  try {
    const [execution] = await chrome.scripting.executeScript({
      target: { tabId: tab.id, frameIds: [0] },
      func: extractJobPostingInPage,
    });
    return (
      execution?.result ?? {
        status: 'unsupported',
        reason: 'The page did not return extractable job information.',
        sourceUrl: tab.url,
      }
    );
  } catch {
    return {
      status: 'unsupported',
      reason:
        'Chrome did not allow Wip to inspect this page. Restricted browser pages and some embedded job views cannot be captured.',
      sourceUrl: tab.url,
    };
  }
}
