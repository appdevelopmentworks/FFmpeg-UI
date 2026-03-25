'use client';

import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { backdropVariants, modalVariants } from '@/lib/animations';

export interface ModalProps {
  open:        boolean;
  onClose:     () => void;
  title?:      string;
  children:    React.ReactNode;
  footer?:     React.ReactNode;
  width?:      number | string;
  closable?:   boolean;
}

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  width = 520,
  closable = true,
}: ModalProps) {
  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && closable) onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, closable, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            className="fixed inset-0 z-40"
            style={{ backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
            variants={backdropVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            onClick={closable ? onClose : undefined}
          />

          {/* Panel */}
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
            <motion.div
              key="modal"
              className="relative w-full pointer-events-auto rounded-xl overflow-hidden"
              style={{
                maxWidth: typeof width === 'number' ? width : width,
                backgroundColor: 'var(--bg-secondary)',
                border: '0.5px solid var(--border-default)',
                boxShadow: 'var(--shadow-lg)',
              }}
              variants={modalVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              {(title || closable) && (
                <div
                  className="flex items-center justify-between px-5 py-4"
                  style={{ borderBottom: '0.5px solid var(--border-default)' }}
                >
                  {title && (
                    <h2
                      className="text-sm font-semibold"
                      style={{ color: 'var(--text-primary)' }}
                    >
                      {title}
                    </h2>
                  )}
                  {closable && (
                    <button
                      onClick={onClose}
                      className="flex items-center justify-center w-7 h-7 rounded-md transition-colors ml-auto"
                      style={{ color: 'var(--text-tertiary)' }}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--bg-tertiary)';
                        (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)';
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
                        (e.currentTarget as HTMLElement).style.color = 'var(--text-tertiary)';
                      }}
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              )}

              {/* Body */}
              <div className="px-5 py-4">{children}</div>

              {/* Footer */}
              {footer && (
                <div
                  className="flex items-center justify-end gap-2 px-5 py-3"
                  style={{ borderTop: '0.5px solid var(--border-default)' }}
                >
                  {footer}
                </div>
              )}
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
