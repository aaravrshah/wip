import { stageLabels, type ApplicationStage } from '@wip/domain';

export function StageBadge({ stage }: { stage: ApplicationStage }) {
  return (
    <span className="stage-badge" data-stage={stage}>
      <span className="stage-dot" aria-hidden="true" />
      {stageLabels[stage]}
    </span>
  );
}
