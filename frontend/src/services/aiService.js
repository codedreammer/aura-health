import api, { createClientError } from './api.js';

/**
 * Error codes that are transient enough to deserve exactly one retry.
 *
 * Specifically excluded:
 *  - RATE_LIMITED (429)     Retrying a 429 makes quota worse.
 *  - CANCELLED               The caller *intentionally* aborted the request.
 *  - OFFLINE                 Device has no internet — retry is futile.
 *  - REQUEST_ERROR (4xx)     Client error — retry with identical input cannot succeed.
 *  - UNAUTHORIZED            Response interceptor already handles logout.
 */
const RETRYABLE_CODES = new Set([
  'NETWORK_ERROR',
  'TIMEOUT',
  'SERVER_ERROR',
]);

const isRetryableCode = (code) => RETRYABLE_CODES.has(code);

/**
 * Small randomized backoff so parallel components retrying don't all hit at
 * the same millisecond (thundering herd mitigation).
 */
const jitteredBackoffMs = () => 350 + Math.floor(Math.random() * 350);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Generate a short alphanumeric id for per-request correlation.
 *
 * Not cryptographically secure — only used to match frontend/backend logs.
 */
const makeRequestId = () =>
  `ai_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

/**
 * Thin wrapper around POST /ai/chat.
 *
 * @param {string} message    The user-facing message (or formatted prompt
 *                            including conversation history). Max size checked
 *                            inline to avoid accidentally sending a 2 MB
 *                            string to Gemini.
 * @param {{ signal?: AbortSignal, contextId?: string, allowRetry?: boolean }} [options]
 * @returns {Promise<{ success: boolean, reply?: string, message?: string }>}
 *          Matches the envelope the backend actually returns.
 */
const chat = async (message, options = {}) => {
  const { signal, contextId, allowRetry = true } = options;

  if (typeof message !== 'string') {
    throw createClientError({
      code: 'REQUEST_ERROR',
      status: 400,
      message: 'Invalid message.',
    });
  }

  const trimmed = message.trim();
  if (!trimmed) {
    throw createClientError({
      code: 'REQUEST_ERROR',
      status: 400,
      message: 'A message is required.',
    });
  }

  // Defensive upper bound. The backend has its own prompt guards, but
  // rejecting here avoids an HTTP round-trip for obviously broken payloads.
  if (trimmed.length > 15_000) {
    throw createClientError({
      code: 'REQUEST_ERROR',
      status: 413,
      message: 'Message is too long. Please shorten it and try again.',
    });
  }

  let attempt = 0;
  const maxAttempts = allowRetry ? 2 : 1;
  let lastError = null;

  while (attempt < maxAttempts) {
    attempt += 1;

    // If a previous attempt was aborted or the caller already aborted the
    // outer signal, bail immediately without hammering the network.
    if (signal?.aborted) {
      throw createClientError({
        code: 'CANCELLED',
        message: 'Request cancelled.',
      });
    }

    try {
      const payload = {
        message: trimmed,
        meta: {
          requestId: makeRequestId(),
          contextId: contextId || null,
          attempt,
        },
      };

      const axiosConfig = {
        // Attach the optional signal so AbortController.abort() propagates
        // all the way down to the TCP socket.
        signal: signal || undefined,
      };

      const { data } = await api.post('/ai/chat', payload, axiosConfig);
      return data;
    } catch (error) {
      const code = error?.code || 'UNKNOWN';

      // CANCELLED is the "success" case for an aborted flow. Throw without
      // retry regardless of attempt counter.
      if (code === 'CANCELLED') {
        throw error;
      }

      // If we haven't exhausted retries AND the failure is transient, wait
      // a beat and loop around. Otherwise stash the error and exit the loop.
      if (attempt < maxAttempts && allowRetry && isRetryableCode(code)) {
        await sleep(jitteredBackoffMs());
        continue;
      }

      lastError = error;
      break;
    }
  }

  // If we get here, every attempt failed or a non-retryable error occurred.
  // lastError is guaranteed to be set because the only path that exits the
  // loop without returning is the catch branch above.
  throw lastError;
};

export default { chat };
