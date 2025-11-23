/*
  Warnings:

  - A unique constraint covering the columns `[rut]` on the table `Usuario` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "Usuario_rut_key" ON "Usuario"("rut");
