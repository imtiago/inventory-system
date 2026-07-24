import { useNavigate, useParams } from "react-router-dom";

import { VariantForm, type VariantFormData } from "../components/VariantForm";

import { useCreateVariant } from "../hooks/useCreateVariant";

export function VariantCreatePage() {
  const { id } = useParams();

  const navigate = useNavigate();

  const createVariant = useCreateVariant(id!);

  async function handleSubmit(data: VariantFormData) {
    await createVariant.mutateAsync(data);

    navigate(`/products/${id}`);
  }

  return (
    <div
      className="
        max-w-4xl
        mx-auto
      "
    >
      <VariantForm
        onSubmit={handleSubmit}
        onCancel={() => navigate(`/products/${id}`)}
      />
    </div>
  );
}
