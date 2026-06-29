import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('../../../utils/api');

import GoalsPanel from '../GoalsPanel.jsx';
import { apiCall } from '../../../utils/api';

describe('GoalsPanel', () => {
  const mockGoalsData = {
    daily: {
      expiresAt: Date.now() + 3600000,
      goals: [
        { id: 1, label: 'Win 5 battles', progress: 3, target: 5, prizeAmount: 100, prizeType: 'gold', claimed: false },
        { id: 2, label: 'Build 2 farms', progress: 2, target: 2, prizeAmount: 50, prizeType: 'resources', claimed: true }
      ]
    },
    weekly: {
      expiresAt: Date.now() + 604800000,
      goals: [
        { id: 3, label: 'Reach level 10', progress: 8, target: 10, prizeAmount: 500, prizeType: 'gold', claimed: false }
      ]
    }
  };

  beforeEach(() => {
    vi.clearAllMocks();
    apiCall.mockResolvedValue(mockGoalsData);
  });

  it('should render the goals panel', async () => {
    render(<GoalsPanel />);
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /📝 Goals/i })).toBeInTheDocument();
    });
  });

  it('should display loading state initially', () => {
    apiCall.mockImplementation(() => new Promise(() => {}));
    render(<GoalsPanel />);
    expect(screen.getByText(/Loading goals/i)).toBeInTheDocument();
  });

  it('should fetch goals on mount', async () => {
    render(<GoalsPanel />);
    await waitFor(() => {
      expect(apiCall).toHaveBeenCalledWith('/api/kingdom/goals');
    });
  });

  it('should display daily goals section', async () => {
    render(<GoalsPanel />);
    await waitFor(() => {
      expect(screen.getByText(/Daily Goals/i)).toBeInTheDocument();
    });
  });

  it('should display weekly goals section', async () => {
    render(<GoalsPanel />);
    await waitFor(() => {
      expect(screen.getByText(/Weekly Goals/i)).toBeInTheDocument();
    });
  });

  it('should render goal cards with progress information', async () => {
    render(<GoalsPanel />);
    await waitFor(() => {
      expect(screen.getByText(/Win 5 battles/i)).toBeInTheDocument();
      expect(screen.getByText(/3 \/ 5/i)).toBeInTheDocument();
    });
  });

  it('should display claim button for incomplete goals', async () => {
    render(<GoalsPanel />);
    await waitFor(() => {
      const claimButtons = screen.getAllByRole('button', { name: /Incomplete/i });
      expect(claimButtons.length).toBeGreaterThan(0);
    });
  });

  it('should display claimed status for completed goals', async () => {
    render(<GoalsPanel />);
    await waitFor(() => {
      expect(screen.getByText(/Claimed ✔/i)).toBeInTheDocument();
    });
  });

  it('should enable claim button when goal is complete', async () => {
    render(<GoalsPanel />);
    await waitFor(() => {
      const claimButton = screen.getByRole('button', { name: /Claim/ });
      expect(claimButton).not.toBeDisabled();
    });
  });

  it('should call claim API when claim button is clicked', async () => {
    const user = userEvent.setup();
    apiCall.mockResolvedValueOnce(mockGoalsData).mockResolvedValueOnce({ ok: true, message: 'Goal claimed' });
    render(<GoalsPanel />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Claim/ })).toBeInTheDocument();
    });

    const claimButton = screen.getByRole('button', { name: /Claim/ });
    await user.click(claimButton);

    await waitFor(() => {
      expect(apiCall).toHaveBeenCalledWith('/api/kingdom/goals/claim', expect.any(Object));
    });
  });

  it('should display prize information', async () => {
    render(<GoalsPanel />);
    await waitFor(() => {
      expect(screen.getByText(/100 Gold/i)).toBeInTheDocument();
      expect(screen.getByText(/50 Resources/i)).toBeInTheDocument();
    });
  });

  it('should show refresh button', async () => {
    render(<GoalsPanel />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Refresh/ })).toBeInTheDocument();
    });
  });

  it('should refresh goals when refresh button is clicked', async () => {
    const user = userEvent.setup();
    render(<GoalsPanel />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Refresh/ })).toBeInTheDocument();
    });

    const refreshButton = screen.getByRole('button', { name: /Refresh/ });
    await user.click(refreshButton);

    await waitFor(() => {
      expect(apiCall).toHaveBeenCalledTimes(2); // once on mount, once on refresh
    });
  });

  it('should display countdown time until goals reset', async () => {
    render(<GoalsPanel />);
    await waitFor(() => {
      expect(screen.getByText(/Resets in/i)).toBeInTheDocument();
    });
  });

  it('should have goals panel structure', async () => {
    const { container } = render(<GoalsPanel />);
    const panel = container.querySelector('#goals') || container.querySelector('.panel');
    expect(panel).toBeInTheDocument();
  });
});
