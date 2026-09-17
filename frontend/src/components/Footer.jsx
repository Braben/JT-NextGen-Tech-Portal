import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import BrandLogo from './BrandLogo';
import SocialLinks from './SocialLinks';
import { motion } from 'framer-motion';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

const programs = [
  { label: 'Frontend Development', to: '/programs/frontend-development' },
  { label: 'Backend Development', to: '/programs/backend-development' },
  { label: 'Graphic Design', to: '/programs/graphic-design' },
  { label: 'Digital Skills', to: '/programs/digital-skills' },
  { label: 'UI/UX Design', to: '/programs/ui-ux-design' },
  { label: 'Data Analytics', to: '/programs/data-analytics' },
];

const services = [
  'Web Development Training',
  'Graphic Design & Branding',
  'Digital Skills Bootcamp',
  'IT Career Mentorship',
  'Computer Literacy Program',
  'Coding for Kids & Teens',
];

const quickLinks = [
  { label: 'Home', to: '/' },
  { label: 'Programs', to: '/programs' },
  { label: 'About Us', to: '/' },
  { label: 'Contact', to: '/contact' },
  { label: 'Blog', to: '/blog' },
  { label: 'Articles', to: '/articles' },
  { label: 'Register', to: '/register' },
];

const fadeUp = { initial: { opacity: 0, y: 20 }, whileInView: { opacity: 1, y: 0 }, viewport: { once: true }, transition: { duration: 0.5 } };

export default function Footer() {
  const footerRef = useRef(null);
  const taglineRef = useRef(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      ScrollTrigger.create({
        trigger: footerRef.current,
        start: 'top 95%',
        onEnter: () => {
          gsap.fromTo(taglineRef.current, { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.6, ease: 'power2.out' });
        },
      });
    }, footerRef);
    return () => ctx.revert();
  }, []);

  return (
    <footer ref={footerRef} className="bg-gray-900 text-gray-300 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-gray-900 via-gray-900 to-gray-800 pointer-events-none" />
      <div className="max-w-7xl mx-auto px-6 pt-16 pb-8 relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10 lg:gap-12">
          <motion.div {...fadeUp} transition={{ duration: 0.5, delay: 0 }}>
            <Link to="/" className="text-2xl font-bold text-white tracking-tight inline-block hover:scale-105 transition-transform">
              <BrandLogo className="w-56" />
            </Link>
            <p className="mt-4 text-sm text-gray-400 leading-relaxed">
              Empowering the next generation with practical digital and technology skills.
              We provide hands-on IT training, career mentorship, and innovation-driven programs
              to prepare youth for the modern workforce.
            </p>
            <div className="flex gap-3 mt-6">
              {[
                { href: 'mailto:info@nextgentechhub.com', title: 'Email', icon: 'M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z' },
                { href: 'tel:+233543946424', title: 'Phone', icon: 'M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z' },
              ].map((s, i) => (
                <motion.a key={i} href={s.href} target="_blank" rel="noopener noreferrer" title={s.title}
                  className="w-9 h-9 bg-gray-800 hover:bg-brand-600 rounded-lg flex items-center justify-center transition-colors"
                  whileHover={{ scale: 1.15, backgroundColor: '#059669' }} whileTap={{ scale: 0.9 }}>
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={s.icon} />
                  </svg>
                </motion.a>
              ))}
            </div>
            <SocialLinks />
          </motion.div>

          <motion.div {...fadeUp} transition={{ duration: 0.5, delay: 0.1 }}>
            <h3 className="text-white font-semibold text-sm uppercase tracking-wider mb-5">Our Programs</h3>
            <ul className="space-y-3">
              {programs.map((p, i) => (
                <motion.li key={i} whileHover={{ x: 4 }}>
                  <Link to={p.to} className="text-sm text-gray-400 hover:text-brand-400 transition-colors">{p.label}</Link>
                </motion.li>
              ))}
            </ul>
          </motion.div>

          <motion.div {...fadeUp} transition={{ duration: 0.5, delay: 0.2 }}>
            <h3 className="text-white font-semibold text-sm uppercase tracking-wider mb-5">IT Services</h3>
            <ul className="space-y-3">
              {services.map((s, i) => (
                <motion.li key={i} className="text-sm text-gray-400 flex items-start gap-2" whileHover={{ x: 4, color: '#34d399' }}>
                  <svg className="w-4 h-4 text-brand-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4" /></svg>
                  <span>{s}</span>
                </motion.li>
              ))}
            </ul>
          </motion.div>

          <motion.div {...fadeUp} transition={{ duration: 0.5, delay: 0.3 }}>
            <h3 className="text-white font-semibold text-sm uppercase tracking-wider mb-5">Quick Links</h3>
            <ul className="space-y-3">
              {quickLinks.map((l, i) => (
                <motion.li key={i} whileHover={{ x: 4 }}>
                  <Link to={l.to} className="text-sm text-gray-400 hover:text-brand-400 transition-colors flex items-center gap-2">
                    <svg className="w-3 h-3 text-brand-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                    {l.label}
                  </Link>
                </motion.li>
              ))}
            </ul>
            <div className="mt-8 pt-6 border-t border-gray-800">
              <h4 className="text-white text-xs uppercase tracking-wider mb-3">Contact</h4>
              <p className="text-sm text-gray-400 leading-relaxed">
                Manya Kpongunor<br />
                Off Kpongunor Salem Road<br />
                <a href="tel:+233543946424" className="hover:text-brand-400 transition-colors">+233 543 946 424</a><br />
                <a href="mailto:info@nextgentechhub.com" className="hover:text-brand-400 transition-colors">info@nextgentechhub.com</a>
              </p>
            </div>
          </motion.div>
        </div>

        <div ref={taglineRef} className="mt-12 pt-8 border-t border-gray-800 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-sm text-gray-500">
            &copy; {new Date().getFullYear()} JT NextGen Tech Hub. All rights reserved.
          </p>
          <div className="flex gap-6 text-sm text-gray-500">
            {['Privacy Policy', 'Terms of Service'].map((item, i) => (
              <span key={i} className="cursor-pointer hover:text-gray-400 transition-colors">{item}</span>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
