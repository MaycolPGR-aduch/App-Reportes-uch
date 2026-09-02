-- Trazabilidad experimental de la moderacion.
--
-- El paper compara dos regimenes --MANUAL y AI_ASSISTED-- y necesita saber
-- bajo cual se proceso cada incidencia. No basta un ajuste global: si se
-- cambia el modo a mitad del estudio, las incidencias anteriores quedarian
-- atribuidas al brazo equivocado.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'governance_mode') THEN
    CREATE TYPE governance_mode AS ENUM ('MANUAL', 'AI_ASSISTED', 'AI_AUTONOMOUS');
  END IF;
END $$;

ALTER TABLE incidents
  ADD COLUMN IF NOT EXISTS governance_mode governance_mode;

-- La categoria que eligio quien reporta, intacta.
--
-- Hasta ahora se perdia: viajaba al prompt de la IA y despues `category` se
-- sobrescribia con la prediccion. Sin el valor original no se puede medir
-- cuantas veces la IA corrige a la persona ni si acierta al hacerlo, que es la
-- comparacion central del estudio.
ALTER TABLE incidents
  ADD COLUMN IF NOT EXISTS reported_category incident_category;

-- Las incidencias anteriores se procesaron con la IA decidiendo sola, que no
-- es ninguno de los dos brazos. Etiquetarlas asi las deja fuera del analisis
-- sin borrarlas.
UPDATE incidents SET governance_mode = 'AI_AUTONOMOUS' WHERE governance_mode IS NULL;

-- `reported_category` se queda en NULL para esas filas a proposito: en varias
-- la IA ya sobrescribio la categoria, asi que copiar el valor actual inventaria
-- un dato que no tenemos. Un hueco honesto es preferible a un dato plausible y
-- falso en la tabla sobre la que se escribira un paper.

-- A partir de aqui toda incidencia nace con modo.
ALTER TABLE incidents
  ALTER COLUMN governance_mode SET NOT NULL;

ALTER TABLE incidents
  ALTER COLUMN governance_mode SET DEFAULT 'AI_ASSISTED';

-- Separar los brazos es la consulta de todo el analisis.
CREATE INDEX IF NOT EXISTS ix_incidents_governance_mode
  ON incidents (governance_mode, created_at);
