import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { getCurrentUser, canApprove } from '@/lib/auth';

export default function ActivityLogView() {
  const [logs, setLogs] = useState<any[]>([]);
  const role = getCurrentUser().role;

  useEffect(() => {
    if (!canApprove(role)) return;
    api.get('/api/activity-logs?limit=100').then((r) => setLogs(r.data.data || []));
  }, [role]);

  if (!canApprove(role)) return <p>Only Owner can view activity logs.</p>;

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Activity Log</h2>
      <div className="overflow-auto border rounded-lg max-h-[70vh]">
        <table className="w-full text-xs">
          <thead className="bg-muted sticky top-0">
            <tr>
              <th className="p-2 text-left">Date</th><th>User</th><th>Action</th><th>Module</th><th>Reason</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((l) => (
              <tr key={l._id} className="border-t">
                <td className="p-2">{new Date(l.createdAt).toLocaleString()}</td>
                <td>{l.userName}</td>
                <td>{l.action}</td>
                <td>{l.module}</td>
                <td>{l.reason || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
