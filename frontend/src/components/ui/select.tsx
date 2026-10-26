import React from "react";

type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement>;

export const Select: React.FC<SelectProps> = ({ children, ...props }) => (
  <select
    {...props}
    className={`rounded border border-input bg-surface px-2 py-1 text-foreground focus:outline-none focus:ring-2 focus:ring-ring ${props.className || ""}`}
  >
    {children}
  </select>
);

export const SelectTrigger: React.FC<{
  children: React.ReactNode;
  className?: string;
}> = ({ children, className }) => <div className={className}>{children}</div>;

export const SelectValue: React.FC<{
  children: React.ReactNode;
  className?: string;
}> = ({ children, className }) => <span className={className}>{children}</span>;

export const SelectContent: React.FC<{
  children: React.ReactNode;
  className?: string;
}> = ({ children, className }) => <div className={className}>{children}</div>;

export const SelectItem: React.FC<{
  children: React.ReactNode;
  value: string;
}> = ({ children, value }) => <option value={value}>{children}</option>;
