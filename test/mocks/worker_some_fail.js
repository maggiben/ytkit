const { parentPort, isMainThread } = require('worker_threads');

if (!isMainThread) {
  const shouldError = Math.floor(Math.random() * 2);
  shouldError && parentPort?.postMessage('error', new Error('Worker error'));
  process.exit(shouldError);
}
