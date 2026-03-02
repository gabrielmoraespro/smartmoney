import { useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import { MessageSquare, Tags, RefreshCw, PieChart, Lock, Target } from 'lucide-react';

const features = [
  { icon: MessageSquare, title: 'AI-Powered Chat', description: 'Natural language processing understands your spending instantly.' },
  { icon: Tags, title: 'Smart Categories', description: 'Automatic categorization that learns your spending patterns.' },
  { icon: RefreshCw, title: 'Real-Time Sync', description: 'Your data updates across all devices in milliseconds.' },
  { icon: PieChart, title: 'Beautiful Reports', description: 'Visual insights that make your finances crystal clear.' },
  { icon: Lock, title: 'Bank-Level Security', description: '256-bit encryption keeps your data safer than banks.' },
  { icon: Target, title: 'Goal Tracking', description: 'Set savings goals and watch your progress daily.' },
];

export function Features() {
  const sectionRef = useRef<HTMLElement>(null);
  const isInView = useInView(sectionRef, { once: true, margin: '-100px' });

  return (
    <section ref={sectionRef} id="features" className="relative py-32 bg-black overflow-hidden">
      <div 
        className="absolute bottom-0 left-0 w-[600px] h-[600px] opacity-10"
        style={{ background: 'radial-gradient(circle, rgba(209, 226, 157, 0.15) 0%, transparent 70%)' }}
      />

      <div className="relative z-10 w-[90%] max-w-[1400px] mx-auto">
        <div className="text-center mb-16">
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.5 }}
            className="text-[#d1e29d] text-sm font-medium tracking-wider uppercase mb-4"
          >
            Features
          </motion.p>
          <motion.h2
            initial={{ opacity: 0, y: 40 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.7, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
            className="text-4xl md:text-5xl font-medium text-white"
          >
            Everything You <span className="text-gradient">Need</span>
          </motion.h2>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 60, scale: 0.8 }}
              animate={isInView ? { opacity: 1, y: 0, scale: 1 } : {}}
              transition={{ duration: 0.6, delay: 0.3 + index * 0.1, ease: [0.68, -0.55, 0.265, 1.55] }}
              whileHover={{ y: -8, transition: { duration: 0.3 } }}
              className="group"
            >
              <div className="relative p-8 rounded-2xl glass-card h-full overflow-hidden transition-all duration-500 group-hover:shadow-[0_0_30px_rgba(209,226,157,0.2)]">
                <motion.div
                  initial={{ opacity: 0, rotate: -180, scale: 0 }}
                  animate={isInView ? { opacity: 1, rotate: 0, scale: 1 } : {}}
                  transition={{ delay: 0.4 + index * 0.1, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                  className="relative w-12 h-12 rounded-xl bg-[#d1e29d]/10 flex items-center justify-center mb-5 group-hover:bg-[#d1e29d]/20 transition-colors duration-300"
                >
                  <feature.icon className="w-6 h-6 text-[#d1e29d] group-hover:scale-110 group-hover:rotate-[10deg] transition-all duration-300" />
                </motion.div>

                <h3 className="relative text-lg font-semibold text-white mb-3 group-hover:text-[#d1e29d] transition-colors duration-300">{feature.title}</h3>
                <p className="relative text-white/60 leading-relaxed">{feature.description}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
