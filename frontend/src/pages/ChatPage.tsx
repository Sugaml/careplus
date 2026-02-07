import { useCallback, useEffect, useRef, useState } from 'react';
import {
  chatApi,
  getChatToken,
  referralApi,
  resolveImageUrl,
  type ChatMessage,
  type Conversation,
  type Customer,
} from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { useChatSocket } from '@/hooks/useChatSocket';
import { useLanguage } from '@/contexts/LanguageContext';
import Loader from '@/components/Loader';
import { MessageCircle, RefreshCw, Send, Paperclip, UserPlus, Phone, Pencil, Trash2, MoreVertical } from 'lucide-react';

export default function ChatPage() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [total, setTotal] = useState(0);
  const [selected, setSelected] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [messagesTotal, setMessagesTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const [attachFile, setAttachFile] = useState<{ url: string; name: string; type?: string } | null>(null);
  const [sending, setSending] = useState(false);
  const [startChatOpen, setStartChatOpen] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customersLoading, setCustomersLoading] = useState(false);
  const [chatEditWindowMinutes, setChatEditWindowMinutes] = useState(10);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editBody, setEditBody] = useState('');
  const [messageMenuOpen, setMessageMenuOpen] = useState<string | null>(null);
  const [deleteConvConfirmOpen, setDeleteConvConfirmOpen] = useState(false);
  const [deleteMsgConfirmOpen, setDeleteMsgConfirmOpen] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isCustomer = !!getChatToken();
  const isEndUser = user?.role === 'staff';

  const loadConversations = useCallback(() => {
    if (isCustomer) return;
    setLoading(true);
    if (isEndUser) {
      chatApi
        .getMyConversation()
        .then((conv) => {
          setConversations(conv ? [conv] : []);
          setTotal(conv ? 1 : 0);
          if (conv) setSelected(conv);
        })
        .catch(() => {
          setConversations([]);
          setTotal(0);
        })
        .finally(() => setLoading(false));
      return;
    }
    chatApi
      .listConversations({ limit: 50, offset: 0 })
      .then((res) => {
        setConversations(res.items);
        setTotal(res.total);
      })
      .catch(() => {
        setConversations([]);
        setTotal(0);
      })
      .finally(() => setLoading(false));
  }, [isCustomer, isEndUser]);

  const loadMessages = useCallback(
    (convId: string) => {
      setMessagesLoading(true);
      chatApi
        .listMessages(convId, { limit: 100, offset: 0 })
        .then((res) => {
          setMessages([...res.items].reverse());
          setMessagesTotal(res.total);
        })
        .catch(() => {
          setMessages([]);
          setMessagesTotal(0);
        })
        .finally(() => setMessagesLoading(false));
    },
    []
  );

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  useEffect(() => {
    chatApi.getSettings().then((s) => setChatEditWindowMinutes(s.chat_edit_window_minutes ?? 10)).catch(() => {});
  }, []);

  useEffect(() => {
    if (selected) {
      loadMessages(selected.id);
    } else {
      setMessages([]);
      setMessagesTotal(0);
    }
  }, [selected?.id, loadMessages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const { connected, sendMessage: wsSendMessage, sendTyping } = useChatSocket({
    onMessage: (msg) => {
      setMessages((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
    },
    onTyping: (convId, isTyping) => {
      if (selected?.id === convId) setTyping(isTyping);
    },
  });

  const handleSelect = (conv: Conversation) => {
    setSelected(conv);
    setTyping(false);
    setAttachFile(null);
  };

  const handleSend = async () => {
    const text = input.trim();
    if (!selected && !attachFile) return;
    if (!text && !attachFile) return;
    setSending(true);
    const body = text || '';
    const attachment = attachFile
      ? { attachment_url: attachFile.url, attachment_name: attachFile.name, attachment_type: attachFile.type }
      : {};
    try {
      if (connected && selected) {
        wsSendMessage(selected.id, body, attachFile ?? undefined);
      } else if (selected) {
        await chatApi.sendMessage(selected.id, { body, ...attachment });
        const res = await chatApi.listMessages(selected.id, { limit: 1, offset: 0 });
        if (res.items[0]) setMessages((prev) => [...prev, res.items[0]]);
      }
      setInput('');
      setAttachFile(null);
      sendTyping(selected!.id, false);
      if (selected) loadConversations();
    } catch (e) {
      // show error
    } finally {
      setSending(false);
    }
  };

  const handleAttach = () => {
    fileInputRef.current?.click();
  };

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await chatApi.upload(formData);
      setAttachFile({ url: res.url, name: res.filename, type: file.type });
    } catch {
      // error
    }
  };

  const openStartChat = () => {
    setStartChatOpen(true);
    setCustomersLoading(true);
    referralApi
      .listCustomers({ limit: 100, offset: 0 })
      .then((r) => setCustomers(r.items))
      .catch(() => setCustomers([]))
      .finally(() => setCustomersLoading(false));
  };

  const startChatWith = async (customer: Customer) => {
    try {
      const conv = await chatApi.createConversation(customer.id);
      setConversations((prev) => [conv, ...prev.filter((c) => c.id !== conv.id)]);
      setSelected(conv);
      setStartChatOpen(false);
    } catch {
      // error
    }
  };

  const mySenderId = isCustomer ? selected?.customer_id : user?.id;
  const canEditMessage = (m: ChatMessage) => {
    if (!mySenderId || m.sender_type !== (isCustomer ? 'customer' : 'user') || m.sender_id !== mySenderId) return false;
    if (chatEditWindowMinutes <= 0) return false;
    const created = new Date(m.created_at).getTime();
    const deadline = created + chatEditWindowMinutes * 60 * 1000;
    return Date.now() <= deadline;
  };
  const canDeleteMessage = (m: ChatMessage) =>
    mySenderId && m.sender_type === (isCustomer ? 'customer' : 'user') && m.sender_id === mySenderId;

  const handleStartEdit = (m: ChatMessage) => {
    setEditingMessageId(m.id);
    setEditBody(m.body);
    setMessageMenuOpen(null);
  };

  const handleSaveEdit = async () => {
    if (!selected || !editingMessageId) return;
    try {
      const updated = await chatApi.editMessage(selected.id, editingMessageId, editBody);
      setMessages((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
      setEditingMessageId(null);
      setEditBody('');
    } catch {
      // error
    }
  };

  const handleCancelEdit = () => {
    setEditingMessageId(null);
    setEditBody('');
  };

  const handleDeleteMessage = async (messageId: string) => {
    if (!selected) return;
    try {
      await chatApi.deleteMessage(selected.id, messageId);
      setMessages((prev) => prev.filter((m) => m.id !== messageId));
      setMessagesTotal((t) => Math.max(0, t - 1));
      setDeleteMsgConfirmOpen(null);
      setMessageMenuOpen(null);
    } catch {
      // error
    }
  };

  const handleDeleteConversation = async () => {
    if (!selected) return;
    try {
      await chatApi.deleteConversation(selected.id);
      setConversations((prev) => prev.filter((c) => c.id !== selected.id));
      setTotal((t) => Math.max(0, t - 1));
      setSelected(null);
      setMessages([]);
      setMessagesTotal(0);
      setDeleteConvConfirmOpen(false);
    } catch {
      // error
    }
  };

  // Customer view: load single conversation (GET /chat/me) once
  const customerLoadedRef = useRef(false);
  useEffect(() => {
    if (isCustomer && !customerLoadedRef.current) {
      customerLoadedRef.current = true;
      setLoading(true);
      chatApi
        .getMyConversation()
        .then((conv) => {
          setSelected(conv);
          setConversations([conv]);
        })
        .catch(() => {
          // No conversation yet (pharmacy hasn't started chat)
        })
        .finally(() => setLoading(false));
    }
  }, [isCustomer]);

  if (loading && !isCustomer) {
    return <Loader variant="page" message={t('checking_auth')} />;
  }

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-theme-text flex items-center gap-2">
          <MessageCircle className="w-7 h-7 text-careplus-primary" />
          {t('nav_chat')}
        </h1>
        {!isCustomer && (
          <div className="flex items-center gap-2">
            {!isEndUser && (
              <button
                type="button"
                onClick={openStartChat}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-careplus-primary text-white hover:opacity-90"
              >
                <UserPlus className="w-4 h-4" />
                Start chat
              </button>
            )}
            <button
              type="button"
              onClick={loadConversations}
              disabled={loading}
              className="p-2 rounded-lg text-theme-text hover:bg-theme-surface disabled:opacity-50"
              title="Refresh"
            >
              <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        )}
      </div>

      <div className="flex flex-1 min-h-0 border border-theme-border rounded-xl overflow-hidden bg-theme-surface">
        {/* Conversation list (staff) or placeholder (customer) */}
        {!isCustomer && (
          <div className="w-80 border-r border-theme-border flex flex-col bg-theme-bg">
            <div className="overflow-y-auto flex-1">
              {conversations.length === 0 ? (
                <p className="p-4 text-theme-muted text-sm">No conversations yet. Start a chat with a customer.</p>
              ) : (
                <ul>
                  {conversations.map((conv) => (
                    <li key={conv.id}>
                      <button
                        type="button"
                        onClick={() => handleSelect(conv)}
                        className={`w-full text-left px-4 py-3 border-b border-theme-border hover:bg-theme-surface transition-colors ${
                          selected?.id === conv.id ? 'bg-careplus-primary/10 border-l-4 border-l-careplus-primary' : ''
                        }`}
                      >
                        <div className="font-medium text-theme-text truncate">
                          {conv.customer?.name || conv.customer_id?.slice(0, 8) || 'Customer'}
                        </div>
                        <div className="text-sm text-theme-muted flex items-center gap-1">
                          <Phone className="w-3 h-3" />
                          {conv.customer?.phone || ''}
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}

        {/* Message area */}
        <div className="flex-1 flex flex-col min-w-0">
          {selected ? (
            <>
              <div className="px-4 py-2 border-b border-theme-border flex items-center justify-between">
                <div>
                  <span className="font-medium text-theme-text">
                    {selected.customer?.name || selected.customer_id?.slice(0, 8) || selected.user_id ? 'My chat' : 'Customer'}
                  </span>
                  {selected.customer?.phone && (
                    <span className="text-sm text-theme-muted ml-2">{selected.customer.phone}</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {connected && (
                    <span className="text-xs text-green-600 bg-green-100 dark:bg-green-900/30 px-2 py-0.5 rounded">
                      Live
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => setDeleteConvConfirmOpen(true)}
                    className="p-1.5 rounded-lg text-theme-muted hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-900/30"
                    title="Delete conversation"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {messagesLoading ? (
                  <Loader variant="inline" />
                ) : (
                  <>
                    {messages.map((m) => (
                      <div
                        key={m.id}
                        className={`flex ${m.sender_type === 'user' ? 'justify-end' : 'justify-start'} group`}
                      >
                        <div
                          className={`max-w-[75%] rounded-lg px-3 py-2 relative ${
                            m.sender_type === 'user'
                              ? 'bg-careplus-primary text-white'
                              : 'bg-theme-muted/20 text-theme-text'
                          }`}
                        >
                          {editingMessageId === m.id ? (
                            <div className="space-y-2">
                              <textarea
                                value={editBody}
                                onChange={(e) => setEditBody(e.target.value)}
                                className="w-full min-h-[60px] rounded border border-theme-border bg-theme-bg text-theme-text text-sm p-2 focus:outline-none focus:ring-2 focus:ring-careplus-primary"
                                autoFocus
                              />
                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  onClick={handleSaveEdit}
                                  className="px-2 py-1 rounded bg-careplus-primary text-white text-sm"
                                >
                                  Save
                                </button>
                                <button
                                  type="button"
                                  onClick={handleCancelEdit}
                                  className="px-2 py-1 rounded border border-theme-border text-theme-text text-sm"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            <>
                              {m.body && <p className="whitespace-pre-wrap break-words">{m.body}</p>}
                              {m.attachment_url && (
                                <div className="mt-1">
                                  {m.attachment_type?.startsWith('image/') ? (
                                    <a href={resolveImageUrl(m.attachment_url)} target="_blank" rel="noopener noreferrer">
                                      <img
                                        src={resolveImageUrl(m.attachment_url)}
                                        alt={m.attachment_name || 'Attachment'}
                                        className="max-w-full max-h-48 rounded object-cover"
                                      />
                                    </a>
                                  ) : (
                                    <a
                                      href={resolveImageUrl(m.attachment_url)}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-sm underline"
                                    >
                                      {m.attachment_name || 'File'}
                                    </a>
                                  )}
                                </div>
                              )}
                              <div className="flex items-center gap-1 mt-1 flex-wrap">
                                <p className="text-xs opacity-80">
                                  {new Date(m.created_at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                                  {m.updated_at && new Date(m.updated_at).getTime() > new Date(m.created_at).getTime() && (
                                    <span className="ml-1">(edited)</span>
                                  )}
                                </p>
                                {(canEditMessage(m) || canDeleteMessage(m)) && (
                                  <div className="relative ml-1">
                                    <button
                                      type="button"
                                      onClick={() => setMessageMenuOpen(messageMenuOpen === m.id ? null : m.id)}
                                      className="p-0.5 rounded opacity-70 hover:opacity-100"
                                      aria-label="Message actions"
                                    >
                                      <MoreVertical className="w-3.5 h-3.5" />
                                    </button>
                                    {messageMenuOpen === m.id && (
                                      <>
                                        <div
                                          className="fixed inset-0 z-10"
                                          onClick={() => setMessageMenuOpen(null)}
                                          aria-hidden
                                        />
                                        <div className="absolute right-0 top-full mt-0.5 py-1 rounded-lg bg-theme-bg border border-theme-border shadow-lg z-20 min-w-[100px]">
                                          {canEditMessage(m) && (
                                            <button
                                              type="button"
                                              onClick={() => handleStartEdit(m)}
                                              className="w-full text-left px-3 py-1.5 text-sm text-theme-text hover:bg-theme-surface flex items-center gap-2"
                                            >
                                              <Pencil className="w-3.5 h-3.5" /> Edit
                                            </button>
                                          )}
                                          {canDeleteMessage(m) && (
                                            <button
                                              type="button"
                                              onClick={() => setDeleteMsgConfirmOpen(m.id)}
                                              className="w-full text-left px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2"
                                            >
                                              <Trash2 className="w-3.5 h-3.5" /> Delete
                                            </button>
                                          )}
                                        </div>
                                      </>
                                    )}
                                  </div>
                                )}
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                    {typing && (
                      <div className="flex justify-start">
                        <span className="rounded-lg px-3 py-2 bg-theme-muted/20 text-theme-muted text-sm">
                          typing…
                        </span>
                      </div>
                    )}
                    <div ref={messagesEndRef} />
                  </>
                )}
              </div>
              <div className="p-2 border-t border-theme-border flex gap-2 items-end">
                <input
                  type="file"
                  ref={fileInputRef}
                  className="hidden"
                  accept="image/*,.pdf,.doc,.docx"
                  onChange={onFileChange}
                />
                <button
                  type="button"
                  onClick={handleAttach}
                  className="p-2 rounded-lg text-theme-muted hover:bg-theme-muted/20"
                  title="Attach file"
                >
                  <Paperclip className="w-5 h-5" />
                </button>
                {attachFile && (
                  <span className="text-sm text-theme-muted truncate max-w-[120px]" title={attachFile.name}>
                    {attachFile.name}
                  </span>
                )}
                <input
                  type="text"
                  value={input}
                  onChange={(e) => {
                    setInput(e.target.value);
                    if (selected) sendTyping(selected.id, true);
                  }}
                  onBlur={() => selected && sendTyping(selected.id, false)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  placeholder="Type a message…"
                  className="flex-1 rounded-lg border border-theme-border bg-theme-bg text-theme-text px-3 py-2 focus:outline-none focus:ring-2 focus:ring-careplus-primary"
                />
                <button
                  type="button"
                  onClick={handleSend}
                  disabled={sending || (!input.trim() && !attachFile)}
                  className="p-2 rounded-lg bg-careplus-primary text-white hover:opacity-90 disabled:opacity-50"
                  title="Send"
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-theme-muted">
              {isCustomer ? (
                <p>Use the link sent to you to open a chat with the pharmacy.</p>
              ) : (
                <p>Select a conversation or start a new chat with a customer.</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Delete conversation confirm */}
      {deleteConvConfirmOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setDeleteConvConfirmOpen(false)}>
          <div
            className="bg-theme-bg rounded-xl shadow-xl max-w-sm w-full p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-theme-text font-medium mb-2">Delete this conversation?</p>
            <p className="text-sm text-theme-muted mb-4">All messages will be permanently removed. This cannot be undone.</p>
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setDeleteConvConfirmOpen(false)}
                className="px-3 py-2 rounded-lg border border-theme-border text-theme-text"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteConversation}
                className="px-3 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete message confirm */}
      {deleteMsgConfirmOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setDeleteMsgConfirmOpen(null)}>
          <div
            className="bg-theme-bg rounded-xl shadow-xl max-w-sm w-full p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-theme-text font-medium mb-2">Delete this message?</p>
            <p className="text-sm text-theme-muted mb-4">This cannot be undone.</p>
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setDeleteMsgConfirmOpen(null)}
                className="px-3 py-2 rounded-lg border border-theme-border text-theme-text"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => deleteMsgConfirmOpen && handleDeleteMessage(deleteMsgConfirmOpen)}
                className="px-3 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Start chat modal */}
      {startChatOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setStartChatOpen(false)}>
          <div
            className="bg-theme-bg rounded-xl shadow-xl max-w-md w-full max-h-[80vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-theme-border font-medium text-theme-text">Start chat with customer</div>
            <div className="overflow-y-auto max-h-[60vh] p-2">
              {customersLoading ? (
                <Loader variant="inline" />
              ) : (
                <ul>
                  {customers.map((c) => (
                    <li key={c.id}>
                      <button
                        type="button"
                        onClick={() => startChatWith(c)}
                        className="w-full text-left px-3 py-2 rounded-lg hover:bg-theme-surface text-theme-text flex items-center justify-between"
                      >
                        <span>{c.name || c.phone}</span>
                        <span className="text-sm text-theme-muted">{c.phone}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="p-2 border-t border-theme-border">
              <button
                type="button"
                onClick={() => setStartChatOpen(false)}
                className="w-full py-2 rounded-lg border border-theme-border text-theme-text hover:bg-theme-surface"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
