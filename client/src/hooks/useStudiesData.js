import { useState, useEffect, useCallback } from 'react';
import { useActivePanel } from './useActivePanel';

/**
 * useStudiesData — Fetch and manage Studies panel server data
 * Handles: tower/school/shrine/library upgrades, spells, research allocation, etc.
 */
export const useStudiesData = () => {
  const [studiesData, setStudiesData] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { activePanel } = useActivePanel();

  const fetchStudiesData = useCallback(async () => {
    try {
      const response = await fetch('/api/kingdom/studies/overview', {
        cache: 'no-store',
        headers: { 'pragma': 'no-cache' }
      });
      if (response.ok) {
        const data = await response.json();
        setStudiesData(data);
      } else {
        console.error('Studies data fetch failed:', response.status);
      }
    } catch (err) {
      console.error('Failed to load studies data:', err);
    }
  }, []);

  // Fetch on mount
  useEffect(() => {
    fetchStudiesData();
  }, [fetchStudiesData]);

  // Refresh when panel activates
  useEffect(() => {
    if (activePanel !== 'studies') return;
    fetchStudiesData();
  }, [activePanel, fetchStudiesData]);

  const loadStudies = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await fetchStudiesData();
    } finally {
      setIsRefreshing(false);
    }
  }, [fetchStudiesData]);

  const syncUpgrades = useCallback((category, nextOwned) => {
    const key = `${category}_upgrades`;
    setStudiesData((prev) => (prev ? { ...prev, [key]: nextOwned } : prev));
  }, []);

  return {
    studiesData,
    isRefreshing,
    loadStudies,
    fetchStudiesData,
    syncUpgrades,
  };
};
