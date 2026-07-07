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

vi.mock('../../../utils/api.mjs', () => ({
  apiCall: vi.fn(),
  getCsrfToken: vi.fn(() => 'test-csrf-token'),
}));

import { useResearchStore } from '../../../stores';
import { toast } from '../../../utils/toast.js';
import { apiCall } from '../../../utils/api.mjs';
import { ResearchFocusSection } from '../StudiesTabs/ResearchFocusSection.jsx';

describe('ResearchFocusSection', () => {
  const setResearchFocus = vi.fn();
  const fetchStudiesData = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    useResearchStore.getState.mockReturnValue({ setResearchFocus });
    apiCall.mockResolvedValue({});
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
    apiCall.mockResolvedValue({ research_focus: ['economy'] });

    render(<ResearchFocusSection {...baseProps} />);
    await user.click(screen.getByRole('button', { name: /save focus/i }));

    await waitFor(() => {
      expect(apiCall).toHaveBeenCalledWith('/api/kingdom/research-focus', {
        method: 'POST',
        body: { focus: ['economy'] },
      });
    });
    expect(setResearchFocus).toHaveBeenCalledWith(['economy']);
    expect(toast).toHaveBeenCalledWith('Research focus saved — economy', 'success');
  });

  it('renders and submits both focuses when repository is unlocked', async () => {
    const user = userEvent.setup();
    apiCall.mockResolvedValue({ research_focus: ['economy', 'weapons'] });

    render(
      <ResearchFocusSection
        {...baseProps}
        studiesData={{ school_upgrades: { repository: true } }}
      />
    );

    expect(screen.getByText(/secondary discipline/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /save focus/i }));

    await waitFor(() => {
      expect(apiCall).toHaveBeenCalledWith('/api/kingdom/research-focus', {
        method: 'POST',
        body: { focus: ['economy', 'weapons'] },
      });
    });
    expect(setResearchFocus).toHaveBeenCalledWith(['economy', 'weapons']);
  });
});
