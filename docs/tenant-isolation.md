# Tenant isolation

Angkor eMenu uses a **shared database, shared schema** model. Every tenant-owned row
contains `business_id`, and the API derives that ID from the authenticated
session plus `memberships`. It never trusts a `business_id` sent by the browser.

## Rules enforced by the API

1. Authentication resolves `session -> user -> memberships -> business`.
2. Every admin query includes `WHERE business_id = ?` using the resolved value.
3. Public menu lookups resolve an active business by its unique slug, then query
   children using that resolved ID.
4. R2 keys are prefixed `businesses/{businessId}/...`; ownership metadata is
   also recorded in D1. Downloads are served through an API route that verifies
   the prefix/owner (or through deliberately public, unguessable object URLs).
5. Unique indexes are tenant-scoped, for example `(business_id, slug)`.
6. Cross-origin writes use an allowlist, secure HttpOnly cookies, and same-site
   deployment domains. For separate root domains, use bearer session tokens and
   add CSRF protection.

## When to use stronger isolation

- **Database per tenant:** regulated or very large customers, custom backup and
  retention, or contractual data residency. More operational cost.
- **Hybrid:** shared D1 for standard plans, dedicated D1/R2 for enterprise.
- **Regional sharding:** route tenants to a region-specific database when data
  residency or scale requires it.

For most small and mid-size restaurants, the shared-schema design is the best
cost/complexity tradeoff if every query is scoped and covered by integration
tests that attempt cross-tenant access.
