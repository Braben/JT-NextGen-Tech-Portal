import { createContext, useContext, useState } from 'react';

const ChatbotContext = createContext(null);

export function ChatbotProvider({ children }) {
  const [assignmentContext, setAssignmentContext] = useState(null);

  return (
    <ChatbotContext.Provider value={{ assignmentContext, setAssignmentContext }}>
      {children}
    </ChatbotContext.Provider>
  );
}

export const useChatbot = () => useContext(ChatbotContext);
