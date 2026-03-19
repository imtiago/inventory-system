import React from "react";

export const Table: React.FC<{ className?: string }> = ({
  children,
  className,
}) => (
  <table className={`min-w-full border-collapse ${className || ""}`}>
    {children}
  </table>
);

export const TableHeader: React.FC<{ className?: string }> = ({
  children,
  className,
}) => <thead className={className}>{children}</thead>;

export const TableBody: React.FC<{ className?: string }> = ({
  children,
  className,
}) => <tbody className={className}>{children}</tbody>;

export const TableRow: React.FC<{ className?: string }> = ({
  children,
  className,
}) => <tr className={className}>{children}</tr>;

export const TableHead: React.FC<{ className?: string }> = ({
  children,
  className,
}) => (
  <th className={`border px-4 py-2 text-left font-medium ${className || ""}`}>
    {children}
  </th>
);

export const TableCell: React.FC<{ className?: string }> = ({
  children,
  className,
}) => <td className={`border px-4 py-2 ${className || ""}`}>{children}</td>;
