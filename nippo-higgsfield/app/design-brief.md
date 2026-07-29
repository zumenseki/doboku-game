# 現場日報 — design brief

- **Design read**: 建設現場の下請け作業員(スマホ・屋外・軍手)と元請管理者(PC)のための業務ツール。信頼感と即時性、装飾より視認性。
- **Concept spine**: 「現場の詰所に貼られた提出ボックス」— QRを読んで投げ込むだけ。管理側は回収トレイ。
- **Delivery tier**: editorial — 業務入力ツールのため。マイクロモーション(状態遷移・ボタンフィードバック)のみ。
- **Animation mode**: non-animated — 業務ツールであり、ユーザーはHiggsfieldへの即時公開のみを要望(フィード非掲載・社内利用)。スクロール演出は入力効率を損なうため不採用。
- **Locked palette**: sky-600 #0284c7 (primary / 現場の空・安全色), slate-50 #f8fafc (紙面), slate-900 #0f172a (墨), emerald/amber/red は状態色のみ。防御: 屋外直射日光下のスマホで最大コントラストを取るユーティリティ配色。
- **Locked type**: system-ui + Hiragino Sans / Noto Sans JP。数字は tabular-nums。日本語業務文書の既定に従う。
- **Section plan**: 入力フォーム(1画面完結) / 完了サマリ / 管理7画面(ダッシュボード・一覧・集計・現場・マスタ×2・設定)。
- **Asset plan**: PWAアイコン(クリップボード・自作)、OGカバー(生成)。写真素材は不要(ユーザー投稿写真が主役)。
- **CTA inventory**: 送信する(全幅・最大サイズ・唯一の主ボタン) / 続けて入力 / 管理側は各カード内の文脈ボタン。
