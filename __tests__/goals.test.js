process.env.DB_PATH = ':memory:';
process.env.NODE_ENV = 'test';

const request = require('supertest');
const app = require('../server');
const db = require('../database');

const agent = request.agent(app);

const registerAndLogin = async () => {
    await agent.post('/api/register').send({ email: 'test@example.com', password: 'password123' });
};

describe('Goals API', () => {
    beforeAll(async () => {
        await registerAndLogin();
    });

    test('creates, retrieves, and updates a goal', async () => {
        const payload = {
            title: '目標テスト',
            specific: '英語長文',
            measurable: '模試偏差値60',
            achievable: '週3回',
            relevant: '志望校合格',
            time_bound: '毎週',
            due_date: '2025-12-31',
            importance: 4
        };

        const createRes = await agent.post('/api/goals').send(payload).expect(200);
        expect(createRes.body.id).toBeTruthy();

        const listRes = await agent.get('/api/goals').expect(200);
        const createdGoal = listRes.body.find(g => g.id === createRes.body.id);
        expect(createdGoal.title).toBe(payload.title);

        await agent.put(`/api/goals/${createRes.body.id}`).send({ ...payload, title: '更新後の目標' }).expect(200);
        const updatedList = await agent.get('/api/goals').expect(200);
        const updatedGoal = updatedList.body.find(g => g.id === createRes.body.id);
        expect(updatedGoal.title).toBe('更新後の目標');
    });

    test('updates progress and returns overdue warning', async () => {
        const payload = {
            title: '期限切れテスト',
            due_date: '2020-01-01',
            importance: 3
        };
        const createRes = await agent.post('/api/goals').send(payload);
        const progressRes = await agent.post(`/api/goals/${createRes.body.id}/progress`).send({ progress: 10 }).expect(200);
        expect(progressRes.body.progress).toBe(10);
        expect(progressRes.body.overdue).toBe(true);
        expect(progressRes.body.warning).toBeTruthy();
    });

    test('summarizes weekly and daily metrics with risk goals', async () => {
        const activeGoal = await agent.post('/api/goals').send({
            title: '進捗中ゴール',
            due_date: '2099-12-31',
            importance: 2
        });

        const staleGoal = await agent.post('/api/goals').send({
            title: '停滞ゴール',
            due_date: '2099-12-31',
            importance: 2
        });

        await agent.post(`/api/goals/${activeGoal.body.id}/progress`).send({ progress: 60 });
        await agent.post(`/api/goals/${staleGoal.body.id}/progress`).send({ progress: 20 });

        await new Promise(resolve => {
            db.run(
                'UPDATE goals SET progress_updated_at = datetime("now", "-8 day") WHERE id = ?',
                [staleGoal.body.id],
                resolve
            );
        });

        const summaryRes = await agent.get('/api/goals/summary').expect(200);
        expect(summaryRes.body.weekly.achievementRate).toBeGreaterThan(0);
        expect(summaryRes.body.weekly.incompleteCount).toBeGreaterThanOrEqual(1);
        const riskIds = summaryRes.body.weekly.riskGoals.map(g => g.id);
        expect(riskIds).toContain(staleGoal.body.id);
    });
});
