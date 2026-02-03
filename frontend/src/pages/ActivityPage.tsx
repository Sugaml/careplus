import { useCallback, useEffect, useState } from 'react';
import { activityApi, ActivityLog } from '@/lib/api';
import Loader from '@/components/Loader';
import { Activity, RefreshCw } from 'lucide-react';

export default function ActivityPage() {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const loadLogs = useCallback(() => {
    setLoading(true);
    setError('');
    activityApi
      .list({ limit: 50 })
      .then(setLogs)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load activity'))
      .finally(() => {
        setLoading(false);
        setRefreshing(false);
      });
  }, []);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadLogs();
  };

  if (loading && logs.length === 0) return <Loader variant="page" message="Loading activity…" />;
  if (error && logs.length === 0) return <p className="text-red-600">{error}</p>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Activity</h1>
        <button
          type="button"
          onClick={handleRefresh}
          disabled={loading || refreshing}
          className="p-2 rounded-lg text-gray-600 hover:bg-gray-100 hover:text-careplus-primary transition-colors disabled:opacity-50"
          title="Refresh"
          aria-label="Refresh"
        >
          <RefreshCw className={`w-5 h-5 ${refreshing || loading ? 'animate-spin' : ''}`} />
        </button>
      </div>
      <div className="bg-white rounded-xl shadow border border-gray-100 overflow-hidden">
        {logs.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            <Activity className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>No activity yet. API requests will appear here.</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-700">Time</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-700">User</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-700">Action</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-700">IP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                    {new Date(log.created_at).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-800">
                    {log.user ? `${log.user.name || log.user.email}` : log.user_id}
                  </td>
                  <td className="px-4 py-3 font-mono text-sm text-gray-700">{log.action}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">{log.ip_address || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
