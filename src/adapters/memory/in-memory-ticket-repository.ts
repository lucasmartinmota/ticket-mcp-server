import type { Ticket } from '../../domain/ticket.js';
import type { TicketFilter, TicketRepository } from '../../ports/ticket-repository.js';

export class InMemoryTicketRepository implements TicketRepository {
  private readonly tickets = new Map<string, Ticket>();

  async save(ticket: Ticket): Promise<void> {
    this.tickets.set(ticket.id, structuredClone(ticket));
  }

  async saveMany(tickets: Ticket[]): Promise<void> {
    for (const ticket of tickets) await this.save(ticket);
  }

  async findById(id: string): Promise<Ticket | null> {
    const ticket = this.tickets.get(id);
    return ticket ? structuredClone(ticket) : null;
  }

  async list(filter: TicketFilter = {}): Promise<Ticket[]> {
    const day = (t: Ticket) => t.startedAt.slice(0, 10);

    return [...this.tickets.values()]
      .filter((t) => !filter.from || day(t) >= filter.from)
      .filter((t) => !filter.to || day(t) <= filter.to)
      .filter((t) => !filter.status || t.status === filter.status)
      .filter((t) => !filter.clientPhone || t.client.phone === filter.clientPhone)
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
      .map((t) => structuredClone(t));
  }
}
