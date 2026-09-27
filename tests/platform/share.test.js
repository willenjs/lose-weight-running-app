import { describe, it, expect, vi, afterEach } from 'vitest';
import { share, canShare } from '../../src/platform/share.js';

const payload = { title: 'PulseRun', text: 'Done!', url: 'https://example.test/' };

function stubNavigator(nav) {
  vi.stubGlobal('navigator', nav);
}

afterEach(() => vi.unstubAllGlobals());

describe('share', () => {
  it('uses the Web Share API when present', async () => {
    const nav = { share: vi.fn().mockResolvedValue(undefined), clipboard: { writeText: vi.fn() } };
    stubNavigator(nav);
    expect(await share(payload)).toBe('shared');
    expect(nav.share).toHaveBeenCalledWith(payload);
    expect(nav.clipboard.writeText).not.toHaveBeenCalled();
  });

  it('treats a dismissed share sheet as done, without copying', async () => {
    const abort = Object.assign(new Error('cancelled'), { name: 'AbortError' });
    const nav = { share: vi.fn().mockRejectedValue(abort), clipboard: { writeText: vi.fn() } };
    stubNavigator(nav);
    expect(await share(payload)).toBe('shared');
    expect(nav.clipboard.writeText).not.toHaveBeenCalled();
  });

  it('falls back to the clipboard when sharing fails', async () => {
    const nav = {
      share: vi.fn().mockRejectedValue(new Error('NotAllowedError')),
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    };
    stubNavigator(nav);
    expect(await share(payload)).toBe('copied');
    expect(nav.clipboard.writeText).toHaveBeenCalledWith('Done! https://example.test/');
  });

  it('copies when only the clipboard exists', async () => {
    stubNavigator({ clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
    expect(await share(payload)).toBe('copied');
  });

  it('reports unavailable and never rejects', async () => {
    stubNavigator({ clipboard: { writeText: vi.fn().mockRejectedValue(new Error('denied')) } });
    expect(await share(payload)).toBe('unavailable');
    stubNavigator({ share: () => { throw new Error('sync'); } });
    expect(await share(payload)).toBe('unavailable');
    stubNavigator(undefined);
    expect(await share(payload)).toBe('unavailable');
  });
});

describe('canShare', () => {
  it('is true with either API and false with neither', () => {
    stubNavigator({ share: () => {} });
    expect(canShare()).toBe(true);
    stubNavigator({ clipboard: { writeText: () => {} } });
    expect(canShare()).toBe(true);
    stubNavigator({});
    expect(canShare()).toBe(false);
    stubNavigator(undefined);
    expect(canShare()).toBe(false);
  });
});
