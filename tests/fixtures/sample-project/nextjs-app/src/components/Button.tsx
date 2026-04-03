'use client';

import { forwardRef } from 'react';

interface ButtonProps {
  label: string;
  onClick?: () => void;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(({ label, onClick }, ref) => {
  return (
    <button ref={ref} onClick={onClick}>
      {label}
    </button>
  );
});

Button.displayName = 'Button';
