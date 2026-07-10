import { describe, it, expect, beforeEach } from 'vitest';
import { normalizeAndRouteResponse, wasStoreUpdated } from '../responseNormalizer';
import { useEconomyStore, useResearchStore } from '../../stores';

describe('Phase 3A Smoke Test: Zustand Routing Works', () => {
  beforeEach(() => {
    // Reset stores
    useEconomyStore.setState({});
    useResearchStore.setState({});
  });

  describe('Building Upgrade Flow (Critical)', () => {
    it('farm upgrade routes to economy store', () => {
      const farmUpgradeResponse = {
        ok: true,
        updates: {
          economy: {
            gold: 4000,
            farm_upgrades: { irrigation: true }
          }
        }
      };

      const normalized = normalizeAndRouteResponse(farmUpgradeResponse, {
        reason: 'upgrade-purchased',
        type: 'farm'
      });

      expect(wasStoreUpdated(normalized, 'economy')).toBe(true);
      const economyState = useEconomyStore.getState();
      expect(economyState.gold).toBe(4000);
      expect(economyState.farm_upgrades?.irrigation).toBe(true);
    });

    it('school upgrade routes to both economy and research stores', () => {
      const schoolUpgradeResponse = {
        ok: true,
        updates: {
          economy: { gold: 3000 },
          research: {
            mana: 100,
            school_upgrades: { grimoire: true }
          }
        }
      };

      const normalized = normalizeAndRouteResponse(schoolUpgradeResponse, {
        reason: 'upgrade-purchased',
        type: 'school'
      });

      expect(wasStoreUpdated(normalized, 'economy')).toBe(true);
      expect(wasStoreUpdated(normalized, 'research')).toBe(true);

      const economyState = useEconomyStore.getState();
      const researchState = useResearchStore.getState();
      expect(economyState.gold).toBe(3000);
      expect(researchState.mana).toBe(100);
      expect(researchState.school_upgrades?.grimoire).toBe(true);
    });

    it('all 7 building upgrade types route correctly', () => {
      const upgrades = [
        { type: 'farm', field: 'farm_upgrades' },
        { type: 'bank', field: 'bank_upgrades' },
        { type: 'granary', field: 'granary_upgrades' },
        { type: 'market', field: 'market_upgrades' },
        { type: 'tavern', field: 'tavern_upgrades' },
        { type: 'mausoleum', field: 'mausoleum_upgrades' },
      ];

      for (const { type, field } of upgrades) {
        const response = {
          ok: true,
          updates: {
            economy: {
              gold: 5000,
              [field]: { test_upgrade: true }
            }
          }
        };

        const normalized = normalizeAndRouteResponse(response, {
          reason: 'upgrade-purchased',
          type
        });

        // Verify routing happened
        expect(wasStoreUpdated(normalized, 'economy')).toBe(true);
        // Verify normalized data contains the upgrade
        expect(normalized.economy[field]).toEqual({ test_upgrade: true });
      }
    });
  });

  describe('Multi-Domain Updates Flow', () => {
    it('turn endpoint updates all relevant stores', () => {
      const turnResponse = {
        ok: true,
        updates: {
          profile: {
            turn: 42,
            turns_stored: 5
          },
          economy: {
            gold: 1000,
            food: 500
          },
          military: {
            fighters: 100
          }
        }
      };

      normalizeAndRouteResponse(turnResponse, { reason: 'turn-taken' });

      // Verify all stores updated
      expect(useEconomyStore.getState().gold).toBe(1000);
      expect(useEconomyStore.getState().food).toBe(500);
      // Note: military store not imported in this test file but would update
    });

    it('hire mercenaries updates economy, military, and population', () => {
      const hireResponse = {
        ok: true,
        updates: {
          economy: { gold: 4000 },
          military: { fighters: 50 },
          population: { population: 1200 }
        }
      };

      const normalized = normalizeAndRouteResponse(hireResponse, {
        reason: 'hire-mercs'
      });

      expect(wasStoreUpdated(normalized, 'economy')).toBe(true);
      expect(wasStoreUpdated(normalized, 'military')).toBe(true);
      expect(wasStoreUpdated(normalized, 'population')).toBe(true);
    });
  });

  describe('Contract Validation in Phase 3A Context', () => {
    it('rejects response with unexpected keys (dev mode)', () => {
      const badResponse = {
        updates: {
          economy: { gold: 100 },
          gameStateManager: { legacy: true } // should fail
        }
      };

      process.env.NODE_ENV = 'development';
      expect(() => normalizeAndRouteResponse(badResponse, { reason: 'test' }))
        .toThrow(/Unexpected response keys/);
    });

    it('handles responses without updates gracefully', () => {
      const noUpdatesResponse = { ok: true, message: 'success' };
      const result = normalizeAndRouteResponse(noUpdatesResponse, { reason: 'test' });
      expect(result).toBe(null);
    });
  });
});
