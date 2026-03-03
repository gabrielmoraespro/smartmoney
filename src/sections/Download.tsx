import { useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, useInView } from 'framer-motion';
import { Monitor, CreditCard, TrendingUp, Wallet } from 'lucide-react';

export function Download() {
  const sectionRef = useRef<HTMLElement>(null);
  const isInView = useInView(sectionRef, { once: true, margin: '-100px' });
  const navigate = useNavigate();

  return (
    <section ref={sectionRef} id="download" className="relative py-32 bg-black overflow-hidden">
      <div
        className="absolute inset-0 opacity-20"
        style={{ background: 'radial-gradient(ellipse at center, rgba(209, 226, 157, 0.15) 0%, transparent 60%)' }}
      />

      <div className="relative z-10 w-[90%] max-w-[1400px] mx-auto">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <div className="space-y-8">
            <motion.h2
              initial={{ opacity: 0 }}
              animate={isInView ? { opacity: 1 } : {}}
              transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
              className="text-4xl md:text-5xl lg:text-6xl font-medium text-white leading-tight"
            >
              SmartMoney para{' '}<span className="text-gradient">Desktop</span>
            </motion.h2>

            <motion.p
              initial={{ opacity: 0, filter: 'blur(10px)' }}
              animate={isInView ? { opacity: 1, filter: 'blur(0px)' } : {}}
              transition={{ duration: 0.6, delay: 0.4 }}
              className="text-lg text-white/70 max-w-md"
            >
              Plataforma web focada em produtividade no desktop: conexão bancária, dashboard em tempo real e visão financeira completa.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: 0.6, ease: [0.16, 1, 0.3, 1] }}
            >
              <motion.button
                whileHover={{ scale: 1.03, y: -2 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => navigate('/cadastro')}
                className="group flex items-center gap-3 px-7 py-4 bg-[#d1e29d] text-black rounded-xl hover:shadow-[0_0_30px_rgba(209,226,157,0.3)] transition-all duration-300 font-semibold"
              >
                <Monitor className="w-6 h-6" />
                Acessar versão Desktop
              </motion.button>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: 0.8 }}
              className="flex gap-8 pt-4"
            >
              <div><p className="text-3xl font-bold text-gradient">50K+</p><p className="text-white/60 text-sm">Usuários ativos</p></div>
              <div><p className="text-3xl font-bold text-gradient">R$2M+</p><p className="text-white/60 text-sm">Movimentados/mês</p></div>
              <div><p className="text-3xl font-bold text-gradient">24/7</p><p className="text-white/60 text-sm">Disponível no navegador</p></div>
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 80 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 1, delay: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="relative flex justify-center"
          >
            <div
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full animate-pulse-glow"
              style={{ background: 'radial-gradient(circle, rgba(209, 226, 157, 0.2) 0%, transparent 70%)' }}
            />
            <motion.div animate={{ y: [0, -10, 0] }} transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }} className="relative">
              <div className="w-full max-w-[320px] bg-[#111] rounded-3xl p-6 border border-white/10 shadow-2xl">
                <div className="flex items-center justify-between mb-6">
                  <div><p className="text-white/60 text-sm">Desktop Session</p><p className="text-white font-semibold text-lg">Painel SmartMoney</p></div>
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#d1e29d] to-[#a8c76f]" />
                </div>
                <div className="bg-gradient-to-br from-[#1a1a1a] to-[#222] rounded-2xl p-5 mb-6">
                  <div className="flex items-center justify-between mb-4">
                    <CreditCard className="w-8 h-8 text-[#d1e29d]" />
                    <span className="text-white/60 text-sm">Conta principal</span>
                  </div>
                  <p className="text-white/60 text-sm mb-1">Saldo consolidado</p>
                  <p className="text-white text-3xl font-bold">R$24.500,80</p>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-[#d1e29d]/20 flex items-center justify-center">
                        <TrendingUp className="w-5 h-5 text-[#d1e29d]" />
                      </div>
                      <div><p className="text-white text-sm">Receita</p><p className="text-white/40 text-xs">Hoje</p></div>
                    </div>
                    <span className="text-[#d1e29d] font-semibold">+R$1.200</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center">
                        <Wallet className="w-5 h-5 text-red-400" />
                      </div>
                      <div><p className="text-white text-sm">Despesa</p><p className="text-white/40 text-xs">Hoje</p></div>
                    </div>
                    <span className="text-red-400 font-semibold">-R$55,00</span>
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
