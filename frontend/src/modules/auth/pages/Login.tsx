// src/modules/auth/pages/Login.tsx
import { useState } from "react";
import { api } from "@/shared/services/api";
import { useAuthStore } from "@/shared/store/auth";

export function Login() {
  const setToken = useAuthStore((s) => s.setToken);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  async function handleLogin() {
    const response = await api.post("/auth/login", { email, password });
    setToken(response.data.token);
  }

  return (
    <div className="h-screen flex items-center justify-center">
      <div className="p-6 bg-white rounded-2xl shadow w-80">
        <h1 className="text-xl font-bold mb-4">Login</h1>
        <input
          className="w-full border p-2 mb-2"
          placeholder="Email"
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          className="w-full border p-2 mb-4"
          type="password"
          placeholder="Senha"
          onChange={(e) => setPassword(e.target.value)}
        />
        <button
          className="w-full bg-black text-white p-2 rounded"
          onClick={handleLogin}
        >
          Entrar
        </button>
      </div>
    </div>
  );
}
