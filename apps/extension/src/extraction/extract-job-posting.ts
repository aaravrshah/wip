import type { ExtractionDraft, ExtractionResult, FieldEvidence } from './types';

export const EXTRACTOR_VERSION = 'wip-extractor/1.1.0';

export function extractJobPostingInPage(input?: { html: string; url: string }): ExtractionResult {
  const extractorVersion = EXTRACTOR_VERSION;
  const activeDocument = input
    ? new DOMParser().parseFromString(input.html, 'text/html')
    : document;
  const sourceUrl = input?.url ?? window.location.href;
  const warnings: string[] = [];
  const evidence: ExtractionDraft['fieldEvidence'] = {
    description: { source: 'heuristic', confidence: 'low' },
  };

  const cleanText = (value: unknown): string | undefined => {
    if (typeof value !== 'string') return undefined;
    const normalized = value.normalize('NFKC').replace(/\s+/g, ' ').trim();
    return normalized || undefined;
  };
  const firstText = (...values: unknown[]): string | undefined => {
    for (const value of values) {
      const normalized = cleanText(value);
      if (normalized) return normalized;
    }
    return undefined;
  };
  const meta = (selector: string): string | undefined =>
    cleanText(activeDocument.querySelector<HTMLMetaElement>(selector)?.content);
  const selectText = (...selectors: string[]): string | undefined => {
    for (const selector of selectors) {
      const value = cleanText(activeDocument.querySelector(selector)?.textContent);
      if (value) return value;
    }
    return undefined;
  };
  const typeIncludes = (value: unknown, target: string): boolean =>
    typeof value === 'string'
      ? value === target
      : Array.isArray(value) && value.some((entry) => entry === target);
  const asRecord = (value: unknown): Record<string, unknown> | undefined =>
    value !== null && typeof value === 'object' ? (value as Record<string, unknown>) : undefined;
  const flattenJsonLd = (value: unknown): Array<Record<string, unknown>> => {
    if (Array.isArray(value)) return value.flatMap(flattenJsonLd);
    const record = asRecord(value);
    if (!record) return [];
    const graph = Array.isArray(record['@graph']) ? record['@graph'].flatMap(flattenJsonLd) : [];
    return [record, ...graph];
  };

  const jobPostings: Array<Record<string, unknown>> = [];
  for (const script of activeDocument.querySelectorAll<HTMLScriptElement>(
    'script[type="application/ld+json"]',
  )) {
    try {
      for (const item of flattenJsonLd(JSON.parse(script.textContent ?? ''))) {
        if (typeIncludes(item['@type'], 'JobPosting')) jobPostings.push(item);
      }
    } catch {
      warnings.push('Some structured job data was malformed and was ignored.');
    }
  }
  if (jobPostings.length > 1) {
    warnings.push('Multiple job postings were present; Wip selected the most complete one.');
  }
  const jobPosting = jobPostings.sort((left, right) => {
    const score = (record: Record<string, unknown>) =>
      ['title', 'hiringOrganization', 'jobLocation', 'description', 'identifier'].filter(
        (key) => record[key] !== undefined,
      ).length;
    return score(right) - score(left);
  })[0];

  const setEvidence = (
    field: keyof ExtractionDraft['fieldEvidence'],
    source: FieldEvidence['source'],
    confidence: FieldEvidence['confidence'],
  ) => {
    evidence[field] = { source, confidence };
  };

  let role: string | undefined;
  let company: string | undefined;
  let location: string | undefined;
  let workplace: ExtractionDraft['workplace'] = 'unspecified';
  let employmentType: string | undefined;
  let salaryText: string | undefined;
  let requisitionId: string | undefined;
  let descriptionContainer: HTMLElement | undefined;
  let selectedSource: ExtractionDraft['selectedSource'] = 'heuristic';

  if (jobPosting) {
    selectedSource = 'json_ld';
    role = cleanText(jobPosting.title);
    if (role) setEvidence('role', 'json_ld', 'high');

    const organization = asRecord(jobPosting.hiringOrganization);
    company = firstText(organization?.name, organization?.legalName);
    if (company) setEvidence('company', 'json_ld', 'high');

    const locationRecord = Array.isArray(jobPosting.jobLocation)
      ? asRecord(jobPosting.jobLocation[0])
      : asRecord(jobPosting.jobLocation);
    const address = asRecord(locationRecord?.address);
    location = firstText(
      locationRecord?.name,
      [address?.addressLocality, address?.addressRegion, address?.addressCountry]
        .map(cleanText)
        .filter(Boolean)
        .join(', '),
    );
    if (location) setEvidence('location', 'json_ld', 'high');

    if (cleanText(jobPosting.jobLocationType)?.toUpperCase() === 'TELECOMMUTE') {
      workplace = 'remote';
      setEvidence('workplace', 'json_ld', 'high');
    }
    const employment = Array.isArray(jobPosting.employmentType)
      ? jobPosting.employmentType.map(cleanText).filter(Boolean).join(', ')
      : cleanText(jobPosting.employmentType);
    employmentType = employment || undefined;
    if (employmentType) setEvidence('employmentType', 'json_ld', 'high');

    const identifier = asRecord(jobPosting.identifier);
    requisitionId = firstText(identifier?.value, jobPosting.identifier);
    if (requisitionId) setEvidence('requisitionId', 'json_ld', 'high');

    const salary = jobPosting.baseSalary;
    if (typeof salary === 'string') salaryText = cleanText(salary);
    const salaryRecord = asRecord(salary);
    if (salaryRecord) {
      const value = asRecord(salaryRecord.value);
      const currency = cleanText(salaryRecord.currency);
      const unit = cleanText(value?.unitText);
      const minimum = typeof value?.minValue === 'number' ? String(value.minValue) : undefined;
      const maximum = typeof value?.maxValue === 'number' ? String(value.maxValue) : undefined;
      const exact = typeof value?.value === 'number' ? String(value.value) : undefined;
      salaryText =
        [currency, minimum && maximum ? `${minimum}–${maximum}` : exact, unit]
          .filter(Boolean)
          .join(' ') || undefined;
    }
    if (salaryText) setEvidence('salaryText', 'json_ld', 'high');

    const description = typeof jobPosting.description === 'string' ? jobPosting.description : '';
    if (description.trim()) {
      descriptionContainer = activeDocument.createElement('section');
      descriptionContainer.innerHTML = description;
      setEvidence('description', 'json_ld', 'high');
    }
  }

  const atsAdapters = [
    {
      name: 'Greenhouse',
      detect: '.job__description, #app_body, #content .job-description',
      description: '[data-wip-ats-job], .job__description, #app_body .job-description',
      role: '[data-job-title], .app-title, #header .app-title',
      company: '[data-company], .company-name, #header .company-name',
      location: '[data-job-location], .job-location, #content .location, #header .location',
      workplace: '[data-workplace], .workplace',
      employmentType: '[data-employment-type], .employment-type',
      requisitionId: '[data-requisition-id], [data-job-id]',
    },
    {
      name: 'Lever',
      detect: '.posting-page, .posting-headline, .posting-description',
      description: '.posting-description, .posting-page .section-wrapper.page-full-width',
      role: '.posting-headline h2, [data-qa="posting-name"]',
      company: '[data-qa="company-name"], .main-header-logo img[alt]',
      location: '.posting-categories .location, [data-qa="posting-location"]',
      workplace: '.posting-categories .workplaceTypes, [data-qa="workplace-type"]',
      employmentType: '.posting-categories .commitment, [data-qa="posting-commitment"]',
      requisitionId: '[data-qa="posting-id"], [data-requisition-id]',
    },
    {
      name: 'Workday',
      detect:
        '[data-automation-id="jobPostingDescription"], [data-automation-id="jobPostingHeader"]',
      description: '[data-automation-id="jobPostingDescription"]',
      role: '[data-automation-id="jobPostingHeader"] h2, [data-automation-id="jobPostingHeader"]',
      company: '[data-automation-id="jobPostingCompany"]',
      location: '[data-automation-id="locations"]',
      workplace: '[data-automation-id="remoteType"]',
      employmentType: '[data-automation-id="time"]',
      requisitionId: '[data-automation-id="jobReqId"]',
    },
  ] as const;
  const atsAdapter = atsAdapters.find((adapter) => activeDocument.querySelector(adapter.detect));
  const atsRoot = atsAdapter
    ? activeDocument.querySelector<HTMLElement>(atsAdapter.description)
    : undefined;
  if (atsAdapter) {
    if (!descriptionContainer && atsRoot) {
      descriptionContainer = atsRoot;
      selectedSource = 'ats_adapter';
      setEvidence('description', 'ats_adapter', 'high');
    }
    if (!role) {
      role = selectText(atsAdapter.role);
      if (role) setEvidence('role', 'ats_adapter', 'high');
    }
    if (!company) {
      const companyElement = activeDocument.querySelector<HTMLElement>(atsAdapter.company);
      company = firstText(
        companyElement?.textContent,
        companyElement?.getAttribute('alt'),
        meta('meta[property="og:site_name"]'),
      );
      if (company) setEvidence('company', 'ats_adapter', 'medium');
    }
    if (!location) {
      location = selectText(atsAdapter.location);
      if (location) setEvidence('location', 'ats_adapter', 'high');
    }
    if (!employmentType) {
      employmentType = selectText(atsAdapter.employmentType);
      if (employmentType) setEvidence('employmentType', 'ats_adapter', 'medium');
    }
    if (!requisitionId) {
      requisitionId = firstText(selectText(atsAdapter.requisitionId), meta('meta[name="job-id"]'));
      if (requisitionId) setEvidence('requisitionId', 'ats_adapter', 'medium');
    }
    if (workplace === 'unspecified') {
      const workplaceText = firstText(selectText(atsAdapter.workplace), location)?.toLowerCase();
      if (workplaceText?.includes('remote')) {
        workplace = 'remote';
        setEvidence('workplace', 'ats_adapter', 'medium');
      } else if (workplaceText?.includes('hybrid')) {
        workplace = 'hybrid';
        setEvidence('workplace', 'ats_adapter', 'medium');
      } else if (workplaceText?.includes('on-site') || workplaceText?.includes('onsite')) {
        workplace = 'on_site';
        setEvidence('workplace', 'ats_adapter', 'medium');
      }
    }
    if (!atsRoot)
      warnings.push(`${atsAdapter.name} job metadata was found without a focused description.`);
  }

  const semanticRoot = activeDocument.querySelector<HTMLElement>(
    '[itemprop="description"], [data-job-description], .job-description',
  );
  if (!descriptionContainer && semanticRoot) {
    descriptionContainer = semanticRoot;
    selectedSource = 'semantic';
    setEvidence('description', 'semantic', 'medium');
  }

  if (!descriptionContainer) {
    const main = activeDocument.querySelector<HTMLElement>('main, [role="main"]');
    const mainText = cleanText(main?.textContent);
    const hasJobSignal = Boolean(
      main?.querySelector('h1') &&
      mainText &&
      /responsibilit|qualification|about the role|job description/i.test(mainText),
    );
    if (main && hasJobSignal) {
      descriptionContainer = main;
      selectedSource = 'heuristic';
      setEvidence('description', 'heuristic', 'low');
      warnings.push('Wip used a broad page-region fallback. Review the description carefully.');
    }
  }

  if (!descriptionContainer) {
    return {
      status: 'unsupported',
      reason: 'Wip could not find a focused job description on this page.',
      sourceUrl,
    };
  }

  if (!role) {
    role = firstText(
      selectText('[data-job-title]', '[itemprop="title"]', 'main h1', 'h1'),
      meta('meta[property="og:title"]'),
    );
    if (role)
      setEvidence(
        'role',
        role === meta('meta[property="og:title"]') ? 'meta' : selectedSource,
        selectedSource === 'heuristic' ? 'low' : 'medium',
      );
  }
  if (!company) {
    company = firstText(
      selectText('[data-company]', '.company-name', '[itemprop="hiringOrganization"]'),
      meta('meta[property="og:site_name"]'),
    );
    if (company)
      setEvidence(
        'company',
        company === meta('meta[property="og:site_name"]') ? 'meta' : selectedSource,
        selectedSource === 'heuristic' ? 'low' : 'medium',
      );
  }
  if (!location) {
    location = firstText(
      selectText('[data-job-location]', '.job-location', '[itemprop="jobLocation"]'),
      meta('meta[name="job-location"]'),
    );
    if (location) setEvidence('location', 'semantic', 'medium');
  }
  if (!requisitionId) {
    requisitionId = firstText(
      selectText('[data-requisition-id]', '[data-job-id]'),
      meta('meta[name="job-id"]'),
    );
    if (requisitionId) setEvidence('requisitionId', 'semantic', 'medium');
  }
  if (workplace === 'unspecified') {
    const workplaceText = firstText(selectText('[data-workplace]'), location)?.toLowerCase();
    if (workplaceText === 'remote' || workplaceText?.includes('fully remote')) {
      workplace = 'remote';
      setEvidence('workplace', 'semantic', 'medium');
    } else if (workplaceText?.includes('hybrid')) {
      workplace = 'hybrid';
      setEvidence('workplace', 'semantic', 'medium');
    } else if (workplaceText?.includes('on-site') || workplaceText?.includes('onsite')) {
      workplace = 'on_site';
      setEvidence('workplace', 'semantic', 'medium');
    }
  }

  const cleaned = descriptionContainer.cloneNode(true) as HTMLElement;
  for (const element of cleaned.querySelectorAll(
    'script, style, noscript, template, form, input, select, textarea, button, iframe, object, embed, nav, header, footer, aside, svg, canvas, img, video, audio',
  )) {
    element.remove();
  }
  for (const element of [cleaned, ...cleaned.querySelectorAll<HTMLElement>('*')]) {
    for (const attribute of [...element.attributes]) element.removeAttribute(attribute.name);
  }
  const descriptionText = cleaned.textContent
    ?.normalize('NFKC')
    .replace(/\r\n?/g, '\n')
    .replace(/[\t\f\v ]+/g, ' ')
    .replace(/\n\s+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  const descriptionHtml = cleaned.innerHTML.trim();
  if (!descriptionText || descriptionText.length < 60) {
    return {
      status: 'unsupported',
      reason: 'The detected page region did not contain enough job-description text.',
      sourceUrl,
    };
  }
  if (descriptionText.length > 200_000 || descriptionHtml.length > 250_000) {
    return {
      status: 'unsupported',
      reason: 'The detected job description is too large to review safely.',
      sourceUrl,
    };
  }

  let canonicalUrl: string | undefined;
  const canonical = activeDocument
    .querySelector<HTMLLinkElement>('link[rel="canonical"]')
    ?.getAttribute('href');
  if (canonical) {
    try {
      canonicalUrl = new URL(canonical, sourceUrl).toString();
    } catch {
      warnings.push('The page canonical URL was invalid and was ignored.');
    }
  }
  if (!role) warnings.push('Role title was not detected. Add it before saving.');
  if (!company) warnings.push('Company was not detected. Add it before saving.');
  if (evidence.description.confidence === 'low') {
    warnings.push(
      'Description confidence is low; confirm that unrelated page content was excluded.',
    );
  }

  return {
    status: 'captured',
    draft: {
      extractorVersion,
      selectedSource,
      sourceUrl,
      ...(canonicalUrl ? { canonicalUrl } : {}),
      ...(cleanText(activeDocument.title) ? { pageTitle: cleanText(activeDocument.title) } : {}),
      ...(role ? { role } : {}),
      ...(company ? { company } : {}),
      stage: 'saved',
      ...(location ? { location } : {}),
      workplace,
      ...(employmentType ? { employmentType } : {}),
      ...(salaryText ? { salaryText } : {}),
      ...(requisitionId ? { requisitionId } : {}),
      descriptionHtml,
      descriptionText,
      fieldEvidence: evidence,
      warnings: [...new Set(warnings)],
    },
  };
}
