"use strict";

/**
 * NodeHealthMonitor
 *
 * Monitorea la salud de los nodos Lavalink, implementa circuit breaker
 * y recolecta métricas para diagnóstico.
 */

const { createLogger } = require("../utils/logger");

const log = createLogger("NodeHealthMonitor");

const CIRCUIT_STATES = {
  CLOSED: "CLOSED",       // Normal operation
  OPEN: "OPEN",           // Failing fast
  HALF_OPEN: "HALF_OPEN", // Testing recovery
};

class NodeHealthMonitor {
  constructor() {
    this.nodes = new Map();
    this.globalStats = {
      totalTracksPlayed: 0,
      totalErrors: 0,
      errorsByType: new Map(),
      lastErrorAt: null,
    };
  }

  registerNode(name, url) {
    if (this.nodes.has(name)) return;

    this.nodes.set(name, {
      name,
      url,
      state: CIRCUIT_STATES.CLOSED,
      failures: 0,
      successes: 0,
      lastFailureAt: null,
      lastSuccessAt: null,
      consecutiveFailures: 0,
      circuitOpenedAt: null,
      circuitHalfOpenAt: null,
      stats: {
        tracksPlayed: 0,
        errors: 0,
        avgResponseTime: 0,
        responseTimes: [],
      },
    });

    log.info("Registered node for health monitoring", { name, url });
  }

  recordSuccess(name, responseTimeMs = 0) {
    const node = this.nodes.get(name);
    if (!node) return;

    node.successes++;
    node.consecutiveFailures = 0;
    node.lastSuccessAt = Date.now();

    if (node.stats.responseTimes.length > 100) node.stats.responseTimes.shift();
    if (responseTimeMs > 0) node.stats.responseTimes.push(responseTimeMs);

    if (node.state === CIRCUIT_STATES.HALF_OPEN) {
      node.state = CIRCUIT_STATES.CLOSED;
      node.circuitHalfOpenAt = null;
      log.info("Circuit breaker CLOSED for node", { name });
    }
  }

  recordFailure(name, errorType = "unknown") {
    const node = this.nodes.get(name);
    if (!node) return;

    node.failures++;
    node.consecutiveFailures++;
    node.lastFailureAt = Date.now();
    node.stats.errors++;

    this.globalStats.totalErrors++;
    this.globalStats.lastErrorAt = Date.now();
    this.globalStats.errorsByType.set(
      errorType,
      (this.globalStats.errorsByType.get(errorType) || 0) + 1
    );

    const threshold = parseInt(process.env.CIRCUIT_BREAKER_THRESHOLD || "5", 10);
    const recoveryMs = parseInt(process.env.CIRCUIT_RECOVERY_MS || "30000", 10);

    if (node.state === CIRCUIT_STATES.CLOSED && node.consecutiveFailures >= threshold) {
      node.state = CIRCUIT_STATES.OPEN;
      node.circuitOpenedAt = Date.now();
      log.warn("Circuit breaker OPEN for node", { name, failures: node.consecutiveFailures });

      // Schedule half-open test
      setTimeout(() => {
        if (node.state === CIRCUIT_STATES.OPEN) {
          node.state = CIRCUIT_STATES.HALF_OPEN;
          node.circuitHalfOpenAt = Date.now();
          log.info("Circuit breaker HALF_OPEN for node", { name });
        }
      }, recoveryMs);
    }
  }

  isNodeAvailable(name) {
    const node = this.nodes.get(name);
    if (!node) return false;
    return node.state !== CIRCUIT_STATES.OPEN;
  }

  getBestNode(preferredName) {
    const preferred = this.nodes.get(preferredName);
    if (preferred && this.isNodeAvailable(preferredName)) {
      return preferredName;
    }

    // Fallback al primer nodo disponible
    for (const [name, node] of this.nodes) {
      if (this.isNodeAvailable(name)) return name;
    }

    return preferredName; // último recurso
  }

  getHealthReport() {
    const nodes = [];
    for (const [, node] of this.nodes) {
      const avgRT =
        node.stats.responseTimes.length > 0
          ? node.stats.responseTimes.reduce((a, b) => a + b, 0) / node.stats.responseTimes.length
          : 0;
      nodes.push({
        name: node.name,
        circuitState: node.state,
        failures: node.failures,
        successes: node.successes,
        consecutiveFailures: node.consecutiveFailures,
        lastFailureAt: node.lastFailureAt,
        avgResponseTime: Math.round(avgRT),
      });
    }

    return {
      nodes,
      global: {
        totalTracksPlayed: this.globalStats.totalTracksPlayed,
        totalErrors: this.globalStats.totalErrors,
        errorsByType: Object.fromEntries(this.globalStats.errorsByType),
        lastErrorAt: this.globalStats.lastErrorAt,
      },
    };
  }
}

module.exports = { NodeHealthMonitor, CIRCUIT_STATES };
