-- Run this with a PostgreSQL admin/superuser (e.g. postgres).
-- It grants the app user enough rights on schema public and existing/future objects.

GRANT CONNECT ON DATABASE campus_incidents TO campus_app;

GRANT USAGE ON SCHEMA public TO campus_app;
GRANT CREATE ON SCHEMA public TO campus_app;

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO campus_app;
GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO campus_app;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO campus_app;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO campus_app;

