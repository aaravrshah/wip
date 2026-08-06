'use client';

import {
  applicationStages,
  stageLabels,
  type Application,
  type ApplicationStage,
} from '@wip/domain';
import { ArrowRight, GripVertical } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { apiMutation, ApiResponseError, createIdempotencyKey } from '@/api/client';
import { formatShortDate } from '@/lib/format';

import { StageBadge } from './stage-badge';

interface PendingMove {
  application: Application;
  stage: ApplicationStage;
}

const terminalStages = new Set<ApplicationStage>(['accepted', 'rejected', 'withdrawn']);

function needsConfirmation(from: ApplicationStage, to: ApplicationStage): boolean {
  return terminalStages.has(to) || applicationStages.indexOf(to) < applicationStages.indexOf(from);
}

function errorMessage(error: unknown): string {
  return error instanceof ApiResponseError
    ? error.message
    : 'Wip could not move that application. Its previous stage has been restored.';
}

export function ApplicationsBoard({
  applications,
  canManage,
  timeZone = 'UTC',
}: {
  applications: Application[];
  canManage: boolean;
  timeZone?: string;
}) {
  const router = useRouter();
  const [cards, setCards] = useState(applications);
  const [draggedId, setDraggedId] = useState<string>();
  const [busyId, setBusyId] = useState<string>();
  const [status, setStatus] = useState<string>();
  const [pendingMove, setPendingMove] = useState<PendingMove>();
  const cancelButton = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!pendingMove) return;
    const previouslyFocused =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    cancelButton.current?.focus();
    const handleDialogKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setPendingMove(undefined);
      }
      if (event.key !== 'Tab') return;
      const controls = [
        ...(dialog.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? []),
      ];
      const first = controls[0];
      const last = controls.at(-1);
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', handleDialogKey);
    return () => {
      document.removeEventListener('keydown', handleDialogKey);
      previouslyFocused?.focus();
    };
  }, [pendingMove]);

  async function move(application: Application, stage: ApplicationStage) {
    if (busyId || application.stage === stage) return;
    const previousStage = application.stage;
    setBusyId(application.id);
    setStatus(`Moving ${application.company} to ${stageLabels[stage]}…`);
    setCards((current) =>
      current.map((card) => (card.id === application.id ? { ...card, stage } : card)),
    );
    try {
      await apiMutation({
        url: `/api/v1/applications/${application.id}/events`,
        method: 'POST',
        idempotencyKey: createIdempotencyKey('board-stage-event'),
        body: { stage, effectiveAt: new Date().toISOString() },
      });
      setStatus(`${application.company} moved to ${stageLabels[stage]}. Timeline event added.`);
      router.refresh();
    } catch (error) {
      setCards((current) =>
        current.map((card) =>
          card.id === application.id ? { ...card, stage: previousStage } : card,
        ),
      );
      setStatus(errorMessage(error));
    } finally {
      setBusyId(undefined);
    }
  }

  function requestMove(application: Application, stage: ApplicationStage) {
    if (!canManage || application.stage === stage) return;
    if (needsConfirmation(application.stage, stage)) {
      setPendingMove({ application, stage });
      return;
    }
    void move(application, stage);
  }

  return (
    <div className="board-stack">
      <p className="board-help">
        Drag a card or use its stage menu. Every successful move appends a timeline event.
      </p>
      <div className="kanban-scroll" aria-label="Applications board">
        <div className="kanban-board">
          {applicationStages.map((stage) => {
            const stageCards = cards.filter((application) => application.stage === stage);
            return (
              <section
                className="kanban-column"
                key={stage}
                aria-labelledby={`board-${stage}`}
                onDragOver={(event) => {
                  if (canManage) event.preventDefault();
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  const id = draggedId ?? event.dataTransfer.getData('text/plain');
                  const application = cards.find((candidate) => candidate.id === id);
                  setDraggedId(undefined);
                  if (application) requestMove(application, stage);
                }}
              >
                <header className="kanban-column-heading">
                  <h2 id={`board-${stage}`}>{stageLabels[stage]}</h2>
                  <span aria-label={`${stageCards.length} applications`}>{stageCards.length}</span>
                </header>
                <div className="kanban-cards">
                  {stageCards.map((application) => (
                    <article
                      className={`kanban-card${busyId === application.id ? ' is-pending' : ''}`}
                      key={application.id}
                      draggable={canManage && busyId !== application.id}
                      onDragStart={(event) => {
                        setDraggedId(application.id);
                        event.dataTransfer.effectAllowed = 'move';
                        event.dataTransfer.setData('text/plain', application.id);
                      }}
                      onDragEnd={() => setDraggedId(undefined)}
                    >
                      <div className="kanban-card-topline">
                        {canManage && <GripVertical aria-hidden="true" size={16} />}
                        <StageBadge stage={application.stage} />
                      </div>
                      <Link href={`/applications/${application.id}`}>
                        <strong>{application.company}</strong>
                        <span>{application.role}</span>
                      </Link>
                      <p>{application.location || 'Location not provided'}</p>
                      {application.nextAction ? (
                        <small>
                          Next: {application.nextAction.title} ·{' '}
                          {formatShortDate(application.nextAction.dueAt, timeZone)}
                        </small>
                      ) : (
                        <small>No next action</small>
                      )}
                      <div className="kanban-card-actions">
                        <label>
                          <span className="sr-only">Move {application.company} to stage</span>
                          <select
                            aria-label={`Move ${application.company} to stage`}
                            value={application.stage}
                            disabled={!canManage || busyId === application.id}
                            onChange={(event) =>
                              requestMove(application, event.target.value as ApplicationStage)
                            }
                          >
                            {applicationStages.map((option) => (
                              <option key={option} value={option}>
                                {stageLabels[option]}
                              </option>
                            ))}
                          </select>
                        </label>
                        <Link
                          href={`/applications/${application.id}`}
                          aria-label={`Open ${application.company} ${application.role}`}
                        >
                          <ArrowRight aria-hidden="true" size={17} />
                        </Link>
                      </div>
                    </article>
                  ))}
                  {stageCards.length === 0 && (
                    <div className="kanban-empty">
                      <p>No applications here.</p>
                      <small>Move a card here when the process changes.</small>
                    </div>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      </div>
      {status && (
        <p className="form-status board-status" role="status" aria-live="polite">
          {status}
        </p>
      )}

      {pendingMove && (
        <div className="dialog-backdrop">
          <div
            ref={dialog}
            className="confirmation-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="move-confirmation-title"
            aria-describedby="move-confirmation-description"
          >
            <h2 id="move-confirmation-title">Confirm this stage change</h2>
            <p id="move-confirmation-description">
              Move {pendingMove.application.company} from{' '}
              {stageLabels[pendingMove.application.stage]} to {stageLabels[pendingMove.stage]}? Wip
              will append an immutable timeline event.
            </p>
            <div className="form-actions">
              <button
                ref={cancelButton}
                className="button button-secondary"
                type="button"
                onClick={() => setPendingMove(undefined)}
              >
                Cancel
              </button>
              <button
                className="button button-primary"
                type="button"
                onClick={() => {
                  const confirmed = pendingMove;
                  setPendingMove(undefined);
                  void move(confirmed.application, confirmed.stage);
                }}
              >
                Confirm move
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
