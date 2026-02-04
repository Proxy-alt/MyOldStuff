#!/usr/bin/env node
/**
 * Legacy Session Migration Script
 * Use this script to clean up and migrate legacy sessions from the database
 *
 * Usage:
 *   node scripts/migrate-sessions.js           # Show statistics
 *   node scripts/migrate-sessions.js --cleanup  # Clean up expired sessions
 *   node scripts/migrate-sessions.js --full     # Full migration (cleanup + analysis)
 */

import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.join(__dirname, '..', 'src', 'data', 'users.db');

const db = new Database(dbPath);

interface SessionStats {
    activeSessions: number;
    expiredSessions: number;
    totalSessions: number;
    uniqueUsers: number;
    oldestSession: number | null;
    newestSession: number | null;
}

function getStats(): SessionStats {
    const now = Date.now();

    const activeSessions = db.prepare('SELECT COUNT(*) as count FROM user_sessions WHERE expires_at > ?').get(now) as {
        count: number;
    };
    const expiredSessions = db.prepare('SELECT COUNT(*) as count FROM user_sessions WHERE expires_at <= ?').get(now) as {
        count: number;
    };
    const totalSessions = db.prepare('SELECT COUNT(*) as count FROM user_sessions').get() as { count: number };
    const uniqueUsers = db.prepare('SELECT COUNT(DISTINCT user_id) as count FROM user_sessions').get() as { count: number };

    const oldest = db.prepare('SELECT MIN(created_at) as oldest FROM user_sessions').get() as { oldest: number | null };
    const newest = db.prepare('SELECT MAX(created_at) as newest FROM user_sessions').get() as { newest: number | null };

    return {
        activeSessions: activeSessions.count,
        expiredSessions: expiredSessions.count,
        totalSessions: totalSessions.count,
        uniqueUsers: uniqueUsers.count,
        oldestSession: oldest.oldest,
        newestSession: newest.newest
    };
}

function printStats(stats: SessionStats) {
    console.log('\n📊 Legacy Session Statistics:\n');
    console.log(`   Total Sessions:     ${stats.totalSessions}`);
    console.log(`   Active Sessions:    ${stats.activeSessions} (valid)`);
    console.log(`   Expired Sessions:   ${stats.expiredSessions} (ready for cleanup)`);
    console.log(`   Unique Users:       ${stats.uniqueUsers}`);

    if (stats.oldestSession) {
        const oldestDate = new Date(stats.oldestSession);
        console.log(`   Oldest Session:     ${oldestDate.toISOString()}`);
    }

    if (stats.newestSession) {
        const newestDate = new Date(stats.newestSession);
        console.log(`   Newest Session:     ${newestDate.toISOString()}`);
    }
}

function cleanupExpiredSessions(): number {
    const result = db.prepare('DELETE FROM user_sessions WHERE expires_at <= ?').run(Date.now());
    return result.changes;
}

function getDetailedBreakdown() {
    const details = db
        .prepare(
            `
    SELECT
      u.id,
      u.email,
      COUNT(us.session_id) as session_count,
      MIN(us.created_at) as oldest_session,
      MAX(us.expires_at) as latest_expiry,
      SUM(CASE WHEN us.expires_at > ? THEN 1 ELSE 0 END) as active_sessions
    FROM users u
    LEFT JOIN user_sessions us ON u.id = us.user_id
    WHERE us.session_id IS NOT NULL
    GROUP BY u.id
    ORDER BY active_sessions DESC
  `
        )
        .all(Date.now()) as Array<{
            id: string;
            email: string;
            session_count: number;
            oldest_session: number;
            latest_expiry: number;
            active_sessions: number;
        }>;

    return details;
}

function printDetailedBreakdown() {
    const details = getDetailedBreakdown();

    if (details.length === 0) {
        console.log('\n   No legacy sessions found.\n');
        return;
    }

    console.log('\n👤 User Sessions Breakdown:\n');
    console.log('   Email                                    Sessions  Active  Latest Expiry');
    console.log('   ' + '─'.repeat(85));

    for (const detail of details) {
        const latestDate = new Date(detail.latest_expiry).toLocaleDateString();
        const email = detail.email.padEnd(40);
        const sessions = String(detail.session_count).padStart(8);
        const active = String(detail.active_sessions).padStart(7);
        console.log(`   ${email}${sessions}${active}   ${latestDate}`);
    }
    console.log();
}

async function main() {
    const args = process.argv.slice(2);
    const showHelp = args.includes('--help') || args.includes('-h');
    const cleanup = args.includes('--cleanup');
    const full = args.includes('--full');
    const detailed = args.includes('--detailed') || full;

    if (showHelp) {
        console.log(`
📝 Legacy Session Migration Script

Usage:
  node scripts/migrate-sessions.js [options]

Options:
  --help              Show this help message
  --cleanup           Delete expired sessions
  --detailed          Show detailed user breakdown
  --full              Run full analysis (cleanup + detailed)

Examples:
  node scripts/migrate-sessions.js
  node scripts/migrate-sessions.js --cleanup
  node scripts/migrate-sessions.js --detailed
  node scripts/migrate-sessions.js --full
    `);
        process.exit(0);
    }

    console.log('\n🔄 Legacy Session Migration Tool');
    console.log('═'.repeat(50));

    const statsBefore = getStats();
    printStats(statsBefore);

    if (detailed) {
        printDetailedBreakdown();
    }

    if (cleanup) {
        console.log('\n🧹 Cleaning up expired sessions...');
        const deleted = cleanupExpiredSessions();
        console.log(`   ✓ Deleted ${deleted} expired session(s)\n`);

        const statsAfter = getStats();
        console.log('📊 Statistics After Cleanup:\n');
        printStats(statsAfter);
    }

    console.log('\n✅ Migration script completed.\n');
    console.log('💡 Migration Notes:');
    console.log('   • Active sessions will be migrated on user login');
    console.log('   • Expired sessions can be safely deleted with --cleanup');
    console.log('   • Users will automatically transition to Astro sessions');
    console.log('   • The old user_sessions table can be deprecated after migration period\n');

    db.close();
}

main().catch((err) => {
    console.error('Error:', err);
    process.exit(1);
});
