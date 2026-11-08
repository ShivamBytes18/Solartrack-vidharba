import { STAGES } from './stages.js';

/** Simulated WhatsApp/SMS: the message is logged and kept on the project, nothing leaves the server. */
export function mockSend({ lead, stageIndex, baseUrl }) {
  const message = `Hi ${lead.name.split(' ')[0]}, your solar project is now at "${STAGES[stageIndex]}". Track it: ${baseUrl}/s/${lead.token}`;
  const entry = { channel: 'WhatsApp (simulated)', to: `+91 ${lead.phone}`, message, at: new Date() };
  console.log(`[notify] ${entry.to}: ${message}`);
  return entry;
}
