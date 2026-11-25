import { McpServer } from '@modelcontextprotocol/server';
import * as z from 'zod/v4';
import { ConversationNotFoundError, TicketNotFoundError } from '../application/errors.js';
import type { TicketService } from '../application/ticket-service.js';
import { BusinessTicketError, STATUS } from '../domain/ticket.js';

const DATE = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');
const DATE_TIME = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/, 'Use YYYY-MM-DDTHH:mm (copy it from the session)');

const EXPECTED_ERRORS = [BusinessTicketError, ConversationNotFoundError, TicketNotFoundError];

async function run(useCase: () => Promise<unknown>) {
  try {
    const data = await useCase();
    return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
  } catch (error) {
    if (EXPECTED_ERRORS.some((E) => error instanceof E)) {
      return {
        content: [{ type: 'text' as const, text: (error as Error).message }],
        isError: true,
      };
    }
    throw error;
  }
}

export function createServer(service: TicketService): McpServer {
  const server = new McpServer({ name: 'ticket-mcp-server', version: '0.1.0' });

  server.registerTool(
    'list_conversations',
    {
      description:
        'Lists the exported WhatsApp support conversations available to import, with the client and the date of the last message.',
      inputSchema: z.object({}),
    },
    () => run(() => service.listConversations()),
  );

  server.registerTool(
    'import_conversation',
    {
      description: [
        'Loads the messages of one conversation within a period, already split into sessions',
        '(a new session starts after a long silence). Use it before save_tickets.',
        'A session is only a hint: merge sessions that are the same problem, or split one',
        'that covers two different problems. Then call save_tickets with one ticket per support case.',
      ].join(' '),
      inputSchema: z.object({
        conversationId: z.string().describe('Id returned by list_conversations'),
        from: DATE.describe('First day, inclusive'),
        to: DATE.describe('Last day, inclusive'),
        maxGapMinutes: z
          .number()
          .int()
          .min(30)
          .max(1440)
          .optional()
          .describe('Silence that starts a new session. Default 240'),
      }),
    },
    ({ conversationId, from, to, maxGapMinutes }) =>
      run(() => service.importConversation(conversationId, from, to, maxGapMinutes)),
  );

  server.registerTool(
    'save_tickets',
    {
      description: [
        'Saves the support tickets you identified in an imported conversation.',
        'Status rules: "completed" when the client confirmed it works or the issue was clearly solved;',
        '"waiting_customer" when the last message is from the support agent asking or waiting for the client;',
        '"in_progress" when the agent was still working on it; "open" when nobody answered yet.',
        'Saving the same conversation and start time again updates the ticket instead of duplicating it.',
      ].join(' '),
      inputSchema: z.object({
        conversationId: z.string(),
        tickets: z
          .array(
            z.object({
              summary: z.string().min(5).describe('The problem, in one or two sentences'),
              resolution: z.string().optional().describe('How it was solved, if it was'),
              status: z.enum(STATUS),
              startedAt: DATE_TIME.describe('dateTime of the first message of this case'),
              endedAt: DATE_TIME.optional().describe('Only for completed tickets'),
              messageCount: z.number().int().min(1),
            }),
          )
          .min(1),
      }),
    },
    ({ conversationId, tickets }) => run(() => service.saveTickets(conversationId, tickets)),
  );

  server.registerTool(
    'list_tickets',
    {
      description:
        'Lists saved tickets, newest first. Use it to build reports: counts by status, recurring problems, open cases.',
      inputSchema: z.object({
        from: DATE.optional(),
        to: DATE.optional(),
        status: z.enum(STATUS).optional(),
        clientPhone: z.string().optional().describe('Digits only'),
      }),
    },
    (filter) => run(() => service.listTickets(filter)),
  );

  server.registerTool(
    'update_ticket_status',
    {
      description:
        'Changes the status of a saved ticket. Allowed: open → in_progress/waiting_customer/completed; in_progress ⇄ waiting_customer; both → completed. Completed tickets cannot change.',
      inputSchema: z.object({
        id: z.string(),
        status: z.enum(STATUS),
        resolution: z.string().optional().describe('Fill it when completing the ticket'),
      }),
    },
    ({ id, status, resolution }) => run(() => service.updateTicketStatus(id, status, resolution)),
  );

  return server;
}
