import { Shapes } from "lucide-react";
import CatalogoParametroManager from "./CatalogoParametroManager";

export default function TiposProductoParams({ fakeAction }) {
  return (
    <CatalogoParametroManager
      eyebrow="05 · CATÁLOGO · PARÁMETROS · TIPO DE PRODUCTO"
      title="Parámetros · Tipo de Producto"
      description="Administración de los tipos de producto registrados en produccion.tipo_producto, incluyendo alta, edición y eliminación."
      panelEyebrow="PRODUCCION.TIPO_PRODUCTO · GESTIÓN DE TIPOS DE PRODUCTO"
      panelTitle="Tipos de producto registrados"
      newButtonLabel="Nuevo tipo de producto"
      singularLabel="el tipo de producto"
      pluralLabel="tipos de producto"
      codePlaceholder="Ej: ENV, BOL, BAN"
      namePlaceholder="Ej: Envase, Bolsa, Bandeja"
      descPlaceholder="Descripción del tipo de producto..."
      tableName="tipo_producto"
      idColumn="id_tipo_producto"
      rpcList="listar_tipos_producto_catalogo"
      rpcCreate="crear_tipo_producto_catalogo"
      rpcUpdate="actualizar_tipo_producto_catalogo"
      rpcDelete="eliminar_tipo_producto_catalogo"
      fakeAction={fakeAction}
      Icon={Shapes}
    />
  );
}
