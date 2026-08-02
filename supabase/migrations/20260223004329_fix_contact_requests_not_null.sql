
ALTER TABLE public.contact_requests
  ALTER COLUMN first_name SET NOT NULL,
  ALTER COLUMN last_name SET NOT NULL,
  ALTER COLUMN email SET NOT NULL,
  ALTER COLUMN message SET NOT NULL;
;
