import { describe, expect, test } from 'vitest';

import { normalizeManualJobDescription } from './snapshot-normalization';

describe('manual job-description normalization', () => {
  test('normalizes plain text, emits safe semantic HTML, and hashes canonical text', () => {
    const snapshot = normalizeManualJobDescription(
      '  Build <things>  \r\n\r\n\r\nWork with R&D.  ',
    );

    expect(snapshot.text).toBe('Build <things>\n\nWork with R&D.');
    expect(snapshot.html).toBe('<p>Build &lt;things&gt;</p><p>Work with R&amp;D.</p>');
    expect(snapshot.contentSha256).toMatch(/^[0-9a-f]{64}$/);
    expect(snapshot.provenance).toBe('User-pasted job description');
  });
});
