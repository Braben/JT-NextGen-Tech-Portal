import { useState,useEffect } from 'react';
import { FaFacebook,FaInstagram,FaLinkedin,FaYoutube,FaTiktok,FaTwitter,FaWhatsapp } from 'react-icons/fa';
import { socialAPI } from '../api';
const icons = {facebook:FaFacebook,instagram:FaInstagram,linkedin:FaLinkedin,youtube:FaYoutube,tiktok:FaTiktok,x:FaTwitter,whatsapp:FaWhatsapp};
export default function SocialLinks() {
  const [links,setLinks] = useState({});
  useEffect(()=>{let active=true;socialAPI.get().then(r=>{if(active)setLinks(r.data);}).catch(()=>{});return()=>{active=false;};},[]);
  return <div className="mt-4 flex flex-wrap gap-3" aria-label="Social media">{Object.entries(links).filter(([key,url])=>icons[key] && /^https:\/\//i.test(url)).map(([key,url])=>{const Icon=icons[key];return <a key={key} href={url} target="_blank" rel="noopener noreferrer" aria-label={key === 'x' ? 'X (Twitter)' : key} className="flex h-9 w-9 items-center justify-center rounded-lg bg-core text-white hover:bg-brand-700"><Icon aria-hidden="true" /></a>;})}</div>;
}
