import { useEffect, useState } from 'react';
import { socialAPI } from '../../api';
import { Button, Input, Card } from '../../components/ui';

// Keys match the API allowlist; labels can change without changing stored data.
const platforms = {
  facebook: 'Facebook', instagram: 'Instagram', linkedin: 'LinkedIn',
  youtube: 'YouTube', tiktok: 'TikTok', x: 'X (Twitter)', whatsapp: 'WhatsApp',
};

export default function SocialLinksManagement() {
  const [links, setLinks] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      setLinks((await socialAPI.get()).data);
    } catch {
      setError('Could not load social links');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const save = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');
    try {
      setLinks((await socialAPI.update(links)).data);
      setMessage('Social links saved. They are now available in the public footer.');
    } catch (error) {
      setError(error.response?.data?.error || 'Could not save links');
    } finally {
      setLoading(false);
    }
  };

  const updateLink = (platform, value) => {
    setError('');
    setMessage('');
    setLinks(previous => ({ ...previous, [platform]: value }));
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Social media links</h1>
      <p>Add HTTPS profile URLs. Leave a field empty to hide that icon.</p>
      {error && <p role="alert">{error} <Button variant="outline" onClick={load}>Retry</Button></p>}
      {message && <p role="status">{message}</p>}
      <Card>
        <form onSubmit={save} className="space-y-4">
          {Object.entries(platforms).map(([platform, label]) => (
            <Input
              key={platform}
              label={label}
              type="url"
              value={links[platform] || ''}
              onChange={event => updateLink(platform, event.target.value)}
              disabled={loading}
              placeholder="https://"
            />
          ))}
          <Button type="submit" disabled={!!error} loading={loading}>Save social links</Button>
        </form>
      </Card>
    </div>
  );
}
