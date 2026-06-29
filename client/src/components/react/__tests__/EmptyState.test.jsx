import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

import EmptyState from '../EmptyState.jsx';

describe('EmptyState', () => {
  it('should render without crashing', () => {
    const { container } = render(<EmptyState />);
    expect(container).toBeInTheDocument();
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

  it('should be centered with proper styling', () => {
    const { container } = render(<EmptyState />);
    const emptyStateEl = container.querySelector('.empty-state');
    expect(emptyStateEl.className).toContain('flex');
    expect(emptyStateEl.className).toContain('items-center');
    expect(emptyStateEl.className).toContain('justify-center');
  });
});
