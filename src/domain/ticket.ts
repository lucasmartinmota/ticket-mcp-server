export const STATUS = ['open', 'waiting_customer', 'in_progress', 'completed'] as const;
export type Status = (typeof STATUS)[number];

export interface Client {
  name: string;
  phone?: string;
}

export interface Ticket {
  id: string;
  client: Client;
  summary: string;
  resolution?: string;
  status: Status;
  startedAt: string;
  endedAt?: string;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
}

export class BusinessTicketError extends Error {}

const TRANSITIONS: Record<Status, Status[]> = {
  open: ['in_progress', 'waiting_customer', 'completed'],
  waiting_customer: ['in_progress', 'completed'],
  in_progress: ['waiting_customer', 'completed'],
  completed: [],
};

export function validateStatusTransition(currentStatus: Status, newStatus: Status): void {
  if (!TRANSITIONS[currentStatus].includes(newStatus)) {
    throw new BusinessTicketError(
      `Invalid status transition from ${currentStatus} to ${newStatus}`,
    );
  }
}
