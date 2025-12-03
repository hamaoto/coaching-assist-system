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

    // 2. 生徒情報 (★変更: プロファイリングデータ用のカラムを追加)
    db.run(`
        CREATE TABLE IF NOT EXISTS students (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT,
            grade TEXT,
            school TEXT,
            target_school TEXT,
            memo TEXT,
            profile_data TEXT, -- ★ここに全てのプロ/ファイリング情報をJSONで保存
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // 3. レポート
    db.run(`
        CREATE TABLE IF NOT EXISTS reports (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            student_id INTEGER,
            next_training_date TEXT,
            content TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES users(id),
            FOREIGN KEY(student_id) REFERENCES students(id)
        )
    `);
});

module.exports = db;