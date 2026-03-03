import { useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, useScroll, useTransform } from 'framer-motion';
import { ArrowRight, Play, CreditCard, TrendingUp, Wallet } from 'lucide-react';

export function Hero() {
  const sectionRef = useRef<HTMLElement>(null);
  const navigate = useNavigate();
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ['start start', 'end start'],
  });

  const headlineY = useTransform(scrollYProgress, [0, 0.5], [0, -80]);
  const headlineOpacity = useTransform(scrollYProgress, [0, 0.3], [1, 0]);

  return (
    <section
      ref={sectionRef}
      className="relative min-h-screen flex items-center overflow-hidden bg-black"
    >
      {/* Background */}
      <div className="absolute inset-0 z-0">
        <div className="absolute inset-0 bg-gradient-to-br from-black via-black to-[#111]" />
        <div 
          className="absolute top-1/4 right-1/4 w-[600px] h-[600px] rounded-full opacity-20"
          style={{ background: 'radial-gradient(circle, rgba(209, 226, 157, 0.15) 0%, transparent 70%)' }}
        />
      </div>

      {/* Content */}
      <div className="relative z-10 w-[90%] max-w-[1400px] mx-auto pt-32 pb-20">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left Content */}
          <div className="space-y-8">
            <motion.div style={{ y: headlineY, opacity: headlineOpacity }} className="space-y-2">
              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.2 }}
                className="text-[#d1e29d] text-sm font-medium tracking-wider uppercase"
              >
                SmartMoney
              </motion.p>
              <motion.h1
                initial={{ opacity: 0, y: 80 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
                className="text-5xl md:text-6xl lg:text-7xl font-medium text-white leading-[1.1]"
              >
                Controle financeiro
                <span className="text-gradient">inteligente.</span>
              </motion.h1>
            </motion.div>

            <motion.p
              initial={{ opacity: 0, filter: 'blur(10px)' }}
              animate={{ opacity: 1, filter: 'blur(0px)' }}
              transition={{ duration: 0.7, delay: 0.9 }}
              className="text-lg md:text-xl text-white/70 max-w-md"
            >
              Conecte seus bancos, acompanhe entradas e saídas em tempo real e tenha clareza total das suas finanças.
            </motion.p>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.1 }}
              className="flex flex-wrap gap-4"
            >
              <motion.button
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 1.1, duration: 0.6, ease: [0.68, -0.55, 0.265, 1.55] }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => navigate('/cadastro')}
                className="group px-8 py-4 bg-[#d1e29d] text-black font-semibold rounded-full flex items-center gap-2 hover:shadow-[0_0_40px_rgba(209,226,157,0.4)] transition-all duration-300"
              >
                Começar grátis
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </motion.button>
              <motion.button
                initial={{ opacity: 0, x: -30 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 1.2, duration: 0.5 }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.98 }}
                className="px-8 py-4 border border-white/20 text-white font-semibold rounded-full flex items-center gap-2 hover:bg-white/5 transition-all duration-300"
              >
                <Play className="w-5 h-5" />
                Ver demonstração
              </motion.button>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.4, duration: 0.5 }}
              className="flex items-center gap-4 pt-4"
            >
              <div className="flex -space-x-3">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="w-10 h-10 rounded-full border-2 border-black bg-gradient-to-br from-[#d1e29d] to-[#a8c76f] flex items-center justify-center">
                    <span className="text-black text-xs font-bold">U{i}</span>
                  </div>
                ))}
              </div>
              <p className="text-white/60 text-sm">
                <span className="text-white font-semibold">50,000+</span> users saving{' '}
                <span className="text-[#d1e29d] font-semibold">$2M+</span> this month
              </p>
            </motion.div>
          </div>

          {/* Right Content - App Preview */}
          <motion.div
            initial={{ opacity: 0, y: 100 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="relative flex justify-center lg:justify-end"
          >
            <div 
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] rounded-full animate-pulse-glow"
              style={{ background: 'radial-gradient(circle, rgba(209, 226, 157, 0.2) 0%, transparent 70%)' }}
            />
            
            <motion.div
              animate={{ y: [0, -10, 0] }}
              transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
              className="relative z-10"
            >
              <div className="w-full max-w-[350px] bg-[#111] rounded-3xl p-6 border border-white/10 shadow-2xl">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <p className="text-white/60 text-sm">Welcome back,</p>
                    <p className="text-white font-semibold text-lg">Alex</p>
                  </div>
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#d1e29d] to-[#a8c76f]" />
                </div>
                
                <div className="bg-gradient-to-br from-[#1a1a1a] to-[#222] rounded-2xl p-5 mb-6">
                  <div className="flex items-center justify-between mb-4">
                    <CreditCard className="w-8 h-8 text-[#d1e29d]" />
                    <span className="text-white/60 text-sm">Visa</span>
                  </div>
                  <p className="text-white/60 text-sm mb-1">Balance</p>
                  <p className="text-white text-3xl font-bold">$24,500.80</p>
                  <p className="text-white/40 text-sm mt-2">4852 •••• •••• 3829</p>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-[#d1e29d]/20 flex items-center justify-center">
                        <TrendingUp className="w-5 h-5 text-[#d1e29d]" />
                      </div>
                      <div>
                        <p className="text-white text-sm">Freelance Payment</p>
                        <p className="text-white/40 text-xs">Today</p>
                      </div>
                    </div>
                    <span className="text-[#d1e29d] font-semibold">+$1,200</span>
                  </div>
                  
                  <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center">
                        <Wallet className="w-5 h-5 text-red-400" />
                      </div>
                      <div>
                        <p className="text-white text-sm">Coffee Shop</p>
                        <p className="text-white/40 text-xs">Today</p>
                      </div>
                    </div>
                    <span className="text-red-400 font-semibold">-$5.50</span>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
