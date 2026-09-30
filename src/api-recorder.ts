// API recorder: a small local HTTP proxy that the kiosk app sends its API calls through during tests.
// It forwards every call unchanged and writes one line per kiosk API call to a JSONL file, so tests can
// read booking IDs from the real API answers and the report can show what the kiosk sent and received.
import fs from 'node:fs';
import http from 'node:http';
import net from 'node:net';
import { hidePrivate } from './config';

/** One recorded kiosk API call, as stored in the JSONL file. */
export interface RecordedCall {
  // When the call started (ms since 1970).
  time: number;
  method: string;
  // Path after the API base, e.g. "content/trans/reserveseats" (the server address is never stored).
  path: string;
  status: number;
  durationMs: number;
  requestBody: unknown;
  responseBody: unknown;
}

// Fields that are replaced by "***" before anything is written (the report is public).
// "terminal" hides the kiosk PC's name and terminal ID.
const SECRET_FIELD = /pass|otp|pin|cvv|card.?n|secret|token|key|^terminal|mobile|phone/i;
// Largest answer stored per call.
const MAX_BODY_CHARS = 20_000;

function mask(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(mask);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, SECRET_FIELD.test(k) ? '***' : mask(v)]));
  }
  // The club card number, mobile and email can also appear inside other fields (e.g. kiosk log messages).
  if (typeof value === 'string') return hidePrivate(value);
  return value;
}

function parse(buffer: Buffer): unknown {
  const text = buffer.toString('utf8');
  if (!text) return null;
  try {
    return mask(JSON.parse(text));
  } catch {
    return text.length > MAX_BODY_CHARS ? text.slice(0, MAX_BODY_CHARS) + ' …(truncated)' : text;
  }
}

/**
 * Starts the recorder on 127.0.0.1:<port>. Calls whose path contains `apiPathPrefix` (e.g. "/api/")
 * are recorded; anything else (for example poster images) is only passed through.
 */
export async function startApiRecorder(options: { port: number; file: string; apiPathPrefix?: string }) {
  const prefix = options.apiPathPrefix ?? '/api/';
  fs.writeFileSync(options.file, '');
  const outageFile = outageSwitch(options.file);
  fs.rmSync(outageFile, { force: true });

  const server = http.createServer((req, res) => {
    // A proxy request carries the full address, e.g. "http://10.1.2.3/api/content/cinemas".
    let target: URL;
    try {
      target = new URL(req.url ?? '');
    } catch {
      res.writeHead(400).end('Not a proxy request');
      return;
    }
    const started = Date.now();
    const requestChunks: Buffer[] = [];
    req.on('data', (chunk) => requestChunks.push(chunk));
    req.on('end', () => {
      // Simulated outage (KUI-23): answer API calls with 503 without contacting the server.
      const at = target.pathname.indexOf(prefix);
      if (at >= 0 && fs.existsSync(outageFile)) {
        res.writeHead(503, { 'Content-Type': 'text/plain' }).end('Service Unavailable (simulated by the test)');
        const call: RecordedCall = {
          time: started, method: req.method ?? 'GET', path: target.pathname.slice(at + prefix.length) + target.search,
          status: 503, durationMs: 0, requestBody: parse(Buffer.concat(requestChunks)), responseBody: 'simulated outage',
        };
        fs.appendFileSync(options.file, JSON.stringify(call) + '\n');
        return;
      }
      const upstream = http.request(target, { method: req.method, headers: req.headers }, (answer) => {
        const responseChunks: Buffer[] = [];
        res.writeHead(answer.statusCode ?? 502, answer.headers);
        answer.on('data', (chunk) => {
          responseChunks.push(chunk);
          res.write(chunk);
        });
        answer.on('end', () => {
          res.end();
          const at = target.pathname.indexOf(prefix);
          if (at < 0) return;
          const call: RecordedCall = {
            time: started,
            method: req.method ?? 'GET',
            path: target.pathname.slice(at + prefix.length) + target.search,
            status: answer.statusCode ?? 0,
            durationMs: Date.now() - started,
            requestBody: parse(Buffer.concat(requestChunks)),
            responseBody: parse(Buffer.concat(responseChunks)),
          };
          fs.appendFileSync(options.file, JSON.stringify(call) + '\n');
        });
      });
      upstream.on('error', (error) => {
        if (!res.headersSent) res.writeHead(502);
        res.end(`Recorder could not reach the API: ${error.message}`);
      });
      upstream.end(Buffer.concat(requestChunks));
    });
  });

  // HTTPS (e.g. poster images) is tunnelled through untouched and not recorded.
  server.on('connect', (req, clientSocket, head) => {
    const [host, port] = (req.url ?? '').split(':');
    const serverSocket = net.connect(Number(port) || 443, host, () => {
      clientSocket.write('HTTP/1.1 200 Connection Established\r\n\r\n');
      serverSocket.write(head);
      serverSocket.pipe(clientSocket);
      clientSocket.pipe(serverSocket);
    });
    serverSocket.on('error', () => clientSocket.destroy());
    clientSocket.on('error', () => serverSocket.destroy());
  });

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(options.port, '127.0.0.1', () => resolve());
  });
  return { url: `http://127.0.0.1:${options.port}`, close: () => new Promise<void>((r) => server.close(() => r())) };
}

/** The switch file for the simulated API outage: while it exists, API calls get HTTP 503. */
export function outageSwitch(callsFile: string) {
  return callsFile.replace(/\.jsonl$/, '') + '.outage';
}

/** Reads the recorded calls made at or after `since` (ms since 1970). */
export function readRecordedCalls(file: string, since = 0): RecordedCall[] {
  if (!fs.existsSync(file)) return [];
  return fs.readFileSync(file, 'utf8').split('\n').filter(Boolean)
    .map((line) => JSON.parse(line) as RecordedCall)
    .filter((call) => call.time >= since);
}
