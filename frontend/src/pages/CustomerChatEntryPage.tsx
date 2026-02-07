import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { setChatToken, getChatToken } from '@/lib/api';
import ChatPage from '@/pages/ChatPage';
import { MessageCircle } from 'lucide-react';

/**
 * Entry for customer chat: reads ?token= from URL, stores it, and renders ChatPage.
 * Staff can share a link like /customer-chat?token=... (token from POST /chat/customer-token).
 */
export default function CustomerChatEntryPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  useEffect(() => {
    if (token) setChatToken(token);
  }, [token]);

  const hasToken = token || getChatToken();
  if (!hasToken) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-theme-bg theme-text p-4">
        <MessageCircle className="w-16 h-16 text-careplus-primary mb-4" />
        <h1 className="text-xl font-semibold mb-2">Chat with pharmacy</h1>
        <p className="text-theme-muted text-center max-w-sm">
          Use the link sent to you by the pharmacy to open this chat. If you don&apos;t have a link, please contact the
          pharmacy.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-theme-bg">
      <ChatPage />
    </div>
  );
}
