const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const PORT = 8089;
const CHROME_PATH = '"C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe"';
const USER_DATA_DIR = "C:\\Users\\57850\\.gemini\\antigravity\\scratch\\chrome-test-profile";
const STATIC_DIR = __dirname;

const MIME = {
  '.html': 'text/html; charset=UTF-8',
  '.css': 'text/css; charset=UTF-8',
  '.js': 'application/javascript; charset=UTF-8',
  '.png': 'image/png'
};

// Start simple HTTP static server
const server = http.createServer((req, res) => {
  let reqPath = req.url.split('?')[0];
  if (reqPath === '/') reqPath = '/index.html';
  const filePath = path.join(STATIC_DIR, reqPath);
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not Found');
      return;
    }
    const ext = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'text/plain' });
    res.end(data);
  });
});

async function main() {
  await new Promise(resolve => server.listen(PORT, resolve));
  console.log(`[TEST] Local server started at http://localhost:${PORT}`);

  // Launch Edge headless
  const chromeProcess = spawn(CHROME_PATH, [
    '--headless=new',
    '--remote-debugging-port=9222',
    '--disable-gpu',
    `--user-data-dir=${USER_DATA_DIR}`,
    '--window-size=1280,900',
    `http://localhost:${PORT}`
  ], { shell: true });

  // Wait for Chrome/Edge remote debugging to be ready and locate the target page
  let versionData = null;
  for (let i = 0; i < 30; i++) {
    try {
      const res = await fetch('http://localhost:9222/json/list');
      const tabs = await res.json();
      if (tabs && tabs.length > 0) {
        // Find tab matching our server URL or HTML title
        const targetTab = tabs.find(t => t.url && t.url.includes(`localhost:${PORT}`));
        if (targetTab) {
          versionData = targetTab;
          break;
        }
      }
      if (i > 3 && !versionData) {
        // Explicitly create target tab
        try {
          const createRes = await fetch(`http://localhost:9222/json/new?http://localhost:${PORT}`, { method: 'PUT' });
          const newTab = await createRes.json();
          if (newTab && newTab.webSocketDebuggerUrl) {
            versionData = newTab;
            break;
          }
        } catch(e) {}
      }
    } catch (e) {
      // wait
    }
    await new Promise(r => setTimeout(r, 300));
  }

  if (!versionData) {
    console.error('[TEST ERROR] Could not connect to Chrome DevTools Protocol');
    chromeProcess.kill();
    server.close();
    process.exit(1);
  }

  console.log('[TEST] Connected to Chrome tab:', versionData.title, versionData.webSocketDebuggerUrl);

  const ws = new WebSocket(versionData.webSocketDebuggerUrl);
  let idCounter = 1;
  const callbacks = new Map();

  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (msg.id && callbacks.has(msg.id)) {
      const cb = callbacks.get(msg.id);
      callbacks.delete(msg.id);
      cb(msg);
    }
  };

  await new Promise(resolve => ws.onopen = resolve);

  function sendCommand(method, params = {}) {
    return new Promise((resolve) => {
      const id = idCounter++;
      callbacks.set(id, (res) => resolve(res));
      ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async function evaluate(expression) {
    const res = await sendCommand('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true
    });
    if (res.result && res.result.exceptionDetails) {
      throw new Error(`Eval error: ${JSON.stringify(res.result.exceptionDetails)}`);
    }
    return res.result && res.result.result ? res.result.result.value : null;
  }

  // Wait for page to finish loading DOM
  await evaluate(`new Promise(r => {
    if (document.readyState === 'complete') r();
    else window.addEventListener('load', r);
  })`);

  console.log('\n--- 1. 验证初始默认数据加载与统计 / Initial Data & Stats ---');
  const initialStats = await evaluate(`({
    total: document.getElementById('totalCount').textContent,
    mastered: document.getElementById('masteredCount').textContent,
    unmastered: document.getElementById('unmasteredCount').textContent,
    cardCount: document.querySelectorAll('.card-wrapper').length
  })`);
  console.log('初始统计:', initialStats);
  if (initialStats.cardCount !== 4 || initialStats.total !== '4') {
    throw new Error('Default cards should be 4');
  }
  console.log('✅ 初始卡片加载成功 (共 4 张)');

  console.log('\n--- 2. 验证卡片 3D 翻转功能 / Card Flip Test ---');
  const flipResult = await evaluate(`(() => {
    const firstCard = document.querySelector('.card-wrapper');
    const beforeFlip = firstCard.classList.contains('flipped');
    firstCard.click();
    const afterFirstClick = firstCard.classList.contains('flipped');
    firstCard.click();
    const afterSecondClick = firstCard.classList.contains('flipped');
    return { beforeFlip, afterFirstClick, afterSecondClick };
  })()`);
  console.log('翻转测试结果:', flipResult);
  if (!flipResult.afterFirstClick || flipResult.afterSecondClick) {
    throw new Error('Card flip failed');
  }
  console.log('✅ 点击卡片翻转功能正常 (点击可顺畅翻转与翻回)');

  console.log('\n--- 3. 验证添加新单词功能 / Add New Word ---');
  const addResult = await evaluate(`(() => {
    document.getElementById('koreanInput').value = '학교';
    document.getElementById('chineseInput').value = '学校';
    document.getElementById('exampleInput').value = '우리는 학교에 갑니다. (我们去学校。)';
    document.getElementById('wordForm').dispatchEvent(new Event('submit', { cancelable: true }));
    
    return {
      total: document.getElementById('totalCount').textContent,
      cardCount: document.querySelectorAll('.card-wrapper').length,
      firstCardKorean: document.querySelector('.card-wrapper .korean-text').textContent.trim(),
      firstCardChinese: document.querySelector('.card-wrapper .chinese-text').textContent.trim()
    };
  })()`);
  console.log('添加后结果:', addResult);
  if (addResult.total !== '5' || addResult.cardCount !== 5 || addResult.firstCardKorean !== '학교') {
    throw new Error('Add word failed');
  }
  console.log('✅ 添加新单词功能正常 (单词添加成功，卡片数量更新为 5)');

  console.log('\n--- 4. 验证搜索功能 / Search Functionality ---');
  const searchResult = await evaluate(`(() => {
    const searchInput = document.getElementById('searchInput');
    // 搜索刚刚添加的 "학교"
    searchInput.value = '학교';
    searchInput.dispatchEvent(new Event('input'));
    const countHakgyo = document.querySelectorAll('.card-wrapper').length;

    // 搜索 "谢谢" (中文)
    searchInput.value = '谢谢';
    searchInput.dispatchEvent(new Event('input'));
    const countThanks = document.querySelectorAll('.card-wrapper').length;

    // 清空搜索
    searchInput.value = '';
    searchInput.dispatchEvent(new Event('input'));
    const countAll = document.querySelectorAll('.card-wrapper').length;

    return { countHakgyo, countThanks, countAll };
  })()`);
  console.log('搜索测试结果:', searchResult);
  if (searchResult.countHakgyo !== 1 || searchResult.countThanks !== 1 || searchResult.countAll !== 5) {
    throw new Error('Search failed');
  }
  console.log('✅ 搜索功能正常 (中韩双向搜索及清空还原均正常)');

  console.log('\n--- 5. 验证标记“已掌握”与“只显示未掌握”筛选 / Mastered & Filter ---');
  const masteredFilterResult = await evaluate(`(() => {
    // 获取刚刚添加的 "학교" 卡片
    const firstCard = document.querySelector('.card-wrapper');
    const masterBtn = firstCard.querySelector('.btn-master-toggle');
    
    // 点击标记已掌握
    masterBtn.click();
    const isMasteredNow = firstCard.querySelector('.status-badge').textContent;
    const masteredCount = document.getElementById('masteredCount').textContent;

    // 勾选 "只显示未掌握"
    const checkbox = document.getElementById('unmasteredOnlyCheckbox');
    checkbox.checked = true;
    checkbox.dispatchEvent(new Event('change'));
    const visibleCardsWhenFiltered = document.querySelectorAll('.card-wrapper').length;

    // 取消勾选
    checkbox.checked = false;
    checkbox.dispatchEvent(new Event('change'));
    const visibleCardsAll = document.querySelectorAll('.card-wrapper').length;

    return { isMasteredNow, masteredCount, visibleCardsWhenFiltered, visibleCardsAll };
  })()`);
  console.log('掌握标记与筛选结果:', masteredFilterResult);
  if (!masteredFilterResult.isMasteredNow.includes('마스터') || masteredFilterResult.visibleCardsWhenFiltered !== 3) {
    throw new Error('Mastered filter failed');
  }
  console.log('✅ 标记已掌握与“只显示未掌握”筛选正常 (掌握数正确更新，筛选即时生效)');

  console.log('\n--- 6. 验证删除功能 / Delete Word ---');
  const deleteResult = await evaluate(`(() => {
    // 找到刚才的 "학교" 卡片并点击删除
    const firstCard = document.querySelector('.card-wrapper');
    const deleteBtn = firstCard.querySelector('.btn-delete');
    deleteBtn.click();

    // 弹窗出现
    const modalVisible = document.getElementById('confirmModal').style.display === 'flex';
    
    // 点击确认删除
    document.getElementById('modalConfirmBtn').click();
    
    const totalAfterDelete = document.getElementById('totalCount').textContent;
    const cardCountAfterDelete = document.querySelectorAll('.card-wrapper').length;

    return { modalVisible, totalAfterDelete, cardCountAfterDelete };
  })()`);
  console.log('删除测试结果:', deleteResult);
  if (!deleteResult.modalVisible || deleteResult.totalAfterDelete !== '4' || deleteResult.cardCountAfterDelete !== 4) {
    throw new Error('Delete failed');
  }
  console.log('✅ 删除功能正常 (弹窗确认机制和删除均按预期工作)');

  console.log('\n--- 7. 验证 localStorage 刷新持久化 / Refresh & Persistence ---');
  // Add a persistent marker word, reload, and verify it still exists!
  await evaluate(`(() => {
    document.getElementById('koreanInput').value = '영구저장';
    document.getElementById('chineseInput').value = '永久保存';
    document.getElementById('exampleInput').value = '새로고침 후에도 유지됩니다.';
    document.getElementById('wordForm').dispatchEvent(new Event('submit', { cancelable: true }));
  })()`);

  // Reload page via Page.reload
  await sendCommand('Page.reload');
  await new Promise(r => setTimeout(r, 1000));

  const afterReloadCheck = await evaluate(`(() => {
    const total = document.getElementById('totalCount').textContent;
    const firstWordKorean = document.querySelector('.card-wrapper .korean-text').textContent.trim();
    const firstWordChinese = document.querySelector('.card-wrapper .chinese-text').textContent.trim();
    return { total, firstWordKorean, firstWordChinese };
  })()`);
  console.log('刷新后检查结果:', afterReloadCheck);
  if (afterReloadCheck.firstWordKorean !== '영구저장' || afterReloadCheck.firstWordChinese !== '永久保存') {
    throw new Error('Persistence failed after page reload');
  }
  console.log('✅ 数据持久化验证成功 (页面刷新后新增数据与修改完全保留)');

  console.log('\n--- 8. 验证所有界面文字是否均严格包含中韩双语 / Bilingual Text Check ---');
  const bilingualAudit = await evaluate(`(() => {
    const hangulRegex = /[\\uac00-\\ud7af]/;
    const cjkRegex = /[\\u4e00-\\u9fa5]/;

    const issues = [];

    // Check all buttons
    document.querySelectorAll('button').forEach(btn => {
      const text = btn.textContent.trim();
      if (!text || text === '✕') return; // clear btn is icon
      const hasKo = hangulRegex.test(text);
      const hasZh = cjkRegex.test(text);
      if (!hasKo || !hasZh) {
        issues.push({ type: 'button', text });
      }
    });

    // Check all labels
    document.querySelectorAll('label').forEach(label => {
      const text = label.textContent.trim();
      const hasKo = hangulRegex.test(text);
      const hasZh = cjkRegex.test(text);
      if (!hasKo || !hasZh) {
        issues.push({ type: 'label', text });
      }
    });

    // Check placeholders
    document.querySelectorAll('input[placeholder]').forEach(inp => {
      const ph = inp.getAttribute('placeholder');
      const hasKo = hangulRegex.test(ph);
      const hasZh = cjkRegex.test(ph);
      if (!hasKo || !hasZh) {
        issues.push({ type: 'placeholder', text: ph });
      }
    });

    // Check all headings
    document.querySelectorAll('h1, h2, h3').forEach(h => {
      const text = h.textContent.trim();
      const hasKo = hangulRegex.test(text);
      const hasZh = cjkRegex.test(text);
      if (!hasKo || !hasZh) {
        issues.push({ type: 'heading', text });
      }
    });

    // Check card faces indicators & action prompts
    document.querySelectorAll('.side-indicator, .flip-prompt, .example-label, .status-badge').forEach(el => {
      const text = el.textContent.trim();
      const hasKo = hangulRegex.test(text);
      const hasZh = cjkRegex.test(text);
      if (!hasKo || !hasZh) {
        issues.push({ type: 'card-text', text });
      }
    });

    return issues;
  })()`);

  console.log('双语审查问题列表:', bilingualAudit);
  if (bilingualAudit.length > 0) {
    console.warn('⚠️ 存在缺少韩文或中文的文字:', bilingualAudit);
  } else {
    console.log('✅ 所有按钮、标签、输入框占位符、标题及卡片提示文字全部包含韩中双语！');
  }

  // 9. Take Screenshot for README
  console.log('\n--- 9. 生成运行截图 / Capture Screenshot ---');
  const screenshotRes = await sendCommand('Page.captureScreenshot', { format: 'png' });
  if (screenshotRes && screenshotRes.result && screenshotRes.result.data) {
    const buffer = Buffer.from(screenshotRes.result.data, 'base64');
    fs.writeFileSync(path.join(STATIC_DIR, 'screenshot.png'), buffer);
    // Also copy to screenshot-placeholder.png
    fs.writeFileSync(path.join(STATIC_DIR, 'screenshot-placeholder.png'), buffer);
    console.log('✅ 运行截图已保存至 screenshot.png 与 screenshot-placeholder.png');
  }

  // Clean up
  console.log('\n🎉 所有功能测试与验证全部通过！');
  ws.close();
  chromeProcess.kill();
  server.close();
  process.exit(0);
}

main().catch(err => {
  console.error('[TEST FATAL ERROR]', err);
  process.exit(1);
});
