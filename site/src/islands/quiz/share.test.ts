import { describe, expect, it } from 'vitest';
import { canNativeShare, shareData, shareMessage, shareUrl, smsHref } from './share';

describe('sending a group to a friend', () => {
  it('links to the group page and nothing else', () => {
    const url = shareUrl('philadelphia-grotto', '/find-your-jawn/');
    expect(url).toBe('https://holdthedoorhoid.github.io/find-your-jawn/g/philadelphia-grotto/');
    expect(url).not.toMatch(/[?#]/);
  });

  it('puts the group name and link in the message, never anything about the person', () => {
    const msg = shareMessage('Philadelphia Grotto', 'philadelphia-grotto', '/find-your-jawn/');
    expect(msg).toBe('I found this group on Find Your Jawn: Philadelphia Grotto. https://holdthedoorhoid.github.io/find-your-jawn/g/philadelphia-grotto/');
    expect(msg).not.toMatch(/answer|quiz|you said|matches/i);
  });

  it('opens the text message app with the words in it', () => {
    const href = smsHref('Hello, world & more');
    expect(href).toBe('sms:?&body=Hello%2C%20world%20%26%20more');
    expect(decodeURIComponent(href.slice('sms:?&body='.length))).toBe('Hello, world & more');
  });

  it('fills the phone share sheet with the same link', () => {
    const d = shareData('Philadelphia Grotto', 'philadelphia-grotto', '/find-your-jawn/');
    expect(d.url).toBe('https://holdthedoorhoid.github.io/find-your-jawn/g/philadelphia-grotto/');
    expect(d.title).toBe('Philadelphia Grotto');
  });

  it('knows whether the browser can share', () => {
    expect(canNativeShare({ share: () => Promise.resolve() })).toBe(true);
    expect(canNativeShare({})).toBe(false);
    expect(canNativeShare(undefined)).toBe(false);
  });
});
