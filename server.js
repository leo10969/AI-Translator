const express = require('express');
const { spawn } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const bodyParser = require('body-parser');
const axios = require('axios');
const multer = require('multer');
const upload = multer({ dest: 'uploads/' });
const app = express();

app.use(express.json());
app.use(express.static('public'));

// チャットログのファイルパス
const CHATLOG_FILE = path.join(__dirname, 'chatlog.json');
const SETTINGS_FILE = path.join(__dirname, 'settings.json');

// チャットログの読み込み
async function readChatLog() {
  try {
    const data = await fs.readFile(CHATLOG_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    return [];
  }
}

// チャットログの保存
async function saveChatLog(chatLog) {
  await fs.writeFile(CHATLOG_FILE, JSON.stringify(chatLog, null, 2));
}

// 設定の読み込み
async function readSettings() {
  try {
    const data = await fs.readFile(SETTINGS_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    return {};
  }
}

// 設定の保存
async function saveSettings(settings) {
  await fs.writeFile(SETTINGS_FILE, JSON.stringify(settings, null, 2));
}

// 会話の保存
app.post('/api/chatlog', async (req, res) => {
  try {
    const { conversationId, messages } = req.body;
    
    if (!conversationId || !Array.isArray(messages)) {
      return res.status(400).json({ error: '無効なリクエストデータです。' });
    }

    const chatLog = await readChatLog();

    // 既存の会話を削除
    const filteredLog = chatLog.filter(entry => entry.conversationId !== conversationId);

    // 新しいメッセージを追加
    messages.forEach(message => {
      if (message.type && message.content && message.timestamp) {
        filteredLog.push({
          conversationId,
          original: message.type === 'user' ? message.content : '',
          translation: message.type === 'bot' ? message.content : '',
          timestamp: message.timestamp,
          type: message.type
        });
      }
    });

    await saveChatLog(filteredLog);
    res.status(200).json({ message: '会話を保存しました。' });
  } catch (error) {
    console.error('Error saving conversation:', error);
    res.status(500).json({ error: '会話の保存中にエラーが発生しました。' });
  }
});

// 会話設定の保存
app.post('/api/settings/:conversationId', async (req, res) => {
  try {
    const { conversationId } = req.params;
    const settings = await readSettings();
    
    settings[conversationId] = req.body;
    await saveSettings(settings);
    
    res.status(200).json({ message: '設定を保存しました。' });
  } catch (error) {
    console.error('Error saving settings:', error);
    res.status(500).json({ error: '設定の保存中にエラーが発生しました。' });
  }
});

// 会話設定の取得
app.get('/api/settings/:conversationId', async (req, res) => {
  try {
    const { conversationId } = req.params;
    const settings = await readSettings();
    
    if (settings[conversationId]) {
      res.json(settings[conversationId]);
    } else {
      res.status(404).json({ error: '設定が見つかりませんでした。' });
    }
  } catch (error) {
    console.error('Error reading settings:', error);
    res.status(500).json({ error: '設定の読み込み中にエラーが発生しました。' });
  }
});

// 翻訳処理
app.post('/api/translate', async (req, res) => {
  try {
    const { message, conversationId, settings } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: 'メッセージが指定されていません。' });
    }

    // 翻訳設定の取得（デフォルト値を設定）
    const translationStyle = settings?.translationStyle || 'natural';
    const translationFormat = settings?.translationFormat || 'simple';
    const targetLanguage = settings?.targetLanguage || 'ja';
    const textStyle = settings?.textStyle || 'dearu';
    const punctuationStyle = settings?.punctuationStyle || 'ten';
    const dictionary = settings?.dictionary || [];
    
    // Pythonスクリプトを実行（翻訳設定を渡す）
    const pythonProcess = spawn('python3', [
      'api.py',
      message,
      translationStyle,
      translationFormat,
      targetLanguage,
      ...(targetLanguage === 'ja' ? [textStyle, punctuationStyle] : []),
      JSON.stringify(dictionary) // 辞書情報を渡す
    ], {
      env: { ...process.env, PYTHONUNBUFFERED: '1' }
    });
    
    let translatedText = '';
    let errorText = '';

    // 標準出力からデータを受け取る
    pythonProcess.stdout.on('data', (data) => {
      translatedText += data.toString();
    });

    // エラー出力からデータを受け取る
    pythonProcess.stderr.on('data', (data) => {
      errorText += data.toString();
      console.error('Python stderr:', data.toString());
    });

    // プロセスの終了を待つ
    await new Promise((resolve, reject) => {
      pythonProcess.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          console.error('Python process error:', errorText);
          reject(new Error(`翻訳処理でエラーが発生しました（終了コード: ${code}）: ${errorText}`));
        }
      });
    });

    if (!translatedText.trim()) {
      throw new Error('翻訳結果が空です。');
    }

    console.log('Translation successful:', translatedText.trim());
    res.json({ translation: translatedText.trim() });
  } catch (error) {
    console.error('Translation error:', error);
    res.status(500).json({ 
      error: '翻訳中にエラーが発生しました。', 
      details: error.message 
    });
  }
});

// チャットログの取得
app.get('/api/chatlog', async (req, res) => {
  try {
    const chatLog = await readChatLog();
    res.json(chatLog);
  } catch (error) {
    console.error('Error reading chat log:', error);
    res.status(500).send('チャットログの読み込み中にエラーが発生しました。');
  }
});

// 特定の会話のチャットログを取得
app.get('/api/chatlog/:conversationId', async (req, res) => {
  try {
    const chatLog = await readChatLog();
    const conversationLog = chatLog.filter(
      entry => entry.conversationId === req.params.conversationId
    );

    if (conversationLog.length === 0) {
      return res.status(404).json({ error: '指定された会話が見つかりませんでした。' });
    }

    // タイムスタンプでソート
    conversationLog.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    res.json(conversationLog);
  } catch (error) {
    console.error('Error reading conversation log:', error);
    res.status(500).json({ error: '会話ログの読み込み中にエラーが発生しました。' });
  }
});

// 特定の会話を削除
app.delete('/api/chatlog/:conversationId', async (req, res) => {
  try {
    const chatLog = await readChatLog();
    const filteredLog = chatLog.filter(
      entry => entry.conversationId !== req.params.conversationId
    );
    
    await saveChatLog(filteredLog);
    res.json({ message: '会話を削除しました。' });
  } catch (error) {
    console.error('Error deleting conversation:', error);
    res.status(500).json({ error: '会話の削除中にエラーが発生しました。' });
  }
});

// PDFファイルを処理するエンドポイント
app.post('/api/pdf-translate', upload.single('pdfFile'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'PDFファイルが提供されていません。' });
    }

    const filePath = req.file.path;
    const settings = req.body;
    const conversationId = settings.conversationId;

    // Pythonスクリプトを実行してPDFを処理
    const pythonProcess = spawn('python3', [
      'pdf_translator.py',
      filePath,
      settings.translationStyle || 'natural',
      settings.translationFormat || 'simple',
      settings.targetLanguage || 'ja',
      settings.textStyle || 'dearu',
      settings.punctuationStyle || 'ten',
      JSON.stringify(settings.dictionary || [])
    ]);

    let translatedText = '';
    let errorText = '';

    pythonProcess.stdout.on('data', (data) => {
      translatedText += data.toString();
    });

    pythonProcess.stderr.on('data', (data) => {
      errorText += data.toString();
      console.error('Python stderr:', data.toString());
    });

    await new Promise((resolve, reject) => {
      pythonProcess.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`PDF処理でエラーが発生しました（終了コード: ${code}）: ${errorText}`));
        }
      });
    });

    // 一時ファイルを削除
    await fs.unlink(filePath);

    // 会話履歴に保存
    const timestamp = new Date().toISOString();
    const chatLog = await readChatLog();
    
    // PDFファイル名をユーザーメッセージとして保存
    chatLog.push({
      conversationId,
      original: `PDF: ${req.file.originalname}`,
      translation: '',
      timestamp,
      type: 'user'
    });

    // 翻訳結果をボットの応答として保存
    chatLog.push({
      conversationId,
      original: '',
      translation: translatedText.trim(),
      timestamp,
      type: 'bot'
    });

    await saveChatLog(chatLog);

    res.json({ 
      translation: translatedText.trim(),
      messages: [
        { type: 'user', content: `PDF: ${req.file.originalname}`, timestamp },
        { type: 'bot', content: translatedText.trim(), timestamp }
      ]
    });
  } catch (error) {
    console.error('PDF translation error:', error);
    res.status(500).json({ 
      error: 'PDF翻訳中にエラーが発生しました。', 
      details: error.message 
    });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', (error) => {
  if (error) {
    console.error('Error starting server:', error);
    return;
  }
  console.log(`Server is running on http://localhost:${PORT}`);
});