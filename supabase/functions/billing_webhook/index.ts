// @ts-nocheck
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import Stripe from 'npm:stripe@14.25.0';
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, stripe-signature',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');
const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');
const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const serviceRoleKey = Deno.env.get('SERVICE_ROLE_KEY') ?? '';

if (!stripeSecretKey || !webhookSecret) {
  console.error('Missing STRIPE_SECRET_KEY or STRIPE_WEBHOOK_SECRET');
}
if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing SUPABASE_URL or SERVICE_ROLE_KEY');
}

const stripe = new Stripe(stripeSecretKey ?? '', { apiVersion: '2023-10-16' });
const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Helpers
function subStatusToAccountStatus(subStatus: string): 'active' | 'suspended' {
  // Treat active/trialing/past_due as active for MVP; suspend otherwise.
  return ['active', 'trialing', 'past_due'].includes(subStatus) ? 'active' : 'suspended';
}

async function updateAccountByCustomer(customerId: string, patch: Record<string, unknown>) {
  if (!customerId) return { updated: 0 };
  const { data, error } = await supabase
    .from('accounts')
    .update(patch)
    .eq('stripe_customer_id', customerId)
    .select('id');
  if (error) {
    console.error('DB update error:', error);
    return { updated: 0 };
  }
  return { updated: Array.isArray(data) ? data.length : 0 };
}

async function linkCustomerToAccount(accountId: string | null, customerId: string | null) {
  if (!accountId || !customerId) return { updated: 0 };
  const { data, error } = await supabase
    .from('accounts')
    .update({ stripe_customer_id: customerId })
    .eq('id', accountId)
    .select('id');
  if (error) {
    console.error('DB link error:', error);
    return { updated: 0 };
  }
  return { updated: Array.isArray(data) ? data.length : 0 };
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const signature = req.headers.get('stripe-signature');
  const rawBody = await req.text();

  if (!signature || !webhookSecret) {
    return new Response('missing signature', { status: 400, headers: corsHeaders });
  }

  let event: Stripe.Event;
  try {
    // Deno requires async verifier
    event = await stripe.webhooks.constructEventAsync(rawBody, signature, webhookSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', String(err));
    return new Response('invalid signature', { status: 400, headers: corsHeaders });
  }

  // Extract common fields
  const obj: any = event.data?.object ?? {};
  const customerId: string | null =
    typeof obj?.customer === 'string' ? obj.customer : (obj?.customer?.id ?? null);

  console.log('Stripe webhook verified', {
    id: event.id,
    type: event.type,
    customerId,
  });

  // Minimal routing
  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        // Optional: if you pass account_id via client_reference_id when creating Checkout Session later,
        // we can link the Stripe customer to that account here.
        const accountId = obj?.client_reference_id ?? null;
        if (accountId && customerId) {
          const link = await linkCustomerToAccount(accountId, customerId);
          console.log('Linked customer to account', {
            accountId,
            customerId,
            updated: link.updated,
          });
        }
        if (customerId) {
          const res = await updateAccountByCustomer(customerId, { status: 'active' });
          console.log('Set status active via checkout.session.completed', { updated: res.updated });
        }
        break;
      }
      case 'invoice.paid': {
        if (customerId) {
          const res = await updateAccountByCustomer(customerId, { status: 'active' });
          console.log('Set status active via invoice.paid', { updated: res.updated });
        }
        break;
      }
      case 'invoice.payment_failed': {
        if (customerId) {
          const res = await updateAccountByCustomer(customerId, { status: 'suspended' });
          console.log('Set status suspended via invoice.payment_failed', { updated: res.updated });
        }
        break;
      }
      case 'customer.subscription.updated': {
        const subStatus: string = obj?.status ?? 'unknown';
        const accountStatus = subStatusToAccountStatus(subStatus);
        if (customerId) {
          const res = await updateAccountByCustomer(customerId, { status: accountStatus });
          console.log(`Set status ${accountStatus} via subscription.updated(${subStatus})`, {
            updated: res.updated,
          });
        }
        break;
      }
      case 'customer.subscription.deleted': {
        if (customerId) {
          const res = await updateAccountByCustomer(customerId, { status: 'suspended' });
          console.log('Set status suspended via subscription.deleted', { updated: res.updated });
        }
        break;
      }
      default:
        // Unhandled types just 200 OK
        break;
    }
  } catch (e) {
    console.error('Handler error:', e);
    // Still 200 so Stripe doesn't retry forever; adjust if you prefer retries
  }

  return new Response('ok', { status: 200, headers: corsHeaders });
});
