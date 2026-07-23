import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('../../../hooks/useGameState', () => ({
  useGameMutationEvents: vi.fn(),
}));

vi.mock('../../../hooks/useStudiesData', () => ({
  useStudiesData: vi.fn(),
}));

vi.mock('../../../stores', () => ({
  useRace: vi.fn(),
  useMages: vi.fn(),
  useResEconomy: vi.fn(),
  useResWeapons: vi.fn(),
  useResArmor: vi.fn(),
  useResMilitary: vi.fn(),
  useResAttackMagic: vi.fn(),
  useResDefenseMagic: vi.fn(),
  useResEntertainment: vi.fn(),
  useResConstruction: vi.fn(),
  useResWarMachines: vi.fn(),
  useResSpellbook: vi.fn(),
  useSchoolOfMagic: vi.fn(),
  useGold: vi.fn(),
  useWood: vi.fn(),
  useStone: vi.fn(),
  useIron: vi.fn(),
}));

vi.mock('../StudiesTabs/TowerTab.jsx', () => ({
  TowerTab: () => <div>Tower Tab Body</div>,
}));

vi.mock('../StudiesTabs/SchoolTab.jsx', () => ({
  SchoolTab: () => <div>School Tab Body</div>,
}));

vi.mock('../StudiesTabs/ShrineTab.jsx', () => ({
  ShrineTab: () => <div>Shrine Tab Body</div>,
}));

vi.mock('../StudiesTabs/LibraryTab.jsx', () => ({
  LibraryTab: () => <div>Library Tab Body</div>,
}));

import StudiesPanel from '../StudiesPanel.jsx';
import { useGameMutationEvents } from '../../../hooks/useGameState';
import { useStudiesData } from '../../../hooks/useStudiesData';
import {
  useRace,
  useMages,
  useResEconomy,
  useResWeapons,
  useResArmor,
  useResMilitary,
  useResAttackMagic,
  useResDefenseMagic,
  useResEntertainment,
  useResConstruction,
  useResWarMachines,
  useResSpellbook,
  useSchoolOfMagic,
  useGold,
  useWood,
  useStone,
  useIron,
} from '../../../stores';

describe('StudiesPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    useStudiesData.mockReturnValue({
      studiesData: {},
      isRefreshing: false,
      loadStudies: vi.fn(),
      fetchStudiesData: vi.fn(),
      syncUpgrades: vi.fn(),
    });

    useRace.mockReturnValue('human');
    useMages.mockReturnValue(10);
    useResEconomy.mockReturnValue(1);
    useResWeapons.mockReturnValue(1);
    useResArmor.mockReturnValue(1);
    useResMilitary.mockReturnValue(1);
    useResAttackMagic.mockReturnValue(1);
    useResDefenseMagic.mockReturnValue(1);
    useResEntertainment.mockReturnValue(1);
    useResConstruction.mockReturnValue(1);
    useResWarMachines.mockReturnValue(1);
    useResSpellbook.mockReturnValue(1);
    useSchoolOfMagic.mockReturnValue('conjuration');
    useGold.mockReturnValue(0);
    useWood.mockReturnValue(0);
    useStone.mockReturnValue(0);
    useIron.mockReturnValue(0);
  });

  it('subscribes to mutation events once', () => {
    render(<StudiesPanel />);
    expect(useGameMutationEvents).toHaveBeenCalledTimes(1);
  });

  it('renders the default tower tab', () => {
    render(<StudiesPanel />);
    expect(screen.getByText('Tower Tab Body')).toBeInTheDocument();
  });

  it('switches tabs when clicked', async () => {
    const user = userEvent.setup();
    render(<StudiesPanel />);

    await user.click(screen.getByRole('button', { name: /school/i }));
    expect(screen.getByText('School Tab Body')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /library/i }));
    expect(screen.getByText('Library Tab Body')).toBeInTheDocument();
  });

  it('shows shrine label for non-vampires', () => {
    useRace.mockReturnValue('human');
    render(<StudiesPanel />);
    expect(screen.getByRole('button', { name: /shrine/i })).toBeInTheDocument();
  });

  it('shows mausoleum label for vampires', () => {
    useRace.mockReturnValue('vampire');
    render(<StudiesPanel />);
    expect(screen.getByRole('button', { name: /mausoleum/i })).toBeInTheDocument();
  });

  it('runs the sync action', async () => {
    const user = userEvent.setup();
    const loadStudies = vi.fn();
    useStudiesData.mockReturnValue({
      studiesData: {},
      isRefreshing: false,
      loadStudies,
      fetchStudiesData: vi.fn(),
      syncUpgrades: vi.fn(),
    });

    render(<StudiesPanel />);
    await user.click(screen.getByRole('button', { name: /sync/i }));
    expect(loadStudies).toHaveBeenCalledTimes(1);
  });
});
