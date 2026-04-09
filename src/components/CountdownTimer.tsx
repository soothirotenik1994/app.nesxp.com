import React, { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';
import { clsx } from 'clsx';

interface CountdownTimerProps {
  deadline: string;
  onOverdue?: () => void;
  className?: string;
  compact?: boolean;
}

export const CountdownTimer: React.FC<CountdownTimerProps> = ({ deadline, onOverdue, className, compact = false }) => {
  const [timeLeft, setTimeLeft] = useState<string>('');
  const [isOverdue, setIsOverdue] = useState<boolean>(false);

  useEffect(() => {
    const calculateTimeLeft = () => {
      const now = new Date().getTime();
      const target = new Date(deadline).getTime();
      const difference = target - now;

      if (difference <= 0) {
        setTimeLeft('00:00:00');
        if (!isOverdue) {
          setIsOverdue(true);
          if (onOverdue) onOverdue();
        }
        return;
      }

      const hours = Math.floor((difference / (1000 * 60 * 60)));
      const minutes = Math.floor((difference / 1000 / 60) % 60);
      const seconds = Math.floor((difference / 1000) % 60);

      setTimeLeft(`${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
      setIsOverdue(false);
    };

    calculateTimeLeft();
    const timer = setInterval(calculateTimeLeft, 1000);
    return () => clearInterval(timer);
  }, [deadline, isOverdue, onOverdue]);

  if (compact) {
    return (
      <div className={clsx(
        "flex items-center gap-1.5 px-2 py-1 rounded-md font-mono font-bold text-[10px] shadow-sm",
        isOverdue ? "bg-red-50 border border-red-200 text-red-600" : "bg-amber-50 border border-amber-200 text-amber-600 animate-pulse",
        className
      )}>
        <Clock className="w-3 h-3" />
        <span>{timeLeft}</span>
      </div>
    );
  }

  return (
    <div className={clsx(
      "flex items-center gap-3 px-6 py-3 rounded-2xl border font-mono font-bold text-lg shadow-sm",
      isOverdue ? "bg-red-50 border-red-200 text-red-600" : "bg-amber-50 border-amber-200 text-amber-600 animate-pulse",
      className
    )}>
      <Clock className="w-5 h-5" />
      <div className="flex flex-col">
        <span className="text-[10px] uppercase tracking-wider opacity-80 leading-none mb-1">
          {isOverdue ? 'หมดเวลา' : 'เวลาที่เหลือ'}
        </span>
        <span className="leading-none">{timeLeft}</span>
      </div>
    </div>
  );
};
