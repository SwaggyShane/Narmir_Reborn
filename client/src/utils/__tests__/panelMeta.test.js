import { describe, it, expect } from 'vitest';
import {
  PANEL_META,
  HIDE_KINGDOM_HEADER_PANELS,
  FULL_BLEED_SHELL_PANELS,
  NAV_SECTIONS,
  EXPEDITION_TYPE_LABELS,
  getPanelMeta,
} from '../panelMeta.js';

describe('panelMeta', () => {
  describe('PANEL_META', () => {
    it('should be frozen', () => {
      expect(Object.isFrozen(PANEL_META)).toBe(true);
    });

    it('should contain all expected panels', () => {
      const expectedPanels = [
        'status', 'happiness', 'studies', 'build', 'exploration',
        'economy', 'market', 'resources',
        'rankings', 'hire', 'warfare', 'defense', 'bounties', 'training', 'heroes', 'worldmap', 'alliances',
        'messages', 'forum', 'globalchat', 'news',
        'goals', 'races', 'changelog', 'testing', 'options',
      ];
      expectedPanels.forEach((panelId) => {
        expect(PANEL_META[panelId]).toBeDefined();
      });
    });

    it('should have required properties for each panel', () => {
      Object.entries(PANEL_META).forEach(([_id, meta]) => {
        expect(meta).toHaveProperty('label');
        expect(meta).toHaveProperty('icon');
        expect(meta).toHaveProperty('section');
        expect(meta).toHaveProperty('keywords');
        expect(Array.isArray(meta.keywords)).toBe(true);
      });
    });

    it('should use correct vernacular for section labels', () => {
      expect(PANEL_META.warfare.label).toBe('Offense');
      expect(PANEL_META.economy.section).toBe('Wherewithal');
    });
  });

  describe('HIDE_KINGDOM_HEADER_PANELS', () => {
    it('should be a Set', () => {
      expect(HIDE_KINGDOM_HEADER_PANELS instanceof Set).toBe(true);
    });

    it('should contain expected panels', () => {
      const expectedHidden = ['globalchat', 'defense', 'races', 'build', 'heroes', 'worldmap', 'bounties', 'messages', 'forum'];
      expectedHidden.forEach((panelId) => {
        expect(HIDE_KINGDOM_HEADER_PANELS.has(panelId)).toBe(true);
      });
    });
  });

  describe('FULL_BLEED_SHELL_PANELS', () => {
    it('should be a Set', () => {
      expect(FULL_BLEED_SHELL_PANELS instanceof Set).toBe(true);
    });

    it('should contain globalchat and forum', () => {
      expect(FULL_BLEED_SHELL_PANELS.has('globalchat')).toBe(true);
      expect(FULL_BLEED_SHELL_PANELS.has('forum')).toBe(true);
    });

    it('should be small set (2 panels)', () => {
      expect(FULL_BLEED_SHELL_PANELS.size).toBe(2);
    });
  });

  describe('NAV_SECTIONS', () => {
    it('should be frozen', () => {
      expect(Object.isFrozen(NAV_SECTIONS)).toBe(true);
    });

    it('should have 5 sections', () => {
      expect(NAV_SECTIONS.length).toBe(5);
    });

    it('should have correct section IDs', () => {
      const sectionIds = NAV_SECTIONS.map((s) => s.id);
      expect(sectionIds).toEqual(['kingdom', 'wherewithal', 'warfare', 'social', 'information']);
    });

    it('should have all panels assigned to sections', () => {
      const assignedPanels = new Set();
      NAV_SECTIONS.forEach((section) => {
        expect(Array.isArray(section.panels)).toBe(true);
        section.panels.forEach((id) => {
          assignedPanels.add(id);
        });
      });
      // Verify all PANEL_META keys (except admin-only) are assigned
      Object.keys(PANEL_META).forEach((id) => {
        expect(assignedPanels.has(id)).toBe(true);
      });
    });

    it('should have expected panels in warfare section with correct labels', () => {
      const warfareSection = NAV_SECTIONS.find((s) => s.id === 'warfare');
      expect(warfareSection.panels).toContain('rankings');
      expect(warfareSection.panels).toContain('hire');
      expect(warfareSection.panels).toContain('warfare');
    });

    it('should have expected panels in wherewithal section', () => {
      const wherewithalSection = NAV_SECTIONS.find((s) => s.id === 'wherewithal');
      expect(wherewithalSection.panels).toEqual(['economy', 'market', 'resources']);
    });
  });

  describe('EXPEDITION_TYPE_LABELS', () => {
    it('should be frozen', () => {
      expect(Object.isFrozen(EXPEDITION_TYPE_LABELS)).toBe(true);
    });

    it('should contain expected expedition types', () => {
      expect(EXPEDITION_TYPE_LABELS.scout).toBe('Scout');
      expect(EXPEDITION_TYPE_LABELS.deep).toBe('Deep');
      expect(EXPEDITION_TYPE_LABELS.dungeon).toBe('Dungeon');
      expect(EXPEDITION_TYPE_LABELS.mountain).toBe("Mountain's Heart");
    });
  });

  describe('getPanelMeta()', () => {
    it('should return correct metadata for known panels', () => {
      const meta = getPanelMeta('status');
      expect(meta.label).toBe('Status');
      expect(meta.icon).toBe('🏰');
      expect(meta.section).toBe('Kingdom');
    });

    it('should return fallback metadata for unknown panels', () => {
      const meta = getPanelMeta('nonexistent');
      expect(meta.label).toBe('nonexistent');
      expect(meta.icon).toBe('📋');
      expect(meta.section).toBe('Other');
      expect(Array.isArray(meta.keywords)).toBe(true);
      expect(meta.keywords.length).toBe(0);
    });

    it('should handle null or undefined gracefully', () => {
      const metaNull = getPanelMeta(null);
      expect(metaNull).toBeDefined();
      expect(metaNull.label).toBe(null);
      expect(metaNull.icon).toBe('📋');
      expect(metaNull.section).toBe('Other');

      const metaUndefined = getPanelMeta(undefined);
      expect(metaUndefined).toBeDefined();
      expect(metaUndefined.label).toBe(undefined);
      expect(metaUndefined.icon).toBe('📋');
      expect(metaUndefined.section).toBe('Other');
    });
  });

  describe('section routing', () => {
    it('should route economy panel to wherewithal section', () => {
      const meta = getPanelMeta('economy');
      expect(meta.section).toBe('Wherewithal');
    });

    it('should route warfare panel to warfare section', () => {
      const meta = getPanelMeta('warfare');
      expect(meta.section).toBe('Warfare');
    });

    it('should route social panels to social section', () => {
      const socialPanels = ['messages', 'forum', 'globalchat', 'news'];
      socialPanels.forEach((panelId) => {
        const meta = getPanelMeta(panelId);
        expect(meta.section).toBe('Social');
      });
    });
  });

  describe('keywords', () => {
    it('should have keywords for searchable panels', () => {
      const searchablePanels = ['status', 'economy', 'warfare', 'studies'];
      searchablePanels.forEach((panelId) => {
        const meta = getPanelMeta(panelId);
        expect(meta.keywords.length).toBeGreaterThan(0);
      });
    });

    it('should include relevant keywords for economy panel', () => {
      const meta = getPanelMeta('economy');
      expect(meta.keywords).toContain('tax');
      expect(meta.keywords).toContain('food');
    });
  });

  describe('badge keys', () => {
    it('should have badgeKey for notification-capable panels', () => {
      expect(getPanelMeta('messages').badgeKey).toBe('messages');
      expect(getPanelMeta('globalchat').badgeKey).toBe('chat');
      expect(getPanelMeta('news').badgeKey).toBe('news');
    });

    it('should not have badgeKey for non-notification panels', () => {
      expect(getPanelMeta('status').badgeKey).toBeUndefined();
      expect(getPanelMeta('build').badgeKey).toBeUndefined();
    });
  });
});
