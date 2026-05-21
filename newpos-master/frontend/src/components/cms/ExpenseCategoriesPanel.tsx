import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

export function ExpenseCategoriesPanel() {
  const [categories, setCategories] = useState<{ _id: string; name: string }[]>([]);
  const [newName, setNewName] = useState('');

  const load = () => api.get('/api/expense-categories').then((r) => setCategories(r.data.data || []));
  useEffect(() => { load(); }, []);

  const add = async () => {
    if (!newName.trim()) return;
    try {
      await api.post('/api/expense-categories', { name: newName.trim() });
      setNewName('');
      load();
      toast.success('Category added');
    } catch {
      toast.error('Failed to add category');
    }
  };

  return (
    <div className="p-4 border rounded-lg mb-4 bg-cms-card">
      <h3 className="font-medium mb-3">Expense Categories</h3>
      <div className="flex gap-2 mb-3">
        <Input placeholder="e.g. Electricity, Rent, LPG Gas" value={newName} onChange={(e) => setNewName(e.target.value)} />
        <Button onClick={add}>Add</Button>
      </div>
      <div className="flex flex-wrap gap-2">
        {categories.map((c) => (
          <span key={c._id} className="px-2 py-1 bg-muted rounded text-xs">{c.name}</span>
        ))}
      </div>
    </div>
  );
}
