// 使用浏览器原生打印引擎生成 PDF：文字保持矢量，不再把整份简历转成大尺寸位图。
export function exportToPDF(element, filename = '简历.pdf') {
  if (!element) throw new Error('未找到简历预览内容');

  const originalTitle = document.title;
  const printTitle = filename.replace(/\.pdf$/i, '') || '简历';

  const cleanup = () => {
    document.body.classList.remove('is-printing-resume');
    document.title = originalTitle;
    window.removeEventListener('afterprint', cleanup);
  };

  document.title = printTitle;
  document.body.classList.add('is-printing-resume');
  window.addEventListener('afterprint', cleanup, { once: true });

  try {
    window.print();
  } finally {
    // 部分浏览器不触发 afterprint；print() 返回时打印预览已经完成取样。
    cleanup();
  }
}
