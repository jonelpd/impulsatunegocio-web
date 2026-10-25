// Supabase Edge Function. Configurar TURNSTILE_SECRET_KEY y ALLOWED_ORIGIN
// en secretos del proyecto. Requiere verificación Turnstile del lado servidor.
import { createClient } from 'npm:@supabase/supabase-js@2';

const allowedOrigin = Deno.env.get('ALLOWED_ORIGIN') || 'https://jonelpd.github.io';
const publicIntakeEnabled = Deno.env.get('PUBLIC_LEADS_ENABLED') === 'true';
const secret = Deno.env.get('TURNSTILE_SECRET_KEY') || '';
const url = Deno.env.get('SUPABASE_URL') || '';
const roleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

function response(status: number, payload: Record<string, unknown>, origin: string) {
  return new Response(status === 204 ? null : JSON.stringify(payload), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'Access-Control-Allow-Origin': origin,
      'Vary': 'Origin',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'content-type',
    },
  });
}
function field(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().slice(0, max + 1) : '';
}
Deno.serve(async (request) => {
  const origin = request.headers.get('origin') || '';
  if (!allowedOrigin || origin !== allowedOrigin) return response(403, { error: 'Origin not allowed' }, allowedOrigin);
  if (request.method === 'OPTIONS') return response(204, {}, allowedOrigin);
  if (request.method !== 'POST') return response(405, { error: 'Method not allowed' }, allowedOrigin);
  if (!publicIntakeEnabled) return response(503, { error: 'Public intake not enabled' }, allowedOrigin);
  if (!secret || !url || !roleKey) return response(503, { error: 'Service not configured' }, allowedOrigin);
  if (Number(request.headers.get('content-length') || 0) > 16000) return response(413, { error: 'Payload too large' }, allowedOrigin);
  let data: Record<string, unknown>;
  try { const raw=await request.text();if(raw.length>16000)return response(413,{error:'Payload too large'},allowedOrigin);const parsed=JSON.parse(raw);if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))throw Error('Invalid JSON');data=parsed; } catch { return response(400, { error: 'Invalid JSON' }, allowedOrigin); }
  const name = field(data.name, 120);
  const email = field(data.email, 254);
  const message = field(data.message, 6000);
  const service = field(data.service, 100);
  const locale = field(data.locale, 2);
  const token = field(data.turnstileToken, 2048);
  const privacyConsent = data.privacyConsent === true;
  if (name.length < 2 || name.length > 120 || message.length < 10 || message.length > 6000 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254 ||
      service.length < 2 || service.length > 100 || !['es', 'en'].includes(locale) || !token || !privacyConsent) {
    return response(400, { error: 'Invalid fields' }, allowedOrigin);
  }
  const challenge = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    body: new URLSearchParams({ secret, response: token }),
  }).then(r => r.json()).catch(() => ({ success: false }));
  if (!challenge.success) return response(400, { error: 'Verification failed' }, allowedOrigin);
  const reference = 'INY-' + crypto.randomUUID().slice(0, 8).toUpperCase();
  const client = createClient(url, roleKey, { auth: { persistSession: false } });
  const { error } = await client.from('leads').insert({
    reference, locale, name, email, message, service,
    business: field(data.business, 160), budget: field(data.budget, 100),
    timing: field(data.timing, 100),
  });
  if (error) {
    console.error('Lead storage failed', error.code);
    return response(503, { error: 'Unable to save request' }, allowedOrigin);
  }
  return response(201, { ok: true, reference }, allowedOrigin);
});
