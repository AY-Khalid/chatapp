'use client';

interface Props {
  text: string;
  isMe: boolean;
  timestamp: string;
  isError?: boolean;
}

export function MessageBubble({ text, isMe, timestamp, isError }: Props) {
  return (
    <div className={`flex ${isMe ? 'justify-end' : 'justify-start'} mb-2`}>
      <div
        className={`max-w-[75%] px-3 py-2 rounded-lg text-sm ${
          isMe ? 'bg-[#C3E1F1] rounded-tr-none' : 'bg-white rounded-tl-none shadow-sm'
        //   isMe ? 'bg-[#d9fdd3] rounded-tr-none' : 'bg-white rounded-tl-none shadow-sm'
        }`}
      >
        {isError ? (
          <span className="text-red-500 italic text-xs">{text}</span>
        ) : (
          <p className="text-gray-800 whitespace-pre-wrap break-words">{text}</p>
        )}
        <div className="flex items-center justify-end gap-1 mt-1">
          <span className="text-[10px] text-gray-500">
            {new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      </div>
    </div>
  );
}