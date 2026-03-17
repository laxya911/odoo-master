import { NextRequest, NextResponse } from 'next/server';
import { logToFile } from '@/lib/debug-logger';
import os from 'os';
import path from 'path';
import fs from 'fs';

export async function GET(req: NextRequest) {
  const logPath = path.join(os.tmpdir(), 'odoo_webhook_debug.log');
  logToFile('Diagnostic GET request received');
  
  let content = 'No log file found.';
  if (fs.existsSync(logPath)) {
    content = fs.readFileSync(logPath, 'utf8');
  }

  return NextResponse.json({
    status: 'ok',
    logPath,
    logContent: content,
    time: new Date().toISOString()
  });
}
