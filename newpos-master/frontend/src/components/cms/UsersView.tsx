import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { getCurrentUser, canApprove } from '@/lib/auth';

export default function UsersView() {
  const role = getCurrentUser().role;
  const [users, setUsers] = useState<any[]>([]);
  const [form, setForm] = useState({
    username: '', email: '', password: '', role: 'accountant1', firstName: '', lastName: '', phone: '',
  });

  const load = () => api.get('/api/cms-users').then((r) => setUsers(r.data.data || [])).catch(() => toast.error('Load failed'));
  useEffect(() => { if (canApprove(role)) load(); }, [role]);

  if (!canApprove(role)) return <p className="text-muted-foreground">Only Owner can manage users.</p>;

  const create = async () => {
    try {
      await api.post('/api/cms-users', form);
      toast.success('User created');
      setForm({ username: '', email: '', password: '', role: 'accountant1', firstName: '', lastName: '', phone: '' });
      load();
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed');
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">User Management</h2>
      <div className="grid md:grid-cols-2 gap-4 p-4 border rounded-lg">
        {(['username', 'email', 'password', 'firstName', 'lastName', 'phone'] as const).map((k) => (
          <div key={k}><Label>{k}</Label><Input value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} /></div>
        ))}
        <div>
          <Label>Role</Label>
          <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="owner">Owner</SelectItem>
              <SelectItem value="accountant1">Accountant 1</SelectItem>
              <SelectItem value="accountant2">Accountant 2</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button onClick={create} className="md:col-span-2">Add User</Button>
      </div>
      <table className="w-full text-sm border">
        <thead><tr className="bg-muted"><th className="p-2 text-left">Name</th><th>Email</th><th>Role</th></tr></thead>
        <tbody>
          {users.map((u) => (
            <tr key={u._id} className="border-t">
              <td className="p-2">{u.firstName} {u.lastName}</td>
              <td>{u.email}</td>
              <td>{u.role}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
