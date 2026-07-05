import clsx from 'clsx';
import React, { useState, useCallback, useEffect } from 'react';
import { getSocket } from '../../socket-client.js';

const TEST_DESCRIPTIONS = {
  // Economy
  'economy_Basic_Income_Flow': 'Verify gold generation per turn. Check: Starting gold, gold/turn displayed correctly, gold increases after turn processing.',
  'economy_Market_Trading': 'Test player-to-player trading. Check: Initiate trade, accept/reject offers, resource exchange completes, trade log updates.',
  'economy_Trade_Routes': 'Verify trade route income. Check: Routes active, gold generated per route, route UI shows correct amounts.',
  'economy_Banking_System': 'Test kingdom bank/vault. Check: Deposit/withdraw functions, balance updates, transaction history.',
  'economy_Resource_Management': 'Verify resource tracking. Check: All resource types (gold, food, mana, wood, stone, iron) display and update correctly.',

  // Combat
  'combat_Troop_Management': 'Test troop recruitment and organization. Check: Can recruit troops, organize into armies, casualties update after combat.',
  'combat_Combat_Resolution': 'Verify combat outcomes. Check: Battle report shows correctly, winner determined, casualties applied.',
  'combat_War_Machines': 'Test war machine mechanics. Check: Build/upgrade machines, they provide bonuses in combat, display in battles.',
  'combat_Mercenaries': 'Verify mercenary hiring. Check: Can hire, they contribute to attacks/defense, mercenary payment system works.',
  'combat_Troop_Leveling': 'Test troop experience and leveling. Check: Troops gain XP from battles, level up, stats improve.',
  'combat_Defense_System': 'Verify defensive mechanics. Check: Can build defense structures, troops defend, incoming attacks are resolved.',

  // Research
  'research_Research_Progression': 'Test research advancement. Check: Can start research, progress increments per turn, research completes.',
  'research_Multiple_Disciplines': 'Verify multiple research paths. Check: Can research different disciplines simultaneously, each progresses independently.',
  'research_Building_Upgrades': 'Test building improvements via research. Check: Research unlocks building upgrades, upgrades apply benefits.',
  'research_Engineer_Leveling': 'Verify engineer progression. Check: Engineers gain experience, level up, increase research speed.',

  // Magic
  'magic_Spellbook_Research': 'Test spell discovery. Check: Research new spells, spellbook updates, spell becomes castable.',
  'magic_Scroll_Crafting': 'Verify scroll creation. Check: Craft scrolls from mana/resources, scrolls stored/consumed correctly.',
  'magic_Spell_Casting': 'Test spell execution. Check: Select spell, target, spell executes, effects applied to kingdom.',
  'magic_Mana_Management': 'Verify mana system. Check: Mana regenerates per turn, spells consume mana, mana pool updates.',
  'magic_Spell_Effects': 'Test spell impacts. Check: Each spell produces intended effects (damage, buff, resource gain, etc).',

  // Happiness
  'happiness_Population_Growth': 'Test population changes. Check: Population grows when happy, shrinks when unhappy, housing affects cap.',
  'happiness_Happiness_Calculation': 'Verify happiness math. Check: Happiness bar shows 0-120, components (food/entertainment/safety/prosperity) display.',
  'happiness_Happiness_Effects': 'Test happiness impacts. Check: Happy populations produce more resources, sad populations produce less.',
  'happiness_Rebellion_System': 'Verify rebellion mechanics. Check: Low happiness triggers rebellion events, consequences apply (population loss, building damage).',
  'happiness_Food_System': 'Test food production/consumption. Check: Food produces per turn, population consumes food, shortages trigger alerts.',
  'happiness_Housing_\&_Capacity': 'Verify housing limits. Check: Population capped by housing, upgrading housing increases cap.',

  // Building
  'building_Basic_Building': 'Test building construction. Check: Place building, construction starts, completes per build queue.',
  'building_Build_Queue': 'Verify construction order. Check: Queue multiple buildings, each builds in order, can prioritize/rearrange.',
  'building_Construction_Tools': 'Test special construction items. Check: Construction tools work, reduce build time, display in UI.',
  'building_Blueprints': 'Verify blueprint system. Check: Save building layouts, load blueprints, buildings place correctly.',
  'building_Building_Types_\&_Caps': 'Test building limits. Check: Each building type has maximum count, cannot exceed limits.',
  'building_Building_Upgrades': 'Verify upgrades. Check: Upgrade buildings, new levels unlock, stats improve, cost scales.',

  // Advanced
  'advanced_Covert_Operations': 'Test espionage/covert actions. Check: Send spies, gather intel, sabotage enemy kingdom.',
  'advanced_Expeditions': 'Verify exploration missions. Check: Send expeditions, discover locations, return with loot.',
  'advanced_World_Fragments_\&_Attunement': 'Test fragment collection. Check: Find fragments, attune to kingdoms, bonuses apply.',
  'advanced_Item_Collection_\&_Lore': 'Verify story items. Check: Collect items, lore entries unlock, achievements trigger.',

  // Progression
  'progression_Kingdom_XP_\&_Levels': 'Test kingdom level advancement. Check: Kingdom earns XP, displays level, unlocks features at thresholds.',
  'progression_Troop_XP_\&_Levels': 'Verify troop progression. Check: Troops earn XP from battles, level up individually, perks unlock.',
  'progression_Hero_System': 'Test heroes. Check: Recruit heroes, assign to armies, heroes provide combat bonuses.',
  'progression_Achievements_\&_Milestones': 'Verify achievements. Check: Achievements unlock when conditions met, rewards granted, badge displays.',

  // Social
  'social_Alliances': 'Test alliance mechanics. Check: Create/join alliance, members list shows, can disband/leave.',
  'social_Alliance_Vault': 'Verify shared vault. Check: Deposit resources, allies withdraw, log tracks transactions.',
  'social_Regional_Control': 'Test territory control. Check: Alliances control regions, bonuses apply, can be conquered.',
  'social_Player-to-Player_Trading': 'Test trading system. Check: Post trade offers, accept offers, resources transfer correctly.',
  'social_Messaging': 'Verify messaging. Check: Send messages to players, receive replies, message history displays.',

  // Events
  'events_Seasonal_System': 'Test seasonal changes. Check: Seasons change, environmental effects apply, special events trigger.',
  'events_Global_Events': 'Verify world events. Check: Random events occur, kingdoms affected, event log updates.',
  'events_Custom_Goals': 'Test goal system. Check: Create goals, track progress, rewards granted when complete.',
  'events_Sentiment_Events': 'Verify population sentiment. Check: Sentiment affects events, rebellion risk shown, outcomes vary.',

  // Special
  'special_Vampire-Specific_Mechanics': 'Test vampire features. Check: Vampire-only mechanics work (thralls, night bonuses, weakness to sun).',
  'special_Location_Mapping': 'Verify location system. Check: Locations map correctly, can travel, location effects apply.',
  'special_News_Feed': 'Test news system. Check: News generates from actions, displays chronologically, can filter.',
  'special_War_Log': 'Verify battle history. Check: All battles logged, can review reports, stats tracked.',
  'special_Kingdom_Info_Panel': 'Test info display. Check: Kingdom stats display correctly, updates real-time.',

  // Integration
  'integration_Happiness_Integration': 'Test happiness across systems. Check: Happiness affects production, growth, and combat.',
  'integration_Combat_Integration': 'Verify combat + other systems. Check: Combat affects troops, happiness, resources, etc.',
  'integration_Production_Integration': 'Test resource production chain. Check: All resources produce, consume, and affect economy.',
  'integration_Population_Integration': 'Test population interactions. Check: Population growth, consumption, casualties all work together.',
  'integration_Research_Integration': 'Verify research affects gameplay. Check: Research unlocks features, improves production, enables new buildings.',
  'integration_Magic_Integration': 'Test magic interactions. Check: Spells affect other systems (combat, resources, happiness).',

  // Edge Cases
  'edge_Zero/Low_Resource_States': 'Test low resource handling. Check: Game stable at 0 resources, starvation works, bankruptcy mechanics.',
  'edge_Overflow_Conditions': 'Verify overflow handling. Check: Resources don\'t exceed capacity (if capped), large numbers display correctly.',
  'edge_Invalid_Actions': 'Test validation. Check: Can\'t spend resources you don\'t have, can\'t move units that don\'t exist.',

  // Performance
  'performance_Database_Consistency': 'Test data integrity. Check: Reload page, all state persists correctly, no lost data.',
  'performance_Turn_Processing': 'Verify turn speed. Check: Turn processes quickly, large kingdoms don\'t lag, all calculations complete.',
  'performance_Data_Validation': 'Test data accuracy. Check: Calculations correct, no phantom resources, stats match sources.'
};

const TEST_GROUPS = [
  {
    id: 'economy',
    name: '💰 Core Economy System',
    tests: ['Basic Income Flow', 'Market Trading', 'Trade Routes', 'Banking System', 'Resource Management']
  },
  {
    id: 'combat',
    name: '⚔️ Combat & Military System',
    tests: ['Troop Management', 'Combat Resolution', 'War Machines', 'Mercenaries', 'Troop Leveling', 'Defense System']
  },
  {
    id: 'research',
    name: '📚 Research & Development System',
    tests: ['Research Progression', 'Multiple Disciplines', 'Building Upgrades', 'Engineer Leveling']
  },
  {
    id: 'magic',
    name: '✨ Magic & Spell System',
    tests: ['Spellbook Research', 'Scroll Crafting', 'Spell Casting', 'Mana Management', 'Spell Effects']
  },
  {
    id: 'happiness',
    name: '😊 Population & Happiness System',
    tests: ['Population Growth', 'Happiness Calculation', 'Happiness Effects', 'Rebellion System', 'Food System', 'Housing & Capacity']
  },
  {
    id: 'building',
    name: '🏗️ Building & Construction System',
    tests: ['Basic Building', 'Build Queue', 'Construction Tools', 'Blueprints', 'Building Types & Caps', 'Building Upgrades']
  },
  {
    id: 'advanced',
    name: '🗺️ Advanced Mechanics',
    tests: ['Covert Operations', 'Expeditions', 'World Fragments & Attunement', 'Item Collection & Lore']
  },
  {
    id: 'progression',
    name: '⭐ Progression & Leveling System',
    tests: ['Kingdom XP & Levels', 'Troop XP & Levels', 'Hero System', 'Achievements & Milestones']
  },
  {
    id: 'social',
    name: '👥 Social Systems',
    tests: ['Alliance', 'Alliance Vault', 'Regional Control', 'Player-to-Player Trading', 'Messaging']
  },
  {
    id: 'events',
    name: '🎲 Events & Randomness System',
    tests: ['Seasonal System', 'Global Events', 'Custom Goals', 'Sentiment Events']
  },
  {
    id: 'special',
    name: '🧛 Specialized & Misc Systems',
    tests: ['Vampire-Specific Mechanics', 'Location Mapping', 'News Feed', 'War Log', 'Kingdom Info Panel']
  },
  {
    id: 'integration',
    name: '🔗 System Integration Tests',
    tests: ['Happiness Integration', 'Combat Integration', 'Production Integration', 'Population Integration', 'Research Integration', 'Magic Integration']
  },
  {
    id: 'edge',
    name: '⚠️ Edge Cases & Error Handling',
    tests: ['Zero/Low Resource States', 'Overflow Conditions', 'Invalid Actions']
  },
  {
    id: 'performance',
    name: '⚙️ Performance & Data Integrity',
    tests: ['Database Consistency', 'Turn Processing', 'Data Validation']
  }
];

const getTestKey = (groupId, testName) => `${groupId}_${testName.replace(/\s+/g, '_')}`;

const TestingPanel = () => {
  const [testStatus, setTestStatus] = useState(() => {
    const saved = localStorage.getItem('narmir_test_status');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Failed to load test status:', e);
        return {};
      }
    }
    return {};
  });
  const [expandedGroup, setExpandedGroup] = useState(null);
  const [failureComment, setFailureComment] = useState('');
  const [commentingTest, setCommentingTest] = useState(null);
  const [activeTab, setActiveTab] = useState('individual');
  const [collaborativeResults, setCollaborativeResults] = useState([]);
  const [testSummary, setTestSummary] = useState([]);

  useEffect(() => {
    // Fetch collaborative results on mount
    const fetchResults = async () => {
      try {
        const [resultsRes, summaryRes] = await Promise.all([
          fetch('/api/test-results'),
          fetch('/api/test-results/summary')
        ]);
        if (resultsRes.ok) setCollaborativeResults(await resultsRes.json());
        if (summaryRes.ok) setTestSummary(await summaryRes.json());
      } catch (e) {
        console.error('Failed to fetch test results:', e);
      }
    };
    fetchResults();

    // Listen for real-time updates via WebSocket
    let cleanup = () => {};
    getSocket().then((sock) => {
      const handler = (data) => setCollaborativeResults(prev => [data, ...prev]);
      sock.on('test-result-update', handler);
      cleanup = () => sock.off('test-result-update', handler);
    }).catch(() => {});
    return () => cleanup();
  }, []);

  const saveStatus = useCallback((newStatus) => {
    setTestStatus(newStatus);
    localStorage.setItem('narmir_test_status', JSON.stringify(newStatus));
  }, []);

  const submitTestResult = useCallback(async (groupId, testName, passed, comment) => {
    try {
      const testKey = getTestKey(groupId, testName);
      await fetch('/api/test-result', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ testKey, testGroup: groupId, testName, passed, comment })
      });
    } catch (e) {
      console.error('Failed to submit test result:', e);
    }
  }, []);

  const toggleTestFinished = (groupId, testName) => {
    const key = getTestKey(groupId, testName);
    const newStatus = { ...testStatus };
    const testData = newStatus[key] || {};
    newStatus[key] = { ...testData, finished: !testData.finished };
    saveStatus(newStatus);
  };

  const setTestPassed = (groupId, testName, passed) => {
    const key = getTestKey(groupId, testName);
    const newStatus = { ...testStatus };
    const testData = newStatus[key] || {};
    newStatus[key] = { ...testData, passed, comment: passed ? '' : testData.comment };
    saveStatus(newStatus);
    // Auto-submit to collaborative results
    submitTestResult(groupId, testName, passed, testData.comment);
  };

  const handleCommentSubmit = (groupId, testName) => {
    const key = getTestKey(groupId, testName);
    const newStatus = { ...testStatus };
    const testData = newStatus[key] || {};
    newStatus[key] = { ...testData, comment: failureComment };
    saveStatus(newStatus);
    // Auto-submit comment to collaborative results
    submitTestResult(groupId, testName, testData.passed, failureComment);
    setCommentingTest(null);
    setFailureComment('');
  };

  const getGroupStats = (group) => {
    const tests = group.tests;
    const finished = tests.filter(t => testStatus[getTestKey(group.id, t)]?.finished).length;
    const passed = tests.filter(t => testStatus[getTestKey(group.id, t)]?.passed === true).length;
    const failed = tests.filter(t => testStatus[getTestKey(group.id, t)]?.passed === false).length;
    return { finished, passed, failed, total: tests.length };
  };

  const getTestStats = () => {
    const passed = testSummary.filter(s => s.passed_count > 0).reduce((sum, s) => sum + s.passed_count, 0);
    const failed = testSummary.filter(s => s.failed_count > 0).reduce((sum, s) => sum + s.failed_count, 0);
    const pending = testSummary.filter(s => s.pending_count > 0).reduce((sum, s) => sum + s.pending_count, 0);
    const totalTesters = new Set(collaborativeResults.map(r => r.player_id)).size;
    return { passed, failed, pending, totalTesters };
  };

  const getFailureComments = (testKey) => {
    return collaborativeResults
      .filter(r => r.test_key === testKey && r.comment)
      .map(r => ({ player: r.player_name, comment: r.comment }));
  };

  const stats = getTestStats();

  return (
    <div id="testing" className="panel">
      <div className="card mt-0">
        <div className="mb-4">
          <h2 className="m-0 mb-2">🧪 Testing Dashboard</h2>
          <p className="m-0 text-sm text-text2">
            Track testing progress across all game systems. Check off tests as completed and mark pass/fail.
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-2 mb-4 border-b pb-3">
          <button
            onClick={() => setActiveTab('individual')}
            className={clsx(
              "px-4 py-2 text-sm border-none rounded-sm cursor-pointer",
              activeTab === 'individual' ? "font-bold bg-[var(--accent)] text-black" : "font-normal bg-transparent text-inherit"
            )}
          >
            Individual Tests
          </button>
          <button
            onClick={() => setActiveTab('collaborative')}
            className={clsx(
              "px-4 py-2 text-sm border-none rounded-sm cursor-pointer",
              activeTab === 'collaborative' ? "font-bold bg-[var(--accent)] text-black" : "font-normal bg-transparent text-inherit"
            )}
          >
            Collaborative Results {testSummary.length > 0 && `(${testSummary.length})`}
          </button>
        </div>

        {/* Collaborative Tab */}
        {activeTab === 'collaborative' && (
          <div>
            {/* Summary Stats */}
            <div className="grid grid-cols-4 gap-3 mb-5">
              <div className="p-3 bg-[var(--bg2)] rounded text-center">
                <div className="text-3xl font-bold text-[#4ade80]">{stats.passed}</div>
                <div className="text-[11px] text-[var(--text2)] mt-1">Tests Passed</div>
              </div>
              <div className="p-3 bg-[var(--bg2)] rounded text-center">
                <div className="text-3xl font-bold text-[#ef4444]">{stats.failed}</div>
                <div className="text-[11px] text-[var(--text2)] mt-1">Tests Failed</div>
              </div>
              <div className="p-3 bg-[var(--bg2)] rounded text-center">
                <div className="text-3xl font-bold text-[#fbbf24]">{stats.pending}</div>
                <div className="text-[11px] text-[var(--text2)] mt-1">Pending</div>
              </div>
              <div className="p-3 bg-[var(--bg2)] rounded text-center">
                <div className="text-3xl font-bold text-[#60a5fa]">{stats.totalTesters}</div>
                <div className="text-[11px] text-[var(--text2)] mt-1">Testers</div>
              </div>
            </div>

            {/* Test Results by Group */}
            {TEST_GROUPS.map((group) => {
              const groupTests = group.tests.map(testName => {
                const testKey = getTestKey(group.id, testName);
                return testSummary.find(s => s.test_key === testKey) || { test_key: testKey, test_name: testName, passed_count: 0, failed_count: 0, pending_count: 0, unique_testers: 0 };
              });

              return (
                <div
                  key={group.id}
                  className="mb-3 border rounded-md"
                >
                  <div
                    className="p-3 bg-bg2 cursor-pointer flex justify-between items-center font-bold"
                  >
                    {group.name}
                  </div>
                  <div className="p-3 bg-bg">
                    {groupTests.map((testStat) => {
                      const total = (testStat.passed_count || 0) + (testStat.failed_count || 0) + (testStat.pending_count || 0);
                      const failureComments = getFailureComments(testStat.test_key);

                      return (
                        <div key={testStat.test_key} className="border-b mb-2.5 pb-2.5">
                          <div className="flex justify-between items-center mb-1.5">
                            <span className="font-medium flex-1">{testStat.test_name}</span>
                            <div className="text-sm text-text2 mr-2">
                              {total > 0 ? `${testStat.unique_testers} tester${testStat.unique_testers !== 1 ? 's' : ''}` : 'No results'}
                            </div>
                          </div>

                          {/* Result Breakdown */}
                          {total > 0 ? (
                            <div className="flex gap-1 h-5 mb-1.5">
                              {testStat.passed_count > 0 && (
                                <div
                                  className="bg-[#4ade80] rounded-[3px] min-w-[20px]" style={{flex: testStat.passed_count}}
                                  title={`${testStat.passed_count} passed`}
                                />
                              )}
                              {testStat.failed_count > 0 && (
                                <div
                                  className="bg-[#ef4444] rounded-[3px] min-w-[20px]" style={{flex: testStat.failed_count}}
                                  title={`${testStat.failed_count} failed`}
                                />
                              )}
                              {testStat.pending_count > 0 && (
                                <div
                                  className="bg-[#fbbf24] rounded-[3px] min-w-[20px]" style={{flex: testStat.pending_count}}
                                  title={`${testStat.pending_count} pending`}
                                />
                              )}
                            </div>
                          ) : null}

                          {/* Result Stats */}
                          <div className={clsx("text-sm text-text2", failureComments.length > 0 ? "mb-2" : "mb-0")}>
                            ✅ {testStat.passed_count || 0} | ❌ {testStat.failed_count || 0} | ⏳ {testStat.pending_count || 0}
                          </div>

                          {/* Failure Comments */}
                          {failureComments.length > 0 && (
                            <div className="ml-2 text-[10px] text-[#ef4444]">
                              {failureComments.map((fc, i) => (
                                <div key={i} className="mb-1 rounded-[3px] px-1.5 py-1 bg-red/10">
                                  <strong>{fc.player}:</strong> {fc.comment}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Individual Tab */}
        {activeTab === 'individual' && (
          <div>
            {TEST_GROUPS.map((group) => {
          const stats = getGroupStats(group);
          const isExpanded = expandedGroup === group.id;
          const progressPercent = stats.total > 0 ? Math.round((stats.finished / stats.total) * 100) : 0;

          return (
            <div
              key={group.id}
              className="mb-3 border rounded-md"
            >
              {/* Group Header */}
              <div
                onClick={() => setExpandedGroup(isExpanded ? null : group.id)}
                className="p-3 bg-bg2 cursor-pointer flex justify-between items-center"
              >
                <div>
                  <div className="font-bold mb-1">{group.name}</div>
                  <div className="text-sm text-text2">
                    ✓ {stats.finished}/{stats.total} | ✅ {stats.passed} | ❌ {stats.failed}
                  </div>
                </div>
                <div className="text-right">
                  <div className={clsx('text-sm font-bold', progressPercent === 100 ? 'text-[#4ade80]' : 'text-[#fbbf24]')}>
                    {progressPercent}%
                  </div>
                  <div className="text-[10px]">{isExpanded ? '▼' : '▶'}</div>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="h-1 bg-[var(--border)]">
                <div
                  className={clsx('h-full transition-all duration-300 ease-in-out', progressPercent === 100 ? 'bg-[#4ade80]' : 'bg-[#fbbf24]')}
                  style={{width: `${progressPercent}%`}}
                />
              </div>

              {/* Tests List */}
              {isExpanded && (
                <div className="p-3 bg-bg">
                  {group.tests.map((testName) => {
                    const key = getTestKey(group.id, testName);
                    const test = testStatus[key] || {};
                    const isFailing = test.passed === false;
                    const isCommentingThis = commentingTest === key;

                    return (
                      <div
                        key={key}
                        className={clsx(
                          "rounded-sm mb-2.5",
                          isFailing ? "p-2 pl-1.5 bg-[#ef4444]/10 border-l-[3px] border-l-[#ef4444]" : "p-2 bg-transparent border-l-0"
                        )}
                      >
                        <div className={clsx('flex items-center gap-2', (TEST_DESCRIPTIONS[key] || isFailing) && 'mb-1.5')}>
                          {/* Finished Checkbox */}
                          <input
                            type="checkbox"
                            checked={test.finished || false}
                            onChange={() => toggleTestFinished(group.id, testName)}
                            className="cursor-pointer mr-1"
                          />

                          {/* Test Name */}
                          <span className={clsx('flex-1 font-medium', test.finished && 'line-through text-[var(--text2)]')}>
                            {testName}
                          </span>

                          {/* Pass/Fail Buttons */}
                          <button
                            onClick={() => setTestPassed(group.id, testName, true)}
                            className={clsx('px-2 py-1 text-sm border-none rounded-sm cursor-pointer', test.passed === true ? 'bg-[#4ade80]' : 'bg-[var(--border)]')}
                            title="Mark as passed"
                          >
                            👍
                          </button>

                          <button
                            onClick={() => {
                              setTestPassed(group.id, testName, false);
                              setFailureComment(test.comment || '');
                              setCommentingTest(key);
                            }}
                            className={clsx('px-2 py-1 text-sm border-none rounded-sm cursor-pointer', test.passed === false ? 'bg-[#ef4444]' : 'bg-[var(--border)]')}
                            title="Mark as failed"
                          >
                            👎
                          </button>
                        </div>

                        {/* Test Description */}
                        {TEST_DESCRIPTIONS[key] && (
                          <div className="text-sm text-text2 mb-2 rounded-[3px] italic px-2 py-1.5 bg-white/[0.03] leading-[1.4]">
                            📋 {TEST_DESCRIPTIONS[key]}
                          </div>
                        )}

                        {/* Failure Comment Section */}
                        {isFailing && (
                          <div className="text-sm ml-7">
                            {isCommentingThis ? (
                              <div className="flex gap-1">
                                <textarea
                                  value={failureComment}
                                  onChange={(e) => setFailureComment(e.target.value)}
                                  placeholder="Add failure notes..."
                                  className="flex-1 p-1.5 text-sm rounded-sm border bg-bg2 text-inherit min-h-[60px] font-inherit resize-y"
                                />
                                <div className="flex flex-col gap-1">
                                  <button
                                    onClick={() => handleCommentSubmit(group.id, testName)}
                                    className="px-2 py-1 text-[11px] bg-[#4ade80] text-black border-none rounded-sm"
                                  >
                                    Save
                                  </button>
                                  <button
                                    onClick={() => {
                                      setCommentingTest(null);
                                      setFailureComment('');
                                    }}
                                    className="px-2 py-1 text-[11px] bg-border border-none rounded-sm"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            ) : test.comment ? (
                              <div
                                className="p-1.5 bg-bg2 rounded-sm cursor-pointer"
                                onClick={() => {
                                  setFailureComment(test.comment);
                                  setCommentingTest(key);
                                }}
                                title="Click to edit"
                              >
                                <strong>Issue:</strong> {test.comment}
                              </div>
                            ) : (
                              <button
                                onClick={() => {
                                  setCommentingTest(key);
                                  setFailureComment('');
                                }}
                                className="px-2 py-1 text-sm bg-[var(--border)] text-text2 border-none rounded-sm cursor-pointer"
                              >
                                + Add failure notes
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default TestingPanel;
