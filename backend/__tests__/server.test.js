const request = require('supertest');
const express = require('express');
const sqlite3 = require('sqlite3').verbose();

// 模拟服务器设置
const app = express();
app.use(express.json());

// 创建内存数据库用于测试
const db = new sqlite3.Database(':memory:');

// 创建测试用的表
db.run(`CREATE TABLE IF NOT EXISTS articles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT,
  content TEXT,
  image_path TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)`);

// 模拟服务器路由
app.get('/api/articles', (req, res) => {
  db.all('SELECT id, title, image_path, created_at FROM articles', [], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

app.post('/api/articles', (req, res) => {
  const { title, content } = req.body;
  db.run(
    'INSERT INTO articles (title, content) VALUES (?, ?)',
    [title, content],
    function(err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json({
        id: this.lastID,
        title,
        content,
        message: '文章创建成功'
      });
    }
  );
});

describe('服务器 API 测试', () => {
  beforeAll((done) => {
    // 确保数据库表已创建
    db.run(`CREATE TABLE IF NOT EXISTS articles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT,
      content TEXT,
      image_path TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`, done);
  });

  afterEach((done) => {
    // 清空测试数据
    db.run('DELETE FROM articles', done);
  });

  afterAll((done) => {
    // 关闭数据库连接
    db.close(done);
  });

  test('GET /api/articles 应该返回空数组', async () => {
    const response = await request(app).get('/api/articles');
    expect(response.status).toBe(200);
    expect(response.body).toEqual([]);
  });

  test('POST /api/articles 应该创建新文章', async () => {
    const newArticle = {
      title: '测试文章',
      content: '这是测试内容'
    };

    const response = await request(app)
      .post('/api/articles')
      .send(newArticle);

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('id');
    expect(response.body.title).toBe(newArticle.title);
    expect(response.body.content).toBe(newArticle.content);
  });

  test('GET /api/articles 在创建文章后应该返回文章列表', async () => {
    // 先创建一篇文章
    await request(app)
      .post('/api/articles')
      .send({ title: '测试文章', content: '测试内容' });

    // 然后获取文章列表
    const response = await request(app).get('/api/articles');
    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(1);
    expect(response.body[0]).toHaveProperty('title', '测试文章');
  });
});
