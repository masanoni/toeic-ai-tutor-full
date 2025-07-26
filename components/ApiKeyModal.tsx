
import React, { useState } from 'react';
import SettingsIcon from './icons/SettingsIcon';

interface ApiKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (key: string) => void;
  onClear: () => void;
  apiKeyExists: boolean;
}

const ApiKeyModal: React.FC<ApiKeyModalProps> = ({ isOpen, onClose, onSave, onClear, apiKeyExists }) => {
  const [key, setKey] = useState('');

  if (!isOpen) return null;

  return (
    <div 
        className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4"
        onClick={onClose}
    >
      <div 
        className="bg-white rounded-2xl shadow-xl p-6 md:p-8 w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-2xl font-bold text-center text-slate-800 mb-4 flex items-center justify-center gap-2">
            <SettingsIcon className="w-7 h-7" />
            APIキー設定
        </h2>
        <p className="text-slate-600 text-sm mb-4 text-center">
            このアプリのAI機能を使用するには、Google Gemini APIキーが必要です。
            <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline font-semibold">こちらから無料のAPIキーを取得できます。</a>
        </p>
         <p className="text-xs text-slate-500 mb-4 bg-slate-100 p-2 rounded-md">
            キーはご自身のデバイスにのみ保存され、開発者に送信されることはありません。
        </p>

        <div className="flex flex-col gap-2">
            <label htmlFor="api-key-input" className="font-semibold text-slate-700">Gemini API Key</label>
            <input
                id="api-key-input"
                type="password"
                value={key}
                onChange={(e) => setKey(e.target.value)}
                placeholder={apiKeyExists ? "新しいキーを入力して更新" : "APIキーをここに貼り付け"}
                className="w-full p-3 border border-slate-300 rounded-lg bg-slate-50 text-base focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
        </div>
        <div className="flex flex-col sm:flex-row gap-3 mt-6">
            <button
                onClick={() => onSave(key)}
                disabled={!key.trim()}
                className="flex-1 bg-blue-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-blue-700 transition shadow-md disabled:bg-slate-400 disabled:cursor-not-allowed"
            >
                保存して利用開始
            </button>
            {apiKeyExists && (
                <button
                    onClick={onClear}
                    className="flex-1 bg-rose-500 text-white font-bold py-3 px-4 rounded-lg hover:bg-rose-600 transition shadow-md"
                >
                    キーをクリア
                </button>
            )}
        </div>
        {apiKeyExists && (
            <div className="text-center mt-6">
                <button onClick={onClose} className="text-slate-500 hover:text-slate-700 font-semibold py-2 px-4">キャンセル</button>
            </div>
        )}
      </div>
    </div>
  );
};

export default ApiKeyModal;
