'use client';

import { Lock } from 'lucide-react';

interface Props {
  displayName: string;
  username: string;
}

export function ChatHeader({ displayName, username }: Props) {
  return (
    <div className="bg-[#f0f2f5] px-4 py-3 flex items-center gap-3 border-b border-gray-300">
      <div className="w-10 h-10 rounded-full bg-gray-300 flex items-center justify-center text-gray-600 font-medium">
        {(displayName[0] || username[0] || '?').toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-gray-900 truncate">{displayName || username}</p>
        <div className="flex items-center gap-1 text-xs text-gray-500">
          <Lock size={12} />
          <span>End-to-end encrypted</span>
        </div>
      </div>
    </div>
  );
}