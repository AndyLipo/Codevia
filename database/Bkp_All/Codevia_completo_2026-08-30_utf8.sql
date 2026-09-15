--
-- PostgreSQL database dump
--

\restrict AHfXSkeIo9IuIiF8wiOhZJQ9j6SFMsDbxdYOjpOjsIt38tmP756hMC0gtNmshkS

-- Dumped from database version 18.6
-- Dumped by pg_dump version 18.6

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: administracion; Type: SCHEMA; Schema: -; Owner: postgres
--

CREATE SCHEMA administracion;


ALTER SCHEMA administracion OWNER TO postgres;

--
-- Name: deposito; Type: SCHEMA; Schema: -; Owner: postgres
--

CREATE SCHEMA deposito;


ALTER SCHEMA deposito OWNER TO postgres;

--
-- Name: logistica; Type: SCHEMA; Schema: -; Owner: postgres
--

CREATE SCHEMA logistica;


ALTER SCHEMA logistica OWNER TO postgres;

--
-- Name: produccion; Type: SCHEMA; Schema: -; Owner: postgres
--

CREATE SCHEMA produccion;


ALTER SCHEMA produccion OWNER TO postgres;

--
-- Name: sistema; Type: SCHEMA; Schema: -; Owner: postgres
--

CREATE SCHEMA sistema;


ALTER SCHEMA sistema OWNER TO postgres;

--
-- Name: transporte; Type: SCHEMA; Schema: -; Owner: postgres
--

CREATE SCHEMA transporte;


ALTER SCHEMA transporte OWNER TO postgres;

--
-- Name: usuarios; Type: SCHEMA; Schema: -; Owner: postgres
--

CREATE SCHEMA usuarios;


ALTER SCHEMA usuarios OWNER TO postgres;

--
-- Name: fn_actualizar_detalle_produccion(); Type: FUNCTION; Schema: produccion; Owner: postgres
--

CREATE FUNCTION produccion.fn_actualizar_detalle_produccion() RETURNS trigger
    LANGUAGE plpgsql
    AS $$

DECLARE

    v_id_detalle INTEGER;

    v_cantidad_solicitada NUMERIC;

    v_cantidad_producida NUMERIC;

    v_estado_actual CHAR(1);

    v_nuevo_estado CHAR(1);

BEGIN



    -- Determinar qu├® detalle debemos actualizar

    IF TG_OP = 'DELETE' THEN

        v_id_detalle := OLD.id_detalle_orden;

    ELSE

        v_id_detalle := NEW.id_detalle_orden;

    END IF;



    -- Obtener informaci├│n actual del detalle

    SELECT

        cantidad_solicitada,

        estado_detalle

    INTO

        v_cantidad_solicitada,

        v_estado_actual

    FROM produccion.detalle_orden_produccion

    WHERE id_detalle_orden = v_id_detalle;



    -- Calcular producci├│n acumulada

    SELECT COALESCE(SUM(cantidad_producida), 0)

    INTO v_cantidad_producida

    FROM produccion.produccion

    WHERE id_detalle_orden = v_id_detalle

      AND estado_produccion <> 'A';



    -- Determinar nuevo estado

    IF v_cantidad_producida = 0 THEN

        v_nuevo_estado := 'P';



    ELSIF v_cantidad_producida >= v_cantidad_solicitada THEN

        v_nuevo_estado := 'C';



    ELSIF v_estado_actual = 'I' THEN

        -- Mantener incompleto hasta que un responsable

        -- lo vuelva a habilitar expl├¡citamente.

        v_nuevo_estado := 'I';



    ELSE

        v_nuevo_estado := 'E';

    END IF;



    -- Actualizar el detalle

    UPDATE produccion.detalle_orden_produccion

    SET

        cantidad_producida = v_cantidad_producida,

        estado_detalle = v_nuevo_estado

    WHERE id_detalle_orden = v_id_detalle;



    RETURN COALESCE(NEW, OLD);

END;

$$;


ALTER FUNCTION produccion.fn_actualizar_detalle_produccion() OWNER TO postgres;

--
-- Name: fn_control_estado_produccion(); Type: FUNCTION; Schema: produccion; Owner: postgres
--

CREATE FUNCTION produccion.fn_control_estado_produccion() RETURNS trigger
    LANGUAGE plpgsql
    AS $$

BEGIN



    -- Cuando comienza la producci├│n

    IF NEW.estado_produccion = 'E'

       AND OLD.estado_produccion <> 'E' THEN



        NEW.fecha_inicio := CURRENT_TIMESTAMP;

        NEW.fecha_fin := NULL;



    END IF;



    -- Cuando finaliza la producci├│n

    IF NEW.estado_produccion = 'C'

       AND OLD.estado_produccion <> 'C' THEN



        IF NEW.fecha_inicio IS NULL THEN

            NEW.fecha_inicio := CURRENT_TIMESTAMP;

        END IF;



        NEW.fecha_fin := CURRENT_TIMESTAMP;



    END IF;



    RETURN NEW;



END;

$$;


ALTER FUNCTION produccion.fn_control_estado_produccion() OWNER TO postgres;

--
-- Name: fn_fecha_inicio_produccion(); Type: FUNCTION; Schema: produccion; Owner: postgres
--

CREATE FUNCTION produccion.fn_fecha_inicio_produccion() RETURNS trigger
    LANGUAGE plpgsql
    AS $$

BEGIN



    IF NEW.estado_produccion = 'E'

       AND OLD.estado_produccion <> 'E' THEN



        NEW.fecha_inicio := CURRENT_TIMESTAMP;



    END IF;



    RETURN NEW;



END;

$$;


ALTER FUNCTION produccion.fn_fecha_inicio_produccion() OWNER TO postgres;

--
-- Name: fn_validar_cantidad_producida(); Type: FUNCTION; Schema: produccion; Owner: postgres
--

CREATE FUNCTION produccion.fn_validar_cantidad_producida() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_cantidad_solicitada NUMERIC;
    v_cantidad_acumulada NUMERIC;
    v_cantidad_anterior NUMERIC;
BEGIN

    -- Obtener la cantidad solicitada del detalle
    SELECT cantidad_solicitada
    INTO v_cantidad_solicitada
    FROM produccion.detalle_orden_produccion
    WHERE id_detalle_orden = NEW.id_detalle_orden;

    -- Si se est├í modificando una producci├│n existente,
    -- quitamos su cantidad anterior del acumulado.
    v_cantidad_anterior := 0;

    IF TG_OP = 'UPDATE' THEN
        v_cantidad_anterior := OLD.cantidad_producida;
    END IF;

    -- Calcular cu├ínto se produjo hasta ahora
    SELECT COALESCE(SUM(cantidad_producida), 0)
    INTO v_cantidad_acumulada
    FROM produccion.produccion
    WHERE id_detalle_orden = NEW.id_detalle_orden
      AND estado_produccion <> 'A'
      AND id_produccion <> COALESCE(NEW.id_produccion, -1);

    -- Validar que no se supere lo solicitado
    IF v_cantidad_acumulada + NEW.cantidad_producida
       > v_cantidad_solicitada THEN

        RAISE EXCEPTION
            'La cantidad producida supera la cantidad solicitada. Solicitada: %, acumulada: %, nueva cantidad: %',
            v_cantidad_solicitada,
            v_cantidad_acumulada,
            NEW.cantidad_producida;

    END IF;

    RETURN NEW;
END;
$$;


ALTER FUNCTION produccion.fn_validar_cantidad_producida() OWNER TO postgres;

--
-- Name: generar_codigo_producto(); Type: FUNCTION; Schema: produccion; Owner: postgres
--

CREATE FUNCTION produccion.generar_codigo_producto() RETURNS trigger
    LANGUAGE plpgsql
    AS $$

BEGIN



    NEW.codigo := 'PBP-' ||

                  LPAD(

                      NEXTVAL('produccion.seq_codigo_producto')::TEXT,

                      6,

                      '0'

                  );



    RETURN NEW;



END;

$$;


ALTER FUNCTION produccion.generar_codigo_producto() OWNER TO postgres;

--
-- Name: generar_nro_orden(); Type: FUNCTION; Schema: produccion; Owner: postgres
--

CREATE FUNCTION produccion.generar_nro_orden() RETURNS trigger
    LANGUAGE plpgsql
    AS $$

BEGIN



    NEW.nro_orden := 'OP-' ||

                     LPAD(

                         NEXTVAL('produccion.seq_nro_orden')::TEXT,

                         6,

                         '0'

                     );



    RETURN NEW;



END;

$$;


ALTER FUNCTION produccion.generar_nro_orden() OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: detalle_orden_produccion; Type: TABLE; Schema: produccion; Owner: postgres
--

CREATE TABLE produccion.detalle_orden_produccion (
    id_detalle_orden integer NOT NULL,
    id_orden_produccion integer NOT NULL,
    id_producto integer NOT NULL,
    cantidad_solicitada numeric(15,3) NOT NULL,
    cantidad_producida numeric(15,3) DEFAULT 0 NOT NULL,
    fecha_limite date NOT NULL,
    estado_detalle character(1) DEFAULT 'P'::bpchar NOT NULL,
    estado character(1) DEFAULT 'A'::bpchar NOT NULL,
    usu_alta character varying(50) NOT NULL,
    fec_alta timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    usu_mod character varying(50),
    fec_mod timestamp without time zone,
    id_motivo_estado integer,
    CONSTRAINT ck_detalle_cantidad_producida CHECK ((cantidad_producida >= (0)::numeric)),
    CONSTRAINT ck_detalle_cantidad_solicitada CHECK ((cantidad_solicitada > (0)::numeric)),
    CONSTRAINT ck_detalle_estado CHECK ((estado_detalle = ANY (ARRAY['P'::bpchar, 'E'::bpchar, 'I'::bpchar, 'C'::bpchar, 'A'::bpchar]))),
    CONSTRAINT ck_detalle_estado_registro CHECK ((estado = ANY (ARRAY['A'::bpchar, 'I'::bpchar, 'E'::bpchar]))),
    CONSTRAINT ck_detalle_motivo_estado CHECK (((estado_detalle <> ALL (ARRAY['I'::bpchar, 'A'::bpchar])) OR (id_motivo_estado IS NOT NULL)))
);


ALTER TABLE produccion.detalle_orden_produccion OWNER TO postgres;

--
-- Name: detalle_orden_produccion_id_detalle_orden_seq; Type: SEQUENCE; Schema: produccion; Owner: postgres
--

ALTER TABLE produccion.detalle_orden_produccion ALTER COLUMN id_detalle_orden ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME produccion.detalle_orden_produccion_id_detalle_orden_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: material; Type: TABLE; Schema: produccion; Owner: postgres
--

CREATE TABLE produccion.material (
    id_material integer NOT NULL,
    codigo character varying(20) NOT NULL,
    nombre character varying(100) NOT NULL,
    descripcion character varying(255),
    estado character(1) DEFAULT 'A'::bpchar NOT NULL,
    usu_alta character varying(20) NOT NULL,
    fec_alta timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    usu_mod character varying(20),
    fec_mod timestamp without time zone,
    CONSTRAINT chk_material_estado CHECK ((estado = ANY (ARRAY['A'::bpchar, 'I'::bpchar, 'E'::bpchar])))
);


ALTER TABLE produccion.material OWNER TO postgres;

--
-- Name: material_id_material_seq; Type: SEQUENCE; Schema: produccion; Owner: postgres
--

ALTER TABLE produccion.material ALTER COLUMN id_material ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME produccion.material_id_material_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: orden_produccion; Type: TABLE; Schema: produccion; Owner: postgres
--

CREATE TABLE produccion.orden_produccion (
    id_orden_produccion integer NOT NULL,
    nro_orden character varying(15) NOT NULL,
    fecha_orden timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    id_solicitante integer NOT NULL,
    estado_op character(1) DEFAULT 'P'::bpchar NOT NULL,
    estado character(1) DEFAULT 'A'::bpchar NOT NULL,
    usu_alta character varying(50) NOT NULL,
    fec_alta timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    usu_mod character varying(50),
    fec_mod timestamp without time zone,
    id_motivo_estado integer,
    CONSTRAINT ck_orden_motivo_estado CHECK (((estado_op <> ALL (ARRAY['I'::bpchar, 'A'::bpchar])) OR (id_motivo_estado IS NOT NULL))),
    CONSTRAINT ck_orden_produccion_estado CHECK ((estado = ANY (ARRAY['A'::bpchar, 'I'::bpchar, 'E'::bpchar]))),
    CONSTRAINT ck_orden_produccion_estado_op CHECK ((estado_op = ANY (ARRAY['P'::bpchar, 'T'::bpchar, 'D'::bpchar, 'E'::bpchar, 'I'::bpchar, 'C'::bpchar, 'A'::bpchar])))
);


ALTER TABLE produccion.orden_produccion OWNER TO postgres;

--
-- Name: orden_produccion_id_orden_produccion_seq; Type: SEQUENCE; Schema: produccion; Owner: postgres
--

ALTER TABLE produccion.orden_produccion ALTER COLUMN id_orden_produccion ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME produccion.orden_produccion_id_orden_produccion_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: produccion; Type: TABLE; Schema: produccion; Owner: postgres
--

CREATE TABLE produccion.produccion (
    id_produccion integer NOT NULL,
    id_detalle_orden integer NOT NULL,
    id_responsable integer NOT NULL,
    fecha_inicio timestamp without time zone,
    fecha_fin timestamp without time zone,
    cantidad_producida numeric(15,3) DEFAULT 0 NOT NULL,
    estado_produccion character(1) DEFAULT 'P'::bpchar NOT NULL,
    estado character(1) DEFAULT 'A'::bpchar NOT NULL,
    usu_alta character varying(50) NOT NULL,
    fec_alta timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    usu_mod character varying(50),
    fec_mod timestamp without time zone,
    id_motivo_estado integer,
    CONSTRAINT ck_produccion_cantidad CHECK ((cantidad_producida > (0)::numeric)),
    CONSTRAINT ck_produccion_estado CHECK ((estado_produccion = ANY (ARRAY['P'::bpchar, 'E'::bpchar, 'C'::bpchar, 'A'::bpchar]))),
    CONSTRAINT ck_produccion_estado_registro CHECK ((estado = ANY (ARRAY['A'::bpchar, 'I'::bpchar, 'E'::bpchar]))),
    CONSTRAINT ck_produccion_motivo_anulacion CHECK (((estado_produccion <> 'A'::bpchar) OR (id_motivo_estado IS NOT NULL)))
);


ALTER TABLE produccion.produccion OWNER TO postgres;

--
-- Name: produccion_id_produccion_seq; Type: SEQUENCE; Schema: produccion; Owner: postgres
--

ALTER TABLE produccion.produccion ALTER COLUMN id_produccion ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME produccion.produccion_id_produccion_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: producto; Type: TABLE; Schema: produccion; Owner: postgres
--

CREATE TABLE produccion.producto (
    id_producto integer NOT NULL,
    codigo character varying(20) NOT NULL,
    nombre character varying(100) NOT NULL,
    id_tipo_producto integer NOT NULL,
    id_material integer NOT NULL,
    id_unidad_medida integer NOT NULL,
    es_biodegradable boolean DEFAULT false NOT NULL,
    estado character(1) DEFAULT 'A'::bpchar NOT NULL,
    usu_alta character varying(20) NOT NULL,
    fec_alta timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    usu_mod character varying(20),
    fec_mod timestamp without time zone,
    CONSTRAINT chk_producto_estado CHECK ((estado = ANY (ARRAY['A'::bpchar, 'I'::bpchar, 'E'::bpchar])))
);


ALTER TABLE produccion.producto OWNER TO postgres;

--
-- Name: producto_id_producto_seq; Type: SEQUENCE; Schema: produccion; Owner: postgres
--

ALTER TABLE produccion.producto ALTER COLUMN id_producto ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME produccion.producto_id_producto_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: seq_codigo_producto; Type: SEQUENCE; Schema: produccion; Owner: postgres
--

CREATE SEQUENCE produccion.seq_codigo_producto
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE produccion.seq_codigo_producto OWNER TO postgres;

--
-- Name: seq_nro_orden; Type: SEQUENCE; Schema: produccion; Owner: postgres
--

CREATE SEQUENCE produccion.seq_nro_orden
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE produccion.seq_nro_orden OWNER TO postgres;

--
-- Name: tipo_producto; Type: TABLE; Schema: produccion; Owner: postgres
--

CREATE TABLE produccion.tipo_producto (
    id_tipo_producto integer NOT NULL,
    codigo character varying(20) NOT NULL,
    nombre character varying(100) NOT NULL,
    descripcion character varying(255),
    estado character(1) DEFAULT 'A'::bpchar NOT NULL,
    usu_alta character varying(20) NOT NULL,
    fec_alta timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    usu_mod character varying(20),
    fec_mod timestamp without time zone,
    CONSTRAINT chk_tipo_producto_estado CHECK ((estado = ANY (ARRAY['A'::bpchar, 'I'::bpchar, 'E'::bpchar])))
);


ALTER TABLE produccion.tipo_producto OWNER TO postgres;

--
-- Name: tipo_producto_id_tipo_producto_seq; Type: SEQUENCE; Schema: produccion; Owner: postgres
--

ALTER TABLE produccion.tipo_producto ALTER COLUMN id_tipo_producto ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME produccion.tipo_producto_id_tipo_producto_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: unidad_medida; Type: TABLE; Schema: produccion; Owner: postgres
--

CREATE TABLE produccion.unidad_medida (
    id_unidad_medida integer NOT NULL,
    codigo character varying(20) NOT NULL,
    nombre character varying(100) NOT NULL,
    descripcion character varying(255),
    estado character(1) DEFAULT 'A'::bpchar NOT NULL,
    usu_alta character varying(20) NOT NULL,
    fec_alta timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    usu_mod character varying(20),
    fec_mod timestamp without time zone,
    CONSTRAINT chk_unidad_medida_estado CHECK ((estado = ANY (ARRAY['A'::bpchar, 'I'::bpchar, 'E'::bpchar])))
);


ALTER TABLE produccion.unidad_medida OWNER TO postgres;

--
-- Name: unidad_medida_id_unidad_medida_seq; Type: SEQUENCE; Schema: produccion; Owner: postgres
--

ALTER TABLE produccion.unidad_medida ALTER COLUMN id_unidad_medida ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME produccion.unidad_medida_id_unidad_medida_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: motivo_estado; Type: TABLE; Schema: sistema; Owner: postgres
--

CREATE TABLE sistema.motivo_estado (
    id_motivo_estado integer NOT NULL,
    codigo character varying(50) NOT NULL,
    nombre character varying(100) NOT NULL,
    descripcion character varying(250),
    estado character(1) DEFAULT 'A'::bpchar NOT NULL,
    usu_alta character varying(50) NOT NULL,
    fec_alta timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    usu_mod character varying(50),
    fec_mod timestamp without time zone,
    CONSTRAINT ck_motivo_estado_estado CHECK ((estado = ANY (ARRAY['A'::bpchar, 'I'::bpchar, 'E'::bpchar])))
);


ALTER TABLE sistema.motivo_estado OWNER TO postgres;

--
-- Name: motivo_estado_id_motivo_estado_seq; Type: SEQUENCE; Schema: sistema; Owner: postgres
--

ALTER TABLE sistema.motivo_estado ALTER COLUMN id_motivo_estado ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME sistema.motivo_estado_id_motivo_estado_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: roles; Type: TABLE; Schema: usuarios; Owner: postgres
--

CREATE TABLE usuarios.roles (
    id_rol integer CONSTRAINT rol_id_rol_not_null NOT NULL,
    nombre character varying(100) CONSTRAINT rol_nombre_not_null NOT NULL,
    descripcion character varying(255),
    estado character(1) DEFAULT 'A'::bpchar CONSTRAINT rol_estado_not_null NOT NULL,
    usu_alta character varying(20) CONSTRAINT rol_usu_alta_not_null NOT NULL,
    fec_alta timestamp without time zone DEFAULT CURRENT_TIMESTAMP CONSTRAINT rol_fec_alta_not_null NOT NULL,
    usu_mod character varying(20),
    fec_mod timestamp without time zone,
    CONSTRAINT chk_rol_estado CHECK ((estado = ANY (ARRAY['A'::bpchar, 'I'::bpchar, 'E'::bpchar])))
);


ALTER TABLE usuarios.roles OWNER TO postgres;

--
-- Name: rol_id_rol_seq; Type: SEQUENCE; Schema: usuarios; Owner: postgres
--

ALTER TABLE usuarios.roles ALTER COLUMN id_rol ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME usuarios.rol_id_rol_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: usuarios; Type: TABLE; Schema: usuarios; Owner: postgres
--

CREATE TABLE usuarios.usuarios (
    id_usuario integer CONSTRAINT usuario_id_usuario_not_null NOT NULL,
    id_rol integer CONSTRAINT usuario_id_rol_not_null NOT NULL,
    nombre character varying(100) CONSTRAINT usuario_nombre_not_null NOT NULL,
    apellido character varying(100) CONSTRAINT usuario_apellido_not_null NOT NULL,
    dni character varying(20) CONSTRAINT usuario_dni_not_null NOT NULL,
    email character varying(150),
    usuario_login character varying(20) CONSTRAINT usuario_usuario_login_not_null NOT NULL,
    password_hash character varying(255) CONSTRAINT usuario_password_hash_not_null NOT NULL,
    estado character(1) DEFAULT 'A'::bpchar CONSTRAINT usuario_estado_not_null NOT NULL,
    usu_alta character varying(20) CONSTRAINT usuario_usu_alta_not_null NOT NULL,
    fec_alta timestamp without time zone DEFAULT CURRENT_TIMESTAMP CONSTRAINT usuario_fec_alta_not_null NOT NULL,
    usu_mod character varying(20),
    fec_mod timestamp without time zone,
    CONSTRAINT chk_usuario_estado CHECK ((estado = ANY (ARRAY['A'::bpchar, 'I'::bpchar, 'E'::bpchar])))
);


ALTER TABLE usuarios.usuarios OWNER TO postgres;

--
-- Name: usuario_id_usuario_seq; Type: SEQUENCE; Schema: usuarios; Owner: postgres
--

ALTER TABLE usuarios.usuarios ALTER COLUMN id_usuario ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME usuarios.usuario_id_usuario_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Data for Name: detalle_orden_produccion; Type: TABLE DATA; Schema: produccion; Owner: postgres
--

COPY produccion.detalle_orden_produccion (id_detalle_orden, id_orden_produccion, id_producto, cantidad_solicitada, cantidad_producida, fecha_limite, estado_detalle, estado, usu_alta, fec_alta, usu_mod, fec_mod, id_motivo_estado) FROM stdin;
2	1	4	10000.000	0.000	2026-09-05	P	A	BP38636078	2026-08-30 18:07:01.466996	\N	\N	\N
1	1	1	20000.000	20000.000	2026-09-05	C	A	BP38636078	2026-08-30 18:07:01.466996	\N	\N	\N
\.


--
-- Data for Name: material; Type: TABLE DATA; Schema: produccion; Owner: postgres
--

COPY produccion.material (id_material, codigo, nombre, descripcion, estado, usu_alta, fec_alta, usu_mod, fec_mod) FROM stdin;
1	PEBD	Polietileno de baja densidad	Material PEBD	A	BP38636078	2026-08-30 16:09:06.800733	\N	\N
2	PEAD	Polietileno de alta densidad	Material PEAD	A	BP38636078	2026-08-30 16:09:06.800733	\N	\N
3	PP	Polipropileno	Material PP	A	BP38636078	2026-08-30 16:09:06.800733	\N	\N
\.


--
-- Data for Name: orden_produccion; Type: TABLE DATA; Schema: produccion; Owner: postgres
--

COPY produccion.orden_produccion (id_orden_produccion, nro_orden, fecha_orden, id_solicitante, estado_op, estado, usu_alta, fec_alta, usu_mod, fec_mod, id_motivo_estado) FROM stdin;
1	OP-000001	2026-08-30 17:51:57.545975	1	P	A	BP38636078	2026-08-30 17:51:57.545975	\N	\N	\N
\.


--
-- Data for Name: produccion; Type: TABLE DATA; Schema: produccion; Owner: postgres
--

COPY produccion.produccion (id_produccion, id_detalle_orden, id_responsable, fecha_inicio, fecha_fin, cantidad_producida, estado_produccion, estado, usu_alta, fec_alta, usu_mod, fec_mod, id_motivo_estado) FROM stdin;
1	1	2	2026-08-30 18:45:50.657605	2026-08-30 18:46:07.528945	8000.000	C	A	BP38636078	2026-08-30 18:25:09.23619	\N	\N	\N
2	1	1	\N	\N	5000.000	E	A	BP38636078	2026-08-30 19:45:38.672164	\N	\N	\N
4	1	1	\N	\N	2.000	C	A	BP38636078	2026-08-30 19:53:31.520988	\N	\N	\N
5	1	1	\N	\N	6998.000	C	A	BP38636078	2026-08-30 19:57:55.007002	\N	\N	\N
\.


--
-- Data for Name: producto; Type: TABLE DATA; Schema: produccion; Owner: postgres
--

COPY produccion.producto (id_producto, codigo, nombre, id_tipo_producto, id_material, id_unidad_medida, es_biodegradable, estado, usu_alta, fec_alta, usu_mod, fec_mod) FROM stdin;
1	PBP-000001	Bolsa 40x60	1	1	1	f	A	BP38636078	2026-08-30 16:11:16.599017	\N	\N
4	PBP-000002	Bolsa 50x70	1	1	1	f	A	BP38636078	2026-08-30 16:26:30.836916	\N	\N
5	PBP-000003	Bolsa 60x80	1	1	1	t	A	BP38636078	2026-08-30 16:29:23.549201	\N	\N
6	PBP-000004	Rollo PEBD	2	1	4	f	A	BP38636078	2026-08-30 16:29:53.572611	\N	\N
7	PBP-000005	Rollo PEBD	2	1	4	f	A	BP38636078	2026-08-30 16:32:16.900198	\N	\N
8	PBP-000006	Producto con c├│digo manual	1	1	1	f	A	BP38636078	2026-08-30 16:32:38.444597	\N	\N
\.


--
-- Data for Name: tipo_producto; Type: TABLE DATA; Schema: produccion; Owner: postgres
--

COPY produccion.tipo_producto (id_tipo_producto, codigo, nombre, descripcion, estado, usu_alta, fec_alta, usu_mod, fec_mod) FROM stdin;
1	BOL	Bolsa	Bolsas pl├ísticas	A	BP38636078	2026-08-30 16:08:07.541454	\N	\N
2	BOB	Bobina	Bobinas de material pl├ístico	A	BP38636078	2026-08-30 16:08:07.541454	\N	\N
3	ROL	Rollo	Productos presentados en rollo	A	BP38636078	2026-08-30 16:08:07.541454	\N	\N
\.


--
-- Data for Name: unidad_medida; Type: TABLE DATA; Schema: produccion; Owner: postgres
--

COPY produccion.unidad_medida (id_unidad_medida, codigo, nombre, descripcion, estado, usu_alta, fec_alta, usu_mod, fec_mod) FROM stdin;
1	UN	Unidad	Unidad individual	A	BP38636078	2026-08-30 16:10:18.724843	\N	\N
2	KG	Kilogramo	Peso en kilogramos	A	BP38636078	2026-08-30 16:10:18.724843	\N	\N
3	MT	Metro	Longitud en metros	A	BP38636078	2026-08-30 16:10:18.724843	\N	\N
4	ROL	Rollo	Producto comercializado por rollo	A	BP38636078	2026-08-30 16:10:18.724843	\N	\N
\.


--
-- Data for Name: motivo_estado; Type: TABLE DATA; Schema: sistema; Owner: postgres
--

COPY sistema.motivo_estado (id_motivo_estado, codigo, nombre, descripcion, estado, usu_alta, fec_alta, usu_mod, fec_mod) FROM stdin;
1	FALTA_MATERIA_PRIMA	Falta de materia prima	No existe materia prima suficiente para continuar la producci├│n.	A	BP38636078	2026-08-30 19:26:25.400333	\N	\N
2	FALLA_MAQUINARIA	Falla de maquinaria	Una m├íquina o equipo impide continuar con la producci├│n.	A	BP38636078	2026-08-30 19:26:25.400333	\N	\N
3	FALTA_PERSONAL	Falta de personal	No existe personal disponible para continuar la producci├│n.	A	BP38636078	2026-08-30 19:26:25.400333	\N	\N
4	IMPOSIBILIDAD_TECNICA	Imposibilidad t├®cnica	No es t├®cnicamente posible continuar con la fabricaci├│n.	A	BP38636078	2026-08-30 19:26:25.400333	\N	\N
5	SOLICITUD_ADMINISTRACION	Solicitud de Administraci├│n	Administraci├│n solicita finalizar la producci├│n u orden sin completar.	A	BP38636078	2026-08-30 19:26:25.400333	\N	\N
6	OTRO	Otro	Otro motivo no contemplado anteriormente.	A	BP38636078	2026-08-30 19:26:25.400333	\N	\N
\.


--
-- Data for Name: roles; Type: TABLE DATA; Schema: usuarios; Owner: postgres
--

COPY usuarios.roles (id_rol, nombre, descripcion, estado, usu_alta, fec_alta, usu_mod, fec_mod) FROM stdin;
1	Administrador	Acceso total al sistema	A	BP38636078	2026-08-30 14:44:54.264327	\N	\N
\.


--
-- Data for Name: usuarios; Type: TABLE DATA; Schema: usuarios; Owner: postgres
--

COPY usuarios.usuarios (id_usuario, id_rol, nombre, apellido, dni, email, usuario_login, password_hash, estado, usu_alta, fec_alta, usu_mod, fec_mod) FROM stdin;
1	1	Walter	Olivera	38636078	walter@brotherplast.com	BP38636078	$2b$12$ejemplo_hash_de_prueba	A	BP38636078	2026-08-30 15:05:04.09434	\N	\N
2	1	Andres	Liporace	30000000	Andres@brotherplast.com	BP30000000	$2b$12$ejemplo_hash_de_prueba	A	BP30000000	2026-08-30 15:14:25.487654	\N	\N
\.


--
-- Name: detalle_orden_produccion_id_detalle_orden_seq; Type: SEQUENCE SET; Schema: produccion; Owner: postgres
--

SELECT pg_catalog.setval('produccion.detalle_orden_produccion_id_detalle_orden_seq', 2, true);


--
-- Name: material_id_material_seq; Type: SEQUENCE SET; Schema: produccion; Owner: postgres
--

SELECT pg_catalog.setval('produccion.material_id_material_seq', 3, true);


--
-- Name: orden_produccion_id_orden_produccion_seq; Type: SEQUENCE SET; Schema: produccion; Owner: postgres
--

SELECT pg_catalog.setval('produccion.orden_produccion_id_orden_produccion_seq', 1, true);


--
-- Name: produccion_id_produccion_seq; Type: SEQUENCE SET; Schema: produccion; Owner: postgres
--

SELECT pg_catalog.setval('produccion.produccion_id_produccion_seq', 5, true);


--
-- Name: producto_id_producto_seq; Type: SEQUENCE SET; Schema: produccion; Owner: postgres
--

SELECT pg_catalog.setval('produccion.producto_id_producto_seq', 9, true);


--
-- Name: seq_codigo_producto; Type: SEQUENCE SET; Schema: produccion; Owner: postgres
--

SELECT pg_catalog.setval('produccion.seq_codigo_producto', 7, true);


--
-- Name: seq_nro_orden; Type: SEQUENCE SET; Schema: produccion; Owner: postgres
--

SELECT pg_catalog.setval('produccion.seq_nro_orden', 1, true);


--
-- Name: tipo_producto_id_tipo_producto_seq; Type: SEQUENCE SET; Schema: produccion; Owner: postgres
--

SELECT pg_catalog.setval('produccion.tipo_producto_id_tipo_producto_seq', 3, true);


--
-- Name: unidad_medida_id_unidad_medida_seq; Type: SEQUENCE SET; Schema: produccion; Owner: postgres
--

SELECT pg_catalog.setval('produccion.unidad_medida_id_unidad_medida_seq', 4, true);


--
-- Name: motivo_estado_id_motivo_estado_seq; Type: SEQUENCE SET; Schema: sistema; Owner: postgres
--

SELECT pg_catalog.setval('sistema.motivo_estado_id_motivo_estado_seq', 6, true);


--
-- Name: rol_id_rol_seq; Type: SEQUENCE SET; Schema: usuarios; Owner: postgres
--

SELECT pg_catalog.setval('usuarios.rol_id_rol_seq', 1, true);


--
-- Name: usuario_id_usuario_seq; Type: SEQUENCE SET; Schema: usuarios; Owner: postgres
--

SELECT pg_catalog.setval('usuarios.usuario_id_usuario_seq', 2, true);


--
-- Name: detalle_orden_produccion pk_detalle_orden_produccion; Type: CONSTRAINT; Schema: produccion; Owner: postgres
--

ALTER TABLE ONLY produccion.detalle_orden_produccion
    ADD CONSTRAINT pk_detalle_orden_produccion PRIMARY KEY (id_detalle_orden);


--
-- Name: material pk_material; Type: CONSTRAINT; Schema: produccion; Owner: postgres
--

ALTER TABLE ONLY produccion.material
    ADD CONSTRAINT pk_material PRIMARY KEY (id_material);


--
-- Name: orden_produccion pk_orden_produccion; Type: CONSTRAINT; Schema: produccion; Owner: postgres
--

ALTER TABLE ONLY produccion.orden_produccion
    ADD CONSTRAINT pk_orden_produccion PRIMARY KEY (id_orden_produccion);


--
-- Name: produccion pk_produccion; Type: CONSTRAINT; Schema: produccion; Owner: postgres
--

ALTER TABLE ONLY produccion.produccion
    ADD CONSTRAINT pk_produccion PRIMARY KEY (id_produccion);


--
-- Name: producto pk_producto; Type: CONSTRAINT; Schema: produccion; Owner: postgres
--

ALTER TABLE ONLY produccion.producto
    ADD CONSTRAINT pk_producto PRIMARY KEY (id_producto);


--
-- Name: tipo_producto pk_tipo_producto; Type: CONSTRAINT; Schema: produccion; Owner: postgres
--

ALTER TABLE ONLY produccion.tipo_producto
    ADD CONSTRAINT pk_tipo_producto PRIMARY KEY (id_tipo_producto);


--
-- Name: unidad_medida pk_unidad_medida; Type: CONSTRAINT; Schema: produccion; Owner: postgres
--

ALTER TABLE ONLY produccion.unidad_medida
    ADD CONSTRAINT pk_unidad_medida PRIMARY KEY (id_unidad_medida);


--
-- Name: detalle_orden_produccion uq_detalle_orden_producto; Type: CONSTRAINT; Schema: produccion; Owner: postgres
--

ALTER TABLE ONLY produccion.detalle_orden_produccion
    ADD CONSTRAINT uq_detalle_orden_producto UNIQUE (id_orden_produccion, id_producto);


--
-- Name: material uq_material_codigo; Type: CONSTRAINT; Schema: produccion; Owner: postgres
--

ALTER TABLE ONLY produccion.material
    ADD CONSTRAINT uq_material_codigo UNIQUE (codigo);


--
-- Name: orden_produccion uq_orden_produccion_nro; Type: CONSTRAINT; Schema: produccion; Owner: postgres
--

ALTER TABLE ONLY produccion.orden_produccion
    ADD CONSTRAINT uq_orden_produccion_nro UNIQUE (nro_orden);


--
-- Name: producto uq_producto_codigo; Type: CONSTRAINT; Schema: produccion; Owner: postgres
--

ALTER TABLE ONLY produccion.producto
    ADD CONSTRAINT uq_producto_codigo UNIQUE (codigo);


--
-- Name: tipo_producto uq_tipo_producto_codigo; Type: CONSTRAINT; Schema: produccion; Owner: postgres
--

ALTER TABLE ONLY produccion.tipo_producto
    ADD CONSTRAINT uq_tipo_producto_codigo UNIQUE (codigo);


--
-- Name: unidad_medida uq_unidad_medida_codigo; Type: CONSTRAINT; Schema: produccion; Owner: postgres
--

ALTER TABLE ONLY produccion.unidad_medida
    ADD CONSTRAINT uq_unidad_medida_codigo UNIQUE (codigo);


--
-- Name: motivo_estado pk_motivo_estado; Type: CONSTRAINT; Schema: sistema; Owner: postgres
--

ALTER TABLE ONLY sistema.motivo_estado
    ADD CONSTRAINT pk_motivo_estado PRIMARY KEY (id_motivo_estado);


--
-- Name: motivo_estado uq_motivo_estado_codigo; Type: CONSTRAINT; Schema: sistema; Owner: postgres
--

ALTER TABLE ONLY sistema.motivo_estado
    ADD CONSTRAINT uq_motivo_estado_codigo UNIQUE (codigo);


--
-- Name: roles pk_rol; Type: CONSTRAINT; Schema: usuarios; Owner: postgres
--

ALTER TABLE ONLY usuarios.roles
    ADD CONSTRAINT pk_rol PRIMARY KEY (id_rol);


--
-- Name: usuarios pk_usuario; Type: CONSTRAINT; Schema: usuarios; Owner: postgres
--

ALTER TABLE ONLY usuarios.usuarios
    ADD CONSTRAINT pk_usuario PRIMARY KEY (id_usuario);


--
-- Name: usuarios uq_usuario_dni; Type: CONSTRAINT; Schema: usuarios; Owner: postgres
--

ALTER TABLE ONLY usuarios.usuarios
    ADD CONSTRAINT uq_usuario_dni UNIQUE (dni);


--
-- Name: usuarios uq_usuario_email; Type: CONSTRAINT; Schema: usuarios; Owner: postgres
--

ALTER TABLE ONLY usuarios.usuarios
    ADD CONSTRAINT uq_usuario_email UNIQUE (email);


--
-- Name: usuarios uq_usuario_login; Type: CONSTRAINT; Schema: usuarios; Owner: postgres
--

ALTER TABLE ONLY usuarios.usuarios
    ADD CONSTRAINT uq_usuario_login UNIQUE (usuario_login);


--
-- Name: produccion trg_actualizar_detalle_produccion; Type: TRIGGER; Schema: produccion; Owner: postgres
--

CREATE TRIGGER trg_actualizar_detalle_produccion AFTER INSERT OR DELETE OR UPDATE OF cantidad_producida, estado_produccion ON produccion.produccion FOR EACH ROW EXECUTE FUNCTION produccion.fn_actualizar_detalle_produccion();


--
-- Name: produccion trg_control_estado_produccion; Type: TRIGGER; Schema: produccion; Owner: postgres
--

CREATE TRIGGER trg_control_estado_produccion BEFORE UPDATE OF estado_produccion ON produccion.produccion FOR EACH ROW EXECUTE FUNCTION produccion.fn_control_estado_produccion();


--
-- Name: orden_produccion trg_orden_produccion_nro; Type: TRIGGER; Schema: produccion; Owner: postgres
--

CREATE TRIGGER trg_orden_produccion_nro BEFORE INSERT ON produccion.orden_produccion FOR EACH ROW EXECUTE FUNCTION produccion.generar_nro_orden();


--
-- Name: producto trg_producto_codigo; Type: TRIGGER; Schema: produccion; Owner: postgres
--

CREATE TRIGGER trg_producto_codigo BEFORE INSERT ON produccion.producto FOR EACH ROW EXECUTE FUNCTION produccion.generar_codigo_producto();


--
-- Name: produccion trg_validar_cantidad_producida; Type: TRIGGER; Schema: produccion; Owner: postgres
--

CREATE TRIGGER trg_validar_cantidad_producida BEFORE INSERT OR UPDATE OF cantidad_producida, estado_produccion ON produccion.produccion FOR EACH ROW EXECUTE FUNCTION produccion.fn_validar_cantidad_producida();


--
-- Name: detalle_orden_produccion fk_detalle_orden; Type: FK CONSTRAINT; Schema: produccion; Owner: postgres
--

ALTER TABLE ONLY produccion.detalle_orden_produccion
    ADD CONSTRAINT fk_detalle_orden FOREIGN KEY (id_orden_produccion) REFERENCES produccion.orden_produccion(id_orden_produccion);


--
-- Name: detalle_orden_produccion fk_detalle_orden_motivo_estado; Type: FK CONSTRAINT; Schema: produccion; Owner: postgres
--

ALTER TABLE ONLY produccion.detalle_orden_produccion
    ADD CONSTRAINT fk_detalle_orden_motivo_estado FOREIGN KEY (id_motivo_estado) REFERENCES sistema.motivo_estado(id_motivo_estado);


--
-- Name: detalle_orden_produccion fk_detalle_producto; Type: FK CONSTRAINT; Schema: produccion; Owner: postgres
--

ALTER TABLE ONLY produccion.detalle_orden_produccion
    ADD CONSTRAINT fk_detalle_producto FOREIGN KEY (id_producto) REFERENCES produccion.producto(id_producto);


--
-- Name: orden_produccion fk_orden_produccion_motivo_estado; Type: FK CONSTRAINT; Schema: produccion; Owner: postgres
--

ALTER TABLE ONLY produccion.orden_produccion
    ADD CONSTRAINT fk_orden_produccion_motivo_estado FOREIGN KEY (id_motivo_estado) REFERENCES sistema.motivo_estado(id_motivo_estado);


--
-- Name: orden_produccion fk_orden_produccion_solicitante; Type: FK CONSTRAINT; Schema: produccion; Owner: postgres
--

ALTER TABLE ONLY produccion.orden_produccion
    ADD CONSTRAINT fk_orden_produccion_solicitante FOREIGN KEY (id_solicitante) REFERENCES usuarios.usuarios(id_usuario);


--
-- Name: produccion fk_produccion_detalle; Type: FK CONSTRAINT; Schema: produccion; Owner: postgres
--

ALTER TABLE ONLY produccion.produccion
    ADD CONSTRAINT fk_produccion_detalle FOREIGN KEY (id_detalle_orden) REFERENCES produccion.detalle_orden_produccion(id_detalle_orden);


--
-- Name: produccion fk_produccion_motivo_estado; Type: FK CONSTRAINT; Schema: produccion; Owner: postgres
--

ALTER TABLE ONLY produccion.produccion
    ADD CONSTRAINT fk_produccion_motivo_estado FOREIGN KEY (id_motivo_estado) REFERENCES sistema.motivo_estado(id_motivo_estado);


--
-- Name: produccion fk_produccion_responsable; Type: FK CONSTRAINT; Schema: produccion; Owner: postgres
--

ALTER TABLE ONLY produccion.produccion
    ADD CONSTRAINT fk_produccion_responsable FOREIGN KEY (id_responsable) REFERENCES usuarios.usuarios(id_usuario);


--
-- Name: producto fk_producto_material; Type: FK CONSTRAINT; Schema: produccion; Owner: postgres
--

ALTER TABLE ONLY produccion.producto
    ADD CONSTRAINT fk_producto_material FOREIGN KEY (id_material) REFERENCES produccion.material(id_material);


--
-- Name: producto fk_producto_tipo; Type: FK CONSTRAINT; Schema: produccion; Owner: postgres
--

ALTER TABLE ONLY produccion.producto
    ADD CONSTRAINT fk_producto_tipo FOREIGN KEY (id_tipo_producto) REFERENCES produccion.tipo_producto(id_tipo_producto);


--
-- Name: producto fk_producto_unidad; Type: FK CONSTRAINT; Schema: produccion; Owner: postgres
--

ALTER TABLE ONLY produccion.producto
    ADD CONSTRAINT fk_producto_unidad FOREIGN KEY (id_unidad_medida) REFERENCES produccion.unidad_medida(id_unidad_medida);


--
-- Name: usuarios fk_usuario_rol; Type: FK CONSTRAINT; Schema: usuarios; Owner: postgres
--

ALTER TABLE ONLY usuarios.usuarios
    ADD CONSTRAINT fk_usuario_rol FOREIGN KEY (id_rol) REFERENCES usuarios.roles(id_rol);


--
-- PostgreSQL database dump complete
--

\unrestrict AHfXSkeIo9IuIiF8wiOhZJQ9j6SFMsDbxdYOjpOjsIt38tmP756hMC0gtNmshkS


