// Extracted from db/schema.js - transaction helpers (M2-4)

const { AsyncLocalStorage } = require('async_hooks');

const transactionStorage = new AsyncLocalStorage();

function resolveDbConnection(db) {
  const store = transactionStorage.getStore();
  const isStoreActive = store && !store.released;
  return isStoreActive ? store.client : db.pool;
}

module.exports = {
  transactionStorage,
  resolveDbConnection
};
