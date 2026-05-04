'use client';

import { useRef, useEffect } from 'react';
import { ChatHeader } from './ChatHeader';
import { MessageBubble } from './MessageBubble';
import { MessageInput } from './MessageInput';

interface UIMessage {
  id: string;
  text: string;
  isMe: boolean;
  timestamp: string;
  isError?: boolean;
}

interface Props {
  displayName: string;
  username: string;
  messages: UIMessage[];
  inputText: string;
  setInputText: (v: string) => void;
  onSend: () => void;
  isLoading: boolean;
  disabled?: boolean;
}

export function ChatWindow({ displayName, username, messages, inputText, setInputText, onSend, isLoading, disabled }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="flex-1 flex flex-col h-full bg-[#efeae2]">
      <ChatHeader displayName={displayName} username={username} />
      <div className="flex-1 overflow-y-auto p-4">
        
        {isLoading ? (
          <div className="flex items-center justify-center h-full text-gray-500 text-sm">Loading messages...</div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-500 text-sm">No messages yet</div>
        ) : (
          messages.map((msg) => (
            <MessageBubble key={msg.id} text={msg.text} isMe={msg.isMe} timestamp={msg.timestamp} isError={msg.isError} />
          ))
        )}
        <div ref={bottomRef} />
      </div>
      <MessageInput value={inputText} onChange={setInputText} onSend={onSend} isLoading={isLoading} disabled={disabled} />
    </div>
  );
}