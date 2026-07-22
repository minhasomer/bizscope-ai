# Staging Reset Procedure

## Staging project
- Supabase project: `bizscope-staging`
- Ref: `ebfbudzfdezekplbatlr`
- URL: `https://ebfbudzfdezekplbatlr.supabase.co`

## To reset staging to a clean state

1. Link CLI to staging:
   supabase link --project-ref ebfbudzfdezekplbatlr

2. Wipe and re-apply schema (run in Supabase SQL Editor):
   DROP SCHEMA public CASCADE;
   CREATE SCHEMA public;
   GRANT ALL ON SCHEMA public TO postgres, anon, authenticated, service_role;

3. Re-push all migrations:
   supabase db push

4. Re-create test users via Authentication → Users (do not use Invite):
   staging-free@bizscope.test   — role: Explorer, tier: Explorer
   staging-pro@bizscope.test    — role: Pro,      tier: Pro
   staging-admin@bizscope.test  — role: Admin,    tier: Pro

5. Update profiles (UUIDs will change after reset — get new ones from auth.users):
   UPDATE public.profiles SET role = 'Explorer', subscription_tier = 'Explorer' WHERE id = '<free-uuid>';
   UPDATE public.profiles SET role = 'Pro',      subscription_tier = 'Pro'      WHERE id = '<pro-uuid>';
   UPDATE public.profiles SET role = 'Admin',    subscription_tier = 'Pro'      WHERE id = '<admin-uuid>';

6. Insert test reports:
   INSERT INTO public.reports (user_id, business_type, location, report_type, viability_score)
   VALUES
     ('<free-uuid>',  'Retail',     'New York, NY',     'full', 72),
     ('<pro-uuid>',   'Restaurant', 'Austin, TX',       'full', 65),
     ('<admin-uuid>', 'SaaS',       'San Francisco, CA','full', 88);

## Never
- Copy production data into staging
- Use production credentials in staging
- Commit .env.staging or any file containing secrets