import React from "react";

export const Table = ({ className, ...props }: React.ComponentProps<"table">) => (
  <table className={`min-w-full border-collapse ${className || ""}`} {...props} />
);

export const TableHeader = (props: React.ComponentProps<"thead">) => <thead {...props} />;

export const TableBody = (props: React.ComponentProps<"tbody">) => <tbody {...props} />;

export const TableRow = (props: React.ComponentProps<"tr">) => <tr {...props} />;

export const TableHead = ({ className, ...props }: React.ComponentProps<"th">) => (
  <th className={`border px-4 py-2 text-left font-medium ${className || ""}`} {...props} />
);

export const TableCell = ({ className, ...props }: React.ComponentProps<"td">) => (
  <td className={`border px-4 py-2 ${className || ""}`} {...props} />
);
