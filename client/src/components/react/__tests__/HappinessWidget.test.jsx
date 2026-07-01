import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('../../../hooks/useGameState', () => ({
  useGameMutationEvents: vi.fn(),
}));

const receiveServerSnapshot = vi.fn();

vi.mock('../../../stores', () => ({
  useHappiness: vi.fn(),
  usePopulationStore: {
    getState: () => ({ receiveServerSnapshot }),
  },
}));

import HappinessWidget from '../HappinessWidget.jsx';
import { useGameMutationEvents } from '../../../hooks/useGameState';
import { useHappiness } from '../../../stores';

describe('HappinessWidget', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useHappiness.mockReturnValue(65);
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ happiness: 65 }),
    });
  });

  it('renders the current happiness value', () => {
    render(<HappinessWidget />);
    expect(screen.getByText('65/120')).toBeInTheDocument();
  });

  it('falls back to 50 when happiness is not yet loaded', () => {
    useHappiness.mockReturnValue(undefined);
    render(<HappinessWidget />);
    expect(screen.getByText('50/120')).toBeInTheDocument();
  });

  it('fetches happiness status on mount', async () => {
    render(<HappinessWidget />);
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/kingdom/happiness-status');
    });
  });

  it('applies the fetched snapshot to the population store', async () => {
    render(<HappinessWidget />);
    await waitFor(() => {
      expect(receiveServerSnapshot).toHaveBeenCalledWith({ happiness: 65 });
    });
  });

  it('subscribes to mutation events for refresh', () => {
    render(<HappinessWidget />);
    expect(useGameMutationEvents).toHaveBeenCalledTimes(1);
  });

  it('refetches when a relevant mutation event fires', async () => {
    let capturedHandler;
    useGameMutationEvents.mockImplementation((handler) => {
      capturedHandler = handler;
    });

    render(<HappinessWidget />);
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));

    capturedHandler({ reason: 'turn' });
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(2));
  });

  it('ignores irrelevant mutation event reasons', async () => {
    let capturedHandler;
    useGameMutationEvents.mockImplementation((handler) => {
      capturedHandler = handler;
    });

    render(<HappinessWidget />);
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));

    capturedHandler({ reason: 'unrelated-event' });
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('does not throw when the fetch fails', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('network error'));
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(<HappinessWidget />);
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    expect(consoleSpy).toHaveBeenCalled();

    consoleSpy.mockRestore();
  });

  it('calls onOpenTab when "View Details" is clicked', async () => {
    const user = userEvent.setup();
    const onOpenTab = vi.fn();
    render(<HappinessWidget onOpenTab={onOpenTab} />);

    await user.click(screen.getByRole('button', { name: /View Details/i }));
    expect(onOpenTab).toHaveBeenCalledTimes(1);
  });
});
