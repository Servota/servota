import * as React from 'react';

export const Button: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement>> = ({
  children,
  ...props
}) => {
  return (
    <button
      style={{
        padding: '10px 14px',
        borderRadius: 10,
        border: 'none',
        fontWeight: 600,
        cursor: 'pointer',
      }}
      {...props}
    >
      {children}
    </button>
  );
};
