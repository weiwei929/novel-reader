import { MarkdownParser } from './markdownParser.js';

class FileManager {
    constructor() {
        this.storageKey = 'novelReaderData';
        this.markdownParser = new MarkdownParser();
        this.supportedFormats = ['.txt', '.md'];
    }

    getSupportedFormats() {
        return this.supportedFormats;
    }

    async uploadFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = (e) => {
                try {
                    const content = e.target.result;
                    const fileExtension = this.getFileExtension(file.name);
                    const novelData = this.parseFileByType(content, fileExtension);
                    
                    // 如果没有从内容中提取到标题，使用文件名
                    if (novelData.title === '未知小说') {
                        novelData.title = this.extractTitleFromFilename(file.name);
                    }
                    
                    resolve(novelData);
                } catch (error) {
                    reject(new Error('文件解析失败: ' + error.message));
                }
            };

            reader.onerror = () => {
                reject(new Error('文件读取失败'));
            };

            reader.readAsText(file, 'UTF-8');
        });
    }

    getFileExtension(filename) {
        return filename.toLowerCase().substring(filename.lastIndexOf('.'));
    }

    parseFileByType(content, fileType) {
        switch (fileType) {
            case '.txt':
                return this.parseTextFile(content);
            case '.md':
                return this.parseMarkdownFile(content);
            default:
                throw new Error(`不支持的文件格式: ${fileType}`);
        }
    }

    parseMarkdownFile(content) {
        return this.markdownParser.parseMarkdown(content);
    }

    parseTextFile(content) {
        const lines = content.split('\n').map(line => line.trim()).filter(line => line);
        
        if (lines.length === 0) {
            throw new Error('文件内容为空');
        }

        const novelData = {
            id: this.generateId(),
            title: '未知小说',
            author: '未知作者',
            chapters: [],
            createdAt: new Date(),
            lastReadChapter: 0,
            fileType: 'txt'
        };

        // 提取标题和作者
        const titleMatch = lines[0].match(/^(.+?)(?:\s*作者[：:]\s*(.+))?$/);
        if (titleMatch) {
            novelData.title = titleMatch[1].trim();
            if (titleMatch[2]) {
                novelData.author = titleMatch[2].trim();
            }
        }

        // 查找作者信息
        for (let i = 0; i < Math.min(5, lines.length); i++) {
            const authorMatch = lines[i].match(/作者[：:]\s*(.+)/);
            if (authorMatch) {
                novelData.author = authorMatch[1].trim();
                break;
            }
        }

        // 解析章节
        this.parseChapters(lines, novelData);

        if (novelData.chapters.length === 0) {
            throw new Error('未找到有效章节');
        }

        return novelData;
    }

    parseChapters(lines, novelData) {
        let currentChapter = null;
        let chapterIndex = 0;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            
            // 检测章节标题
            if (this.isChapterTitle(line)) {
                // 保存上一章节
                if (currentChapter && currentChapter.content.trim()) {
                    novelData.chapters.push(currentChapter);
                }

                // 创建新章节
                currentChapter = {
                    id: this.generateId(),
                    title: this.cleanChapterTitle(line),
                    content: '',
                    index: chapterIndex++
                };
            } else if (currentChapter) {
                // 添加内容到当前章节
                if (currentChapter.content) {
                    currentChapter.content += '\n' + line;
                } else {
                    currentChapter.content = line;
                }
            }
        }

        // 保存最后一章
        if (currentChapter && currentChapter.content.trim()) {
            novelData.chapters.push(currentChapter);
        }

        // 如果没有找到章节标题，将整个内容作为一章
        if (novelData.chapters.length === 0) {
            const content = lines.slice(1).join('\n'); // 跳过标题行
            if (content.trim()) {
                novelData.chapters.push({
                    id: this.generateId(),
                    title: '正文',
                    content: content,
                    index: 0
                });
            }
        }
    }

    isChapterTitle(line) {
        // 匹配各种章节标题格式
        const patterns = [
            /^第[一二三四五六七八九十百千万\d]+章/,
            /^第[一二三四五六七八九十百千万\d]+回/,
            /^第[一二三四五六七八九十百千万\d]+节/,
            /^第[一二三四五六七八九十百千万\d]+部分/,
            /^第[一二三四五六七八九十百千万\d]+卷/,
            /^Chapter\s*\d+/i,
            /^\d+[.、]\s*.+/,
            /^[一二三四五六七八九十百千万]+[.、]\s*.+/,
            /^序章|^楔子|^前言|^后记|^尾声|^番外/
        ];

        return patterns.some(pattern => pattern.test(line.trim()));
    }

    cleanChapterTitle(title) {
        return title.trim()
            .replace(/^第/, '第')
            .replace(/章\s*$/, '章')
            .replace(/回\s*$/, '回')
            .replace(/节\s*$/, '节');
    }

    extractTitleFromFilename(filename) {
        return filename
            .replace(/\.[^/.]+$/, '') // 移除扩展名
            .replace(/^\d+[.、\-_\s]*/, '') // 移除开头的数字
            .trim() || '未知小说';
    }

    saveToStorage(novelData) {
        try {
            const existingData = this.loadFromStorage();
            
            // 检查是否已存在相同小说
            const existingIndex = existingData.findIndex(novel => 
                novel.title === novelData.title && novel.author === novelData.author
            );

            if (existingIndex !== -1) {
                // 更新现有小说
                existingData[existingIndex] = { ...existingData[existingIndex], ...novelData };
            } else {
                // 添加新小说
                existingData.push(novelData);
            }

            localStorage.setItem(this.storageKey, JSON.stringify(existingData));
        } catch (error) {
            throw new Error('保存失败: ' + error.message);
        }
    }

    loadFromStorage() {
        try {
            const data = localStorage.getItem(this.storageKey);
            return data ? JSON.parse(data) : [];
        } catch (error) {
            console.error('加载数据失败:', error);
            return [];
        }
    }

    deleteNovel(novelId) {
        try {
            const novels = this.loadFromStorage();
            const filteredNovels = novels.filter(novel => novel.id !== novelId);
            localStorage.setItem(this.storageKey, JSON.stringify(filteredNovels));
        } catch (error) {
            throw new Error('删除失败: ' + error.message);
        }
    }

    updateNovelProgress(novelId, chapterIndex) {
        try {
            const novels = this.loadFromStorage();
            const novel = novels.find(n => n.id === novelId);
            
            if (novel) {
                novel.lastReadChapter = chapterIndex;
                localStorage.setItem(this.storageKey, JSON.stringify(novels));
            }
        } catch (error) {
            console.error('更新进度失败:', error);
        }
    }

    exportNovel(novelId) {
        const novels = this.loadFromStorage();
        const novel = novels.find(n => n.id === novelId);
        
        if (!novel) {
            throw new Error('小说不存在');
        }

        let content;
        if (novel.fileType === 'md') {
            // 导出为Markdown格式
            content = [
                `# ${novel.title}`,
                `作者：${novel.author}`,
                '',
                ...novel.chapters.map(chapter => [
                    `## ${chapter.title}`,
                    '',
                    chapter.content,
                    ''
                ].join('\n'))
            ].join('\n');
        } else {
            // 导出为文本格式
            content = [
                novel.title,
                `作者：${novel.author}`,
                '',
                ...novel.chapters.map(chapter => [
                    chapter.title,
                    '',
                    chapter.content,
                    ''
                ].join('\n'))
            ].join('\n');
        }

        const fileExtension = novel.fileType === 'md' ? '.md' : '.txt';
        const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `${novel.title}${fileExtension}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    getStorageInfo() {
        try {
            const data = localStorage.getItem(this.storageKey);
            const sizeInBytes = new Blob([data || '']).size;
            const sizeInMB = (sizeInBytes / (1024 * 1024)).toFixed(2);
            
            return {
                novels: this.loadFromStorage().length,
                size: sizeInMB + ' MB'
            };
        } catch (error) {
            return {
                novels: 0,
                size: '0 MB'
            };
        }
    }

    clearAllData() {
        try {
            localStorage.removeItem(this.storageKey);
            return true;
        } catch (error) {
            throw new Error('清空数据失败: ' + error.message);
        }
    }

    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }
}

export { FileManager };