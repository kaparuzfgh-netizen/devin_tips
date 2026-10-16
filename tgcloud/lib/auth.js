import { db } from 'sdk';
import { eq } from 'sdk/db';
import { users } from '../schema.js';

// Admin usernames (configurable)
const ADMIN_USERNAMES = ['kaparuz'];

// Get or create user with default role
export async function getOrCreateUser(telegramId, username) {
  let user = await db.select().from(users).where(eq(users.telegramId, telegramId)).get();

  if (!user) {
    const role = ADMIN_USERNAMES.includes(username) ? 'admin' : 'user';
    const [newUser] = await db.insert(users)
      .values({ telegramId, username, role })
      .returning()
      .run();
    user = newUser;
  } else if (username && user.username !== username) {
    // Update username if changed (updatedAt updated automatically by trigger or manually)
    const [updatedUser] = await db.update(users)
      .set({ username })
      .where(eq(users.telegramId, telegramId))
      .returning()
      .run();
    user = updatedUser;
  } else if (username && ADMIN_USERNAMES.includes(username) && user.role !== 'admin') {
    // Promote to admin if username matches
    const [updatedUser] = await db.update(users)
      .set({ role: 'admin' })
      .where(eq(users.telegramId, telegramId))
      .returning()
      .run();
    user = updatedUser;
  }

  return user;
}

// Check if user is admin
export function isAdmin(user) {
  return user.role === 'admin';
}

// Check if user has permission
export function hasPermission(user, action) {
  if (user.role === 'admin') return true;
  // Additional role-based permissions can be added here
  return false;
}
