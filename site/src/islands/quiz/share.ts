import { fill } from '../../lib/inline';
import { absoluteUrl, groupPath } from '../../lib/site';
import { share as t } from '../../strings/en';

// "Send to a friend". A shared link carries the group's page address and nothing else: never the
// quiz answers, never a list of what you picked. Where the phone has a share sheet we use it;
// elsewhere the message can be copied or opened as a text.

/** The public page for one group. The address holds the group id only. */
export function shareUrl(id: string, base?: string): string {
  return absoluteUrl(groupPath(id), base);
}

export function shareMessage(name: string, id: string, base?: string): string {
  return fill(t.message, { name, url: shareUrl(id, base) });
}

/** A link that opens the text message app with the words already in it. */
export function smsHref(message: string): string {
  return `sms:?&body=${encodeURIComponent(message)}`;
}

export interface ShareData {
  title: string;
  text: string;
  url: string;
}

export function shareData(name: string, id: string, base?: string): ShareData {
  return { title: name, text: fill(t.shareText, { name }), url: shareUrl(id, base) };
}

/** True when the browser has the phone's share sheet. */
export function canNativeShare(nav: { share?: unknown } | undefined = typeof navigator === 'undefined' ? undefined : navigator): boolean {
  return typeof nav?.share === 'function';
}
