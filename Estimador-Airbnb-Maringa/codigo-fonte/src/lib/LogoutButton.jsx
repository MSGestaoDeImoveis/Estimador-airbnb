import React, { useState } from "react";
import { supabase } from "./supabaseClient.js";

// Botão de logout flutuante e discreto. É posicionado por cima do Estimador
// via position: fixed, para não alterar em nada o layout/CSS interno
// existente do Estimador (EstimatorCore.jsx permanece intocado).
export default function LogoutButton() {
  const [loading, setLoading] = useState(false);

  const handleLogout = async () => {
    setLoading(true);
    await supabase.auth.signOut();
    setLoading(false);
  };

  return (
    <button
      onClick={handleLogout}
      disabled={loading}
      title="Sair"
      style={{
        position: "fixed",
        top: 12,
        right: 14,
        zIndex: 9999,
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        border: "1px solid #DEDACD",
        background: "#FFFFFF",
        color: "#17302B",
        borderRadius: 20,
        padding: "6px 13px",
        fontSize: 12,
        fontWeight: 600,
        fontFamily: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
        cursor: loading ? "default" : "pointer",
        boxShadow: "0 2px 10px rgba(23,48,43,0.12)",
      }}
    >
      {loading ? "Saindo…" : "Sair"}
    </button>
  );
}
