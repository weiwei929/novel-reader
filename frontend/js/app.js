import { FileManager } from './fileManager.js';
import { ImageManager } from './imageManager.js';

class ReaderApp {
    showToast(message, type = 'info') {
        const toastContainer = document.getElementById('toast-container');
        const toast = document.createElement('div');
        const typeClasses = {
            success: 'alert-success',
            error: 'alert-error',
            warning: 'alert-warning',
            info: 'alert-info'
        };
        toast.className = `alert ${typeClasses[type]} mb-2 toast-notification`;
        toast.innerHTML = `<span>${message}</span>`;
        toastContainer.appendChild(toast);
        setTimeout(() => {
            toast.remove();
        }, 3000);
    }
    saveReadingProgress() {
        if (this.currentNovel) {
            this.currentNovel.lastReadChapter = this.currentChapterIndex;
            this.fileManager.saveToStorage(this.currentNovel);
        }
    }
    updateReadingProgress() {
        const progress = ((this.currentChapterIndex + 1) / this.currentNovel.chapters.length) * 100;
        document.getElementById('reading-progress').value = progress;
        document.getElementById('progress-text').textContent = `${Math.round(progress)}%`;
        document.getElementById('novel-progress').textContent = `第 ${this.currentChapterIndex + 1} / ${this.currentNovel.chapters.length} 章`;
    }
    constructor() {
        this.fileManager = new FileManager();
        this.imageManager = new ImageManager();
        this.currentNovel = null;
        this.currentChapterIndex = 0;
        this.settings = this.loadSettings();
        this.deleteTarget = null;
        this.contextMenu = null;
        this.contextMenuTarget = null;
        this.cursorPosition = null;
        this.viewMode = 'grid'; // 总览页面视图模式
    }

    loadSettings() {
        const defaultSettings = {
            theme: 'light',
            fontSize: 16,
            lineHeight: 1.6,
            currentNovelId: null,
            currentChapterIndex: 0
        };
        try {
            const saved = localStorage.getItem('readerSettings');
            return saved ? { ...defaultSettings, ...JSON.parse(saved) } : defaultSettings;
        } catch {
            return defaultSettings;
        }
    }

    async init() {
        this.initEventListeners();
        this.initContextMenu();
        this.initImageModal();
        this.initDragAndDrop();
        this.applyTheme(this.settings.theme);
        this.loadNovels();
        this.showPage('home');
        
        // 预加载示例小说
        await this.preloadSampleNovel();
    }

    async preloadSampleNovel() {
        const novels = this.fileManager.loadFromStorage();
        const sampleNovel = novels.find(novel => novel.title === '春天的故事');
        
        if (!sampleNovel) {
            // 创建示例小说数据
            const sampleContent = `# 春天的故事
作者：方鸿渐

## 第一章 新的开始

春天来了，万物复苏。在这个充满希望的季节里，我开始了新的人生旅程。

作为一名刚刚毕业的医学生，我怀着忐忑不安的心情走进了市人民医院的大门。这里将是我实现理想、服务患者的地方。

医院的走廊里弥漫着消毒水的味道，白衣天使们匆忙地穿梭着。我深深地吸了一口气，告诉自己：这就是我要奋斗的地方。

## 第二章 初入职场

第一天上班，我被分配到了儿科。科室主任是一位和蔼可亲的老医生，他耐心地向我介绍了科室的情况和工作流程。

"做医生，最重要的是要有一颗仁爱之心。"主任语重心长地对我说，"每一个病人都是我们的责任，每一个生命都值得我们全力以赴。"

我认真地点头，将这句话深深地记在心里。

## 第三章 第一个病人

我永远不会忘记我的第一个病人——一个只有三岁的小女孩。她因为高烧不退被父母送到了医院。

看着小女孩痛苦的表情，我的心都要碎了。我仔细地为她检查，认真地分析病情，最终确定了治疗方案。

经过三天的精心治疗，小女孩终于退烧了。当她睁开明亮的眼睛，甜甜地叫我"医生叔叔"的时候，我感到了前所未有的成就感。

## 第四章 成长的足迹

随着时间的推移，我在医院里逐渐成长。从一个青涩的实习生，到能够独当一面的住院医师，每一步都充满了挑战和收获。

我学会了如何与患者沟通，如何安慰焦虑的家属，如何在紧急情况下保持冷静。这些经历让我变得更加成熟和专业。

## 第五章 春天的希望

又是一个春天，我已经在这家医院工作了五年。回首往昔，我为自己的成长感到骄傲，也为能够帮助那么多患者感到欣慰。

医学是一门充满挑战的学科，但也是一门充满希望的学科。每当看到患者康复出院时的笑容，我就知道，我选择了一条正确的道路。

春天的故事还在继续，我的医者之路也将继续前行。无论遇到什么困难，我都会坚持初心，用自己的专业知识和爱心，为更多的患者带去健康和希望。`;

            const novelData = this.fileManager.parseFileByType(sampleContent, '.md');
            novelData.title = '春天的故事';
            novelData.author = '方鸿渐';
            this.fileManager.saveToStorage(novelData);
            this.showToast('已预加载示例小说《春天的故事》', 'success');
        }
    }

    initEventListeners() {
        // 导航事件
        document.getElementById('nav-home')?.addEventListener('click', () => this.showPage('home'));
        document.getElementById('nav-home-desktop')?.addEventListener('click', () => this.showPage('home'));
        document.getElementById('nav-reader')?.addEventListener('click', () => this.showPage('reader'));
        document.getElementById('nav-reader-desktop')?.addEventListener('click', () => this.showPage('reader'));
        document.getElementById('nav-overview')?.addEventListener('click', () => this.showPage('overview'));
        document.getElementById('nav-overview-desktop')?.addEventListener('click', () => this.showPage('overview'));
        document.getElementById('nav-manage')?.addEventListener('click', () => this.showPage('manage'));
        document.getElementById('nav-manage-desktop')?.addEventListener('click', () => this.showPage('manage'));

        // 主题切换
        document.getElementById('theme-light')?.addEventListener('click', () => this.switchTheme('light'));
        document.getElementById('theme-dark')?.addEventListener('click', () => this.switchTheme('dark'));

        // 文件上传
        document.getElementById('upload-btn')?.addEventListener('click', () => {
            document.getElementById('file-input').click();
        });

        document.getElementById('file-input')?.addEventListener('change', (e) => {
            const importBtn = document.getElementById('import-btn');
            importBtn.disabled = !e.target.files.length;
        });

        document.getElementById('import-btn')?.addEventListener('click', () => this.importFile());

        // 章节导航
        document.getElementById('prev-chapter')?.addEventListener('click', () => this.prevChapter());
        document.getElementById('next-chapter')?.addEventListener('click', () => this.nextChapter());

        // 总览页面
        document.getElementById('show-overview-btn')?.addEventListener('click', () => this.showPage('overview'));
        document.getElementById('overview-back-btn')?.addEventListener('click', () => this.showPage('reader'));
        document.getElementById('goto-home-btn')?.addEventListener('click', () => this.showPage('home'));
        document.getElementById('view-grid')?.addEventListener('click', () => this.setViewMode('grid'));
        document.getElementById('view-list')?.addEventListener('click', () => this.setViewMode('list'));

    // 已禁用章节顶部配图相关按钮和事件

        // 删除确认
        document.getElementById('confirm-delete')?.addEventListener('click', () => this.confirmDelete());
        document.getElementById('cancel-delete')?.addEventListener('click', () => this.cancelDelete());

        // 键盘快捷键
        document.addEventListener('keydown', (e) => {
            if (!this.currentNovel) return;
            
            switch(e.key) {
                case 'ArrowLeft':
                    e.preventDefault();
                    this.prevChapter();
                    break;
                case 'ArrowRight':
                    e.preventDefault();
                    this.nextChapter();
                    break;
            }
        });

        // 点击其他地方隐藏右键菜单
        document.addEventListener('click', () => this.hideContextMenu());
    }

    initContextMenu() {
        this.contextMenu = document.getElementById('context-menu');
        
        // 右键菜单事件
        document.getElementById('context-insert-image')?.addEventListener('click', () => {
            this.hideContextMenu();
            this.showImageModal();
        });

        document.getElementById('context-copy-text')?.addEventListener('click', () => {
            this.copySelectedText();
            this.hideContextMenu();
        });

        document.getElementById('context-bookmark')?.addEventListener('click', () => {
            this.addBookmark();
            this.hideContextMenu();
        });

        // 初始绑定上下文菜单事件
        this.bindContextMenuEvents();
    }

    bindContextMenuEvents() {
        // 移除旧的事件监听器（如果存在）
        const chapterContent = document.getElementById('chapter-content');
        if (chapterContent) {
            // 创建新的事件监听器
            chapterContent.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                this.showContextMenu(e);
            });
        }
    }

    initImageModal() {
        const modal = document.getElementById('image-insert-modal');
        const modalImageInput = document.getElementById('modal-image-input');
        const imagePreview = document.getElementById('image-preview');
        const previewImage = document.getElementById('preview-image');
        const confirmBtn = document.getElementById('insert-image-confirm');
        const cancelBtn = document.getElementById('insert-image-cancel');

        // 图片选择预览
        modalImageInput?.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    previewImage.src = e.target.result;
                    imagePreview.classList.remove('hidden');
                    confirmBtn.disabled = false;
                };
                reader.readAsDataURL(file);
            } else {
                imagePreview.classList.add('hidden');
                confirmBtn.disabled = true;
            }
        });

        // 确认插入
        confirmBtn?.addEventListener('click', () => {
            const file = modalImageInput.files[0];
            const caption = document.getElementById('image-caption').value;
            if (file) {
                this.insertImageAtCursor(file, caption);
                this.closeImageModal();
            }
        });

        // 取消
        cancelBtn?.addEventListener('click', () => {
            this.closeImageModal();
        });
    }

    initDragAndDrop() {
        const chapterContent = document.getElementById('chapter-content');
        if (chapterContent) {
            this.imageManager.initDragAndDrop(chapterContent);
        }
    }

    showImageModal() {
        const modal = document.getElementById('image-insert-modal');
        modal.showModal();
    }

    closeImageModal() {
        const modal = document.getElementById('image-insert-modal');
        const modalImageInput = document.getElementById('modal-image-input');
        const imagePreview = document.getElementById('image-preview');
        const confirmBtn = document.getElementById('insert-image-confirm');
        const captionInput = document.getElementById('image-caption');

        modal.close();
        modalImageInput.value = '';
        captionInput.value = '';
        imagePreview.classList.add('hidden');
        confirmBtn.disabled = true;
    }

    async insertImageAtCursor(file, caption = '') {
        try {
            // 上传图片，获取图片 URL
            const imageUrl = await this.imageManager.uploadImage(file);
            // 构造 markdown 图片语法
            const markdown = `![${caption || '配图'}](${imageUrl})`;
            // 在光标处插入 markdown 到章节内容
            this.insertMarkdownAtCursor(markdown);
            // 持久化章节内容
            this.saveChapterContent();
            this.showToast('图片插入成功', 'success');
        } catch (error) {
            console.error('插入图片失败:', error);
            this.showToast('图片插入失败: ' + error.message, 'error');
        }
    }

    showContextMenu(event) {
        if (!this.currentNovel) return;

        this.contextMenu.style.left = event.pageX + 'px';
        this.contextMenu.style.top = event.pageY + 'px';
        this.contextMenu.classList.remove('hidden');
        // 记录当前光标位置
        const selection = window.getSelection();
        if (selection.rangeCount > 0) {
            this.cursorPosition = selection.getRangeAt(0);
        } else {
            this.cursorPosition = null;
        }
        // 记录当前章节内容节点
        this.chapterContentElement = document.getElementById('chapter-content');
    }

    // 在光标处插入 markdown 到章节内容
    insertMarkdownAtCursor(markdown) {
        // 优化：如果有光标位置，插入到对应文本位置，否则追加到末尾
        let content = this.currentNovel.chapters[this.currentChapterIndex].content || '';
        if (this.cursorPosition && this.chapterContentElement) {
            // 由于章节内容是 markdown，无法直接定位 DOM 光标，暂采用追加逻辑
            content += '\n' + markdown + '\n';
        } else {
            content += '\n' + markdown + '\n';
        }
        this.currentNovel.chapters[this.currentChapterIndex].content = content;
        this.loadChapter(this.currentChapterIndex);
        return;
    }

    // 持久化章节内容
    saveChapterContent() {
        try {
            this.fileManager.saveToStorage(this.currentNovel);
        } catch (error) {
            this.showToast('保存失败: ' + error.message, 'error');
        }
        return;
    // ...existing code...
    }
    hideContextMenu() {
        this.contextMenu?.classList.add('hidden');
        this.contextMenuTarget = null;
        this.cursorPosition = null;
    }

    copySelectedText() {
        const selection = window.getSelection();
        if (selection.toString()) {
            navigator.clipboard.writeText(selection.toString()).then(() => {
                this.showToast('文本已复制到剪贴板', 'success');
            }).catch(() => {
                this.showToast('复制失败', 'error');
            });
        } else {
            this.showToast('请先选择要复制的文本', 'warning');
        }
    }

    addBookmark() {
        if (!this.currentNovel) return;
        
        // 简单的书签功能，保存当前章节
        const bookmarkData = {
            novelId: this.currentNovel.id,
            chapterIndex: this.currentChapterIndex,
            timestamp: new Date().toLocaleString()
        };
        
        const bookmarks = JSON.parse(localStorage.getItem('bookmarks') || '[]');
        bookmarks.push(bookmarkData);
        localStorage.setItem('bookmarks', JSON.stringify(bookmarks));
        
        this.showToast('书签已添加', 'success');
    }

    showLoading() {
        const loading = document.getElementById('loading');
        if (loading) {
            loading.classList.remove('hidden');
        }
    }

    hideLoading() {
        const loading = document.getElementById('loading');
        if (loading) {
            loading.classList.add('hidden');
        }
    }

    handleKeyboard(event) {
        if (!this.currentNovel) return;

        switch(event.key) {
            case 'ArrowLeft':
                event.preventDefault();
                this.prevChapter();
                break;
            case 'ArrowRight':
                event.preventDefault();
                this.nextChapter();
                break;
        }
    }

    loadManagePage() {
        const novels = this.fileManager.loadFromStorage();
        const manageList = document.getElementById('manage-list');

        if (!manageList) return;

        if (novels.length === 0) {
            manageList.innerHTML = `
                <div class="text-center py-8 text-base-content/60">
                    <div class="text-4xl mb-2">📚</div>
                    <p>暂无小说需要管理</p>
                </div>
            `;
            return;
        }

        manageList.innerHTML = novels.map(novel => `
            <div class="card bg-base-100 shadow-md">
                <div class="card-body">
                    <div class="flex justify-between items-start">
                        <div>
                            <h3 class="card-title">${novel.title}</h3>
                            <p class="text-base-content/60">作者：${novel.author}</p>
                            <p class="text-sm text-base-content/60 mt-1">
                                ${novel.chapters.length} 章节 | 
                                创建时间：${new Date(novel.createdAt).toLocaleDateString()}
                            </p>
                        </div>
                        <div class="card-actions">
                            <button class="btn btn-sm btn-error" onclick="app.deleteNovel('${novel.id}')">
                                🗑️删除
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `).join('');
    }

    deleteNovel(novelId) {
        this.deleteTarget = novelId;
        const modal = document.getElementById('delete-modal');
        if (modal) {
            modal.showModal();
        }
    }

    confirmDelete() {
        if (this.deleteTarget) {
            this.fileManager.deleteNovel(this.deleteTarget);
            this.showToast('小说已删除', 'success');
            this.loadManagePage();
            this.loadNovels();
            
            // 如果删除的是当前阅读的小说，清空当前状态
            if (this.currentNovel && this.currentNovel.id === this.deleteTarget) {
                this.currentNovel = null;
                this.currentChapterIndex = 0;
            }
        }
        
        const modal = document.getElementById('delete-modal');
        if (modal) {
            modal.close();
        }
        this.deleteTarget = null;
    }

    cancelDelete() {
        const modal = document.getElementById('delete-modal');
        if (modal) {
            modal.close();
        }
        this.deleteTarget = null;
    }

    prevChapter() {
        if (this.currentChapterIndex > 0) {
            this.loadChapter(this.currentChapterIndex - 1);
        }
    }

    nextChapter() {
        if (this.currentChapterIndex < this.currentNovel.chapters.length - 1) {
            this.loadChapter(this.currentChapterIndex + 1);
        }
    }

    saveSettings() {
        localStorage.setItem('readerSettings', JSON.stringify(this.settings));
    }

    setViewMode(mode) {
        this.viewMode = mode;
        this.loadOverviewPage();
    }

    showPage(pageName) {
        // 隐藏所有页面
        document.querySelectorAll('.page-content').forEach(page => {
            page.classList.add('hidden');
        });

        // 显示目标页面
        document.getElementById(`${pageName}-page`).classList.remove('hidden');

        // 更新导航状态
        document.querySelectorAll('.navbar .menu a').forEach(link => {
            link.classList.remove('active');
        });

        const activeLinks = document.querySelectorAll(`#nav-${pageName}, #nav-${pageName}-desktop`);
        activeLinks.forEach(link => link.classList.add('active'));

        // 页面特定逻辑
        if (pageName === 'home') {
            this.loadNovels();
        } else if (pageName === 'reader') {
            this.loadReader();
        } else if (pageName === 'overview') {
            this.loadOverviewPage();
        } else if (pageName === 'manage') {
            this.loadManagePage();
        }
    }

    loadOverviewPage() {
        const container = document.getElementById('chapter-cards-container');
        const emptyState = document.getElementById('overview-empty');
        const subtitle = document.getElementById('overview-subtitle');

        if (!this.currentNovel) {
            container.innerHTML = '';
            emptyState.classList.remove('hidden');
            subtitle.textContent = '选择小说查看章节总览';
            return;
        }

        emptyState.classList.add('hidden');
        subtitle.textContent = `《${this.currentNovel.title}》- ${this.currentNovel.chapters.length} 章节`;

        // 设置容器样式
        if (this.viewMode === 'list') {
            container.className = 'space-y-4';
        } else {
            container.className = 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6';
        }

        // 生成章节卡片
        container.innerHTML = this.currentNovel.chapters.map((chapter, index) => {
            const wordCount = chapter.content.length;
            const isRead = index <= this.currentChapterIndex;
            const progress = isRead ? 100 : 0;

            if (this.viewMode === 'list') {
                return `
                    <div class="card card-side bg-base-100 shadow-md hover:shadow-lg transition-shadow cursor-pointer chapter-card ${isRead ? 'read' : 'unread'}" 
                         onclick="app.loadChapterFromOverview(${index})">
                        <div class="card-body py-4">
                            <div class="flex items-center justify-between">
                                <div class="flex-1">
                                    <h3 class="card-title text-lg">${chapter.title}</h3>
                                    <p class="text-sm text-base-content/60">${wordCount} 字</p>
                                </div>
                                <div class="flex items-center gap-4">
                                    <div class="text-right">
                                        <div class="text-sm ${isRead ? 'text-success' : 'text-base-content/40'}">
                                            ${isRead ? '已读' : '未读'}
                                        </div>
                                        <progress class="progress progress-primary w-20 h-2" value="${progress}" max="100"></progress>
                                    </div>
                                    <div class="text-2xl ${isRead ? 'text-success' : 'text-base-content/20'}">
                                        ${isRead ? '✓' : '○'}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
            } else {
                return `
                    <div class="card bg-base-100 shadow-md hover:shadow-lg transition-shadow cursor-pointer chapter-card ${isRead ? 'read' : 'unread'}" 
                         onclick="app.loadChapterFromOverview(${index})">
                        <div class="card-body">
                            <div class="flex items-start justify-between mb-2">
                                <h3 class="card-title text-lg flex-1">${chapter.title}</h3>
                                <div class="text-2xl ${isRead ? 'text-success' : 'text-base-content/20'}">
                                    ${isRead ? '✓' : '○'}
                                </div>
                            </div>
                            <p class="text-sm text-base-content/60 mb-3">${wordCount} 字</p>
                            <div class="text-sm text-base-content/80 line-clamp-3 mb-4">
                                ${chapter.content.substring(0, 100)}...
                            </div>
                            <div class="card-actions justify-between items-center">
                                <span class="text-sm ${isRead ? 'text-success' : 'text-base-content/40'}">
                                    ${isRead ? '已读' : '未读'}
                                </span>
                                <progress class="progress progress-primary w-20 h-2" value="${progress}" max="100"></progress>
                            </div>
                        </div>
                    </div>
                `;
            }
        }).join('');
    }

    loadChapterFromOverview(chapterIndex) {
        this.currentChapterIndex = chapterIndex;
        this.showPage('reader');
        this.loadChapter(chapterIndex);
    }

    switchTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        this.settings.theme = theme;
        this.saveSettings();
    }

    applyTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
    }

    async importFile() {
        const fileInput = document.getElementById('file-input');
        const file = fileInput.files[0];
        
        if (!file) {
            this.showToast('请选择文件', 'warning');
            return;
        }

        // 显示加载指示器
        const loading = document.getElementById('loading');
        if (loading) loading.classList.remove('hidden');

        try {
            const novelData = await this.fileManager.uploadFile(file);
            this.fileManager.saveToStorage(novelData);
            this.showToast(`成功导入《${novelData.title}》`, 'success');
            this.loadNovels();
            
            // 清空文件输入
            fileInput.value = '';
            document.getElementById('import-btn').disabled = true;
        } catch (error) {
            console.error('导入失败:', error);
            this.showToast('文件导入失败: ' + error.message, 'error');
        } finally {
            // 隐藏加载指示器
            if (loading) loading.classList.add('hidden');
        }
    }

    loadNovels() {
        const novels = this.fileManager.loadFromStorage();
        const novelList = document.getElementById('novel-list');

        if (novels.length === 0) {
            novelList.innerHTML = `
                <div class="text-center py-8 text-base-content/60">
                    <div class="text-4xl mb-2">📚</div>
                    <p>暂无小说，请导入文件开始阅读</p>
                </div>
            `;
            return;
        }

        // 简化的列表布局，将阅读按钮改为浅灰色
        novelList.innerHTML = novels.map(novel => `
            <div class="flex items-center justify-between p-4 bg-base-200 rounded-lg hover:bg-base-300 transition-colors novel-list-item">
                <div class="flex-1">
                    <h3 class="font-semibold text-lg">${novel.title}</h3>
                    <p class="text-sm text-base-content/60">作者：${novel.author} | ${novel.chapters.length} 章节</p>
                    <div class="flex items-center gap-2 mt-2">
                        <progress class="progress progress-primary w-32 h-2" 
                                  value="${novel.lastReadChapter}" 
                                  max="${novel.chapters.length}"></progress>
                        <span class="text-xs text-base-content/60">
                            ${Math.round((novel.lastReadChapter / novel.chapters.length) * 100)}%
                        </span>
                    </div>
                </div>
                <div class="flex gap-2">
                    <button class="btn btn-sm btn-read-novel" onclick="app.readNovel('${novel.id}')">
                        📖 阅读
                    </button>
                    <button class="btn btn-sm btn-outline" onclick="app.showNovelOverview('${novel.id}')">
                        📋 总览
                    </button>
                </div>
            </div>
        `).join('');
    }

    showNovelOverview(novelId) {
        const novels = this.fileManager.loadFromStorage();
        this.currentNovel = novels.find(novel => novel.id === novelId);
        this.showPage('overview');
    }

    readNovel(novelId) {
        const novels = this.fileManager.loadFromStorage();
        this.currentNovel = novels.find(novel => novel.id === novelId);
        
        if (this.currentNovel) {
            this.currentChapterIndex = this.currentNovel.lastReadChapter || 0;
            this.showPage('reader');
            this.loadReader();
        }
    }

    loadReader() {
        if (!this.currentNovel) {
            document.getElementById('novel-header').classList.add('hidden');
            return;
        }

        // 显示小说信息
        const header = document.getElementById('novel-header');
        const title = document.getElementById('novel-title');
        const author = document.getElementById('novel-author');
        const progress = document.getElementById('novel-progress');

        header.classList.remove('hidden');
        title.textContent = this.currentNovel.title;
        author.textContent = `作者：${this.currentNovel.author}`;
        progress.textContent = `第 ${this.currentChapterIndex + 1} / ${this.currentNovel.chapters.length} 章`;

        // 加载章节列表
        this.loadChapterList();
        
        // 加载当前章节
        this.loadChapter(this.currentChapterIndex);
    }

    loadChapterList() {
        const chapterList = document.getElementById('chapter-list');
        
        chapterList.innerHTML = this.currentNovel.chapters.map((chapter, index) => `
            <li>
                <a class="${index === this.currentChapterIndex ? 'active' : ''}" 
                   onclick="app.loadChapter(${index})">
                    ${chapter.title}
                </a>
            </li>
        `).join('');
    }

    loadChapter(index) {
        if (!this.currentNovel || index < 0 || index >= this.currentNovel.chapters.length) {
            return;
        }

        this.currentChapterIndex = index;
        const chapter = this.currentNovel.chapters[index];

        // 更新章节标题
        document.getElementById('chapter-title').textContent = chapter.title;

    // 更新章节内容，使用 markdownParser 解析 markdown
    const content = document.getElementById('chapter-content');
    content.innerHTML = this.fileManager.markdownParser.processMarkdownContent(chapter.content);

        // ...existing code...

        // 更新导航按钮
        document.getElementById('prev-chapter').disabled = index === 0;
        document.getElementById('next-chapter').disabled = index === this.currentNovel.chapters.length - 1;
        // 已禁用章节顶部配图功能，移除该方法
        // 更新阅读进度
        this.updateReadingProgress();

        // 已禁用章节配图上传功能，移除该方法

        // 保存阅读进度
        this.saveReadingProgress();
        // 已禁用章节配图移除功能，移除该方法
        
        // 重新绑定上下文菜单事件（因为内容已更新）
        this.bindContextMenuEvents();
    }

    formatChapterContent(content) {
        // 简单的内容格式化，忽略图片 URL 行，避免重复渲染
        return content
            .split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0)
            .filter(line => !/^https?:\/\/.+\.(jpg|jpeg|png|gif|webp)$/i.test(line))
            .map(line => {
                if (line.startsWith('#')) {
                    const level = line.match(/^#+/)[0].length;
                    const text = line.replace(/^#+\s*/, '');
                    return `<h${Math.min(level, 6)} class="text-${4-Math.min(level-1, 2)}xl font-bold mt-6 mb-4">${text}</h${Math.min(level, 6)}>`;
                } else {
                    return `<p class="mb-4">${line}</p>`;
                }
            })
            .join('');
    }

    // ...existing code...
        // ...existing code...

}

// 创建全局实例
var app = new ReaderApp();

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', function() {
    app.init();
});

// 导出到全局作用域供HTML调用
window.app = app;