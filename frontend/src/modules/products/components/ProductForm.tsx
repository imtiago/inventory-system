import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

import { useCreateProduct } from "../hooks/useCreateProduct";
import { useUpdateProduct } from "../hooks/useUpdateProduct";

import { useBrands } from "@/modules/brands/hooks/useBrands";
import { useCategories } from "@/modules/categories/hooks/useCategories";

import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";

// UI
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

const schema = z.object({
  name: z.string().min(1, "Nome obrigatório"),
  sku: z.string().min(1, "SKU obrigatório"),
  brandId: z.string().optional(),
  categoryId: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

type Props = {
  defaultValues?: FormData;
  productId?: string;
};

export function ProductForm({ defaultValues, productId }: Props) {
  const { data: brands } = useBrands();
  const { data: categories } = useCategories();

  const { mutate: create } = useCreateProduct();
  const { mutate: update } = useUpdateProduct();

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues,
  });

  const onSubmit = (data: FormData) => {
    if (productId) {
      update({ id: productId, data });
    } else {
      create(data);
    }
  };

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="space-y-6 max-w-md"
      >
        {/* Nome */}
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nome</FormLabel>
              <FormControl>
                <Input placeholder="Ex: Perfume Kaiak" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* SKU */}
        <FormField
          control={form.control}
          name="sku"
          render={({ field }) => (
            <FormItem>
              <FormLabel>SKU</FormLabel>
              <FormControl>
                <Input placeholder="Ex: KAI-100" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Marca */}
        <FormField
          control={form.control}
          name="brandId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Marca</FormLabel>

              <Select value={field.value ?? ""} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a marca" />
                  </SelectTrigger>
                </FormControl>

                <SelectContent>
                  {!brands && (
                    <SelectItem value="loading" disabled>
                      Carregando...
                    </SelectItem>
                  )}

                  {brands?.length === 0 && (
                    <SelectItem value="empty" disabled>
                      Nenhuma marca cadastrada
                    </SelectItem>
                  )}

                  {brands?.map((b: any) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <FormMessage />
            </FormItem>
          )}
        />

        {/* Categoria */}
        <FormField
          control={form.control}
          name="categoryId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Categoria</FormLabel>

              <Select value={field.value ?? ""} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a categoria" />
                  </SelectTrigger>
                </FormControl>

                <SelectContent>
                  {!categories && (
                    <SelectItem value="loading" disabled>
                      Carregando...
                    </SelectItem>
                  )}

                  {categories?.length === 0 && (
                    <SelectItem value="empty" disabled>
                      Nenhuma categoria cadastrada
                    </SelectItem>
                  )}

                  {categories?.map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <FormMessage />
            </FormItem>
          )}
        />

        {/* Botão */}
        <Button type="submit" className="w-full">
          {form.formState.isSubmitting ? "Salvando..." : "Salvar"}
        </Button>
      </form>
    </Form>
  );
}
