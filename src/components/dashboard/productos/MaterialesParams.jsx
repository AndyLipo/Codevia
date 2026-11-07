import { Layers } from "lucide-react";
import CatalogoParametroManager from "./CatalogoParametroManager";

export default function MaterialesParams({ fakeAction }) {
  return (
    <CatalogoParametroManager
      eyebrow="05 · CATÁLOGO · PARÁMETROS · MATERIALES"
      title="Parámetros · Materiales"
      description="Administración de los materiales registrados en produccion.material, incluyendo alta, edición y eliminación."
      panelEyebrow="PRODUCCION.MATERIAL · GESTIÓN DE MATERIALES"
      panelTitle="Materiales registrados"
      newButtonLabel="Nuevo Material"
      singularLabel="el material"
      pluralLabel="materiales"
      codePlaceholder="Ej: PET, PP, PEBD, PLA"
      namePlaceholder="Ej: Polietileno Tereftalato, Polipropileno"
      descPlaceholder="Descripción del material..."
      tableName="material"
      idColumn="id_material"
      rpcList="listar_materiales_catalogo"
      rpcCreate="crear_material_catalogo"
      rpcUpdate="actualizar_material_catalogo"
      rpcDelete="eliminar_material_catalogo"
      fakeAction={fakeAction}
      Icon={Layers}
    />
  );
}
