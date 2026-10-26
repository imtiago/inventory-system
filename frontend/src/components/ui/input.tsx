import React from "react";

type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

export const Input: React.FC<InputProps> = (props) => {
  return (
    <input
      {...props}
      className={`rounded-lg border border-input bg-surface px-2 py-1 text-foreground focus:outline-none focus:ring-2 focus:ring-ring ${props.className || ""}`}
    />
  );
};
