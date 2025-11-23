-- CreateTable
CREATE TABLE "Rol" (
    "id_rol" SERIAL NOT NULL,
    "nombre_rol" VARCHAR(50) NOT NULL,

    CONSTRAINT "Rol_pkey" PRIMARY KEY ("id_rol")
);

-- CreateTable
CREATE TABLE "EstadoUsuario" (
    "id_estado_usuario" SERIAL NOT NULL,
    "nombre_estado" VARCHAR(20) NOT NULL,
    "descripcion" VARCHAR(255),

    CONSTRAINT "EstadoUsuario_pkey" PRIMARY KEY ("id_estado_usuario")
);

-- CreateTable
CREATE TABLE "TokenRestablecimiento" (
    "id_token" SERIAL NOT NULL,
    "codigo_token" VARCHAR(200) NOT NULL,
    "id_usuario" INTEGER NOT NULL,
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_expiracion" TIMESTAMP(3) NOT NULL,
    "fecha_uso" TIMESTAMP(3),

    CONSTRAINT "TokenRestablecimiento_pkey" PRIMARY KEY ("id_token")
);

-- CreateTable
CREATE TABLE "Usuario" (
    "id_usuario" SERIAL NOT NULL,
    "rut" VARCHAR(20) NOT NULL,
    "nombre" VARCHAR(100) NOT NULL,
    "apellido" VARCHAR(100) NOT NULL,
    "email" VARCHAR(150) NOT NULL,
    "telefono" VARCHAR(25),
    "fecha_registro" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "licencia_con" VARCHAR(100),
    "username" VARCHAR(50) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "id_estado_usuario" INTEGER NOT NULL,

    CONSTRAINT "Usuario_pkey" PRIMARY KEY ("id_usuario")
);

-- CreateTable
CREATE TABLE "UsuarioRol" (
    "id_usuario" INTEGER NOT NULL,
    "id_rol" INTEGER NOT NULL,
    "estado" VARCHAR(10),
    "fecha_inicio" DATE,
    "fecha_fin" DATE,

    CONSTRAINT "UsuarioRol_pkey" PRIMARY KEY ("id_usuario","id_rol")
);

-- CreateTable
CREATE TABLE "EstadoBus" (
    "id_estado_bus" SERIAL NOT NULL,
    "nombre_estado" VARCHAR(20) NOT NULL,
    "descripcion" VARCHAR(255),

    CONSTRAINT "EstadoBus_pkey" PRIMARY KEY ("id_estado_bus")
);

-- CreateTable
CREATE TABLE "Bus" (
    "id_bus" SERIAL NOT NULL,
    "patente" VARCHAR(6) NOT NULL,
    "modelo" VARCHAR(50),
    "marca" VARCHAR(100),
    "anio" INTEGER,
    "capacidad" INTEGER,
    "kilometraje" INTEGER,
    "combustible" VARCHAR(20),
    "fecha_revision_tecnica" DATE,
    "fecha_extintor" DATE,
    "id_estado_bus" INTEGER NOT NULL,

    CONSTRAINT "Bus_pkey" PRIMARY KEY ("id_bus")
);

-- CreateTable
CREATE TABLE "EstadoTurno" (
    "id_estado_turno" SERIAL NOT NULL,
    "nombre_estado" VARCHAR(20) NOT NULL,
    "descripcion" VARCHAR(255),

    CONSTRAINT "EstadoTurno_pkey" PRIMARY KEY ("id_estado_turno")
);

-- CreateTable
CREATE TABLE "TurnoConductor" (
    "id_turno" SERIAL NOT NULL,
    "id_usuario" INTEGER NOT NULL,
    "id_bus" INTEGER NOT NULL,
    "hora_inicio" TIMESTAMP(3) NOT NULL,
    "hora_fin" TIMESTAMP(3),
    "fecha" DATE NOT NULL,
    "id_estado_turno" INTEGER NOT NULL,
    "titulo" VARCHAR(150),
    "descripcion" TEXT,
    "ruta_origen" VARCHAR(100),
    "ruta_fin" VARCHAR(100),

    CONSTRAINT "TurnoConductor_pkey" PRIMARY KEY ("id_turno")
);

-- CreateTable
CREATE TABLE "TipoTaller" (
    "id_tipo_taller" SERIAL NOT NULL,
    "nombre_tipo" VARCHAR(100) NOT NULL,
    "descripcion" VARCHAR(255),
    "especialidad" VARCHAR(100),

    CONSTRAINT "TipoTaller_pkey" PRIMARY KEY ("id_tipo_taller")
);

-- CreateTable
CREATE TABLE "Taller" (
    "id_taller" SERIAL NOT NULL,
    "nombre" VARCHAR(100) NOT NULL,
    "contacto" VARCHAR(100),
    "direccion" VARCHAR(200),
    "email" VARCHAR(100),
    "id_tipo_taller" INTEGER NOT NULL,

    CONSTRAINT "Taller_pkey" PRIMARY KEY ("id_taller")
);

-- CreateTable
CREATE TABLE "Mecanico" (
    "id_mecanico" SERIAL NOT NULL,
    "id_taller" INTEGER NOT NULL,
    "nombre" VARCHAR(100) NOT NULL,
    "apellido" VARCHAR(100) NOT NULL,

    CONSTRAINT "Mecanico_pkey" PRIMARY KEY ("id_mecanico")
);

-- CreateTable
CREATE TABLE "EstadoMantenimiento" (
    "id_estado_mantenimiento" SERIAL NOT NULL,
    "nombre_estado" VARCHAR(20) NOT NULL,
    "descripcion" VARCHAR(255),

    CONSTRAINT "EstadoMantenimiento_pkey" PRIMARY KEY ("id_estado_mantenimiento")
);

-- CreateTable
CREATE TABLE "TipoMantenimiento" (
    "id_tipo_mantenimiento" SERIAL NOT NULL,
    "nombre_tipo" VARCHAR(100) NOT NULL,
    "descripcion" VARCHAR(255),
    "categoria" VARCHAR(100),

    CONSTRAINT "TipoMantenimiento_pkey" PRIMARY KEY ("id_tipo_mantenimiento")
);

-- CreateTable
CREATE TABLE "Mantenimiento" (
    "id_mantenimiento" SERIAL NOT NULL,
    "id_bus" INTEGER NOT NULL,
    "id_taller" INTEGER NOT NULL,
    "id_tipo_mantenimiento" INTEGER NOT NULL,
    "id_estado_mantenimiento" INTEGER NOT NULL,
    "fecha" DATE NOT NULL,
    "observaciones" TEXT,
    "costo_repuestos" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "costo_mano_obra" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "costo_total" DECIMAL(12,2) NOT NULL DEFAULT 0,

    CONSTRAINT "Mantenimiento_pkey" PRIMARY KEY ("id_mantenimiento")
);

-- CreateTable
CREATE TABLE "MecanicoMantenimiento" (
    "id_mecanico" INTEGER NOT NULL,
    "id_mantenimiento" INTEGER NOT NULL,
    "actividad" VARCHAR(255),

    CONSTRAINT "MecanicoMantenimiento_pkey" PRIMARY KEY ("id_mecanico","id_mantenimiento")
);

-- CreateTable
CREATE TABLE "EstadoRepuesto" (
    "id_estado_repuesto" SERIAL NOT NULL,
    "nombre_estado" VARCHAR(20) NOT NULL,
    "descripcion" VARCHAR(255),

    CONSTRAINT "EstadoRepuesto_pkey" PRIMARY KEY ("id_estado_repuesto")
);

-- CreateTable
CREATE TABLE "TipoRepuesto" (
    "id_tipo_repuesto" SERIAL NOT NULL,
    "nombre_tipo" VARCHAR(100) NOT NULL,
    "descripcion" VARCHAR(255),
    "categoria" VARCHAR(100),

    CONSTRAINT "TipoRepuesto_pkey" PRIMARY KEY ("id_tipo_repuesto")
);

-- CreateTable
CREATE TABLE "ProveedorRepuesto" (
    "id_proveedor" SERIAL NOT NULL,
    "nombre" VARCHAR(100) NOT NULL,
    "direccion" VARCHAR(200),
    "telefono" VARCHAR(20),
    "email" VARCHAR(100),

    CONSTRAINT "ProveedorRepuesto_pkey" PRIMARY KEY ("id_proveedor")
);

-- CreateTable
CREATE TABLE "Repuesto" (
    "id_repuesto" SERIAL NOT NULL,
    "nombre" VARCHAR(100) NOT NULL,
    "descripcion" VARCHAR(255),
    "costo" DECIMAL(12,2) NOT NULL,
    "id_estado_repuesto" INTEGER NOT NULL,
    "id_tipo_repuesto" INTEGER NOT NULL,
    "id_proveedor" INTEGER NOT NULL,

    CONSTRAINT "Repuesto_pkey" PRIMARY KEY ("id_repuesto")
);

-- CreateTable
CREATE TABLE "RepuestoMantenimiento" (
    "id_repuesto" INTEGER NOT NULL,
    "id_mantenimiento" INTEGER NOT NULL,
    "cantidad" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "RepuestoMantenimiento_pkey" PRIMARY KEY ("id_repuesto","id_mantenimiento")
);

-- CreateTable
CREATE TABLE "EstadoIncidente" (
    "id_estado_incidente" SERIAL NOT NULL,
    "nombre_estado" VARCHAR(20) NOT NULL,
    "descripcion" VARCHAR(255),

    CONSTRAINT "EstadoIncidente_pkey" PRIMARY KEY ("id_estado_incidente")
);

-- CreateTable
CREATE TABLE "TipoIncidente" (
    "id_tipo_incidente" SERIAL NOT NULL,
    "nombre_tipo" VARCHAR(100) NOT NULL,
    "descripcion" VARCHAR(255),
    "categoria" VARCHAR(100),

    CONSTRAINT "TipoIncidente_pkey" PRIMARY KEY ("id_tipo_incidente")
);

-- CreateTable
CREATE TABLE "Incidente" (
    "id_incidente" SERIAL NOT NULL,
    "id_bus" INTEGER NOT NULL,
    "id_usuario" INTEGER NOT NULL,
    "descripcion" TEXT,
    "fecha" DATE NOT NULL,
    "urgencia" VARCHAR(20),
    "ubicacion" VARCHAR(200),
    "id_estado_incidente" INTEGER NOT NULL,
    "id_tipo_incidente" INTEGER NOT NULL,

    CONSTRAINT "Incidente_pkey" PRIMARY KEY ("id_incidente")
);

-- CreateTable
CREATE TABLE "EstadoDocumento" (
    "id_estado_documento" SERIAL NOT NULL,
    "nombre_estado" VARCHAR(20) NOT NULL,
    "descripcion" VARCHAR(255),

    CONSTRAINT "EstadoDocumento_pkey" PRIMARY KEY ("id_estado_documento")
);

-- CreateTable
CREATE TABLE "TipoDocumento" (
    "id_tipo_documento" SERIAL NOT NULL,
    "nombre_tipo" VARCHAR(100) NOT NULL,
    "descripcion" VARCHAR(255),
    "categoria" VARCHAR(100),

    CONSTRAINT "TipoDocumento_pkey" PRIMARY KEY ("id_tipo_documento")
);

-- CreateTable
CREATE TABLE "Documento" (
    "id_documento" SERIAL NOT NULL,
    "nombre_archivo" VARCHAR(100) NOT NULL,
    "ruta" VARCHAR(255) NOT NULL,
    "fecha_creacion" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_caducidad" TIMESTAMP(3),
    "tamano" DECIMAL(10,2),
    "id_tipo_documento" INTEGER NOT NULL,
    "id_estado_documento" INTEGER NOT NULL,
    "id_usuario" INTEGER,
    "id_bus" INTEGER,
    "id_incidente" INTEGER,
    "id_mantenimiento" INTEGER,

    CONSTRAINT "Documento_pkey" PRIMARY KEY ("id_documento")
);

-- CreateTable
CREATE TABLE "EstadoAlerta" (
    "id_estado_alerta" SERIAL NOT NULL,
    "nombre_estado" VARCHAR(20) NOT NULL,
    "descripcion" VARCHAR(255),

    CONSTRAINT "EstadoAlerta_pkey" PRIMARY KEY ("id_estado_alerta")
);

-- CreateTable
CREATE TABLE "TipoAlerta" (
    "id_tipo_alerta" SERIAL NOT NULL,
    "nombre_tipo" VARCHAR(100) NOT NULL,
    "descripcion" VARCHAR(255),
    "categoria" VARCHAR(100),

    CONSTRAINT "TipoAlerta_pkey" PRIMARY KEY ("id_tipo_alerta")
);

-- CreateTable
CREATE TABLE "Alerta" (
    "id_alerta" SERIAL NOT NULL,
    "titulo" VARCHAR(100) NOT NULL,
    "descripcion" TEXT,
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "prioridad" VARCHAR(20),
    "id_estado_alerta" INTEGER NOT NULL,
    "id_tipo_alerta" INTEGER NOT NULL,
    "id_usuario" INTEGER,
    "id_documento" INTEGER,
    "id_bus" INTEGER,
    "id_mantenimiento" INTEGER,
    "id_incidente" INTEGER,
    "dedup_key" TEXT,

    CONSTRAINT "Alerta_pkey" PRIMARY KEY ("id_alerta")
);

-- CreateIndex
CREATE UNIQUE INDEX "Rol_nombre_rol_key" ON "Rol"("nombre_rol");

-- CreateIndex
CREATE UNIQUE INDEX "TokenRestablecimiento_codigo_token_key" ON "TokenRestablecimiento"("codigo_token");

-- CreateIndex
CREATE INDEX "TokenRestablecimiento_id_usuario_idx" ON "TokenRestablecimiento"("id_usuario");

-- CreateIndex
CREATE INDEX "TokenRestablecimiento_fecha_expiracion_idx" ON "TokenRestablecimiento"("fecha_expiracion");

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_email_key" ON "Usuario"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_username_key" ON "Usuario"("username");

-- CreateIndex
CREATE UNIQUE INDEX "Bus_patente_key" ON "Bus"("patente");

-- CreateIndex
CREATE UNIQUE INDEX "EstadoAlerta_nombre_estado_key" ON "EstadoAlerta"("nombre_estado");

-- CreateIndex
CREATE UNIQUE INDEX "TipoAlerta_nombre_tipo_key" ON "TipoAlerta"("nombre_tipo");

-- CreateIndex
CREATE UNIQUE INDEX "Alerta_dedup_key_key" ON "Alerta"("dedup_key");

-- AddForeignKey
ALTER TABLE "TokenRestablecimiento" ADD CONSTRAINT "TokenRestablecimiento_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "Usuario"("id_usuario") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Usuario" ADD CONSTRAINT "Usuario_id_estado_usuario_fkey" FOREIGN KEY ("id_estado_usuario") REFERENCES "EstadoUsuario"("id_estado_usuario") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UsuarioRol" ADD CONSTRAINT "UsuarioRol_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "Usuario"("id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UsuarioRol" ADD CONSTRAINT "UsuarioRol_id_rol_fkey" FOREIGN KEY ("id_rol") REFERENCES "Rol"("id_rol") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bus" ADD CONSTRAINT "Bus_id_estado_bus_fkey" FOREIGN KEY ("id_estado_bus") REFERENCES "EstadoBus"("id_estado_bus") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TurnoConductor" ADD CONSTRAINT "TurnoConductor_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "Usuario"("id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TurnoConductor" ADD CONSTRAINT "TurnoConductor_id_bus_fkey" FOREIGN KEY ("id_bus") REFERENCES "Bus"("id_bus") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TurnoConductor" ADD CONSTRAINT "TurnoConductor_id_estado_turno_fkey" FOREIGN KEY ("id_estado_turno") REFERENCES "EstadoTurno"("id_estado_turno") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Taller" ADD CONSTRAINT "Taller_id_tipo_taller_fkey" FOREIGN KEY ("id_tipo_taller") REFERENCES "TipoTaller"("id_tipo_taller") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mecanico" ADD CONSTRAINT "Mecanico_id_taller_fkey" FOREIGN KEY ("id_taller") REFERENCES "Taller"("id_taller") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mantenimiento" ADD CONSTRAINT "Mantenimiento_id_bus_fkey" FOREIGN KEY ("id_bus") REFERENCES "Bus"("id_bus") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mantenimiento" ADD CONSTRAINT "Mantenimiento_id_taller_fkey" FOREIGN KEY ("id_taller") REFERENCES "Taller"("id_taller") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mantenimiento" ADD CONSTRAINT "Mantenimiento_id_tipo_mantenimiento_fkey" FOREIGN KEY ("id_tipo_mantenimiento") REFERENCES "TipoMantenimiento"("id_tipo_mantenimiento") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mantenimiento" ADD CONSTRAINT "Mantenimiento_id_estado_mantenimiento_fkey" FOREIGN KEY ("id_estado_mantenimiento") REFERENCES "EstadoMantenimiento"("id_estado_mantenimiento") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MecanicoMantenimiento" ADD CONSTRAINT "MecanicoMantenimiento_id_mecanico_fkey" FOREIGN KEY ("id_mecanico") REFERENCES "Mecanico"("id_mecanico") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MecanicoMantenimiento" ADD CONSTRAINT "MecanicoMantenimiento_id_mantenimiento_fkey" FOREIGN KEY ("id_mantenimiento") REFERENCES "Mantenimiento"("id_mantenimiento") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Repuesto" ADD CONSTRAINT "Repuesto_id_estado_repuesto_fkey" FOREIGN KEY ("id_estado_repuesto") REFERENCES "EstadoRepuesto"("id_estado_repuesto") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Repuesto" ADD CONSTRAINT "Repuesto_id_tipo_repuesto_fkey" FOREIGN KEY ("id_tipo_repuesto") REFERENCES "TipoRepuesto"("id_tipo_repuesto") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Repuesto" ADD CONSTRAINT "Repuesto_id_proveedor_fkey" FOREIGN KEY ("id_proveedor") REFERENCES "ProveedorRepuesto"("id_proveedor") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RepuestoMantenimiento" ADD CONSTRAINT "RepuestoMantenimiento_id_repuesto_fkey" FOREIGN KEY ("id_repuesto") REFERENCES "Repuesto"("id_repuesto") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RepuestoMantenimiento" ADD CONSTRAINT "RepuestoMantenimiento_id_mantenimiento_fkey" FOREIGN KEY ("id_mantenimiento") REFERENCES "Mantenimiento"("id_mantenimiento") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Incidente" ADD CONSTRAINT "Incidente_id_bus_fkey" FOREIGN KEY ("id_bus") REFERENCES "Bus"("id_bus") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Incidente" ADD CONSTRAINT "Incidente_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "Usuario"("id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Incidente" ADD CONSTRAINT "Incidente_id_estado_incidente_fkey" FOREIGN KEY ("id_estado_incidente") REFERENCES "EstadoIncidente"("id_estado_incidente") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Incidente" ADD CONSTRAINT "Incidente_id_tipo_incidente_fkey" FOREIGN KEY ("id_tipo_incidente") REFERENCES "TipoIncidente"("id_tipo_incidente") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Documento" ADD CONSTRAINT "Documento_id_tipo_documento_fkey" FOREIGN KEY ("id_tipo_documento") REFERENCES "TipoDocumento"("id_tipo_documento") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Documento" ADD CONSTRAINT "Documento_id_estado_documento_fkey" FOREIGN KEY ("id_estado_documento") REFERENCES "EstadoDocumento"("id_estado_documento") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Documento" ADD CONSTRAINT "Documento_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "Usuario"("id_usuario") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Documento" ADD CONSTRAINT "Documento_id_bus_fkey" FOREIGN KEY ("id_bus") REFERENCES "Bus"("id_bus") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Documento" ADD CONSTRAINT "Documento_id_incidente_fkey" FOREIGN KEY ("id_incidente") REFERENCES "Incidente"("id_incidente") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Documento" ADD CONSTRAINT "Documento_id_mantenimiento_fkey" FOREIGN KEY ("id_mantenimiento") REFERENCES "Mantenimiento"("id_mantenimiento") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alerta" ADD CONSTRAINT "Alerta_id_estado_alerta_fkey" FOREIGN KEY ("id_estado_alerta") REFERENCES "EstadoAlerta"("id_estado_alerta") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alerta" ADD CONSTRAINT "Alerta_id_tipo_alerta_fkey" FOREIGN KEY ("id_tipo_alerta") REFERENCES "TipoAlerta"("id_tipo_alerta") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alerta" ADD CONSTRAINT "Alerta_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "Usuario"("id_usuario") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alerta" ADD CONSTRAINT "Alerta_id_documento_fkey" FOREIGN KEY ("id_documento") REFERENCES "Documento"("id_documento") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alerta" ADD CONSTRAINT "Alerta_id_bus_fkey" FOREIGN KEY ("id_bus") REFERENCES "Bus"("id_bus") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alerta" ADD CONSTRAINT "Alerta_id_mantenimiento_fkey" FOREIGN KEY ("id_mantenimiento") REFERENCES "Mantenimiento"("id_mantenimiento") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alerta" ADD CONSTRAINT "Alerta_id_incidente_fkey" FOREIGN KEY ("id_incidente") REFERENCES "Incidente"("id_incidente") ON DELETE SET NULL ON UPDATE CASCADE;
