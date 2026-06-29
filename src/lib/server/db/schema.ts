import { sql } from 'drizzle-orm';
import {
  check,
  type AnySQLiteColumn,
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex
} from 'drizzle-orm/sqlite-core';

export const users = sqliteTable(
  'users',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    email: text('email'),
    phone: text('phone').notNull(),
    firstName: text('first_name').notNull(),
    lastName: text('last_name').notNull(),
    passwordHash: text('pwd_hash').notNull(),
    role: text('role').notNull().default('user'),
    status: text('status').notNull().default('active'),
    mutedUntil: text('muted_until'),
    createdAt: text('created_at').notNull().default(sql`(datetime('now'))`)
  },
  (table) => [
    uniqueIndex('users_email_unique').on(table.email),
    check(
      'users_role_check',
      sql`${table.role} IN ('admin','chief_editor','editor','reviewer','moderator','subscriber','user')`
    )
  ]
);

export const sessions = sqliteTable(
  'sessions',
  {
    id: text('id').primaryKey(),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    expiresAt: text('expires_at').notNull()
  },
  (table) => [index('idx_sessions_user_id').on(table.userId), index('idx_sessions_expires_at').on(table.expiresAt)]
);

export const volumes = sqliteTable('volumes', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  slug: text('slug').notNull().unique(),
  number: integer('number').notNull().unique(),
  title: text('title').notNull(),
  publishedAt: text('published_at')
});

export const articles = sqliteTable(
  'articles',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    slug: text('slug').notNull().unique(),
    volumeId: integer('volume_id').references(() => volumes.id, { onDelete: 'set null' }),
    title: text('title').notNull(),
    subtitle: text('subtitle').notNull().default(''),
    abstract: text('abstract').notNull().default(''),
    bodyJson: text('body_json').notNull().default('[]'),
    bodyText: text('body_text').notNull().default(''),
    status: text('status').notNull().default('draft'),
    access: text('access').notNull().default('public'),
    commentsEnabled: integer('comments_enabled', { mode: 'boolean' }).notNull().default(true),
    publishedAt: text('published_at'),
    updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`)
  },
  (table) => [
    index('idx_articles_status_published').on(table.status, table.publishedAt),
    index('idx_articles_volume_id').on(table.volumeId)
  ]
);

export const articleAuthors = sqliteTable(
  'article_authors',
  {
    articleId: integer('article_id')
      .notNull()
      .references(() => articles.id, { onDelete: 'cascade' }),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' })
  },
  (table) => [primaryKey({ columns: [table.articleId, table.userId] }), index('idx_article_authors_user_id').on(table.userId)]
);

export const pages = sqliteTable('pages', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  slug: text('slug').notNull().unique(),
  title: text('title').notNull()
});

export const blocks = sqliteTable(
  'blocks',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    pageId: integer('page_id')
      .notNull()
      .references(() => pages.id, { onDelete: 'cascade' }),
    type: text('type').notNull(),
    payloadJson: text('payload_json').notNull().default('{}'),
    position: integer('position').notNull().default(0)
  },
  (table) => [index('idx_blocks_page_id').on(table.pageId)]
);

export const plans = sqliteTable('plans', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  code: text('code').notNull().unique(),
  title: text('title').notNull(),
  amount: integer('amount').notNull(),
  period: text('period').notNull()
});

export const subscriptions = sqliteTable(
  'subscriptions',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    cpSubscriptionId: text('cp_subscription_id').unique(),
    cpCustomerId: text('cp_customer_id'),
    planId: integer('plan_id').references(() => plans.id, { onDelete: 'set null' }),
    status: text('status').notNull(),
    periodEnd: text('period_end')
  },
  (table) => [index('idx_subscriptions_user_id').on(table.userId), index('idx_subscriptions_plan_id').on(table.planId)]
);

export const payments = sqliteTable(
  'payments',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    cpTransactionId: text('cp_transaction_id').notNull().unique(),
    amount: integer('amount').notNull(),
    status: text('status').notNull(),
    createdAt: text('created_at').notNull().default(sql`(datetime('now'))`)
  },
  (table) => [index('idx_payments_user_id').on(table.userId)]
);

export const paymentEvents = sqliteTable('payment_events', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  eventKey: text('event_key').unique(),
  rawJson: text('raw_json').notNull(),
  receivedAt: text('received_at').notNull().default(sql`(datetime('now'))`)
});

export const entitlements = sqliteTable(
  'entitlements',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: text('type').notNull(),
    startsAt: text('starts_at').notNull(),
    endsAt: text('ends_at').notNull(),
    source: text('source').notNull()
  },
  (table) => [index('idx_entitlements_user_dates').on(table.userId, table.startsAt, table.endsAt)]
);

export const favorites = sqliteTable(
  'favorites',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    articleId: integer('article_id')
      .notNull()
      .references(() => articles.id, { onDelete: 'cascade' }),
    kind: text('kind').notNull(),
    createdAt: text('created_at').notNull().default(sql`(datetime('now'))`)
  },
  (table) => [
    uniqueIndex('favorites_user_article_kind').on(table.userId, table.articleId, table.kind),
    index('idx_favorites_user_id').on(table.userId),
    index('idx_favorites_article_id').on(table.articleId)
  ]
);

export const annotations = sqliteTable(
  'annotations',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    articleId: integer('article_id')
      .notNull()
      .references(() => articles.id, { onDelete: 'cascade' }),
    paragraphId: text('paragraph_id').notNull(),
    type: text('type').notNull(),
    quote: text('quote').notNull(),
    prefix: text('prefix').notNull().default(''),
    suffix: text('suffix').notNull().default(''),
    startOff: integer('start_off').notNull(),
    endOff: integer('end_off').notNull(),
    note: text('note').notNull().default(''),
    color: text('color').notNull().default('yellow'),
    createdAt: text('created_at').notNull().default(sql`(datetime('now'))`)
  },
  (table) => [
    index('idx_annotations_user_article').on(table.userId, table.articleId),
    index('idx_annotations_article_id').on(table.articleId)
  ]
);

export const threads = sqliteTable(
  'threads',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    createdAt: text('created_at').notNull().default(sql`(datetime('now'))`)
  },
  (table) => [index('idx_threads_user_id').on(table.userId)]
);

export const comments = sqliteTable(
  'comments',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    target: text('target').notNull(),
    targetId: integer('target_id').notNull(),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    parentId: integer('parent_id').references((): AnySQLiteColumn => comments.id, {
      onDelete: 'cascade'
    }),
    body: text('body').notNull(),
    status: text('status').notNull().default('pending'),
    reportedAt: text('reported_at'),
    createdAt: text('created_at').notNull().default(sql`(datetime('now'))`)
  },
  (table) => [
    index('idx_comments_target').on(table.target, table.targetId, table.status, table.createdAt),
    index('idx_comments_user_id').on(table.userId),
    index('idx_comments_parent_id').on(table.parentId)
  ]
);

export const supportTickets = sqliteTable(
  'support_tickets',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    subject: text('subject').notNull(),
    body: text('body').notNull(),
    status: text('status').notNull().default('open'),
    createdAt: text('created_at').notNull().default(sql`(datetime('now'))`)
  },
  (table) => [index('idx_support_tickets_user_id').on(table.userId)]
);

export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`)
});
