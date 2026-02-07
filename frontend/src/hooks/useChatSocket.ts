import { useCallback, useEffect, useRef, useState } from 'react';
import { getChatAuthToken } from '@/lib/api';
import type { ChatMessage } from '@/lib/api';

const WS_ORIGIN =
  (import.meta.env.VITE_API_ORIGIN ?? (import.meta.env.DEV ? 'http://localhost:8090' : window.location.origin)).replace(
    /^http/,
    'ws'
  );

type WireMessage =
  | { type: 'pong' }
  | { type: 'new_message'; data: ChatMessage }
  | { type: 'typing'; conversation_id: string; is_typing: boolean; sender_type?: string; sender_id?: string }
  | { type: 'error'; data?: { message?: string } };

export function useChatSocket(options: {
  onMessage?: (msg: ChatMessage) => void;
  onTyping?: (conversationId: string, isTyping: boolean) => void;
}) {
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const onMessageRef = useRef(options.onMessage);
  const onTypingRef = useRef(options.onTyping);
  onMessageRef.current = options.onMessage;
  onTypingRef.current = options.onTyping;

  const connect = useCallback(() => {
    const token = getChatAuthToken();
    if (!token) return;
    const url = `${WS_ORIGIN}/api/v1/chat/ws?token=${encodeURIComponent(token)}`;
    const ws = new WebSocket(url);
    wsRef.current = ws;
    ws.onopen = () => setConnected(true);
    ws.onclose = () => {
      setConnected(false);
      wsRef.current = null;
      reconnectTimeoutRef.current = setTimeout(connect, 3000);
    };
    ws.onerror = () => {};
    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data) as WireMessage;
        if (msg.type === 'new_message' && msg.data) {
          onMessageRef.current?.(msg.data);
        } else if (msg.type === 'typing') {
          onTypingRef.current?.(msg.conversation_id, msg.is_typing);
        }
      } catch {
        // ignore
      }
    };
  }, []);

  useEffect(() => {
    connect();
    return () => {
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      wsRef.current?.close();
      wsRef.current = null;
      setConnected(false);
    };
  }, [connect]);

  const send = useCallback((payload: object) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(payload));
    }
  }, []);

  const sendMessage = useCallback(
    (conversationId: string, body: string, attachment?: { url: string; name: string; type?: string }) => {
      send({
        type: 'send_message',
        data: {
          conversation_id: conversationId,
          body,
          attachment_url: attachment?.url ?? '',
          attachment_name: attachment?.name ?? '',
          attachment_type: attachment?.type ?? '',
        },
      });
    },
    [send]
  );

  const sendTyping = useCallback(
    (conversationId: string, isTyping: boolean) => {
      send({ type: 'typing', data: { conversation_id: conversationId, is_typing: isTyping } });
    },
    [send]
  );

  const sendPing = useCallback(() => {
    send({ type: 'ping' });
  }, [send]);

  return { connected, sendMessage, sendTyping, sendPing };
}
