import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import EmptyState from '../EmptyState.jsx';

describe('EmptyState', () => {
  it('should render without crashing', () => {
    const { container } = render(<EmptyState />);
    expect(container.firstChild).toBeInTheDocument();
  });

  it('should display an empty state message', () => {
    render(<EmptyState />);
    expect(screen.getByText(/Nothing here yet/i)).toBeInTheDocument();
  });

  it('should have empty-state class', () => {
    const { container } = render(<EmptyState />);
    const emptyStateEl = container.querySelector('.empty-state');
    expect(emptyStateEl).toBeInTheDocument();
  });

  it('should render custom props and handle action clicks', async () => {
    const handleAction = vi.fn();
    render(
      <EmptyState
        icon="🔍"
        title="No results"
        description="Try adjusting your search"
        actionLabel="Reset"
        onAction={handleAction}
      />
    );

    expect(screen.getByText('🔍')).toBeInTheDocument();
    expect(screen.getByText('No results')).toBeInTheDocument();
    expect(screen.getByText('Try adjusting your search')).toBeInTheDocument();

    const button = screen.getByRole('button', { name: 'Reset' });
    expect(button).toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(button);
    expect(handleAction).toHaveBeenCalledTimes(1);
  });
});
