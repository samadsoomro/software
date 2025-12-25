import fs from "fs/promises";
import path from "path";
import { randomBytes } from "crypto";

const DATA_DIR = path.join(process.cwd(), ".data");

function generateId(): string {
  return randomBytes(8).toString("hex");
}

interface StorageData {
  users: any[];
  profiles: any[];
  contactMessages: any[];
  bookBorrows: any[];
  libraryCardApplications: any[];
  donations: any[];
  userRoles: any[];
  notes: any[];
  rareBooks: any[];
}

class JsonStorage {
  private data: StorageData = {
    users: [],
    profiles: [],
    contactMessages: [],
    bookBorrows: [],
    libraryCardApplications: [],
    donations: [],
    userRoles: [],
    notes: [],
    rareBooks: []
  };

  async init() {
    try {
      await fs.mkdir(DATA_DIR, { recursive: true });
      const dataFile = path.join(DATA_DIR, "data.json");
      try {
        const content = await fs.readFile(dataFile, "utf-8");
        this.data = JSON.parse(content);
        // Ensure all properties exist (backward compatibility)
        if (!this.data.notes) this.data.notes = [];
        if (!this.data.rareBooks) this.data.rareBooks = [];
        if (!this.data.users) this.data.users = [];
        if (!this.data.profiles) this.data.profiles = [];
        if (!this.data.contactMessages) this.data.contactMessages = [];
        if (!this.data.bookBorrows) this.data.bookBorrows = [];
        if (!this.data.libraryCardApplications) this.data.libraryCardApplications = [];
        if (!this.data.donations) this.data.donations = [];
        if (!this.data.userRoles) this.data.userRoles = [];
      } catch {
        await this.save();
      }
    } catch (error) {
      console.error("Error initializing storage:", error);
    }
  }

  private async save() {
    const dataFile = path.join(DATA_DIR, "data.json");
    await fs.writeFile(dataFile, JSON.stringify(this.data, null, 2));
  }

  async getUser(id: string) {
    return this.data.users.find((u) => u.id === id);
  }

  async getUserByEmail(email: string) {
    return this.data.users.find((u) => u.email === email);
  }

  async createUser(user: any) {
    const id = generateId();
    const newUser = { id, ...user, createdAt: new Date().toISOString() };
    this.data.users.push(newUser);
    await this.save();
    return newUser;
  }

  async getProfile(userId: string) {
    return this.data.profiles.find((p) => p.userId === userId);
  }

  async createProfile(profile: any) {
    const newProfile = { id: generateId(), ...profile, createdAt: new Date().toISOString() };
    this.data.profiles.push(newProfile);
    await this.save();
    return newProfile;
  }

  async updateProfile(userId: string, profile: any) {
    const existing = this.data.profiles.find((p) => p.userId === userId);
    if (!existing) return undefined;
    Object.assign(existing, profile, { updatedAt: new Date().toISOString() });
    await this.save();
    return existing;
  }

  async getUserRoles(userId: string) {
    return this.data.userRoles.filter((r) => r.userId === userId);
  }

  async createUserRole(role: any) {
    const newRole = { id: generateId(), ...role, createdAt: new Date().toISOString() };
    this.data.userRoles.push(newRole);
    await this.save();
    return newRole;
  }

  async hasRole(userId: string, role: string) {
    return this.data.userRoles.some((r) => r.userId === userId && r.role === role);
  }

  async getContactMessages() {
    return this.data.contactMessages;
  }

  async getContactMessage(id: string) {
    return this.data.contactMessages.find((m) => m.id === id);
  }

  async createContactMessage(message: any) {
    const newMessage = { id: generateId(), ...message, createdAt: new Date().toISOString(), isSeen: false };
    this.data.contactMessages.push(newMessage);
    await this.save();
    return newMessage;
  }

  async updateContactMessageSeen(id: string, isSeen: boolean) {
    const message = this.data.contactMessages.find((m) => m.id === id);
    if (!message) return undefined;
    message.isSeen = isSeen;
    await this.save();
    return message;
  }

  async deleteContactMessage(id: string) {
    this.data.contactMessages = this.data.contactMessages.filter((m) => m.id !== id);
    await this.save();
  }

  async getBookBorrows() {
    return this.data.bookBorrows;
  }

  async getBookBorrowsByUser(userId: string) {
    return this.data.bookBorrows.filter((b) => b.userId === userId);
  }

  async createBookBorrow(borrow: any) {
    const newBorrow = { id: generateId(), ...borrow, createdAt: new Date().toISOString() };
    this.data.bookBorrows.push(newBorrow);
    await this.save();
    return newBorrow;
  }

  async updateBookBorrowStatus(id: string, status: string, returnDate?: Date) {
    const borrow = this.data.bookBorrows.find((b) => b.id === id);
    if (!borrow) return undefined;
    borrow.status = status;
    if (returnDate) borrow.returnDate = returnDate.toISOString();
    await this.save();
    return borrow;
  }

  async getLibraryCardApplications() {
    return this.data.libraryCardApplications;
  }

  async getLibraryCardApplication(id: string) {
    return this.data.libraryCardApplications.find((a) => a.id === id);
  }

  async getLibraryCardApplicationsByUser(userId: string) {
    return this.data.libraryCardApplications.filter((a) => a.userId === userId);
  }

  async createLibraryCardApplication(application: any) {
    // Check for duplicate email
    const existingApplication = this.data.libraryCardApplications.find(
      (app) => app.email.toLowerCase() === application.email.toLowerCase()
    );
    if (existingApplication) {
      throw new Error("A library card application with this email already exists");
    }

    const fieldCodeMap: Record<string, string> = {
      "Computer Science": "CS",
      "Commerce": "COM",
      "Humanities": "HM",
      "Pre-Engineering": "PE",
      "Pre-Medical": "PM"
    };

    const fieldCode = fieldCodeMap[application.field] || "XX";
    // Extract just the number from class (e.g., "12" from "Class 12")
    const classNumber = application.class.replace(/[^\d]/g, '') || application.class;
    let cardNumber = `${fieldCode}-${application.rollNo}-${classNumber}`;
    
    // Ensure uniqueness
    let counter = 1;
    const baseCardNumber = cardNumber;
    while (this.data.libraryCardApplications.some(app => app.cardNumber === cardNumber)) {
      cardNumber = `${baseCardNumber}-${counter}`;
      counter++;
    }

    const studentId = `GCMN-${Math.floor(Math.random() * 1000000)
      .toString()
      .padStart(6, "0")}`;
    const issueDate = new Date().toISOString().split("T")[0];
    const validThrough = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0];

    const newApplication = {
      id: generateId(),
      ...application,
      cardNumber,
      studentId,
      issueDate,
      validThrough,
      createdAt: new Date().toISOString()
    };
    this.data.libraryCardApplications.push(newApplication);
    await this.save();
    return newApplication;
  }

  async getLibraryCardByCardNumber(cardNumber: string) {
    return this.data.libraryCardApplications.find((a) => a.cardNumber === cardNumber);
  }

  async updateLibraryCardApplicationStatus(id: string, status: string) {
    const application = this.data.libraryCardApplications.find((a) => a.id === id);
    if (!application) return undefined;
    application.status = status;
    application.updatedAt = new Date().toISOString();
    await this.save();
    return application;
  }

  async deleteLibraryCardApplication(id: string) {
    this.data.libraryCardApplications = this.data.libraryCardApplications.filter(
      (a) => a.id !== id
    );
    await this.save();
  }

  async getDonations() {
    return this.data.donations;
  }

  async createDonation(donation: any) {
    const newDonation = { id: generateId(), ...donation, createdAt: new Date().toISOString() };
    this.data.donations.push(newDonation);
    await this.save();
    return newDonation;
  }

  async deleteDonation(id: string) {
    this.data.donations = this.data.donations.filter((d) => d.id !== id);
    await this.save();
  }

  async getStudents() {
    return this.data.users.filter((u) => u.type === "student");
  }

  async getNonStudents() {
    return this.data.users.filter((u) => u.type !== "student");
  }

  async getNotes() {
    return this.data.notes;
  }

  async getNotesByClassAndSubject(studentClass: string, subject: string) {
    return this.data.notes.filter((n) => n.class === studentClass && n.subject === subject && n.status === "active");
  }

  async getActiveNotes() {
    return this.data.notes.filter((n) => n.status === "active");
  }

  async createNote(note: any) {
    const newNote = { id: generateId(), ...note, createdAt: new Date().toISOString() };
    this.data.notes.push(newNote);
    await this.save();
    return newNote;
  }

  async updateNote(id: string, note: any) {
    const existing = this.data.notes.find((n) => n.id === id);
    if (!existing) return undefined;
    Object.assign(existing, note, { updatedAt: new Date().toISOString() });
    await this.save();
    return existing;
  }

  async deleteNote(id: string) {
    this.data.notes = this.data.notes.filter((n) => n.id !== id);
    await this.save();
  }

  async toggleNoteStatus(id: string) {
    const note = this.data.notes.find((n) => n.id === id);
    if (!note) return undefined;
    note.status = note.status === "active" ? "inactive" : "active";
    note.updatedAt = new Date().toISOString();
    await this.save();
    return note;
  }

  async getRareBooks() {
    return this.data.rareBooks || [];
  }

  async createRareBook(book: any) {
    const newBook = { id: generateId(), ...book, createdAt: new Date().toISOString() };
    if (!this.data.rareBooks) this.data.rareBooks = [];
    this.data.rareBooks.push(newBook);
    await this.save();
    return newBook;
  }

  async deleteRareBook(id: string) {
    this.data.rareBooks = (this.data.rareBooks || []).filter((b) => b.id !== id);
    await this.save();
  }

  async toggleRareBookStatus(id: string) {
    const book = (this.data.rareBooks || []).find((b) => b.id === id);
    if (!book) return undefined;
    book.status = book.status === "active" ? "inactive" : "active";
    book.updatedAt = new Date().toISOString();
    await this.save();
    return book;
  }
}

export const storage = new JsonStorage();
