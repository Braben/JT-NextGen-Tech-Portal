import { FaFacebook, FaLinkedin, FaWhatsapp } from 'react-icons/fa';
export default function ShareLinks({ title, path }) {
  const url = encodeURIComponent(new URL(path,window.location.origin).href);
  const links = [
    { name:'Facebook', icon:FaFacebook, href:`https://www.facebook.com/sharer/sharer.php?u=${url}` },
    { name:'LinkedIn', icon:FaLinkedin, href:`https://www.linkedin.com/sharing/share-offsite/?url=${url}` },
    { name:'WhatsApp', icon:FaWhatsapp, href:`https://wa.me/?text=${encodeURIComponent(title)}%20${url}` },
  ];
  return <div className="mt-8 border-t border-gray-200 pt-4"><p className="mb-3 font-semibold">Share this post</p><div className="flex flex-wrap gap-3">{links.map(({name,icon:Icon,href})=><a key={name} href={href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-lg bg-core px-3 py-2 text-white"><Icon aria-hidden="true" />{name}</a>)}</div></div>;
}
