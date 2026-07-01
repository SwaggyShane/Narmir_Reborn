'use strict';

require('dotenv').config();

const assert = require('assert');
const { requireCsrfToken } = require('../routes/middleware');

function createResponse() {
  return {
    statusCode: null,
    payload: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.payload = body;
      return this;
    },
  };
}

function runRequireCsrfToken(req) {
  const res = createResponse();
  let nextCalled = false;
  requireCsrfToken(req, res, () => {
    nextCalled = true;
  });
  return { res, nextCalled };
}

{
  const { nextCalled, res } = runRequireCsrfToken({
    headers: { authorization: 'Bearer token-from-client' },
    cookies: {},
  });
  assert.equal(nextCalled, true, 'bearer-auth requests should bypass CSRF enforcement');
  assert.equal(res.statusCode, null);
}

{
  const { nextCalled, res } = runRequireCsrfToken({
    headers: {},
    cookies: { token: 'cookie-auth-token' },
  });
  assert.equal(nextCalled, false, 'cookie-auth requests still need a CSRF token');
  assert.equal(res.statusCode, 403);
  assert.deepEqual(res.payload, { error: 'CSRF token required' });
}

{
  const { nextCalled, res } = runRequireCsrfToken({
    headers: { 'x-csrf-token': 'alpha' },
    cookies: { token: 'cookie-auth-token', csrf_token: 'alpha' },
  });
  assert.equal(nextCalled, true, 'matching cookie/header CSRF tokens should pass');
  assert.equal(res.statusCode, null);
}

console.log('middleware-csrf.test.js passed');
