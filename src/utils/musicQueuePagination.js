"use strict";

const QUEUE_PAGE_SIZE = 10;
const MAX_CUSTOM_ID_LENGTH = 99;
const QUEUE_CUSTOM_ID_PREFIX = "music:queue";
const QUEUE_ACTIONS = Object.freeze({
  PREVIOUS: "prev",
  NEXT: "next",
  CLOSE: "close",
});

const OWNER_ID_PATTERN = /^\d{1,20}$/;
const SESSION_ID_PATTERN = /^[0-9a-z]+$/;
const PAGE_PATTERN = /^[1-9]\d*$/;

function createQueueSessionId(player) {
  const createdAt = Number(player?.createdAt);
  if (!Number.isSafeInteger(createdAt) || createdAt < 0) return "0";
  return createdAt.toString(36);
}

function validateIdentifier(value, pattern, name) {
  const identifier = String(value ?? "");
  if (!pattern.test(identifier)) {
    throw new TypeError(`Invalid queue ${name}`);
  }
  return identifier;
}

function assertCustomIdLength(customId) {
  if (customId.length > MAX_CUSTOM_ID_LENGTH) {
    throw new RangeError("Queue custom ID exceeds Discord's limit");
  }
  return customId;
}

function createQueueCustomId(action, ownerId, sessionId, page) {
  if (!Object.values(QUEUE_ACTIONS).includes(action)) {
    throw new TypeError("Invalid queue action");
  }

  const safeOwnerId = validateIdentifier(ownerId, OWNER_ID_PATTERN, "owner ID");
  const safeSessionId = validateIdentifier(sessionId, SESSION_ID_PATTERN, "session ID");

  if (action === QUEUE_ACTIONS.CLOSE) {
    return assertCustomIdLength(
      `${QUEUE_CUSTOM_ID_PREFIX}:${action}:${safeOwnerId}:${safeSessionId}`
    );
  }

  const safePage = validateIdentifier(page, PAGE_PATTERN, "page");
  const numericPage = Number(safePage);
  if (!Number.isSafeInteger(numericPage)) {
    throw new TypeError("Invalid queue page");
  }

  return assertCustomIdLength(
    `${QUEUE_CUSTOM_ID_PREFIX}:${action}:${safeOwnerId}:${safeSessionId}:${safePage}`
  );
}

function parseQueueCustomId(customId) {
  if (typeof customId !== "string" || customId.length > MAX_CUSTOM_ID_LENGTH) {
    return null;
  }

  const parts = customId.split(":");
  if (parts[0] !== "music" || parts[1] !== "queue") return null;

  const action = parts[2];
  if (action === QUEUE_ACTIONS.CLOSE) {
    if (parts.length !== 5) return null;
    const ownerId = parts[3];
    const sessionId = parts[4];
    if (!OWNER_ID_PATTERN.test(ownerId) || !SESSION_ID_PATTERN.test(sessionId)) {
      return null;
    }
    return { action, ownerId, sessionId, page: null };
  }

  if (
    (action !== QUEUE_ACTIONS.PREVIOUS && action !== QUEUE_ACTIONS.NEXT) ||
    parts.length !== 6
  ) {
    return null;
  }

  const ownerId = parts[3];
  const sessionId = parts[4];
  const pageValue = parts[5];
  if (
    !OWNER_ID_PATTERN.test(ownerId) ||
    !SESSION_ID_PATTERN.test(sessionId) ||
    !PAGE_PATTERN.test(pageValue)
  ) {
    return null;
  }

  const page = Number(pageValue);
  if (!Number.isSafeInteger(page)) return null;
  return { action, ownerId, sessionId, page };
}

function getQueuePagination(totalItems, requestedPage = 1) {
  const itemCount = Math.max(0, Math.trunc(Number(totalItems) || 0));
  const totalPages = Math.max(1, Math.ceil(itemCount / QUEUE_PAGE_SIZE));
  const numericPage = Math.trunc(Number(requestedPage) || 1);
  const page = Math.min(Math.max(1, numericPage), totalPages);
  const startIndex = (page - 1) * QUEUE_PAGE_SIZE;
  const endIndex = Math.min(startIndex + QUEUE_PAGE_SIZE, itemCount);

  return {
    page,
    totalPages,
    totalItems: itemCount,
    startIndex,
    endIndex,
    previousPage: Math.max(1, page - 1),
    nextPage: Math.min(totalPages, page + 1),
    previousDisabled: page <= 1 || itemCount === 0,
    nextDisabled: page >= totalPages || itemCount === 0,
  };
}

function getQueueTrackCount(queue) {
  if (!queue) return 0;
  if (Array.isArray(queue.tracks)) return queue.tracks.length;
  if (typeof queue[Symbol.iterator] === "function") {
    return Array.from(queue).length;
  }
  return Math.max(0, Math.trunc(Number(queue.size) || 0));
}

function paginateQueue(tracks, requestedPage = 1) {
  const queue = Array.isArray(tracks) ? tracks : Array.from(tracks || []);
  const pagination = getQueuePagination(queue.length, requestedPage);
  return {
    ...pagination,
    tracks: queue.slice(pagination.startIndex, pagination.endIndex),
  };
}

function isQueueSessionCurrent(player, sessionId) {
  return Boolean(player) && createQueueSessionId(player) === sessionId;
}

module.exports = {
  MAX_CUSTOM_ID_LENGTH,
  QUEUE_ACTIONS,
  QUEUE_CUSTOM_ID_PREFIX,
  QUEUE_PAGE_SIZE,
  createQueueCustomId,
  createQueueSessionId,
  getQueuePagination,
  getQueueTrackCount,
  isQueueSessionCurrent,
  paginateQueue,
  parseQueueCustomId,
};
