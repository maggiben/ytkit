const path = require('path');
const { workerData } = require('worker_threads');

require('ts-node').register();
/* istanbul ignore next */
if (process.env.NODE_ENV === 'test' && process.env.NODE_WORKER) {
  require(process.env.NODE_WORKER);
}
/* istanbul ignore next */
require(path.resolve(__dirname, workerData.path));
