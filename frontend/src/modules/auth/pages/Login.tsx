// src/modules/auth/pages/Login.tsx

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Lock, Mail, Package } from "lucide-react";

import { api } from "@/shared/services/api";
import { useAuthStore } from "@/shared/store/auth";

export function Login() {
  const navigate = useNavigate();

  const setToken = useAuthStore((s) => s.setToken);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  async function handleLogin() {
    try {
      setError("");

      const user = {
        email: "tiago@example.com",
        password: "SenhaForte123",
      };

      const response = await api.post("/auth/login", {
        email: user.email,
        password: user.password,
      });

      setToken(response.data.token);

      navigate("/", {
        replace: true,
      });
    } catch (error) {
      setError("Usuário ou senha inválidos");
    }
  }

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

        {/* Erro */}

        {error && (
          <div
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
              placeholder="seu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
        </div>

        {/* Senha */}

        <div className="mb-6">
          <label
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
              type="password"
              placeholder="********"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
        </div>

        <button
          onClick={handleLogin}
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
