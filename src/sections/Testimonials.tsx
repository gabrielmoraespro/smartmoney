import { useRef, useState, useEffect } from 'react';
import { motion, useInView } from 'framer-motion';
import { Quote, ChevronLeft, ChevronRight } from 'lucide-react';

const testimonials = [
  { name: 'Sarah Mitchell', role: 'Product Designer', quote: "I've tried every finance app out there. MoneySmart is the only one that stuck. The AI feels like having a personal accountant in my pocket." },
  { name: 'James Chen', role: 'Software Engineer', quote: "The WhatsApp integration is genius. I just text my expenses and forget about them. The insights have helped me save $300/month." },
  { name: 'Emma Rodriguez', role: 'Marketing Manager', quote: "Finally, an app that understands natural language. No more complicated forms—just chat and go. My finances have never been clearer." },
  { name: 'Michael Park', role: 'Entrepreneur', quote: "MoneySmart's AI caught subscriptions I forgot about and helped me cancel them. Saved me $200 in the first week alone." },
  { name: 'Lisa Thompson', role: 'Teacher', quote: "As someone who hates budgeting, this app is a lifesaver. It's like having a financial coach who never judges." },
];

export function Testimonials() {
  const sectionRef = useRef<HTMLElement>(null);
  const isInView = useInView(sectionRef, { once: true, margin: '-100px' });
  const [activeIndex, setActiveIndex] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);

  useEffect(() => {
    if (!isAutoPlaying) return;
    const interval = setInterval(() => setActiveIndex((prev) => (prev + 1) % testimonials.length), 5000);
    return () => clearInterval(interval);
  }, [isAutoPlaying]);

  const goToPrev = () => { setIsAutoPlaying(false); setActiveIndex((prev) => (prev - 1 + testimonials.length) % testimonials.length); };
  const goToNext = () => { setIsAutoPlaying(false); setActiveIndex((prev) => (prev + 1) % testimonials.length); };

  return (
    <section ref={sectionRef} id="testimonials" className="relative py-32 bg-black overflow-hidden">
      <div 
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] opacity-10"
        style={{ background: 'radial-gradient(circle, rgba(209, 226, 157, 0.15) 0%, transparent 70%)' }}
      />

      <div className="relative z-10 w-[90%] max-w-[1400px] mx-auto">
        <div className="text-center mb-16">
          <motion.p initial={{ opacity: 0, y: 20 }} animate={isInView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.5 }} className="text-[#d1e29d] text-sm font-medium tracking-wider uppercase mb-4">
            Testimonials
          </motion.p>
          <motion.h2 initial={{ opacity: 0, y: 40 }} animate={isInView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.7, delay: 0.15, ease: [0.16, 1, 0.3, 1] }} className="text-4xl md:text-5xl font-medium text-white">
            Loved by <span className="text-gradient">Thousands</span>
          </motion.h2>
        </div>

        <motion.div initial={{ opacity: 0, x: 200 }} animate={isInView ? { opacity: 1, x: 0 } : {}} transition={{ duration: 0.8, delay: 0.3, ease: [0.16, 1, 0.3, 1] }} className="relative">
          <div className="relative max-w-4xl mx-auto">
            <div className="relative p-8 md:p-12 rounded-3xl glass-card overflow-hidden">
              <motion.div animate={{ opacity: [0.3, 0.5, 0.3] }} transition={{ duration: 4, repeat: Infinity }} className="absolute top-8 left-8">
                <Quote className="w-12 h-12 text-[#d1e29d]/30" />
              </motion.div>

              <div className="relative pt-8">
                {testimonials.map((testimonial, index) => (
                  <motion.div
                    key={testimonial.name}
                    initial={false}
                    animate={{ opacity: index === activeIndex ? 1 : 0, y: index === activeIndex ? 0 : 20, display: index === activeIndex ? 'block' : 'none' }}
                    transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                    className="text-center"
                  >
                    <p className="text-xl md:text-2xl text-white/90 leading-relaxed mb-8">"{testimonial.quote}"</p>
                    <div className="flex items-center justify-center gap-4">
                      <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#d1e29d] to-[#a8c76f] flex items-center justify-center">
                        <span className="text-black font-bold">{testimonial.name.charAt(0)}</span>
                      </div>
                      <div className="text-left">
                        <p className="text-white font-semibold">{testimonial.name}</p>
                        <p className="text-white/60 text-sm">{testimonial.role}</p>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-center gap-4 mt-8">
              <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }} onClick={goToPrev} className="w-12 h-12 rounded-full border border-white/20 flex items-center justify-center text-white hover:bg-white/5 transition-colors">
                <ChevronLeft className="w-5 h-5" />
              </motion.button>
              <div className="flex gap-2">
                {testimonials.map((_, index) => (
                  <button key={index} onClick={() => { setIsAutoPlaying(false); setActiveIndex(index); }} className={`w-2 h-2 rounded-full transition-all duration-300 ${index === activeIndex ? 'w-8 bg-[#d1e29d]' : 'bg-white/30 hover:bg-white/50'}`} />
                ))}
              </div>
              <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }} onClick={goToNext} className="w-12 h-12 rounded-full border border-white/20 flex items-center justify-center text-white hover:bg-white/5 transition-colors">
                <ChevronRight className="w-5 h-5" />
              </motion.button>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
