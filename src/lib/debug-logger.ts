import fs from 'fs';
import os from 'os';
import path from 'path';

export function logToFile(message: string, data?: any) {
  const timestamp = new Date().toISOString();
  let logMessage = `[${timestamp}] ${message}`;
  if (data) {
    logMessage += `\nData: ${JSON.stringify(data, null, 2)}`;
  }
  logMessage += '\n' + '='.repeat(50) + '\n';
  
  try {
    const logPath = path.join(os.tmpdir(), 'odoo_webhook_debug.log'); 
    fs.appendFileSync(logPath, logMessage);
    console.log(`[DEBUG LOG] ${message} (written to ${logPath})`);
  } catch (err) {
    console.error('Failed to write to log file:', err);
  }
}
