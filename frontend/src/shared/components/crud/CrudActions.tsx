import { Link } from "react-router-dom";

import { Pencil, Trash2 } from "lucide-react";

interface Props {
  editPath: string;

  onDelete(): void;
}

export function CrudActions({
  editPath,

  onDelete,
}: Props) {
  return (
    <div
      className="
                flex
                justify-center
                gap-3
            "
    >
      <Link to={editPath} className="text-blue-600">
        <Pencil size={18} />
      </Link>

      <button onClick={onDelete} className="text-red-600">
        <Trash2 size={18} />
      </button>
    </div>
  );
}
