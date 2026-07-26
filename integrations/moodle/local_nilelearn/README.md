# local_nilelearn

Moodle 4.5 local plugin implementing Nile Learn command protocol `1.0`.

The plugin is transport-only. Every command:

- uses an exact allowlisted operation;
- verifies the mapped Moodle actor capability in the target context;
- requires a canonical payload hash and expected provider version;
- persists provider-side idempotency evidence;
- never accepts credentials inside a command payload.

The external service is installed disabled and restricted to explicitly
authorized service users. Production activation is outside Phase 6L.
