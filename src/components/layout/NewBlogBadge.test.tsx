// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';

/**
 * The badge moved from a server-resolved prop to fetching its own state,
 * because resolving it during prerender meant promoting a post had to purge
 * every route under the root layout. With BUILD_ALL=1 that discarded all
 * ~1179 prebuilt pages, minutes after a deploy had just built them.
 *
 * When that change was made there was no way to exercise it: no post was
 * promoted, so the visible branch never ran, and the repo had no DOM test
 * environment. These cover the paths that could not be checked by hand.
 */

vi.mock('next/navigation', () => ({
  usePathname: () => mockPathname,
}));

let mockPathname = '/week/fall-2026/4';

async function loadBadge() {
  // Fresh module each time: the request is memoised at module scope so that
  // the desktop header and the mobile nav share one call per page load.
  vi.resetModules();
  const mod = await import('./NewBlogBadge');
  return mod.NewBlogBadge;
}

function mockBadgeResponse(badgeId: string | null) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ badgeId }),
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('NewBlogBadge', () => {
  beforeEach(() => {
    mockPathname = '/week/fall-2026/4';
    localStorage.clear();
  });
  afterEach(() => {
    // vitest runs with globals: false, so testing-library never registers its
    // automatic afterEach cleanup. Without this, renders pile up in the same
    // document and queries start matching elements from earlier tests.
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('shows the pill when a post is promoted and the reader has not seen it', async () => {
    mockBadgeResponse('my-post|1756000000000');
    const NewBlogBadge = await loadBadge();
    render(<NewBlogBadge />);
    expect(await screen.findByText('New')).toBeTruthy();
  });

  it('renders nothing when no post is promoted', async () => {
    // The state production was in when this change was written, which is
    // exactly why the visible branch above could not be verified by hand.
    mockBadgeResponse(null);
    const NewBlogBadge = await loadBadge();
    const { container } = render(<NewBlogBadge />);
    await waitFor(() => expect(container.textContent).toBe(''));
  });

  it('stays hidden once the reader has seen that exact post', async () => {
    localStorage.setItem('splitz-blog-seen', 'my-post|1756000000000');
    mockBadgeResponse('my-post|1756000000000');
    const NewBlogBadge = await loadBadge();
    const { container } = render(<NewBlogBadge />);
    await waitFor(() => expect(container.textContent).toBe(''));
  });

  it('reappears when a different post is promoted', async () => {
    localStorage.setItem('splitz-blog-seen', 'old-post|1750000000000');
    mockBadgeResponse('new-post|1756000000000');
    const NewBlogBadge = await loadBadge();
    render(<NewBlogBadge />);
    expect(await screen.findByText('New')).toBeTruthy();
  });

  it('marks the post seen when the reader is on a blog route', async () => {
    mockPathname = '/blog/some-post';
    mockBadgeResponse('my-post|1756000000000');
    const NewBlogBadge = await loadBadge();
    const { container } = render(<NewBlogBadge />);
    await waitFor(() => {
      expect(localStorage.getItem('splitz-blog-seen')).toBe('my-post|1756000000000');
    });
    expect(container.textContent).toBe('');
  });

  it('makes one request even though the header and mobile nav both render it', async () => {
    const fetchMock = mockBadgeResponse('my-post|1756000000000');
    const NewBlogBadge = await loadBadge();
    render(<><NewBlogBadge /><NewBlogBadge /></>);
    await screen.findAllByText('New');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('stays hidden if the endpoint fails, rather than throwing', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    const NewBlogBadge = await loadBadge();
    const { container } = render(<NewBlogBadge />);
    await waitFor(() => expect(container.textContent).toBe(''));
  });
});
