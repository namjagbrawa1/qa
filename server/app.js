import express from 'express';
import sqlite3 from 'sqlite3';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// 中间件
app.use(cors());
app.use(express.json());

// 数据库初始化
const dbPath = path.join(__dirname, 'database.sqlite');
const Database = sqlite3.verbose().Database;
const db = new Database(dbPath);

// 创建表
db.serialize(() => {
  // 题目表
  db.run(`CREATE TABLE IF NOT EXISTS questions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    type TEXT NOT NULL,
    options TEXT NOT NULL,
    correctAnswer TEXT NOT NULL,
    score INTEGER NOT NULL DEFAULT 10,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // 试卷表
  db.run(`CREATE TABLE IF NOT EXISTS exams (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    questions TEXT NOT NULL,
    duration INTEGER DEFAULT 60,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // 考试记录表
  db.run(`CREATE TABLE IF NOT EXISTS exam_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    exam_id INTEGER,
    student_name TEXT,
    answers TEXT NOT NULL,
    score INTEGER,
    total_score INTEGER,
    start_time DATETIME,
    end_time DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (exam_id) REFERENCES exams (id)
  )`);

  // 插入默认题目
  db.get("SELECT COUNT(*) as count FROM questions", (err, row) => {
    if (err) {
      console.error('Error checking questions:', err);
      return;
    }
    
    if (row.count === 0) {
      const defaultQuestions = [
        {
          title: '以下哪个是Vue.js的核心特性？',
          type: 'single',
          options: JSON.stringify(['响应式数据绑定', '虚拟DOM', '组件化', '以上都是']),
          correctAnswer: JSON.stringify([3]),
          score: 10
        },
        {
          title: 'JavaScript中哪个方法用于添加数组元素？',
          type: 'single',
          options: JSON.stringify(['push()', 'add()', 'insert()', 'append()']),
          correctAnswer: JSON.stringify([0]),
          score: 10
        },
        {
          title: '以下哪些是CSS预处理器？',
          type: 'multiple',
          options: JSON.stringify(['Sass', 'Less', 'Stylus', 'PostCSS']),
          correctAnswer: JSON.stringify([0, 1, 2]),
          score: 15
        },
        {
          title: 'HTML5新增的语义化标签包括？',
          type: 'single',
          options: JSON.stringify(['<header>', '<nav>', '<section>', '以上都是']),
          correctAnswer: JSON.stringify([3]),
          score: 10
        }
      ];

      const stmt = db.prepare("INSERT INTO questions (title, type, options, correctAnswer, score) VALUES (?, ?, ?, ?, ?)");
      defaultQuestions.forEach(q => {
        stmt.run(q.title, q.type, q.options, q.correctAnswer, q.score);
      });
      stmt.finalize();
      console.log('Default questions inserted');
    }
  });
});

// API路由

// 题目相关API
app.get('/api/questions', (req, res) => {
  db.all("SELECT * FROM questions ORDER BY created_at DESC", (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    const questions = rows.map(row => ({
      id: row.id,
      title: row.title,
      type: row.type,
      options: JSON.parse(row.options),
      correctAnswer: JSON.parse(row.correctAnswer),
      score: row.score,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));
    
    res.json(questions);
  });
});

app.post('/api/questions', (req, res) => {
  const { title, type, options, correctAnswer, score } = req.body;
  
  if (!title || !type || !options || !correctAnswer) {
    res.status(400).json({ error: 'Missing required fields' });
    return;
  }

  const stmt = db.prepare("INSERT INTO questions (title, type, options, correctAnswer, score) VALUES (?, ?, ?, ?, ?)");
  stmt.run(title, type, JSON.stringify(options), JSON.stringify(correctAnswer), score || 10, function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    res.json({
      id: this.lastID,
      title,
      type,
      options,
      correctAnswer,
      score: score || 10
    });
  });
  stmt.finalize();
});

app.put('/api/questions/:id', (req, res) => {
  const { id } = req.params;
  const { title, type, options, correctAnswer, score } = req.body;
  
  const stmt = db.prepare("UPDATE questions SET title = ?, type = ?, options = ?, correctAnswer = ?, score = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?");
  stmt.run(title, type, JSON.stringify(options), JSON.stringify(correctAnswer), score, id, function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    if (this.changes === 0) {
      res.status(404).json({ error: 'Question not found' });
      return;
    }
    
    res.json({ message: 'Question updated successfully' });
  });
  stmt.finalize();
});

app.delete('/api/questions/:id', (req, res) => {
  const { id } = req.params;
  
  const stmt = db.prepare("DELETE FROM questions WHERE id = ?");
  stmt.run(id, function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    if (this.changes === 0) {
      res.status(404).json({ error: 'Question not found' });
      return;
    }
    
    res.json({ message: 'Question deleted successfully' });
  });
  stmt.finalize();
});

// 试卷相关API
app.get('/api/exams', (req, res) => {
  db.all("SELECT * FROM exams ORDER BY created_at DESC", (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    const exams = rows.map(row => ({
      id: row.id,
      title: row.title,
      description: row.description,
      questions: JSON.parse(row.questions),
      duration: row.duration,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));
    
    res.json(exams);
  });
});

app.post('/api/exams', (req, res) => {
  const { title, description, questions, duration } = req.body;
  
  if (!title || !questions) {
    res.status(400).json({ error: 'Missing required fields' });
    return;
  }

  const stmt = db.prepare("INSERT INTO exams (title, description, questions, duration) VALUES (?, ?, ?, ?)");
  stmt.run(title, description || '', JSON.stringify(questions), duration || 60, function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    res.json({
      id: this.lastID,
      title,
      description,
      questions,
      duration: duration || 60
    });
  });
  stmt.finalize();
});

app.delete('/api/exams/:id', (req, res) => {
  const { id } = req.params;
  
  const stmt = db.prepare("DELETE FROM exams WHERE id = ?");
  stmt.run(id, function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    if (this.changes === 0) {
      res.status(404).json({ error: 'Exam not found' });
      return;
    }
    
    res.json({ message: 'Exam deleted successfully' });
  });
  stmt.finalize();
});

// 考试记录相关API
app.get('/api/exam-records', (req, res) => {
  db.all("SELECT * FROM exam_records ORDER BY created_at DESC", (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    const records = rows.map(row => ({
      id: row.id,
      examId: row.exam_id,
      studentName: row.student_name,
      answers: JSON.parse(row.answers),
      score: row.score,
      totalScore: row.total_score,
      startTime: row.start_time,
      endTime: row.end_time,
      createdAt: row.created_at
    }));
    
    res.json(records);
  });
});

app.post('/api/exam-records', (req, res) => {
  const { examId, studentName, answers, score, totalScore, startTime, endTime } = req.body;
  
  if (!examId || !answers) {
    res.status(400).json({ error: 'Missing required fields' });
    return;
  }

  const stmt = db.prepare("INSERT INTO exam_records (exam_id, student_name, answers, score, total_score, start_time, end_time) VALUES (?, ?, ?, ?, ?, ?, ?)");
  stmt.run(examId, studentName || '', JSON.stringify(answers), score, totalScore, startTime, endTime, function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    res.json({
      id: this.lastID,
      examId,
      studentName,
      answers,
      score,
      totalScore,
      startTime,
      endTime
    });
  });
  stmt.finalize();
});

// 启动服务器
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on port ${PORT}`);
});

// 优雅关闭
process.on('SIGINT', () => {
  console.log('\nShutting down server...');
  db.close((err) => {
    if (err) {
      console.error('Error closing database:', err);
    } else {
      console.log('Database connection closed.');
    }
    process.exit(0);
  });
});