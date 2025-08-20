class MarkdownParser {
    constructor() {
        this.chapterPatterns = [
            /^#{1,3}\s+(.+)$/,  // # ## ### 标题
            /^第[一二三四五六七八九十百千万\d]+章\s*(.*)$/,
            /^第[一二三四五六七八九十百千万\d]+回\s*(.*)$/,
            /^第[一二三四五六七八九十百千万\d]+节\s*(.*)$/,
            /^Chapter\s*\d+\s*(.*)$/i,
            /^\d+[.、]\s*(.+)$/,
            /^序章|^楔子|^前言|^后记|^尾声|^番外/
        ];
    }

    parseMarkdown(content) {
        const lines = content.split('\n');
        const novelData = {
            id: this.generateId(),
            title: '未知小说',
            author: '未知作者',
            chapters: [],
            createdAt: new Date(),
            lastReadChapter: 0,
            fileType: 'md'
        };

        // 提取标题和作者信息
        this.extractMetadata(lines, novelData);
        
        // 解析章节
        this.parseChapters(lines, novelData);

        if (novelData.chapters.length === 0) {
            // 如果没有找到章节，将整个内容作为一章
            const processedContent = this.processMarkdownContent(content);
            novelData.chapters.push({
                id: this.generateId(),
                title: '正文',
                content: processedContent,
                index: 0
            });
        }

        return novelData;
    }

    extractMetadata(lines, novelData) {
        // 查找标题（通常在前几行）
        for (let i = 0; i < Math.min(10, lines.length); i++) {
            const line = lines[i].trim();
            
            // 检查是否是一级标题
            const titleMatch = line.match(/^#\s+(.+)$/);
            if (titleMatch && !this.isChapterTitle(line)) {
                novelData.title = titleMatch[1].trim();
                continue;
            }

            // 检查作者信息
            const authorMatch = line.match(/作者[：:]\s*(.+)/);
            if (authorMatch) {
                novelData.author = authorMatch[1].trim();
                continue;
            }

            // 检查YAML front matter
            if (line === '---' && i === 0) {
                const yamlEnd = lines.findIndex((l, idx) => idx > 0 && l.trim() === '---');
                if (yamlEnd > 0) {
                    this.parseYamlFrontMatter(lines.slice(1, yamlEnd), novelData);
                }
            }
        }
    }

    parseYamlFrontMatter(yamlLines, novelData) {
        yamlLines.forEach(line => {
            const match = line.match(/^(\w+):\s*(.+)$/);
            if (match) {
                const [, key, value] = match;
                switch (key.toLowerCase()) {
                    case 'title':
                        novelData.title = value.replace(/['"]/g, '');
                        break;
                    case 'author':
                        novelData.author = value.replace(/['"]/g, '');
                        break;
                }
            }
        });
    }

    parseChapters(lines, novelData) {
        let currentChapter = null;
        let chapterIndex = 0;
        let inYamlFrontMatter = false;
        let yamlEndFound = false;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            
            // 跳过YAML front matter
            if (i === 0 && line === '---') {
                inYamlFrontMatter = true;
                continue;
            }
            if (inYamlFrontMatter && line === '---') {
                inYamlFrontMatter = false;
                yamlEndFound = true;
                continue;
            }
            if (inYamlFrontMatter) {
                continue;
            }

            // 检测章节标题
            if (this.isChapterTitle(line)) {
                // 保存上一章节
                if (currentChapter && currentChapter.content.trim()) {
                    currentChapter.content = this.processMarkdownContent(currentChapter.content);
                    novelData.chapters.push(currentChapter);
                }

                // 创建新章节
                const title = this.extractChapterTitle(line);
                currentChapter = {
                    id: this.generateId(),
                    title: title,
                    content: '',
                    index: chapterIndex++
                };
            } else if (currentChapter) {
                // 添加内容到当前章节
                if (currentChapter.content) {
                    currentChapter.content += '\n' + lines[i];
                } else {
                    currentChapter.content = lines[i];
                }
            } else if (!yamlEndFound && line) {
                // 如果还没有章节但有内容，创建第一章
                currentChapter = {
                    id: this.generateId(),
                    title: '正文',
                    content: lines[i],
                    index: chapterIndex++
                };
            }
        }

        // 保存最后一章
        if (currentChapter && currentChapter.content.trim()) {
            currentChapter.content = this.processMarkdownContent(currentChapter.content);
            novelData.chapters.push(currentChapter);
        }
    }

    isChapterTitle(line) {
        return this.chapterPatterns.some(pattern => pattern.test(line.trim()));
    }

    extractChapterTitle(line) {
        const trimmed = line.trim();
        
        // 处理Markdown标题
        const mdMatch = trimmed.match(/^#{1,3}\s+(.+)$/);
        if (mdMatch) {
            return mdMatch[1].trim();
        }

        // 处理其他格式
        for (const pattern of this.chapterPatterns) {
            const match = trimmed.match(pattern);
            if (match) {
                return match[1] ? match[1].trim() : trimmed;
            }
        }

        return trimmed;
    }

    processMarkdownContent(content) {
        if (!content) return '';

        return content
            // 处理标题（但不是章节标题）
            .replace(/^#{4,6}\s+(.+)$/gm, '<h4>$1</h4>')
            // 处理粗体
            .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
            .replace(/__(.+?)__/g, '<strong>$1</strong>')
            // 处理斜体
            .replace(/\*(.+?)\*/g, '<em>$1</em>')
            .replace(/_(.+?)_/g, '<em>$1</em>')
            // 处理删除线
            .replace(/~~(.+?)~~/g, '<del>$1</del>')
            // 处理行内代码
            .replace(/`(.+?)`/g, '<code>$1</code>')
            // 处理图片（必须在链接之前处理）
            .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" class="max-w-full h-auto mx-auto rounded-lg shadow-md my-4">')
            // 处理链接
            .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>')
            // 处理引用
            .replace(/^>\s*(.+)$/gm, '<blockquote class="border-l-4 border-primary pl-4 italic my-4">$1</blockquote>')
            // 处理水平线
            .replace(/^---+$/gm, '<hr class="my-6">')
            // 处理列表（简单处理）
            .replace(/^\*\s+(.+)$/gm, '<li>$1</li>')
            .replace(/^\-\s+(.+)$/gm, '<li>$1</li>')
            .replace(/^\d+\.\s+(.+)$/gm, '<li>$1</li>')
            // 包装连续的列表项
            .replace(/(<li>.*<\/li>)/gs, '<ul class="list-disc list-inside my-4">$1</ul>')
            // 处理段落
            .split('\n')
            .map(line => {
                const trimmed = line.trim();
                if (!trimmed) return '';
                if (trimmed.startsWith('<')) return trimmed;
                return `<p class="mb-4">${trimmed}</p>`;
            })
            .filter(line => line)
            .join('');
    }

    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }
}

export { MarkdownParser };