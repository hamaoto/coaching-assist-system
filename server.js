// ... (前半のimportなどは変更なし) ...
const express = require('express');
const bodyParser = require('body-parser');
const session = require('express-session');
const bcrypt = require('bcrypt');
const db = require('./database');
const path = require('path');

const app = express();
const PORT = 3001;

// サーバーがどこで動いているか確認するログ
console.log('現在の実行フォルダ:', process.cwd());
console.log('データベースファイルの場所:', path.resolve('./reports.db'));

app.use(bodyParser.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
    secret: 'my-secret-key',
    resave: false,
    saveUninitialized: false
}));
app.use(express.static('public', { index: false }));

// ... (認証周りのAPIなどは変更なし) ...

app.get('/', (req, res) => {
    if (req.session.userId) res.sendFile(path.join(__dirname, 'public', 'index.html'));
    else res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

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

// --- 生徒管理 API ---
app.get('/api/students', (req, res) => {
    if (!req.session.userId) return res.status(403).json({ error: '要ログイン' });
    db.all('SELECT * FROM students ORDER BY id DESC', [], (err, rows) => {
        if (err) return res.status(500).json({ error: '取得失敗' });
        res.json(rows);
    });
});

app.post('/api/students', (req, res) => {
    if (!req.session.userId) return res.status(403).json({ error: '要ログイン' });
    const { name, grade, school, target_school, memo } = req.body;
    const stmt = db.prepare('INSERT INTO students (name, grade, school, target_school, memo) VALUES (?, ?, ?, ?, ?)');
    stmt.run(name, grade, school, target_school, memo, function(err) {
        if (err) return res.status(500).json({ error: '保存失敗' });
        res.json({ id: this.lastID, message: '追加成功' });
    });
});

app.put('/api/students/:id', (req, res) => {
    if (!req.session.userId) return res.status(403).json({ error: '要ログイン' });
    const { name, grade, school, target_school, memo } = req.body;
    const stmt = db.prepare('UPDATE students SET name = ?, grade = ?, school = ?, target_school = ?, memo = ? WHERE id = ?');
    stmt.run(name, grade, school, target_school, memo, req.params.id, function(err) {
        if (err) return res.status(500).json({ error: '更新失敗' });
        res.json({ message: '更新成功' });
    });
});

// ★変更: プロファイリングデータ(JSON)を保存
app.post('/api/students/:id/profile', (req, res) => {
    if (!req.session.userId) return res.status(403).json({ error: '要ログイン' });
    // profileDataはオブジェクトとして受け取るが、DBには文字列として保存
    const { profileData } = req.body;
    const jsonStr = JSON.stringify(profileData);
    
    const stmt = db.prepare('UPDATE students SET profile_data = ? WHERE id = ?');
    stmt.run(jsonStr, req.params.id, function(err) {
        if (err) return res.status(500).json({ error: '更新失敗' });
        res.json({ message: '更新成功' });
    });
});

app.get('/api/students/:id/reports', (req, res) => {
    if (!req.session.userId) return res.status(403).json({ error: '要ログイン' });
    db.all('SELECT * FROM reports WHERE student_id = ? ORDER BY created_at DESC', [req.params.id], (err, rows) => {
        if (err) return res.status(500).json({ error: '取得失敗' });
        res.json(rows);
    });
});

// --- レポート管理 API (変更なし) ---
app.get('/api/reports', (req, res) => {
    if (!req.session.userId) return res.status(403).json({ error: '要ログイン' });
    const sql = `SELECT r.*, s.name as student_name FROM reports r LEFT JOIN students s ON r.student_id = s.id ORDER BY r.created_at DESC`;
    db.all(sql, [], (err, rows) => {
        if (err) return res.status(500).json({ error: '取得失敗' });
        res.json(rows);
    });
});

app.post('/api/reports', (req, res) => {
    if (!req.session.userId) return res.status(403).json({ error: '要ログイン' });
    const { studentId, nextDate, content } = req.body;
    const stmt = db.prepare('INSERT INTO reports (user_id, student_id, next_training_date, content) VALUES (?, ?, ?, ?)');
    stmt.run(req.session.userId, studentId, nextDate, content, function(err) {
        if (err) return res.status(500).json({ error: '保存失敗' });
        res.json({ message: '保存成功', id: this.lastID });
    });
});

app.put('/api/reports/:id', (req, res) => {
    if (!req.session.userId) return res.status(403).json({ error: '要ログイン' });
    const { nextDate, content } = req.body;
    const stmt = db.prepare('UPDATE reports SET next_training_date = ?, content = ? WHERE id = ?');
    stmt.run(nextDate, content, req.params.id, function(err) {
        if (err) return res.status(500).json({ error: '更新失敗' });
        res.json({ message: '更新成功' });
    });
});

app.get('/api/calendar-events', (req, res) => {
    if (!req.session.userId) return res.status(403).json({ error: '要ログイン' });
    const sql = `SELECT r.id, r.next_training_date, s.name as student_name FROM reports r JOIN students s ON r.student_id = s.id WHERE r.next_training_date IS NOT NULL`;
    db.all(sql, [], (err, rows) => {
        if (err) return res.status(500).json({ error: '取得失敗' });
        const events = rows.map(row => ({
            id: row.id,
            title: `${row.student_name} 特訓`,
            start: row.next_training_date,
            color: '#007bff'
        }));
        res.json(events);
    });
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});