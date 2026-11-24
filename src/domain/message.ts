import type { Client } from './ticket.js';

export interface Message {
  dateTime: string;
  author: string;
  content: string;
}

export interface Conversation {
  id: string;
  client: Client;
  messages: Message[];
}
