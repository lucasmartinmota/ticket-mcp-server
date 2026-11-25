import { resolve } from 'node:path';
import { serveStdio } from '@modelcontextprotocol/server/stdio';
import { InMemoryTicketRepository } from '../adapters/memory/in-memory-ticket-repository.js';
import { ExportFolderSource } from '../adapters/whatsapp/export-folder-source.js';
import { TicketService } from '../application/ticket-service.js';
import { createServer } from '../mcp/server.js';

const conversationsDir = process.env.CONVERSATIONS_DIR;

if (!conversationsDir) {
  console.error('Set CONVERSATIONS_DIR to the folder with the exported .txt files.');
  process.exit(1);
}

const service = new TicketService(
  new ExportFolderSource(resolve(conversationsDir)),
  new InMemoryTicketRepository(),
);

serveStdio(() => createServer(service));
