let currentConversationId = Date.now().toString();
let chatSettings = {
  chatStyle: 'casual',
  translationStyle: 'natural',
  translationFormat: 'simple',
  targetLanguage: 'ja',
  textStyle: 'dearu',
  punctuationStyle: 'ten',
  dictionary: [] // 翻訳辞書を追加
};
let currentMessages = []; // 現在の会話のメッセージを保持する配列

document.addEventListener('DOMContentLoaded', () => {
  const chatInput = document.getElementById('chat-input');
  const sendButton = document.getElementById('send-button');
    const chatLog = document.getElementById('chat-log');
  const newChatBtn = document.getElementById('new-chat-btn');
  const conversationList = document.getElementById('conversation-list');
  const sidebar = document.getElementById('sidebar');
  const mainContent = document.querySelector('.main-content');
  const toggleSidebarBtn = document.getElementById('toggle-sidebar');
  const toggleStickyBtn = document.getElementById('toggle-sticky');
  let isStickyEnabled = false;

  // サイドバーの表示/非表示を切り替える
  toggleSidebarBtn.addEventListener('click', () => {
    sidebar.classList.toggle('hidden');
    mainContent.classList.toggle('expanded');
  });

  // 画面サイズが小さい場合は自動的にサイドバーを隠す
  function checkWindowSize() {
    if (window.innerWidth < 768) {
      sidebar.classList.add('hidden');
      mainContent.classList.add('expanded');
    } else {
      sidebar.classList.remove('hidden');
      mainContent.classList.remove('expanded');
    }
  }

  // 初期表示時とリサイズ時にチェック
  window.addEventListener('resize', checkWindowSize);
  checkWindowSize();

  // 入力欄の自動リサイズ機能
  function autoResizeTextarea() {
    chatInput.style.height = 'auto';
    chatInput.style.height = (chatInput.scrollHeight) + 'px';
  }

  chatInput.addEventListener('input', autoResizeTextarea);
  
  // 入力欄のリセット時にも高さを調整
  function resetTextarea() {
    chatInput.value = '';
    chatInput.style.height = 'auto';
  }

  // 初期表示時に会話履歴をサイドバーに表示
  loadConversationList();

  // 初期表示時に日本語設定を表示
  const japaneseSettings = document.getElementById('japaneseSettings');
  if (document.getElementById('targetLanguage').value === 'ja') {
    japaneseSettings.classList.remove('d-none');
  }

  // 新しい会話ボタンのイベントリスナー
  newChatBtn.addEventListener('click', () => {
    // モーダルを開く前に日本語設定の表示状態を確認
    const japaneseSettings = document.getElementById('japaneseSettings');
    const targetLanguage = document.getElementById('targetLanguage').value;
    if (targetLanguage === 'ja') {
      japaneseSettings.classList.remove('d-none');
    } else {
      japaneseSettings.classList.add('d-none');
    }
    $('#chatSettingsModal').modal('show');
  });

  // 削除ボタンのイベントリスナー
  document.getElementById('delete-chat-btn').addEventListener('click', async () => {
    if (!confirm('選択中の会話を削除してもよろしいですか？')) {
      return;
    }
    try {
      const response = await fetch(`/api/chatlog/${currentConversationId}`, {
        method: 'DELETE'
      });
      
      if (!response.ok) {
        throw new Error('会話の削除に失敗しました');
      }

      // 会話リストを更新
      currentMessages = [];
      chatLog.innerHTML = '';
      loadConversationList();
      
      // 新しい会話IDを生成
      currentConversationId = Date.now().toString();
      
      // 初期メッセージを表示
      const welcomeMessage = getWelcomeMessage(chatSettings);
      appendMessage('system', welcomeMessage);
    } catch (error) {
      console.error('Error deleting conversation:', error);
      appendMessage('system', 'エラー: ' + error.message);
    }
  });

  // 言語選択時の日本語設定の表示制御
  document.getElementById('targetLanguage').addEventListener('change', (e) => {
    const japaneseSettings = document.getElementById('japaneseSettings');
    if (e.target.value === 'ja') {
      japaneseSettings.classList.remove('d-none');
    } else {
      japaneseSettings.classList.add('d-none');
    }
  });

  // 会話開始ボタンのイベントリスナー
  document.getElementById('startNewChat').addEventListener('click', async () => {
    // 現在の会話を保存
    if (currentMessages.length > 0) {
      try {
        const response = await fetch('/api/chatlog', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            conversationId: currentConversationId,
            messages: currentMessages
          })
        });
        
        if (!response.ok) {
          throw new Error('会話の保存に失敗しました');
        }
      } catch (error) {
        console.error('Error saving conversation:', error);
        appendMessage('system', '前の会話の保存に失敗しました。');
        return;
      }
    }

    // 新しい会話の設定
    chatSettings.chatStyle = document.getElementById('chatStyle').value;
    chatSettings.translationStyle = document.getElementById('translationStyle').value;
    chatSettings.translationFormat = document.getElementById('translationFormat').value;
    chatSettings.targetLanguage = document.getElementById('targetLanguage').value;
    
    // 日本語設定の保存
    if (chatSettings.targetLanguage === 'ja') {
      chatSettings.textStyle = document.getElementById('textStyle').value;
      chatSettings.punctuationStyle = document.getElementById('punctuationStyle').value;
    }
    
    currentConversationId = Date.now().toString();
    currentMessages = [];
    chatLog.innerHTML = '';
    $('#chatSettingsModal').modal('hide');
    
    const welcomeMessage = getWelcomeMessage(chatSettings);
    appendMessage('system', welcomeMessage);
    
    // 新しい会話の初期メッセージを保存
    currentMessages.push({
      type: 'system',
      content: welcomeMessage,
      timestamp: new Date().toISOString()
    });

    // 新しい会話を保存
    try {
      await Promise.all([
        fetch('/api/chatlog', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            conversationId: currentConversationId,
            messages: currentMessages
          })
        }),
        fetch(`/api/settings/${currentConversationId}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(chatSettings)
        })
      ]);
      
      loadConversationList();
      updateActiveConversation(currentConversationId);
    } catch (error) {
      console.error('Error saving new conversation:', error);
      appendMessage('system', '新しい会話の保存に失敗しました。');
    }
  });

  // 辞書関連の要素を取得
  const addDictionaryBtn = document.getElementById('add-dictionary-btn');
  const dictionaryList = document.getElementById('dictionary-list');
  const saveDictionaryEntry = document.getElementById('saveDictionaryEntry');

  // 辞書の展開/折りたたみ機能
  document.querySelector('.dictionary-section h5').addEventListener('click', () => {
    $('#dictionary-list').collapse('toggle');
  });

  // 辞書エントリーを表示する関数
  function displayDictionary() {
    const entriesContainer = dictionaryList.querySelector('.dictionary-entries');
    entriesContainer.innerHTML = '';
    
    if (chatSettings.dictionary.length === 0) {
      entriesContainer.innerHTML = '<div class="text-muted w-100 text-center">辞書エントリーはありません</div>';
      return;
    }

    chatSettings.dictionary.forEach((entry, index) => {
      const entryDiv = document.createElement('div');
      entryDiv.className = 'dictionary-entry m-1 p-2 border rounded';
      entryDiv.innerHTML = `
        <div class="entry-content">
          <div class="d-flex align-items-center">
            <strong class="mr-2">${entry.sourceWord}</strong>
            <i class="fas fa-arrow-right mx-2"></i>
            <span>${entry.targetWord}</span>
            <button class="btn btn-sm btn-danger delete-entry ml-2" data-index="${index}">
              <i class="fas fa-times"></i>
            </button>
          </div>
          ${entry.description ? `<small class="text-muted d-block">${entry.description}</small>` : ''}
        </div>
      `;

      // 削除ボタンのイベントリスナー
      const deleteBtn = entryDiv.querySelector('.delete-entry');
      deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        chatSettings.dictionary.splice(index, 1);
        displayDictionary();
      });

      entriesContainer.appendChild(entryDiv);
    });
  }

  // 単語追加ボタンのイベントリスナー
  addDictionaryBtn.addEventListener('click', () => {
    $('#dictionaryEntryModal').modal('show');
  });

  // 辞書エントリー保存のイベントリスナー
  saveDictionaryEntry.addEventListener('click', () => {
    const sourceWord = document.getElementById('sourceWord').value.trim();
    const targetWord = document.getElementById('targetWord').value.trim();
    const description = document.getElementById('wordDescription').value.trim();

    if (sourceWord && targetWord) {
      chatSettings.dictionary.push({
        sourceWord,
        targetWord,
        description
      });

      // フォームをクリアして閉じる
      document.getElementById('sourceWord').value = '';
      document.getElementById('targetWord').value = '';
      document.getElementById('wordDescription').value = '';
      $('#dictionaryEntryModal').modal('hide');

      // 辞書を表示更新
      displayDictionary();
    }
  });

  // 初期表示時に辞書を表示
  displayDictionary();

  // 現在の翻訳設定を取得する関数
  const getCurrentSettings = () => {
    return {
      chatStyle: chatSettings.chatStyle,
      translationStyle: chatSettings.translationStyle,
      translationFormat: chatSettings.translationFormat,
      targetLanguage: chatSettings.targetLanguage,
      textStyle: chatSettings.targetLanguage === 'ja' ? chatSettings.textStyle : undefined,
      punctuationStyle: chatSettings.targetLanguage === 'ja' ? chatSettings.punctuationStyle : undefined,
      dictionary: chatSettings.dictionary
    };
  };

  // メッセージ送信処理
  const sendMessage = async (content) => {
    const timestamp = new Date().toISOString();
    
    // ユーザーメッセージを表示して保存
    appendMessage('user', content);
    currentMessages.push({
      type: 'user',
      content: content,
      timestamp: timestamp
    });
    
    showTypingIndicator();
    
    try {
      // ユーザーメッセージを保存
      await saveCurrentConversation();
      
      const response = await fetch('/api/translate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: content,
          conversationId: currentConversationId,
          settings: getCurrentSettings()
        })
      });
      
      const data = await response.json();
      removeTypingIndicator();
      
      if (data.error) {
        throw new Error(data.error);
      }
      
      // ボットの応答を表示して保存
      appendMessage('bot', data.translation);
      currentMessages.push({
        type: 'bot',
        content: data.translation,
        timestamp: new Date().toISOString()
      });
      
      // ボットの応答を含めて会話を保存
      await saveCurrentConversation();
      
      // 会話リストを更新（最初のメッセージ交換後にタイトルを更新するため）
      await loadConversationList();
      updateActiveConversation(currentConversationId);
      
    } catch (error) {
      removeTypingIndicator();
      appendMessage('system', `エラーが発生しました: ${error.message}`);
      
      // エラーメッセージを保存
      currentMessages.push({
        type: 'system',
        content: `エラーが発生しました: ${error.message}`,
        timestamp: new Date().toISOString()
      });
      await saveCurrentConversation();
    }
  };

  // 会話履歴をサイドバーに表示
  async function loadConversationList() {
    try {
      const response = await fetch('/api/chatlog');
      const chatHistory = await response.json();
      
      // 会話IDごとにグループ化
      const conversations = {};
      chatHistory.forEach(entry => {
        if (!conversations[entry.conversationId]) {
          conversations[entry.conversationId] = [];
        }
        conversations[entry.conversationId].push(entry);
      });

      // サイドバーをクリア
      conversationList.innerHTML = '';

      // 各会話のプレビューを作成
      Object.entries(conversations)
        .sort(([,a], [,b]) => new Date(b[0].timestamp) - new Date(a[0].timestamp))
        .forEach(([id, messages]) => {
          const preview = createConversationPreview(id, messages);
          conversationList.appendChild(preview);
        });
    } catch (error) {
      console.error('Error loading conversation list:', error);
    }
  }

  // 会話プレビューの作成
  function createConversationPreview(conversationId, messages) {
    const div = document.createElement('div');
    div.className = `conversation-item ${conversationId === currentConversationId ? 'active' : ''}`;
    div.setAttribute('data-id', conversationId);

    // システムメッセージのみの場合は「新しい会話」と表示
    if (messages.length === 0 || (messages.length === 1 && messages[0].type === 'system')) {
      div.innerHTML = `
        <div class="timestamp">${new Date().toLocaleString()}</div>
        <div class="conversation-preview">新しい会話</div>
      `;
    } else {
      // ユーザーメッセージを探す
      const userMessage = messages.find(m => m.type === 'user' && m.original);
      let previewText;
      
      if (userMessage) {
        // ユーザーメッセージがある場合はそれを表示
        previewText = userMessage.original;
      } else {
        // ユーザーメッセージがない場合は最初のボットメッセージを表示
        const botMessage = messages.find(m => m.type === 'bot' && m.translation);
        previewText = botMessage ? botMessage.translation : '新しい会話';
      }

      // プレビューテキストを30文字に制限
      previewText = previewText.length > 30 ? previewText.substring(0, 30) + '...' : previewText;
      
      div.innerHTML = `
        <div class="timestamp">${new Date(messages[0].timestamp).toLocaleString()}</div>
        <div class="conversation-preview">${previewText}</div>
      `;
    }

    // クリックイベントの追加
    div.addEventListener('click', () => loadConversation(conversationId));
    
    return div;
  }

  // 特定の会話を読み込む
  async function loadConversation(conversationId) {
    try {
      // 現在の会話を保存
      if (currentMessages.length > 0) {
        await saveCurrentConversation();
      }

      const response = await fetch(`/api/chatlog/${conversationId}`);
      if (!response.ok) {
        throw new Error('会話の読み込みに失敗しました');
      }

      const conversation = await response.json();
      if (!Array.isArray(conversation) || conversation.length === 0) {
        throw new Error('会話が見つかりませんでした');
      }
      
      // メイン画面をクリア
      chatLog.innerHTML = '';
      currentMessages = []; // メッセージ配列をリセット
      
      // 会話内容を表示
      conversation.forEach(entry => {
        if (entry.original) {
          appendMessage('user', entry.original);
          currentMessages.push({
            type: 'user',
            content: entry.original,
            timestamp: entry.timestamp
          });
        }
        if (entry.translation) {
          appendMessage('bot', entry.translation);
          currentMessages.push({
            type: 'bot',
            content: entry.translation,
            timestamp: entry.timestamp
          });
        }
      });

      // 現在の会話IDを更新
      currentConversationId = conversationId;
      updateActiveConversation(conversationId);
      
      // 会話設定を取得（辞書を含む）
      const settingsResponse = await fetch(`/api/settings/${conversationId}`);
      if (settingsResponse.ok) {
        const settings = await settingsResponse.json();
        chatSettings = { ...chatSettings, ...settings };
        displayDictionary(); // 辞書を表示更新
      }
    } catch (error) {
      console.error('Error loading conversation:', error);
      appendMessage('system', 'エラー: ' + error.message);
    }
  }

  // 現在の会話を保存する関数
  async function saveCurrentConversation() {
    try {
      await Promise.all([
        fetch('/api/chatlog', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            conversationId: currentConversationId,
            messages: currentMessages
          })
        }),
        fetch(`/api/settings/${currentConversationId}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(chatSettings)
        })
      ]);
    } catch (error) {
      console.error('Error saving conversation:', error);
      appendMessage('system', '会話の保存に失敗しました。');
    }
  }

  // アクティブな会話を更新
  function updateActiveConversation(conversationId) {
    document.querySelectorAll('.conversation-item').forEach(item => {
      item.classList.remove('active');
    });
    const activeItem = document.querySelector(`.conversation-item[data-id="${conversationId}"]`);
    if (activeItem) {
      activeItem.classList.add('active');
    }
  }

  // メッセージ表示処理
  const appendMessage = (type, content) => {
    const messageWrapper = document.createElement('div');
    messageWrapper.className = `message-wrapper ${type}-wrapper`;
    
    const message = document.createElement('div');
    message.className = `message ${type}-message`;
    message.textContent = content;
    
    const timestamp = document.createElement('div');
    timestamp.className = 'message-timestamp';
    timestamp.textContent = new Date().toLocaleTimeString();
    
    const actions = document.createElement('div');
    actions.className = 'message-actions';
    
    // ユーザーメッセージの場合、固定表示用のクラスを追加
    if (type === 'user') {
        messageWrapper.classList.add('sticky-message');
        // 以前の固定メッセージを解除
        const prevSticky = chatLog.querySelector('.sticky-message');
        if (prevSticky) {
            prevSticky.classList.remove('sticky-message');
        }
    }
    
    // コピーボタン
    const copyButton = document.createElement('button');
    copyButton.className = 'action-button copy-button';
    copyButton.innerHTML = '<i class="fas fa-copy"></i>';
    copyButton.title = 'メッセージをコピー';
    copyButton.onclick = () => {
        navigator.clipboard.writeText(content).then(() => {
            copyButton.innerHTML = '<i class="fas fa-check"></i>';
            setTimeout(() => {
                copyButton.innerHTML = '<i class="fas fa-copy"></i>';
            }, 2000);
        });
    };
    
    // 翻訳ボタン（ユーザーメッセージの場合のみ）
    if (type === 'user') {
        const translateButton = document.createElement('button');
        translateButton.className = 'action-button translate-button';
        translateButton.innerHTML = '<i class="fas fa-language"></i>';
        translateButton.title = '再翻訳';
        translateButton.onclick = () => {
            sendMessage(content);
        };
        actions.appendChild(translateButton);
    }
    
    actions.appendChild(copyButton);
    messageWrapper.appendChild(message);
    messageWrapper.appendChild(timestamp);
    messageWrapper.appendChild(actions);
    
    chatLog.appendChild(messageWrapper);
    chatLog.scrollTop = chatLog.scrollHeight;
    
    // スクロールイベントリスナーを設定
    const checkVisibility = () => {
        const chatLogRect = chatLog.getBoundingClientRect();
        const messages = chatLog.querySelectorAll('.message-wrapper');
        let lastVisibleUserMessage = null;

        messages.forEach(message => {
            const rect = message.getBoundingClientRect();
            const isVisible = (
                rect.top >= chatLogRect.top &&
                rect.bottom <= chatLogRect.bottom &&
                rect.top <= chatLogRect.bottom &&
                rect.bottom >= chatLogRect.top
            );
            
            if (isVisible && message.classList.contains('user-wrapper')) {
                lastVisibleUserMessage = message;
            }
        });

        // すべての固定表示を解除
        messages.forEach(message => {
            message.classList.remove('sticky-message');
        });

        // 最後に表示されているユーザーメッセージを固定表示
        if (lastVisibleUserMessage) {
            lastVisibleUserMessage.classList.add('sticky-message');
        }
    };

    // チャットログのスクロールイベントリスナーを一度だけ設定
    chatLog.addEventListener('scroll', checkVisibility);
    
    // 新しいメッセージインジケーターの表示
    if (!isScrolledToBottom()) {
        showNewMessageIndicator();
    }
  };

  // イベントリスナーの設定
  sendButton.addEventListener('click', () => sendMessage(chatInput.value.trim()));
  chatInput.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      sendMessage(chatInput.value.trim());
    }
  });

  // タイピングインジケーターの追加と削除
  const showTypingIndicator = () => {
    const indicator = document.createElement('div');
    indicator.className = 'typing-indicator';
    indicator.innerHTML = `
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
    `;
    chatLog.appendChild(indicator);
    chatLog.scrollTop = chatLog.scrollHeight;
  };

  const removeTypingIndicator = () => {
    const indicator = document.querySelector('.typing-indicator');
    if (indicator) {
        indicator.remove();
    }
  };

  // 新しいメッセージインジケーター
  const createNewMessageIndicator = () => {
    const indicator = document.createElement('div');
    indicator.className = 'new-message-indicator';
    indicator.textContent = '新しいメッセージ';
    indicator.onclick = () => {
        chatLog.scrollTop = chatLog.scrollHeight;
        indicator.classList.remove('visible');
    };
    document.body.appendChild(indicator);
    return indicator;
  };

  let newMessageIndicator = createNewMessageIndicator();

  const showNewMessageIndicator = () => {
    newMessageIndicator.classList.add('visible');
  };

  const hideNewMessageIndicator = () => {
    newMessageIndicator.classList.remove('visible');
  };

  // スクロール位置の確認
  const isScrolledToBottom = () => {
    const threshold = 100; // スクロールの閾値（ピクセル）
    return chatLog.scrollHeight - chatLog.scrollTop - chatLog.clientHeight < threshold;
  };

  // スクロールイベントの監視
  chatLog.addEventListener('scroll', () => {
    if (isScrolledToBottom()) {
        hideNewMessageIndicator();
    }
    });

  // sticky-messageトグル機能
  toggleStickyBtn.addEventListener('click', () => {
    isStickyEnabled = !isStickyEnabled;
    chatLog.classList.toggle('sticky-enabled');
    toggleStickyBtn.classList.toggle('active');
    
    if (isStickyEnabled) {
      checkVisibility(); // 有効化時に現在のスクロール位置でチェック
    } else {
      // 固定表示を全て解除
      const stickyMessages = chatLog.querySelectorAll('.sticky-message');
      stickyMessages.forEach(message => {
        message.classList.remove('sticky-message');
      });
    }
  });

  const checkVisibility = () => {
    if (!isStickyEnabled) return; // 機能が無効な場合は処理をスキップ

    const chatLogRect = chatLog.getBoundingClientRect();
    const messages = chatLog.querySelectorAll('.message-wrapper');
    let lastVisibleUserMessage = null;

    messages.forEach(message => {
      const rect = message.getBoundingClientRect();
      const isVisible = (
        rect.top >= chatLogRect.top &&
        rect.bottom <= chatLogRect.bottom &&
        rect.top <= chatLogRect.bottom &&
        rect.bottom >= chatLogRect.top
      );
      
      if (isVisible && message.classList.contains('user-wrapper')) {
        lastVisibleUserMessage = message;
      }
    });

    // すべての固定表示を解除
    messages.forEach(message => {
      message.classList.remove('sticky-message');
    });

    // 最後に表示されているユーザーメッセージを固定表示
    if (lastVisibleUserMessage) {
      lastVisibleUserMessage.classList.add('sticky-message');
    }
  };

  // スクロールイベントリスナーを一度だけ設定
  chatLog.addEventListener('scroll', checkVisibility);

  // PDFファイルの翻訳処理
  document.getElementById('pdf-upload').addEventListener('change', async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    // ファイルサイズチェック（10MB以下）
    if (file.size > 10 * 1024 * 1024) {
      alert('ファイルサイズは10MB以下にしてください。');
      event.target.value = '';
      return;
    }

    try {
      // 翻訳中メッセージを表示
      appendMessage('system', `PDFファイル "${file.name}" を翻訳中...`);

      const formData = new FormData();
      formData.append('pdfFile', file);
      
      // 現在の翻訳設定を追加
      formData.append('translationStyle', chatSettings.translationStyle);
      formData.append('translationFormat', chatSettings.translationFormat);
      formData.append('targetLanguage', chatSettings.targetLanguage);
      formData.append('textStyle', chatSettings.textStyle);
      formData.append('punctuationStyle', chatSettings.punctuationStyle);
      formData.append('dictionary', JSON.stringify(chatSettings.dictionary));
      formData.append('conversationId', currentConversationId);

      const response = await fetch('/api/pdf-translate', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'PDF翻訳中にエラーが発生しました。');
      }

      const result = await response.json();
      
      // システムメッセージを削除
      removeLastSystemMessage();

      // PDFファイル名をユーザーメッセージとして表示
      appendMessage('user', `PDF: ${file.name}`);
      currentMessages.push({
        type: 'user',
        content: `PDF: ${file.name}`,
        timestamp: new Date().toISOString()
      });

      // 翻訳結果をボットメッセージとして表示
      appendMessage('bot', result.translation);
      currentMessages.push({
        type: 'bot',
        content: result.translation,
        timestamp: new Date().toISOString()
      });

      // 会話を保存
      await saveCurrentConversation();

      // 入力フィールドをリセット
      event.target.value = '';
      
    } catch (error) {
      console.error('PDF translation error:', error);
      alert(error.message || 'PDF翻訳中にエラーが発生しました。');
      removeLastSystemMessage();
    }
  });

  // システムメッセージを削除する関数
  function removeLastSystemMessage() {
    const chatLog = document.getElementById('chat-log');
    const systemMessages = chatLog.getElementsByClassName('system-wrapper');
    if (systemMessages.length > 0) {
      systemMessages[systemMessages.length - 1].remove();
    }
  }
});

// 会話スタイルに応じた初期メッセージを生成
function getWelcomeMessage(settings) {
  const languageNames = {
    ja: '日本語',
    en: '英語',
    zh: '中国語',
    ko: '韓国語',
    fr: 'フランス語',
    de: 'ドイツ語'
  };

  const messages = {
    casual: `やあ！気軽に話しかけてね。${languageNames[settings.targetLanguage]}に翻訳するよ。`,
    formal: `ご利用ありがとうございます。${languageNames[settings.targetLanguage]}への翻訳をお手伝いさせていただきます。`,
    friendly: `こんにちは！一緒に楽しく${languageNames[settings.targetLanguage]}に翻訳していきましょう！`
  };
  return messages[settings.chatStyle] || messages.casual;
}

function displayMessage(message, type = 'system') {
  appendMessage(type, message);
}