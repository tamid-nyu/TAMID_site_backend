-- Make board member profile fields optional to match the admin form, which
-- only requires Full Name, Position, and Email. Bio / Major / Year / Hometown
-- were NOT NULL in the SJBA-derived baseline, causing admin "create board
-- member" to fail with a not-null violation when those fields were left blank.
alter table "public"."board_members" alter column "bio" drop not null;
alter table "public"."board_members" alter column "major" drop not null;
alter table "public"."board_members" alter column "year" drop not null;
alter table "public"."board_members" alter column "hometown" drop not null;
