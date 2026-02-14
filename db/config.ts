import { column, defineDb, defineTable } from 'astro:db';

/**
 * Users table - stores user authentication and profile data
 */
const Users = defineTable({
  columns: {
    id: column.text({ primaryKey: true }),
    email: column.text({ unique: true }),
    password_hash: column.text(),
    username: column.text({ optional: true }),
    bio: column.text({ optional: true }),
    avatar_url: column.text({ optional: true }),
    created_at: column.date({ default: new Date() }),
    updated_at: column.date({ default: new Date() }),
    email_verified: column.boolean({ default: false }),
    verification_token: column.text({ optional: true }),
    is_admin: column.boolean({ default: false }),
    school: column.text({ optional: true }),
    age: column.number({ optional: true }),
    ip: column.text({ optional: true })
  }
});

/**
 * Comments table - stores user comments on games
 */
const Comments = defineTable({
  columns: {
    id: column.text({ primaryKey: true }),
    user_id: column.text({ references: () => Users.columns.id }),
    game_id: column.text(),
    content: column.text(),
    created_at: column.date({ default: new Date() }),
    updated_at: column.date({ default: new Date() })
  }
});

/**
 * Likes table - stores user likes on games
 */
const Likes = defineTable({
  columns: {
    id: column.text({ primaryKey: true }),
    user_id: column.text({ references: () => Users.columns.id }),
    game_id: column.text(),
    created_at: column.date({ default: new Date() })
  },
  indexes: [{ on: ['user_id', 'game_id'], unique: true }]
});

/**
 * Feedback table - stores user feedback (optional user_id for anonymous feedback)
 */
const Feedback = defineTable({
  columns: {
    id: column.text({ primaryKey: true }),
    user_id: column.text({ references: () => Users.columns.id, optional: true }),
    content: column.text(),
    created_at: column.date({ default: new Date() })
  }
});

/**
 * Changelog table - stores application changelog entries
 */
const Changelog = defineTable({
  columns: {
    id: column.text({ primaryKey: true }),
    title: column.text(),
    content: column.text(),
    author_id: column.text({ references: () => Users.columns.id }),
    created_at: column.date({ default: new Date() })
  }
});

/**
 * UserSettings table - stores user-specific settings and localstorage data
 */
const UserSettings = defineTable({
  columns: {
    id: column.text({ primaryKey: true }),
    user_id: column.text({ references: () => Users.columns.id, unique: true }),
    localstorage_data: column.text({ optional: true }), // JSON string
    theme: column.text({ default: 'dark', optional: true }),
    notifications_enabled: column.boolean({ default: true }),
    created_at: column.date({ default: new Date() }),
    updated_at: column.date({ default: new Date() })
  }
});

export default defineDb({
  tables: { Users, Comments, Likes, Feedback, Changelog, UserSettings }
});
