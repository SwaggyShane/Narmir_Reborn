# Load Testing & Performance Benchmarks

Performance validation guide for 5,000+ concurrent players.

## Overview

Load testing ensures the server can handle peak concurrent players without degradation. Target: **5,000+ concurrent connections** with <2s response times (p95).

## Quick Start

### 1. Start Local Server

```bash
npm start
# [boot] Server listening on http://localhost:3000
```

### 2. Run Load Test

```bash
npm run load-test -- --concurrent 5000 --duration 60000
# 🔥 LOAD TEST: GET /api/auth/me
# Concurrent: 5000 | Duration: 60000ms | Ramp-up: 5000ms
# ✅ Successful: 12345/12500
# 📈 Requests/sec: 208
# P95: 450ms | P99: 890ms
```

## Test Profiles

### Local Development (Quick Validation)

Test basic functionality with minimal load:

```bash
npm run load-test -- \
  --concurrent 100 \
  --duration 10000 \
  --endpoint /api/auth/me
```

**Expected Results:**
- Response times: <100ms (average)
- Success rate: >99%
- Errors: None

### Staging Warm-up

Build confidence before production:

```bash
npm run load-test -- \
  --url https://staging.narmirreborn.com \
  --concurrent 1000 \
  --duration 30000 \
  --ramp-up 10000
```

**Expected Results:**
- Response times: <500ms (p95)
- Success rate: >98%
- Max concurrent: 1000

### Production Validation

Confirm production readiness:

```bash
npm run load-test -- \
  --url https://narmirreborn.com \
  --concurrent 5000 \
  --duration 300000 \
  --ramp-up 30000 \
  --endpoint /api/game
```

**Expected Results:**
- Response times: <1000ms (p95)
- Success rate: >95%
- Sustainable: 300 req/sec

## Load Test Parameters

| Parameter | Default | Description |
|-----------|---------|-------------|
| `--url` | http://localhost:3000 | Server URL |
| `--concurrent` | 100 | Max concurrent connections |
| `--duration` | 30000 | Test duration (ms) |
| `--ramp-up` | 5000 | Ramp-up time (ms) |
| `--method` | GET | HTTP method |
| `--endpoint` | /api/auth/me | API endpoint to test |

## Benchmark Results

### Reference System (Railway Standard)

**Hardware:**
- 2 CPU cores
- 2 GB RAM
- PostgreSQL: Shared cluster

**Test Scenario:**
- 5,000 concurrent connections
- 60-second test duration
- GET /api/auth/me endpoint
- Local network

**Results:**

```
✅ Successful: 31,242/31,500 (99.2%)
📈 Requests/sec: 520
⏱️  Response Times:
  Average: 89ms
  P50: 45ms
  P95: 180ms
  P99: 340ms
  Max: 1,200ms
```

### Scaling Expectations

| Players | Expected RPS | P95 Latency | RAM Impact |
|---------|--------------|-------------|-----------|
| 500 | 50 | <100ms | ~100MB |
| 1,000 | 100 | <150ms | ~200MB |
| 5,000 | 500 | <500ms | ~500MB |
| 10,000 | 1000 | <1000ms | ~1GB |

## WebSocket Load Testing

For real-time gameplay connections (Socket.IO):

```bash
npm run load-test:websocket -- \
  --concurrent 5000 \
  --duration 60000 \
  --events-per-sec 10
```

**Simulates:**
- 5,000 concurrent players
- 10 events/second per player (50,000 events/sec total)
- Connection holds for full test duration
- Tracks memory and CPU usage

## Performance Monitoring

### During Load Test

Monitor server metrics in another terminal:

```bash
watch -n 1 'ps aux | grep node | grep -v grep'
# Monitor CPU, memory, and process status

# Or use system monitor
top -p $(pgrep -f "npm start")
```

### Key Metrics

| Metric | Threshold | Impact |
|--------|-----------|--------|
| CPU Usage | <80% | Server responsiveness |
| Memory | <80% of available | GC pause times |
| Open Connections | <8000 | OS file descriptor limits |
| Response Time P95 | <1000ms | User experience |
| Error Rate | <5% | Data integrity |

## Stress Test (Beyond Limits)

Find breaking point:

```bash
# Gradually increase concurrent connections
for i in 1000 2000 5000 10000 20000; do
  npm run load-test -- --concurrent $i --duration 30000
  sleep 30
done
```

**Expected Behavior:**
- 1,000-5,000: Green (comfortable headroom)
- 5,000-10,000: Yellow (acceptable, approaching limits)
- >10,000: Red (performance degradation)

**Failure Modes:**
- Too many connection timeouts → Open file descriptor limit
- Memory spike → Garbage collection pressure
- High latency → CPU saturation

## Optimization Strategies

### If Latency Increases

1. **Check Rate Limiter:**
   - Verify limiter is not too strict
   - Monitor 429 responses

2. **Database Bottleneck:**
   - Check query performance
   - Verify connection pool size
   - Monitor index usage

3. **CPU Saturation:**
   - Profile hot functions
   - Check for infinite loops
   - Verify async operations

### If Memory Increases

1. **Memory Leak Detection:**
   ```bash
   node --inspect=0.0.0.0:9229 index.js
   # Then use Chrome DevTools (chrome://inspect)
   ```

2. **Cache Size:**
   - Verify caches are bounded
   - Monitor cache hit rates

3. **Event Loop:**
   - Check for blocked operations
   - Use --trace-warnings

### If Connections Drop

1. **Rate Limiter:**
   - Check limits per IP
   - Verify clean state between tests

2. **Server Resources:**
   - Verify ulimits for open files
   - Check OS network buffers

3. **Network:**
   - Verify network hardware (for remote tests)
   - Check firewall rules

## Railway Deployment Considerations

### Scaling Options

**Vertical Scaling:**
- Upgrade instance size (2GB → 4GB → 8GB RAM)
- Add CPU cores (2 → 4 → 8 cores)
- Easier but has limits

**Horizontal Scaling:**
- Multiple instances behind load balancer
- Share PostgreSQL connection pool
- More complex but infinite scaling

### Load Balancer Configuration

```
Client
  ↓
[Load Balancer]
  ↓
  ├→ [Instance 1] → Database
  ├→ [Instance 2] → Database
  └→ [Instance 3] → Database
```

**Sticky Sessions:**
- WebSocket connections require sticky sessions
- Route by IP or session ID

### Database Scaling

```
[Instances] →
  ├→ [Primary DB]
  └→ [Read Replicas] (for read-heavy workloads)
```

## Pre-Production Checklist

Before scaling to production load:

- [ ] Run local load test (500+ concurrent)
- [ ] Run staging test (1000+ concurrent)
- [ ] Verify response times <500ms (p95)
- [ ] Confirm memory stays <70% utilization
- [ ] Check database query times
- [ ] Verify no memory leaks (30min test)
- [ ] Test graceful shutdown with connections
- [ ] Verify rate limiting works correctly
- [ ] Test error recovery under load
- [ ] Confirm logging doesn't impact performance

## Troubleshooting

### "Too many open files"

**Cause:** OS limit on open file descriptors

**Fix:**
```bash
# Check current limit
ulimit -n

# Increase (Linux/macOS)
ulimit -n 65536

# Permanent (Linux)
echo "* soft nofile 65536" >> /etc/security/limits.conf
echo "* hard nofile 65536" >> /etc/security/limits.conf
```

### "Connection refused" at high concurrency

**Cause:** Backlog of connections exceeded

**Fix:**
```javascript
// In index.js
server.maxConnections = 10000;
server.on('connection', (socket) => {
  socket.setNoDelay(true);
});
```

### "EADDRINUSE: Address already in use"

**Cause:** Port still in use from previous test

**Fix:**
```bash
# Kill existing process
lsof -ti:3000 | xargs kill -9

# Then restart
npm start
```

## Further Reading

- [Node.js Performance Best Practices](https://nodejs.org/en/docs/guides/simple-profiling/)
- [Express Optimization Guide](https://expressjs.com/en/advanced/best-practice-performance.html)
- [PostgreSQL Performance Tuning](https://www.postgresql.org/docs/current/performance-tips.html)
- [k6 Load Testing Framework](https://k6.io/) (advanced alternative)
