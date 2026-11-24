import type { Status, Ticket } from '../domain/ticket.js';

export interface TicketFilter {
  from?: string;
  to?: string;
  status?: Status;
  clientPhone?: string;
}

export interface TicketRepository {
  save(ticket: Ticket): Promise<void>;

  saveMany(tickets: Ticket[]): Promise<void>;

  findById(id: string): Promise<Ticket | null>;

  list(filter?: TicketFilter): Promise<Ticket[]>;
}
