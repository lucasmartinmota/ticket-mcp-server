import { readdir, readFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import type { Client } from '../../domain/ticket.js';
import type { Conversation } from '../../domain/message.js';
import type { ConversationSource } from '../../ports/conversation-source.js';
import { parseWhatsAppExport } from './parse-export.js';

const ANDROID_PREFIX = /^Conversa do WhatsApp com /;

export class ExportFolderSource implements ConversationSource {
  constructor(private readonly folder: string) {}

  async list(): Promise<Conversation[]> {
    const files = (await readdir(this.folder)).filter((file) => file.endsWith('.txt'));
    return Promise.all(files.map((file) => this.read(file)));
  }

  async findById(id: string): Promise<Conversation | null> {
    const conversations = await this.list();
    return conversations.find((c) => c.id === id) ?? null;
  }

  private async read(file: string): Promise<Conversation> {
    const content = await readFile(join(this.folder, file), 'utf8');
    const id = basename(file, '.txt');
    return { id, client: toClient(id), messages: parseWhatsAppExport(content) };
  }
}

function toClient(id: string): Client {
  const name = id.replace(ANDROID_PREFIX, '').trim();
  const digits = name.replace(/\D/g, '');
  return digits.length >= 10 ? { name, phone: digits } : { name };
}
