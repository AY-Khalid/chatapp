'use client';

import { Send } from 'lucide-react';

interface Props {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  isLoading: boolean;
  disabled?: boolean;
}

export function MessageInput({ value, onChange, onSend, isLoading, disabled }: Props) {
  return (
    <div className="bg-[#f0f2f5] p-3 flex items-center gap-2">
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && onSend()}
        placeholder="Type a message"
        disabled={disabled}
        className="flex-1 bg-white rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-1 focus:ring-[#008069] disabled:opacity-50"
      />
      <button
        onClick={onSend}
        disabled={isLoading || !value.trim() || disabled}
        className="w-10 h-10 bg-[#009AED] rounded-full flex items-center justify-center text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#007a5e] transition-colors"
        // className="w-10 h-10 bg-[#008069] rounded-full flex items-center justify-center text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#007a5e] transition-colors"
      >
        <Send size={18} />
      </button>
    </div>
  );
}