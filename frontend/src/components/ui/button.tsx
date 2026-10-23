import React from "react";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "default" | "outline";
};

const VARIANT_CLASSES = {
  default: "bg-blue-500 text-white hover:bg-blue-600",
  outline: "border border-gray-300 bg-white text-gray-700 hover:bg-gray-50",
} as const;

export const Button: React.FC<ButtonProps> = ({ children, variant = "default", className, ...props }) => {
  return (
    <button
      {...props}
      className={`${VARIANT_CLASSES[variant]} px-4 py-2 rounded transition ${className || ""}`}
    >
      {children}
    </button>
  );
};
