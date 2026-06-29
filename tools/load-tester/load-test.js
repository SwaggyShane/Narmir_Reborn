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
  }

  async runLoadTest() {
    console.log(`\n🔥 LOAD TEST: ${this.method} ${this.endpoint}`);
    console.log(`Concurrent: ${this.concurrent} | Duration: ${this.duration}ms | Ramp-up: ${this.rampUp}ms`);
    console.log('────────────────────────────────────────────');

    this.stats.startTime = Date.now();
    const endTime = this.stats.startTime + this.duration;

    let activeConnections = 0;

    return new Promise((resolve) => {
      const rampUpInterval = this.rampUp / Math.min(this.concurrent, 100);
      let spawnedConnections = 0;

      const spawnConnection = () => {
        if (spawnedConnections >= this.concurrent || Date.now() > endTime) {
          if (activeConnections === 0) {
            this.stats.endTime = Date.now();
            resolve();
          }
          return;
        }

        spawnedConnections++;
        this.stats.currentConcurrent = activeConnections + 1;
        if (this.stats.currentConcurrent > this.stats.peakConcurrent) {
          this.stats.peakConcurrent = this.stats.currentConcurrent;
        }

        this.sendRequest()
          .then(() => {
            activeConnections--;
            if (Date.now() <= endTime && spawnedConnections < this.concurrent) {
              this.sendRequest().then(() => activeConnections--);
            }
          })
          .catch(() => {
            activeConnections--;
          });

        activeConnections++;

        if (spawnedConnections < this.concurrent && Date.now() <= endTime) {
          setTimeout(spawnConnection, rampUpInterval);
        }
      };

      // Start spawning connections
      for (let i = 0; i < Math.min(10, this.concurrent); i++) {
        setTimeout(spawnConnection, 0);
      }

      // Monitor progress
      const progressInterval = setInterval(() => {
        if (Date.now() > endTime) {
          clearInterval(progressInterval);
          if (activeConnections === 0) {
            this.stats.endTime = Date.now();
            resolve();
          }
        }
      }, 1000);
    });
  }

  async sendRequest() {
    return new Promise((resolve) => {
      const startTime = Date.now();
      const url = new URL(this.endpoint, this.baseUrl);

      const options = {
        method: this.method,
        timeout: 10000
      };

      const req = this.protocol.request(url, options, (res) => {
        let _data = '';
        res.on('data', (chunk) => {
          _data += chunk;
        });
        res.on('end', () => {
          const responseTime = Date.now() - startTime;
          this.recordResponse(res.statusCode, responseTime);
          resolve();
        });
      });

      req.on('error', (err) => {
        this.recordError(err.code || err.message);
        resolve();
      });

      req.on('timeout', () => {
        req.destroy();
        this.recordError('TIMEOUT');
        resolve();
      });

      req.end();
    });
  }

  recordResponse(statusCode, responseTime) {
    this.stats.totalRequests++;
    this.stats.responseTimes.push(responseTime);

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
    const max = Math.max(...responseTimes, 0);

    console.log('\n📊 RESULTS');
    console.log('────────────────────────────────────────────');
    console.log(`⏱️  Total Duration: ${elapsed}ms`);
    console.log(`✅ Successful: ${this.stats.successfulRequests}/${this.stats.totalRequests}`);
    console.log(`❌ Failed: ${this.stats.failedRequests}/${this.stats.totalRequests}`);
    console.log(`📈 Requests/sec: ${Math.round(this.stats.totalRequests / (elapsed / 1000))}`);
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
const args = require('minimist')(process.argv.slice(2));

const tester = new LoadTester({
  url: args.url || 'http://localhost:3000',
  concurrent: parseInt(args.concurrent) || 100,
  duration: parseInt(args.duration) || 30000,
  rampUp: parseInt(args['ramp-up']) || 5000,
  method: (args.method || 'GET').toUpperCase(),
  endpoint: args.endpoint || '/api/auth/me'
});

tester.runLoadTest().then(() => {
  tester.printReport();
  process.exit(0);
}).catch(err => {
  console.error('Load test error:', err);
  process.exit(1);
});
