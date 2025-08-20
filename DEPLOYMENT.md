# 小说阅读器 VPS 部署指南

## 项目架构

这是一个前后端分离的 Web 应用：
- **后端**: Node.js + Express + SQLite3 (端口 3000)
- **前端**: 静态文件服务 (端口 80/443)
- **数据库**: SQLite3 文件数据库
- **文件存储**: 服务器本地存储

## 项目结构
```
novel-reader/
├── backend/                # 后端服务
│   ├── server.js          # Express 服务器
│   ├── package.json       # 后端依赖
│   ├── database.db        # SQLite 数据库 (运行时创建)
│   └── uploads/           # 图片存储目录
├── frontend/              # 前端文件
│   ├── index.html         # 主页面
│   ├── css/style.css      # 样式文件
│   └── js/                # JavaScript 模块
│       ├── app.js         # 主应用逻辑
│       ├── fileManager.js # 文件管理模块
│       ├── imageManager.js # 图片管理模块
│       └── markdownParser.js # Markdown 解析器
└── 配置文件
```

## 部署要求

### 服务器要求
- 操作系统：Linux (Ubuntu 20.04+ 推荐)
- Web服务器：Nginx (反向代理)
- Node.js：16.0+ 
- 存储空间：至少 2GB 可用空间
- 内存：至少 1GB RAM
- 端口：80, 443 (HTTPS), 3000 (后端 API)

### 软件依赖
- Node.js 16+
- npm 或 yarn
- Nginx 1.18+
- PM2 (进程管理器，推荐)
- SSL证书 (推荐使用 Let's Encrypt)

## 部署步骤

### 1. 服务器环境准备

#### 更新系统
```bash
sudo apt update && sudo apt upgrade -y
```

#### 安装 Node.js
```bash
# 安装 Node.js 18.x
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# 验证安装
node --version
npm --version
```

#### 安装 Nginx
```bash
sudo apt install nginx -y
sudo systemctl start nginx
sudo systemctl enable nginx
```

#### 安装 PM2 (进程管理器)
```bash
sudo npm install -g pm2
```

### 2. 部署后端服务

#### 上传后端文件
```bash
# 创建应用目录
sudo mkdir -p /var/www/novel-reader
sudo chown -R $USER:$USER /var/www/novel-reader

# 上传 backend 目录到服务器
scp -r ./backend user@your-server:/var/www/novel-reader/
```

#### 安装依赖
```bash
cd /var/www/novel-reader/backend
npm install --production
```

#### 创建 PM2 配置文件
```bash
# 创建 ecosystem.config.js
cat > /var/www/novel-reader/ecosystem.config.js << 'EOF'
module.exports = {
  apps: [{
    name: 'novel-reader-api',
    script: './backend/server.js',
    cwd: '/var/www/novel-reader',
    instances: 1,
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true
  }]
};
EOF
```

#### 启动后端服务
```bash
# 创建日志目录
mkdir -p /var/www/novel-reader/logs

# 启动服务
cd /var/www/novel-reader
pm2 start ecosystem.config.js

# 设置开机自启
pm2 save
pm2 startup
```

### 3. 部署前端文件

#### 上传前端文件
```bash
# 上传 frontend 目录
scp -r ./frontend user@your-server:/var/www/novel-reader/
```

#### 设置文件权限
```bash
sudo chown -R www-data:www-data /var/www/novel-reader/
sudo chmod -R 755 /var/www/novel-reader/
sudo chmod -R 775 /var/www/novel-reader/backend/uploads/
```

### 4. Nginx 配置

#### 创建站点配置文件
```bash
sudo nano /etc/nginx/sites-available/novel-reader
```

#### 添加以下配置：
```nginx
server {
    listen 80;
    server_name your-domain.com;  # 替换为你的域名
    
    # 前端静态文件
    location / {
        root /var/www/novel-reader/frontend;
        index index.html;
        try_files $uri $uri/ /index.html;
        
        # 静态文件缓存
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }
    
    # API 代理到后端
    location /api/ {
        proxy_pass http://localhost:3000/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # CORS 支持
        add_header Access-Control-Allow-Origin *;
        add_header Access-Control-Allow-Methods 'GET, POST, DELETE, OPTIONS';
        add_header Access-Control-Allow-Headers 'Content-Type, Authorization';
        
        # 处理 OPTIONS 请求
        if ($request_method = 'OPTIONS') {
            return 204;
        }
    }
    
    # 图片上传和访问
    location /uploads/ {
        proxy_pass http://localhost:3000/uploads/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    # 文件上传大小限制
    client_max_body_size 10M;
    
    # 安全头
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    
    # 日志
    access_log /var/log/nginx/novel-reader.access.log;
    error_log /var/log/nginx/novel-reader.error.log;
}
```

#### 启用站点
```bash
# 创建软链接
sudo ln -s /etc/nginx/sites-available/novel-reader /etc/nginx/sites-enabled/

# 测试配置
sudo nginx -t

# 重新加载 Nginx
sudo systemctl reload nginx
```

### 5. SSL 证书配置 (推荐)

#### 安装 Certbot
```bash
sudo apt install certbot python3-certbot-nginx -y
```

#### 获取 SSL 证书
```bash
sudo certbot --nginx -d your-domain.com
```

#### 自动续期
```bash
# 添加定时任务
sudo crontab -e

# 添加以下行
0 12 * * * /usr/bin/certbot renew --quiet
```

## 配置文件修改

### 前端 API 地址配置

由于部署到生产环境，需要修改前端代码中的 API 地址：

#### 修改 frontend/js/imageManager.js
```javascript
// 将 localhost:3000 改为生产环境地址
async uploadImage(file) {
    // ... 其他代码
    const response = await fetch('/api/upload-image', {  // 使用相对路径
        method: 'POST',
        body: formData
    });
    // ... 其他代码
    if (result.filePath) {
        return result.filePath;  // 返回相对路径
    }
}
```

#### 修改其他相关文件
确保所有 API 调用都使用相对路径 `/api/` 而不是 `http://localhost:3000/`

## 监控和维护

### PM2 常用命令
```bash
# 查看应用状态
pm2 status

# 查看日志
pm2 logs novel-reader-api

# 重启应用
pm2 restart novel-reader-api

# 停止应用
pm2 stop novel-reader-api

# 删除应用
pm2 delete novel-reader-api
```

### 备份数据库
```bash
# 备份 SQLite 数据库
cp /var/www/novel-reader/backend/database.db /backup/database-$(date +%Y%m%d).db

# 备份上传的图片
tar -czf /backup/uploads-$(date +%Y%m%d).tar.gz /var/www/novel-reader/backend/uploads/
```

### 磁盘空间监控
```bash
# 监控磁盘使用情况
df -h

# 监控上传目录大小
du -sh /var/www/novel-reader/backend/uploads/
```

## 安全建议

### 防火墙配置
```bash
# 启用 UFW
sudo ufw enable

# 允许必要端口
sudo ufw allow 22    # SSH
sudo ufw allow 80    # HTTP
sudo ufw allow 443   # HTTPS

# 拒绝直接访问后端端口
sudo ufw deny 3000
```

### 文件权限
```bash
# 确保正确的文件权限
sudo chown -R www-data:www-data /var/www/novel-reader/
sudo chmod -R 755 /var/www/novel-reader/
sudo chmod -R 775 /var/www/novel-reader/backend/uploads/
sudo chmod 600 /var/www/novel-reader/backend/database.db
```

## 故障排除

### 常见问题

1. **后端服务无法启动**
   ```bash
   # 检查端口占用
   sudo netstat -tlnp | grep :3000
   
   # 查看 PM2 日志
   pm2 logs novel-reader-api
   ```

2. **图片上传失败**
   ```bash
   # 检查上传目录权限
   ls -la /var/www/novel-reader/backend/uploads/
   
   # 检查磁盘空间
   df -h
   ```

3. **Nginx 502 错误**
   ```bash
   # 检查后端服务状态
   pm2 status
   
   # 检查 Nginx 日志
   sudo tail -f /var/log/nginx/novel-reader.error.log
   ```

## 性能优化

### Nginx 优化
```nginx
# 在 http 块中添加
gzip on;
gzip_vary on;
gzip_min_length 1000;
gzip_types text/plain text/css application/json application/javascript text/xml application/xml;

# 连接超时
client_body_timeout 12;
client_header_timeout 12;
keepalive_timeout 15;
send_timeout 10;
```

### 数据库优化
```bash
# 定期优化 SQLite 数据库
sqlite3 /var/www/novel-reader/backend/database.db "VACUUM;"
```

---

## 部署清单

- [ ] 服务器环境准备 (Node.js, Nginx, PM2)
- [ ] 后端代码部署和依赖安装
- [ ] 前端代码部署
- [ ] Nginx 配置和测试
- [ ] SSL 证书配置
- [ ] 防火墙和安全配置
- [ ] 监控和备份设置
- [ ] 域名解析配置
- [ ] 功能测试验证

部署完成后，访问 `https://your-domain.com` 即可使用小说阅读器！
    
    # 重定向到 HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;
    
    # SSL 配置
    ssl_certificate /path/to/your/certificate.crt;
    ssl_certificate_key /path/to/your/private.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    
    # 网站根目录
    root /var/www/html/novel-reader;
    index index.html;
    
    # 启用 gzip 压缩
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/xml+rss application/json;
    
    # 静态文件缓存
    location ~* \.(css|js|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        add_header Vary Accept-Encoding;
    }
    
    # HTML 文件缓存
    location ~* \.html$ {
        expires 1h;
        add_header Cache-Control "public";
    }
    
    # 主页面
    location / {
        try_files $uri $uri/ /index.html;
    }
    
    # 安全头部
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    add_header Content-Security-Policy "default-src 'self' https: data: 'unsafe-inline' 'unsafe-eval'" always;
    
    # 隐藏 Nginx 版本
    server_tokens off;
}
```

### 4. 启用站点
```bash
sudo ln -s /etc/nginx/sites-available/novel-reader /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 5. SSL 证书 (Let's Encrypt)
```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

## 性能优化

### 1. 启用 HTTP/2
确保 Nginx 配置中包含 `http2` 参数

### 2. 配置浏览器缓存
静态资源设置长期缓存，HTML 设置短期缓存

### 3. 启用 Gzip 压缩
压缩文本文件以减少传输大小

### 4. CDN 加速 (可选)
可以使用 CloudFlare 等 CDN 服务加速访问

## 安全配置

### 1. 防火墙设置
```bash
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

### 2. 定期更新
```bash
sudo apt update && sudo apt upgrade
```

### 3. 日志监控
监控 Nginx 访问日志和错误日志：
```bash
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

## 备份策略

### 1. 定期备份用户数据
由于数据存储在浏览器 localStorage 中，建议提醒用户定期导出数据

### 2. 服务器文件备份
```bash
# 创建备份脚本
#!/bin/bash
tar -czf /backup/novel-reader-$(date +%Y%m%d).tar.gz /var/www/html/novel-reader/
```

## 监控和维护

### 1. 服务状态监控
```bash
sudo systemctl status nginx
```

### 2. 磁盘空间监控
```bash
df -h
```

### 3. 内存使用监控
```bash
free -h
```

## 故障排除

### 1. 页面无法访问
- 检查 Nginx 状态
- 检查防火墙设置
- 检查 DNS 解析

### 2. 静态资源加载失败
- 检查文件权限
- 检查文件路径
- 检查 Nginx 配置

### 3. HTTPS 证书问题
- 检查证书有效期
- 重新申请证书
- 检查证书配置

## 更新部署

### 1. 备份当前版本
```bash
cp -r /var/www/html/novel-reader /var/www/html/novel-reader-backup
```

### 2. 上传新版本
替换除 `images` 目录外的所有文件

### 3. 重启服务
```bash
sudo systemctl reload nginx
```

## 联系支持
如遇到部署问题，请检查：
1. 服务器日志
2. 浏览器控制台错误
3. 网络连接状态