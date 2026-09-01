import React, { useState } from "react";
import { supabase } from "./supabaseClient.js";

// Paleta consistente com o Estimador (ver GlobalStyle em EstimatorCore.jsx),
// reproduzida aqui de forma independente para que a tela de login funcione
// mesmo antes do Estimador ser montado.
const COLORS = {
  bg: "#F6F5F1",
  paper: "#FFFFFF",
  ink: "#17302B",
  inkSoft: "#57685F",
  inkFaint: "#8B978F",
  line: "#DEDACD",
  accent: "#2E6F5E",
  accentSoft: "#E4EFE9",
  alert: "#AE4A3B",
  alertSoft: "#F4E1DD",
};

function translateAuthError(message) {
  if (!message) return "Não foi possível entrar. Tente novamente.";
  const msg = message.toLowerCase();
  if (msg.includes("invalid login credentials")) {
    return "E-mail ou senha incorretos.";
  }
  if (msg.includes("email not confirmed")) {
    return "E-mail ainda não confirmado. Verifique sua caixa de entrada.";
  }
  if (msg.includes("too many requests")) {
    return "Muitas tentativas. Aguarde um momento e tente novamente.";
  }
  if (msg.includes("failed to fetch") || msg.includes("network")) {
    return "Falha de conexão com o servidor de autenticação. Verifique sua internet.";
  }
  return message;
}

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!email || !password) {
      setError("Informe e-mail e senha.");
      return;
    }
    setLoading(true);
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setLoading(false);
    if (signInError) {
      setError(translateAuthError(signInError.message));
    }
    // Em caso de sucesso, o onAuthStateChange no AuthContext atualiza a sessão
    // automaticamente e o AuthGate troca para o Estimador.
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: COLORS.bg,
        fontFamily: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
        padding: "24px",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 380,
          background: COLORS.paper,
          border: `1px solid ${COLORS.line}`,
          borderRadius: 6,
          padding: "36px 32px",
          boxShadow: "0 8px 28px rgba(23,48,43,0.08)",
        }}
      >
        <div
          style={{
            fontFamily: 'Georgia, "Iowan Old Style", "Times New Roman", serif',
            fontSize: 20,
            lineHeight: 1.3,
            color: COLORS.ink,
            marginBottom: 4,
          }}
        >
          Inteligência de Mercado
        </div>
        <div
          style={{
            fontSize: 11,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: COLORS.inkFaint,
            fontWeight: 600,
            marginBottom: 26,
          }}
        >
          Locação por Temporada · Maringá / PR
        </div>

        <div
          style={{
            fontSize: 12.5,
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            color: COLORS.inkSoft,
            marginBottom: 16,
          }}
        >
          Acesso restrito
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 14 }}>
            <label style={{ fontSize: 11.5, color: COLORS.inkSoft, fontWeight: 600 }}>
              E-mail
            </label>
            <input
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="voce@exemplo.com"
              disabled={loading}
              style={{
                border: `1px solid ${COLORS.line}`,
                background: COLORS.paper,
                borderRadius: 3,
                padding: "9px 11px",
                fontSize: 14,
                color: COLORS.ink,
                fontFamily: "inherit",
              }}
            />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 18 }}>
            <label style={{ fontSize: 11.5, color: COLORS.inkSoft, fontWeight: 600 }}>
              Senha
            </label>
            <div style={{ position: "relative" }}>
              <input
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                disabled={loading}
                style={{
                  width: "100%",
                  border: `1px solid ${COLORS.line}`,
                  background: COLORS.paper,
                  borderRadius: 3,
                  padding: "9px 40px 9px 11px",
                  fontSize: 14,
                  color: COLORS.ink,
                  fontFamily: "inherit",
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                tabIndex={-1}
                style={{
                  position: "absolute",
                  right: 8,
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "none",
                  border: "none",
                  color: COLORS.inkFaint,
                  fontSize: 11,
                  cursor: "pointer",
                  fontWeight: 600,
                }}
              >
                {showPassword ? "ocultar" : "mostrar"}
              </button>
            </div>
          </div>

          {error && (
            <div
              style={{
                display: "flex",
                gap: 8,
                padding: "10px 12px",
                borderRadius: 3,
                background: COLORS.alertSoft,
                border: "1px solid #E0B8AE",
                fontSize: 12.8,
                color: "#7A2E22",
                lineHeight: 1.45,
                marginBottom: 16,
              }}
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              borderRadius: 3,
              padding: "11px 16px",
              fontSize: 14,
              fontWeight: 600,
              cursor: loading ? "default" : "pointer",
              border: "1px solid transparent",
              background: loading ? "#5C8B7C" : COLORS.accent,
              color: "#fff",
            }}
          >
            {loading ? "Entrando…" : "Entrar"}
          </button>
        </form>

        <div
          style={{
            fontSize: 11.5,
            color: COLORS.inkFaint,
            lineHeight: 1.5,
            marginTop: 20,
            textAlign: "center",
          }}
        >
          Acesso apenas para usuários autorizados.
        </div>
      </div>
    </div>
  );
}
