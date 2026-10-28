# Plan de preparación para el despliegue institucional

> Estado: implementación en curso en la rama de Rocky. Falta verificar la integración en Rocky. Para esta prueba el usuario considera prescindibles los datos actuales de PostgreSQL y acepta proceder sin copia; antes de operar con datos reales deberá definirse y probarse su respaldo. Por decisión actual no se implementará una copia adicional de las evidencias R2 en esta etapa. Existe un diagnóstico manual de evidencias sin borrado; la reconciliación automática sigue pendiente.

## Objetivo

Corregir las incidencias detectadas, validar el flujo completo con datos de prueba y preparar una versión desplegable en Rocky Linux. El trabajo se realizará en `codex/rocky-institutional-deploy`; `main` y la instalación actual no se modificarán durante el desarrollo.

## 1. Seguridad de cuentas y sesiones

- Distinguir una cuenta pendiente de verificación de una cuenta suspendida, para impedir que un enlace de verificación o recuperación reactive una suspensión administrativa.
- Revocar las sesiones existentes tras restablecer una contraseña.
- Garantizar que los enlaces de verificación y recuperación sean de un solo uso incluso ante solicitudes simultáneas.
- Proteger la creación del primer administrador para que no pueda activarse accidentalmente si en el futuro no queda ningún administrador.
- Completar la validación CSRF y comprobar inicio, cierre, cambio de cuenta y sincronización entre pestañas.
- Mantener fuera de `localStorage` las contraseñas, cookies y tokens.

## 2. Prevención de abuso y archivos

- Corregir la identificación de la IP para confiar únicamente en la cadena de proxies autorizados por la institución.
- Aplicar cuotas configurables a login, registro, recuperación, reenvío de verificación, reportes y consultas públicas del mural.
- Limitar el tamaño de las solicitudes en Apache y en el backend antes de cargar imágenes completas en memoria.
- Asegurar que los fallos durante la creación de un reporte no dejen evidencias huérfanas, y añadir un mecanismo controlado de reconciliación.
- Mantener la validación de formato y dimensiones y la eliminación de metadatos de las imágenes.

## 3. Mural público y privacidad

- Mantener la portada comunitaria pública y el formulario en `/reportar`.
- Exponer solo reportes con consentimiento, publicados por administración y no rechazados; las imágenes deberán cumplir las mismas condiciones.
- Mantener ocultos la identidad, GPS, datos internos y evidencias privadas. El apoyo seguirá requiriendo una cuenta de estudiante.
- Advertir que cualquier persona con acceso al sitio podrá ver el texto y la foto; actualizar los textos de moderación y consentimiento.
- Documentar que, si la institución quiere acceso solo desde su red, deberá restringirse en la infraestructura: el inicio de sesión no limita por sí solo la lectura pública.

## 4. IA, trabajos y notificaciones

- Impedir que se registre como análisis visual exitoso una clasificación realizada sin la imagen. Si no se puede leer o supera el límite admitido por el proveedor, dejar el caso claramente identificado para revisión manual o aplicar una preparación segura de la imagen.
- Corregir los trabajos con lease vencido en su último intento para que pasen a un estado final visible, en lugar de quedar pendientes indefinidamente.
- Revisar los reintentos y los envíos de correo inciertos para reducir duplicados sin afirmar que son imposibles ante fallos de red.
- Mantener la cadena configurable de modelos y la decisión humana sobre la publicación y asignación.
- Mostrar de forma clara fallos de proveedor, trabajos pendientes o fallidos y la necesidad de intervención.

## 5. Retención y respaldos

- Verificar y documentar el almacenamiento principal efectivo: local o R2. No cambiarlo automáticamente ni mover evidencias sin una decisión y prueba previas.
- Definir destino, cifrado, frecuencia, retención y permisos del respaldo de PostgreSQL; probar una restauración en un entorno aislado.
- Posponer la copia independiente de evidencias por decisión del usuario. R2 es almacenamiento principal, no una copia adicional: la pérdida o eliminación de objetos sigue siendo un riesgo aceptado por ahora.
- Corregir la eliminación de evidencias para que los fallos no dejen registros apuntando a archivos borrados sin una forma de recuperación.
- Revisar que la retención de 180 días se calcule desde el cierre efectivo de la incidencia.

## 6. Dependencias y operación en Rocky

- Revisar los avisos de `npm audit`, actualizar Next.js y las dependencias afectadas a versiones compatibles y volver a ejecutar todas las pruebas. Auditar también las dependencias Python; `pip check` por sí solo no basta.
- Validar al iniciar producción la configuración requerida: dominios institucionales, hosts, correo, Turnstile, almacenamiento y secretos, sin imprimir sus valores.
- Actualizar la documentación y los archivos de despliegue para reflejar Apache y el frontend en el puerto 3001, sin alterar las otras aplicaciones del servidor.
- Documentar el procedimiento de nueva versión, comprobación y vuelta atrás; incluir `DEFAULT_ALERT_EMAIL`, certificado TLS y pruebas de salud.
- Conservar Brevo por ahora. La integración SMTP institucional se tratará por separado cuando TI confirme sus datos; no bloqueará las demás correcciones si Brevo funciona.

## 7. Pruebas y criterios de aceptación

Antes de desplegar, deberán pasar:

- Pruebas unitarias y de integración para cuentas suspendidas, recuperación, CSRF, expiración, cierre y cambio de sesiones.
- Pruebas de mural público: visitante, estudiante, administrador, contenido oculto, retirada de consentimiento y descarga de imágenes.
- Pruebas de tamaño y contenido de archivos, fallos de almacenamiento y recuperación de trabajos abandonados.
- Pruebas de PostgreSQL local aislado y de restauración de una copia.
- Lint, tipos, build, suite backend y auditoría de dependencias.
- Una prueba en navegador real: administrador → cerrar sesión → estudiante, cambio entre pestañas y actualización del service worker.
- Una prueba en Rocky con datos de prueba: registro, correo, reporte, IA o fallback manual, moderación, publicación y retirada.

## Entrega

Cuando todo lo anterior esté validado, se entregarán los cambios y resultados en la rama de Rocky, junto con los comandos de despliegue y reversión. El pase al servidor institucional se hará como un paso separado y verificable; no se dará por terminado hasta confirmar las pruebas allí.
