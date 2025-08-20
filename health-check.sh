#!/bin/bash

# 小说阅读器健康检查脚本
# 用于监控应用状态和自动重启

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# 配置
APP_NAME="novel-reader-api"
BACKEND_URL="http://127.0.0.1:3000"
FRONTEND_URL="http://localhost"
LOG_FILE="/var/log/novel-reader-health.log"
MAX_RESTARTS=3
RESTART_COUNT_FILE="/tmp/novel-reader-restart-count"

# 日志函数
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a $LOG_FILE
}

# 检查后端服务
check_backend() {
    if pm2 describe $APP_NAME > /dev/null 2>&1; then
        local status=$(pm2 describe $APP_NAME | grep "status" | awk '{print $4}')
        if [ "$status" = "online" ]; then
            return 0
        else
            return 1
        fi
    else
        return 1
    fi
}

# 检查后端 HTTP 响应
check_backend_http() {
    local response=$(curl -s -o /dev/null -w "%{http_code}" $BACKEND_URL --max-time 10)
    if [ "$response" = "200" ] || [ "$response" = "404" ]; then
        return 0
    else
        return 1
    fi
}

# 检查前端服务
check_frontend() {
    local response=$(curl -s -o /dev/null -w "%{http_code}" $FRONTEND_URL --max-time 10)
    if [ "$response" = "200" ]; then
        return 0
    else
        return 1
    fi
}

# 检查数据库文件
check_database() {
    local db_file="/var/www/novel-reader/backend/database.db"
    if [ -f "$db_file" ] && [ -r "$db_file" ]; then
        return 0
    else
        return 1
    fi
}

# 检查上传目录
check_uploads() {
    local uploads_dir="/var/www/novel-reader/backend/uploads"
    if [ -d "$uploads_dir" ] && [ -w "$uploads_dir" ]; then
        return 0
    else
        return 1
    fi
}

# 重启后端服务
restart_backend() {
    log "⚠️ 重启后端服务..."
    pm2 restart $APP_NAME
    sleep 5
    
    if check_backend; then
        log "✅ 后端服务重启成功"
        return 0
    else
        log "❌ 后端服务重启失败"
        return 1
    fi
}

# 重启 Nginx
restart_nginx() {
    log "⚠️ 重启 Nginx..."
    sudo systemctl restart nginx
    sleep 3
    
    if sudo systemctl is-active nginx > /dev/null; then
        log "✅ Nginx 重启成功"
        return 0
    else
        log "❌ Nginx 重启失败"
        return 1
    fi
}

# 获取重启次数
get_restart_count() {
    if [ -f "$RESTART_COUNT_FILE" ]; then
        cat $RESTART_COUNT_FILE
    else
        echo 0
    fi
}

# 设置重启次数
set_restart_count() {
    echo $1 > $RESTART_COUNT_FILE
}

# 重置重启次数
reset_restart_count() {
    rm -f $RESTART_COUNT_FILE
}

# 发送告警 (可集成邮件、微信等)
send_alert() {
    local message="$1"
    log "🚨 告警: $message"
    
    # 这里可以添加邮件或其他通知方式
    # echo "$message" | mail -s "小说阅读器告警" admin@example.com
}

# 主检查函数
main_check() {
    local errors=0
    local warnings=0
    
    log "🔍 开始健康检查..."
    
    # 检查后端进程
    if ! check_backend; then
        log "❌ 后端进程异常"
        errors=$((errors + 1))
    else
        log "✅ 后端进程正常"
    fi
    
    # 检查后端 HTTP
    if ! check_backend_http; then
        log "❌ 后端 HTTP 响应异常"
        errors=$((errors + 1))
    else
        log "✅ 后端 HTTP 响应正常"
    fi
    
    # 检查前端
    if ! check_frontend; then
        log "⚠️ 前端响应异常"
        warnings=$((warnings + 1))
    else
        log "✅ 前端响应正常"
    fi
    
    # 检查数据库
    if ! check_database; then
        log "❌ 数据库文件异常"
        errors=$((errors + 1))
    else
        log "✅ 数据库文件正常"
    fi
    
    # 检查上传目录
    if ! check_uploads; then
        log "⚠️ 上传目录异常"
        warnings=$((warnings + 1))
    else
        log "✅ 上传目录正常"
    fi
    
    # 处理错误
    if [ $errors -gt 0 ]; then
        local restart_count=$(get_restart_count)
        
        if [ $restart_count -lt $MAX_RESTARTS ]; then
            restart_count=$((restart_count + 1))
            set_restart_count $restart_count
            
            log "⚠️ 发现 $errors 个错误，尝试重启服务 (第 $restart_count/$MAX_RESTARTS 次)"
            
            if ! check_backend || ! check_backend_http; then
                restart_backend
            fi
            
            if ! check_frontend; then
                restart_nginx
            fi
        else
            send_alert "小说阅读器重启次数达到上限 ($MAX_RESTARTS)，请人工介入"
        fi
    else
        # 没有错误，重置重启计数
        reset_restart_count
        log "✅ 所有检查通过"
    fi
    
    if [ $warnings -gt 0 ]; then
        log "⚠️ 发现 $warnings 个警告"
    fi
    
    log "🔍 健康检查完成"
    echo ""
}

# 显示系统信息
show_system_info() {
    log "📊 系统信息:"
    log "   CPU 使用率: $(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | cut -d'%' -f1)%"
    log "   内存使用率: $(free | grep Mem | awk '{printf("%.1f%%", $3/$2 * 100.0)}')"
    log "   磁盘使用率: $(df -h / | awk 'NR==2{print $5}')"
    log "   上传目录大小: $(du -sh /var/www/novel-reader/backend/uploads/ 2>/dev/null | cut -f1 || echo "未知")"
}

# 清理日志
cleanup_logs() {
    # 保留最近 30 天的日志
    find /var/log -name "*novel-reader*" -type f -mtime +30 -delete 2>/dev/null || true
    
    # 如果日志文件太大，截断它
    if [ -f "$LOG_FILE" ] && [ $(stat -c%s "$LOG_FILE") -gt 10485760 ]; then  # 10MB
        tail -n 1000 "$LOG_FILE" > "${LOG_FILE}.tmp"
        mv "${LOG_FILE}.tmp" "$LOG_FILE"
        log "📝 日志文件已截断"
    fi
}

# 显示帮助
show_help() {
    echo "用法: $0 [选项]"
    echo ""
    echo "选项:"
    echo "  check     执行健康检查 (默认)"
    echo "  info      显示系统信息"
    echo "  restart   重启所有服务"
    echo "  status    显示服务状态"
    echo "  cleanup   清理日志文件"
    echo "  help      显示此帮助"
}

# 显示服务状态
show_status() {
    echo "📋 服务状态:"
    echo ""
    echo "PM2 进程:"
    pm2 status
    echo ""
    echo "Nginx 状态:"
    sudo systemctl status nginx --no-pager -l
    echo ""
    echo "磁盘使用:"
    df -h
}

# 重启所有服务
restart_all() {
    log "🔄 重启所有服务..."
    restart_backend
    restart_nginx
    log "🔄 服务重启完成"
}

# 主程序
case "${1:-check}" in
    "check")
        cleanup_logs
        main_check
        ;;
    "info")
        show_system_info
        ;;
    "restart")
        restart_all
        ;;
    "status")
        show_status
        ;;
    "cleanup")
        cleanup_logs
        log "🧹 日志清理完成"
        ;;
    "help")
        show_help
        ;;
    *)
        echo "未知选项: $1"
        show_help
        exit 1
        ;;
esac
