import type { Conversation } from '../domain/message.js';

export interface ConversationSource {
  list(): Promise<Conversation[]>;

  findById(id: string): Promise<Conversation | null>;
}
