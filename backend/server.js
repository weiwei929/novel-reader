const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const busboy = require('busboy');
const path = require('path');
const fs = require('fs');

const app = express();
const port = 3000;

// 创建数据库连接
const db = new sqlite3.Database('./novels.db');

// 创建必要的表
db.run(`CREATE TABLE IF NOT EXISTS articles (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	title TEXT,
	content TEXT,
	image_path TEXT,
	created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)`);

// 创建上传目录
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)){
		fs.mkdirSync(uploadDir);
}

// 跨域支持
app.use((req, res, next) => {
	res.header('Access-Control-Allow-Origin', '*');
	res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
	next();
});

// 文件上传API
app.post('/upload', (req, res) => {
	const bb = busboy({ headers: req.headers });
  
	bb.on('file', (name, file, info) => {
		// 处理文件名，移除特殊字符和中文，保留扩展名
		const originalName = info.filename;
		const ext = path.extname(originalName);
		const baseName = path.basename(originalName, ext);
		// 生成安全的文件名：时间戳 + 随机字符 + 扩展名
		const safeBaseName = baseName.replace(/[^a-zA-Z0-9]/g, '').substring(0, 10) || 'image';
		const filename = `${Date.now()}-${safeBaseName}${ext}`;
		const savePath = path.join(uploadDir, filename);
    
		file.pipe(fs.createWriteStream(savePath))
			.on('finish', () => {
				// 保存文件信息到数据库
				db.run(`INSERT INTO articles (title, content, image_path) 
								VALUES (?, ?, ?)`, 
								[info.filename, '', `/uploads/${filename}`],
								function(err) {
									if (err) {
										return res.status(500).json({ error: err.message });
									}
									res.json({ 
										message: '文件上传成功', 
										fileId: this.lastID,
										filePath: `/uploads/${filename}` 
									});
								});
			});
	});
	req.pipe(bb);
});

// 获取所有文章列表
app.get('/articles', (req, res) => {
	db.all(`SELECT id, title, image_path, created_at FROM articles`, [], (err, rows) => {
		if (err) {
			return res.status(500).json({ error: err.message });
		}
		res.json(rows);
	});
});

// 获取单篇文章详情
app.get('/article/:id', (req, res) => {
	db.get(`SELECT * FROM articles WHERE id = ?`, [req.params.id], (err, row) => {
		if (err) {
			return res.status(500).json({ error: err.message });
		}
		res.json(row);
	});
});

// 静态文件服务
app.use('/uploads', express.static(uploadDir));

// 文章内容更新
app.post('/article/:id', express.json(), (req, res) => {
	const { content, title } = req.body;
	db.run(`UPDATE articles SET content = ?, title = ? WHERE id = ?`, 
		[content, title, req.params.id], 
		function(err) {
			if (err) {
				return res.status(500).json({ error: err.message });
			}
			res.json({ 
				message: '文章更新成功', 
				changes: this.changes 
			});
		}
	);
});

// 删除文章
app.delete('/article/:id', (req, res) => {
	db.run(`DELETE FROM articles WHERE id = ?`, req.params.id, function(err) {
		if (err) {
			return res.status(500).json({ error: err.message });
		}
		res.json({ 
			message: '文章删除成功', 
			changes: this.changes 
		});
	});
});

// 图片上传
app.post('/upload-image', (req, res) => {
	const bb = busboy({ headers: req.headers });
  
	bb.on('file', (name, file, info) => {
		// 处理文件名，移除特殊字符和中文，保留扩展名
		const originalName = info.filename;
		const ext = path.extname(originalName);
		const baseName = path.basename(originalName, ext);
		// 生成安全的文件名：时间戳 + 随机字符 + 扩展名
		const safeBaseName = baseName.replace(/[^a-zA-Z0-9]/g, '').substring(0, 10) || 'image';
		const filename = `${Date.now()}-${safeBaseName}${ext}`;
		const savePath = path.join(uploadDir, filename);
    
		file.pipe(fs.createWriteStream(savePath))
			.on('finish', () => {
				res.json({ 
					message: '图片上传成功', 
					filePath: `/uploads/${filename}` 
				});
			});
	});
	req.pipe(bb);
});
// 图片删除接口
app.delete('/delete-image', express.json(), (req, res) => {
	const { imagePath } = req.body;
	if (!imagePath) {
		return res.status(400).json({ error: '缺少 imagePath 参数' });
	}
	// 删除数据库记录
	db.run('UPDATE articles SET image_path = NULL WHERE image_path = ?', [imagePath], function(err) {
		if (err) {
			return res.status(500).json({ error: '数据库操作失败' });
		}
		// 删除文件
		const filePath = path.join(uploadDir, path.basename(imagePath));
		fs.unlink(filePath, (err) => {
			if (err && err.code !== 'ENOENT') {
				return res.status(500).json({ error: '文件删除失败' });
			}
			return res.json({ success: true });
		});
	});
});

app.listen(port, '0.0.0.0', () => {
	console.log(`Novel Reader Backend listening at http://localhost:${port}`);
});

// 优雅关闭
process.on('SIGINT', () => {
	db.close((err) => {
		if (err) {
			console.error(err.message);
		}
		console.log('关闭数据库连接');
		process.exit(0);
	});
});