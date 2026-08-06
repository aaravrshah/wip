import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { demoApplications } from '@wip/fixtures';

import type * as ApiClient from '@/api/client';

const mocks = vi.hoisted(() => ({ apiMutation: vi.fn(), refresh: vi.fn() }));

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: mocks.refresh }) }));
vi.mock('@/api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof ApiClient>();
  return { ...actual, apiMutation: mocks.apiMutation };
});

import { ContactsManager, DocumentsManager } from './metadata-management';

const application = { ...demoApplications[0]!, contacts: [], documents: [] };

describe('application metadata management', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.apiMutation.mockResolvedValue(application);
  });

  test('creates a contact association without accepting an owner identifier', async () => {
    const user = userEvent.setup();
    render(<ContactsManager application={application} availableContacts={[]} />);

    await user.type(screen.getByLabelText('Name'), 'Fictional Riley');
    await user.type(screen.getByLabelText('Email'), 'riley@example.invalid');
    await user.click(screen.getByRole('button', { name: 'Add contact' }));

    expect(mocks.apiMutation).toHaveBeenCalledWith({
      url: `/api/v1/applications/${application.id}/contacts`,
      method: 'POST',
      body: expect.objectContaining({
        mode: 'create',
        name: 'Fictional Riley',
        email: 'riley@example.invalid',
        relationship: 'recruiter',
      }),
    });
    expect(mocks.apiMutation.mock.calls[0]![0].body).not.toHaveProperty('ownerId');
  });

  test('creates metadata-only document version and use records', async () => {
    const user = userEvent.setup();
    render(<DocumentsManager application={application} availableDocuments={[]} />);

    await user.type(screen.getByLabelText('Document name'), 'Product resume');
    await user.type(screen.getByLabelText('Version label'), '2026-08 product');
    await user.type(screen.getByLabelText('Original filename'), 'product-resume.pdf');
    await user.click(screen.getByRole('button', { name: 'Save document metadata' }));

    expect(mocks.apiMutation).toHaveBeenCalledWith({
      url: `/api/v1/applications/${application.id}/documents`,
      method: 'POST',
      body: expect.objectContaining({
        mode: 'create',
        kind: 'resume',
        title: 'Product resume',
        versionLabel: '2026-08 product',
        filename: 'product-resume.pdf',
        purpose: 'submitted',
      }),
    });
  });
});
