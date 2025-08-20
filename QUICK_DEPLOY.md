# 🚀 快速部署指南

## 📋 VPS 部署路径推荐

### 推荐部署路径
```bash
# 主要选择（推荐）
/var/www/novel-reader/

# 或者使用应用专用目录
/opt/novel-reader/
```

### 路径选择说明
| 路径 | 优势 | 适用场景 |
|------|------|----------|
| `/var/www/novel-reader/` | ✅ Web 应用标准位置<br>✅ Nginx 默认识别<br>✅ 权限管理简单 | **推荐使用** |
| `/opt/novel-reader/` | ✅ 第三方应用标准位置<br>✅ 系统级应用 | 企业环境 |
| `/home/username/novel-reader/` | ✅ 用户目录<br>❌ 权限复杂 | 开发测试 |

## 方法一：GitHub 克隆部署 (推荐)

### 1. 从 GitHub 克隆项目
```bash
# 切换到推荐目录
cd /var/www/

# 克隆项目
sudo git clone https://github.com/weiwei929/novel-reader.git
cd novel-reader

# 设置正确的权限
sudo chown -R www-data:www-data /var/www/novel-reader
sudo chmod -R 755 /var/www/novel-reader

# 给脚本执行权限
sudo chmod +x deploy.sh health-check.sh
```

### 2. 一键自动部署
```bash
# 运行自动部署脚本
sudo ./deploy.sh
```

## 方法二：文件上传部署

### 1. 上传项目到服务器
```bash
# 在本地打包项目
tar -czf novel-reader.tar.gz backend/ frontend/ ecosystem.config.js nginx.conf deploy.sh

# 上传到服务器
scp novel-reader.tar.gz user@your-server:~/

# 登录服务器并解压到推荐路径
ssh user@your-server
sudo mkdir -p /var/www/
sudo tar -xzf novel-reader.tar.gz -C /var/www/
sudo mv /var/www/novel-reader/ /var/www/novel-reader/
cd /var/www/novel-reader/
```

### 2. 修改配置
```bash
# 修改域名配置
nano deploy.sh
# 将 DOMAIN_NAME="your-domain.com" 改为你的实际域名
```

### 3. 运行部署脚本
```bash
chmod +x deploy.sh
sudo ./deploy.sh
```

脚本会自动完成：
- ✅ 安装 Node.js、Nginx、PM2
- ✅ 配置应用目录和权限
- ✅ 启动后端服务
- ✅ 配置 Nginx 反向代理
- ✅ 设置防火墙和开机自启

## 方法三：手动部署

### 1. 环境准备
```bash
# 更新系统
sudo apt update && sudo apt upgrade -y

# 安装必要软件
sudo apt install -y git nginx nodejs npm

# 切换到标准 Web 目录
cd /var/www/

# 克隆项目
sudo git clone https://github.com/weiwei929/novel-reader.git
cd novel-reader

# 设置权限
sudo chown -R www-data:www-data /var/www/novel-reader
sudo chmod +x deploy.sh health-check.sh
```

### 2. 环境配置
```bash
# 更新系统
sudo apt update && sudo apt upgrade -y

# 安装 Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# 安装 Nginx 和 PM2
sudo apt install nginx -y
sudo npm install -g pm2
```

### 2. 部署应用
```bash
# 创建目录
sudo mkdir -p /var/www/novel-reader
sudo chown -R $USER:$USER /var/www/novel-reader

# 复制文件
cp -r backend/ /var/www/novel-reader/
cp -r frontend/ /var/www/novel-reader/
cp ecosystem.config.js /var/www/novel-reader/

# 安装依赖
cd /var/www/novel-reader/backend
npm install --production

# 启动服务
cd /var/www/novel-reader
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

### 3. 配置 Nginx
```bash
# 复制配置文件
sudo cp nginx.conf /etc/nginx/sites-available/novel-reader

# 修改域名 (将 your-domain.com 改为实际域名)
sudo nano /etc/nginx/sites-available/novel-reader

## 📁 部署后目录结构

```
/var/www/novel-reader/
├── backend/                # 后端代码
│   ├── package.json       # 后端依赖配置
│   ├── server.js          # 主服务文件
│   └── uploads/           # 图片上传目录
├── frontend/              # 前端代码 (Nginx 指向这里)
│   ├── index.html         # 主页面
│   ├── css/style.css      # 样式文件
│   └── js/                # JavaScript 文件
├── deploy.sh              # 一键部署脚本
├── nginx.conf             # Nginx 配置文件
├── ecosystem.config.js    # PM2 进程管理配置
├── health-check.sh        # 健康检查脚本
└── README.md              # 项目文档
```

## SSL 证书配置

```bash
# 安装 Certbot
sudo apt install certbot python3-certbot-nginx -y

# 获取证书 (替换为你的域名)
sudo certbot --nginx -d your-domain.com

# 设置自动续期
sudo crontab -e
# 添加: 0 12 * * * /usr/bin/certbot renew --quiet
```

## 🔍 验证部署

### 检查服务状态
```bash
# 检查后端服务
pm2 status

# 查看进程日志
pm2 logs novel-reader

# 检查 Nginx 状态
sudo systemctl status nginx

# 运行健康检查
./health-check.sh
```

### 访问测试
```bash
# 测试后端 API
curl http://localhost:3000/health

# 测试前端页面
curl http://localhost/ 

# 如果配置了域名
curl http://your-domain.com/
```

## 📝 部署最佳实践

### 权限设置
```bash
# 确保正确的文件权限
sudo chown -R www-data:www-data /var/www/novel-reader
sudo chmod -R 755 /var/www/novel-reader
sudo chmod +x /var/www/novel-reader/deploy.sh
sudo chmod +x /var/www/novel-reader/health-check.sh
```

### 服务管理
```bash
# 启动所有服务
sudo systemctl enable nginx
sudo systemctl start nginx
pm2 startup  # 设置 PM2 开机自启
pm2 save     # 保存当前进程列表

# 重启服务
pm2 restart novel-reader
sudo systemctl reload nginx
```

### 更新部署
```bash
# 拉取最新代码
cd /var/www/novel-reader
sudo git pull origin master

# 重新安装依赖（如果需要）
cd backend
sudo npm install

# 重启服务
pm2 restart novel-reader
```

# 检查 Nginx
sudo systemctl status nginx

# 检查端口监听
sudo netstat -tlnp | grep :80
sudo netstat -tlnp | grep :3000
```

### 测试功能
1. 访问 `http://your-domain.com` (或 `https://your-domain.com`)
2. 测试小说导入功能
3. 测试图片上传功能
4. 检查章节阅读功能

## 常用维护命令

```bash
# 查看应用日志
pm2 logs novel-reader-api

# 重启应用
pm2 restart novel-reader-api

# 查看 Nginx 日志
sudo tail -f /var/log/nginx/novel-reader.error.log

# 备份数据库
cp /var/www/novel-reader/backend/database.db ~/backup/

# 监控磁盘使用
df -h
du -sh /var/www/novel-reader/backend/uploads/
```

## 故障排除

### 常见问题

1. **502 Bad Gateway**
   - 检查后端服务: `pm2 status`
   - 检查端口监听: `netstat -tlnp | grep :3000`

2. **图片上传失败**
   - 检查目录权限: `ls -la /var/www/novel-reader/backend/uploads/`
   - 检查磁盘空间: `df -h`

3. **SSL 证书问题**
   - 重新申请: `sudo certbot --nginx -d your-domain.com --force-renewal`
   - 检查证书状态: `sudo certbot certificates`

## 安全建议

```bash
# 配置防火墙
sudo ufw enable
sudo ufw allow 22,80,443/tcp

# 设置文件权限
sudo chown -R www-data:www-data /var/www/novel-reader/
sudo chmod -R 755 /var/www/novel-reader/
sudo chmod -R 775 /var/www/novel-reader/backend/uploads/
```

部署完成后，你的小说阅读器就可以在生产环境中运行了！🎉
