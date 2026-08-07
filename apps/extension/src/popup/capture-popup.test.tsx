import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { CaptureApiError } from '../api/capture-client';
import type { ExtensionConfig } from '../config';
import type { ExtractionDraft } from '../extraction/types';
import { CapturePopup, type PopupServices } from './capture-popup';

const clerk = vi.hoisted(() => ({
  getToken: vi.fn(),
  isLoaded: true,
  isSignedIn: true,
  signOut: vi.fn(),
}));

vi.mock('@clerk/chrome-extension', () => ({
  useAuth: () => clerk,
  useClerk: () => ({ signOut: clerk.signOut }),
  SignInButton: ({ children }: { children: React.ReactNode }) => children,
}));

const config: ExtensionConfig = {
  apiOrigin: 'http://localhost:3000',
  clerkPublishableKey: 'pk_test_fictional',
  expectedExtensionId: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  webSignInUrl: 'http://localhost:3000/sign-in',
};

const draft: ExtractionDraft = {
  extractorVersion: 'wip-extractor/1.0.0',
  selectedSource: 'json_ld',
  sourceUrl: 'https://jobs.example.invalid/fictional-role',
  canonicalUrl: 'https://jobs.example.invalid/fictional-role',
  pageTitle: 'Junior Systems Analyst — Fictional Orbit Works',
  role: 'Junior Systems Analyst',
  company: 'Fictional Orbit Works',
  stage: 'saved',
  location: 'Pittsburgh, PA',
  workplace: 'hybrid',
  employmentType: 'Full-time',
  requisitionId: 'FOW-123',
  descriptionHtml: '<section><h2>About the role</h2><p>Build fictional systems.</p></section>',
  descriptionText: 'About the role\n\nBuild fictional systems for a fictional company.',
  fieldEvidence: {
    role: { source: 'json_ld', confidence: 'high' },
    company: { source: 'json_ld', confidence: 'high' },
    location: { source: 'json_ld', confidence: 'high' },
    workplace: { source: 'json_ld', confidence: 'high' },
    description: { source: 'json_ld', confidence: 'high' },
  },
  warnings: [],
};

function createServices(overrides: Partial<PopupServices> = {}) {
  return {
    extract: vi.fn().mockResolvedValue({ status: 'captured', draft }),
    loadDraft: vi.fn().mockResolvedValue(undefined),
    saveDraft: vi.fn().mockResolvedValue(undefined),
    clearDraft: vi.fn().mockResolvedValue(undefined),
    save: vi.fn().mockResolvedValue({
      status: 'created',
      application: {
        id: 'fictional-application',
        company: draft.company,
        role: draft.role,
        stage: 'saved',
        path: '/applications/fictional-application',
      },
      idempotentReplay: false,
    }),
    attachSnapshot: vi.fn().mockResolvedValue({
      status: 'snapshot_attached',
      application: {
        id: 'fictional-application',
        company: draft.company,
        role: draft.role,
        stage: 'saved',
        path: '/applications/fictional-application',
      },
      snapshot: {
        id: '00000000-0000-4000-8000-000000000123',
        contentSha256: 'a'.repeat(64),
        capturedAt: '2026-08-06T12:00:00.000Z',
      },
      created: true,
      idempotentReplay: false,
    }),
    open: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  } satisfies PopupServices;
}

describe('CapturePopup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clerk.isLoaded = true;
    clerk.isSignedIn = true;
    clerk.getToken.mockResolvedValue('fictional-session-token');
    clerk.signOut.mockResolvedValue(undefined);
  });

  test('extracts only after invocation and presents an editable review before saving', async () => {
    const services = createServices();
    render(<CapturePopup config={config} services={services} />);

    expect(screen.getByText('Reading this job page…')).toBeInTheDocument();
    expect(services.save).not.toHaveBeenCalled();

    const role = await screen.findByLabelText(/Role/);
    expect(role).toHaveValue('Junior Systems Analyst');
    expect(screen.getByText(draft.sourceUrl)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save to Wip' })).toBeEnabled();
    expect(services.save).not.toHaveBeenCalled();
  });

  test('requires reviewed core fields and shows native sign-in while signed out', async () => {
    clerk.isSignedIn = false;
    const services = createServices();
    render(<CapturePopup config={config} services={services} />);

    const company = await screen.findByLabelText(/Company/);
    expect(screen.getByRole('button', { name: 'Sign in securely' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save to Wip' })).toBeDisabled();

    clerk.isSignedIn = true;
    fireEvent.change(company, { target: { value: '' } });
    expect(screen.getByRole('button', { name: 'Save to Wip' })).toBeDisabled();
  });

  test('preserves edited fields and the session draft after a recoverable save error', async () => {
    const user = userEvent.setup();
    const services = createServices({
      save: vi.fn().mockRejectedValue(new Error('The network is temporarily unavailable.')),
    });
    render(<CapturePopup config={config} services={services} />);

    const role = await screen.findByLabelText(/Role/);
    await user.clear(role);
    await user.type(role, 'Edited Fictional Role');
    await user.click(screen.getByRole('button', { name: 'Save to Wip' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('temporarily unavailable');
    expect(screen.getByLabelText(/Role/)).toHaveValue('Edited Fictional Role');
    expect(services.clearDraft).not.toHaveBeenCalled();
    expect(services.saveDraft).toHaveBeenLastCalledWith(
      expect.objectContaining({
        draft: expect.objectContaining({ role: 'Edited Fictional Role' }),
      }),
    );
  });

  test('treats a revoked session as recoverable and preserves the reviewed draft', async () => {
    const user = userEvent.setup();
    const services = createServices({
      save: vi
        .fn()
        .mockRejectedValue(
          new CaptureApiError(
            'Your Wip session expired or was revoked. Sign in again; your reviewed job is still here.',
            'authentication_required',
          ),
        ),
    });
    const rendered = render(<CapturePopup config={config} services={services} />);

    await user.click(await screen.findByRole('button', { name: 'Save to Wip' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('session expired or was revoked');
    expect(screen.getByRole('heading', { name: 'Sign in again' })).toBeInTheDocument();
    expect(clerk.signOut).toHaveBeenCalledOnce();
    expect(services.clearDraft).not.toHaveBeenCalled();

    clerk.isSignedIn = false;
    rendered.rerender(<CapturePopup config={config} services={services} />);
    clerk.isSignedIn = true;
    rendered.rerender(<CapturePopup config={config} services={services} />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Save to Wip' })).toBeEnabled());
    expect(screen.queryByRole('heading', { name: 'Sign in again' })).not.toBeInTheDocument();
  });

  test('offers an explicit immutable snapshot attachment for a duplicate', async () => {
    const user = userEvent.setup();
    const services = createServices({
      save: vi.fn().mockResolvedValue({
        status: 'duplicate',
        application: {
          id: 'existing-fictional-application',
          company: draft.company,
          role: draft.role,
          stage: 'saved',
          path: '/applications/existing-fictional-application',
        },
        matchedOn: ['source_url'],
      }),
    });
    render(<CapturePopup config={config} services={services} />);

    await user.click(await screen.findByRole('button', { name: 'Save to Wip' }));
    expect(await screen.findByRole('heading', { name: 'Already in Wip' })).toBeInTheDocument();
    expect(services.clearDraft).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Attach as new snapshot' }));
    expect(
      await screen.findByRole('heading', { name: 'New snapshot attached' }),
    ).toBeInTheDocument();
    expect(services.attachSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({
        command: expect.objectContaining({ applicationId: 'existing-fictional-application' }),
        idempotencyKey: expect.stringMatching(/^extension-snapshot:/),
      }),
    );
    expect(services.clearDraft).toHaveBeenCalledOnce();
  });

  test('clears temporary content on explicit cancellation', async () => {
    const user = userEvent.setup();
    const services = createServices();
    render(<CapturePopup config={config} services={services} />);

    await user.click(await screen.findByRole('button', { name: 'Cancel and clear' }));
    await waitFor(() => expect(services.clearDraft).toHaveBeenCalledOnce());
    expect(screen.getByRole('heading', { name: 'Capture cleared' })).toBeInTheDocument();
  });
});
