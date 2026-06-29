// Load test processor for Artillery
// Supports hooks for custom request/response handling

module.exports = {
  setup(context, ee, next) {
    console.log("Load test processor initialized");
    next();
  },

  beforeRequest(requestParams, context, ee, next) {
    // Add any dynamic headers or auth tokens here
    requestParams.headers["User-Agent"] = "LoadTester/1.0";
    next();
  },

  afterResponse(requestParams, response, context, ee, next) {
    // Track response times and status codes
    const responseTime = response.statusCode === 200 ? response.timings.total : -1;
    if (responseTime > 3000) {
      console.warn(`Slow response detected: ${response.statusCode} - ${responseTime}ms`);
    }
    next();
  },

  cleanup(context, ee, next) {
    console.log("Load test complete");
    next();
  }
};
