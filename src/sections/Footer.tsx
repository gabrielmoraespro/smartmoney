import { useRef, useState } from 'react';
import { motion, useInView } from 'framer-motion';
import { Instagram, Twitter, Linkedin, Github, Send } from 'lucide-react';

const footerLinks = {
  product: [
    { label: 'Features', href: '#features' },
    { label: 'How It Works', href: '#how-it-works' },
    { label: 'Pricing', href: '#' },
    { label: 'Security', href: '#' },
  ],
  company: [
    { label: 'About', href: '#' },
    { label: 'Blog', href: '#' },
    { label: 'Careers', href: '#' },
    { label: 'Press', href: '#' },
  ],
  legal: [
    { label: 'Privacy', href: '#' },
    { label: 'Terms', href: '#' },
    { label: 'Cookies', href: '#' },
    { label: 'Licenses', href: '#' },
  ],
};

const socialLinks = [
  { icon: Instagram, href: '#', label: 'Instagram' },
  { icon: Twitter, href: '#', label: 'Twitter' },
  { icon: Linkedin, href: '#', label: 'LinkedIn' },
  { icon: Github, href: '#', label: 'GitHub' },
];

export function Footer() {
  const sectionRef = useRef<HTMLElement>(null);
  const isInView = useInView(sectionRef, { once: true, margin: '-50px' });
  const [email, setEmail] = useState('');
  const [isSubscribed, setIsSubscribed] = useState(false);

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    if (email) {
      setIsSubscribed(true);
      setEmail('');
      setTimeout(() => setIsSubscribed(false), 3000);
    }
  };

  return (
    <footer ref={sectionRef} className="relative pt-20 pb-10 bg-black border-t border-white/10">
      <div 
        className="absolute bottom-0 left-1/2 -translate-x-1/2 w-full h-1/2 opacity-30"
        style={{ background: 'radial-gradient(ellipse at center bottom, rgba(209, 226, 157, 0.1) 0%, transparent 50%)' }}
      />

      <div className="relative z-10 w-[90%] max-w-[1400px] mx-auto">
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-12 mb-16">
          <div className="lg:col-span-1">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={isInView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.5 }} className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#d1e29d] to-[#a8c76f] flex items-center justify-center">
                <span className="text-black font-bold text-sm">M</span>
              </div>
              <span className="text-white font-semibold text-lg">MoneySmart</span>
            </motion.div>
            <motion.p initial={{ opacity: 0 }} animate={isInView ? { opacity: 1 } : {}} transition={{ duration: 0.4, delay: 0.15 }} className="text-white/60 mb-6">
              AI-powered finance for everyone.
            </motion.p>
            <motion.div initial={{ opacity: 0 }} animate={isInView ? { opacity: 1 } : {}} transition={{ duration: 0.4, delay: 0.2 }} className="flex gap-3">
              {socialLinks.map((social, index) => (
                <motion.a
                  key={social.label}
                  href={social.href}
                  initial={{ scale: 0 }}
                  animate={isInView ? { scale: 1 } : {}}
                  transition={{ delay: 0.3 + index * 0.1, duration: 0.4, ease: [0.68, -0.55, 0.265, 1.55] }}
                  whileHover={{ scale: 1.2, y: -3 }}
                  className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-white/60 hover:text-[#d1e29d] hover:bg-[#d1e29d]/10 transition-all duration-300"
                  aria-label={social.label}
                >
                  <social.icon className="w-5 h-5" />
                </motion.a>
              ))}
            </motion.div>
          </div>

          {Object.entries(footerLinks).map(([category, links], categoryIndex) => (
            <motion.div
              key={category}
              initial={{ opacity: 0, y: 30 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: 0.1 + categoryIndex * 0.1 }}
            >
              <h4 className="text-white font-semibold mb-4 capitalize">{category}</h4>
              <ul className="space-y-3">
                {links.map((link) => (
                  <li key={link.label}>
                    <a href={link.href} className="text-white/60 hover:text-[#d1e29d] transition-colors duration-300 relative group">
                      {link.label}
                      <span className="absolute -bottom-0.5 left-0 w-0 h-px bg-[#d1e29d] transition-all duration-300 group-hover:w-full" />
                    </a>
                  </li>
                ))}
              </ul>
            </motion.div>
          ))}
        </div>

        <motion.div initial={{ opacity: 0, y: 40 }} animate={isInView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.6, delay: 0.4 }} className="p-8 rounded-2xl glass-card mb-12">
          <div className="grid md:grid-cols-2 gap-6 items-center">
            <div>
              <h4 className="text-white font-semibold text-lg mb-2">Get Financial Tips</h4>
              <p className="text-white/60">Weekly insights to help you save smarter.</p>
            </div>
            <form onSubmit={handleSubscribe} className="flex gap-3">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                className="flex-1 px-5 py-3 rounded-full bg-white/5 border border-white/10 text-white placeholder:text-white/40 focus:outline-none focus:border-[#d1e29d]/50 transition-colors"
              />
              <motion.button type="submit" whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.98 }} className="px-6 py-3 bg-[#d1e29d] text-black font-semibold rounded-full flex items-center gap-2 hover:shadow-[0_0_20px_rgba(209,226,157,0.3)] transition-all duration-300">
                {isSubscribed ? 'Subscribed!' : 'Subscribe'}
                <Send className="w-4 h-4" />
              </motion.button>
            </form>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0 }} animate={isInView ? { opacity: 1 } : {}} transition={{ duration: 0.4, delay: 0.6 }} className="pt-8 border-t border-white/10 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-white/40 text-sm">© 2025 MoneySmart. All rights reserved.</p>
          <p className="text-white/40 text-sm flex items-center gap-1">Made with <span className="text-[#d1e29d]">💚</span> by the MoneySmart team</p>
        </motion.div>
      </div>
    </footer>
  );
}
