import { useState, useEffect } from 'react';
import { Sparkles, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

const quotes = [
  {
    text: "O sucesso não é a chave para a felicidade. A felicidade é a chave para o sucesso.",
    author: "Albert Schweitzer"
  },
  {
    text: "Trabalho em equipe é a capacidade de trabalhar juntos em direção a uma visão comum.",
    author: "Andrew Carnegie"
  },
  {
    text: "A única forma de fazer um excelente trabalho é amar o que você faz.",
    author: "Steve Jobs"
  },
  {
    text: "O talento vence jogos, mas só o trabalho em equipe ganha campeonatos.",
    author: "Michael Jordan"
  },
  {
    text: "Grandes realizações são possíveis quando se dá importância aos pequenos começos.",
    author: "Lao Tzu"
  },
  {
    text: "Liderar é criar um mundo ao qual as pessoas queiram pertencer.",
    author: "Gilles Pajou"
  },
  {
    text: "O crescimento pessoal é a base de todo o progresso profissional.",
    author: "Brian Tracy"
  },
  {
    text: "Invista nas pessoas primeiro, e os resultados virão naturalmente.",
    author: "Simon Sinek"
  },
];

export function MotivationalQuote() {
  const [currentQuote, setCurrentQuote] = useState(quotes[0]);
  const [isAnimating, setIsAnimating] = useState(false);

  const getRandomQuote = () => {
    setIsAnimating(true);
    setTimeout(() => {
      const randomIndex = Math.floor(Math.random() * quotes.length);
      setCurrentQuote(quotes[randomIndex]);
      setIsAnimating(false);
    }, 300);
  };

  useEffect(() => {
    const randomIndex = Math.floor(Math.random() * quotes.length);
    setCurrentQuote(quotes[randomIndex]);
  }, []);

  return (
    <div className="card-elevated p-6 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-0 right-0 w-32 h-32 gradient-hero opacity-5 rounded-full blur-3xl" />
      
      <div className="relative">
        <div className="flex items-center gap-2 mb-4">
          <div className="p-2 rounded-lg bg-primary/10">
            <Sparkles className="w-5 h-5 text-primary" />
          </div>
          <h3 className="font-display font-semibold text-foreground">
            Inspiração do Dia
          </h3>
        </div>

        <div className={`transition-all duration-300 ${isAnimating ? 'opacity-0 transform translate-y-2' : 'opacity-100 transform translate-y-0'}`}>
          <blockquote className="text-lg text-foreground/90 italic mb-3 leading-relaxed">
            "{currentQuote.text}"
          </blockquote>
          <p className="text-sm text-muted-foreground font-medium">
            — {currentQuote.author}
          </p>
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={getRandomQuote}
          className="mt-4 text-muted-foreground hover:text-primary"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Nova frase
        </Button>
      </div>
    </div>
  );
}
