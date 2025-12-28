export type ReadyStateMachine = ReturnType<typeof createReadyStateMachine>;

export function createReadyStateMachine() {
  type Status = 'idle' | 'loading' | 'ready' | 'error';
  type State = {
    status: Status;
    watchers: Set<(status: Status) => void>;
  };

  const state: State = {
    status: 'idle',
    watchers: new Set(),
  };

  const setStatus = (newStatus: Status) => {
    state.status = newStatus;
    state.watchers.forEach((watcher) => watcher(state.status));
  };

  const watchReady = (callback: (status: Status) => void) => {
    state.watchers.add(callback);
    return () => {
      state.watchers.delete(callback);
    };
  };

  const whenReady = async () => {
    while (state.status !== 'ready' && state.status !== 'error') {
      await new Promise((resolve) => {
        const unsubscribe = watchReady(() => {
          unsubscribe();
          resolve(null);
        });
      });
    }

    if (state.status === 'error') {
      throw new Error('Ready state machine failed to initialize');
    }
  };

  return {
    setStatus,
    watchReady,
    whenReady,
  };
}
