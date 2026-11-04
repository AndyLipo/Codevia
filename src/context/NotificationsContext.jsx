import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabaseClient";

const NotificationsContext = createContext(null);

const parseLocalDate = (value) => {
  if (!value) return null;

  const [year, month, day] = String(value)
    .slice(0, 10)
    .split("-")
    .map(Number);

  if (!year || !month || !day) return null;

  return new Date(year, month - 1, day);
};

const getDayDifference = (date) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const target = new Date(date);
  target.setHours(0, 0, 0, 0);

  return Math.round(
    (target.getTime() - today.getTime()) / 86400000
  );
};

export function NotificationsProvider({ children }) {
  const { token } = useAuth();

  const [notifications, setNotifications] = useState([]);
  const [readIds, setReadIds] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const refreshNotifications = useCallback(async () => {
    if (!token) {
      setNotifications([]);
      return;
    }

    setLoading(true);
    setError(false);

    try {
      const { data, error } = await supabase
        .schema("usuarios")
        .rpc("listar_inventario_critico_deposito", {
          p_token: token,
        });

      if (error) throw error;

      const alertas = (data || [])
        .map((item) => {
          const fechaVencimiento = parseLocalDate(
            item.fecha_vencimiento
          );

          if (!fechaVencimiento) return null;

          const dias = getDayDifference(fechaVencimiento);

          return {
            ...item,
            fechaVencimiento,
            dias,
            vencido: dias < 0,
          };
        })
        .filter(Boolean)
        .filter((item) => item.vencido || item.dias <= 7)
        .sort((a, b) => a.dias - b.dias);

      setNotifications(alertas);
    } catch (err) {
      console.error("Error al cargar notificaciones:", err);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    refreshNotifications();
  }, [refreshNotifications]);

  const markAsRead = useCallback((id) => {
    setReadIds((previous) =>
      previous.includes(id) ? previous : [...previous, id]
    );
  }, []);

  const unreadCount = useMemo(
    () =>
      notifications.filter(
        (item) => !readIds.includes(item.id_lote_producto)
      ).length,
    [notifications, readIds]
  );

  const value = {
    notifications,
    unreadCount,
    loading,
    error,
    refreshNotifications,
    markAsRead,
    readIds,
  };

  return (
    <NotificationsContext.Provider value={value}>
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationsContext);

  if (!context) {
    throw new Error(
      "useNotifications debe utilizarse dentro de NotificationsProvider"
    );
  }

  return context;
}