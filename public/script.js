let calendar; 
let selectedStudentId = null;
const gradeOptions = ['小1','小2','小3','小4','小5','小6','中1','中2','中3','高1','高2','高3','既卒','社会人','その他'];
let allStudents = [];

document.addEventListener('DOMContentLoaded', function() {
    loadStudents(); 
    setupReportForm(); 
    setupCalendar();
    
    fetch('/api/user/me').then(res => res.json()).then(data => {
        const userDisplay = document.getElementById('current-user-display');
        if(userDisplay) userDisplay.textContent = `ログイン中: ${data.email}`;
    });

    document.getElementById('logout-btn').addEventListener('click', () => {
        fetch('/api/logout', { method: 'POST' }).then(() => location.href = '/');
    });

    [document.getElementById('new-grade'), document.getElementById('edit-grade')].forEach(sel => {
        if(sel) {
            gradeOptions.forEach(g => {
                const opt = document.createElement('option');
                opt.value = g;
                opt.textContent = g;
                sel.appendChild(opt);
            });
        }
    });

    showSection('report');
});

function showSection(sectionId) {
    document.querySelectorAll('.content-section').forEach(el => el.style.display = 'none');
    document.querySelectorAll('.list-group-item').forEach(el => el.classList.remove('active'));
    document.getElementById(`section-${sectionId}`).style.display = 'block';
    
    const menuIndex = {'report':0, 'students':1, 'calendar':2}[sectionId];
    document.querySelectorAll('.list-group-item')[menuIndex].classList.add('active');

    if (sectionId === 'report') {
        loadReportList(); 
        closeReportForm();
    } else if (sectionId === 'calendar' && calendar) {
        setTimeout(() => calendar.render(), 100);
    }
}

// --- 生徒管理機能 ---
function loadStudents() {
    fetch('/api/students')
        .then(res => res.json())
        .then(data => {
            allStudents = data;
            const list = document.getElementById('student-list-group');
            const modalSelect = document.getElementById('modal-student-select');
            
            list.innerHTML = '';
            modalSelect.innerHTML = '<option value="">選択してください...</option>';
            
            data.forEach(student => {
                const item = document.createElement('a');
                item.href = '#';
                item.className = 'list-group-item list-group-item-action';
                item.textContent = student.name;
                item.onclick = (e) => { e.preventDefault(); selectStudent(student); };
                list.appendChild(item);
                
                const opt = document.createElement('option');
                opt.value = student.id;
                opt.textContent = student.name;
                modalSelect.appendChild(opt);
            });
        });
}

function openAddStudentModal() {
    document.getElementById('new-name').value = '';
    document.getElementById('new-school').value = '';
    document.getElementById('new-target-school').value = '';
    document.getElementById('new-memo').value = '';
    document.getElementById('new-grade').selectedIndex = 0;
    new bootstrap.Modal(document.getElementById('addStudentModal')).show();
}

function addStudent() {
    const name = document.getElementById('new-name').value;
    const grade = document.getElementById('new-grade').value;
    const school = document.getElementById('new-school').value;
    const target_school = document.getElementById('new-target-school').value;
    const memo = document.getElementById('new-memo').value;
    
    if(!name) { alert('名前は必須です'); return; }

    fetch('/api/students', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, grade, school, target_school, memo })
    }).then(res => res.json()).then(() => {
        loadStudents();
        bootstrap.Modal.getInstance(document.getElementById('addStudentModal')).hide();
        alert('生徒を追加しました');
    });
}

// 生徒削除機能
function deleteStudent() {
    if (!selectedStudentId) return;
    if (!confirm('本当にこの生徒を削除しますか？\nこの操作は取り消せません。')) return;

    fetch(`/api/students/${selectedStudentId}`, {
        method: 'DELETE'
    }).then(res => {
        if (res.ok) {
            alert('削除しました');
            location.reload(); 
        } else {
            alert('削除に失敗しました');
        }
    });
}

// プロファイリングシートの項目ID定義
const profileFieldIds = [
    'prof-strength', 'prof-weakness', 'prof-status-summary', 'prof-action-amount', 'prof-current-problem', 'prof-habit-pattern',
    'prof-ideal-state', 'prof-specific-goal', 'prof-reason', 'prof-numeric-goal',
    'prof-motivation-up', 'prof-continue-feature', 'prof-motivation-down', 'prof-learning-style',
    'prof-daily-schedule', 'prof-busy-free-time', 'prof-environment', 'prof-sns-habit', 'prof-supporter',
    'prof-eval-persistence', 'prof-eval-planning', 'prof-eval-action', 'prof-eval-focus', 'prof-eval-mental',
    'prof-past-success', 'prof-success-pattern', 'prof-failure-pattern',
    'prof-long-issue', 'prof-long-strength', 'prof-repeat-problem', 'prof-kpi', 'prof-direction',
    'prof-health-constraint', 'prof-coaching-note', 'prof-trigger'
];

function selectStudent(student) {
    selectedStudentId = student.id;
    document.getElementById('student-select-msg').style.display = 'none';
    document.getElementById('student-detail-view').style.display = 'block';
    
    // 表示モードリセット
    document.getElementById('student-info-display').style.display = 'block';
    document.getElementById('student-info-edit').style.display = 'none';

    document.getElementById('detail-name').textContent = student.name;
    document.getElementById('detail-grade').textContent = student.grade;
    document.getElementById('detail-school').textContent = student.school;
    document.getElementById('detail-target-school').textContent = student.target_school || '-';
    document.getElementById('detail-memo').textContent = student.memo;
    
    let profileData = {};
    try {
        if (student.profile_data) {
            profileData = JSON.parse(student.profile_data);
        }
    } catch (e) {
        console.error('Profile parse error', e);
    }

    profileFieldIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.value = profileData[id] || (el.type === 'range' ? '3' : '');
            if (el.type === 'range') {
                const valSpan = document.getElementById(id.replace('prof-eval-', 'val-'));
                if (valSpan) valSpan.innerText = el.value;
            }
        }
    });
    
    fetch(`/api/students/${student.id}/reports`).then(res => res.json()).then(reports => {
        const reportList = document.getElementById('student-reports-list');
        reportList.innerHTML = '';
        reports.forEach(r => {
            const div = document.createElement('div');
            div.className = 'list-group-item list-group-item-action';
            div.innerHTML = `<small class="text-muted">${r.created_at}</small><br>${r.content.substring(0, 40)}...`;
            reportList.appendChild(div);
        });
    });
}

function saveProfileData() {
    if(!selectedStudentId) return;
    const data = {};
    profileFieldIds.forEach(id => {
        const el = document.getElementById(id);
        if(el) data[id] = el.value;
    });

    fetch(`/api/students/${selectedStudentId}/profile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileData: data })
    }).then(() => {
        alert('プロファイリング情報を保存しました');
        const s = allStudents.find(st => st.id === selectedStudentId);
        if(s) s.profile_data = JSON.stringify(data);
    });
}

function toggleEditMode() {
    const display = document.getElementById('student-info-display');
    const edit = document.getElementById('student-info-edit');
    if (edit.style.display === 'none') {
        document.getElementById('edit-name').value = document.getElementById('detail-name').textContent;
        const currentGrade = document.getElementById('detail-grade').textContent;
        const editGradeSelect = document.getElementById('edit-grade');
        Array.from(editGradeSelect.options).forEach(opt => opt.selected = (opt.value === currentGrade));
        document.getElementById('edit-school').value = document.getElementById('detail-school').textContent;
        const target = document.getElementById('detail-target-school').textContent;
        document.getElementById('edit-target-school').value = target === '-' ? '' : target;
        document.getElementById('edit-memo').value = document.getElementById('detail-memo').textContent;
        display.style.display = 'none';
        edit.style.display = 'block';
    } else {
        display.style.display = 'block';
        edit.style.display = 'none';
    }
}

function saveStudentInfo() {
    if (!selectedStudentId) return;
    const body = {
        name: document.getElementById('edit-name').value,
        grade: document.getElementById('edit-grade').value,
        school: document.getElementById('edit-school').value,
        target_school: document.getElementById('edit-target-school').value,
        memo: document.getElementById('edit-memo').value
    };
    fetch(`/api/students/${selectedStudentId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    }).then(res => res.json()).then(() => {
        alert('更新しました');
        const updatedStudent = allStudents.find(s => s.id === selectedStudentId);
        if(updatedStudent) Object.assign(updatedStudent, body);
        selectStudent({...updatedStudent, ...body}); 
        loadStudents(); 
    });
}

// --- レポート機能 ---

function loadReportList() {
    const container = document.getElementById('report-grid-container');
    container.innerHTML = '';

    const newBtn = document.createElement('div');
    newBtn.className = 'report-card-item report-card-new';
    newBtn.innerHTML = '<i class="bi bi-plus-circle"></i><div>新規レポートを作成</div>';
    newBtn.onclick = () => {
        new bootstrap.Modal(document.getElementById('selectStudentModal')).show();
    };
    container.appendChild(newBtn);

    fetch('/api/reports')
        .then(res => res.json())
        .then(reports => {
            reports.forEach(report => {
                const card = document.createElement('div');
                card.className = 'report-card-item';
                const date = new Date(report.created_at).toLocaleDateString();
                const preview = report.content.replace(/\n/g, ' ').substring(0, 60) + '...';
                
                card.innerHTML = `
                    <div>
                        <div class="report-card-date">${date}</div>
                        <div class="report-card-name">${report.student_name || '不明な生徒'}</div>
                    </div>
                    <div class="report-card-preview text-muted mt-2">${preview}</div>
                `;
                card.onclick = () => openReportForm(report);
                container.appendChild(card);
            });
        });
}

function startNewReport() {
    const studentId = document.getElementById('modal-student-select').value;
    if (!studentId) return;
    
    const student = allStudents.find(s => s.id == studentId);
    bootstrap.Modal.getInstance(document.getElementById('selectStudentModal')).hide();
    
    openReportForm(null, student); 
}

function openReportForm(report = null, student = null) {
    document.getElementById('report-list-view').style.display = 'none';
    document.getElementById('report-form-view').style.display = 'block';
    document.getElementById('output-container').innerHTML = '';

    const formTitle = document.getElementById('report-form-title');
    const saveBtn = document.getElementById('save-report-btn');
    const editBtn = document.getElementById('edit-mode-btn');

    resetForm();

    // 編集・表示制御関数
    const setEditable = (editable) => {
        const inputs = document.querySelectorAll('#report-form-view input:not([readonly]), #report-form-view textarea, #report-form-view select, #add-plan-button, .btn-danger');
        inputs.forEach(el => el.disabled = !editable);
    };

    if (report) {
        formTitle.textContent = 'レポート編集';
        document.getElementById('report-id').value = report.id;
        document.getElementById('report-student-display').value = report.student_name;
        document.getElementById('report-next-date').value = report.next_training_date || '';
        
        // データを復元してフォームに入力
        parseContentToForm(report.content);
        
        // 常に編集可能な状態にする（保存ボタンも表示）
        setEditable(true);
        saveBtn.style.display = 'block';
        editBtn.style.display = 'none'; // 編集ボタンは不要化

    } else if (student) {
        formTitle.textContent = '新規レポート作成';
        document.getElementById('report-id').value = ''; 
        document.getElementById('report-student-id').value = student.id;
        document.getElementById('report-student-display').value = student.name;
        
        setEditable(true);
        saveBtn.style.display = 'block';
        editBtn.style.display = 'none';
    }
}

function closeReportForm() {
    document.getElementById('report-form-view').style.display = 'none';
    document.getElementById('report-list-view').style.display = 'block';
}

function setupReportForm() {
    const planContainer = document.getElementById('plan-container');
    const addPlanButton = document.getElementById('add-plan-button');
    const saveButton = document.getElementById('save-report-btn');
    const outputContainer = document.getElementById('output-container');
    const subjectOptions = ['数学', '英語', '国語', '理科', '社会', '物理', '化学', '生物', '地学', '世界史', '日本史', '地理', 'その他'];

    window.createPlanCard = function(initialData = null) {
        const cardDiv = document.createElement('div');
        cardDiv.className = 'card mb-3 bg-light plan-card';
        const cardBody = document.createElement('div');
        cardBody.className = 'card-body';
        
        const headerRow = document.createElement('div');
        headerRow.className = 'd-flex justify-content-between mb-2';
        const select = document.createElement('select');
        select.className = 'form-select me-2 subject-select';
        select.style.maxWidth = '150px';
        subjectOptions.forEach(s => {
            const opt = document.createElement('option');
            opt.value = s;
            opt.textContent = s;
            select.appendChild(opt);
        });
        if(initialData) select.value = initialData.subject;

        const removeBtn = document.createElement('button');
        removeBtn.className = 'btn btn-danger btn-sm';
        removeBtn.textContent = '×';
        removeBtn.onclick = () => planContainer.removeChild(cardDiv);

        headerRow.appendChild(select);
        headerRow.appendChild(removeBtn);
        cardBody.appendChild(headerRow);

        const placeholders = ['振り返り', '理想・目標', '現状', '具体的な行動'];
        const inputClasses = ['review-input', 'goal-input', 'situation-input', 'solution-input'];
        const initialValues = initialData ? [initialData.review, initialData.goal, initialData.situation, initialData.solution] : ['','','',''];

        placeholders.forEach((ph, idx) => {
            const ta = document.createElement('textarea');
            ta.className = `form-control mb-2 plan-input ${inputClasses[idx]}`;
            ta.rows = 2;
            ta.placeholder = ph;
            ta.value = initialValues[idx] || '';
            cardBody.appendChild(ta);
        });
        cardDiv.appendChild(cardBody);
        planContainer.appendChild(cardDiv);
    };

    addPlanButton.addEventListener('click', () => createPlanCard());

    saveButton.addEventListener('click', () => {
        const reportId = document.getElementById('report-id').value;
        const studentId = document.getElementById('report-student-id').value;
        const nextDate = document.getElementById('report-next-date').value;

        // テキスト生成
        let fullText = "";
        const appendBox = (title, lines) => {
            if(lines.length===0) return;
            const boxDiv = document.createElement('div');
            boxDiv.className = 'output-box mb-3 p-3 bg-white border rounded';
            boxDiv.innerHTML = `<h5 class="fs-6 fw-bold">${title}</h5><pre class="bg-light p-2 rounded">${lines.join('\n\n')}</pre>`;
            outputContainer.appendChild(boxDiv);
            fullText += `${title}\n${lines.join('\n\n')}\n\n`;
        };
        
        outputContainer.innerHTML = ''; 

        // 固定項目収集
        const hw = document.getElementById('homework-review').value.trim();
        const test = document.getElementById('test-review').value.trim();
        const ev = document.getElementById('events-notes').value.trim();
        const other = document.getElementById('other-notes').value.trim();
        
        if(hw || test) appendBox('【宿題/確認テストの振り返り】', [hw && `⚪︎ 宿題\n${hw}`, test && `⚪︎ テスト\n${test}`].filter(Boolean));
        if(ev || other) appendBox('【特記事項】', [ev && `⚪︎ 行事\n${ev}`, other && `⚪︎ その他\n${other}`].filter(Boolean));

        // カード項目収集
        const cards = document.querySelectorAll('.plan-card');
        const subjects = {review:[], goal:[], sit:[], sol:[]};
        cards.forEach(c => {
            const sub = c.querySelector('.subject-select').value;
            const rev = c.querySelector('.review-input').value.trim();
            const goal = c.querySelector('.goal-input').value.trim();
            const sit = c.querySelector('.situation-input').value.trim();
            const sol = c.querySelector('.solution-input').value.trim();
            if(rev) subjects.review.push(`⚪︎ ${sub}\n${rev}`);
            if(goal) subjects.goal.push(`⚪︎ ${sub}\n${goal}`);
            if(sit) subjects.sit.push(`⚪︎ ${sub}\n${sit}`);
            if(sol) subjects.sol.push(`⚪︎ ${sub}\n${sol}`);
        });

        if(subjects.review.length) appendBox('【振り返り】', subjects.review);
        if(subjects.goal.length) appendBox('【理想・目標】', subjects.goal);
        if(subjects.sit.length) appendBox('【現状】', subjects.sit);
        if(subjects.sol.length) appendBox('【具体的な行動・勉強法】', subjects.sol);

        const url = reportId ? `/api/reports/${reportId}` : '/api/reports';
        const method = reportId ? 'PUT' : 'POST';
        const body = { nextDate, content: fullText };
        if(!reportId) body.studentId = studentId;

        fetch(url, {
            method: method,
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(body)
        })
        .then(res => res.json())
        .then(data => {
            alert('保存しました');
            
            // ★保存後も画面を維持し、新規ならIDをセットして編集モードに切り替え
            if (!reportId && data.id) {
                document.getElementById('report-id').value = data.id;
                document.getElementById('report-form-title').textContent = 'レポート編集';
            }
            
            loadReportList(); // 裏側で一覧を更新しておく
            if(calendar) calendar.refetchEvents();
        });
    });
}

// テキスト解析・フォーム復元関数
function parseContentToForm(text) {
    document.getElementById('plan-container').innerHTML = '';

    const extractSection = (header) => {
        const regex = new RegExp(`【${header}】\\n([\\s\\S]*?)(?=\\n\\n【|$)`);
        const match = text.match(regex);
        return match ? match[1].trim() : '';
    };

    const hwTest = extractSection('宿題/確認テストの振り返り');
    const notes = extractSection('特記事項');

    const hwMatch = hwTest.match(/⚪︎ 宿題\n([\s\S]*?)(?=\n⚪︎|$)/);
    const testMatch = hwTest.match(/⚪︎ テスト\n([\s\S]*?)(?=\n⚪︎|$)/);
    document.getElementById('homework-review').value = hwMatch ? hwMatch[1].trim() : '';
    document.getElementById('test-review').value = testMatch ? testMatch[1].trim() : '';

    const evMatch = notes.match(/⚪︎ 行事\n([\s\S]*?)(?=\n⚪︎|$)/);
    const othMatch = notes.match(/⚪︎ その他\n([\s\S]*?)(?=\n⚪︎|$)/);
    document.getElementById('events-notes').value = evMatch ? evMatch[1].trim() : '';
    document.getElementById('other-notes').value = othMatch ? othMatch[1].trim() : '';

    const subjectsData = {};
    const parseSubjectSection = (header, key) => {
        const content = extractSection(header);
        const regex = /⚪︎ (.*?)\n([\s\S]*?)(?=\n⚪︎|$)/g;
        let match;
        while ((match = regex.exec(content)) !== null) {
            const subject = match[1].trim();
            const value = match[2].trim();
            if (!subjectsData[subject]) subjectsData[subject] = {};
            subjectsData[subject][key] = value;
        }
    };

    parseSubjectSection('振り返り', 'review');
    parseSubjectSection('理想・目標', 'goal');
    parseSubjectSection('現状', 'situation');
    parseSubjectSection('具体的な行動・勉強法', 'solution');

    Object.keys(subjectsData).forEach(subject => {
        createPlanCard({
            subject: subject,
            review: subjectsData[subject].review || '',
            goal: subjectsData[subject].goal || '',
            situation: subjectsData[subject].situation || '',
            solution: subjectsData[subject].solution || ''
        });
    });

    if (Object.keys(subjectsData).length === 0) {
        createPlanCard();
    }
}

function resetForm() {
    document.getElementById('plan-container').innerHTML = '';
    document.querySelectorAll('#report-form-view textarea').forEach(t => t.value = '');
    document.getElementById('report-next-date').value = '';
    createPlanCard(); 
}

function setupCalendar() {
    const calendarEl = document.getElementById('calendar');
    calendar = new FullCalendar.Calendar(calendarEl, {
        initialView: 'dayGridMonth',
        locale: 'ja',
        headerToolbar: { left: 'prev,next today', center: 'title', right: 'dayGridMonth,timeGridWeek,listWeek' },
        events: '/api/calendar-events',
        height: 'auto',
        eventTimeFormat: { hour: '2-digit', minute: '2-digit', meridiem: false }
    });
    calendar.render();
}