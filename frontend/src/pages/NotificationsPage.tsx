import { useEffect, useState } from 'react';
import { notificationApi, Notification } from '@/lib/api';
import Loader from '@/components/Loader';
import { Bell, Check, CheckCheck, Loader2, RefreshCw } from 'lucide-react';

export default function NotificationsPage() {
  const [list, setList] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [markingId, setMarkingId] = useState<string | null>(null);
  const [markAllLoading, setMarkAllLoading] = useState(false);

  const load = () => {
    setLoading(true);
    setError('');
    notificationApi
      .list({ limit: 100 })
      .then(setList)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load notifications'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const handleMarkRead = (id: string) => {
    setMarkingId(id);
    notificationApi
      .markRead(id)
      .then(() => load())
      .catch(() => {})
      .finally(() => setMarkingId(null));
  };

  const handleMarkAllRead = () => {
    setMarkAllLoading(true);
    notificationApi
      .markAllRead()
      .then(() => load())
      .catch(() => {})
      .finally(() => setMarkAllLoading(false));
  };

  const unreadCount = list.filter((n) => !n.read_at).length;

  if (loading) {
    return <Loader variant="page" message="Loading notifications…" />;
  }
  if (error) {
    return (
      <div className="py-4">
        <p className="text-red-600">{error}</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <Bell className="w-7 h-7 text-careplus-primary" />
          Notifications
        </h1>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="p-2 rounded-lg text-gray-600 hover:bg-gray-100 hover:text-careplus-primary transition-colors disabled:opacity-50"
            title="Refresh"
            aria-label="Refresh"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
          {unreadCount > 0 && (
          <button
            type="button"
            onClick={handleMarkAllRead}
            disabled={markAllLoading}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-careplus-primary text-white text-sm font-medium hover:bg-careplus-primary/90 disabled:opacity-60"
          >
            {markAllLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <CheckCheck className="w-4 h-4" />
            )}
            Mark all as read
          </button>
        )}
        </div>
      </div>
      <div className="bg-white rounded-xl shadow border border-gray-100 overflow-hidden">
        {list.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            <Bell className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>No notifications yet.</p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {list.map((n) => (
              <li
                key={n.id}
                className={`flex items-start gap-3 px-4 py-3 hover:bg-gray-50 ${!n.read_at ? 'bg-careplus-primary/5' : ''}`}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">{n.title}</p>
                  <p className="text-sm text-gray-600 mt-0.5">{n.message}</p>
                  <p className="text-xs text-gray-400 mt-1">
                    {new Date(n.created_at).toLocaleString()}
                    {n.type && n.type !== 'info' && (
                      <span className="ml-2 px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">
                        {n.type}
                      </span>
                    )}
                  </p>
                </div>
                {!n.read_at && (
                  <button
                    type="button"
                    onClick={() => handleMarkRead(n.id)}
                    disabled={markingId === n.id}
                    className="shrink-0 p-2 rounded-lg text-gray-500 hover:bg-gray-200 hover:text-gray-700 disabled:opacity-50"
                    title="Mark as read"
                  >
                    {markingId === n.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Check className="w-4 h-4" />
                    )}
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
