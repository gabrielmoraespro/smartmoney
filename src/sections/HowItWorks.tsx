import { useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import { MessageCircle, Send, BarChart3, TrendingUp } from 'lucide-react';

const steps = [
  { number: '01', icon: MessageCircle, title: 'Connect', description: 'Sign up with your WhatsApp. Our AI sends you a welcome message.' },
  { number: '02', icon: Send, title: 'Chat', description: "Simply text your expenses. 'Coffee $5'—that's all it takes." },
  { number: '03', icon: BarChart3, title: 'Track', description: 'Watch your dashboard update in real-time with every transaction.' },
  { number: '04', icon: TrendingUp, title: 'Grow', description: 'Receive AI-powered insights to save more and spend smarter.' },
];

export function HowItWorks() {
  const sectionRef = useRef<HTMLElement>(null);
  const isInView = useInView(sectionRef, { once: true, margin: '-100px' });

  return (
    <section ref={sectionRef} id="how-it-works" className="relative py-32 bg-black overflow-hidden">
      <div 
        className="absolute top-1/2 right-0 w-[500px] h-[500px] -translate-y-1/2 opacity-10"
        style={{ background: 'radial-gradient(circle, rgba(209, 226, 157, 0.15) 0%, transparent 70%)' }}
      />

      <div className="relative z-10 w-[90%] max-w-[1400px] mx-auto">
        <div className="text-center mb-20">
          <motion.p
            initial={{ opacity: 0, x: -30 }}
            animate={isInView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="text-[#d1e29d] text-sm font-medium tracking-wider uppercase mb-4"
          >
            How It Works
          </motion.p>
          <motion.h2
            initial={{ opacity: 0, y: 40 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.7, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
            className="text-4xl md:text-5xl font-medium text-white"
          >
            Four Steps to <span className="text-gradient">Financial Freedom</span>
          </motion.h2>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
          {steps.map((step, index) => (
            <motion.div
              key={step.number}
              initial={{ opacity: 0, y: 60 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.6, delay: 0.4 + index * 0.15, ease: [0.16, 1, 0.3, 1] }}
              className="group relative"
            >
              {index < steps.length - 1 && (
                <div className="hidden lg:block absolute top-12 left-full w-full h-[2px]">
                  <motion.div
                    initial={{ scaleX: 0 }}
                    animate={isInView ? { scaleX: 1 } : {}}
                    transition={{ duration: 0.8, delay: 0.8 + index * 0.2, ease: [0.16, 1, 0.3, 1] }}
                    className="h-full origin-left"
                    style={{ background: 'linear-gradient(90deg, rgba(209, 226, 157, 0.5), rgba(209, 226, 157, 0.1))' }}
                  />
                </div>
              )}

              <div className="relative p-6">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={isInView ? { scale: 1 } : {}}
                  transition={{ delay: 0.6 + index * 0.15, duration: 0.5, ease: [0.68, -0.55, 0.265, 1.55] }}
                  className="relative w-24 h-24 rounded-full bg-[#111] border border-white/10 flex items-center justify-center mb-6 group-hover:border-[#d1e29d]/50 transition-colors duration-300"
                >
                  <span className="text-3xl font-bold text-gradient">{step.number}</span>
                  <div className="absolute inset-0 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500 animate-pulse-glow" />
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, scale: 0 }}
                  animate={isInView ? { opacity: 1, scale: 1 } : {}}
                  transition={{ delay: 0.8 + index * 0.15, duration: 0.5 }}
                  className="absolute top-20 left-20 w-10 h-10 rounded-lg bg-[#d1e29d] flex items-center justify-center shadow-[0_0_20px_rgba(209,226,157,0.3)]"
                >
                  <step.icon className="w-5 h-5 text-black" />
                </motion.div>

                <h3 className="text-xl font-semibold text-white mb-3 mt-4 group-hover:text-[#d1e29d] transition-colors duration-300">{step.title}</h3>
                <p className="text-white/60 leading-relaxed">{step.description}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
