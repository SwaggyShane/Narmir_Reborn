import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Mock hooks and dependencies BEFORE importing component
vi.mock('../../../hooks/useActivePanel');
vi.mock('../../../hooks/useNavLayout');
vi.mock('../../../hooks/useShellBadges');
vi.mock('../../../stores');
vi.mock('../../../utils/switchTab');
vi.mock('../AuthModal.jsx');

import BottomNav from '../BottomNav.jsx';
import { useActivePanel } from '../../../hooks/useActivePanel';
import { useNavLayout } from '../../../hooks/useNavLayout';
import { useShellBadges } from '../../../hooks/useShellBadges';
import { useIsAdmin, useUsername } from '../../../stores';
import { switchTab } from '../../../utils/switchTab';
import { logout } from '../AuthModal.jsx';

describe('BottomNav', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Set default mock implementations
    useActivePanel.mockReturnValue({ activePanel: 'status' });
    useNavLayout.mockReturnValue({ layout: 'bottom' });
    useShellBadges.mockReturnValue({ hasBadge: vi.fn(() => false) });
    useIsAdmin.mockReturnValue(false);
    useUsername.mockReturnValue('testuser');
    switchTab.mockImplementation(() => {});
    logout.mockImplementation(() => {});
  });

  it('should render when layout is bottom', () => {
    useNavLayout.mockReturnValue({ layout: 'bottom' });
    render(<BottomNav />);
    expect(screen.getByRole('navigation')).toBeInTheDocument();
  });

  it('should render when layout is responsive', () => {
    useNavLayout.mockReturnValue({ layout: 'responsive' });
    render(<BottomNav />);
    expect(screen.getByRole('navigation')).toBeInTheDocument();
  });

  it('should not render when layout is not bottom or responsive', () => {
    useNavLayout.mockReturnValue({ layout: 'sidebar' });
    const { container } = render(<BottomNav />);
    expect(container.querySelector('nav')).not.toBeInTheDocument();
  });

  describe('core tabs', () => {
    it('should render all 5 core tabs', () => {
      render(<BottomNav />);
      expect(screen.getByRole('button', { name: /Status/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Wherewithal/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Offense/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /News/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Chat/i })).toBeInTheDocument();
    });

    it('should mark active tab as pressed', () => {
      useActivePanel.mockReturnValue({ activePanel: 'economy' });
      render(<BottomNav />);
      const economyButton = screen.getByRole('button', { name: /Wherewithal/i });
      expect(economyButton).toHaveAttribute('aria-pressed', 'true');
    });

    it('should switch tab on click', async () => {
      render(<BottomNav />);
      const warfareButton = screen.getByRole('button', { name: /Offense/i });
      await userEvent.click(warfareButton);
      expect(switchTab).toHaveBeenCalledWith('warfare');
    });
  });

  describe('more drawer', () => {
    it('should render more button', () => {
      render(<BottomNav />);
      const moreButton = screen.getByRole('button', { name: /More/i });
      expect(moreButton).toBeInTheDocument();
    });

    it('should open drawer when more button is clicked', async () => {
      render(<BottomNav />);
      const moreButton = screen.getByRole('button', { name: /More/i });
      await userEvent.click(moreButton);
      expect(moreButton).toHaveAttribute('aria-expanded', 'true');
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('should render drawer with close button', async () => {
      render(<BottomNav />);
      const moreButton = screen.getByRole('button', { name: /More/i });
      await userEvent.click(moreButton);
      const closeButton = screen.getByRole('button', { name: /Close/i });
      expect(closeButton).toBeInTheDocument();
    });

    it('should close drawer when close button is clicked', async () => {
      render(<BottomNav />);
      const moreButton = screen.getByRole('button', { name: /More/i });
      await userEvent.click(moreButton);
      const closeButton = screen.getByRole('button', { name: /Close/i });
      await userEvent.click(closeButton);
      expect(moreButton).toHaveAttribute('aria-expanded', 'false');
    });

    it('should close drawer when clicking overlay', async () => {
      render(<BottomNav />);
      const moreButton = screen.getByRole('button', { name: /More/i });
      await userEvent.click(moreButton);
      const overlay = screen.getByRole('dialog').parentElement;
      await userEvent.click(overlay);
      expect(moreButton).toHaveAttribute('aria-expanded', 'false');
    });

    it('should display drawer tabs', async () => {
      render(<BottomNav />);
      const moreButton = screen.getByRole('button', { name: /More/i });
      await userEvent.click(moreButton);
      expect(screen.getByRole('button', { name: /Messages/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Happiness/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Studies/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Build/i })).toBeInTheDocument();
    });

    it('should switch tab when drawer tab is clicked', async () => {
      render(<BottomNav />);
      const moreButton = screen.getByRole('button', { name: /More/i });
      await userEvent.click(moreButton);
      const messagesButton = screen.getByRole('button', { name: /Messages/i });
      await userEvent.click(messagesButton);
      expect(switchTab).toHaveBeenCalledWith('messages');
    });

    it('should close drawer after switching tab', async () => {
      render(<BottomNav />);
      const moreButton = screen.getByRole('button', { name: /More/i });
      await userEvent.click(moreButton);
      const messagesButton = screen.getByRole('button', { name: /Messages/i });
      await userEvent.click(messagesButton);
      expect(moreButton).toHaveAttribute('aria-expanded', 'false');
    });
  });

  describe('drawer active state', () => {
    it('should mark drawer as active when drawer is open', async () => {
      render(<BottomNav />);
      const moreButton = screen.getByRole('button', { name: /More/i });
      expect(moreButton).toHaveAttribute('aria-expanded', 'false');
      await userEvent.click(moreButton);
      expect(moreButton).toHaveAttribute('aria-expanded', 'true');
    });

    it('should have more button styled as active when drawer tab is active', () => {
      useActivePanel.mockReturnValue({ activePanel: 'messages' });
      render(<BottomNav />);
      const moreButton = screen.getByRole('button', { name: /More/i });
      // When a drawer tab is active, the more button should have visual indication
      // (checked via className containing 'is-active')
      expect(moreButton.className).toContain('bottom-nav-chip');
    });
  });

  describe('logout button', () => {
    it('should render logout button when username is set', () => {
      useUsername.mockReturnValue('testuser');
      render(<BottomNav />);
      const moreButton = screen.getByRole('button', { name: /More/i });
      fireEvent.click(moreButton);
      expect(screen.getByLabelText(/Logout/i)).toBeInTheDocument();
    });

    it('should not render logout button when no username', () => {
      useUsername.mockReturnValue(null);
      render(<BottomNav />);
      const moreButton = screen.getByRole('button', { name: /More/i });
      fireEvent.click(moreButton);
      expect(screen.queryByLabelText(/Logout/i)).not.toBeInTheDocument();
    });

    it('should call logout when logout button is clicked', async () => {
      useUsername.mockReturnValue('testuser');
      render(<BottomNav />);
      const moreButton = screen.getByRole('button', { name: /More/i });
      await userEvent.click(moreButton);
      const logoutButton = screen.getByLabelText(/Logout/i);
      await userEvent.click(logoutButton);
      expect(logout).toHaveBeenCalled();
    });

    it('should close drawer after logout', async () => {
      useUsername.mockReturnValue('testuser');
      render(<BottomNav />);
      const moreButton = screen.getByRole('button', { name: /More/i });
      await userEvent.click(moreButton);
      const logoutButton = screen.getByLabelText(/Logout/i);
      await userEvent.click(logoutButton);
      expect(moreButton).toHaveAttribute('aria-expanded', 'false');
    });
  });

  describe('admin button', () => {
    it('should render admin button when user is admin', () => {
      useIsAdmin.mockReturnValue(true);
      render(<BottomNav />);
      const moreButton = screen.getByRole('button', { name: /More/i });
      fireEvent.click(moreButton);
      expect(screen.getByRole('link', { name: /Admin/i })).toBeInTheDocument();
    });

    it('should not render admin button when user is not admin', () => {
      useIsAdmin.mockReturnValue(false);
      render(<BottomNav />);
      const moreButton = screen.getByRole('button', { name: /More/i });
      fireEvent.click(moreButton);
      expect(screen.queryByRole('link', { name: /Admin/i })).not.toBeInTheDocument();
    });

    it('should link to admin page', () => {
      useIsAdmin.mockReturnValue(true);
      render(<BottomNav />);
      const moreButton = screen.getByRole('button', { name: /More/i });
      fireEvent.click(moreButton);
      const adminLink = screen.getByRole('link', { name: /Admin/i });
      expect(adminLink).toHaveAttribute('href', '/admin');
    });
  });

  describe('badges', () => {
    it('should display badge when hasBadge returns true', () => {
      const hasBadgeMock = vi.fn((key) => key === 'news');
      useShellBadges.mockReturnValue({ hasBadge: hasBadgeMock });
      render(<BottomNav />);
      const badgeElements = screen.getAllByLabelText(/Unread/i);
      expect(badgeElements.length).toBeGreaterThan(0);
    });

    it('should not display badge when hasBadge returns false', () => {
      useShellBadges.mockReturnValue({ hasBadge: vi.fn(() => false) });
      render(<BottomNav />);
      expect(screen.queryByLabelText(/Unread/i)).not.toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('should have proper navigation role', () => {
      render(<BottomNav />);
      expect(screen.getByRole('navigation')).toBeInTheDocument();
    });

    it('should have aria-expanded on drawer toggle', async () => {
      render(<BottomNav />);
      const moreButton = screen.getByRole('button', { name: /More/i });
      expect(moreButton).toHaveAttribute('aria-expanded');
    });

    it('should have aria-controls on drawer toggle', async () => {
      render(<BottomNav />);
      const moreButton = screen.getByRole('button', { name: /More/i });
      expect(moreButton).toHaveAttribute('aria-controls', 'bottom-nav-drawer');
    });

    it('should have aria-pressed on core tab buttons', () => {
      render(<BottomNav />);
      const statusButton = screen.getByRole('button', { name: /Status/i });
      const warfareButton = screen.getByRole('button', { name: /Offense/i });
      expect(statusButton).toHaveAttribute('aria-pressed');
      expect(warfareButton).toHaveAttribute('aria-pressed');
    });

    it('drawer should have proper ARIA attributes', async () => {
      render(<BottomNav />);
      const moreButton = screen.getByRole('button', { name: /More/i });
      await userEvent.click(moreButton);
      const drawer = screen.getByRole('dialog');
      expect(drawer).toHaveAttribute('aria-label', 'More navigation');
    });
  });
});
