// src/modules/auth/pages/Login.tsx

import { useForm } from "react-hook-form";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Lock, Mail, Package } from "lucide-react";

import { api } from "@/shared/services/api";
import { useAuthStore, type SessionUser } from "@/shared/store/auth";
import { parseApiErrorSync } from "@/shared/services/parseApiError";

type LoginForm = { email: string; password: string };

export function Login() {
  const navigate = useNavigate();

  const [searchParams] = useSearchParams();
  const setSession = useAuthStore((s) => s.setSession);
  const expired = searchParams.get("expired") === "1";

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({ defaultValues: { email: "", password: "" } });

  async function onSubmit(values: LoginForm) {
    try {
      const response = await api.post<{ data: { token: string; user: SessionUser } }>("/auth/login", {
        email: values.email.trim(),
        password: values.password,
      });

      setSession(response.data.data.token, response.data.data.user);

      navigate("/", { replace: true });
    } catch (err) {
      const parsed = parseApiErrorSync(err);
      const message = parsed.code === "INVALID_CREDENTIALS" ? "E-mail ou senha inválidos." : parsed.message;
      setError("root.server", { type: "server", message });
    }
  }

  const error = errors.root?.server?.message;

  return (
    <div
      className="
      min-h-screen
      flex
      items-center
      justify-center
      bg-gradient-to-br
      from-slate-900
      via-slate-800
      to-slate-700
      px-4
    "
    >
      <div
        className="
        w-full
        max-w-md
        bg-white
        rounded-2xl
        shadow-2xl
        p-8
      "
      >
        {/* Logo */}

        <div
          className="
          flex
          flex-col
          items-center
          mb-8
        "
        >
          <div
            className="
            bg-slate-900
            text-white
            p-4
            rounded-2xl
            mb-4
          "
          >
            <Package size={32} />
          </div>

          <h1
            className="
            text-2xl
            font-bold
            text-slate-900
          "
          >
            Inventory System
          </h1>

          <p
            className="
            text-sm
            text-slate-500
            mt-2
          "
          >
            Gerencie seu estoque de forma simples
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} noValidate>
        {expired && !error && (
          <div role="status" className="bg-amber-50 text-amber-700 text-sm p-3 rounded-lg mb-4">
            Sua sessão expirou.
          </div>
        )}

        {error && (
          <div
            role="alert"
            className="
            bg-red-50
            text-red-600
            text-sm
            p-3
            rounded-lg
            mb-4
          "
          >
            {error}
          </div>
        )}

        {/* Email */}

        <div className="mb-4">
          <label
            htmlFor="login-email"
            className="
            text-sm
            font-medium
            text-slate-700
          "
          >
            Email
          </label>

          <div
            className="
            relative
            mt-1
          "
          >
            <Mail
              size={18}
              className="
                absolute
                left-3
                top-3
                text-slate-400
              "
            />

            <input
              className="
                w-full
                border
                rounded-xl
                py-2.5
                pl-10
                pr-3
                outline-none
                focus:ring-2
                focus:ring-slate-900
              "
              id="login-email"
              type="email"
              autoComplete="username"
              placeholder="seu@email.com"
              {...register("email", { required: "E-mail obrigatório." })}
            />
          </div>
          {errors.email && <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>}
        </div>

        {/* Senha */}

        <div className="mb-6">
          <label
            htmlFor="login-password"
            className="
            text-sm
            font-medium
            text-slate-700
          "
          >
            Senha
          </label>

          <div
            className="
            relative
            mt-1
          "
          >
            <Lock
              size={18}
              className="
                absolute
                left-3
                top-3
                text-slate-400
              "
            />

            <input
              className="
                w-full
                border
                rounded-xl
                py-2.5
                pl-10
                pr-3
                outline-none
                focus:ring-2
                focus:ring-slate-900
              "
              id="login-password"
              type="password"
              autoComplete="current-password"
              placeholder="********"
              {...register("password", { required: "Senha obrigatória." })}
            />
          </div>
          {errors.password && <p className="mt-1 text-sm text-red-600">{errors.password.message}</p>}
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="
            w-full
            bg-slate-900
            text-white
            py-3
            rounded-xl
            font-semibold
            hover:bg-slate-800
            transition
          "
        >
          Entrar
        </button>
        </form>

        <p
          className="
          text-center
          text-xs
          text-slate-400
          mt-6
        "
        >
          © {new Date().getFullYear()} Inventory System
        </p>
      </div>
    </div>
  );
}
