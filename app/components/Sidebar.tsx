'use client';

import type { ConversationSummary, UserPublicInfo } from '@/app/types';

interface Props {
  conversations: ConversationSummary[];
  selectedUserId: string | null;
  onSelectUser: (id: string) => void;
  isLoading: boolean;
  error: string | null;
  onRetry: () => void;
  onLogout: () => void;
  currentUserName?: string;
  searchQuery: string;
  setSearchQuery: (v: string) => void;
  onSearch: () => void;
  searchResults: UserPublicInfo[];
  isSearching: boolean;
}

export function Sidebar({
  conversations,
  selectedUserId,
  onSelectUser,
  isLoading,
  error,
  onRetry,
  onLogout,
  currentUserName,
  searchQuery,
  setSearchQuery,
  onSearch,
  searchResults,
  isSearching,
}: Props) {
  return (
    <div className="w-full md:w-80 bg-white border-r border-gray-300 flex flex-col h-full">
      <div className="bg-[#009AED] p-4 flex items-center justify-between">
      {/* <div className="bg-[#008069] p-4 flex items-center justify-between"> */}
        <div>
          <h1 className="text-white font-semibold text-lg">ChatApp</h1>
          {currentUserName && <p className="text-white/80 text-xs">{currentUserName}</p>}
        </div>
        <button onClick={onLogout} className="text-white text-xs hover:underline">
          Logout
        </button>
      </div>

      {/* Search */}
      <div className="p-3 border-b border-gray-200">
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Search users..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && onSearch()}
            className="flex-1 px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-[#008069]"
          />
          <button
            onClick={onSearch}
            disabled={isSearching}
            className="px-3 py-1.5 bg-[#009AED] text-white text-sm rounded-md disabled:opacity-50 hover:bg-[#0683C6] transition-colors cursor-pointer"
            // className="px-3 py-1.5 bg-[#008069] text-white text-sm rounded-md disabled:opacity-50 hover:bg-[#007a5e] transition-colors"
          >
            {isSearching ? '...' : 'Find'}
          </button>
        </div>
        {searchResults.length > 0 && (
          <div className="mt-2 max-h-40 overflow-y-auto">
            <p className="text-xs text-gray-500 mb-1">Search results</p>
            {searchResults.map((u) => (
              <button
                key={u.id}
                onClick={() => {
                  onSelectUser(u.id);
                  setSearchQuery('');
                }}
                className="w-full text-left p-2 hover:bg-gray-100 rounded text-sm flex items-center gap-2"
              >
                <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-gray-600 text-xs font-medium">
                  {(u.display_name[0] || u.username[0] || '?').toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="font-medium text-gray-900 truncate">{u.display_name}</p>
                  <p className="text-xs text-gray-500">@{u.username}</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Conversations */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="p-4 text-gray-500 text-sm">Loading conversations...</div>
        ) : error ? (
          <div className="p-4">
            <p className="text-red-500 text-sm mb-2">{error}</p>
            <button onClick={onRetry} className="text-[#008069] text-sm font-medium hover:underline">
              Retry
            </button>
          </div>
        ) : conversations.length === 0 ? (
          <div className="p-4 text-gray-500 text-sm">No conversations yet. Search for a user above to start chatting.</div>
        ) : (
          conversations.map((c) => (
            <button
              key={c.user_id}
              onClick={() => onSelectUser(c.user_id)}
              className={`w-full text-left p-3 flex items-center gap-3 hover:bg-gray-100 transition-colors ${
                selectedUserId === c.user_id ? 'bg-gray-100' : ''
              }`}
            >
              <div className="w-12 h-12 rounded-full bg-gray-300 flex items-center justify-center text-gray-600 font-medium">
                {(c.display_name[0] || c.username[0] || '?').toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900 truncate">{c.display_name || c.username}</p>
                <p className="text-sm text-gray-500 truncate">
                  {c.last_message_at ? new Date(c.last_message_at).toLocaleString() : 'No messages yet'}
                </p>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}