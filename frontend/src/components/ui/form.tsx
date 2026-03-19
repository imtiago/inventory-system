import React from "react";

export const Form: React.FC<React.FormHTMLAttributes<HTMLFormElement>> = ({
  children,
  ...props
}) => (
  <form {...props} className={`space-y-4 ${props.className || ""}`}>
    {children}
  </form>
);

export const FormField: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => <div>{children}</div>;
export const FormItem: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => <div>{children}</div>;
export const FormLabel: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => <label className="block text-gray-700 font-medium">{children}</label>;
export const FormControl: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => <div>{children}</div>;
export const FormMessage: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => <p className="text-red-500 text-sm">{children}</p>;
