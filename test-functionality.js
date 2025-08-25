// 功能测试脚本
console.log("=== 小说阅读器功能测试 ===");

// 测试文件管理器
const novels = JSON.parse(localStorage.getItem('novelReaderData') || '[]');
console.log("已存储的小说数量:", novels.length);

// 显示所有小说信息
novels.forEach((novel, index) => {
    console.log(`\n小说 ${index + 1}:`);
    console.log(`标题: ${novel.title}`);
    console.log(`作者: ${novel.author}`);
    console.log(`章节数: ${novel.chapters.length}`);
    console.log(`文件类型: ${novel.fileType || 'txt'}`);
});

// 测试图片管理器
const images = JSON.parse(localStorage.getItem('novelReaderImages') || '{}');
console.log("\n已存储的图片数量:", Object.keys(images).length);

const chapterImages = JSON.parse(localStorage.getItem('novelReaderChapterImages') || '{}');
console.log("章节图片关联数量:", Object.keys(chapterImages).length);

// 测试设置
const settings = JSON.parse(localStorage.getItem('readerSettings') || '{}');
console.log("\n用户设置:", settings);

// 测试书签
const bookmarks = JSON.parse(localStorage.getItem('bookmarks') || '[]');
console.log("书签数量:", bookmarks.length);

console.log("\n=== 测试完成 ===");
console.log("提示: 在管理页面点击'编辑'按钮可以编辑小说内容");
console.log("在阅读页面右键点击可以插入图片");
