// Situación de un lote según su fecha de vencimiento:
// "Vencido" | "Próximo a vencer" (falta 1 mes o menos) | "Normal"
export const obtenerSituacion = (fecha) => {
  if (!fecha) return "Normal";

  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  const vencimiento = new Date(`${String(fecha).slice(0, 10)}T00:00:00`);
  if (hoy.getTime() > vencimiento.getTime()) return "Vencido";

  const limiteUnMes = new Date(hoy);
  limiteUnMes.setMonth(limiteUnMes.getMonth() + 1);

  return vencimiento.getTime() <= limiteUnMes.getTime()
    ? "Próximo a vencer"
    : "Normal";
};
