/** Client reconnect rules, kept pure so the timings can be tested without a browser. */

export const POLL_STEPS_MS = [1_500, 3_000, 6_000] as const;
export const SSE_RETRY_WHILE_POLLING_MS = 15_000;
export const LOST_AFTER_MS = 10_000;

export type Link = {
  failures: number;
  polling: boolean;
  lost: boolean;
  pollMs: number;
  lastId: number;
};

export function freshLink(): Link {
  return { failures: 0, polling: false, lost: false, pollMs: POLL_STEPS_MS[0], lastId: 0 };
}

/** A chain, patch, or heartbeat arrived. Failures go back to zero and polling stops. */
export function noteDelivery(link: Link, id: number): { link: Link; apply: boolean; restored: boolean } {
  if (id > 0 && id <= link.lastId) return { link, apply: false, restored: false };
  const restored = link.lost;
  return {
    apply: true,
    restored,
    link: {
      failures: 0,
      polling: false,
      lost: false,
      pollMs: POLL_STEPS_MS[0],
      lastId: id > 0 ? id : link.lastId,
    },
  };
}

/** The stream socket failed. Poll after the third failure, and keep asking for SSE every 15s. */
export function noteDrop(link: Link): { link: Link; startPoll: boolean; retryMs: number } {
  const failures = link.failures + 1;
  const startPoll = failures >= 3;
  let pollMs = link.pollMs;
  if (startPoll && !link.polling) pollMs = POLL_STEPS_MS[0];
  else if (startPoll && link.polling) {
    pollMs = link.pollMs < 3_000 ? POLL_STEPS_MS[1] : POLL_STEPS_MS[2];
  }
  const retryMs = startPoll ? SSE_RETRY_WHILE_POLLING_MS : Math.min(30_000, 1_000 * 2 ** (failures - 1));
  return {
    startPoll,
    retryMs,
    link: { ...link, failures, polling: startPoll || link.polling, pollMs },
  };
}

export function noteLost(link: Link): Link {
  return link.lost ? link : { ...link, lost: true };
}
