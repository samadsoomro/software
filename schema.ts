import { pgTable, text, timestamp, uuid, decimal, date, boolean, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const appRoleEnum = pgEnum("app_role", ["admin", "moderator", "user"]);

export const userRoles = pgTable("user_roles", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull(),
  role: appRoleEnum("role").notNull().default("user"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const profiles = pgTable("profiles", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().unique(),
  fullName: text("full_name").notNull(),
  phone: text("phone"),
  rollNumber: text("roll_number"),
  department: text("department"),
  studentClass: text("student_class"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const contactMessages = pgTable("contact_messages", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  subject: text("subject").notNull(),
  message: text("message").notNull(),
  isSeen: boolean("is_seen").default(false).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const bookBorrows = pgTable("book_borrows", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull(),
  bookId: text("book_id").notNull(),
  bookTitle: text("book_title").notNull(),
  borrowDate: timestamp("borrow_date", { withTimezone: true }).defaultNow().notNull(),
  dueDate: timestamp("due_date", { withTimezone: true }).notNull(),
  returnDate: timestamp("return_date", { withTimezone: true }),
  status: text("status").default("borrowed").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const libraryCardApplications = pgTable("library_card_applications", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id"),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  fatherName: text("father_name"),
  dob: date("dob"),
  class: text("class").notNull(),
  field: text("field"),
  rollNo: text("roll_no").notNull(),
  email: text("email").notNull(),
  phone: text("phone").notNull(),
  addressStreet: text("address_street").notNull(),
  addressCity: text("address_city").notNull(),
  addressState: text("address_state").notNull(),
  addressZip: text("address_zip").notNull(),
  status: text("status").default("pending").notNull(),
  cardNumber: text("card_number").unique(),
  studentId: text("student_id"),
  issueDate: date("issue_date"),
  validThrough: date("valid_through"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const donations = pgTable("donations", {
  id: uuid("id").defaultRandom().primaryKey(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  method: text("method").notNull(),
  name: text("name"),
  email: text("email"),
  message: text("message"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const students = pgTable("students", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull(),
  cardId: text("card_id").notNull().unique(),
  name: text("name").notNull(),
  class: text("class"),
  field: text("field"),
  rollNo: text("roll_no"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const nonStudents = pgTable("non_students", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull(),
  name: text("name").notNull(),
  role: text("role").notNull(),
  phone: text("phone"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true });
export const insertProfileSchema = createInsertSchema(profiles).omit({ id: true, createdAt: true, updatedAt: true });
export const insertContactMessageSchema = createInsertSchema(contactMessages).omit({ id: true, createdAt: true, isSeen: true });
export const insertBookBorrowSchema = createInsertSchema(bookBorrows).omit({ id: true, createdAt: true, borrowDate: true, returnDate: true, status: true });
export const insertLibraryCardApplicationSchema = createInsertSchema(libraryCardApplications).omit({ id: true, createdAt: true, updatedAt: true, status: true, cardNumber: true, studentId: true, issueDate: true, validThrough: true });
export const insertDonationSchema = createInsertSchema(donations).omit({ id: true, createdAt: true });
export const insertStudentSchema = createInsertSchema(students).omit({ id: true, createdAt: true });
export const insertNonStudentSchema = createInsertSchema(nonStudents).omit({ id: true, createdAt: true });
export const insertUserRoleSchema = createInsertSchema(userRoles).omit({ id: true, createdAt: true });

export type InsertUser = z.infer<typeof insertUserSchema>;
export type InsertProfile = z.infer<typeof insertProfileSchema>;
export type InsertContactMessage = z.infer<typeof insertContactMessageSchema>;
export type InsertBookBorrow = z.infer<typeof insertBookBorrowSchema>;
export type InsertLibraryCardApplication = z.infer<typeof insertLibraryCardApplicationSchema>;
export type InsertDonation = z.infer<typeof insertDonationSchema>;
export type InsertStudent = z.infer<typeof insertStudentSchema>;
export type InsertNonStudent = z.infer<typeof insertNonStudentSchema>;
export type InsertUserRole = z.infer<typeof insertUserRoleSchema>;

export type User = typeof users.$inferSelect;
export type Profile = typeof profiles.$inferSelect;
export type ContactMessage = typeof contactMessages.$inferSelect;
export type BookBorrow = typeof bookBorrows.$inferSelect;
export type LibraryCardApplication = typeof libraryCardApplications.$inferSelect;
export type Donation = typeof donations.$inferSelect;
export type Student = typeof students.$inferSelect;
export type NonStudent = typeof nonStudents.$inferSelect;
export type UserRole = typeof userRoles.$inferSelect;
