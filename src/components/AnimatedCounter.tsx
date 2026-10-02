import { useEffect, useState, useRef } from 'react';

interface AnimatedCounterProps {
  value: number;
  unit?: string;
  decimals?: number;
  className?: string;
}

// Convert English numbers to Persian digits
export const toPersianDigits = (num: string | number): string => {
  const farsiDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  return num
    .toString()
    .replace(/\d/g, (x) => farsiDigits[parseInt(x, 10)]);
};

export default function AnimatedCounter({ value, unit = '', decimals = 1, className = '' }: AnimatedCounterProps) {
  const [displayValue, setDisplayValue] = useState<number>(value);
  const [isAnimating, setIsAnimating] = useState<boolean>(false);
  const prevValueRef = useRef<number>(value);

  useEffect(() => {
    if (prevValueRef.current !== value) {
      setIsAnimating(true);
      const startValue = prevValueRef.current;
      const endValue = value;
      const duration = 600; // ms
      const startTime = performance.now();

      const animate = (currentTime: number) => {
        const elapsedTime = currentTime - startTime;
        const progress = Math.min(elapsedTime / duration, 1);
        
        // Ease out quad formula
        const easedProgress = 1 - Math.pow(1 - progress, 3);
        const currentValue = startValue + (endValue - startValue) * easedProgress;

        setDisplayValue(currentValue);

        if (progress < 1) {
          requestAnimationFrame(animate);
        } else {
          setDisplayValue(endValue);
          prevValueRef.current = endValue;
          setIsAnimating(false);
        }
      };

      requestAnimationFrame(animate);
    }
  }, [value]);

  const formattedStr = toPersianDigits(displayValue.toFixed(decimals));

  return (
    <span className={`inline-flex items-baseline gap-1 font-mono transition-all duration-300 ${isAnimating ? 'opacity-80 scale-105 text-ok' : ''} ${className}`}>
      <span className="inline-block transition-transform duration-200">
        {formattedStr}
      </span>
      {unit && <span className="text-xs font-sans font-semibold opacity-80">{unit}</span>}
    </span>
  );
}
