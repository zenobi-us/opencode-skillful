/**
 * ReadyStateMachine - Async Initialization State Coordinator
 *
 * WHY: Tools need to wait for the skill registry to finish async discovery and
 * parsing before they can execute. This state machine coordinates that initialization
 * without requiring callers to manage Promise chains manually.
 *
 * DESIGN: Implements a simple state machine with watchers pattern for notification.
 * State transitions: idle → loading → (ready|error)
 *
 * CONTRACT:
 * - setStatus(): update internal state and notify all watchers
 * - watchReady(callback): subscribe to state changes, returns unsubscribe function
 * - whenReady(): blocking async method that resolves when state is ready, rejects if error
 *
 * WHY NOT A SIMPLE PROMISE:
 * - Promise resolves once, but multiple tools may call whenReady() at different times
 * - This pattern allows multiple concurrent waiters without race conditions
 * - Supports reversible state (could transition back to loading if needed)
 *
 * EXAMPLE:
 *   const ready = createReadyStateMachine();
 *   ready.setStatus('loading');
 *   // ... do async work ...
 *   ready.setStatus('ready');
 *
 *   // Tool execution:
 *   await ready.whenReady(); // blocks until ready
 *   // ... now safe to execute ...
 */
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
