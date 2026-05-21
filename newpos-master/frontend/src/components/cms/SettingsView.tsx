import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { fetchCompanySettings, getLogoUrl } from '@/lib/companySettings';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

export default function SettingsView() {
  const [form, setForm] = useState({
    companyName: 'Mara Ha International Plastic',
    currencySymbol: 'Rs.',
    address: '',
    phone: '',
    email: '',
    externalBackupPath: '',
  });
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchCompanySettings().then((s) => {
      setForm({
        companyName: s.companyName || '',
        currencySymbol: s.currencySymbol || 'Rs.',
        address: s.address || '',
        phone: s.phone || '',
        email: s.email || '',
        externalBackupPath: '',
      });
      setLogoPreview(getLogoUrl(s.logo));
    });
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      await api.put('/api/settings', form);
      toast.success('Settings saved');
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const uploadLogo = async (file: File) => {
    const fd = new FormData();
    fd.append('logo', file);
    try {
      const res = await api.post('/api/settings/logo', fd);
      setLogoPreview(getLogoUrl(res.data.data.logo));
      toast.success('Logo uploaded');
    } catch {
      toast.error('Logo upload failed');
    }
  };

  return (
    <div className="max-w-2xl space-y-6">
      <h2 className="text-xl font-semibold">Company Settings</h2>
      <div className="flex items-center gap-4">
        {logoPreview && <img src={logoPreview} alt="Logo" className="h-16 w-16 object-contain border rounded" />}
        <div>
          <Label>Company Logo</Label>
          <Input type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && uploadLogo(e.target.files[0])} />
        </div>
      </div>
      {(['companyName', 'currencySymbol', 'address', 'phone', 'email'] as const).map((key) => (
        <div key={key}>
          <Label className="capitalize">{key.replace(/([A-Z])/g, ' $1')}</Label>
          <Input value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} />
        </div>
      ))}
      <Button onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save Settings'}</Button>
    </div>
  );
}
