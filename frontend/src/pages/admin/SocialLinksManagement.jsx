import { useEffect,useState } from 'react';
import { socialAPI } from '../../api';
import { Button,Input,Card } from '../../components/ui';
const platforms = ['facebook','instagram','linkedin','youtube','tiktok','x','whatsapp'];
export default function SocialLinksManagement() {
  const [links,setLinks] = useState({}), [loading,setLoading] = useState(true), [error,setError] = useState(''), [message,setMessage] = useState('');
  const load = async()=>{setLoading(true);setError('');try{setLinks((await socialAPI.get()).data);}catch{setError('Could not load social links');}finally{setLoading(false);}};
  useEffect(()=>{load();},[]);
  const save = async e=>{e.preventDefault();setLoading(true);setError('');setMessage('');try{setLinks((await socialAPI.update(links)).data);setMessage('Social links saved. They are now available in the public footer.');}catch(e){setError(e.response?.data?.error || 'Could not save links');}finally{setLoading(false);}};
  return <div className="space-y-6"><h1 className="text-2xl font-bold">Social media links</h1><p>Add HTTPS profile URLs. Leave a field empty to hide that icon.</p>{error && <p role="alert">{error} <Button variant="outline" onClick={load}>Retry</Button></p>}{message && <p role="status">{message}</p>}<Card><form onSubmit={save} className="space-y-4">{platforms.map(platform=><Input key={platform} label={platform === 'x' ? 'X (Twitter)' : platform[0].toUpperCase()+platform.slice(1)} type="url" value={links[platform] || ''} onChange={e=>{setError('');setMessage('');setLinks({...links,[platform]:e.target.value});}} disabled={loading} placeholder="https://" />)}<Button type="submit" disabled={!!error} loading={loading}>Save social links</Button></form></Card></div>;
}
