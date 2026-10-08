import { REPO_URL } from './site';

// Links to the GitHub issue forms in .github/ISSUE_TEMPLATE/. The `title` parameter fills the
// issue title; any other parameter fills the form field with the same id.

export type IssueTemplate =
  | 'correct-listing.yml'
  | 'i-run-this-group.yml'
  | 'remove-details.yml'
  | 'suggest-group.yml'
  | 'bulletin-board.yml';

const TITLE_PREFIX: Record<IssueTemplate, string> = {
  'correct-listing.yml': 'Correction: ',
  'i-run-this-group.yml': 'Organizer: ',
  'remove-details.yml': 'Removal: ',
  'suggest-group.yml': 'Suggest: ',
  'bulletin-board.yml': 'Bulletin board: ',
};

export function issueUrl(template: IssueTemplate, fields: Record<string, string> = {}, subject?: string): string {
  const params = new URLSearchParams();
  params.set('template', template);
  if (subject) params.set('title', TITLE_PREFIX[template] + subject);
  for (const [k, v] of Object.entries(fields)) params.set(k, v);
  return `${REPO_URL}/issues/new?${params.toString()}`;
}

export interface GroupIssueLinks {
  correct: string;
  iRun: string;
  remove: string;
}

/** The three links on every group page. `pageUrl` is the group's public page address. */
export function groupIssueLinks(name: string, pageUrl: string): GroupIssueLinks {
  const fields = { group: `${name} (${pageUrl})` };
  return {
    correct: issueUrl('correct-listing.yml', fields, name),
    iRun: issueUrl('i-run-this-group.yml', fields, name),
    remove: issueUrl('remove-details.yml', fields, name),
  };
}

export function suggestGroupUrl(): string {
  return issueUrl('suggest-group.yml');
}
