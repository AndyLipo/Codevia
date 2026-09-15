import { useEffect, useState } from 'react';

const API_URL = import.meta.env.VITE_API_URL;

function Front() {
    const [tiposProducto, setTiposProducto] = useState([]);
    const [materiales, setMateriales] = useState([]);
    const [unidadesMedida, setUnidadesMedida] = useState([]);

    const [formulario, setFormulario] = useState({
        nombre: '',
        id_tipo_producto: '',
        id_material: '',
        id_unidad_medida: '',
        es_biodegradable: false,
        vida_util_meses: ''
    });

    const [mensaje, setMensaje] = useState('');
    const [error, setError] = useState('');
    const [cargando, setCargando] = useState(true);
    const [guardando, setGuardando] = useState(false);

    useEffect(() => {
        cargarDatos();
    }, []);

    const cargarDatos = async () => {
        try {
            setCargando(true);
            setError('');

            const [
                respuestaTipos,
                respuestaMateriales,
                respuestaUnidades
            ] = await Promise.all([
                fetch(`${API_URL}/api/productos/tipos-producto`),
                fetch(`${API_URL}/api/productos/materiales`),
                fetch(`${API_URL}/api/productos/unidades-medida`)
            ]);

            if (!respuestaTipos.ok) {
                throw new Error('No se pudieron obtener los tipos de producto');
            }

            if (!respuestaMateriales.ok) {
                throw new Error('No se pudieron obtener los materiales');
            }

            if (!respuestaUnidades.ok) {
                throw new Error('No se pudieron obtener las unidades de medida');
            }

            const tipos = await respuestaTipos.json();
            const materiales = await respuestaMateriales.json();
            const unidades = await respuestaUnidades.json();

            setTiposProducto(tipos);
            setMateriales(materiales);
            setUnidadesMedida(unidades);

        } catch (error) {
            console.error(error);
            setError(error.message);
        } finally {
            setCargando(false);
        }
    };

    const manejarCambio = (e) => {
        const { name, value, type, checked } = e.target;

        setFormulario(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    const guardarProducto = async (e) => {
        e.preventDefault();

        setMensaje('');
        setError('');
        setGuardando(true);

        try {
            const respuesta = await fetch(`${API_URL}/api/productos`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    nombre: formulario.nombre,
                    id_tipo_producto: Number(formulario.id_tipo_producto),
                    id_material: Number(formulario.id_material),
                    id_unidad_medida: Number(formulario.id_unidad_medida),
                    es_biodegradable: formulario.es_biodegradable,
                    vida_util_meses: formulario.vida_util_meses,
                    usu_alta: 'BP38636078'
                })
            });

            const datos = await respuesta.json();

            if (!respuesta.ok) {
                throw new Error(
                    datos.detalle ||
                    datos.error ||
                    'No se pudo crear el producto'
                );
            }

            setMensaje(
                `Producto creado correctamente. ID: ${datos.id_producto}`
            );

            setFormulario({
                nombre: '',
                id_tipo_producto: '',
                id_material: '',
                id_unidad_medida: '',
                es_biodegradable: false,
                vida_util_meses: ''
            });

        } catch (error) {
            console.error(error);
            setError(error.message);

        } finally {
            setGuardando(false);
        }
    };

    if (cargando) {
        return (
            <div>
                <h2>Nuevo Producto</h2>
                <p>Cargando datos...</p>
            </div>
        );
    }

    return (
        <div
            style={{
                maxWidth: '600px',
                margin: '40px auto',
                padding: '30px',
                fontFamily: 'Arial'
            }}
        >
            <h1>Nuevo Producto</h1>

            {error && (
                <div
                    style={{
                        padding: '10px',
                        marginBottom: '20px',
                        border: '1px solid red'
                    }}
                >
                    {error}
                </div>
            )}

            {mensaje && (
                <div
                    style={{
                        padding: '10px',
                        marginBottom: '20px',
                        border: '1px solid green'
                    }}
                >
                    {mensaje}
                </div>
            )}

            <form onSubmit={guardarProducto}>

                {/* NOMBRE */}

                <div style={{ marginBottom: '20px' }}>
                    <label>
                        Nombre
                    </label>

                    <input
                        type="text"
                        name="nombre"
                        value={formulario.nombre}
                        onChange={manejarCambio}
                        required
                        style={{
                            width: '100%',
                            padding: '8px',
                            marginTop: '5px'
                        }}
                    />
                </div>


                {/* TIPO DE PRODUCTO */}

                <div style={{ marginBottom: '20px' }}>
                    <label>
                        Tipo de producto
                    </label>

                    <select
                        name="id_tipo_producto"
                        value={formulario.id_tipo_producto}
                        onChange={manejarCambio}
                        required
                        style={{
                            width: '100%',
                            padding: '8px',
                            marginTop: '5px'
                        }}
                    >
                        <option value="">
                            Seleccione un tipo
                        </option>

                        {tiposProducto.map(tipo => (
                            <option
                                key={tipo.id_tipo_producto}
                                value={tipo.id_tipo_producto}
                            >
                                {tipo.descripcion}
                            </option>
                        ))}
                    </select>
                </div>


                {/* MATERIAL */}

                <div style={{ marginBottom: '20px' }}>
                    <label>
                        Material
                    </label>

                    <select
                        name="id_material"
                        value={formulario.id_material}
                        onChange={manejarCambio}
                        required
                        style={{
                            width: '100%',
                            padding: '8px',
                            marginTop: '5px'
                        }}
                    >
                        <option value="">
                            Seleccione un material
                        </option>

                        {materiales.map(material => (
                            <option
                                key={material.id_material}
                                value={material.id_material}
                            >
                                {material.descripcion}
                            </option>
                        ))}
                    </select>
                </div>


                {/* UNIDAD DE MEDIDA */}

                <div style={{ marginBottom: '20px' }}>
                    <label>
                        Unidad de medida
                    </label>

                    <select
                        name="id_unidad_medida"
                        value={formulario.id_unidad_medida}
                        onChange={manejarCambio}
                        required
                        style={{
                            width: '100%',
                            padding: '8px',
                            marginTop: '5px'
                        }}
                    >
                        <option value="">
                            Seleccione una unidad
                        </option>

                        {unidadesMedida.map(unidad => (
                            <option
                                key={unidad.id_unidad_medida}
                                value={unidad.id_unidad_medida}
                            >
                                {unidad.codigo} - {unidad.descripcion}
                            </option>
                        ))}
                    </select>
                </div>


                {/* BIODEGRADABLE */}

                <div style={{ marginBottom: '20px' }}>
                    <label>
                        <input
                            type="checkbox"
                            name="es_biodegradable"
                            checked={formulario.es_biodegradable}
                            onChange={manejarCambio}
                        />

                        {' '}Es biodegradable
                    </label>
                </div>


                {/* VIDA ÚTIL */}

                <div style={{ marginBottom: '20px' }}>
                    <label>
                        Vida útil en meses
                    </label>

                    <input
                        type="text"
                        name="vida_util_meses"
                        value={formulario.vida_util_meses}
                        onChange={manejarCambio}
                        style={{
                            width: '100%',
                            padding: '8px',
                            marginTop: '5px'
                        }}
                    />
                </div>


                {/* USUARIO */}

                <div style={{ marginBottom: '20px' }}>
                    <label>
                        Usuario de alta
                    </label>

                    <input
                        type="text"
                        value="BP38636078"
                        disabled
                        style={{
                            width: '100%',
                            padding: '8px',
                            marginTop: '5px'
                        }}
                    />
                </div>


                {/* BOTÓN */}

                <button
                    type="submit"
                    disabled={guardando}
                    style={{
                        padding: '10px 20px'
                    }}
                >
                    {guardando
                        ? 'Guardando...'
                        : 'Guardar producto'}
                </button>

            </form>
        </div>
    );
}

export default Front;