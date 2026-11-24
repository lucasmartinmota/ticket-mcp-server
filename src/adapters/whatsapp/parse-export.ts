import type { Message } from '../../domain/message.js';

const ANDROID_LINE = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4}),? (\d{1,2}):(\d{2}) - ([^:]+): (.*)$/;

const IOS_LINE =
  /^\[(\d{1,2})\/(\d{1,2})\/(\d{2,4}),? (\d{1,2}):(\d{2})(?::\d{2})?\] ([^:]+): (.*)$/;

const STARTS_WITH_DATE = /^\[?\d{1,2}\/\d{1,2}\/\d{2,4}/;

const INVISIBLE_MARKS = /[\u200e\u200f]/g;

const pad = (value: string) => value.padStart(2, '0');
const fullYear = (year: string) => (year.length === 2 ? `20${year}` : year);

export function parseWhatsAppExport(content: string): Message[] {
  const messages: Message[] = [];

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.replace(INVISIBLE_MARKS, '');
    const match = ANDROID_LINE.exec(line) ?? IOS_LINE.exec(line);

    if (match) {
      const [, day, month, year, hour, minute, author, text] = match as unknown as string[];
      messages.push({
        dateTime: `${fullYear(year!)}-${pad(month!)}-${pad(day!)}T${pad(hour!)}:${minute}`,
        author: author!.trim(),
        content: text!,
      });
      continue;
    }

    if (STARTS_WITH_DATE.test(line)) continue;

    const last = messages.at(-1);
    if (last && line.trim() !== '') last.content += `\n${line}`;
  }

  return messages;
}
