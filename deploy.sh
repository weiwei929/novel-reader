#!/bin/bash

# 小说阅读器 VPS 部署脚本
# 使用方法: chmod +x deploy.sh && ./deploy.sh

set -e  # 遇到错误立即退出

echo "🚀 开始部署小说阅读器到 VPS..."

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 配置变量
APP_NAME="novel-reader"
APP_DIR="/var/www/novel-reader"
DOMAIN_NAME="your-domain.com"  # 请修改为您的域名
NODE_VERSION="18"

# 检查是否为 root 用户 (允许 root 运行，但给出警告)
if [[ $EUID -eq 0 ]]; then
   echo -e "${YELLOW}⚠️  检测到以 root 用户运行，建议创建普通用户进行部署${NC}"
   echo -e "${YELLOW}⚠️  继续执行，但请确保了解安全风险...${NC}"
   sleep 3
fi

# 函数：打印步骤
print_step() {
    echo -e "${GREEN}📋 $1${NC}"
}

# 函数：打印警告
print_warning() {
    echo -e "${YELLOW}⚠️ $1${NC}"
}

# 函数：打印错误
print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# 检查系统
print_step "检查系统环境..."
if ! command -v curl &> /dev/null; then
    sudo apt update
    sudo apt install -y curl wget
fi

# 安装 Node.js
print_step "安装 Node.js ${NODE_VERSION}..."
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | sudo -E bash -
    sudo apt-get install -y nodejs
fi

echo "Node.js 版本: $(node --version)"
echo "NPM 版本: $(npm --version)"

# 安装 Nginx
print_step "安装 Nginx..."
if ! command -v nginx &> /dev/null; then
    sudo apt install -y nginx
    sudo systemctl start nginx
    sudo systemctl enable nginx
fi

# 安装 PM2
print_step "安装 PM2..."
if ! command -v pm2 &> /dev/null; then
    sudo npm install -g pm2
fi

# 创建应用目录
print_step "创建应用目录..."
sudo mkdir -p $APP_DIR
sudo chown -R $USER:$USER $APP_DIR

# 检查项目文件
if [ ! -f "backend/server.js" ]; then
    print_error "未找到 backend/server.js 文件，请确保在项目根目录运行此脚本"
    exit 1
fi

# 复制项目文件
print_step "复制项目文件..."
cp -r backend/ $APP_DIR/
cp -r frontend/ $APP_DIR/
cp ecosystem.config.js $APP_DIR/

# 修改 ecosystem.config.js 中的路径
sed -i "s|/var/www/novel-reader|$APP_DIR|g" $APP_DIR/ecosystem.config.js

# 安装后端依赖
print_step "安装后端依赖..."
cd $APP_DIR/backend
npm install --production

# 创建必要的目录
print_step "创建必要的目录..."
mkdir -p $APP_DIR/logs
mkdir -p $APP_DIR/backend/uploads

# 设置权限
print_step "设置文件权限..."
sudo chown -R www-data:www-data $APP_DIR
sudo chmod -R 755 $APP_DIR
sudo chmod -R 775 $APP_DIR/backend/uploads
sudo chmod -R 755 $APP_DIR/logs

# 启动后端服务
print_step "启动后端服务..."
cd $APP_DIR
pm2 delete $APP_NAME 2>/dev/null || true  # 删除可能存在的实例
pm2 start ecosystem.config.js

# 配置 Nginx
print_step "配置 Nginx..."
sudo tee /etc/nginx/sites-available/$APP_NAME > /dev/null << EOF
server {
    listen 80;
    server_name $DOMAIN_NAME;
    
    location / {
        root $APP_DIR/frontend;
        index index.html;
        try_files \$uri \$uri/ /index.html;
        
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }
    
    location /api/ {
        proxy_pass http://127.0.0.1:3000/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        
        add_header Access-Control-Allow-Origin *;
        add_header Access-Control-Allow-Methods 'GET, POST, DELETE, OPTIONS';
        add_header Access-Control-Allow-Headers 'Content-Type, Authorization';
        
        if (\$request_method = 'OPTIONS') {
            return 204;
        }
    }
    
    location /uploads/ {
        proxy_pass http://127.0.0.1:3000/uploads/;
        proxy_set_header Host \$host;
    }
    
    location /upload-image {
        proxy_pass http://127.0.0.1:3000/upload-image;
        proxy_set_header Host \$host;
    }
    
    location /delete-image {
        proxy_pass http://127.0.0.1:3000/delete-image;
        proxy_set_header Host \$host;
    }
    
    client_max_body_size 10M;
    
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    
    access_log /var/log/nginx/novel-reader.access.log;
    error_log /var/log/nginx/novel-reader.error.log;
}
EOF

# 启用站点
sudo ln -sf /etc/nginx/sites-available/$APP_NAME /etc/nginx/sites-enabled/

# 测试 Nginx 配置
if sudo nginx -t; then
    print_step "重新加载 Nginx..."
    sudo systemctl reload nginx
else
    print_error "Nginx 配置测试失败"
    exit 1
fi

# 配置防火墙
print_step "配置防火墙..."
sudo ufw --force enable 2>/dev/null || true
sudo ufw allow 22/tcp 2>/dev/null || true
sudo ufw allow 80/tcp 2>/dev/null || true
sudo ufw allow 443/tcp 2>/dev/null || true

# 设置 PM2 开机自启
print_step "设置开机自启..."
pm2 save
pm2 startup systemd -u $USER --hp /home/$USER 2>/dev/null || true

# 检查服务状态
print_step "检查服务状态..."
echo "PM2 状态:"
pm2 status

echo "Nginx 状态:"
sudo systemctl status nginx --no-pager -l

print_step "部署完成！🎉"

echo ""
echo -e "${GREEN}✅ 部署成功！${NC}"
echo ""
echo "📋 部署信息:"
echo "   - 应用目录: $APP_DIR"
echo "   - 后端服务: http://localhost:3000"
echo "   - 前端服务: http://$DOMAIN_NAME"
echo "   - 日志目录: $APP_DIR/logs"
echo "   - 图片目录: $APP_DIR/backend/uploads"
echo ""
echo "🔧 常用命令:"
echo "   - 查看后端日志: pm2 logs $APP_NAME"
echo "   - 重启后端: pm2 restart $APP_NAME"
echo "   - 查看 Nginx 日志: sudo tail -f /var/log/nginx/novel-reader.error.log"
echo ""
echo "🔒 后续步骤:"
echo "   1. 配置域名 DNS 解析到此服务器"
echo "   2. 安装 SSL 证书: sudo certbot --nginx -d $DOMAIN_NAME"
echo "   3. 测试网站功能: http://$DOMAIN_NAME"
echo ""
print_warning "请记得修改 deploy.sh 中的 DOMAIN_NAME 变量为您的实际域名！"
