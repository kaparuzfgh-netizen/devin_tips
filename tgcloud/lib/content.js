import { db } from 'sdk';
import { eq, and, desc, sql } from 'sdk/db';
import { posts, codeSnippets } from '../schema.js';

// Create a new post
export async function createPost(type, title, content, createdBy, options = {}) {
  const { language, tags } = options;
  const [post] = await db.insert(posts)
    .values({
      type,
      title,
      content,
      language,
      tags: tags ? JSON.stringify(tags) : null,
      createdBy,
      published: false,
    })
    .returning()
    .run();
  return post;
}

// Publish a post
export async function publishPost(postId) {
  const [post] = await db.update(posts)
    .set({
      published: true,
      publishedAt: sql`(unixepoch())`,
    })
    .where(eq(posts.id, postId))
    .returning()
    .run();
  return post;
}

// Get published posts by type
export async function getPublishedPosts(type = null, limit = 10) {
  const query = db.select().from(posts).where(eq(posts.published, true));
  if (type) {
    query.where(and(eq(posts.published, true), eq(posts.type, type)));
  }
  return await query.orderBy(desc(posts.publishedAt)).limit(limit).all();
}

// Get a specific post
export async function getPost(postId) {
  return await db.select().from(posts).where(eq(posts.id, postId)).get();
}

// Store code snippet (self-reference)
export async function storeCodeSnippet(name, description, code, filePath, language) {
  const [snippet] = await db.insert(codeSnippets)
    .values({
      name,
      description,
      code,
      filePath,
      language,
    })
    .returning()
    .run();
  return snippet;
}

// Get code snippet by name
export async function getCodeSnippet(name) {
  return await db.select().from(codeSnippets).where(eq(codeSnippets.name, name)).get();
}

// List all code snippets
export async function listCodeSnippets() {
  return await db.select().from(codeSnippets).all();
}
