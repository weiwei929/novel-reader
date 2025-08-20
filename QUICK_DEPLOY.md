# 🚀 快速部署指南

## 方法一：自动部署脚本 (推荐)

### 1. 上传项目到服务器
```bash
# 在本地打包项目
tar -czf novel-reader.tar.gz backend/ frontend/ ecosystem.config.js nginx.conf deploy.sh

# 上传到服务器
scp novel-reader.tar.gz user@your-server:~/

# 登录服务器并解压
ssh user@your-server
tar -xzf novel-reader.tar.gz
cd novel-reader/
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
./deploy.sh
```

脚本会自动完成：
- ✅ 安装 Node.js、Nginx、PM2
- ✅ 配置应用目录和权限
- ✅ 启动后端服务
- ✅ 配置 Nginx 反向代理
- ✅ 设置防火墙和开机自启

## 方法二：手动部署

### 1. 环境准备
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

# 启用站点
sudo ln -s /etc/nginx/sites-available/novel-reader /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
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

## 验证部署

### 检查服务状态
```bash
# 检查后端服务
pm2 status

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
