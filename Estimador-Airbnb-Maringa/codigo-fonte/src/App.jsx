import React from "react";
import Estimador from "./lib/EstimatorCore.jsx";
import { AuthProvider, useAuth } from "./lib/AuthContext.jsx";
import LoginScreen from "./lib/LoginScreen.jsx";
import LogoutButton from "./lib/LogoutButton.jsx";

// Este arquivo é a ÚNICA mudança estrutural feita para adicionar autenticação.
// O EstimatorCore.jsx (Estimador original) não foi alterado: cálculos, fórmulas,
// Base de Comparáveis, abas e layout interno permanecem exatamente como estavam.
//
// Fluxo:
// 1) Enquanto a sessão do Supabase está sendo verificada -> tela de carregamento.
// 2) Sem sessão válida -> tela de Login (e-mail + senha).
// 3) Com sessão válida -> Estimador original, com um botão "Sair" flutuante
//    sobreposto (position: fixed), que não interfere no layout interno do Estimador.

function LoadingScreen() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#F6F5F1",
        color: "#57685F",
        fontFamily: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
        fontSize: 13,
      }}
    >
      Verificando sessão…
    </div>
  );
}

function AuthGate() {
  const { session, loading } = useAuth();

  if (loading) return <LoadingScreen />;
  if (!session) return <LoginScreen />;

  return (
    <>
      <LogoutButton />
      <Estimador />
    </>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AuthGate />
    </AuthProvider>
  );
}
