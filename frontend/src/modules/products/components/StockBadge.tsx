// src/modules/products/components/StockBadge.tsx

import React from "react";

interface StockBadgeProps {
  quantity: number;
}

const StockBadge: React.FC<StockBadgeProps> = ({ quantity }) => {
  let color = "green";
  if (quantity <= 5) color = "red";
  else if (quantity <= 15) color = "orange";

  return <span style={{ color, fontWeight: 600 }}>{quantity}</span>;
};

export default StockBadge;
