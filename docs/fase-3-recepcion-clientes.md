# Fase 3 — Recepción de clientes

## Estado
**Preparación técnica, NO activado en producción.** La web actual sigue abriendo borradores de correo o WhatsApp y no registra solicitudes automáticamente.

## Arquitectura propuesta
GitHub Pages (ES/EN) → Supabase Edge Function `receive-lead` → verificación Cloudflare Turnstile en servidor → tabla privada `leads` → confirmación con referencia. La notificación al negocio requiere una integración de correo transaccional adicional; aún no está implementada.

## Pasos para activarlo
1. Crear un proyecto Supabase controlado por el titular del negocio y aplicar la migración `supabase/migrations/20261025_001_leads.sql`.
2. Crear Cloudflare Turnstile y autorizar el dominio real del sitio. Guardar la clave secreta exclusivamente en Supabase.
3. Configurar secretos en Supabase: `TURNSTILE_SECRET_KEY`, `ALLOWED_ORIGIN` (origen exacto, p. ej. `https://jonelpd.github.io`), `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`. No poner nunca `SERVICE_ROLE_KEY` en archivos públicos.
4. Desplegar `receive-lead` como Edge Function. Configurar la autenticación de la función para permitir solicitudes públicas sin JWT, pero **solo** después de activar Turnstile y las demás defensas.
5. Antes de exponer el endpoint: añadir limitación de tasa por IP en el perímetro, cuotas, registro de errores sin datos personales, control de abuso y políticas de retención/eliminación.
6. Integrar en ES y EN un botón de envío real con Turnstile, estados de carga, error y éxito, y referencia de solicitud. Mantener correo y WhatsApp como canales alternativos.
7. Configurar correo transaccional con proveedor verificado, gestión de fallos y notificación al negocio; no prometer confirmación por email hasta probar la entrega.
8. Completar información legal, responsable del tratamiento, base jurídica, plazo de conservación y aviso de privacidad antes de recopilar datos reales.

## Pruebas obligatorias
- Envío correcto con token válido → HTTP 201, referencia única y registro privado.
- Token ausente, repetido o inválido → HTTP 400, sin registro.
- Origen no permitido, método incorrecto, campos inválidos, cuerpo grande → error sin registro.
- Base de datos no disponible → mensaje de error, nunca éxito falso.
- Anon/authenticated no pueden leer ni escribir leads mediante API pública.
- Verificar móvil/ordenador, español/inglés, accesibilidad y protección frente a envíos repetidos.
- Revisar privacidad y retención antes de activar el servicio.

## Nota de seguridad
CORS no es autenticación ni sustituye controles antispam. El token Turnstile se verifica en el servidor; también se requiere limitación de tasa y monitorización. El identificador de referencia no revela el contenido de la solicitud.
