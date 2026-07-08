import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';

import ProgressBar from '../ProgressBar.jsx';

describe('ProgressBar', () => {
  it('should render without crashing', () => {
    const { container } = render(<ProgressBar percent={50} />);
    expect(container.firstChild).toBeInTheDocument();
  });

  it('should clamp percent between 0 and 100', () => {
    const { container } = render(<ProgressBar percent={150} />);
    const bar = container.querySelector('.prog-bar');
    expect(bar.style.width).toBe('100%');
  });

  it('should handle string percent', () => {
    const { container } = render(<ProgressBar percent="75" />);
    const bar = container.querySelector('.prog-bar');
    expect(bar.style.width).toBe('75%');
  });

  it('should apply variant class', () => {
    const { container } = render(<ProgressBar percent={30} variant="danger" />);
    const bar = container.querySelector('.prog-bar');
    expect(bar.className).toContain('danger');
  });
});
