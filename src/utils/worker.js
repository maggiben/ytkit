const path = require('path');
const { workerData } = require('worker_threads');

require('ts-node').register();
if (process.env.NODE_ENV === 'test') {
  require(process.env.NODE_WORKER);
} else {
  require(path.resolve(__dirname, workerData.path));
}
