// src/modules/auth/pages/Login.tsx

import { useForm } from "react-hook-form";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Lock, Mail, Package } from "lucide-react";

import { api } from "@/shared/services/api";
import { useAuthStore, type SessionUser } from "@/shared/store/auth";
import { parseApiErrorSync } from "@/shared/services/parseApiError";

import { FieldError, fieldA11y } from "@/shared/components/form";
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
      from-sidebar
      via-sidebar-active
      to-sidebar-active
      px-4
    "
    >
      <div
        className="
        w-full
        max-w-md
        bg-surface
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
            bg-primary
            text-primary-foreground
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
            text-foreground
          "
          >
            Inventory System
          </h1>

          <p
            className="
            text-sm
            text-muted
            mt-2
          "
          >
            Gerencie seu estoque de forma simples
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          {expired && !error && (
            <div role="status" className="bg-warning-soft text-warning text-sm p-3 rounded-lg mb-4">
              Sua sessão expirou.
            </div>
          )}

          {error && (
            <div
              role="alert"
              className="
              bg-danger-soft
              text-danger
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
              text-foreground
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
                  text-subtle
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
                  focus:ring-ring/20
                "
                id="login-email" {...fieldA11y("login-email", errors.email?.message)}
                type="email"
                autoComplete="username"
                placeholder="seu@email.com"
                {...register("email", { required: "E-mail obrigatório." })}
              />
            </div>
            <FieldError id="login-email" message={errors.email?.message} />
          </div>

          {/* Senha */}

          <div className="mb-6">
            <label
              htmlFor="login-password"
              className="
              text-sm
              font-medium
              text-foreground
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
                  text-subtle
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
                  focus:ring-ring/20
                "
                id="login-password" {...fieldA11y("login-password", errors.password?.message)}
                type="password"
                autoComplete="current-password"
                placeholder="********"
                {...register("password", { required: "Senha obrigatória." })}
              />
            </div>
            <FieldError id="login-password" message={errors.password?.message} />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="
              w-full
              bg-primary
              text-primary-foreground
              py-3
              rounded-xl
              font-semibold
              hover:bg-primary-hover
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
          text-subtle
          mt-6
        "
        >
          © {new Date().getFullYear()} Inventory System
        </p>
      </div>
    </div>
  );
}
