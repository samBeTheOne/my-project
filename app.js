/**
 * 韩中单词卡 / 한중 단어장 (Korean-Chinese Flashcards)
 * Pure JavaScript application logic
 */

// Storage key / 存储键名 / 저장소 키
const STORAGE_KEY = 'korean_chinese_flashcards_v1';

// Default initial sample cards / 默认初始示例卡片 / 기본 예시 단어 목록
const DEFAULT_WORDS = [
  {
    id: 'sample_1',
    korean: '안녕하세요',
    chinese: '你好',
    example: '만나서 반갑습니다. (很高兴见到你。)',
    mastered: false,
    createdAt: 1700000001000
  },
  {
    id: 'sample_2',
    korean: '감사합니다',
    chinese: '谢谢',
    example: '도와주셔서 감사합니다. (谢谢你的帮助。)',
    mastered: true,
    createdAt: 1700000002000
  },
  {
    id: 'sample_3',
    korean: '공부하다',
    chinese: '学习',
    example: '매일 한국어를 공부해요. (每天学习韩语。)',
    mastered: false,
    createdAt: 1700000003000
  },
  {
    id: 'sample_4',
    korean: '친구',
    chinese: '朋友',
    example: '우리는 좋은 친구입니다. (我们是好朋友。)',
    mastered: false,
    createdAt: 1700000004000
  }
];

// App State / 应用状态 / 애플리케이션 상태
let words = [];
let pendingDeleteId = null;

// DOM Elements / DOM 元素 / DOM 요소
const wordForm = document.getElementById('wordForm');
const koreanInput = document.getElementById('koreanInput');
const chineseInput = document.getElementById('chineseInput');
const exampleInput = document.getElementById('exampleInput');
const searchInput = document.getElementById('searchInput');
const clearSearchBtn = document.getElementById('clearSearchBtn');
const unmasteredOnlyCheckbox = document.getElementById('unmasteredOnlyCheckbox');
const cardsGrid = document.getElementById('cardsGrid');
const emptyState = document.getElementById('emptyState');
const emptyTitle = document.getElementById('emptyTitle');
const emptyDesc = document.getElementById('emptyDesc');
const displayCountNotice = document.getElementById('displayCountNotice');
const totalCountEl = document.getElementById('totalCount');
const masteredCountEl = document.getElementById('masteredCount');
const unmasteredCountEl = document.getElementById('unmasteredCount');
const toastEl = document.getElementById('toast');
const resetSampleBtn = document.getElementById('resetSampleBtn');

// Modal Elements / 弹窗元素 / 모달 요소
const confirmModal = document.getElementById('confirmModal');
const modalTitle = document.getElementById('modalTitle');
const modalMessage = document.getElementById('modalMessage');
const modalConfirmBtn = document.getElementById('modalConfirmBtn');
const modalCancelBtn = document.getElementById('modalCancelBtn');

// --- Initialization / 初始化 / 초기화 ---
function init() {
  loadWordsFromStorage();
  bindEvents();
  render();
}

// --- Storage Management / 存储管理 / 저장소 관리 ---
function loadWordsFromStorage() {
  try {
    const rawData = localStorage.getItem(STORAGE_KEY);
    if (rawData) {
      words = JSON.parse(rawData);
    } else {
      // First visit: populate with default samples / 首次访问时载入默认示例
      words = [...DEFAULT_WORDS];
      saveWordsToStorage();
    }
  } catch (err) {
    console.error('Failed to read localStorage:', err);
    words = [...DEFAULT_WORDS];
  }
}

function saveWordsToStorage() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(words));
  } catch (err) {
    console.error('Failed to save to localStorage:', err);
    showToast('数据保存失败，请检查浏览器存储权限 / 데이터 저장 실패, 브라우저 저장소 권한을 확인하세요', 'error');
  }
}

// --- Event Binding / 事件绑定 / 이벤트 바인딩 ---
function bindEvents() {
  // Add Word Form submit / 表单提交
  wordForm.addEventListener('submit', (e) => {
    e.preventDefault();
    handleAddWord();
  });

  // Search input real-time / 实时搜索
  searchInput.addEventListener('input', () => {
    if (searchInput.value.trim().length > 0) {
      clearSearchBtn.style.display = 'block';
    } else {
      clearSearchBtn.style.display = 'none';
    }
    render();
  });

  // Clear search button / 清除搜索
  clearSearchBtn.addEventListener('click', () => {
    searchInput.value = '';
    clearSearchBtn.style.display = 'none';
    searchInput.focus();
    render();
  });

  // Filter: Unmastered only / 仅看未掌握筛选
  unmasteredOnlyCheckbox.addEventListener('change', () => {
    render();
  });

  // Reset sample button / 恢复示例按钮
  resetSampleBtn.addEventListener('click', () => {
    openConfirmModal(
      '恢复默认示例 / 기본 예시 복원',
      '确定要恢复默认示例单词吗？这将覆盖当前的所有单词卡。 / 기본 예시 단어로 복원하시겠습니까? 현재 단어가 모두 대체됩니다.',
      '确认恢复 / 복원 확인',
      () => {
        words = JSON.parse(JSON.stringify(DEFAULT_WORDS));
        saveWordsToStorage();
        render();
        showToast('已恢复默认示例单词 / 기본 예시 단어가 복원되었습니다', 'success');
      }
    );
  });

  // Modal Cancel / 取消弹窗
  modalCancelBtn.addEventListener('click', closeConfirmModal);
  confirmModal.addEventListener('click', (e) => {
    if (e.target === confirmModal) {
      closeConfirmModal();
    }
  });
}

// --- Word Operations / 单词操作 / 단어 처리 ---
function handleAddWord() {
  const korean = koreanInput.value.trim();
  const chinese = chineseInput.value.trim();
  const example = exampleInput.value.trim();

  if (!korean || !chinese) {
    showToast('请输入韩语单词和中文释义！ / 한국어 단어와 중국어 의미를 모두 입력해 주세요!', 'error');
    return;
  }

  const newWord = {
    id: 'word_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
    korean,
    chinese,
    example,
    mastered: false,
    createdAt: Date.now()
  };

  words.unshift(newWord);
  saveWordsToStorage();

  // Reset form / 重置表单
  koreanInput.value = '';
  chineseInput.value = '';
  exampleInput.value = '';
  koreanInput.focus();

  render();
  showToast('单词添加成功！ / 단어가 성공적으로 추가되었습니다!', 'success');
}

function toggleMastered(id, event) {
  if (event) event.stopPropagation();
  const target = words.find(w => w.id === id);
  if (target) {
    target.mastered = !target.mastered;
    saveWordsToStorage();
    render();
    if (target.mastered) {
      showToast('已标记为已掌握 / 마스터로 표시되었습니다', 'success');
    } else {
      showToast('已设为待复习 / 미마스터로 변경되었습니다', 'info');
    }
  }
}

function deleteWord(id, event) {
  if (event) event.stopPropagation();
  const target = words.find(w => w.id === id);
  const wordName = target ? `「${target.korean} - ${target.chinese}」` : '';

  openConfirmModal(
    '删除单词 / 단어 삭제',
    `确定要删除该单词 ${wordName} 吗？此操作无法撤销。 / 이 단어를 삭제하시겠습니까? 이 작업은 취소할 수 없습니다.`,
    '确认删除 / 삭제 확인',
    () => {
      words = words.filter(w => w.id !== id);
      saveWordsToStorage();
      render();
      showToast('单词已成功删除 / 단어가 성공적으로 삭제되었습니다', 'info');
    }
  );
}

// Pronunciation TTS / 语音朗读 / 발음 듣기
function speakWord(text, lang, event) {
  if (event) event.stopPropagation();
  if (!('speechSynthesis' in window)) {
    showToast('当前浏览器不支持语音合成 / 현재 브라우저가 음성 합성을 지원하지 않습니다', 'error');
    return;
  }
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = lang; // 'ko-KR' or 'zh-CN'
  utterance.rate = 0.9;
  window.speechSynthesis.speak(utterance);
}

// --- Modal Helper / 确认弹窗辅助函数 / 모달 헬퍼 ---
let activeModalConfirmCallback = null;

function openConfirmModal(title, message, confirmBtnText, onConfirm) {
  modalTitle.textContent = title;
  modalMessage.textContent = message;
  modalConfirmBtn.textContent = confirmBtnText;
  activeModalConfirmCallback = onConfirm;
  confirmModal.style.display = 'flex';

  modalConfirmBtn.onclick = () => {
    if (activeModalConfirmCallback) {
      activeModalConfirmCallback();
      activeModalConfirmCallback = null;
    }
    closeConfirmModal();
  };
}

function closeConfirmModal() {
  confirmModal.style.display = 'none';
  activeModalConfirmCallback = null;
}

// --- Toast Notification / 提示气泡 / 토스트 메시지 ---
let toastTimer = null;
function showToast(message, type = 'info') {
  if (toastTimer) clearTimeout(toastTimer);

  toastEl.textContent = message;
  toastEl.className = 'toast show';
  if (type === 'error') {
    toastEl.classList.add('toast-error');
  } else if (type === 'success') {
    toastEl.classList.add('toast-success');
  }

  toastTimer = setTimeout(() => {
    toastEl.className = 'toast';
  }, 2800);
}

// --- Render Logic / 页面渲染 / 렌더링 ---
function render() {
  const query = searchInput.value.trim().toLowerCase();
  const unmasteredOnly = unmasteredOnlyCheckbox.checked;

  // Filter words / 筛选过滤
  const filteredWords = words.filter(item => {
    if (unmasteredOnly && item.mastered) {
      return false;
    }
    if (query) {
      const matchKorean = item.korean && item.korean.toLowerCase().includes(query);
      const matchChinese = item.chinese && item.chinese.toLowerCase().includes(query);
      const matchExample = item.example && item.example.toLowerCase().includes(query);
      return matchKorean || matchChinese || matchExample;
    }
    return true;
  });

  // Update statistics / 更新统计数据
  const total = words.length;
  const mastered = words.filter(w => w.mastered).length;
  const unmastered = total - mastered;

  totalCountEl.textContent = total;
  masteredCountEl.textContent = mastered;
  unmasteredCountEl.textContent = unmastered;

  displayCountNotice.textContent = `${filteredWords.length} / ${total}`;

  // Render cards or empty state / 渲染卡片或空状态
  cardsGrid.innerHTML = '';

  if (filteredWords.length === 0) {
    cardsGrid.style.display = 'none';
    emptyState.style.display = 'block';

    if (total === 0) {
      emptyTitle.textContent = '暂无单词 / 단어가 없습니다';
      emptyDesc.textContent = '请在上方表单添加新单词，或点击“恢复默认示例”。 / 상단에서 새 단어를 추가하거나 "기본 예시 복원"을 클릭하세요.';
    } else {
      emptyTitle.textContent = '未找到匹配单词 / 일치하는 단어가 없습니다';
      emptyDesc.textContent = '请尝试更换搜索词或取消“只显示未掌握”筛选。 / 검색어를 변경하거나 "미마스터 단어만 보기" 필터를 해제해 보세요.';
    }
  } else {
    cardsGrid.style.display = 'grid';
    emptyState.style.display = 'none';

    filteredWords.forEach(word => {
      const cardEl = createCardElement(word);
      cardsGrid.appendChild(cardEl);
    });
  }
}

// Create single card DOM / 创建单个卡片 DOM / 단일 카드 DOM 생성
function createCardElement(word) {
  const cardWrapper = document.createElement('div');
  cardWrapper.className = 'card-wrapper';
  cardWrapper.setAttribute('tabindex', '0');
  cardWrapper.setAttribute('role', 'button');
  cardWrapper.setAttribute('aria-label', `单词卡 / 단어 카드: ${word.korean} - ${word.chinese}`);

  const flipCard = document.createElement('div');
  flipCard.className = 'flip-card';

  // Mastered state classes
  const masteredClass = word.mastered ? 'is-mastered' : '';
  const statusBadgeHtml = word.mastered
    ? '<span class="status-badge mastered">✓ 已掌握 / 마스터</span>'
    : '<span class="status-badge unmastered">⏳ 待复习 / 미마스터</span>';

  // Example HTML snippet
  const exampleHtml = word.example
    ? `<div class="example-box">
        <span class="example-label">例句 / 예문:</span>
        <span>${escapeHtml(word.example)}</span>
       </div>`
    : '';

  flipCard.innerHTML = `
    <!-- Front Face / 正面: 韩语 / 앞면: 한국어 -->
    <div class="card-face card-front ${masteredClass}">
      <div class="card-top">
        <span class="side-indicator">🇰🇷 韩语 / 한국어 (正面 / 앞면)</span>
        ${statusBadgeHtml}
      </div>
      <div class="card-body">
        <div class="korean-text">${escapeHtml(word.korean)}</div>
        <div class="flip-prompt">🔄 点击翻转看释义 / 클릭하여 의미 확인</div>
      </div>
      <div class="card-actions">
        <div>
          <button class="action-btn" title="朗读韩语 / 발음 듣기" onclick="speakWord('${escapeJsString(word.korean)}', 'ko-KR', event)">
            🔊 发音 / 발음
          </button>
        </div>
        <div>
          <button class="action-btn btn-master-toggle ${word.mastered ? 'active' : ''}" onclick="toggleMastered('${word.id}', event)">
            ${word.mastered ? '↩ 设为待复习 / 미마스터로 변경' : '⭐ 标记已掌握 / 마스터 완료'}
          </button>
          <button class="action-btn btn-delete" title="删除该词 / 삭제" onclick="deleteWord('${word.id}', event)">
            🗑️ 删除 / 삭제
          </button>
        </div>
      </div>
    </div>

    <!-- Back Face / 背面: 中文 / 뒷면: 중국어 -->
    <div class="card-face card-back ${masteredClass}">
      <div class="card-top">
        <span class="side-indicator">🇨🇳 中文 / 중국어 (背面 / 뒷면)</span>
        ${statusBadgeHtml}
      </div>
      <div class="card-body">
        <div class="chinese-text">${escapeHtml(word.chinese)}</div>
        ${exampleHtml}
        <div class="flip-prompt">🔄 点击翻转看单词 / 클릭하여 단어 확인</div>
      </div>
      <div class="card-actions">
        <div>
          <button class="action-btn" title="朗读中文 / 발음 듣기" onclick="speakWord('${escapeJsString(word.chinese)}', 'zh-CN', event)">
            🔊 发音 / 발음
          </button>
        </div>
        <div>
          <button class="action-btn btn-master-toggle ${word.mastered ? 'active' : ''}" onclick="toggleMastered('${word.id}', event)">
            ${word.mastered ? '↩ 设为待复习 / 미마스터로 변경' : '⭐ 标记已掌握 / 마스터 완료'}
          </button>
          <button class="action-btn btn-delete" title="删除该词 / 삭제" onclick="deleteWord('${word.id}', event)">
            🗑️ 删除 / 삭제
          </button>
        </div>
      </div>
    </div>
  `;

  // Flip toggle on card click / 点击卡片翻转
  cardWrapper.addEventListener('click', (e) => {
    // If click originated from button or input, don't flip
    if (e.target.closest('button') || e.target.closest('input')) {
      return;
    }
    cardWrapper.classList.toggle('flipped');
  });

  // Keyboard accessibility: Enter or Space to flip
  cardWrapper.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      if (!e.target.closest('button')) {
        e.preventDefault();
        cardWrapper.classList.toggle('flipped');
      }
    }
  });

  cardWrapper.appendChild(flipCard);
  return cardWrapper;
}

// XSS Safety Escaping / XSS 转义安全工具函数
function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function escapeJsString(str) {
  if (!str) return '';
  return str.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

// Start app on DOMContentLoaded / 页面加载完毕后启动
document.addEventListener('DOMContentLoaded', init);
