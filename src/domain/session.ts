import type { Message } from './message.js';

export const DEFAULT_MAX_GAP_MINUTES = 240;

export interface Session {
  startedAt: string;
  endedAt: string;
  messages: Message[];
}

export function splitIntoSessions(
  messages: Message[],
  maxGapMinutes = DEFAULT_MAX_GAP_MINUTES,
): Session[] {
  const sessions: Session[] = [];
  let current: Message[] = [];
  let lastTime: number | undefined;

  const close = () => {
    const first = current.at(0);
    const last = current.at(-1);
    if (first && last) {
      sessions.push({ startedAt: first.dateTime, endedAt: last.dateTime, messages: current });
    }
    current = [];
  };

  for (const message of messages) {
    const time = Date.parse(message.dateTime);
    if (lastTime !== undefined && time - lastTime > maxGapMinutes * 60_000) close();
    current.push(message);
    lastTime = time;
  }

  close();
  return sessions;
}
