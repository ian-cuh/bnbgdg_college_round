import React from 'react';

export function Button({ 
  children, variant = 'primary', className = '', ...props 
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'danger' | 'ghost' }) {
  const baseStyle = "px-5 py-2.5 font-semibold text-sm transition-all duration-150 focus:outline-none rounded cursor-pointer border disabled:cursor-not-allowed inline-flex items-center justify-center gap-2";
  const variants = {
    primary: "bg-white text-black border-transparent hover:bg-gray-200 disabled:bg-gray-800 disabled:text-gray-500 disabled:border-gray-700",
    secondary: "bg-[#10140A] text-white border-gray-700 hover:bg-gray-800 disabled:opacity-40",
    danger: "bg-red-700 text-white border-transparent hover:bg-red-800 disabled:opacity-40",
    ghost: "bg-transparent text-gray-300 border-transparent hover:bg-gray-800 hover:text-white disabled:opacity-40"
  };
  return (
    <button className={`${baseStyle} ${variants[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
}

export function Card({ children, className = '' }: { children: React.ReactNode, className?: string }) {
  return (
    <div className={`bg-[var(--color-surface)] border border-[var(--color-border-subtle)] rounded-sm p-4 ${className}`}>
      {children}
    </div>
  );
}

export function Badge({ 
  children, variant = 'default', className = '' 
}: { children: React.ReactNode, variant?: 'default' | 'success' | 'warning' | 'dispute' | 'verification' | 'role', className?: string }) {
  const variants = {
    default: "bg-[var(--color-border-subtle)] text-gray-300",
    success: "bg-[var(--color-success)] text-[var(--color-success-text)]",
    warning: "bg-[var(--color-warning)] text-[var(--color-warning-text)]",
    dispute: "bg-[var(--color-dispute)] text-[var(--color-dispute-text)]",
    verification: "bg-[var(--color-verification)] text-[var(--color-verification-text)]",
    role: "bg-gray-800 text-gray-200 border border-gray-600"
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-sm text-xs font-semibold ${variants[variant]} ${className}`}>
      {children}
    </span>
  );
}

export function CreditDisplay({ amount, size = 'md', className = '' }: { amount: number, size?: 'sm' | 'md' | 'lg' | 'xl', className?: string }) {
  const sizes = { sm: 'text-sm', md: 'text-base', lg: 'text-xl', xl: 'text-3xl' };
  return (
    <div className={`font-mono font-bold ${sizes[size]} ${className}`}>
      {amount.toLocaleString()} <span className="text-gray-500 font-normal text-[0.8em]">CRD</span>
    </div>
  );
}

export function Label({ children, htmlFor, className = '' }: { children: React.ReactNode, htmlFor?: string, className?: string }) {
  return (
    <label htmlFor={htmlFor} className={`block text-sm font-medium text-gray-300 mb-1 ${className}`}>
      {children}
    </label>
  );
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`w-full ${props.className || ''}`} />;
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`w-full ${props.className || ''}`} />;
}
