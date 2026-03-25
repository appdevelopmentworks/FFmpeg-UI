'use client';

import { motion } from 'framer-motion';

export interface CardProps {
  children:   React.ReactNode;
  className?: string;
  style?:     React.CSSProperties;
  hover?:     boolean;
  padding?:   'none' | 'sm' | 'md' | 'lg';
  as?:        'div' | 'section' | 'article';
}

const PADDING = {
  none: '',
  sm:   'p-3',
  md:   'p-4',
  lg:   'p-5',
};

export function Card({
  children,
  className = '',
  style,
  hover = false,
  padding = 'md',
  as: Tag = 'div',
}: CardProps) {
  const baseStyle: React.CSSProperties = {
    backgroundColor: 'var(--bg-secondary)',
    border: '0.5px solid var(--border-default)',
    boxShadow: 'var(--shadow-sm)',
    ...style,
  };

  if (hover) {
    return (
      <motion.div
        className={`rounded-xl ${PADDING[padding]} ${className}`}
        style={baseStyle}
        whileHover={{
          borderColor: 'var(--border-hover)',
          boxShadow: 'var(--shadow-md)',
        }}
        transition={{ duration: 0.15 }}
      >
        {children}
      </motion.div>
    );
  }

  return (
    <Tag
      className={`rounded-xl ${PADDING[padding]} ${className}`}
      style={baseStyle}
    >
      {children}
    </Tag>
  );
}
