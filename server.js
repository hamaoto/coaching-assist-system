const express = require('express');
const bodyParser = require('body-parser');
const session = require('express-session');
const bcrypt = require('bcrypt');
const db = require('./database');
const path = require('path');

const app = express();
const PORT = 3001;

app.use(bodyParser.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
    secret: 'my-secret-key',
    resave: false,
    saveUninitialized: false
}));
app.use(express.static('public', { index: false }));

// --- ページ制御 ---
app.get('/', (req, res) => {
    if (req.session.userId) res.sendFile(path.join(__dirname, 'public', 'index.html'));
    else res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// --- 認証API ---
app.get('/api/user/me', (req, res) => {
    if (!req.session.userId) return res.status(401).json({ error: '未ログイン' });
    db.get('SELECT email FROM users WHERE id = ?', [req.session.userId], (err, row) => {
        res.json({ email: row ? row.email : '不明' });
    });
});

app.post('/api/register', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: '入力が必要です' });
    if (password.length < 8) return res.status(400).json({ error: 'パスワードは8文字以上にしてください' });
    try {
        const hash = await bcrypt.hash(password, 10);
        const stmt = db.prepare('INSERT INTO users (email, password) VALUES (?, ?)');
        stmt.run(email, hash, function(err) {
            if (err) return res.status(500).json({ error: '既に使用されています' });
            req.session.userId = this.lastID;
            res.json({ message: '登録完了' });
        });
    } catch (e) { res.status(500).json({ error: 'エラー' }); }
});

app.post('/api/login', (req, res) => {
    const { email, password } = req.body;
    db.get('SELECT * FROM users WHERE email = ?', [email], async (err, user) => {
        if (err || !user) return res.status(401).json({ error: 'ユーザーが見つかりません' });
        const match = await bcrypt.compare(password, user.password);
        if (match) {
            req.session.userId = user.id;
            res.json({ message: 'ログイン成功' });
        } else {
            res.status(401).json({ error: 'パスワードが違います' });
        }
    });
});

app.post('/api/logout', (req, res) => {
    req.session.destroy();
    res.json({ message: 'ログアウト' });
});

// --- 生徒管理 API (セキュリティ強化版) ---

// 生徒一覧取得 (自分の生徒のみ)
app.get('/api/students', (req, res) => {
    if (!req.session.userId) return res.status(403).json({ error: '要ログイン' });
    db.all('SELECT * FROM students WHERE user_id = ? ORDER BY id DESC', [req.session.userId], (err, rows) => {
        if (err) return res.status(500).json({ error: '取得失敗' });
        res.json(rows);
    });
});

// 生徒追加 (自分のIDを紐付け)
app.post('/api/students', (req, res) => {
    if (!req.session.userId) return res.status(403).json({ error: '要ログイン' });
    const { name, grade, school, target_school, category, memo } = req.body;
    const stmt = db.prepare('INSERT INTO students (user_id, name, grade, school, target_school, category, memo) VALUES (?, ?, ?, ?, ?, ?, ?)');
    stmt.run(req.session.userId, name, grade, school, target_school, category, memo, function(err) {
        if (err) return res.status(500).json({ error: '保存失敗' });
        res.json({ id: this.lastID, message: '追加成功' });
    });
});

// 生徒情報更新 (自分の生徒のみ許可)
app.put('/api/students/:id', (req, res) => {
    if (!req.session.userId) return res.status(403).json({ error: '要ログイン' });
    const { name, grade, school, target_school, category, is_hidden, memo } = req.body;
    
    const stmt = db.prepare(`
        UPDATE students 
        SET name = ?, grade = ?, school = ?, target_school = ?, category = ?, is_hidden = ?, memo = ? 
        WHERE id = ? AND user_id = ?
    `);
    
    stmt.run(name, grade, school, target_school, category, is_hidden, memo, req.params.id, req.session.userId, function(err) {
        if (err) return res.status(500).json({ error: '更新失敗' });
        if (this.changes === 0) return res.status(404).json({ error: 'データが見つからないか権限がありません' });
        res.json({ message: '更新成功' });
    });
});

// 生徒削除 (自分の生徒のみ許可)
app.delete('/api/students/:id', (req, res) => {
    if (!req.session.userId) return res.status(403).json({ error: '要ログイン' });
    const stmt = db.prepare('DELETE FROM students WHERE id = ? AND user_id = ?');
    stmt.run(req.params.id, req.session.userId, function(err) {
        if (err) return res.status(500).json({ error: '削除失敗' });
        if (this.changes === 0) return res.status(404).json({ error: '削除権限がありません' });
        res.json({ message: '削除成功' });
    });
});

// プロファイリング更新 (自分の生徒のみ許可)
app.post('/api/students/:id/profile', (req, res) => {
    if (!req.session.userId) return res.status(403).json({ error: '要ログイン' });
    const { profileData } = req.body;
    const jsonStr = JSON.stringify(profileData);
    const stmt = db.prepare('UPDATE students SET profile_data = ? WHERE id = ? AND user_id = ?');
    stmt.run(jsonStr, req.params.id, req.session.userId, function(err) {
        if (err) return res.status(500).json({ error: '更新失敗' });
        res.json({ message: '更新成功' });
    });
});

// 生徒のレポート履歴取得 (自分の生徒のレポートのみ)
app.get('/api/students/:id/reports', (req, res) => {
    if (!req.session.userId) return res.status(403).json({ error: '要ログイン' });
    db.all('SELECT * FROM reports WHERE student_id = ? AND user_id = ? ORDER BY created_at DESC', [req.params.id, req.session.userId], (err, rows) => {
        if (err) return res.status(500).json({ error: '取得失敗' });
        res.json(rows);
    });
});

// --- 生徒個別イベントAPI (セキュリティ強化版) ---

app.get('/api/students/:id/events', (req, res) => {
    if (!req.session.userId) return res.status(403).json({ error: '要ログイン' });
    // 生徒が自分の担当か確認してからイベント取得
    const sql = `
        SELECT e.* FROM student_events e 
        JOIN students s ON e.student_id = s.id 
        WHERE e.student_id = ? AND s.user_id = ?
    `;
    db.all(sql, [req.params.id, req.session.userId], (err, rows) => {
        if (err) return res.status(500).json({ error: '取得失敗' });
        const events = rows.map(row => ({
            id: row.id, title: row.title, start: row.start_date, color: row.color || '#3788d8'
        }));
        res.json(events);
    });
});

app.post('/api/students/:id/events', (req, res) => {
    if (!req.session.userId) return res.status(403).json({ error: '要ログイン' });
    // 生徒が自分の担当か確認
    db.get('SELECT id FROM students WHERE id = ? AND user_id = ?', [req.params.id, req.session.userId], (err, student) => {
        if (!student) return res.status(403).json({ error: '権限がありません' });
        
        const { title, start, color } = req.body;
        const stmt = db.prepare('INSERT INTO student_events (student_id, title, start_date, color) VALUES (?, ?, ?, ?)');
        stmt.run(req.params.id, title, start, color, function(err) {
            if (err) return res.status(500).json({ error: '保存失敗' });
            res.json({ message: '保存成功', id: this.lastID });
        });
    });
});

app.delete('/api/events/:id', (req, res) => {
    if (!req.session.userId) return res.status(403).json({ error: '要ログイン' });
    // 自分の生徒のイベントか確認して削除
    const stmt = db.prepare(`
        DELETE FROM student_events 
        WHERE id = ? AND student_id IN (SELECT id FROM students WHERE user_id = ?)
    `);
    stmt.run(req.params.id, req.session.userId, function(err) {
        if (err) return res.status(500).json({ error: '削除失敗' });
        res.json({ message: '削除成功' });
    });
});

// --- レポート管理 API (セキュリティ強化版) ---

// レポート一覧 (自分のレポートのみ)
app.get('/api/reports', (req, res) => {
    if (!req.session.userId) return res.status(403).json({ error: '要ログイン' });
    const sql = `
        SELECT r.*, s.name as student_name 
        FROM reports r 
        LEFT JOIN students s ON r.student_id = s.id 
        WHERE r.user_id = ? 
        ORDER BY r.created_at DESC
    `;
    db.all(sql, [req.session.userId], (err, rows) => {
        if (err) return res.status(500).json({ error: '取得失敗' });
        res.json(rows);
    });
});

app.post('/api/reports', (req, res) => {
    if (!req.session.userId) return res.status(403).json({ error: '要ログイン' });
    const { studentId, reportType, nextDate, content } = req.body;
    const stmt = db.prepare('INSERT INTO reports (user_id, student_id, report_type, next_training_date, content) VALUES (?, ?, ?, ?, ?)');
    stmt.run(req.session.userId, studentId, reportType, nextDate, content, function(err) {
        if (err) return res.status(500).json({ error: '保存失敗' });
        res.json({ message: '保存成功', id: this.lastID });
    });
});

app.put('/api/reports/:id', (req, res) => {
    if (!req.session.userId) return res.status(403).json({ error: '要ログイン' });
    const { reportType, nextDate, content } = req.body;
    const stmt = db.prepare('UPDATE reports SET report_type = ?, next_training_date = ?, content = ? WHERE id = ? AND user_id = ?');
    stmt.run(reportType, nextDate, content, req.params.id, req.session.userId, function(err) {
        if (err) return res.status(500).json({ error: '更新失敗' });
        res.json({ message: '更新成功' });
    });
});

app.delete('/api/reports/:id', (req, res) => {
    if (!req.session.userId) return res.status(403).json({ error: '要ログイン' });
    const stmt = db.prepare('DELETE FROM reports WHERE id = ? AND user_id = ?');
    stmt.run(req.params.id, req.session.userId, function(err) {
        if (err) return res.status(500).json({ error: '削除失敗' });
        res.json({ message: '削除成功' });
    });
});

// 全体カレンダー (自分のデータのみ)
app.get('/api/calendar-events', async (req, res) => {
    if (!req.session.userId) return res.status(403).json({ error: '要ログイン' });
    
    // 1. レポート (自分のuser_idで絞り込み)
    const reportSql = `
        SELECT r.id, r.next_training_date, s.name as student_name 
        FROM reports r 
        JOIN students s ON r.student_id = s.id 
        WHERE r.next_training_date IS NOT NULL AND r.user_id = ?
    `;
    
    // 2. 生徒予定 (生徒のuser_idで絞り込み)
    const eventSql = `
        SELECT e.id, e.title, e.start_date, e.color, s.name as student_name 
        FROM student_events e 
        JOIN students s ON e.student_id = s.id 
        WHERE s.user_id = ?
    `;

    db.all(reportSql, [req.session.userId], (err, reportRows) => {
        if (err) return res.status(500).json({ error: '取得失敗' });
        
        db.all(eventSql, [req.session.userId], (err, eventRows) => {
            if (err) return res.status(500).json({ error: '取得失敗' });

            const reports = reportRows.map(row => ({
                id: 'report_' + row.id,
                title: `${row.student_name} 特訓`,
                start: row.next_training_date,
                color: '#007bff'
            }));

            const events = eventRows.map(row => ({
                id: 'event_' + row.id,
                title: `${row.student_name} ${row.title}`,
                start: row.start_date,
                color: row.color || '#28a745'
            }));

            res.json([...reports, ...events]);
        });
    });
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});