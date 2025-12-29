function createMessageModelIdAccountant() {
  const modelUsage = new Map<
    string, // sessionID
    Record<
      string, // messageID
      {
        modelID: string;
        providerID: string;
      }
    >
  >();

  const track = (info: {
    sessionID: string;
    messageID: string;
    modelID: string;
    providerID: string;
  }) => {
    if (!modelUsage.has(info.sessionID)) {
      modelUsage.set(info.sessionID, {});
    }
    const sessionMap = modelUsage.get(info.sessionID)!;
    sessionMap[info.messageID] = {
      modelID: info.modelID,
      providerID: info.providerID,
    };
  };

  const untrackMessage = (args: { messageID: string; sessionID: string }) => {
    const sessionMap = modelUsage.get(args.sessionID);
    if (sessionMap && sessionMap[args.messageID]) {
      delete sessionMap[args.messageID];
      if (Object.keys(sessionMap).length === 0) {
        modelUsage.delete(args.sessionID);
      }
    }
  };

  const untrackSession = (sessionID: string) => {
    modelUsage.delete(sessionID);
  };

  const getModelInfo = (args: { messageID: string; sessionID: string }) => {
    const sessionMap = modelUsage.get(args.sessionID);
    return sessionMap ? sessionMap[args.messageID] : undefined;
  };

  const reset = () => {
    modelUsage.clear();
  };

  return {
    reset,
    track,
    untrackMessage,
    untrackSession,
    getModelInfo,
  };
}

export { createMessageModelIdAccountant };
