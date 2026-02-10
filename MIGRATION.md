# Legacy Session Migration Guide

This guide explains how to migrate users from the old manual session system to
Astro's built-in session management.

## Overview

The application has transitioned from a manual session storage system (using the
`user_sessions` table) to Astro's built-in session management. This document
provides multiple options for migrating legacy users.

## Migration Options

### Option 1: Automatic Migration on Login (Recommended)

**Timeline**: Gradual, as users log in

When legacy users sign in, the system automatically:

1. Creates a new Astro session
2. Detects and migrates any existing legacy session
3. Cleans up the old session record

**How it works**: No user action required. The migration happens transparently
during the login process.

**Implementation**: Already built into
[src/pages/api/signin.ts](../src/pages/api/signin.ts)

**Response**: The signin endpoint now returns a `migrated` flag:

```json
{
  "message": "Signed in",
  "migrated": true
}
```

### Option 2: Manual User Migration

**Timeline**: User-initiated

Users can manually trigger their own session migration through the API endpoint:

```bash
POST /api/migration/migrate-self
Authorization: Bearer <session-cookie>
```

**Response**:

```json
{
  "success": true,
  "migrated": true,
  "legacySessionFound": true,
  "message": "Legacy session successfully migrated to Astro session system"
}
```

### Option 3: Admin Batch Migration

**Timeline**: Immediate, admin-controlled

Administrators can check migration status and clean up expired sessions:

**Get Migration Statistics**:

```bash
GET /api/migration/status
Authorization: Bearer <admin-session>
```

**Response**:

```json
{
  "legacyCount": 42,
  "expiredLegacyCount": 18,
  "totalLegacyUsers": 35
}
```

**Clean Up Expired Sessions**:

```bash
PATCH /api/migration/cleanup
Authorization: Bearer <admin-session>
```

**Response**:

```json
{
  "totalUsers": 35,
  "migratedSessions": 35,
  "cleanedSessions": 18
}
```

### Option 4: Database Script Migration

**Timeline**: Immediate, automated

Run the migration script to analyze and clean up the database:

```bash
# View statistics
node scripts/migrate-sessions.js

# View detailed user breakdown
node scripts/migrate-sessions.js --detailed

# Clean up expired sessions
node scripts/migrate-sessions.js --cleanup

# Full analysis and cleanup
node scripts/migrate-sessions.js --full
```

**Example Output**:

```
📊 Legacy Session Statistics:

   Total Sessions:     42
   Active Sessions:    24 (valid)
   Expired Sessions:   18 (ready for cleanup)
   Unique Users:       35
   Oldest Session:     2025-10-15T10:30:00.000Z
   Newest Session:     2026-02-03T14:22:00.000Z
```

## Migration Functions

### For Developers

The migration system provides several utility functions in
[src/lib/migration.ts](../src/lib/migration.ts):

```typescript
// Check if a user has a legacy session
hasLegacySession(userId: string): boolean

// Migrate a specific user's session
await migrateLegacySession(context, user, deleteLegacy?: boolean): Promise<MigrationResult>

// Get migration statistics
await getMigrationStats(): Promise<{...}>

// Batch cleanup and migration
await migrateAllLegacySessions(): Promise<{...}>

// Check active legacy session count
await getLegacySessionCount(): Promise<number>
```

## Migration Timeline Recommendations

### Phase 1: Monitoring (Week 1)

- Monitor legacy session count using `/api/migration/status`
- Run `migrate-sessions.js --detailed` to see user breakdown
- No action required from users

### Phase 2: Gradual Migration (Weeks 2-8)

- Users naturally migrate on login (automatic migration on signin)
- Monitor progress with `/api/migration/status`
- Optionally encourage inactive users to log in

### Phase 3: Cleanup (Week 9)

- Run `migrate-sessions.js --cleanup` to remove expired sessions
- Verify migration completion with statistics
- Consider deprecating the `user_sessions` table after all users have migrated

### Phase 4: Retirement (After verification)

- Optionally remove the `user_sessions` table
- Archive migration logs if needed

## Database Schema Notes

### Legacy Table (user_sessions)

```sql
CREATE TABLE user_sessions (
  session_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

### Astro Session Storage

- Stored in memory (development) or configured backend
- Session cookie only contains session ID
- Data is not stored in cookies (more secure)

## Troubleshooting

### Users can't log in

- Verify email is verified (`email_verified = 1`)
- Check if password hash is correct
- Review server logs for errors

### Migration not working

- Check that legacy session hasn't expired (`expires_at > current_time`)
- Verify user exists in the database
- Check Astro session configuration in `astro.config.ts`

### Performance issues

- Run cleanup during off-peak hours using the script
- Consider running batch migrations in batches if high user count

## Key Changes for Users

Users typically won't notice any difference. Session behavior remains the same:

- **Sessions persist** across browser restarts (with same session cookie)
- **Sessions auto-expire** after 1 week (configurable in `astro.config.ts`)
- **Security improved** - no sensitive data stored in cookies

## Rollback Plan

If needed to rollback:

1. Keep `user_sessions` table intact (not dropped)
2. Revert signin endpoint to old session creation method
3. Users keep their Astro sessions but won't get automatic migration
4. No data loss occurs as legacy sessions remain

## Questions & Support

For issues or questions:

1. Check migration status: `GET /api/migration/status` (admin only)
2. Review server logs for error details
3. Check [src/lib/migration.ts](../src/lib/migration.ts) for implementation
   details
