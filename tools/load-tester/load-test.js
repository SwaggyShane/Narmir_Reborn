#!/usr/bin/env node

/**
 * Load Testing Utility for Narmir Reborn
 * Tests concurrent player connections, API endpoints, and WebSocket stability
 *
 * Usage:
 *   npm run load-test -- --concurrent 5000 --duration 60000 --url http://localhost:3000
 */

const http = require('http');
const https = require('https');
const { URL } = require('url');

class LoadTester {
  constructor(options = {}) {
    this.baseUrl = options.url || 'http://localhost:3000';
    this.concurrent = options.concurrent || 100;
    this.duration = options.duration || 30000;
    this.method = options.method || 'GET';
    this.endpoint = options.endpoint || '/api/auth/me';
    this.rampUp = options.rampUp || 5000;

    this.stats = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      errors: {},
      statusCodes: {},
      responseTimes: [],
      startTime: null,
      endTime: null,
      peakConcurrent: 0,
      currentConcurrent: 0
    };

    this.protocol = this.baseUrl.startsWith('https') ? https : http;

    const agentOptions = {
      keepAlive: true,
      maxSockets: this.concurrent,
      maxFreeSockets: this.concurrent,
      timeout: 60000
    };
    this.agent = this.baseUrl.startsWith('https')
      ? new https.Agent(agentOptions)
      : new http.Agent(agentOptions);
  }

  async runLoadTest() {
    console.log(`\n🔥 LOAD TEST: ${this.method} ${this.endpoint}`);
    console.log(`Concurrent: ${this.concurrent} | Duration: ${this.duration}ms | Ramp-up: ${this.rampUp}ms`);
    console.log('────────────────────────────────────────────');

    const startTime = Date.now();
    const endTime = startTime + this.duration;
    this.stats.startTime = startTime;

    const runWorker = async () => {
      while (Date.now() < endTime) {
        this.stats.currentConcurrent++;
        if (this.stats.currentConcurrent > this.stats.peakConcurrent) {
          this.stats.peakConcurrent = this.stats.currentConcurrent;
        }
        await this.sendRequest();
        this.stats.currentConcurrent--;
      }
    };

    const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const workers = [];

    for (let i = 0; i < this.concurrent; i++) {
      const rampUpDelay = (this.rampUp / this.concurrent) * i;
      workers.push((async () => {
        if (rampUpDelay > 0) {
          await delay(rampUpDelay);
        }
        if (Date.now() < endTime) {
          await runWorker();
        }
      })());
    }

    await Promise.all(workers);
    this.stats.endTime = Date.now();
  }

  async sendRequest() {
    return new Promise((resolve) => {
      let finished = false;
      const startTime = Date.now();
      const url = new URL(this.endpoint, this.baseUrl);

      const options = {
        method: this.method,
        timeout: 10000,
        agent: this.agent
      };

      const req = this.protocol.request(url, options, (res) => {
        res.resume();
        res.on('end', () => {
          if (finished) return;
          finished = true;
          const responseTime = Date.now() - startTime;
          this.recordResponse(res.statusCode, responseTime);
          resolve();
        });
      });

      req.on('error', (err) => {
        if (finished) return;
        finished = true;
        this.recordError(err.code || err.message);
        resolve();
      });

      req.on('timeout', () => {
        if (finished) return;
        finished = true;
        req.destroy();
        this.recordError('TIMEOUT');
        resolve();
      });

      req.end();
    });
  }

  recordResponse(statusCode, responseTime) {
    this.stats.totalRequests++;

    const MAX_SAMPLES = 100000;
    if (this.stats.responseTimes.length < MAX_SAMPLES) {
      this.stats.responseTimes.push(responseTime);
    } else {
      const randomIndex = Math.floor(Math.random() * this.stats.totalRequests);
      if (randomIndex < MAX_SAMPLES) {
        this.stats.responseTimes[randomIndex] = responseTime;
      }
    }

    if (statusCode < 400) {
      this.stats.successfulRequests++;
    } else if (statusCode < 500) {
      this.stats.failedRequests++;
    } else {
      this.stats.failedRequests++;
    }

    this.stats.statusCodes[statusCode] = (this.stats.statusCodes[statusCode] || 0) + 1;
  }

  recordError(error) {
    this.stats.totalRequests++;
    this.stats.failedRequests++;
    this.stats.errors[error] = (this.stats.errors[error] || 0) + 1;
  }

  printReport() {
    const elapsed = this.stats.endTime - this.stats.startTime;
    const avgResponseTime = this.stats.responseTimes.length > 0
      ? Math.round(this.stats.responseTimes.reduce((a, b) => a + b, 0) / this.stats.responseTimes.length)
      : 0;

    const responseTimes = this.stats.responseTimes.sort((a, b) => a - b);
    const p50 = responseTimes[Math.floor(responseTimes.length * 0.5)] || 0;
    const p95 = responseTimes[Math.floor(responseTimes.length * 0.95)] || 0;
    const p99 = responseTimes[Math.floor(responseTimes.length * 0.99)] || 0;
    const max = responseTimes.length > 0 ? responseTimes[responseTimes.length - 1] : 0;

    console.log('\n📊 RESULTS');
    console.log('────────────────────────────────────────────');
    console.log(`⏱️  Total Duration: ${elapsed}ms`);
    console.log(`✅ Successful: ${this.stats.successfulRequests}/${this.stats.totalRequests}`);
    console.log(`❌ Failed: ${this.stats.failedRequests}/${this.stats.totalRequests}`);
    const rps = elapsed > 0 ? Math.round(this.stats.totalRequests / (elapsed / 1000)) : 0;
    console.log(`📈 Requests/sec: ${rps}`);
    console.log(`🔼 Peak Concurrent: ${this.stats.peakConcurrent}`);

    console.log('\n⏳ RESPONSE TIMES (ms)');
    console.log('────────────────────────────────────────────');
    console.log(`Average: ${avgResponseTime}`);
    console.log(`P50 (Median): ${p50}`);
    console.log(`P95: ${p95}`);
    console.log(`P99: ${p99}`);
    console.log(`Max: ${max}`);

    if (Object.keys(this.stats.statusCodes).length > 0) {
      console.log('\n📍 STATUS CODES');
      console.log('────────────────────────────────────────────');
      Object.entries(this.stats.statusCodes).forEach(([code, count]) => {
        console.log(`${code}: ${count}`);
      });
    }

    if (Object.keys(this.stats.errors).length > 0) {
      console.log('\n⚠️  ERRORS');
      console.log('────────────────────────────────────────────');
      Object.entries(this.stats.errors).forEach(([error, count]) => {
        console.log(`${error}: ${count}`);
      });
    }

    const successRate = (this.stats.successfulRequests / this.stats.totalRequests * 100).toFixed(2);
    console.log('\n' + (successRate >= 95 ? '✅' : '⚠️') + ` SUCCESS RATE: ${successRate}%`);
    console.log('════════════════════════════════════════════\n');
  }
}

// CLI
const { parseArgs } = require('util');

const { values: cliArgs } = parseArgs({
  options: {
    url: { type: 'string' },
    concurrent: { type: 'string' },
    duration: { type: 'string' },
    'ramp-up': { type: 'string' },
    method: { type: 'string' },
    endpoint: { type: 'string' }
  },
  strict: false
});

const tester = new LoadTester({
  url: cliArgs.url || 'http://localhost:3000',
  concurrent: parseInt(cliArgs.concurrent) || 100,
  duration: parseInt(cliArgs.duration) || 30000,
  rampUp: parseInt(cliArgs['ramp-up']) || 5000,
  method: (cliArgs.method || 'GET').toUpperCase(),
  endpoint: cliArgs.endpoint || '/api/auth/me'
});

tester.runLoadTest().then(() => {
  tester.printReport();
  process.exit(0);
}).catch(err => {
  console.error('Load test error:', err);
  process.exit(1);
});
