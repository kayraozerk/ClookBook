// app.js
require("dotenv").config();

const express = require("express");
const path = require("path");
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");

const app = express(); // önce app

// -------- ENV --------
const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI;
const JWT_SECRET = process.env.JWT_SECRET;
if (!MONGODB_URI) {
  console.error("❌ .env içinde MONGODB_URI tanımlı değil!");
  process.exit(1);
}
if (!JWT_SECRET) {
  console.error("❌ .env içinde JWT_SECRET tanımlı değil!");
  process.exit(1);
}

// -------- MongoDB Bağlantısı --------
mongoose
  .connect(MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log("✅ MongoDB bağlantısı başarılı"))
  .catch((err) => {
    console.error("❌ MongoDB bağlantı hatası:", err);
    process.exit(1);
  });

// -------- Middleware --------
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

// -------- Modeller --------
const User = mongoose.model(
  "User",
  new mongoose.Schema({
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
  })
);

const Book = mongoose.model(
  "Book",
  new mongoose.Schema({
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    title: { type: String, required: true },
    totalPages: { type: Number, default: null }, // <-- eklendi
    startedAt: { type: Date, default: null }, // <-- eklendi
    createdAt: { type: Date, default: Date.now },
  })
);

const Session = mongoose.model(
  "Session",
  new mongoose.Schema({
    bookId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Book",
      required: true,
    },
    startPage: Number,
    currentPage: Number,
    elapsedMs: Number,
    createdAt: { type: Date, default: Date.now },
  })
);

// -------- JWT Helpers --------
function signToken(user) {
  return jwt.sign({ uid: user._id }, JWT_SECRET, { expiresIn: "7d" });
}
function requireAuth(req, res, next) {
  const token = req.cookies["clook_token"];
  if (!token) return res.status(401).json({ error: "Unauthorized" });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.userId = payload.uid;
    next();
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }
}

// -------- Sayfa Rotaları --------
app.get("/", (_req, res) => res.redirect("/dashboard"));
app.get("/dashboard", (_req, res) =>
  res.sendFile(path.join(__dirname, "public", "dashboard.html"))
);
app.get("/book/:id", (_req, res) =>
  res.sendFile(path.join(__dirname, "public", "book.html"))
);
app.get("/login", (_req, res) =>
  res.sendFile(path.join(__dirname, "public", "login.html"))
);
app.get("/signup", (_req, res) =>
  res.sendFile(path.join(__dirname, "public", "signup.html"))
);

// Opsiyonel sağlık kontrolü
app.get("/api/health", (_req, res) => res.json({ ok: true }));

// -------- Auth Routes --------
app.post("/api/auth/signup", async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password || password.length < 6) {
      return res
        .status(400)
        .json({ error: "Email ve en az 6 karakter şifre gerekli" });
    }
    const existing = await User.findOne({ email });
    if (existing) return res.status(409).json({ error: "Email zaten kayıtlı" });

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({ email, passwordHash });
    const token = signToken(user);
    res
      .cookie("clook_token", token, {
        httpOnly: true,
        sameSite: "lax",
        secure: false, // prod'da true + https
      })
      .status(201)
      .json({ ok: true, uid: user._id, email: user.email });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body || {};
    const user = await User.findOne({ email });
    if (!user)
      return res.status(401).json({ error: "Geçersiz kimlik bilgileri" });

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok)
      return res.status(401).json({ error: "Geçersiz kimlik bilgileri" });

    const token = signToken(user);
    res
      .cookie("clook_token", token, {
        httpOnly: true,
        sameSite: "lax",
        secure: false,
      })
      .json({ ok: true, uid: user._id, email: user.email });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/auth/logout", (_req, res) => {
  res.clearCookie("clook_token").json({ ok: true });
});

app.get("/api/me", requireAuth, async (req, res) => {
  const user = await User.findById(req.userId).select("_id email createdAt");
  res.json({ user });
});

// -------- Book APIs (korumalı) --------
app.get("/api/books", requireAuth, async (req, res) => {
  try {
    const books = await Book.find({ owner: req.userId }).sort({
      createdAt: -1,
    });
    res.json(books);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/books", requireAuth, async (req, res) => {
  try {
    const { title } = req.body || {};
    if (!title || !title.trim())
      return res.status(400).json({ error: "Title is required" });
    const book = await Book.create({ owner: req.userId, title: title.trim() });
    res.status(201).json(book);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/api/books/:id", requireAuth, async (req, res) => {
  try {
    const book = await Book.findOne({ _id: req.params.id, owner: req.userId });
    if (!book) return res.status(404).json({ error: "Book not found" });

    const lastSession = await Session.findOne({ bookId: book._id }).sort({
      createdAt: -1,
    });
    res.json({ book, lastSession });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Güncelle: sadece sahibi (partial update)
app.put("/api/books/:id", requireAuth, async (req, res) => {
  try {
    const { title, totalPages, startedAt } = req.body || {};
    const update = {};

    if (title !== undefined) {
      const t = String(title).trim();
      if (!t) return res.status(400).json({ error: "Title is required" });
      update.title = t;
    }

    if (totalPages !== undefined) {
      const n = Number(totalPages);
      if (!Number.isFinite(n) || n <= 0) {
        return res
          .status(400)
          .json({ error: "totalPages must be a positive number" });
      }
      update.totalPages = Math.floor(n);
    }

    if (startedAt !== undefined) {
      if (startedAt === null || startedAt === "") {
        update.startedAt = null; // temizlemek istersen
      } else {
        const d = new Date(startedAt);
        if (Number.isNaN(d.getTime())) {
          return res
            .status(400)
            .json({ error: "startedAt must be a valid date" });
        }
        update.startedAt = d;
      }
    }

    if (Object.keys(update).length === 0) {
      return res.status(400).json({ error: "No updatable fields provided" });
    }

    const book = await Book.findOneAndUpdate(
      { _id: req.params.id, owner: req.userId },
      { $set: update },
      { new: true }
    );

    if (!book) return res.status(404).json({ error: "Book not found" });
    res.json(book);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/books/:id/sessions", requireAuth, async (req, res) => {
  try {
    const { startPage, currentPage, elapsedMs } = req.body || {};
    const book = await Book.findOne({ _id: req.params.id, owner: req.userId });
    if (!book) return res.status(404).json({ error: "Book not found" });

    const doc = await Session.create({
      bookId: book._id,
      startPage,
      currentPage,
      elapsedMs,
    });
    res.status(201).json(doc);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/api/books/:id/sessions", requireAuth, async (req, res) => {
  try {
    const book = await Book.findOne({ _id: req.params.id, owner: req.userId });
    if (!book) return res.status(404).json({ error: "Book not found" });

    const list = await Session.find({ bookId: book._id }).sort({
      createdAt: -1,
    });
    res.json(list);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// -------- Sunucu Başlat --------
app.listen(PORT, () => {
  console.log(`🚀 ClookBook çalışıyor: http://localhost:${PORT}/dashboard`);
});
