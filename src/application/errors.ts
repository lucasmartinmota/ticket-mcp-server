export class ConversationNotFoundError extends Error {
  constructor(id: string) {
    super(`Conversation "${id}" not found. Call list_conversations to see the available ids.`);
  }
}

export class TicketNotFoundError extends Error {
  constructor(id: string) {
    super(`Ticket "${id}" not found.`);
  }
}
