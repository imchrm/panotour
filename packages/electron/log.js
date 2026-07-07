'use strict';

const fs = require('fs');
const path = require('path');

let stream = null;
let filePath = null;

function init(dir) {
  fs.mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  filePath = path.join(dir, `editor-${stamp}.log`);
  stream = fs.createWriteStream(filePath, { flags: 'a' });
  return filePath;
}

function write(level, source, message) {
  const line = `${new Date().toISOString()} [${level}] [${source}] ${message}`;
  if (stream) stream.write(line + '\n');
  console.log(line);
}

const info  = (source, message) => write('INFO', source, message);
const warn  = (source, message) => write('WARN', source, message);
const error = (source, message) => write('ERROR', source, message);

function summarize(args) {
  try {
    const parts = args.map((a) => {
      if (a === undefined) return 'undefined';
      if (a && (a.type === 'Buffer' || ArrayBuffer.isView(a))) return `<${a.length ?? a.byteLength} bytes>`;
      const s = JSON.stringify(a);
      return s && s.length > 300 ? s.slice(0, 300) + '…' : s;
    });
    return parts.join(', ');
  } catch {
    return '<unserializable>';
  }
}

function startMetrics(app, intervalMs = 10000) {
  const timer = setInterval(() => {
    try {
      const line = app
        .getAppMetrics()
        .map((p) => {
          const mem = Math.round((p.memory?.workingSetSize ?? 0) / 1024);
          const cpu = (p.cpu?.percentCPUUsage ?? 0).toFixed(1);
          return `${p.type}#${p.pid} cpu=${cpu}% mem=${mem}MB`;
        })
        .join(' | ');
      info('metrics', line);
    } catch (err) {
      warn('metrics', err.message);
    }
  }, intervalMs);
  timer.unref();
}

module.exports = { init, info, warn, error, summarize, startMetrics };
