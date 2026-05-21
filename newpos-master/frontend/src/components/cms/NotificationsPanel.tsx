import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { getCurrentUser } from '@/lib/auth';
import { Bell } from 'lucide-react';

export function NotificationsPanel() {
  const [items, setItems] = useState<any[]>([]);
  const user = getCurrentUser();

  useEffect(() => {
    const load = () => {
      api.get(`/api/notifications?role=${user.role || 'owner'}&unreadOnly=true`)
        .then((r) => setItems(r.data.data || []))
        .catch(() => {});
    };
    load();
    const t = setInterval(load, 60000);
    return () => clearInterval(t);
  }, [user.role]);

  if (!items.length) return null;

  return (
    <div className="mb-4 p-3 border border-amber-200 bg-amber-50 dark:bg-amber-950/30 rounded-lg">
      <div className="flex items-center gap-2 font-medium text-sm mb-2">
        <Bell className="w-4 h-4" /> Notifications ({items.length})
      </div>
      <ul className="space-y-1 text-xs">
        {items.slice(0, 5).map((n) => (
          <li key={n._id} className="flex justify-between gap-2">
            <span>{n.title}: {n.message}</span>
            <button type="button" className="text-primary underline" onClick={() => api.patch(`/api/notifications/${n._id}/read`).then(() => setItems((p) => p.filter((x) => x._id !== n._id)))}>Dismiss</button>
          </li>
        ))}
      </ul>
    </div>
  );
}
