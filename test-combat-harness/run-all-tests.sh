#!/bin/bash

# Combat Test Harness - Complete Test Suite Runner
#
# Runs all test scenarios and generates comprehensive reports
#
# Usage:
#   bash test-combat-harness/run-all-tests.sh

set -e

echo "╔════════════════════════════════════════════════════════════╗"
echo "║        Combat System - Comprehensive Test Suite            ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# Create test results directory
mkdir -p test-results

echo "📋 TEST EXECUTION PLAN"
echo "─────────────────────────────────────────────────────────────"
echo "  Phase 1: Race Matchups (56 scenarios)"
echo "  Phase 2: All Scenarios (1500+ scenarios)"
echo "  Phase 3: Stress Testing (Edge cases)"
echo "  Phase 4: Analysis & Reporting"
echo ""

# Phase 1: Race Matchups
echo "⏱️  Phase 1: Testing all race matchups..."
echo "   Running: human, orc, dwarf, dark_elf, vampire, dire_wolf, wood_elf, ogre"
node test-combat-harness/combat-test-runner.js --all-race-matchups
PHASE1_RESULT=$?

if [ $PHASE1_RESULT -ne 0 ]; then
  echo "⚠️  Phase 1 failed. Continuing with caution..."
fi

echo ""
echo "✓ Phase 1 complete"
echo ""

# Phase 2: All Scenarios (Comprehensive)
echo "⏱️  Phase 2: Running comprehensive test suite..."
echo "   This will test all matchups × army sizes × defense levels"
echo "   Estimated scenarios: 1500+"
node test-combat-harness/combat-test-runner.js --all-scenarios
PHASE2_RESULT=$?

if [ $PHASE2_RESULT -ne 0 ]; then
  echo "⚠️  Phase 2 failed. Continuing..."
fi

echo ""
echo "✓ Phase 2 complete"
echo ""

# Phase 3: Stress Testing
echo "⏱️  Phase 3: Running stress tests (edge cases)..."
node test-combat-harness/combat-test-runner.js --stress-test
PHASE3_RESULT=$?

if [ $PHASE3_RESULT -ne 0 ]; then
  echo "⚠️  Phase 3 failed."
fi

echo ""
echo "✓ Phase 3 complete"
echo ""

# Phase 4: Analysis
echo "⏱️  Phase 4: Analyzing results..."
LATEST_RESULT=$(ls -t test-results/combat-test-results-*.json 2>/dev/null | head -1)

if [ -z "$LATEST_RESULT" ]; then
  echo "✗ No test results found"
  exit 1
fi

echo "   Analyzing: $LATEST_RESULT"
node test-combat-harness/analyze-results.js $(basename "$LATEST_RESULT")
ANALYSIS_RESULT=$?

echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║                    TEST SUITE COMPLETE                     ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# Summary
if [ $PHASE1_RESULT -eq 0 ] && [ $PHASE2_RESULT -eq 0 ] && [ $PHASE3_RESULT -eq 0 ]; then
  echo "✓ All test phases completed successfully"
  echo ""
  echo "📊 Results Summary:"
  echo "  Phase 1 (Race Matchups): PASS"
  echo "  Phase 2 (Comprehensive): PASS"
  echo "  Phase 3 (Stress Tests): PASS"
  echo ""
  echo "📁 Results saved to: test-results/"
  echo "📄 Latest result: $(basename "$LATEST_RESULT")"
else
  echo "⚠️  Some test phases had issues. Review details above."
fi

echo ""
