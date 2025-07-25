

import React from 'react';

interface UserManualScreenProps {
  onGoHome: () => void;
}

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <section className="mb-8">
    <h2 className="text-2xl font-bold text-slate-800 border-b-2 border-blue-500 pb-2 mb-4">{title}</h2>
    <div className="text-slate-600 leading-relaxed space-y-3">
      {children}
    </div>
  </section>
);

const UserManualScreen: React.FC<UserManualScreenProps> = ({ onGoHome }) => {
  return (
    <div className="w-full max-w-3xl mx-auto p-4 animate-fade-in">
      <div className="flex justify-between items-center mb-8">
        <button onClick={onGoHome} className="text-blue-600 hover:text-blue-800 font-semibold">&larr; ホームに戻る</button>
        <h1 className="text-3xl font-bold text-slate-800">ユーザーマニュアル</h1>
        <div className="w-24"></div>
      </div>

      <div className="bg-white p-6 md:p-8 rounded-2xl shadow-xl">
        <Section title="はじめに">
          <p>
            TOEIC AI Tutorへようこそ！このアプリは、AIの力を活用してあなたのTOEIC学習をサポートします。様々な学習モードを試して、スコアアップを目指しましょう。
          </p>
        </Section>

        <Section title="1. 学習モードの紹介">
            <p><strong>単語学習:</strong> 単語と熟語を4つの異なるモード（リスニング、ライティング、英→日クイズ、日→英クイズ）で集中的に学習します。</p>
            <p><strong>ドライブ学習:</strong> 単語や例文を連続で聞き流せるモードです。通勤中や家事をしながらの「ながら学習」に最適です。</p>
            <p><strong>基礎文法:</strong> 特定の文法トピックを選んでAIによる詳しい解説を読み、その内容に基づいた理解度チェックのクイズに挑戦できます。</p>
            <p><strong>リスニング:</strong> TOEICのリスニングセクション（Part 2, 3, 4）形式の問題に挑戦できます。AIが毎回新しい問題を生成します。</p>
            <p><strong>Part 5:</strong> TOEIC Part 5形式の短文穴埋め問題です。</p>
            <p><strong>Part 6:</strong> TOEIC Part 6形式の長文穴埋め問題です。</p>
            <p><strong>Part 7:</strong> TOEIC Part 7形式の読解問題です。文章とそれに関する設問が生成されます。</p>
            <p><strong>AI文法チェック:</strong> 自分で作った英文を入力すると、AIが文法的な間違いや不自然な表現を添削し、日本語で分かりやすく解説します。</p>
        </Section>

        <Section title="2. 単語管理">
            <p><strong>単語リストの閲覧:</strong> データベースに保存されている単語・熟語を一覧で確認できます。レベル、カテゴリ、品詞などで絞り込んだり、キーワードで検索したりすることが可能です。</p>
            <p>
              <strong>単語・熟語のインポート:</strong> 自分で用意したJSONファイルを読み込み、学習用の単語・熟語をデータベースに追加できます。これにより、市販の単語帳のデータを自作して取り込むなど、柔軟な学習が可能です。<br/>
              <span className="text-sm font-semibold text-slate-700">※JSONファイルは `&#123;"vocabulary": [...]&#125;` という形式で、配列内に指定のフォーマットの単語オブジェクトを入れてください。</span>
            </p>
        </Section>

      </div>
    </div>
  );
};

export default UserManualScreen;