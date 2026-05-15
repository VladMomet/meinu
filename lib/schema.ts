import { pgTable, text, integer, timestamp, jsonb, uuid, pgEnum } from 'drizzle-orm/pg-core';

export const userTypeEnum = pgEnum('user_type', ['private', 'business']);
export const orderStatusEnum = pgEnum('order_status', ['new', 'confirmed', 'shipping', 'done', 'cancelled']);
export const inquiryStatusEnum = pgEnum('inquiry_status', ['new', 'in_progress', 'answered', 'closed']);

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  type: userTypeEnum('type').notNull().default('private'),
  name: text('name').notNull(),
  phone: text('phone').notNull(),
  email: text('email'),
  passwordHash: text('password_hash').notNull(),
  // Поля для юрлица
  orgName: text('org_name'),
  inn: text('inn'),
  kpp: text('kpp'),
  ogrn: text('ogrn'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const orders = pgTable('orders', {
  id: text('id').primaryKey(),                       // например, MN-260515-123
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  status: orderStatusEnum('status').notNull().default('new'),
  city: text('city').notNull(),
  total: integer('total').notNull(),                 // итог в рублях
  items: jsonb('items').$type<Array<{ id: string; name: string; qty: number; price: number }>>().notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const inquiries = pgTable('inquiries', {
  id: text('id').primaryKey(),                       // например, CR-260515-123
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  status: inquiryStatusEnum('status').notNull().default('new'),
  description: text('description').notNull(),
  quantity: integer('quantity').notNull(),
  budgetRub: integer('budget_rub'),
  photosCount: integer('photos_count').notNull().default(0),
  // В MVP фото шлются напрямую в Telegram, в БД храним только количество
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Order = typeof orders.$inferSelect;
export type Inquiry = typeof inquiries.$inferSelect;
