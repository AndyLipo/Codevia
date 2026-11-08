import { Ruler } from "lucide-react";
import CatalogoParametroManager from "./CatalogoParametroManager";

export default function UnidadesMedidaParams({ fakeAction }) {
  return (
    <CatalogoParametroManager
      eyebrow="05 · CATÁLOGO · PARÁMETROS · UNIDADES DE MEDIDA"
      title="Parámetros · Unidades de Medida"
      description="Administración de las unidades de medida registradas, incluyendo alta, edición y eliminación."
      panelEyebrow="GESTIÓN DE UNIDADES"
      panelTitle="Unidades de medida registradas"
      newButtonLabel="Nueva unidad de medida"
      singularLabel="la unidad de medida"
      pluralLabel="unidades de medida"
      codePlaceholder="Ej: UNI, KG, PAQ"
      namePlaceholder="Ej: Unidad, Kilogramo, Paquete"
      descPlaceholder="Descripción de la unidad de medida..."
      tableName="unidad_medida"
      idColumn="id_unidad_medida"
      rpcList="listar_unidades_medida_catalogo"
      rpcCreate="crear_unidad_medida_catalogo"
      rpcUpdate="actualizar_unidad_medida_catalogo"
      rpcDelete="eliminar_unidad_medida_catalogo"
      fakeAction={fakeAction}
      Icon={Ruler}
    />
  );
}
