"use strict";

/**
 * YouTubeTokenService
 *
 * Genera y mantiene poToken + visitorData para el plugin de YouTube de Lavalink.
 * Usa youtubei.js (Innertube) para generar sesiones automáticamente.
 * Fallback a Playwright si Innertube falla en IPs de datacenter.
 *
 * Estrategia:
 *  1. Intentar crear sesión Innertube y extraer tokens
 *  2. Cachear en disco con TTL
 *  3. Renovar automáticamente antes de expiración
 *  4. Fallback a cookies si están configuradas
 */

const fs = require("fs");
const path = require("path");
const { Innertube, UniversalCache } = require("youtubei.js");
const { createLogger } = require("../utils/logger");

const log = createLogger("YouTubeTokenService");

const TOKEN_CACHE_FILE = process.env.YOUTUBE_TOKEN_CACHE || path.join(process.cwd(), ".youtube-tokens.json");
const TOKEN_REFRESH_INTERVAL_MS = parseInt(process.env.YOUTUBE_TOKEN_REFRESH_MS || "1800000", 10); // 30 min
const TOKEN_TTL_MS = parseInt(process.env.YOUTUBE_TOKEN_TTL_MS || "3600000", 10); // 1 hora

class YouTubeTokenService {
  constructor() {
    this.tokens = {
      poToken: null,
      visitorData: null,
      generatedAt: 0,
    };
    this.refreshTimer = null;
    this.innertube = null;
  }

  async start() {
    log.info("Starting YouTubeTokenService...");
    await this._loadCachedTokens();

    if (this._isExpired()) {
      await this.refreshTokens();
    } else {
      log.info("Using cached YouTube tokens", { age: Date.now() - this.tokens.generatedAt });
    }

    this.refreshTimer = setInterval(() => {
      if (this._isExpired()) {
        this.refreshTokens().catch((err) => {
          log.error("Scheduled token refresh failed", { error: err.message });
        });
      }
    }, TOKEN_REFRESH_INTERVAL_MS);
  }

  stop() {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  getTokens() {
    return {
      poToken: this.tokens.poToken,
      visitorData: this.tokens.visitorData,
      valid: !this._isExpired(),
    };
  }

  _isExpired() {
    if (!this.tokens.generatedAt) return true;
    return Date.now() - this.tokens.generatedAt > TOKEN_TTL_MS;
  }

  async _loadCachedTokens() {
    try {
      if (!fs.existsSync(TOKEN_CACHE_FILE)) return;
      const raw = await fs.promises.readFile(TOKEN_CACHE_FILE, "utf8");
      const data = JSON.parse(raw);
      if (data.poToken && data.visitorData && data.generatedAt) {
        this.tokens = data;
        log.debug("Loaded cached tokens from disk");
      }
    } catch (err) {
      log.warn("Failed to load cached tokens", { error: err.message });
    }
  }

  async _saveCachedTokens() {
    try {
      await fs.promises.writeFile(TOKEN_CACHE_FILE, JSON.stringify(this.tokens, null, 2));
      log.debug("Saved tokens to disk");
    } catch (err) {
      log.warn("Failed to save tokens", { error: err.message });
    }
  }

  async refreshTokens() {
    log.info("Refreshing YouTube tokens...");

    try {
      await this._refreshViaInnertube();
      log.info("Tokens refreshed via Innertube");
      await this._saveCachedTokens();
      return;
    } catch (err) {
      log.warn("Innertube token refresh failed, trying Playwright fallback...", { error: err.message });
    }

    try {
      await this._refreshViaPlaywright();
      log.info("Tokens refreshed via Playwright");
      await this._saveCachedTokens();
      return;
    } catch (err) {
      log.error("Playwright token refresh also failed", { error: err.message });
    }

    // Si todo falla pero tenemos tokens cacheados aunque expirados, los seguimos usando
    if (this.tokens.poToken && this.tokens.visitorData) {
      log.warn("Using stale tokens — playback may fail with 403");
    } else {
      log.error("No valid tokens available. YouTube playback will likely fail.");
    }
  }

  /**
   * Usa youtubei.js para crear una sesión y extraer poToken + visitorData.
   * Requiere que youtubei.js >= 13.x tenga soporte para poToken.
   */
  async _refreshViaInnertube() {
    if (!this.innertube) {
      this.innertube = await Innertube.create({
        cache: new UniversalCache(false),
        generate_session_locally: true,
      });
    }

    const session = this.innertube.session;

    // Extraer visitorData del contexto del cliente
    const visitorData = session?.context?.client?.visitorData || session?.visitorData;

    // poToken puede estar disponible en session po_token o botguard
    let poToken = session?.po_token || session?.potoken;

    // Si no hay poToken, intentamos generar uno via botguard
    if (!poToken && this.innertube.botguard) {
      try {
        poToken = await this.innertube.botguard.generatePoToken();
      } catch {
        // ignore
      }
    }

    if (!visitorData) {
      throw new Error("Innertube did not return visitorData");
    }

    this.tokens = {
      poToken: poToken || null,
      visitorData: visitorData,
      generatedAt: Date.now(),
    };
  }

  /**
   * Fallback: usa Playwright para navegar YouTube y extraer tokens
   * de las cookies/localStorage o interceptando requests.
   */
  async _refreshViaPlaywright() {
    const playwright = require("playwright");

    const browser = await playwright.chromium.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-accelerated-2d-canvas",
        "--disable-gpu",
        "--disable-extensions",
        "--disable-plugins",
        "--window-size=1280,720",
      ],
    });

    try {
      const context = await browser.newContext({
        userAgent:
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36",
        viewport: { width: 1280, height: 720 },
      });

      const page = await context.newPage();

      let visitorData = null;
      let poToken = null;

      // Interceptar requests para capturar tokens
      await page.route("**/*", (route, request) => {
        const url = request.url();
        const postData = request.postData();

        if (url.includes("youtubei/v1/player") && postData) {
          try {
            const payload = JSON.parse(postData);
            if (payload.context?.client?.visitorData) {
              visitorData = payload.context.client.visitorData;
            }
            if (payload.serviceIntegrityDimensions?.poToken) {
              poToken = payload.serviceIntegrityDimensions.poToken;
            }
          } catch {
            // ignore parse errors
          }
        }
        route.continue();
      });

      await page.goto("https://www.youtube.com/watch?v=dQw4w9WgXcQ", {
        waitUntil: "networkidle",
        timeout: 30000,
      });

      // Esperar a que el player cargue y se hagan requests
      await page.waitForTimeout(5000);

      // Si no se capturó via intercept, intentar extraer del contexto JS
      if (!visitorData) {
        visitorData = await page.evaluate(() => {
          try {
            const ytcfg = window.ytcfg;
            return ytcfg?.get("VISITOR_DATA") || ytcfg?.get("visitorData");
          } catch {
            return null;
          }
        });
      }

      if (!poToken) {
        poToken = await page.evaluate(() => {
          try {
            // Algunas implementaciones de YouTube guardan poToken en window
            return window._poToken || window.ytPoToken;
          } catch {
            return null;
          }
        });
      }

      if (!visitorData) {
        throw new Error("Playwright could not extract visitorData");
      }

      this.tokens = {
        poToken: poToken || null,
        visitorData: visitorData,
        generatedAt: Date.now(),
      };
    } finally {
      await browser.close();
    }
  }
}

module.exports = { YouTubeTokenService };
