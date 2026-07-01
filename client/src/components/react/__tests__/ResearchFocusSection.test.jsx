import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('../../../stores', () => ({
  useResearchStore: {
    getState: vi.fn(),
  },
}));

vi.mock('../../../utils/toast.js', () => ({
  toast: vi.fn(),
}));

import { useResearchStore } from '../../../stores';
import { toast } from '../../../utils/toast.js';
import { ResearchFocusSection } from '../StudiesTabs/ResearchFocusSection.jsx';

describe('ResearchFocusSection', () => {
  const setResearchFocus = vi.fn();
  const fetchStudiesData = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    useResearchStore.getState.mockReturnValue({ setResearchFocus });
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const baseProps = {
    studiesData: { school_upgrades: {} },
    state: {
      res_economy: 12,
      res_weapons: 8,
      res_spellbook: 40,
      school_of_magic: null,
    },
    focus1Value: 'economy',
    setFocus1Value: vi.fn(),
    focus2Value: 'weapons',
    setFocus2Value: vi.fn(),
    fetchStudiesData,
  };

  it('sends only the primary focus when repository is unavailable', async () => {
    const user = userEvent.setup();
    fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ research_focus: ['economy'] }),
    });

    render(<ResearchFocusSection {...baseProps} />);
    await user.click(screen.getByRole('button', { name: /save focus/i }));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('/api/kingdom/research-focus', expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ focus: ['economy'] }),
      }));
    });
    expect(setResearchFocus).toHaveBeenCalledWith(['economy']);
    expect(toast).toHaveBeenCalledWith('Research focus saved — economy', 'success');
  });

  it('renders and submits both focuses when repository is unlocked', async () => {
    const user = userEvent.setup();
    fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ research_focus: ['economy', 'weapons'] }),
    });

    render(
      <ResearchFocusSection
        {...baseProps}
        studiesData={{ school_upgrades: { repository: true } }}
      />
    );

    expect(screen.getByText(/secondary discipline/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /save focus/i }));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('/api/kingdom/research-focus', expect.objectContaining({
        body: JSON.stringify({ focus: ['economy', 'weapons'] }),
      }));
    });
    expect(setResearchFocus).toHaveBeenCalledWith(['economy', 'weapons']);
  });
});
