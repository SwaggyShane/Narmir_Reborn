// game/event-bus.js
// Central event bus for Phase 2 decoupling (Slice 2).
// Systems emit events; other systems listen.

class EventBus {
  constructor() {
    this.listeners = {};
  }

  /**
   * Subscribe to an event type.
   * @param {string} eventType - Event name (e.g., 'ring-completed')
   * @param {function} handler - Callback(data)
   */
  on(eventType, handler) {
    if (!this.listeners[eventType]) {
      this.listeners[eventType] = [];
    }
    this.listeners[eventType].push(handler);
  }

  /**
   * Unsubscribe from an event.
   * @param {string} eventType - Event name
   * @param {function} handler - The handler to remove
   */
  off(eventType, handler) {
    if (!this.listeners[eventType]) return;
    this.listeners[eventType] = this.listeners[eventType].filter(h => h !== handler);
  }

  /**
   * Emit an event synchronously.
   * @param {string} eventType - Event name
   * @param {*} data - Event payload
   */
  emit(eventType, data) {
    if (!this.listeners[eventType]) return;
    this.listeners[eventType].forEach(handler => {
      try {
        handler(data);
      } catch (err) {
        console.error(`[EventBus] Error in listener for ${eventType}:`, err);
      }
    });
  }

  /**
   * Emit multiple events in sequence.
   * @param {array} events - [{ type, data }, ...]
   */
  emitBatch(events) {
    events.forEach(({ type, data }) => this.emit(type, data));
  }

  /**
   * Clear all listeners (useful for testing).
   */
  clear() {
    this.listeners = {};
  }

  /**
   * Get count of listeners for an event (useful for testing).
   * @param {string} eventType - Event name
   * @returns {number} Listener count
   */
  listenerCount(eventType) {
    return this.listeners[eventType] ? this.listeners[eventType].length : 0;
  }
}

// Export singleton instance
module.exports = new EventBus();
