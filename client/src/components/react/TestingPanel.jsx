import React, { useState, useCallback } from 'react';

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
    tests: ['Alliances', 'Alliance Vault', 'Regional Control', 'Player-to-Player Trading', 'Messaging']
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

  const saveStatus = useCallback((newStatus) => {
    setTestStatus(newStatus);
    localStorage.setItem('narmir_test_status', JSON.stringify(newStatus));
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
  };

  const handleCommentSubmit = (groupId, testName) => {
    const key = getTestKey(groupId, testName);
    const newStatus = { ...testStatus };
    const testData = newStatus[key] || {};
    newStatus[key] = { ...testData, comment: failureComment };
    saveStatus(newStatus);
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

  return (
    <div id="testing" className="panel">
      <div className="card" style={{ marginTop: 0 }}>
        <div style={{ marginBottom: '16px' }}>
          <h2 style={{ margin: 0, marginBottom: '8px' }}>🧪 Testing Dashboard</h2>
          <p style={{ margin: 0, fontSize: '12px', color: 'var(--text2)' }}>
            Track testing progress across all game systems. Check off tests as completed and mark pass/fail.
          </p>
        </div>

        {TEST_GROUPS.map((group) => {
          const stats = getGroupStats(group);
          const isExpanded = expandedGroup === group.id;
          const progressPercent = stats.total > 0 ? Math.round((stats.finished / stats.total) * 100) : 0;

          return (
            <div
              key={group.id}
              style={{
                marginBottom: '12px',
                border: '1px solid var(--border)',
                borderRadius: '6px',
                overflow: 'hidden',
              }}
            >
              {/* Group Header */}
              <div
                onClick={() => setExpandedGroup(isExpanded ? null : group.id)}
                style={{
                  padding: '12px',
                  backgroundColor: 'var(--bg2)',
                  cursor: 'pointer',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div>
                  <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>{group.name}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text2)' }}>
                    ✓ {stats.finished}/{stats.total} · ✅ {stats.passed} · ❌ {stats.failed}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '12px', fontWeight: 'bold', color: progressPercent === 100 ? '#4ade80' : '#fbbf24' }}>
                    {progressPercent}%
                  </div>
                  <div style={{ fontSize: '10px' }}>{isExpanded ? '▼' : '▶'}</div>
                </div>
              </div>

              {/* Progress Bar */}
              <div style={{ height: '4px', backgroundColor: 'var(--border)' }}>
                <div
                  style={{
                    height: '100%',
                    width: `${progressPercent}%`,
                    backgroundColor: progressPercent === 100 ? '#4ade80' : '#fbbf24',
                    transition: 'width 0.3s ease',
                  }}
                />
              </div>

              {/* Tests List */}
              {isExpanded && (
                <div style={{ padding: '12px', backgroundColor: 'var(--bg1)' }}>
                  {group.tests.map((testName) => {
                    const key = getTestKey(group.id, testName);
                    const test = testStatus[key] || {};
                    const isFailing = test.passed === false;
                    const isCommentingThis = commentingTest === key;

                    return (
                      <div
                        key={key}
                        style={{
                          marginBottom: '10px',
                          padding: '8px',
                          backgroundColor: isFailing ? 'rgba(239, 68, 68, 0.1)' : 'transparent',
                          borderRadius: '4px',
                          borderLeft: isFailing ? '3px solid #ef4444' : 'none',
                          paddingLeft: isFailing ? '6px' : '8px',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: isFailing && test.comment ? '8px' : '0' }}>
                          {/* Finished Checkbox */}
                          <input
                            type="checkbox"
                            checked={test.finished || false}
                            onChange={() => toggleTestFinished(group.id, testName)}
                            style={{ cursor: 'pointer', marginRight: '4px' }}
                          />

                          {/* Test Name */}
                          <span style={{ flex: 1, textDecoration: test.finished ? 'line-through' : 'none', color: test.finished ? 'var(--text2)' : 'inherit' }}>
                            {testName}
                          </span>

                          {/* Pass/Fail Buttons */}
                          <button
                            onClick={() => setTestPassed(group.id, testName, true)}
                            style={{
                              padding: '4px 8px',
                              fontSize: '12px',
                              border: 'none',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              backgroundColor: test.passed === true ? '#4ade80' : 'var(--border)',
                              color: test.passed === true ? '#000' : 'inherit',
                            }}
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
                            style={{
                              padding: '4px 8px',
                              fontSize: '12px',
                              border: 'none',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              backgroundColor: test.passed === false ? '#ef4444' : 'var(--border)',
                              color: test.passed === false ? '#fff' : 'inherit',
                            }}
                            title="Mark as failed"
                          >
                            👎
                          </button>
                        </div>

                        {/* Failure Comment Section */}
                        {isFailing && (
                          <div style={{ marginLeft: '28px', fontSize: '12px' }}>
                            {isCommentingThis ? (
                              <div style={{ display: 'flex', gap: '4px' }}>
                                <textarea
                                  value={failureComment}
                                  onChange={(e) => setFailureComment(e.target.value)}
                                  placeholder="Add failure notes..."
                                  style={{
                                    flex: 1,
                                    padding: '6px',
                                    fontSize: '11px',
                                    borderRadius: '4px',
                                    border: '1px solid var(--border)',
                                    backgroundColor: 'var(--bg2)',
                                    color: 'inherit',
                                    minHeight: '60px',
                                    fontFamily: 'inherit',
                                    resize: 'vertical',
                                  }}
                                />
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                  <button
                                    onClick={() => handleCommentSubmit(group.id, testName)}
                                    style={{
                                      padding: '4px 8px',
                                      fontSize: '11px',
                                      backgroundColor: '#4ade80',
                                      color: '#000',
                                      border: 'none',
                                      borderRadius: '4px',
                                      cursor: 'pointer',
                                    }}
                                  >
                                    Save
                                  </button>
                                  <button
                                    onClick={() => {
                                      setCommentingTest(null);
                                      setFailureComment('');
                                    }}
                                    style={{
                                      padding: '4px 8px',
                                      fontSize: '11px',
                                      backgroundColor: 'var(--border)',
                                      border: 'none',
                                      borderRadius: '4px',
                                      cursor: 'pointer',
                                    }}
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            ) : test.comment ? (
                              <div
                                style={{
                                  padding: '6px',
                                  backgroundColor: 'var(--bg2)',
                                  borderRadius: '4px',
                                  cursor: 'pointer',
                                }}
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
                                style={{
                                  padding: '4px 8px',
                                  fontSize: '11px',
                                  backgroundColor: 'var(--border)',
                                  border: 'none',
                                  borderRadius: '4px',
                                  cursor: 'pointer',
                                  color: 'var(--text2)',
                                }}
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
    </div>
  );
};

export default TestingPanel;
