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
      <Link to={editPath} className="inline-flex h-11 w-11 items-center justify-center text-blue-600" aria-label="Editar">
        <Pencil size={18} />
      </Link>

      <button onClick={onDelete} className="inline-flex h-11 w-11 items-center justify-center text-red-600" aria-label="Excluir">
        <Trash2 size={18} />
      </button>
    </div>
  );
}
