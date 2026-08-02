drop extension if exists "pg_net";
create table "public"."board_members" (
    "id" uuid not null default gen_random_uuid(),
    "position" text not null,
    "full_name" text not null,
    "bio" text not null,
    "major" text not null,
    "year" text not null,
    "hometown" text not null,
    "linkedin_url" text,
    "email" text not null,
    "headshot_file" text,
    "order_index" numeric not null default '0'::numeric
      );
alter table "public"."board_members" enable row level security;
create table "public"."contact_requests" (
    "id" uuid not null default gen_random_uuid(),
    "created_at" timestamp with time zone not null default now(),
    "first_name" text,
    "last_name" text,
    "email" text,
    "company" text,
    "message" text
      );
alter table "public"."contact_requests" enable row level security;
create table "public"."events" (
    "id" uuid not null default gen_random_uuid(),
    "created_at" timestamp with time zone not null,
    "updated_at" timestamp with time zone not null,
    "title" text not null,
    "company" text not null,
    "start_time" timestamp with time zone not null,
    "end_time" timestamp with time zone not null,
    "location" text not null,
    "flyer_file" text,
    "rsvp_link" text,
    "description" text,
    "is_visible" boolean not null default true,
    "semester" text not null default ''::text
      );
alter table "public"."events" enable row level security;
create table "public"."members" (
    "id" uuid not null default gen_random_uuid(),
    "first_name" text not null,
    "last_name" text not null,
    "semester" text not null,
    "email" text
      );
alter table "public"."members" enable row level security;
create table "public"."newsletter_signups" (
    "id" uuid not null default gen_random_uuid(),
    "created_at" timestamp with time zone not null default now(),
    "first_name" text not null,
    "last_name" text not null,
    "email" text not null
      );
alter table "public"."newsletter_signups" enable row level security;
create table "public"."semesters" (
    "id" uuid not null default gen_random_uuid(),
    "semester_name" text not null
      );
alter table "public"."semesters" enable row level security;
CREATE UNIQUE INDEX board_members_pkey ON public.board_members USING btree (id);
CREATE UNIQUE INDEX contact_requests_pkey ON public.contact_requests USING btree (id);
CREATE UNIQUE INDEX events_pkey ON public.events USING btree (id);
CREATE UNIQUE INDEX members_pkey ON public.members USING btree (id);
CREATE UNIQUE INDEX newsletter_signups_email_key ON public.newsletter_signups USING btree (email);
CREATE UNIQUE INDEX newsletter_signups_pkey ON public.newsletter_signups USING btree (id, email);
CREATE UNIQUE INDEX semesters_id_key ON public.semesters USING btree (id);
CREATE UNIQUE INDEX semesters_pkey ON public.semesters USING btree (id, semester_name);
CREATE UNIQUE INDEX semesters_semester_name_key ON public.semesters USING btree (semester_name);
alter table "public"."board_members" add constraint "board_members_pkey" PRIMARY KEY using index "board_members_pkey";
alter table "public"."contact_requests" add constraint "contact_requests_pkey" PRIMARY KEY using index "contact_requests_pkey";
alter table "public"."events" add constraint "events_pkey" PRIMARY KEY using index "events_pkey";
alter table "public"."members" add constraint "members_pkey" PRIMARY KEY using index "members_pkey";
alter table "public"."newsletter_signups" add constraint "newsletter_signups_pkey" PRIMARY KEY using index "newsletter_signups_pkey";
alter table "public"."semesters" add constraint "semesters_pkey" PRIMARY KEY using index "semesters_pkey";
alter table "public"."board_members" add constraint "board_members_order_index_check" CHECK ((order_index >= (0)::numeric)) not valid;
alter table "public"."board_members" validate constraint "board_members_order_index_check";
alter table "public"."events" add constraint "events_semester_fkey" FOREIGN KEY (semester) REFERENCES public.semesters(semester_name) ON UPDATE CASCADE not valid;
alter table "public"."events" validate constraint "events_semester_fkey";
alter table "public"."members" add constraint "members_semester_fkey" FOREIGN KEY (semester) REFERENCES public.semesters(semester_name) ON UPDATE CASCADE not valid;
alter table "public"."members" validate constraint "members_semester_fkey";
alter table "public"."newsletter_signups" add constraint "newsletter_signups_email_key" UNIQUE using index "newsletter_signups_email_key";
alter table "public"."semesters" add constraint "semesters_id_key" UNIQUE using index "semesters_id_key";
alter table "public"."semesters" add constraint "semesters_semester_name_key" UNIQUE using index "semesters_semester_name_key";
grant delete on table "public"."board_members" to "anon";
grant insert on table "public"."board_members" to "anon";
grant references on table "public"."board_members" to "anon";
grant select on table "public"."board_members" to "anon";
grant trigger on table "public"."board_members" to "anon";
grant truncate on table "public"."board_members" to "anon";
grant update on table "public"."board_members" to "anon";
grant delete on table "public"."board_members" to "authenticated";
grant insert on table "public"."board_members" to "authenticated";
grant references on table "public"."board_members" to "authenticated";
grant select on table "public"."board_members" to "authenticated";
grant trigger on table "public"."board_members" to "authenticated";
grant truncate on table "public"."board_members" to "authenticated";
grant update on table "public"."board_members" to "authenticated";
grant delete on table "public"."board_members" to "service_role";
grant insert on table "public"."board_members" to "service_role";
grant references on table "public"."board_members" to "service_role";
grant select on table "public"."board_members" to "service_role";
grant trigger on table "public"."board_members" to "service_role";
grant truncate on table "public"."board_members" to "service_role";
grant update on table "public"."board_members" to "service_role";
grant delete on table "public"."contact_requests" to "anon";
grant insert on table "public"."contact_requests" to "anon";
grant references on table "public"."contact_requests" to "anon";
grant select on table "public"."contact_requests" to "anon";
grant trigger on table "public"."contact_requests" to "anon";
grant truncate on table "public"."contact_requests" to "anon";
grant update on table "public"."contact_requests" to "anon";
grant delete on table "public"."contact_requests" to "authenticated";
grant insert on table "public"."contact_requests" to "authenticated";
grant references on table "public"."contact_requests" to "authenticated";
grant select on table "public"."contact_requests" to "authenticated";
grant trigger on table "public"."contact_requests" to "authenticated";
grant truncate on table "public"."contact_requests" to "authenticated";
grant update on table "public"."contact_requests" to "authenticated";
grant delete on table "public"."contact_requests" to "service_role";
grant insert on table "public"."contact_requests" to "service_role";
grant references on table "public"."contact_requests" to "service_role";
grant select on table "public"."contact_requests" to "service_role";
grant trigger on table "public"."contact_requests" to "service_role";
grant truncate on table "public"."contact_requests" to "service_role";
grant update on table "public"."contact_requests" to "service_role";
grant delete on table "public"."events" to "anon";
grant insert on table "public"."events" to "anon";
grant references on table "public"."events" to "anon";
grant select on table "public"."events" to "anon";
grant trigger on table "public"."events" to "anon";
grant truncate on table "public"."events" to "anon";
grant update on table "public"."events" to "anon";
grant delete on table "public"."events" to "authenticated";
grant insert on table "public"."events" to "authenticated";
grant references on table "public"."events" to "authenticated";
grant select on table "public"."events" to "authenticated";
grant trigger on table "public"."events" to "authenticated";
grant truncate on table "public"."events" to "authenticated";
grant update on table "public"."events" to "authenticated";
grant delete on table "public"."events" to "service_role";
grant insert on table "public"."events" to "service_role";
grant references on table "public"."events" to "service_role";
grant select on table "public"."events" to "service_role";
grant trigger on table "public"."events" to "service_role";
grant truncate on table "public"."events" to "service_role";
grant update on table "public"."events" to "service_role";
grant delete on table "public"."members" to "anon";
grant insert on table "public"."members" to "anon";
grant references on table "public"."members" to "anon";
grant select on table "public"."members" to "anon";
grant trigger on table "public"."members" to "anon";
grant truncate on table "public"."members" to "anon";
grant update on table "public"."members" to "anon";
grant delete on table "public"."members" to "authenticated";
grant insert on table "public"."members" to "authenticated";
grant references on table "public"."members" to "authenticated";
grant select on table "public"."members" to "authenticated";
grant trigger on table "public"."members" to "authenticated";
grant truncate on table "public"."members" to "authenticated";
grant update on table "public"."members" to "authenticated";
grant delete on table "public"."members" to "service_role";
grant insert on table "public"."members" to "service_role";
grant references on table "public"."members" to "service_role";
grant select on table "public"."members" to "service_role";
grant trigger on table "public"."members" to "service_role";
grant truncate on table "public"."members" to "service_role";
grant update on table "public"."members" to "service_role";
grant delete on table "public"."newsletter_signups" to "anon";
grant insert on table "public"."newsletter_signups" to "anon";
grant references on table "public"."newsletter_signups" to "anon";
grant select on table "public"."newsletter_signups" to "anon";
grant trigger on table "public"."newsletter_signups" to "anon";
grant truncate on table "public"."newsletter_signups" to "anon";
grant update on table "public"."newsletter_signups" to "anon";
grant delete on table "public"."newsletter_signups" to "authenticated";
grant insert on table "public"."newsletter_signups" to "authenticated";
grant references on table "public"."newsletter_signups" to "authenticated";
grant select on table "public"."newsletter_signups" to "authenticated";
grant trigger on table "public"."newsletter_signups" to "authenticated";
grant truncate on table "public"."newsletter_signups" to "authenticated";
grant update on table "public"."newsletter_signups" to "authenticated";
grant delete on table "public"."newsletter_signups" to "service_role";
grant insert on table "public"."newsletter_signups" to "service_role";
grant references on table "public"."newsletter_signups" to "service_role";
grant select on table "public"."newsletter_signups" to "service_role";
grant trigger on table "public"."newsletter_signups" to "service_role";
grant truncate on table "public"."newsletter_signups" to "service_role";
grant update on table "public"."newsletter_signups" to "service_role";
grant delete on table "public"."semesters" to "anon";
grant insert on table "public"."semesters" to "anon";
grant references on table "public"."semesters" to "anon";
grant select on table "public"."semesters" to "anon";
grant trigger on table "public"."semesters" to "anon";
grant truncate on table "public"."semesters" to "anon";
grant update on table "public"."semesters" to "anon";
grant delete on table "public"."semesters" to "authenticated";
grant insert on table "public"."semesters" to "authenticated";
grant references on table "public"."semesters" to "authenticated";
grant select on table "public"."semesters" to "authenticated";
grant trigger on table "public"."semesters" to "authenticated";
grant truncate on table "public"."semesters" to "authenticated";
grant update on table "public"."semesters" to "authenticated";
grant delete on table "public"."semesters" to "service_role";
grant insert on table "public"."semesters" to "service_role";
grant references on table "public"."semesters" to "service_role";
grant select on table "public"."semesters" to "service_role";
grant trigger on table "public"."semesters" to "service_role";
grant truncate on table "public"."semesters" to "service_role";
grant update on table "public"."semesters" to "service_role";
create policy "Enable insert for anon users only"
  on "public"."board_members"
  as permissive
  for insert
  to anon
with check (true);
create policy "Enable read access for all users"
  on "public"."board_members"
  as permissive
  for select
  to public
using (true);
create policy "Enable insert for anon users only"
  on "public"."contact_requests"
  as permissive
  for insert
  to anon
with check (true);
create policy "Enable read access for all users"
  on "public"."contact_requests"
  as permissive
  for select
  to public
using (true);
create policy "Enable read access for all users"
  on "public"."events"
  as permissive
  for select
  to public
using (true);
create policy "Enable read access for all users"
  on "public"."members"
  as permissive
  for select
  to public
using (true);
create policy "Allow anon to update"
  on "public"."newsletter_signups"
  as permissive
  for update
  to anon
using (true);
create policy "Enable insert for anon users only"
  on "public"."newsletter_signups"
  as permissive
  for insert
  to anon
with check (true);
create policy "Enable read access for all users"
  on "public"."newsletter_signups"
  as permissive
  for select
  to public
using (true);
create policy "Enable read access for all users"
  on "public"."semesters"
  as permissive
  for select
  to public
using (true);
