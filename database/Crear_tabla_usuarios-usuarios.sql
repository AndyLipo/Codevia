CREATE TABLE usuarios.usuario (
    id_usuario INTEGER GENERATED ALWAYS AS IDENTITY,

    id_rol INTEGER NOT NULL,

    nombre VARCHAR(100) NOT NULL,

    apellido VARCHAR(100) NOT NULL,
	
	dni VARCHAR(20) NOT NULL,

    email VARCHAR(150),

    usuario_login VARCHAR(20) NOT NULL,

    password_hash VARCHAR(255) NOT NULL,

    estado CHAR(1) NOT NULL DEFAULT 'A',

    usu_alta VARCHAR(20) NOT NULL,

    fec_alta TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    usu_mod VARCHAR(20),

    fec_mod TIMESTAMP,

    CONSTRAINT pk_usuario
        PRIMARY KEY (id_usuario),

    CONSTRAINT fk_usuario_rol
        FOREIGN KEY (id_rol)
        REFERENCES usuarios.rol (id_rol),

    CONSTRAINT uq_usuario_dni
        UNIQUE (dni),

    CONSTRAINT uq_usuario_email
        UNIQUE (email),

    CONSTRAINT uq_usuario_login
        UNIQUE (usuario_login),

    CONSTRAINT chk_usuario_estado
        CHECK (estado IN ('A', 'I', 'E'))
);