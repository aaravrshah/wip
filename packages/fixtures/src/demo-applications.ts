import { createHash } from 'node:crypto';

import type {
  Application,
  ApplicationNote,
  ApplicationStage,
  Contact,
  NextAction,
  TimelineEvent,
} from '@wip/domain';

export const demoReferenceDate = new Date('2026-08-04T09:00:00-04:00');

interface SeedInput {
  id: string;
  company: string;
  role: string;
  location: string;
  workplace: Application['workplace'];
  stage: ApplicationStage;
  dateApplied?: string;
  updatedAt: string;
  waitingOn: Application['waitingOn'];
  requisitionId: string;
  nextAction?: NextAction;
  timeline: TimelineEvent[];
  snapshotSummary: string;
  responsibilities: string[];
  qualifications: string[];
  contacts?: Contact[];
  notes?: ApplicationNote[];
}

const escapeHtml = (value: string) =>
  value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');

function createApplication(input: SeedInput): Application {
  const sourceUrl = `https://jobs.example.com/${input.id}`;
  const capturedAt = input.dateApplied ?? '2026-07-14T14:00:00-04:00';
  const responsibilityItems = input.responsibilities
    .map((item) => `<li>${escapeHtml(item)}</li>`)
    .join('');
  const qualificationItems = input.qualifications
    .map((item) => `<li>${escapeHtml(item)}</li>`)
    .join('');
  const snapshotHtml = `<p>${escapeHtml(input.snapshotSummary)}</p><h3>What you’ll do</h3><ul>${responsibilityItems}</ul><h3>What you’ll bring</h3><ul>${qualificationItems}</ul>`;
  const snapshotText = `${input.snapshotSummary}\n\nWhat you’ll do\n${input.responsibilities.join('\n')}\n\nWhat you’ll bring\n${input.qualifications.join('\n')}`;

  return {
    id: input.id,
    company: input.company,
    role: input.role,
    location: input.location,
    workplace: input.workplace,
    stage: input.stage,
    dateApplied: input.dateApplied,
    updatedAt: input.updatedAt,
    waitingOn: input.waitingOn,
    sourceUrl,
    requisitionId: input.requisitionId,
    nextAction: input.nextAction,
    timeline: input.timeline,
    snapshot: {
      capturedAt,
      sourceUrl,
      provenance: 'Fictional Milestone 1A seed record',
      extractorVersion: 'demo-semantic-v1',
      contentHash: `sha256:${createHash('sha256').update(snapshotHtml).digest('hex')}`,
      html: snapshotHtml,
      text: snapshotText,
    },
    documents: [
      {
        kind: 'Resume',
        label: input.stage === 'saved' ? 'Early-career master' : 'Product & research',
        filename: input.stage === 'saved' ? 'resume-master-v4.pdf' : 'resume-product-v6.pdf',
        version: input.stage === 'saved' ? 'v4' : 'v6',
        usedAt: input.dateApplied,
      },
      {
        kind: 'Cover letter',
        label: `${input.company} tailored draft`,
        filename: `cover-${input.id}-v2.pdf`,
        version: 'v2',
        usedAt: input.dateApplied,
      },
    ],
    contacts: input.contacts ?? [
      {
        id: `${input.id}-contact`,
        name: 'Recruiting team',
        relationship: 'Recruiting contact',
        email: `recruiting+${input.id}@example.com`,
      },
    ],
    notes: input.notes ?? [
      {
        id: `${input.id}-note`,
        body: 'Fictional prototype note: connect examples from coursework to the role’s first priority.',
        createdAt: input.updatedAt,
      },
    ],
  };
}

const event = (
  id: string,
  kind: TimelineEvent['kind'],
  title: string,
  occurredAt: string,
  details?: string,
): TimelineEvent => ({ id, kind, title, occurredAt, details, source: 'Demo seed' });

export const demoApplications: Application[] = [
  createApplication({
    id: 'aster-finch',
    company: 'Aster & Finch',
    role: 'UX Research Associate',
    location: 'Boston, MA',
    workplace: 'Hybrid',
    stage: 'saved',
    updatedAt: '2026-08-03T16:20:00-04:00',
    waitingOn: 'candidate',
    requisitionId: 'AF-UXR-104',
    nextAction: {
      id: 'aster-action',
      kind: 'prepare',
      title: 'Tailor research portfolio',
      dueAt: '2026-08-06T17:00:00-04:00',
      details: 'Choose one mixed-methods project and one interview study.',
    },
    timeline: [
      event('aster-1', 'application', 'Role saved', '2026-08-02T10:15:00-04:00'),
      event(
        'aster-2',
        'document',
        'Job snapshot reviewed',
        '2026-08-03T16:20:00-04:00',
        'Key research responsibilities highlighted for tailoring.',
      ),
    ],
    snapshotSummary:
      'Aster & Finch is seeking an early-career researcher to help a small product team understand how students plan, decide, and build confidence.',
    responsibilities: [
      'Support moderated interviews and usability studies.',
      'Synthesize findings into concise opportunity areas.',
      'Partner with design and product on research planning.',
    ],
    qualifications: [
      'Experience conducting research through coursework, internships, or community projects.',
      'Clear writing and comfort explaining evidence to teammates.',
    ],
  }),
  createApplication({
    id: 'marlowe-solar',
    company: 'Marlowe Solar',
    role: 'Product Design Associate',
    location: 'Denver, CO',
    workplace: 'Remote',
    stage: 'preparing',
    updatedAt: '2026-08-02T11:00:00-04:00',
    waitingOn: 'candidate',
    requisitionId: 'MS-PD-028',
    nextAction: {
      id: 'marlowe-action',
      kind: 'prepare',
      title: 'Finish tailored cover letter',
      dueAt: '2026-08-05T12:00:00-04:00',
    },
    timeline: [
      event('marlowe-1', 'application', 'Role saved', '2026-07-31T14:10:00-04:00'),
      event('marlowe-2', 'document', 'Resume version selected', '2026-08-02T11:00:00-04:00'),
      event('marlowe-3', 'status', 'Preparation started', '2026-08-02T11:00:00-04:00'),
    ],
    snapshotSummary:
      'Marlowe Solar designs approachable tools that help renters and homeowners understand clean-energy choices.',
    responsibilities: [
      'Create interaction flows and polished interface concepts.',
      'Contribute to design-system documentation.',
      'Use lightweight research to improve onboarding.',
    ],
    qualifications: [
      'A portfolio showing thoughtful product decisions.',
      'Comfort collaborating in a distributed team.',
    ],
  }),
  createApplication({
    id: 'lumen-harbor',
    company: 'Lumen Harbor',
    role: 'Customer Insights Coordinator',
    location: 'Chicago, IL',
    workplace: 'Hybrid',
    stage: 'applied',
    dateApplied: '2026-07-21T09:30:00-04:00',
    updatedAt: '2026-07-21T09:35:00-04:00',
    waitingOn: 'employer',
    requisitionId: 'LH-CI-311',
    nextAction: {
      id: 'lumen-action',
      kind: 'follow-up',
      title: 'Send a brief follow-up',
      dueAt: '2026-08-01T09:00:00-04:00',
      details: 'Reaffirm interest and reference the community-research project.',
    },
    timeline: [
      event('lumen-1', 'application', 'Role saved', '2026-07-18T15:00:00-04:00'),
      event('lumen-2', 'document', 'Application documents finalized', '2026-07-20T18:45:00-04:00'),
      event('lumen-3', 'application', 'Application submitted', '2026-07-21T09:30:00-04:00'),
    ],
    snapshotSummary:
      'Lumen Harbor is building a customer-insights practice for a growing neighborhood-services platform.',
    responsibilities: [
      'Coordinate customer interviews and survey launches.',
      'Maintain a searchable research repository.',
      'Share patterns with product and support teams.',
    ],
    qualifications: [
      'Strong organization and synthesis skills.',
      'Interest in customer research and service design.',
    ],
  }),
  createApplication({
    id: 'paper-kite',
    company: 'Paper Kite Labs',
    role: 'Junior Frontend Developer',
    location: 'Remote — US',
    workplace: 'Remote',
    stage: 'applied',
    dateApplied: '2026-07-28T13:15:00-04:00',
    updatedAt: '2026-07-28T13:18:00-04:00',
    waitingOn: 'employer',
    requisitionId: 'PKL-FE-072',
    nextAction: {
      id: 'paper-action',
      kind: 'follow-up',
      title: 'Check in with recruiting',
      dueAt: '2026-08-02T08:00:00-04:00',
    },
    timeline: [
      event('paper-1', 'application', 'Role saved', '2026-07-24T16:30:00-04:00'),
      event('paper-2', 'document', 'Portfolio link checked', '2026-07-27T19:10:00-04:00'),
      event('paper-3', 'application', 'Application submitted', '2026-07-28T13:15:00-04:00'),
    ],
    snapshotSummary:
      'Paper Kite Labs makes collaborative learning software for small schools and education nonprofits.',
    responsibilities: [
      'Build accessible React interfaces from product specifications.',
      'Write component tests and participate in peer review.',
      'Improve performance on low-powered devices.',
    ],
    qualifications: [
      'Foundational TypeScript, React, HTML, and CSS skills.',
      'Care for accessibility and understandable code.',
    ],
  }),
  createApplication({
    id: 'willow-circuit',
    company: 'Willow Circuit',
    role: 'Software Engineer I',
    location: 'Austin, TX',
    workplace: 'Hybrid',
    stage: 'assessment',
    dateApplied: '2026-07-24T11:00:00-04:00',
    updatedAt: '2026-08-04T08:10:00-04:00',
    waitingOn: 'candidate',
    requisitionId: 'WC-SWE-610',
    nextAction: {
      id: 'willow-action',
      kind: 'assessment',
      title: 'Complete coding assessment',
      dueAt: '2026-08-06T18:00:00-04:00',
      details: '90 minutes; arrays, API data shaping, and a short written reflection.',
    },
    timeline: [
      event('willow-1', 'application', 'Application submitted', '2026-07-24T11:00:00-04:00'),
      event('willow-2', 'employer', 'Recruiter introduction', '2026-07-30T14:00:00-04:00'),
      event('willow-3', 'assessment', 'Coding assessment invited', '2026-08-04T08:10:00-04:00'),
    ],
    snapshotSummary:
      'Willow Circuit builds reliable planning tools for independent logistics teams and is hiring an engineer for its early-career program.',
    responsibilities: [
      'Ship scoped product improvements with a mentor.',
      'Write tests and investigate production issues.',
      'Participate in planning and technical discovery.',
    ],
    qualifications: [
      'Programming experience from work, school, or substantial personal projects.',
      'Curiosity about reliable systems and product tradeoffs.',
    ],
  }),
  createApplication({
    id: 'northline-commons',
    company: 'Northline Commons',
    role: 'Operations Analyst',
    location: 'New York, NY',
    workplace: 'On-site',
    stage: 'assessment',
    dateApplied: '2026-07-26T16:00:00-04:00',
    updatedAt: '2026-08-03T12:40:00-04:00',
    waitingOn: 'candidate',
    requisitionId: 'NC-OA-143',
    nextAction: {
      id: 'northline-action',
      kind: 'assessment',
      title: 'Record HireVue responses',
      dueAt: '2026-08-05T20:00:00-04:00',
      details: 'Prepare examples about prioritization, ambiguity, and improving a process.',
    },
    timeline: [
      event('northline-1', 'application', 'Application submitted', '2026-07-26T16:00:00-04:00'),
      event('northline-2', 'employer', 'Application acknowledged', '2026-07-26T16:04:00-04:00'),
      event('northline-3', 'assessment', 'HireVue requested', '2026-08-03T12:40:00-04:00'),
    ],
    snapshotSummary:
      'Northline Commons operates flexible community workspaces and needs an analyst to improve member-support operations.',
    responsibilities: [
      'Build weekly operating reports and investigate trends.',
      'Document processes and coordinate small improvements.',
      'Support planning across member-experience teams.',
    ],
    qualifications: [
      'Comfort with spreadsheets and clear written analysis.',
      'Ability to organize work across several stakeholders.',
    ],
  }),
  createApplication({
    id: 'cloverfield-digital',
    company: 'Cloverfield Digital',
    role: 'Associate Product Manager',
    location: 'San Francisco, CA',
    workplace: 'Hybrid',
    stage: 'interviewing',
    dateApplied: '2026-07-12T12:10:00-04:00',
    updatedAt: '2026-08-04T08:35:00-04:00',
    waitingOn: 'candidate',
    requisitionId: 'CD-APM-202',
    nextAction: {
      id: 'cloverfield-action',
      kind: 'interview',
      title: 'Product sense interview',
      dueAt: '2026-08-07T13:30:00-04:00',
      details: '45 minutes with a product lead over video.',
    },
    timeline: [
      event('cloverfield-1', 'application', 'Application submitted', '2026-07-12T12:10:00-04:00'),
      event(
        'cloverfield-2',
        'assessment',
        'Written exercise submitted',
        '2026-07-22T17:00:00-04:00',
      ),
      event('cloverfield-3', 'interview', 'Recruiter conversation', '2026-07-29T10:00:00-04:00'),
      event(
        'cloverfield-4',
        'interview',
        'Product sense interview scheduled',
        '2026-08-04T08:35:00-04:00',
      ),
    ],
    snapshotSummary:
      'Cloverfield Digital is hiring an associate product manager to help improve creative collaboration for small teams.',
    responsibilities: [
      'Clarify user problems and write concise product briefs.',
      'Coordinate delivery with design and engineering.',
      'Review product signals and recommend next steps.',
    ],
    qualifications: [
      'Evidence of ownership through internships, campus work, or side projects.',
      'Strong communication and comfort with ambiguity.',
    ],
    contacts: [
      {
        id: 'cloverfield-contact-1',
        name: 'Samira Chen',
        relationship: 'Recruiting coordinator (fictional)',
        email: 'samira.chen@example.com',
      },
      {
        id: 'cloverfield-contact-2',
        name: 'Product interview panel',
        relationship: 'Interview team',
      },
    ],
    notes: [
      {
        id: 'cloverfield-note-1',
        body: 'Use the campus event-planning example to explain prioritization with limited engineering time.',
        createdAt: '2026-08-04T08:40:00-04:00',
      },
    ],
  }),
  createApplication({
    id: 'emberline-health',
    company: 'Emberline Health',
    role: 'Data Analyst',
    location: 'Boston, MA',
    workplace: 'Remote',
    stage: 'interviewing',
    dateApplied: '2026-07-09T10:30:00-04:00',
    updatedAt: '2026-08-01T15:05:00-04:00',
    waitingOn: 'candidate',
    requisitionId: 'EH-DA-508',
    nextAction: {
      id: 'emberline-action',
      kind: 'interview',
      title: 'Analytics case conversation',
      dueAt: '2026-08-12T11:00:00-04:00',
      details: 'Review experiment interpretation and stakeholder communication.',
    },
    timeline: [
      event('emberline-1', 'application', 'Application submitted', '2026-07-09T10:30:00-04:00'),
      event('emberline-2', 'assessment', 'SQL exercise completed', '2026-07-20T19:00:00-04:00'),
      event('emberline-3', 'interview', 'Hiring manager interview', '2026-07-30T14:30:00-04:00'),
      event('emberline-4', 'interview', 'Analytics case scheduled', '2026-08-01T15:05:00-04:00'),
    ],
    snapshotSummary:
      'Emberline Health makes scheduling tools for community clinics and is adding an analyst to its product operations group.',
    responsibilities: [
      'Create trustworthy metrics for product teams.',
      'Investigate adoption and workflow patterns.',
      'Explain findings to technical and nontechnical partners.',
    ],
    qualifications: [
      'Working knowledge of SQL and statistical reasoning.',
      'Thoughtful communication about uncertainty and data quality.',
    ],
  }),
  createApplication({
    id: 'fable-form',
    company: 'Fable & Form',
    role: 'Design Program Coordinator',
    location: 'Brooklyn, NY',
    workplace: 'Hybrid',
    stage: 'offer',
    dateApplied: '2026-06-25T09:00:00-04:00',
    updatedAt: '2026-08-02T17:30:00-04:00',
    waitingOn: 'candidate',
    requisitionId: 'FF-DPC-088',
    nextAction: {
      id: 'fable-action',
      kind: 'decision',
      title: 'Review offer details',
      dueAt: '2026-08-08T17:00:00-04:00',
      details: 'Compare start date, learning support, and commute expectations.',
    },
    timeline: [
      event('fable-1', 'application', 'Application submitted', '2026-06-25T09:00:00-04:00'),
      event('fable-2', 'interview', 'Team interview', '2026-07-16T13:00:00-04:00'),
      event('fable-3', 'interview', 'Final conversation', '2026-07-29T15:00:00-04:00'),
      event('fable-4', 'offer', 'Offer received', '2026-08-02T17:30:00-04:00'),
    ],
    snapshotSummary:
      'Fable & Form is looking for a coordinator to make design rituals, critiques, and cross-team planning run smoothly.',
    responsibilities: [
      'Coordinate design reviews and planning sessions.',
      'Maintain program documentation and follow-through.',
      'Improve onboarding for new creative teammates.',
    ],
    qualifications: [
      'Strong organization with a warm communication style.',
      'Interest in design operations and team systems.',
    ],
  }),
  createApplication({
    id: 'seabird-studio',
    company: 'Seabird Studio',
    role: 'Junior Brand Strategist',
    location: 'Portland, OR',
    workplace: 'Hybrid',
    stage: 'accepted',
    dateApplied: '2026-06-02T12:00:00-04:00',
    updatedAt: '2026-07-31T12:00:00-04:00',
    waitingOn: 'none',
    requisitionId: 'SS-JBS-017',
    timeline: [
      event('seabird-1', 'application', 'Application submitted', '2026-06-02T12:00:00-04:00'),
      event('seabird-2', 'assessment', 'Brand exercise submitted', '2026-06-15T17:00:00-04:00'),
      event('seabird-3', 'interview', 'Portfolio conversation', '2026-06-24T12:00:00-04:00'),
      event('seabird-4', 'offer', 'Offer received', '2026-07-27T10:00:00-04:00'),
      event('seabird-5', 'offer', 'Offer accepted', '2026-07-31T12:00:00-04:00'),
    ],
    snapshotSummary:
      'Seabird Studio partners with civic and cultural organizations on clear, human-centered brand systems.',
    responsibilities: [
      'Support audience research and positioning work.',
      'Develop clear strategic narratives with creative teams.',
      'Prepare workshops and client-ready materials.',
    ],
    qualifications: [
      'Strong writing and visual communication instincts.',
      'A portfolio demonstrating research-backed creative thinking.',
    ],
  }),
  createApplication({
    id: 'copper-finch',
    company: 'Copper Finch Robotics',
    role: 'Hardware Operations Associate',
    location: 'Pittsburgh, PA',
    workplace: 'On-site',
    stage: 'rejected',
    dateApplied: '2026-06-18T08:45:00-04:00',
    updatedAt: '2026-07-30T09:15:00-04:00',
    waitingOn: 'none',
    requisitionId: 'CFR-HO-230',
    timeline: [
      event('copper-1', 'application', 'Application submitted', '2026-06-18T08:45:00-04:00'),
      event('copper-2', 'interview', 'Operations screen', '2026-07-02T11:00:00-04:00'),
      event('copper-3', 'assessment', 'Process exercise submitted', '2026-07-13T16:00:00-04:00'),
      event('copper-4', 'status', 'Application closed', '2026-07-30T09:15:00-04:00'),
    ],
    snapshotSummary:
      'Copper Finch Robotics needs an associate to keep prototype inventory, lab processes, and supplier records organized.',
    responsibilities: [
      'Track prototype parts and inventory movement.',
      'Document repeatable lab and purchasing processes.',
      'Coordinate updates with engineering and suppliers.',
    ],
    qualifications: [
      'Careful operational habits and clear documentation.',
      'Interest in hardware development and supply operations.',
    ],
  }),
  createApplication({
    id: 'kindred-loop',
    company: 'Kindred Loop',
    role: 'Community Associate',
    location: 'Atlanta, GA',
    workplace: 'Remote',
    stage: 'withdrawn',
    dateApplied: '2026-07-01T15:20:00-04:00',
    updatedAt: '2026-07-29T14:00:00-04:00',
    waitingOn: 'none',
    requisitionId: 'KL-CA-407',
    timeline: [
      event('kindred-1', 'application', 'Application submitted', '2026-07-01T15:20:00-04:00'),
      event('kindred-2', 'interview', 'Community team conversation', '2026-07-14T13:00:00-04:00'),
      event(
        'kindred-3',
        'status',
        'Application withdrawn',
        '2026-07-29T14:00:00-04:00',
        'Role timing no longer matched the planned graduation schedule.',
      ),
    ],
    snapshotSummary:
      'Kindred Loop supports peer-learning communities and is hiring an associate to welcome members and improve programming.',
    responsibilities: [
      'Support community programming and member communication.',
      'Capture feedback and recommend small improvements.',
      'Coordinate event logistics with facilitators.',
    ],
    qualifications: [
      'Warm, concise written communication.',
      'Experience organizing student, volunteer, or community programs.',
    ],
  }),
];
