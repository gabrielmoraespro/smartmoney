import { useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import { Zap, TrendingUp, Shield } from 'lucide-react';

const features = [
  {
    icon: Zap,
    title: 'Effortless Tracking',
    description: "Just chat with our AI. Tell it 'I spent $50 on groceries' and it's logged instantly.",
  },
  {
    icon: TrendingUp,
    title: 'Smart Insights',
    description: 'Get personalized recommendations that actually help you spend less and save more.',
  },
  {
    icon: Shield,
    title: 'Total Control',
    description: 'See exactly where your money goes with beautiful visualizations and clear categories.',
  },
];

export function About() {
  const sectionRef = useRef<HTMLElement>(null);
  const isInView = useInView(sectionRef, { once: true, margin: '-100px' });

  return (
    <section ref={sectionRef} className="relative py-32 bg-black overflow-hidden">
      <div 
        className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] opacity-10"
        style={{ background: 'radial-gradient(ellipse, rgba(209, 226, 157, 0.2) 0%, transparent 70%)' }}
      />

      <div className="relative z-10 w-[90%] max-w-[1400px] mx-auto">
        <div className="text-center mb-20">
          <motion.p
            initial={{ opacity: 0 }}
            animate={isInView ? { opacity: 1 } : {}}
            transition={{ duration: 0.6 }}
            className="text-[#d1e29d] text-sm font-medium tracking-wider uppercase mb-4"
          >
            About The App
          </motion.p>
          <motion.h2
            initial={{ opacity: 0, y: 60 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.7, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="text-4xl md:text-5xl font-medium text-white mb-6"
          >
            Finance, <span className="text-gradient">Simplified</span>
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, filter: 'blur(8px)' }}
            animate={isInView ? { opacity: 1, filter: 'blur(0px)' } : {}}
            transition={{ duration: 0.6, delay: 0.5 }}
            className="text-white/60 text-lg max-w-2xl mx-auto"
          >
            MoneySmart uses intelligent AI to track your spending, predict your future, 
            and help you save—automatically.
          </motion.p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 60 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.6, delay: 0.7 + index * 0.15, ease: [0.16, 1, 0.3, 1] }}
              whileHover={{ y: -10, transition: { duration: 0.3 } }}
              className="group"
            >
              <div className="relative p-8 rounded-2xl glass-card h-full overflow-hidden transition-all duration-500 group-hover:border-[#d1e29d]/30">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={isInView ? { scale: 1 } : {}}
                  transition={{ delay: 0.9 + index * 0.15, duration: 0.5, ease: [0.68, -0.55, 0.265, 1.55] }}
                  className="relative w-14 h-14 rounded-xl bg-[#d1e29d]/10 flex items-center justify-center mb-6 group-hover:bg-[#d1e29d]/20 transition-colors duration-300"
                >
                  <feature.icon className="w-7 h-7 text-[#d1e29d] group-hover:rotate-[360deg] transition-transform duration-700" />
                </motion.div>

                <h3 className="relative text-xl font-semibold text-white mb-3">{feature.title}</h3>
                <p className="relative text-white/60 leading-relaxed">{feature.description}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
