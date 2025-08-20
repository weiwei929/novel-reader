class ImageManager {
    constructor() {
        this.storageKey = 'novelReaderImages';
        this.maxImageSize = 5 * 1024 * 1024; // 5MB
        this.allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    }

    async uploadImage(file) {
        this.validateImage(file);
        const formData = new FormData();
        formData.append('file', file);
        try {
            // 使用相对路径，适应生产环境
            const baseUrl = window.location.hostname === 'localhost' ? 'http://localhost:3000' : '';
            const response = await fetch(`${baseUrl}/upload-image`, {
                method: 'POST',
                body: formData
            });
            const result = await response.json();
            if (result.filePath) {
                // 返回完整的图片 URL
                if (window.location.hostname === 'localhost') {
                    return 'http://localhost:3000' + result.filePath;
                } else {
                    // 生产环境：使用当前域名 + 路径
                    return window.location.origin + result.filePath;
                }
            } else {
                throw new Error(result.error || '图片上传失败');
            }
        } catch (error) {
            throw new Error('图片上传失败: ' + error.message);
        }
    }

    validateImage(file) {
        if (!file) {
            throw new Error('请选择图片文件');
        }

        if (!this.allowedTypes.includes(file.type)) {
            throw new Error('不支持的图片格式，请选择 JPG、PNG、GIF 或 WebP 格式');
        }

        if (file.size > this.maxImageSize) {
            throw new Error('图片文件过大，请选择小于 5MB 的图片');
        }
    }

    saveImageData(imageId, imageData) {
        try {
            const images = this.loadAllImages();
            images[imageId] = imageData;
            localStorage.setItem(this.storageKey, JSON.stringify(images));
        } catch (error) {
            if (error.name === 'QuotaExceededError') {
                throw new Error('存储空间不足，请删除一些图片后重试');
            }
            throw new Error('保存图片失败: ' + error.message);
        }
    }

    loadAllImages() {
        try {
            const data = localStorage.getItem(this.storageKey);
            return data ? JSON.parse(data) : {};
        } catch (error) {
            console.error('加载图片数据失败:', error);
            return {};
        }
    }

    getImageData(imageId) {
        const images = this.loadAllImages();
        return images[imageId] || null;
    }

    setChapterImage(chapterId, imageId) {
        try {
            const chapterImages = this.loadChapterImages();
            chapterImages[chapterId] = imageId;
            localStorage.setItem('novelReaderChapterImages', JSON.stringify(chapterImages));
        } catch (error) {
            throw new Error('设置章节图片失败: ' + error.message);
        }
    }

    getChapterImage(chapterId) {
        const chapterImages = this.loadChapterImages();
        const imageId = chapterImages[chapterId];
        
        if (!imageId) {
            return null;
        }

        const imageData = this.getImageData(imageId);
        return imageData ? imageData.data : null;
    }

    loadChapterImages() {
        try {
            const data = localStorage.getItem('novelReaderChapterImages');
            return data ? JSON.parse(data) : {};
        } catch (error) {
            console.error('加载章节图片关联失败:', error);
            return {};
        }
    }

    async deleteImage(imagePath) {
        try {
            // 使用相对路径，适应生产环境
            const baseUrl = window.location.hostname === 'localhost' ? 'http://localhost:3000' : '';
            const response = await fetch(`${baseUrl}/delete-image`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ imagePath })
            });
            
            const result = await response.json();
            if (!response.ok) {
                throw new Error(result.error || '删除图片失败');
            }
            
            return result;
        } catch (error) {
            throw new Error('删除图片失败: ' + error.message);
        }
    }

    removeChapterImage(chapterId) {
        try {
            const chapterImages = this.loadChapterImages();
            const imageId = chapterImages[chapterId];
            
            if (imageId) {
                delete chapterImages[chapterId];
                localStorage.setItem('novelReaderChapterImages', JSON.stringify(chapterImages));
                
                // 检查是否还有其他章节使用这个图片
                const isUsedElsewhere = Object.values(chapterImages).includes(imageId);
                if (!isUsedElsewhere) {
                    this.deleteImage(imageId);
                }
            }
            
            return true;
        } catch (error) {
            throw new Error('移除章节图片失败: ' + error.message);
        }
    }

    // 增强的图片插入功能
    async insertImageAtCursor(file, caption = '', targetElement = null) {
        try {
            const imageUrl = await this.uploadImage(file);
            
            // 创建图片HTML
            const imageHtml = this.createImageHtml(imageUrl, caption);
            
            if (targetElement) {
                // 在指定位置插入
                this.insertHtmlAtElement(imageHtml, targetElement);
            } else {
                // 在光标位置插入
                this.insertHtmlAtCursor(imageHtml);
            }
            
            return imageUrl;
        } catch (error) {
            throw new Error('插入图片失败: ' + error.message);
        }
    }

    createImageHtml(imageUrl, caption = '') {
        const imageId = this.generateImageId();
        return `
            <div class="image-container my-6 text-center" data-image-id="${imageId}">
                <img src="${imageUrl}" alt="${caption}" class="max-w-full h-auto rounded-lg shadow-md mx-auto cursor-pointer" onclick="app.imageManager.showImageModal('${imageUrl}', '${caption}')">
                ${caption ? `<p class="text-sm text-base-content/60 mt-2 italic">${caption}</p>` : ''}
                <div class="image-actions mt-2 opacity-0 hover:opacity-100 transition-opacity">
                    <button class="btn btn-xs btn-ghost" onclick="app.imageManager.editImageCaption('${imageId}')">✏️ 编辑</button>
                    <button class="btn btn-xs btn-ghost text-error" onclick="app.imageManager.removeImageFromContent('${imageId}')">🗑️ 删除</button>
                </div>
            </div>
        `;
    }

    insertHtmlAtElement(html, targetElement) {
        if (targetElement && targetElement.nodeType === Node.ELEMENT_NODE) {
            const range = document.createRange();
            range.setStartAfter(targetElement);
            const fragment = range.createContextualFragment(html);
            range.insertNode(fragment);
        } else {
            // 如果 targetElement 无效，插入到内容末尾
            const chapterContent = document.getElementById('chapter-content');
            if (chapterContent) {
                chapterContent.insertAdjacentHTML('beforeend', html);
            }
        }
    }

    insertHtmlAtCursor(html) {
        const selection = window.getSelection();
        if (selection.rangeCount > 0) {
            try {
                const range = selection.getRangeAt(0);
                const fragment = range.createContextualFragment(html);
                range.deleteContents();
                range.insertNode(fragment);
                // 移动光标到插入内容之后
                range.setStartAfter(fragment.lastChild);
                range.collapse(true);
                selection.removeAllRanges();
                selection.addRange(range);
            } catch (e) {
                // 插入失败时自动插入到内容末尾，不弹出错误
                const chapterContent = document.getElementById('chapter-content');
                if (chapterContent) {
                    chapterContent.insertAdjacentHTML('beforeend', html);
                }
            }
        } else {
            // 如果没有选择范围，插入到内容末尾
            const chapterContent = document.getElementById('chapter-content');
            if (chapterContent) {
                chapterContent.insertAdjacentHTML('beforeend', html);
            }
        }
    }

    // 图片预览模态框
    showImageModal(imageUrl, caption) {
        const modal = document.createElement('dialog');
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-box max-w-4xl">
                <div class="flex justify-between items-center mb-4">
                    <h3 class="font-bold text-lg">图片预览</h3>
                    <button class="btn btn-sm btn-circle btn-ghost" onclick="this.closest('dialog').close()">✕</button>
                </div>
                <div class="text-center">
                    <img src="${imageUrl}" alt="${caption}" class="max-w-full h-auto rounded-lg shadow-lg">
                    ${caption ? `<p class="text-base-content/70 mt-4">${caption}</p>` : ''}
                </div>
                <div class="modal-action">
                    <button class="btn btn-neutral" onclick="this.closest('dialog').close()">关闭</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        modal.showModal();
        
        // 点击背景关闭
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.close();
            }
        });
        
        // 关闭时移除元素
        modal.addEventListener('close', () => {
            document.body.removeChild(modal);
        });
    }

    // 编辑图片说明
    editImageCaption(imageId) {
        const container = document.querySelector(`[data-image-id="${imageId}"]`);
        if (!container) return;
        
        const captionElement = container.querySelector('p');
        const currentCaption = captionElement ? captionElement.textContent : '';
        
        const newCaption = prompt('编辑图片说明:', currentCaption);
        if (newCaption !== null) {
            if (captionElement) {
                if (newCaption.trim()) {
                    captionElement.textContent = newCaption;
                } else {
                    captionElement.remove();
                }
            } else if (newCaption.trim()) {
                const img = container.querySelector('img');
                img.insertAdjacentHTML('afterend', `<p class="text-sm text-base-content/60 mt-2 italic">${newCaption}</p>`);
            }
            
            // 更新 alt 属性
            const img = container.querySelector('img');
            if (img) {
                img.alt = newCaption;
            }
        }
    }

    // 从内容中移除图片
    removeImageFromContent(imageId) {
        if (confirm('确定要删除这张图片吗？')) {
            const container = document.querySelector(`[data-image-id="${imageId}"]`);
            if (container) {
                container.remove();
            }
        }
    }

    // 拖拽上传支持
    initDragAndDrop(targetElement) {
        if (!targetElement) return;
        
        targetElement.addEventListener('dragover', (e) => {
            e.preventDefault();
            targetElement.classList.add('drag-over');
        });
        
        targetElement.addEventListener('dragleave', (e) => {
            e.preventDefault();
            targetElement.classList.remove('drag-over');
        });
        
        targetElement.addEventListener('drop', async (e) => {
            e.preventDefault();
            targetElement.classList.remove('drag-over');
            
            const files = Array.from(e.dataTransfer.files);
            const imageFiles = files.filter(file => this.allowedTypes.includes(file.type));
            
            if (imageFiles.length === 0) {
                alert('请拖拽图片文件');
                return;
            }
            
            for (const file of imageFiles) {
                try {
                    await this.insertImageAtCursor(file, '', e.target);
                } catch (error) {
                    console.error('拖拽上传失败:', error);
                    alert(`上传 ${file.name} 失败: ${error.message}`);
                }
            }
        });
    }

    getAllImages() {
        const images = this.loadAllImages();
        return Object.values(images).map(image => ({
            id: image.id,
            name: image.name,
            type: image.type,
            size: this.formatFileSize(image.size),
            uploadTime: new Date(image.uploadTime).toLocaleString(),
            data: image.data
        }));
    }

    getImageUsage(imageId) {
        const chapterImages = this.loadChapterImages();
        const usedChapters = [];
        
        Object.entries(chapterImages).forEach(([chapterId, imgId]) => {
            if (imgId === imageId) {
                usedChapters.push(chapterId);
            }
        });
        
        return usedChapters;
    }

    compressImage(file, maxWidth = 800, quality = 0.8) {
        return new Promise((resolve, reject) => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const img = new Image();

            img.onload = () => {
                // 计算新尺寸
                let { width, height } = img;
                if (width > maxWidth) {
                    height = (height * maxWidth) / width;
                    width = maxWidth;
                }

                canvas.width = width;
                canvas.height = height;

                // 绘制压缩后的图片
                ctx.drawImage(img, 0, 0, width, height);

                // 转换为 Blob
                canvas.toBlob(resolve, file.type, quality);
            };

            img.onerror = () => reject(new Error('图片压缩失败'));
            img.src = URL.createObjectURL(file);
        });
    }

    async optimizeAndUpload(file) {
        try {
            // 如果图片过大，先压缩
            if (file.size > 1024 * 1024) { // 1MB
                const compressedBlob = await this.compressImage(file);
                const compressedFile = new File([compressedBlob], file.name, {
                    type: file.type,
                    lastModified: Date.now()
                });
                return await this.uploadImage(compressedFile);
            } else {
                return await this.uploadImage(file);
            }
        } catch (error) {
            throw new Error('图片优化上传失败: ' + error.message);
        }
    }

    getStorageInfo() {
        try {
            const images = this.loadAllImages();
            const chapterImages = this.loadChapterImages();
            
            const imageCount = Object.keys(images).length;
            const usedCount = Object.keys(chapterImages).length;
            
            let totalSize = 0;
            Object.values(images).forEach(image => {
                totalSize += image.size || 0;
            });

            return {
                totalImages: imageCount,
                usedImages: usedCount,
                unusedImages: imageCount - usedCount,
                totalSize: this.formatFileSize(totalSize)
            };
        } catch (error) {
            return {
                totalImages: 0,
                usedImages: 0,
                unusedImages: 0,
                totalSize: '0 B'
            };
        }
    }

    cleanupUnusedImages() {
        try {
            const images = this.loadAllImages();
            const chapterImages = this.loadChapterImages();
            const usedImageIds = new Set(Object.values(chapterImages));
            
            let cleanedCount = 0;
            Object.keys(images).forEach(imageId => {
                if (!usedImageIds.has(imageId)) {
                    delete images[imageId];
                    cleanedCount++;
                }
            });
            
            if (cleanedCount > 0) {
                localStorage.setItem(this.storageKey, JSON.stringify(images));
            }
            
            return cleanedCount;
        } catch (error) {
            throw new Error('清理未使用图片失败: ' + error.message);
        }
    }

    generateImageId() {
        return 'img_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 B';
        
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    // 批量导入图片
    async importMultipleImages(files) {
        const results = [];
        
        for (const file of files) {
            try {
                const imageUrl = await this.uploadImage(file);
                results.push({
                    success: true,
                    file: file.name,
                    url: imageUrl
                });
            } catch (error) {
                results.push({
                    success: false,
                    file: file.name,
                    error: error.message
                });
            }
        }
        
        return results;
    }

    // 导出图片数据
    exportImages() {
        const images = this.loadAllImages();
        const chapterImages = this.loadChapterImages();
        
        return {
            images,
            chapterImages,
            exportTime: new Date().toISOString(),
            version: '1.0'
        };
    }

    // 导入图片数据
    importImages(data) {
        try {
            if (data.images) {
                localStorage.setItem(this.storageKey, JSON.stringify(data.images));
            }
            
            if (data.chapterImages) {
                localStorage.setItem('novelReaderChapterImages', JSON.stringify(data.chapterImages));
            }
            
            return true;
        } catch (error) {
            throw new Error('导入图片数据失败: ' + error.message);
        }
    }
}

export { ImageManager };