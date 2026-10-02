-- Run ONCE in the Supabase SQL editor of the Cottage project, after the migrations.
-- Replace the three addresses with the real ones (lower-case). Only these can ever have accounts.
-- Each address is permanently tied to one adult profile; nobody can pick a profile themselves.
insert into public.household_invites (email, member_id) values
  ('REPLACE-jay@example.com',    'jay'),
  ('REPLACE-fallon@example.com', 'fallon'),
  ('REPLACE-breeze@example.com', 'adult3');
