import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('../../../utils/api');
vi.mock('../../../utils/toast.js');
vi.mock('../../../utils/bountyTarget.js', () => ({
  registerSetBountyTarget: vi.fn(() => vi.fn()),
}));
vi.mock('../../../stores', () => ({
  useRankingsCache: vi.fn(),
  useKingdomId: vi.fn(),
  useGold: vi.fn(),
}));

import BountiesPanel from '../BountiesPanel.jsx';
import { apiCall } from '../../../utils/api';
import { toast } from '../../../utils/toast.js';
import { useRankingsCache, useKingdomId, useGold } from '../../../stores';

describe('BountiesPanel', () => {
  const mockBounties = [
    { id: 1, target_name: 'Iron Hold', placer_name: 'Alice', amount: 5000, created_at: Date.now() },
  ];
  const mockRankings = [
    { id: 10, name: 'Iron Hold', username: 'alice' },
    { id: 20, name: 'Silverwood', username: 'bob' },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    apiCall.mockResolvedValue(mockBounties);
    useRankingsCache.mockReturnValue(mockRankings);
    useKingdomId.mockReturnValue(99);
    useGold.mockReturnValue(10000);
  });

  it('renders the bounty board heading', async () => {
    render(<BountiesPanel />);
    await waitFor(() => {
      expect(screen.getByText(/Bounty Board/i)).toBeInTheDocument();
    });
  });

  it('shows a loading state before bounties arrive', () => {
    apiCall.mockImplementation(() => new Promise(() => {}));
    render(<BountiesPanel />);
    expect(screen.getByText(/Loading bounties/i)).toBeInTheDocument();
  });

  it('fetches bounties on mount', async () => {
    render(<BountiesPanel />);
    await waitFor(() => {
      expect(apiCall).toHaveBeenCalledWith('/api/world/bounties');
    });
  });

  it('renders active bounties once loaded', async () => {
    render(<BountiesPanel />);
    await waitFor(() => {
      expect(screen.getByText('Iron Hold')).toBeInTheDocument();
      expect(screen.getByText(/5,000 GC/)).toBeInTheDocument();
    });
  });

  it('shows an empty state when there are no bounties', async () => {
    apiCall.mockResolvedValue([]);
    render(<BountiesPanel />);
    await waitFor(() => {
      expect(screen.getByText(/No active bounties/i)).toBeInTheDocument();
    });
  });

  it('shows an error message when the fetch returns an error', async () => {
    apiCall.mockResolvedValue({ error: 'Server unavailable' });
    render(<BountiesPanel />);
    await waitFor(() => {
      expect(screen.getByText('Server unavailable')).toBeInTheDocument();
    });
  });

  it('excludes the player\'s own kingdom from the target list', async () => {
    useKingdomId.mockReturnValue(10);
    render(<BountiesPanel />);
    await waitFor(() => {
      expect(screen.getByText(/Bounty Board/i)).toBeInTheDocument();
    });

    const select = screen.getByRole('combobox');
    expect(screen.queryByRole('option', { name: 'Iron Hold (alice)' })).not.toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Silverwood (bob)' })).toBeInTheDocument();
    expect(select).toBeInTheDocument();
  });

  it('rejects placing a bounty with no target selected', async () => {
    const user = userEvent.setup();
    render(<BountiesPanel />);
    await waitFor(() => expect(apiCall).toHaveBeenCalledWith('/api/world/bounties'));

    await user.click(screen.getByRole('button', { name: /Place Bounty/i }));
    expect(toast).toHaveBeenCalledWith('Select a target kingdom first', 'error');
  });

  it('rejects a bounty below the 1,000 gold minimum', async () => {
    const user = userEvent.setup();
    render(<BountiesPanel />);
    await waitFor(() => expect(apiCall).toHaveBeenCalledWith('/api/world/bounties'));

    const select = screen.getByRole('combobox');
    await user.selectOptions(select, '10');
    const amountInput = screen.getByPlaceholderText('Qty');
    await user.type(amountInput, '500');
    await user.click(screen.getByRole('button', { name: /Place Bounty/i }));

    expect(toast).toHaveBeenCalledWith('Minimum bounty is 1,000 GC', 'error');
  });

  it('rejects a bounty larger than available gold', async () => {
    const user = userEvent.setup();
    useGold.mockReturnValue(1000);
    render(<BountiesPanel />);
    await waitFor(() => expect(apiCall).toHaveBeenCalledWith('/api/world/bounties'));

    const select = screen.getByRole('combobox');
    await user.selectOptions(select, '10');
    const amountInput = screen.getByPlaceholderText('Qty');
    await user.type(amountInput, '5000');
    await user.click(screen.getByRole('button', { name: /Place Bounty/i }));

    expect(toast).toHaveBeenCalledWith('Not enough gold', 'error');
  });

  it('places a valid bounty and refreshes the list', async () => {
    const user = userEvent.setup();
    apiCall
      .mockResolvedValueOnce(mockBounties) // initial fetch
      .mockResolvedValueOnce({ ok: true, message: 'Bounty placed!' }) // POST
      .mockResolvedValueOnce(mockBounties); // refresh after placing

    render(<BountiesPanel />);
    await waitFor(() => expect(apiCall).toHaveBeenCalledWith('/api/world/bounties'));

    const select = screen.getByRole('combobox');
    await user.selectOptions(select, '10');
    const amountInput = screen.getByPlaceholderText('Qty');
    await user.type(amountInput, '5000');
    await user.click(screen.getByRole('button', { name: /Place Bounty/i }));

    await waitFor(() => {
      expect(apiCall).toHaveBeenCalledWith('/api/world/bounties', {
        method: 'POST',
        body: { target_id: 10, amount: 5000 },
      });
    });
    await waitFor(() => expect(toast).toHaveBeenCalledWith('Bounty placed!', 'success'));
  });

  it('manually refreshes bounties when the refresh button is clicked', async () => {
    const user = userEvent.setup();
    render(<BountiesPanel />);
    await waitFor(() => expect(apiCall).toHaveBeenCalledTimes(1));

    await user.click(screen.getByRole('button', { name: /Refresh/i }));
    await waitFor(() => expect(apiCall).toHaveBeenCalledTimes(2));
  });
});
