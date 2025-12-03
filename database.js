const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./reports_final.db');

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
});

module.exports = db;