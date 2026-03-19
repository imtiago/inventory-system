import React from "react";

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {}

export const Select: React.FC<SelectProps> = ({ children, ...props }) => (
  <select
    {...props}
    className={`border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-400 ${props.className || ""}`}
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
