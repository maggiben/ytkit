export default async function scheduler<T, K>(
  maxconnections: number,
  items: K[],
  functor: (item: K) => Promise<T>
): Promise<Array<T | undefined>> {
  const workers: Array<T | undefined> = [];
  for await (const result of runTasks<T>(maxconnections, tasks(items, functor))) {
    workers.push(result);
  }
  return workers;
}

function tasks<T, K>(items: K[], functor: (item: K) => Promise<T>): IterableIterator<() => Promise<T>> {
  return items
    .reduce((previousValue, currentValue) => {
      return [
        ...previousValue,
        async (): Promise<T> => {
          try {
            return await functor(currentValue);
          } catch (error) {
            return Promise.reject(error);
          }
        },
      ];
    }, [] as Array<() => Promise<T>>)
    .values() as IterableIterator<() => Promise<T>>;
}

async function* runTasks<T>(
  maxConcurrency: number,
  iterator: IterableIterator<() => Promise<T>>
): AsyncGenerator<T | undefined, void, unknown> {
  // Each worker is an async generator that polls for tasks
  // from the shared iterator.
  // Sharing the iterator ensures that each worker gets unique tasks.
  const workers = new Array(maxConcurrency) as Array<AsyncIterator<T>>;
  for (let i = 0; i < maxConcurrency; i++) {
    workers[i] = (async function* (): AsyncIterator<T, void, unknown> {
      for (const task of iterator) {
        yield await task();
      }
    })();
  }
  yield* raceAsyncIterators<T>(workers);
}

async function* raceAsyncIterators<T>(
  iterators: Array<AsyncIterator<T>>
): AsyncGenerator<T | undefined, void, unknown> {
  async function queueNext(iteratorResult: { result?: IteratorResult<T>; iterator: AsyncIterator<T> }): Promise<{
    result?: IteratorResult<T>;
    iterator: AsyncIterator<T>;
  }> {
    delete iteratorResult.result; // Release previous result ASAP
    iteratorResult.result = await iteratorResult.iterator.next();
    return iteratorResult;
  }
  const iteratorResults = new Map(iterators.map((iterator) => [iterator, queueNext({ iterator })]));
  while (iteratorResults.size) {
    const winner: {
      result?: IteratorResult<T>;
      iterator: AsyncIterator<T>;
    } = await Promise.race(iteratorResults.values());
    if (winner.result && winner.result.done) {
      iteratorResults.delete(winner.iterator);
    } else {
      const value = winner.result && winner.result.value;
      iteratorResults.set(winner.iterator, queueNext(winner));
      yield value;
    }
  }
}
