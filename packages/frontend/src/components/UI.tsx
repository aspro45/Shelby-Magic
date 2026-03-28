import React from 'react';

interface CardProps {
  title?: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}

export function Card({ title, description, children, className = '' }: CardProps) {
  return (
    <div
      className={`p-6 bg-dark-light rounded-lg border border-slate-700 hover:border-slate-600 transition ${className}`}
    >
      {title && <h3 className="text-lg font-bold text-white mb-2">{title}</h3>}
      {description && <p className="text-slate-400 text-sm mb-4">{description}</p>}
      {children}
    </div>
  );
}


