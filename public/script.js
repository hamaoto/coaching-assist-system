let calendar; 
let selectedStudentId = null;
let studentCalendar; 
const gradeOptions = ['小1','小2','小3','小4','小5','小6','中1','中2','中3','高1','高2','高3','既卒','社会人','その他'];
const categoryOptions = ['受験生', '非受験生', '内部進学', '体験生', '休塾中', 'その他']; 
let allStudents = [];

document.addEventListener('DOMContentLoaded', function() {
    setupOptions();
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

    const tabEl = document.querySelector('a[data-bs-toggle="tab"][href="#tab-calendar"]');
    if(tabEl){
        tabEl.addEventListener('shown.bs.tab', function () {
            if (studentCalendar) studentCalendar.render();
        });
    }

    showSection('report');
});

function setupOptions() {
    const grades = [document.getElementById('new-grade'), document.getElementById('edit-grade')];
    grades.forEach(sel => {
        if(sel) {
            sel.innerHTML = '<option value="" disabled selected>選択</option>';
            gradeOptions.forEach(g => {
                const opt = document.createElement('option');
                opt.value = g;
                opt.textContent = g;
                sel.appendChild(opt);
            });
        }
    });

    const categories = [document.getElementById('new-category'), document.getElementById('edit-category'), document.getElementById('student-category-filter')];
    categories.forEach(sel => {
        if(sel) {
            if(sel.id === 'student-category-filter') {
                sel.innerHTML = '<option value="">全てのカテゴリ</option>';
            }
        }
    });
}

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
        calendar.refetchEvents();
        setTimeout(() => calendar.render(), 100);
    }
}

function loadStudents() {
    fetch('/api/students')
        .then(res => res.json())
        .then(data => {
            allStudents = data;
            updateCategoryOptions();
            renderStudentLists();
        });
}

function updateCategoryOptions() {
    const categories = new Set(categoryOptions);
    allStudents.forEach(s => { if(s.category) categories.add(s.category); });
    
    const datalist = document.getElementById('category-options');
    datalist.innerHTML = '';
    categories.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c;
        datalist.appendChild(opt);
    });

    const filter = document.getElementById('student-category-filter');
    filter.innerHTML = '<option value="">全てのカテゴリ</option>';
    categories.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c;
        opt.textContent = c;
        filter.appendChild(opt);
    });
}

function renderStudentLists() {
    const list = document.getElementById('student-list-group');
    const hiddenList = document.getElementById('hidden-student-list-group');
    const modalSelect = document.getElementById('modal-student-select');
    
    list.innerHTML = '';
    hiddenList.innerHTML = '';
    modalSelect.innerHTML = '<option value="">選択してください...</option>';
    
    const searchText = document.getElementById('student-search').value.toLowerCase();
    const filterCategory = document.getElementById('student-category-filter').value;

    allStudents.forEach(student => {
        const matchesSearch = student.name.toLowerCase().includes(searchText);
        const matchesCategory = !filterCategory || student.category === filterCategory;
        const isHidden = student.is_hidden === 1;

        if (matchesSearch && matchesCategory) {
            const item = document.createElement('a');
            item.href = '#';
            item.className = 'list-group-item list-group-item-action';
            if (isHidden) {
                item.classList.add('list-group-item-secondary');
                item.innerHTML = `<i class="bi bi-eye-slash-fill me-2"></i>${student.name}`;
            } else {
                item.textContent = student.name;
            }
            item.onclick = (e) => { e.preventDefault(); selectStudent(student); };

            if (isHidden) {
                hiddenList.appendChild(item);
            } else {
                list.appendChild(item);
            }
        }

        const opt = document.createElement('option');
        opt.value = student.id;
        opt.textContent = student.name + (isHidden ? ' (非表示)' : '');
        modalSelect.appendChild(opt);
    });
}

window.filterStudentList = function() {
    renderStudentLists();
};

function openAddStudentModal() {
    document.getElementById('new-name').value = '';
    document.getElementById('new-school').value = '';
    document.getElementById('new-target-school').value = '';
    document.getElementById('new-memo').value = '';
    document.getElementById('new-grade').selectedIndex = 0;
    document.getElementById('new-category').value = '';
    new bootstrap.Modal(document.getElementById('addStudentModal')).show();
}

function addStudent() {
    const name = document.getElementById('new-name').value;
    const grade = document.getElementById('new-grade').value;
    const category = document.getElementById('new-category').value;
    const school = document.getElementById('new-school').value;
    const target_school = document.getElementById('new-target-school').value;
    const memo = document.getElementById('new-memo').value;
    
    if(!name) { alert('名前は必須です'); return; }

    fetch('/api/students', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, grade, category, school, target_school, memo })
    }).then(res => res.json()).then(() => {
        loadStudents();
        bootstrap.Modal.getInstance(document.getElementById('addStudentModal')).hide();
        alert('生徒を追加しました');
    });
}

function deleteStudent() {
    if (!selectedStudentId) return;
    if (!confirm('本当にこの生徒を削除しますか？\nこの操作は取り消せません。')) return;

    fetch(`/api/students/${selectedStudentId}`, { method: 'DELETE' }).then(res => {
        if (res.ok) {
            alert('削除しました');
            location.reload(); 
        } else {
            alert('削除に失敗しました');
        }
    });
}

function toggleStudentHidden() {
    if (!selectedStudentId) return;
    const student = allStudents.find(s => s.id === selectedStudentId);
    if (!student) return;

    const newHiddenState = student.is_hidden === 1 ? 0 : 1;
    const msg = newHiddenState ? 'この生徒を「非表示」にしますか？' : 'この生徒を「表示」に戻しますか？';
    
    if(!confirm(msg)) return;

    const body = {
        name: student.name,
        grade: student.grade,
        school: student.school,
        target_school: student.target_school,
        category: student.category,
        memo: student.memo,
        is_hidden: newHiddenState
    };

    fetch(`/api/students/${selectedStudentId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    }).then(res => res.json()).then(() => {
        student.is_hidden = newHiddenState; 
        selectStudent(student); 
        renderStudentLists(); 
        alert(newHiddenState ? '非表示にしました' : '表示に戻しました');
    });
}

const profileFieldIds = [
    'prof-strength', 'prof-weakness', 'prof-status-summary', 'prof-action-amount', 'prof-current-problem', 'prof-habit-pattern',
    'prof-ideal-1m', 'prof-ideal-6m', 'prof-ideal-1y', 'prof-ideal-2y', 'prof-ideal-3y', 'prof-ideal-4y', 'prof-ideal-5y',
    'prof-ideal-10y', 'prof-ideal-20y', 'prof-ideal-30y', 'prof-ideal-death',
    'prof-specific-goal', 'prof-reason', 'prof-numeric-goal',
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
    document.getElementById('student-info-display').style.display = 'block';
    document.getElementById('student-info-edit').style.display = 'none';

    document.getElementById('detail-name').textContent = student.name;
    document.getElementById('detail-grade').textContent = student.grade;
    document.getElementById('detail-school').textContent = student.school;
    document.getElementById('detail-target-school').textContent = student.target_school || '-';
    document.getElementById('detail-category').textContent = student.category || '-';
    
    const badge = document.getElementById('detail-category-badge');
    badge.textContent = student.category || '未設定';
    
    document.getElementById('detail-memo').textContent = student.memo;
    
    const hideBtn = document.getElementById('btn-toggle-hide');
    if (student.is_hidden === 1) {
        hideBtn.innerHTML = '<i class="bi bi-eye"></i> 表示に戻す';
        hideBtn.classList.replace('btn-outline-secondary', 'btn-outline-success');
    } else {
        hideBtn.innerHTML = '<i class="bi bi-eye-slash"></i> 非表示';
        hideBtn.classList.replace('btn-outline-success', 'btn-outline-secondary');
    }

    let profileData = {};
    try { if (student.profile_data) profileData = JSON.parse(student.profile_data); } catch (e) {}

    profileFieldIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.value = profileData[id] || (el.type === 'range' ? '3' : '');
            if (el.type === 'range') document.getElementById(id.replace('prof-eval-', 'val-')).innerText = el.value;
        }
    });
    
    // ★修正: リストにクリックイベントを追加
    fetch(`/api/students/${student.id}/reports`).then(res => res.json()).then(reports => {
        const reportList = document.getElementById('student-reports-list');
        reportList.innerHTML = '';
        reports.forEach(r => {
            const div = document.createElement('div');
            div.className = 'list-group-item list-group-item-action';
            div.style.cursor = 'pointer'; // クリック可能に見せる
            div.innerHTML = `<small class="text-muted">${new Date(r.created_at).toLocaleString()}</small><br>${r.content.substring(0, 40)}...`;
            // クリックイベントでモーダル表示
            div.onclick = () => showReportDetail(r);
            reportList.appendChild(div);
        });
    });

    setupStudentCalendar(student.id);
}

// ★追加: 詳細表示用関数
function showReportDetail(report) {
    const modalTitle = document.querySelector('#reportDetailModal .modal-title');
    const modalBody = document.querySelector('#reportDetailModal .modal-body pre');
    
    if (modalTitle) modalTitle.textContent = `${new Date(report.created_at).toLocaleDateString()} のレポート詳細`;
    modalBody.textContent = report.content;
    
    new bootstrap.Modal(document.getElementById('reportDetailModal')).show();
}

function setupStudentCalendar(studentId) {
    const calendarEl = document.getElementById('student-calendar');
    calendarEl.innerHTML = '';

    studentCalendar = new FullCalendar.Calendar(calendarEl, {
        initialView: 'dayGridMonth',
        locale: 'ja',
        height: 500,
        headerToolbar: { left: 'prev,next today', center: 'title', right: 'dayGridMonth,listMonth' },
        events: `/api/students/${studentId}/events`,
        dateClick: function(info) {
            document.getElementById('event-start-date').value = info.dateStr;
            document.getElementById('event-date-display').value = info.dateStr;
            document.getElementById('event-title').value = '';
            new bootstrap.Modal(document.getElementById('addEventModal')).show();
        },
        eventClick: function(info) {
            if(confirm(`「${info.event.title}」を削除しますか？`)) {
                fetch(`/api/events/${info.event.id}`, { method: 'DELETE' }).then(() => {
                    info.event.remove();
                    if(calendar) calendar.refetchEvents();
                });
            }
        }
    });
    const tabPane = document.getElementById('tab-calendar');
    if (tabPane.classList.contains('active')) {
        setTimeout(() => studentCalendar.render(), 100);
    }
}

window.addStudentEvent = function() {
    if(!selectedStudentId) return;
    const title = document.getElementById('event-title').value;
    const date = document.getElementById('event-start-date').value;
    const color = document.getElementById('event-color').value;

    if(!title) { alert('予定名を入力してください'); return; }

    fetch(`/api/students/${selectedStudentId}/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title, start: date, color: color })
    }).then(res => res.json()).then(() => {
        bootstrap.Modal.getInstance(document.getElementById('addEventModal')).hide();
        studentCalendar.refetchEvents(); 
        if(calendar) calendar.refetchEvents(); 
    });
}

function saveProfileData() {
    if(!selectedStudentId) return;
    const data = {};
    profileFieldIds.forEach(id => { const el = document.getElementById(id); if(el) data[id] = el.value; });
    fetch(`/api/students/${selectedStudentId}/profile`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ profileData: data })
    }).then(() => {
        alert('保存しました');
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
        document.getElementById('edit-category').value = document.getElementById('detail-category').textContent === '-' ? '' : document.getElementById('detail-category').textContent;
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
    const currentStudent = allStudents.find(s => s.id === selectedStudentId);
    
    const body = {
        name: document.getElementById('edit-name').value,
        grade: document.getElementById('edit-grade').value,
        school: document.getElementById('edit-school').value,
        target_school: document.getElementById('edit-target-school').value,
        category: document.getElementById('edit-category').value,
        memo: document.getElementById('edit-memo').value,
        is_hidden: currentStudent.is_hidden 
    };
    fetch(`/api/students/${selectedStudentId}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
    }).then(res => res.json()).then(() => {
        alert('更新しました');
        Object.assign(currentStudent, body);
        selectStudent(currentStudent); 
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
    newBtn.onclick = () => { new bootstrap.Modal(document.getElementById('selectStudentModal')).show(); };
    container.appendChild(newBtn);

    fetch('/api/reports').then(res => res.json()).then(reports => {
        reports.forEach(report => {
            const card = document.createElement('div');
            card.className = 'report-card-item';
            const date = new Date(report.created_at).toLocaleDateString();
            const preview = report.content.replace(/\n/g, ' ').substring(0, 60) + '...';
            const typeBadge = report.report_type === 'normal' ? '<span class="badge bg-info mb-1">ノーマル</span>' : '<span class="badge bg-secondary mb-1">拝島</span>';
            card.innerHTML = `<div>${typeBadge}<div class="report-card-date">${date}</div><div class="report-card-name">${report.student_name || '不明な生徒'}</div></div><div class="report-card-preview text-muted mt-2">${preview}</div>`;
            card.onclick = () => openReportForm(report);
            container.appendChild(card);
        });
    });
}

function deleteReport() {
    const reportId = document.getElementById('report-id').value;
    if (!reportId) return;
    if (!confirm('本当にこのレポートを削除しますか？\nこの操作は取り消せません。')) return;

    fetch(`/api/reports/${reportId}`, { method: 'DELETE' }).then(res => {
        if (res.ok) {
            alert('レポートを削除しました');
            closeReportForm();
            loadReportList();
            if(calendar) calendar.refetchEvents();
        } else {
            alert('削除に失敗しました');
        }
    });
}

function startNewReport() {
    const studentId = document.getElementById('modal-student-select').value;
    const typeNormal = document.getElementById('typeNormal').checked;
    const reportType = typeNormal ? 'normal' : 'haijima';

    if (!studentId) return;
    const student = allStudents.find(s => s.id == studentId);
    bootstrap.Modal.getInstance(document.getElementById('selectStudentModal')).hide();
    openReportForm(null, student, reportType); 
}

function openReportForm(report = null, student = null, newReportType = 'normal') {
    document.getElementById('report-list-view').style.display = 'none';
    document.getElementById('report-form-view').style.display = 'block';
    document.getElementById('output-container').innerHTML = '';
    const formTitle = document.getElementById('report-form-title');
    const saveBtn = document.getElementById('save-report-btn');
    const deleteBtn = document.getElementById('delete-report-btn');
    const editBtn = document.getElementById('edit-mode-btn');
    
    const setEditable = (editable) => {
        const inputs = document.querySelectorAll('#report-form-view input:not([readonly]), #report-form-view textarea, #report-form-view select, #add-plan-button, .btn-danger');
        inputs.forEach(el => el.disabled = !editable);
    };

    const switchFormType = (type) => {
        const fixedSection = document.getElementById('report-fixed-section');
        const mainTitle = document.getElementById('report-main-title');
        if (type === 'normal') {
            fixedSection.style.display = 'none'; 
            mainTitle.textContent = 'レポート内容';
        } else {
            fixedSection.style.display = 'block'; 
            mainTitle.textContent = '2. 教科ごとの報告';
        }
    };

    resetForm();

    if (report) {
        formTitle.textContent = 'レポート編集';
        document.getElementById('report-id').value = report.id;
        document.getElementById('report-student-display').value = report.student_name;
        document.getElementById('report-student-id').value = report.student_id;
        document.getElementById('report-type').value = report.report_type || 'haijima'; 
        document.getElementById('report-next-date').value = report.next_training_date || '';
        
        switchFormType(report.report_type || 'haijima');
        parseContentToForm(report.content, report.report_type || 'haijima');
        
        setEditable(true);
        saveBtn.style.display = 'block';
        deleteBtn.style.display = 'inline-block'; 
        editBtn.style.display = 'none';
    } else if (student) {
        formTitle.textContent = '新規レポート作成';
        document.getElementById('report-id').value = ''; 
        document.getElementById('report-student-id').value = student.id;
        document.getElementById('report-student-display').value = student.name;
        document.getElementById('report-type').value = newReportType;
        
        switchFormType(newReportType);
        createPlanCard({ type: newReportType });

        setEditable(true);
        saveBtn.style.display = 'block';
        deleteBtn.style.display = 'none'; 
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

    window.createPlanCard = function(initialData = {}) {
        const currentType = initialData.type || document.getElementById('report-type').value || 'haijima';
        const cardDiv = document.createElement('div');
        cardDiv.className = 'card mb-3 bg-light plan-card';
        const cardBody = document.createElement('div');
        cardBody.className = 'card-body';
        const headerRow = document.createElement('div');
        headerRow.className = 'd-flex justify-content-between mb-2';
        
        let titleInput;
        if (currentType === 'haijima') {
            titleInput = document.createElement('select');
            titleInput.className = 'form-select me-2 subject-select';
            titleInput.style.maxWidth = '150px';
            subjectOptions.forEach(s => { const opt = document.createElement('option'); opt.value = s; opt.textContent = s; titleInput.appendChild(opt); });
            if(initialData.subject) titleInput.value = initialData.subject;
        } else {
            titleInput = document.createElement('input');
            titleInput.type = 'text';
            titleInput.className = 'form-control me-2 subject-select';
            titleInput.placeholder = 'トピック名 (任意)';
            titleInput.style.maxWidth = '200px';
            if(initialData.subject) titleInput.value = initialData.subject;
        }

        const removeBtn = document.createElement('button');
        removeBtn.className = 'btn btn-danger btn-sm';
        removeBtn.textContent = '×';
        removeBtn.onclick = () => planContainer.removeChild(cardDiv);
        headerRow.appendChild(titleInput); headerRow.appendChild(removeBtn); cardBody.appendChild(headerRow);

        let fields = [];
        if (currentType === 'haijima') {
            fields = [
                { ph: '振り返り', cls: 'review-input' },
                { ph: '理想・目標', cls: 'goal-input' },
                { ph: '現状', cls: 'situation-input' },
                { ph: '具体的な行動・勉強法', cls: 'solution-input' }
            ];
        } else {
            fields = [
                { ph: '現状', cls: 'n-current' },
                { ph: '理想', cls: 'n-ideal' },
                { ph: 'ギャップ（問題）', cls: 'n-gap' },
                { ph: '原因', cls: 'n-cause' },
                { ph: '課題', cls: 'n-issue' },
                { ph: '行動（具体）', cls: 'n-action' },
                { ph: '行動の条件（いつ・どこで・どれくらい）', cls: 'n-condition' },
                { ph: '予測される障害', cls: 'n-obstacle' },
                { ph: '障害の対処', cls: 'n-deal' },
                { ph: '成果の指標（KPI）', cls: 'n-kpi' }
            ];
        }

        fields.forEach((f) => {
            const ta = document.createElement('textarea');
            ta.className = `form-control mb-2 plan-input ${f.cls}`;
            ta.rows = 2; ta.placeholder = f.ph;
            if (initialData.values && initialData.values[f.cls]) ta.value = initialData.values[f.cls];
            cardBody.appendChild(ta);
        });
        cardDiv.appendChild(cardBody); planContainer.appendChild(cardDiv);
    };

    addPlanButton.addEventListener('click', () => createPlanCard());

    saveButton.addEventListener('click', () => {
        const reportId = document.getElementById('report-id').value;
        const studentId = document.getElementById('report-student-id').value;
        const reportType = document.getElementById('report-type').value;
        const nextDate = document.getElementById('report-next-date').value;
        const studentName = document.getElementById('report-student-display').value;

        let fullText = "";
        outputContainer.innerHTML = ''; 

        const pdfContainer = document.createElement('div');
        pdfContainer.id = 'pdf-content';
        pdfContainer.style.padding = '20px';
        pdfContainer.style.fontFamily = 'sans-serif';
        pdfContainer.innerHTML = `<h2 style="text-align:center; border-bottom:1px solid #ccc; padding-bottom:10px;">特訓レポート (${reportType === 'normal' ? 'ノーマル' : '拝島'})</h2>
        <p><strong>生徒名:</strong> ${studentName}<br><strong>日時:</strong> ${new Date().toLocaleDateString()}</p><hr>`;

        const createHaijimaBox = (title, lines) => {
            if(lines.length===0) return;
            const boxDiv = document.createElement('div');
            boxDiv.className = 'output-box mb-3 p-3 bg-white border rounded';
            
            const header = document.createElement('div');
            header.className = 'd-flex justify-content-between align-items-center mb-2';
            
            const titleEl = document.createElement('h5');
            titleEl.className = 'fs-6 fw-bold m-0';
            titleEl.textContent = title;
            
            const copyBtn = document.createElement('button');
            copyBtn.className = 'btn btn-sm btn-outline-primary';
            copyBtn.textContent = 'コピー';
            
            const contentText = lines.join('\n\n');
            const pre = document.createElement('pre');
            pre.className = 'bg-light p-2 rounded mt-2';
            pre.style.whiteSpace = 'pre-wrap';
            pre.textContent = contentText;

            copyBtn.addEventListener('click', () => {
                const textToCopy = `${title}\n${contentText}`;
                navigator.clipboard.writeText(textToCopy).then(() => {
                    copyBtn.textContent = '完了!';
                    setTimeout(() => copyBtn.textContent = 'コピー', 2000);
                });
            });

            header.appendChild(titleEl);
            header.appendChild(copyBtn);
            boxDiv.appendChild(header);
            boxDiv.appendChild(pre);
            outputContainer.appendChild(boxDiv);

            fullText += `${title}\n${contentText}\n\n`;
            pdfContainer.innerHTML += `<h4>${title}</h4><pre style="background:#f9f9f9; padding:10px; white-space:pre-wrap;">${contentText}</pre>`;
        };

        const appendNormalPreview = (htmlContent) => {
            outputContainer.innerHTML = `
                <div class="alert alert-success">
                    <h5>レポートを作成しました</h5>
                    <p>以下のボタンからPDFをダウンロードできます。</p>
                    <button class="btn btn-primary" onclick="downloadPDF()"><i class="bi bi-file-earmark-pdf"></i> PDFダウンロード</button>
                </div>
                <div class="border p-4 bg-white shadow-sm" id="normal-preview">${htmlContent}</div>
            `;
        };

        if (reportType === 'haijima') {
            const hw = document.getElementById('homework-review').value.trim();
            const test = document.getElementById('test-review').value.trim();
            const ev = document.getElementById('events-notes').value.trim();
            const other = document.getElementById('other-notes').value.trim();
            
            if(hw || test) createHaijimaBox('【宿題/確認テストの振り返り】', [hw && `⚪︎ 宿題\n${hw}`, test && `⚪︎ テスト\n${test}`].filter(Boolean));
            if(ev || other) createHaijimaBox('【特記事項】', [ev && `⚪︎ 行事\n${ev}`, other && `⚪︎ その他\n${other}`].filter(Boolean));

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
            if(subjects.review.length) createHaijimaBox('【振り返り】', subjects.review);
            if(subjects.goal.length) createHaijimaBox('【理想・目標】', subjects.goal);
            if(subjects.sit.length) createHaijimaBox('【現状】', subjects.sit);
            if(subjects.sol.length) createHaijimaBox('【具体的な行動・勉強法】', subjects.sol);

        } else {
            const cards = document.querySelectorAll('.plan-card');
            let normalHtml = "";
            let normalText = "";
            cards.forEach(c => {
                const topic = c.querySelector('.subject-select').value || 'トピック';
                normalHtml += `<div style="margin-bottom:20px; border:1px solid #ddd; padding:15px; border-radius:5px;">
                    <h3 style="background:#f0f8ff; padding:5px 10px; margin-top:0;">${topic}</h3>
                    <table style="width:100%; border-collapse:collapse;">`;
                
                const addRow = (label, cls) => {
                    const val = c.querySelector(`.${cls}`).value.trim();
                    if(val) {
                        normalHtml += `<tr><td style="font-weight:bold; width:30%; border-bottom:1px solid #eee; padding:5px;">${label}</td><td style="border-bottom:1px solid #eee; padding:5px;">${val.replace(/\n/g,'<br>')}</td></tr>`;
                        normalText += `[${label}] ${val}\n`;
                    }
                };
                
                normalText += `■ ${topic}\n`;
                addRow('現状', 'n-current'); addRow('理想', 'n-ideal'); addRow('ギャップ', 'n-gap');
                addRow('原因', 'n-cause'); addRow('課題', 'n-issue'); addRow('行動', 'n-action');
                addRow('条件', 'n-condition'); addRow('障害', 'n-obstacle'); addRow('対処', 'n-deal');
                addRow('KPI', 'n-kpi');
                
                normalHtml += `</table></div>`;
                normalText += `\n`;
            });
            fullText = normalText;
            appendNormalPreview(normalHtml);
            pdfContainer.innerHTML += normalHtml; 
        }

        const url = reportId ? `/api/reports/${reportId}` : '/api/reports';
        const method = reportId ? 'PUT' : 'POST';
        const body = { studentId, reportType, nextDate, content: fullText };

        fetch(url, {
            method: method,
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(body)
        })
        .then(res => res.json())
        .then(data => {
            alert('保存しました');
            if (!reportId && data.id) {
                document.getElementById('report-id').value = data.id;
                document.getElementById('report-form-title').textContent = 'レポート編集';
                document.getElementById('delete-report-btn').style.display = 'inline-block';
            }
            loadReportList(); 
            if(calendar) calendar.refetchEvents();
            
            window.downloadPDF = function() {
                const opt = {
                    margin: 10,
                    filename: `${studentName}_report.pdf`,
                    image: { type: 'jpeg', quality: 0.98 },
                    html2canvas: { scale: 2 },
                    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
                };
                html2pdf().from(pdfContainer).set(opt).save();
            };
        });
    });
}

window.copyToClipboard = function(btn) {
    // 拝島型の場合、ボタンの親(header)の次にある pre 要素を取得
    const pre = btn.parentElement.nextElementSibling;
    // タイトルはボタンの隣の h5
    const title = btn.previousElementSibling.textContent;
    const text = `${title}\n${pre.textContent}`;
    
    navigator.clipboard.writeText(text).then(() => {
        const original = btn.textContent;
        btn.textContent = '完了!';
        setTimeout(() => btn.textContent = original, 2000);
    });
};

function parseContentToForm(text, type) {
    document.getElementById('plan-container').innerHTML = '';
    const extractSection = (header) => {
        const regex = new RegExp(`【${header}】\\n([\\s\\S]*?)(?=\\n\\n【|$)`);
        const match = text.match(regex);
        return match ? match[1].trim() : '';
    };

    if (type === 'haijima') {
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

        const parseSubjectSection = (header, key) => {
            const content = extractSection(header);
            const regex = /⚪︎ (.*?)\n([\s\S]*?)(?=\n⚪︎|$)/g;
            let match;
            while ((match = regex.exec(content)) !== null) {
                const subject = match[1].trim();
                const value = match[2].trim();
                let card = Array.from(document.querySelectorAll('.plan-card')).find(c => c.querySelector('.subject-select').value === subject);
                if (!card) {
                    createPlanCard({ type: 'haijima', subject: subject });
                    card = document.querySelectorAll('.plan-card')[document.querySelectorAll('.plan-card').length - 1];
                }
                const input = card.querySelector(`.${key}`);
                if (input) input.value = value;
            }
        };
        parseSubjectSection('振り返り', 'review-input');
        parseSubjectSection('理想・目標', 'goal-input');
        parseSubjectSection('現状', 'situation-input');
        parseSubjectSection('具体的な行動・勉強法', 'solution-input');

    } else {
        const regex = /■ (.*?)\n([\s\S]*?)(?=\n■|$)/g;
        let match;
        while ((match = regex.exec(text)) !== null) {
            const topic = match[1];
            const content = match[2];
            const extractVal = (label) => {
                const m = content.match(new RegExp(`\\[${label}\\] ([^\\n]*)`));
                return m ? m[1].trim() : '';
            };
            createPlanCard({
                type: 'normal',
                subject: topic,
                values: {
                    'n-current': extractVal('現状'), 'n-ideal': extractVal('理想'), 'n-gap': extractVal('ギャップ'),
                    'n-cause': extractVal('原因'), 'n-issue': extractVal('課題'), 'n-action': extractVal('行動'),
                    'n-condition': extractVal('条件'), 'n-obstacle': extractVal('障害'), 'n-deal': extractVal('対処'),
                    'n-kpi': extractVal('KPI')
                }
            });
        }
    }
}

function resetForm() {
    document.getElementById('plan-container').innerHTML = '';
    document.querySelectorAll('#report-form-view textarea').forEach(t => t.value = '');
    document.getElementById('report-next-date').value = '';
}

function setupCalendar() {
    const calendarEl = document.getElementById('calendar');
    calendar = new FullCalendar.Calendar(calendarEl, {
        initialView: 'dayGridMonth', locale: 'ja',
        headerToolbar: { left: 'prev,next today', center: 'title', right: 'dayGridMonth,timeGridWeek,listWeek' },
        events: '/api/calendar-events', height: 'auto',
        eventTimeFormat: { hour: '2-digit', minute: '2-digit', meridiem: false }
    });
    calendar.render();
}