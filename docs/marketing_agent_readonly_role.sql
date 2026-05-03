-- Run manually as a DBA/owner role in production. Do not add this to Prisma migrations;
-- managed application users often cannot CREATE ROLE, and deployment migrations should
-- not depend on account-administration privileges.

CREATE ROLE autoscape_marketing_agent LOGIN PASSWORD '<replace-with-generated-password>';

ALTER ROLE autoscape_marketing_agent CONNECTION LIMIT 3;
ALTER ROLE autoscape_marketing_agent SET default_transaction_read_only = on;
ALTER ROLE autoscape_marketing_agent SET statement_timeout = '30s';
ALTER ROLE autoscape_marketing_agent SET idle_in_transaction_session_timeout = '30s';

GRANT CONNECT ON DATABASE <production_database_name> TO autoscape_marketing_agent;
GRANT USAGE ON SCHEMA public TO autoscape_marketing_agent;

GRANT SELECT ON ALL TABLES IN SCHEMA public TO autoscape_marketing_agent;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO autoscape_marketing_agent;

REVOKE CREATE ON SCHEMA public FROM autoscape_marketing_agent;
REVOKE ALL ON DATABASE <production_database_name> FROM autoscape_marketing_agent;
GRANT CONNECT ON DATABASE <production_database_name> TO autoscape_marketing_agent;

-- Verification queries to run as autoscape_marketing_agent:
-- SELECT COUNT(*) FROM marketing_funnel_daily;
-- SELECT COUNT(*) FROM paid_customer_attribution;
-- UPDATE leads SET updated_at = now() WHERE false; -- must fail

