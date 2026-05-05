'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/app/lib/auth';
import { api } from '@/app/lib/api';
import { getKeys } from '@/app/lib/db';
import { importPublicKey, encryptMessage, decryptMessage } from '@/app/lib/crypto';
import { MessageSocket } from '@/app/lib/websocket';
import type { ConversationSummary, MessageResponse, EncryptedPayload, UserPublicInfo } from '@/app/types';
import { Sidebar } from '@/app/components/Sidebar';
import { ChatWindow } from '@/app/components/ChatWindow';
import { User } from 'lucide-react';

interface UIMessage {
  id: string;
  text: string;
  isMe: boolean;
  timestamp: string;
  isError?: boolean;
}

export default function ChatPage() {
  const { user, isLoading: authLoading, logout } = useAuth();
  const router = useRouter();

  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [messages, setMessages] = useState<UIMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoadingConversations, setIsLoadingConversations] = useState(true);
  const [conversationsError, setConversationsError] = useState<string | null>(null);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [sendLoading, setSendLoading] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [wsConnected, setWsConnected] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserPublicInfo[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const socketRef = useRef<MessageSocket | null>(null);
  const seenIds = useRef<Set<string>>(new Set());
//   const selectedUser = conversations.find((c) => c.user_id === selectedUserId);
const selectedUser = conversations.find((c) => c.user_id === selectedUserId) || 
  searchResults.find((u) => u.id === selectedUserId);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [authLoading, user, router]);

  const loadConversations = useCallback(async () => {
    setIsLoadingConversations(true);
    setConversationsError(null);
    try {
      const data = await api.getConversations();
      setConversations(data);
    } catch (e: any) {
      setConversationsError(e.message || 'Failed to load conversations');
    } finally {
      setIsLoadingConversations(false);
    }
  }, []);

  useEffect(() => {
    if (user) loadConversations();
  }, [user, loadConversations]);

  const handleSearch = async () => {
    if (!searchQuery.trim() || !user) return;
    setIsSearching(true);
    try {
      const results = await api.searchUsers(searchQuery.trim());
      setSearchResults(results.filter((u) => u.id !== user.id));
    } catch (e: any) {
      setConversationsError(e.message);
    } finally {
      setIsSearching(false);
    }
  };

  const handleIncomingMessage = useCallback(async (msg: MessageResponse) => {
    if (seenIds.current.has(msg.id)) return;
    seenIds.current.add(msg.id);

    const isForCurrentChat = msg.from_user_id === selectedUserId || msg.to_user_id === selectedUserId;

    if (!isForCurrentChat) {
      loadConversations();
      return;
    }

    try {
      const keys = await getKeys();
      if (!keys) throw new Error('Keys not found');

      const privateKey = await window.crypto.subtle.importKey(
        'jwk',
        keys.privateKeyJwk,
        { name: 'RSA-OAEP', hash: 'SHA-256' },
        false,
        ['decrypt', 'unwrapKey']
      );

      const isSentByMe = msg.from_user_id === user?.id;
      const plaintext = await decryptMessage(msg.payload, privateKey, isSentByMe);

      setMessages((prev) => [
        ...prev,
        {
          id: msg.id,
          text: plaintext,
          isMe: isSentByMe,
          timestamp: msg.created_at,
        },
      ]);
    } catch (e) {
      setMessages((prev) => [
        ...prev,
        {
          id: msg.id,
          text: 'Unable to decrypt message',
          isMe: msg.from_user_id === user?.id,
          timestamp: msg.created_at,
          isError: true,
        },
      ]);
    }
  }, [selectedUserId, user?.id, loadConversations]);

  const handleIncomingMessageRef = useRef(handleIncomingMessage);
  handleIncomingMessageRef.current = handleIncomingMessage;

  useEffect(() => {
    if (!user) return;
    const token = sessionStorage.getItem('access_token');
    if (!token) return;

    const socket = new MessageSocket(
      token,
      (msg) => handleIncomingMessageRef.current(msg),
      () => setWsConnected(true),
      () => setWsConnected(false)
    );

    socket.connect();
    socketRef.current = socket;

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [user]);

  useEffect(() => {
    if (!selectedUserId || !user) return;

    const targetId = selectedUserId;
    let cancelled = false;
    setIsLoadingMessages(true);
    setMessages([]);
    seenIds.current.clear();
    setChatError(null);

    async function load() {
      try {
        const keys = await getKeys();
        if (!keys) throw new Error('Keys not found. Please log in again.');

        const privateKey = await window.crypto.subtle.importKey(
          'jwk',
          keys.privateKeyJwk,
          { name: 'RSA-OAEP', hash: 'SHA-256' },
          false,
          ['decrypt', 'unwrapKey']
        );

        const history = await api.getMessages(targetId);
        const uiMessages: UIMessage[] = [];

        for (const msg of history.reverse()) {
          if (seenIds.current.has(msg.id)) continue;
          seenIds.current.add(msg.id);

          try {
            const isSentByMe = msg.from_user_id === user?.id;
            const plaintext = await decryptMessage(msg.payload, privateKey, isSentByMe);
            uiMessages.push({
              id: msg.id,
              text: plaintext,
              isMe: isSentByMe,
              timestamp: msg.created_at,
            });
          } catch {
            uiMessages.push({
              id: msg.id,
              text: 'Unable to decrypt message',
              isMe: msg.from_user_id === user?.id,
              timestamp: msg.created_at,
              isError: true,
            });
          }
        }

        if (!cancelled) setMessages(uiMessages);
      } catch (e: any) {
        if (!cancelled) setChatError(e.message);
      } finally {
        if (!cancelled) setIsLoadingMessages(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [selectedUserId, user]);

  useEffect(() => {
    if (!selectedUserId || wsConnected) return;

    const interval = setInterval(async () => {
      try {
        const history = await api.getMessages(selectedUserId);
        for (const msg of [...history].reverse()) {
          if (!seenIds.current.has(msg.id)) {
            await handleIncomingMessage(msg);
          }
        }
      } catch (e) {
        console.error('Poll error', e);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [selectedUserId, wsConnected, handleIncomingMessage]);

  
  const handleSend = async () => {
    if (!inputText.trim() || !selectedUserId || !user) return;

    setSendLoading(true);
    setChatError(null);

    try {
      const keys = await getKeys();
      if (!keys) throw new Error('Keys not found');

      const privateKey = await window.crypto.subtle.importKey(
        'jwk',
        keys.privateKeyJwk,
        { name: 'RSA-OAEP', hash: 'SHA-256' },
        false,
        ['decrypt', 'unwrapKey']
      );

      const myPublicKey = await window.crypto.subtle.importKey(
        'jwk',
        keys.publicKeyJwk,
        { name: 'RSA-OAEP', hash: 'SHA-256' },
        false,
        ['wrapKey']
      );

      const recipientPubKeyRes = await api.getPublicKey(selectedUserId);
      const recipientPublicKey = await importPublicKey(recipientPubKeyRes.public_key);

      const payload = await encryptMessage(inputText.trim(), recipientPublicKey, myPublicKey);

      const sentViaWs = socketRef.current?.send(selectedUserId, payload);
      let responseMsg: MessageResponse | null = null;

      if (!sentViaWs) {
        responseMsg = await api.sendMessage(selectedUserId, payload);
      }

      const msgToAdd: MessageResponse = responseMsg || {
        id: `temp-${Date.now()}`,
        from_user_id: user.id,
        to_user_id: selectedUserId,
        payload,
        delivered: false,
        created_at: new Date().toISOString(),
      };

      if (!seenIds.current.has(msgToAdd.id)) {
        seenIds.current.add(msgToAdd.id);
        setMessages((prev) => [
          ...prev,
          {
            id: msgToAdd.id,
            text: inputText.trim(),
            isMe: true,
            timestamp: msgToAdd.created_at,
          },
        ]);
      }

      setInputText('');
      loadConversations();
    } catch (e: any) {
      setChatError(e.message);
    } finally {
      setSendLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="h-screen flex items-center justify-center text-gray-500">
        Loading...
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="h-screen flex overflow-hidden bg-white">
      <div className={`${selectedUserId ? 'hidden' : 'flex'} md:flex w-full md:w-80 flex-col`}>
        <Sidebar
          conversations={conversations}
          selectedUserId={selectedUserId}
          onSelectUser={setSelectedUserId}
          isLoading={isLoadingConversations}
          error={conversationsError}
          onRetry={loadConversations}
          onLogout={logout}
          currentUserName={user.display_name || user.username}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          onSearch={handleSearch}
          searchResults={searchResults}
          isSearching={isSearching}
        />
      </div>
      <div className={`${selectedUserId ? 'flex' : 'hidden'} md:flex flex-1 flex-col relative`}>
        {!wsConnected && (
          <div className="bg-yellow-50 text-yellow-700 text-xs px-4 py-1 text-center border-b border-yellow-100">
            Offline mode — messages will sync when connected
          </div>
        )}
        {chatError && (
          <div className="bg-red-50 text-red-600 text-sm px-4 py-2 text-center border-b border-red-100">
            {chatError}
          </div>
        )}
        
        {selectedUser ? (
          <ChatWindow
            displayName={selectedUser.display_name}
            username={selectedUser.username}
            messages={messages}
            inputText={inputText}
            setInputText={setInputText}
            onSend={handleSend}
            isLoading={isLoadingMessages || sendLoading}
          />
        ) : selectedUserId ? (
          <div className="flex-1 flex items-center justify-center bg-[#efeae2]">
            <p className="text-gray-500 text-sm">Loading user info...</p>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center bg-[#efeae2]">
            <p className="text-gray-500 text-sm">Select a conversation to start chatting</p>
          </div>
        )}


        {selectedUserId && (
          <button
            onClick={() => setSelectedUserId(null)}
            className="md:hidden absolute top-4 left-4 bg-white p-2 rounded-full shadow text-sm z-10"
          >
            ← Back
          </button>
        )}
      </div>
    </div>
  );
}