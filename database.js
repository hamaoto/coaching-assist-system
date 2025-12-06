const sqlite3 = require('sqlite3').verbose();
const dbPath = process.env.DB_PATH || './reports_final.db';
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
    // 1. ユーザー
    db.run(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT UNIQUE,
            password TEXT
        )
    `);

    // 2. 生徒情報 (★ user_id を追加して、担当者を区別)
    db.run(`
        CREATE TABLE IF NOT EXISTS students (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER, -- ★担当の先生ID
            name TEXT,
            grade TEXT,
            school TEXT,
            target_school TEXT,
            category TEXT,
            is_hidden INTEGER DEFAULT 0,
            memo TEXT,
            profile_data TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES users(id)
        )
    `);

    // 3. レポート
    db.run(`
        CREATE TABLE IF NOT EXISTS reports (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            student_id INTEGER,
            report_type TEXT,
            next_training_date TEXT,
            content TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES users(id),
            FOREIGN KEY(student_id) REFERENCES students(id)
        )
    `);

    // 4. 生徒の予定
    db.run(`
        CREATE TABLE IF NOT EXISTS student_events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            student_id INTEGER,
            title TEXT,
            start_date TEXT,
            color TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(student_id) REFERENCES students(id)
        )
    `);

    // 5. 目標管理
    db.run(`
        CREATE TABLE IF NOT EXISTS goals (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            title TEXT NOT NULL,
            specific TEXT,
            measurable TEXT,
            achievable TEXT,
            relevant TEXT,
            time_bound TEXT,
            due_date TEXT,
            importance INTEGER DEFAULT 1,
            progress REAL DEFAULT 0,
            is_archived INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            progress_updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES users(id)
        )
    `);
});

module.exports = db;
