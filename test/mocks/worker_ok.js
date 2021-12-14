const { isMainThread } = require('worker_threads');

if (!isMainThread) {
  return process.exit(0);
}
