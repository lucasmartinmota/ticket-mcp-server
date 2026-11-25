import { createHash } from 'node:crypto';
import type { Message } from '../domain/message.js';
import { splitIntoSessions, DEFAULT_MAX_GAP_MINUTES } from '../domain/session.js';
import {
  BusinessTicketError,
  validateStatusTransition,
  type Status,
  type Ticket,
} from '../domain/ticket.js';
import type { ConversationSource } from '../ports/conversation-source.js';
import type { TicketFilter, TicketRepository } from '../ports/ticket-repository.js';
import { ConversationNotFoundError, TicketNotFoundError } from './errors.js';

const MAX_MESSAGES_PER_IMPORT = 500;

export interface TicketDraft {
  summary: string;
  resolution?: string;
  status: Status;
  startedAt: string;
  endedAt?: string;
  messageCount: number;
}

const day = (dateTime: string) => dateTime.slice(0, 10);

export class TicketService {
  constructor(
    private readonly conversations: ConversationSource,
    private readonly tickets: TicketRepository,
    private readonly now: () => string = () => new Date().toISOString(),
  ) {}

  async listConversations() {
    const all = await this.conversations.list();
    return all.map((c) => ({
      id: c.id,
      client: c.client,
      messageCount: c.messages.length,
      lastMessageAt: c.messages.at(-1)?.dateTime ?? null,
    }));
  }

  async importConversation(
    conversationId: string,
    from: string,
    to: string,
    maxGapMinutes = DEFAULT_MAX_GAP_MINUTES,
  ) {
    const conversation = await this.conversations.findById(conversationId);
    if (!conversation) throw new ConversationNotFoundError(conversationId);

    const inPeriod = conversation.messages.filter(
      (m: Message) => day(m.dateTime) >= from && day(m.dateTime) <= to,
    );

    if (inPeriod.length > MAX_MESSAGES_PER_IMPORT) {
      throw new BusinessTicketError(
        `The period has ${inPeriod.length} messages (max ${MAX_MESSAGES_PER_IMPORT}). Import a shorter period.`,
      );
    }

    return {
      conversationId: conversation.id,
      client: conversation.client,
      sessions: splitIntoSessions(inPeriod, maxGapMinutes),
    };
  }

  async saveTickets(conversationId: string, drafts: TicketDraft[]): Promise<Ticket[]> {
    const conversation = await this.conversations.findById(conversationId);
    if (!conversation) throw new ConversationNotFoundError(conversationId);

    const timestamp = this.now();
    const tickets: Ticket[] = [];

    for (const draft of drafts) {
      validateDraft(draft);
      const id = ticketId(conversationId, draft.startedAt);
      const existing = await this.tickets.findById(id);

      tickets.push({
        ...draft,
        id,
        client: conversation.client, // comes from the conversation, never from Claude
        createdAt: existing?.createdAt ?? timestamp,
        updatedAt: timestamp,
      });
    }

    await this.tickets.saveMany(tickets);
    return tickets;
  }

  listTickets(filter: TicketFilter = {}): Promise<Ticket[]> {
    return this.tickets.list(filter);
  }

  async updateTicketStatus(id: string, status: Status, resolution?: string): Promise<Ticket> {
    const ticket = await this.tickets.findById(id);
    if (!ticket) throw new TicketNotFoundError(id);

    validateStatusTransition(ticket.status, status);

    const timestamp = this.now();
    const updated: Ticket = {
      ...ticket,
      status,
      resolution: resolution ?? ticket.resolution,
      endedAt: status === 'completed' ? (ticket.endedAt ?? timestamp) : ticket.endedAt,
      updatedAt: timestamp,
    };

    await this.tickets.save(updated);
    return updated;
  }
}
function ticketId(conversationId: string, startedAt: string): string {
  return createHash('sha256').update(`${conversationId}|${startedAt}`).digest('hex').slice(0, 12);
}

function validateDraft(draft: TicketDraft): void {
  if (draft.endedAt && draft.endedAt < draft.startedAt) {
    throw new BusinessTicketError(
      `Ticket ends (${draft.endedAt}) before it starts (${draft.startedAt}).`,
    );
  }
  if (draft.status === 'completed' && !draft.endedAt) {
    throw new BusinessTicketError('A completed ticket needs endedAt.');
  }
  if (draft.status !== 'completed' && draft.endedAt) {
    throw new BusinessTicketError('Only completed tickets can have endedAt.');
  }
}
