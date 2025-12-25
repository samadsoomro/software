import type { Express } from "express";
import { storage } from "./json-storage";
import bcrypt from "bcryptjs";
import multer from "multer";
import path from "path";
import fs from "fs";

const uploadDir = path.join(process.cwd(), "server", "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage_config = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + "-" + file.originalname);
  }
});

const upload = multer({
  storage: storage_config,
  fileFilter: (req, file, cb) => {
    if (file.mimetype === "application/pdf") {
      cb(null, true);
    } else {
      cb(new Error("Only PDF files are allowed"));
    }
  },
  limits: {
    fileSize: 100 * 1024 * 1024 // Increased to 100MB limit
  }
});

const ADMIN_EMAIL = "admin@samad.com";
const ADMIN_PASSWORD = "gcmn123";
const ADMIN_SECRET_KEY = "GCMN-ADMIN-ONLY";

declare module "express-session" {
  interface SessionData {
    userId?: string;
    isAdmin?: boolean;
    isLibraryCard?: boolean;
  }
}

export function registerRoutes(app: Express): void {
  app.post("/api/auth/register", async (req, res) => {
    try {
      const { email, password, fullName, phone, rollNumber, department, studentClass } = req.body;
      
      if (!email || !password || !fullName) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      const existing = await storage.getUserByEmail(email);
      if (existing) {
        return res.status(400).json({ error: "Email already registered" });
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const user = await storage.createUser({
        email,
        password: hashedPassword,
        fullName,
        phone,
        rollNumber,
        department,
        studentClass,
        type: studentClass ? "student" : "user"
      });

      await storage.createUserRole({ userId: user.id, role: "user" });

      req.session.userId = user.id;
      req.session.isAdmin = false;
      
      res.json({ user: { id: user.id, email: user.email } });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const { email, password, secretKey, libraryCardId } = req.body;

      // Check if admin login attempt
      if (secretKey) {
        if (email === ADMIN_EMAIL && password === ADMIN_PASSWORD && secretKey === ADMIN_SECRET_KEY) {
          req.session.userId = "admin";
          req.session.isAdmin = true;
          return res.json({ 
            user: { id: "admin", email: ADMIN_EMAIL },
            isAdmin: true,
            redirect: "/admin-dashboard"
          });
        } else if (secretKey !== ADMIN_SECRET_KEY) {
          // If secret key provided but wrong, still try to login as normal user
        }
      }

      // Library Card ID login (password not required)
      if (libraryCardId) {
        const cardApp = await storage.getLibraryCardByCardNumber(libraryCardId);
        if (!cardApp) {
          return res.status(401).json({ error: "Invalid library card ID" });
        }

        // Check if card is approved
        if (cardApp.status !== "approved") {
          return res.status(401).json({ error: "Card not approved. Library card is pending. Please wait for approval from the library." });
        }

        // Use library card ID as session identifier (prefix with "card-" to distinguish from regular users)
        req.session.userId = `card-${cardApp.id}`;
        req.session.isAdmin = false;
        req.session.isLibraryCard = true;

        return res.json({ user: { id: cardApp.id, email: cardApp.email, name: `${cardApp.firstName} ${cardApp.lastName}` } });
      }

      // Normal user login
      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      const valid = await bcrypt.compare(password, user.password);
      if (!valid) {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      req.session.userId = user.id;
      req.session.isAdmin = false;

      res.json({ user: { id: user.id, email: user.email } });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy(() => {
      res.json({ success: true });
    });
  });

  app.get("/api/auth/me", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    // Admin session
    if (req.session.isAdmin && req.session.userId === "admin") {
      return res.json({
        user: { id: "admin", email: ADMIN_EMAIL },
        roles: ["admin"],
        isAdmin: true
      });
    }

    // Library Card session
    if (req.session.isLibraryCard) {
      const cardId = req.session.userId.replace(/^card-/, "");
      const card = await storage.getLibraryCardApplication(cardId);
      if (!card) {
        return res.status(401).json({ error: "Library card not found" });
      }
      return res.json({
        user: { 
          id: card.id, 
          email: card.email, 
          name: `${card.firstName} ${card.lastName}`,
          cardNumber: card.cardNumber
        },
        isLibraryCard: true
      });
    }

    // Regular user session
    const user = await storage.getUser(req.session.userId);
    if (!user) {
      return res.status(401).json({ error: "User not found" });
    }

    const profile = await storage.getProfile(user.id);
    const roles = await storage.getUserRoles(user.id);
    const isAdmin = await storage.hasRole(user.id, "admin");

    res.json({
      user: { id: user.id, email: user.email },
      profile,
      roles: roles.map((r) => r.role),
      isAdmin
    });
  });

  app.get("/api/profile", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    const profile = await storage.getProfile(req.session.userId);
    res.json(profile || null);
  });

  app.put("/api/profile", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    const profile = await storage.updateProfile(req.session.userId, req.body);
    res.json(profile);
  });

  // Admin-only routes - check admin status
  const requireAdmin = async (req: any, res: any, next: any) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    if (req.session.isAdmin) {
      return next();
    }
    const isAdmin = await storage.hasRole(req.session.userId, "admin");
    if (!isAdmin) {
      return res.status(403).json({ error: "Admin access required" });
    }
    next();
  };

  app.get("/api/admin/users", requireAdmin, async (req, res) => {
    try {
      const users = await storage.getStudents();
      const nonStudents = await storage.getNonStudents();
      res.json({ students: users, nonStudents: nonStudents });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/admin/library-cards", requireAdmin, async (req, res) => {
    try {
      const cards = await storage.getLibraryCardApplications();
      res.json(cards);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/admin/borrowed-books", requireAdmin, async (req, res) => {
    try {
      const borrows = await storage.getBookBorrows();
      res.json(borrows);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/admin/stats", requireAdmin, async (req, res) => {
    try {
      const users = await storage.getStudents();
      const nonStudents = await storage.getNonStudents();
      const libraryCards = await storage.getLibraryCardApplications();
      const borrowedBooks = await storage.getBookBorrows();
      const donations = await storage.getDonations();

      const activeBorrows = borrowedBooks.filter((b) => b.status === "borrowed").length;
      const returnedBooks = borrowedBooks.filter((b) => b.status === "returned").length;

      res.json({
        totalUsers: users.length + nonStudents.length,
        totalBooks: borrowedBooks.length,
        libraryCards: libraryCards.length,
        borrowedBooks: activeBorrows,
        returnedBooks: returnedBooks,
        donations: donations.length
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Keep other existing routes with storage
  app.get("/api/contact-messages", requireAdmin, async (req, res) => {
    try {
      const messages = await storage.getContactMessages();
      res.json(messages);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/contact-messages", async (req, res) => {
    try {
      const { name, email, subject, message } = req.body;
      if (!name || !email || !subject || !message) {
        return res.status(400).json({ error: "Missing required fields" });
      }
      const result = await storage.createContactMessage({ name, email, subject, message });
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.patch("/api/contact-messages/:id/seen", requireAdmin, async (req, res) => {
    try {
      const message = await storage.updateContactMessageSeen(req.params.id, req.body.isSeen);
      res.json(message);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/contact-messages/:id", requireAdmin, async (req, res) => {
    try {
      await storage.deleteContactMessage(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/book-borrows", async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      if (req.session.isAdmin) {
        const borrows = await storage.getBookBorrows();
        return res.json(borrows);
      }
      const borrows = await storage.getBookBorrowsByUser(req.session.userId);
      res.json(borrows);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/book-borrows", async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const { bookTitle, isbn, borrowDate } = req.body;
      if (!bookTitle || !isbn) {
        return res.status(400).json({ error: "Missing required fields" });
      }
      const borrow = await storage.createBookBorrow({
        userId: req.session.userId,
        bookTitle,
        isbn,
        borrowDate: borrowDate || new Date().toISOString(),
        status: "borrowed"
      });
      res.json(borrow);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.patch("/api/book-borrows/:id/status", requireAdmin, async (req, res) => {
    try {
      const { status, returnDate } = req.body;
      const borrow = await storage.updateBookBorrowStatus(
        req.params.id,
        status,
        returnDate ? new Date(returnDate) : undefined
      );
      res.json(borrow);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/library-card-applications", async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      if (req.session.isAdmin) {
        const applications = await storage.getLibraryCardApplications();
        return res.json(applications);
      }
      const applications = await storage.getLibraryCardApplicationsByUser(req.session.userId);
      res.json(applications);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/library-card-applications", async (req, res) => {
    try {
      const {
        firstName,
        lastName,
        fatherName,
        dob,
        email,
        phone,
        field,
        rollNo,
        studentClass,
        class: studentClassAlt,
        addressStreet,
        addressCity,
        addressState,
        addressZip
      } = req.body;
      
      const application = await storage.createLibraryCardApplication({
        userId: req.session?.userId || null,
        firstName,
        lastName,
        fatherName,
        dob,
        email,
        phone,
        field,
        rollNo,
        class: studentClass || studentClassAlt,
        addressStreet,
        addressCity,
        addressState,
        addressZip,
        status: "pending"
      });
      res.json(application);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.patch("/api/library-card-applications/:id/status", requireAdmin, async (req, res) => {
    try {
      const application = await storage.updateLibraryCardApplicationStatus(
        req.params.id,
        req.body.status
      );
      res.json(application);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/library-card-applications/:id", requireAdmin, async (req, res) => {
    try {
      await storage.deleteLibraryCardApplication(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/donations", requireAdmin, async (req, res) => {
    try {
      const donations = await storage.getDonations();
      res.json(donations);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/donations", async (req, res) => {
    try {
      const { donorName, email, bookTitle, author, quantity } = req.body;
      const donation = await storage.createDonation({
        donorName,
        email,
        bookTitle,
        author,
        quantity,
        status: "received"
      });
      res.json(donation);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.delete("/api/donations/:id", requireAdmin, async (req, res) => {
    try {
      await storage.deleteDonation(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/notes", async (req, res) => {
    try {
      const notes = await storage.getActiveNotes();
      res.json(notes);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/notes/filter", async (req, res) => {
    try {
      const { class: studentClass, subject } = req.query;
      if (!studentClass || !subject) {
        return res.status(400).json({ error: "Class and subject required" });
      }
      const notes = await storage.getNotesByClassAndSubject(studentClass as string, subject as string);
      res.json(notes);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/admin/notes", requireAdmin, async (req, res) => {
    try {
      const notes = await storage.getNotes();
      res.json(notes);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/admin/notes", requireAdmin, upload.single('file'), async (req, res) => {
    try {
      const { class: studentClass, subject, title, description, status } = req.body;
      if (!studentClass || !subject || !title || !description || !req.file) {
        return res.status(400).json({ error: "Missing required fields or file" });
      }
      
      const pdfPath = `/server/uploads/${req.file.filename}`;
      
      const note = await storage.createNote({
        class: studentClass,
        subject,
        title,
        description,
        pdfPath,
        status: status || "active"
      });
      res.json(note);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.patch("/api/admin/notes/:id", requireAdmin, async (req, res) => {
    try {
      const note = await storage.updateNote(req.params.id, req.body);
      res.json(note);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.patch("/api/admin/notes/:id/toggle", requireAdmin, async (req, res) => {
    try {
      const note = await storage.toggleNoteStatus(req.params.id);
      res.json(note);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/admin/notes/:id", requireAdmin, async (req, res) => {
    try {
      await storage.deleteNote(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/admin/rare-books", requireAdmin, async (req, res) => {
    try {
      const books = await storage.getRareBooks();
      res.json(books);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/admin/rare-books", requireAdmin, upload.single('file'), async (req, res) => {
    try {
      const { title, description, category, status } = req.body;
      if (!title || !description || !req.file) {
        return res.status(400).json({ error: "Missing required fields or file" });
      }
      const pdfPath = `/server/uploads/${req.file.filename}`;
      const book = await storage.createRareBook({
        title,
        description,
        category: category || "General",
        pdfPath,
        status: status || "active"
      });
      res.json(book);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.patch("/api/admin/rare-books/:id/toggle", requireAdmin, async (req, res) => {
    try {
      const book = await storage.toggleRareBookStatus(req.params.id);
      res.json(book);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/admin/rare-books/:id", requireAdmin, async (req, res) => {
    try {
      await storage.deleteRareBook(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/rare-books", async (req, res) => {
    try {
      const books = await storage.getRareBooks();
      res.json(books.filter((b: any) => b.status === "active"));
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
}
