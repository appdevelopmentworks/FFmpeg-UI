'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

type TooltipSide = 'top' | 'bottom' | 'left' | 'right';

export interface TooltipProps {
  content:    React.ReactNode;
  children:   React.ReactElement;
  side?:      TooltipSide;
  delay?:     number;
  disabled?:  boolean;
}

const OFFSET = 8;

const ORIGIN: Record<TooltipSide, { x: number; y: number }> = {
  top:    { x: 0,  y: 4 },
  bottom: { x: 0,  y: -4 },
  left:   { x: 4,  y: 0 },
  right:  { x: -4, y: 0 },
};

export function Tooltip({ content, children, side = 'top', delay = 400, disabled = false }: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = () => {
    if (disabled) return;
    timerRef.current = setTimeout(() => setVisible(true), delay);
  };

  const hide = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setVisible(false);
  };

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  const origin = ORIGIN[side];
  const posClass: Record<TooltipSide, string> = {
    top:    `bottom-full left-1/2 -translate-x-1/2 mb-${OFFSET/4}`,
    bottom: `top-full left-1/2 -translate-x-1/2 mt-${OFFSET/4}`,
    left:   `right-full top-1/2 -translate-y-1/2 mr-${OFFSET/4}`,
    right:  `left-full top-1/2 -translate-y-1/2 ml-${OFFSET/4}`,
  };

  return (
    <span
      className="relative inline-flex"
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      {children}

      <AnimatePresence>
        {visible && (
          <motion.div
            role="tooltip"
            className={`absolute z-50 whitespace-nowrap pointer-events-none ${posClass[side]}`}
            style={{
              marginBottom: side === 'top'    ? OFFSET : undefined,
              marginTop:    side === 'bottom' ? OFFSET : undefined,
              marginRight:  side === 'left'   ? OFFSET : undefined,
              marginLeft:   side === 'right'  ? OFFSET : undefined,
            }}
            initial={{ opacity: 0, x: origin.x, y: origin.y }}
            animate={{ opacity: 1, x: 0,        y: 0        }}
            exit={{    opacity: 0, x: origin.x, y: origin.y }}
            transition={{ duration: 0.12 }}
          >
            <div
              className="px-2 py-1 rounded text-xs font-medium"
              style={{
                backgroundColor: 'var(--bg-tertiary)',
                color: 'var(--text-primary)',
                border: '0.5px solid var(--border-default)',
                boxShadow: 'var(--shadow-md)',
              }}
            >
              {content}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </span>
  );
}
