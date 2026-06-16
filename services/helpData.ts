export interface HelpFeature {
  title: string;
  description: string;
}

export interface HelpButtonDesc {
  name: string;
  description: string;
}

export interface HelpSection {
  title: string;
  featuresTitle: string;
  features: HelpFeature[];
  controlsTitle: string;
  controls: HelpButtonDesc[];
  formatsTitle: string;
  formats: {
    read: string[];
    write: string[];
  };
}

export const helpContent: Record<'ja' | 'en', HelpSection> = {
  ja: {
    title: "天体画像ビューア＋AI 完全ヘルプガイド",
    featuresTitle: "💫 主要な天体解析・編集機能",
    features: [
      {
        title: "複数選択ライブスタッキング",
        description: "画像一覧から複数の画像（FITS/TIFF/JPEG等）を選択し、「スタッキングを実行」をクリックすると、自動位置合わせ（移動・回転アライメント）、ホットピクセルなどのノイズ除去、加算平均処理、光害などのバックグラウンド自動フラット処理、ダイナミック・ヒストグラムストレッチを自動で行います。位置合わせ（アライメント）が不可能な、星の写っていないエラー画像等は、スタックの質を保つために自動的に除外判定・スキップされます。"
      },
      {
        title: "AI画像処理 (Gemini連携)",
        description: "最先端のマルチモーダルAI（Gemini 2.5 Flash / 3.1 Flashなど）を活用。元の高階調パラメータを保持したまま、AIに対して「星雲の淡いガスをもっと浮き立たせて」「光害ノイズを低減して背景をフラットにして」「超解像処理をして」といった自然言語で天体写真の現像を指示できます。また、写り込んだ天体の内容や歴史についての質問チャットも可能です。"
      },
      {
        title: "高精度 選択範囲（ROI）編集・クロップ",
        description: "プレビュー画面の画像上でマウスやタッチにより直感的にドラッグ＆ドロップしてターゲット範囲（矩形領域）を囲むことができます。画像全体の処理だけでなく、関心エリア（ROI）のみをピンポイントでトリミング切り抜き保存したり、指定した星雲や銀河を部分的にGemini AIに渡してスポット補正や局所的な高度解析、カタログ同定をさせることができます。"
      },
      {
        title: "極めて高速なフォルダ自動同期 (Folder Live-Sync)",
        description: "天体観測現場のPCやCMOSカメラの制御ソフトウェア（N.I.N.A、Ekos、ASIAIRなど）が新しい撮影フレームをキャプチャして指定フォルダに保存するたびに、リアルタイムでバックグラウンド検知して画像サムネイル一覧に自動読み込み・即時追加します。望遠鏡の撮影進捗やピント検知、天候不良を屋内からリアルタイムで監視・評価するのに最適です。"
      },
      {
        title: "Plate Solving (アストロメトリ自動位置解析)",
        description: "撮影した天体写真に含まれる恒星の位置パターンを検出・照合し、その写真が宇宙のどの座標（赤経RA、赤緯DEC、物理画角サイズ、北極に対する傾き角）を指しているかを超高速で解析算出します。ローカルソルバー環境と、Web経由のパブリックAPI（Remote Astrometry.netなど）を状況に応じてワンタッチで選択できます。"
      },
      {
        title: "インタラクティブ・天体アノテーション overlay",
        description: "Plate Solvingの完了後、画像上に星雲や銀河、星団のカタログ番号（Messier:メシエ、NGC、IC、星座バウンダリ、有名恒星名など）が精密なオーバーレイで投影描画されます。すべてのマーカーは単なる静止画ではなく「クリック可能」な対話型スイッチです。"
      },
      {
        title: "強力な外部天体データベース & プロポータル連携",
        description: "投影されたアノテーションをクリックすると詳細カードが展開され、天体説明の「Wikipedia日本語自動要約」が表示されます。さらにプロの天文学者・ハイアマチュアが活用する、インタラクティブ宇宙望遠鏡マップ「Aladin Lite」、世界標準プロ天体データベース「SIMBAD」、および各種天体詳細情報（Wikipedia全文など）へ瞬時に座標や名前を連携してジャンプできます。"
      }
    ],
    controlsTitle: "🎛️ ボタン・コントロール機能一覧・説明",
    controls: [
      {
        name: "ローカルフォルダを開く (Folder Open)",
        description: "ブラウザの File System Access API を用い、ローカルにあるFITS/TIFF/JPEGなどの天体観測データが入ったフォルダ全体へ安全にアクセス・一括ロードします。"
      },
      {
        name: "フォルダ同期 (Folder Sync Toggle)",
        description: "有効化すると、バックグラウンドでのファイル増減の自動監視（ポーリング）を開始。新しく撮影され保存された写真を自動かつ高速にリスト前端に追加します。"
      },
      {
        name: "ファイル検索 (Search Filter)",
        description: "画面上部の入力欄に文字を入れることで、ファイル名の一部や「FITS」「TIFF」などの拡張子・ファイル形式に基づいて特定のファイルをダイナミックに瞬時抽出します。"
      },
      {
        name: "設定をエクスポート (Download JSON)",
        description: "パーサー構成、Plate Solving用のソルバーアドレス設定、UI環境、カスタムAPIキーなどの各種プロファイルをJSON形式のファイルとしてローカルに書き出します。"
      },
      {
        name: "設定をインポート (Upload JSON)",
        description: "以前エクスポートした設定JSONファイルをアプリへインポートし、利用環境、パスポート、認証構成、解決機などのカスタム定義を即座に再適用・復元します。"
      },
      {
        name: "ヘルプを表示 (Help Guide)",
        description: "現在ご覧いただいている本ヘルプマニュアルをポップアップ起動します。機能リファレンスとしていつでも呼び出し可能です。"
      },
      {
        name: "言語切り替え (Languages)",
        description: "UIの表示言語を【日本語】と【英語 (English)】の間で瞬時に相互切り替えします。ヘルプの中身やAIプロンプト、各種ボタンの説明文も自動同期されます。"
      },
      {
        name: "サムネイル複数選択チェック (丸型チェックボタン)",
        description: "各画像サムネイルの左上にマウスカーソルを合わせる（または長押し・複数タッチする）と出現する丸付きチェック。スタッキング対象として追加・除外を任意で管理できます。"
      },
      {
        name: "選択解除 (Clear Selection)",
        description: "複数選択時、パス表示の右横に「◯枚選択中」の表示と共に現れます。クリックすると全選択状態が瞬時にクリアされ、個別ファイルの通常プレビュー閲覧モードに戻ります。"
      },
      {
        name: "スタッキングを実行 (Execute Stacking)",
        description: "上記の複数選択チェックボックスで2枚以上の天体写真を選択すると出現します。クリックすると全自動で天体整準アライメント・ノイズリダクション・マージ合成処理を行います。"
      },
      {
        name: "マニュアル画像調整：明るさ (Brightness)",
        description: "プレビュー画面の左側または底部のスライダー群。画像の光レベルをマニュアル調整します。"
      },
      {
        name: "マニュアル画像調整：コントラスト (Contrast)",
        description: "天体と宇宙空間背景のコントラストを強調。星雲の淡いガスの境界、銀河の腕の暗黒帯を際立たせるための基礎調整です。"
      },
      {
        name: "マニュアル画像調整：ガンマ (Gamma)",
        description: "輝度分布を非線形に補正。星の輝度のサチュレーションを抑えたまま、星雲部の暗いシグナル・中間調だけを押し上げたい天体現像に不可欠なスライダーです。"
      },
      {
        name: "マニュアル画像調整：彩度 (Saturation)",
        description: "天体のアンドロメダや星林の赤いHαガス、青い反射星雲、星自体のスペクトル色の表現幅（カラフルさ）を直感的に増減調整します。"
      },
      {
        name: "マニュアル画像調整：露出 (Exposure)",
        description: "画像全体のデジタル露出シミュレーションレベルを操作します。微細な構造を検出しやすくするための明るさの下支えに活用します。"
      },
      {
        name: "レベル補正：シャドウ点 (Black Point)",
        description: "階調ヒストグラムの暗部の基準点を設定。夜空の背景色を引き締め（真っ黒ではなく、ほんのりニュートラルグレーへ）、街明かりによるカブリ（光害）をカットするのに極めて有効です。"
      },
      {
        name: "レベル補正：ハイライト点 (White Point)",
        description: "階調ヒストグラムの極明部の基準値を調整。明るい部分のレベルを引き上げることで、画像中央にある明るい天体核心部の階調を引き伸ばします。"
      },
      {
        name: "カラー反転トグル (Invert Image Color)",
        description: "画像の明るさ・色相を反転し、ネガポジを逆にします。FITSやRAW画像における超微細な彗星のガス（尾）、小惑星の微細な光点、非常にかすかな超新星の残骸の同定力・存在検知力を倍加させます。"
      },
      {
        name: "Plate Solving 構成サーバー切り替え(Server Mode)",
        description: "【Local】にすると、ローカル環境で立ち上がっているアストロメトリ解決器を利用し、【Remote】にすると、外部パブリックインターネットの解決器を切り替えて要求を処理します。"
      },
      {
        name: "Plate Solve を開始 (Solve Button)",
        description: "設定されたソルバーに対し、現在表示中の画像データ、または指定された関心領域（ROI）の星野情報を送信。解析結果のWCS座標データを自動的にロード・反映します。"
      },
      {
        name: "AI天文現像命令プロンプト送信 / チャット",
        description: "Gemini AIの入力欄。自分で入力した命令の実行や、星空の解説要求ができます。また、「星雲強調」「極限シグナル抽出」「ノイズカット」などの天文用クイック提案キーも配置されています。"
      },
      {
        name: "保存 / エクスポート (Save Button)",
        description: "現像調整、AI補正、またはスタッキングによって新規作成された、現在プレビューに写っている「天体画像」を、ご希望の保存形式（JPEG、TIFF、FITS）を選択してローカルへ保存ダウンロードします。"
      }
    ],
    formatsTitle: "💾 対応書き込み・読み込みファイル形式",
    formats: {
      read: [
        "FITS / FIT形式 (.fits, .fit - 天文学共通のオリジナル標準フォーマット。16-bit/32-bitモノクロやベイヤー配列カラーを含むあらゆるRAWデータの読込に対応。天体の座標位置情報を示すWCSヘッダーも同時にパース・解釈可能)",
        "TIFF / TIF形式 (.tiff, .tif - 16-bit/24-bit/32-bitの非圧縮・ロスレス超広ダイナミックレンジ画像データ。他天体ソフトで現像したグラフィックデータとの相互受け渡しに対応)",
        "JPEG / PNG / WEBP形式 (.jpg, .jpeg, .png, .webp - ブラウザ標準で表示可能なロスあり・なし一般グラフィックフォーマット)"
      ],
      write: [
        "JPEG形式 (.jpg - デバイス間での閲覧、印刷、SNS・インターネット共有に最適な最軽量・汎用の基本カラーファイルフォーマット)",
        "TIFF形式 (.tiff - スタースタックや現像後の階調を損なわずにPhotoshop、PixInsightなどの高精度編集ソフトウェアへ非圧縮のまま16ビット/24ビット/48ビットで引き継ぐための最高画質データ)",
        "FITS形式 (.fits - WCS解析座標や各種撮像機器ヘッダー情報、露出メタデータを内包した、他の天体解析・測光・変光星観測ツールで直接読み込み可能な科学研究標準フォーマット)"
      ]
    }
  },
  en: {
    title: "Celestial Viewer + AI Complete Help Guide",
    featuresTitle: "💫 Key Astronomical Capabilities",
    features: [
      {
        title: "Multi-Frame Live Stacking",
        description: "Select multiple astro-images (FITS, TIFF, JPEGs) from the grid and click 'Execute Stacking'. The pipeline automatically runs celestial alignment (sub-pixel shift & rotation correction), cosmic-ray / hot-pixel rejection, multi-frame average stacking, dynamic background gradient flattening, and histogram stretch tuning. Any corrupted, extremely blurry, or mismatched frames that cannot be registered are automatically discarded and skipped to guarantee a high-SNR pristine result."
      },
      {
        title: "Advanced AI Development (Gemini Integration)",
        description: "Integrates cutting-edge multimodal AI models (such as Gemini 2.5 Flash / 3.1 Flash). You can communicate with the AI using normal, human phrases—like 'make the faint gas of the nebula pop out', 'flatten background gradient to eliminate light pollution', or 'execute super-resolution on stars.' You can also chat with the AI to ask questions about the astrophysics, coordinates, or discover details of the target catalogs."
      },
      {
        title: "Region of Interest (ROI) - Area Selection & Crop",
        description: "Simply drag over the viewport preview area to designate a specific target rectangular zone (crop area). This allows you to crop and isolate a unique galaxy, nebula, or planetary detail, download only the cropped ROI to local disk, or send specifically that tiny region to Gemini AI to get localized astrophysical identification, astrometry, or enhancements."
      },
      {
        title: "High-Performance Folder Live-Sync",
        description: "Directly monitors your telescope/CMOS acquisition softwares (such as N.I.N.A, Ekos, KStars, ASIAIR) background outputs. The app instantly catches newly written frames during your active capture session and appends them to your browser viewport list. It is the ultimate tool to evaluate raw frames, check sky cloud interference, and keep tabs on live stargazing from a comfortable remote room."
      },
      {
        title: "Automated Astrometrical Plate Solving",
        description: "Extracts star centroids from the sky picture and solves the field of view to locate its exact celestial coordinates: Right Ascension (RA), Declination (DEC), spatial resolution scale, and orientation. Fluidly switch between custom Local Server Solvers or Web Public APIs (Remote Astrometry.net API) based on your outdoor network capability."
      },
      {
        title: "Interactive Astronomical Annotations Overlay",
        description: "After successfully Plate Solving, the app overlays Deep-sky catalog positions (such as Messier, NGC, IC numbers, bright star flags, constellation border boundaries) directly on top of your stars. Instead of standard flat text, each annotation represents a fully interactive and clickable button to deep-dive into catalog objects."
      },
      {
        title: "Deep Astrophysical Database Integrations",
        description: "Clicking on any projected annotation marker expands a highly informative target detailed card. The card queries Wikipedia to provide an automatic digest summary in your chosen language, and features precise one-click external hyperlink jumps to premium databases: the professional astronomer's standard database SIMBAD, Aladin Lite Interactive Sky Map, and regional chart sites."
      }
    ],
    controlsTitle: "🎛️ Complete Icons, Buttons, and Sliders Control Guide",
    controls: [
      {
        name: "Open Folder (FolderOpen Button)",
        description: "Utilizes the browser's safe File System Access API. Securely mounts and batch loads any local directory containing astronomical raw images and FITS/TIFF directories."
      },
      {
        name: "Folder Sync (FolderSync Toggle)",
        description: "Initiates real-time background subdirectory scanning. As new sub-exposure frames are written from the telescope camera, the app updates the thumbnails grid in real-time."
      },
      {
        name: "Search Filter (Search Field)",
        description: "Instantly sifts through huge directories. Type keywords, celestial names, target dates, or file extensions (e.g., FITS, TIFF) to target files in a blink."
      },
      {
        name: "Export Profile (Download JSON Settings)",
        description: "Assembles your celestial parsers config, Solver server variables, Gemini configuration, and UI adjustments into a local JSON settings file."
      },
      {
        name: "Import Profile (Upload JSON Settings)",
        description: "Restores previous JSON profile configurations in one click, bringing back paths, custom ports, key entries, and alignment parameters."
      },
      {
        name: "Show Help (HelpCircle Button)",
        description: "Opens this rich interactive system manual modal window. Accessible anytime for functional guidelines."
      },
      {
        name: "Toggle Languages (Languages Button)",
        description: "Instantly translates the entirety of the application interface, help manual pages, quick buttons, and AI descriptors between Japanese (ja) and English (en)."
      },
      {
        name: "Checkbox Select (Thumbnail Check Button)",
        description: "Appears on hovering over any image thumbnail corner or holding touch. Enables multi-selection toggle to designate inputs for live stacking."
      },
      {
        name: "Clear Selection (Clear Button)",
        description: "Appears in the breadcrumb path line when images are checked. Clean-slates all active selections instantly to return you to standard solo browsing."
      },
      {
        name: "Execute Stacking (Layers Button)",
        description: "Triggers the stacking pipeline over all checked images, computing sub-pixel star translations and rotation offsets, and outputting an average Stack JPG."
      },
      {
        name: "Manual Adjustment: Brightness",
        description: "Adjusts the general digital display gain of the image layout manually. Found in the preview sidebar/bottom sliders."
      },
      {
        name: "Manual Adjustment: Contrast",
        description: "Expands or contracts the dynamic gap between empty space backgrounds and stars. Useful to pull out delicate dark nebula bands and spiral galaxy arms."
      },
      {
        name: "Manual Adjustment: Gamma",
        description: "Modifies the mid-tone distribution non-linearly. Critical in astrophotography to lift faint hydrogen-alpha gas and structural details without bloating stars."
      },
      {
        name: "Manual Adjustment: Saturation",
        description: "Vibrantly pops or reduces colors across the spectrum. Perfect to highlight star temperature hues or vivid gas colors like red and blue."
      },
      {
        name: "Manual Adjustment: Exposure",
        description: "Simulates exposure time alterations in digital domain to highlight details or reveal noise patterns."
      },
      {
        name: "Levels Control: Black Point",
        description: "Establishes the black threshold level. Perfect to darken noisy light-polluted gradients, rendering space to a rich midnight color."
      },
      {
        name: "Levels Control: White Point",
        description: "Sets the max brightness limit. Used to elevate stars, bright planetary cores, and luminous celestial highlights."
      },
      {
        name: "Invert Image Color (Invert Toggle)",
        description: "Flips the luminance values to show negative-positive representations. Crucial for detecting highly elusive comet tails, weak planetary nebulae, or tiny asteroid movements."
      },
      {
        name: "Solving Server Type (Local / Remote Toggle)",
        description: "Choose 'Local' to query your local machine or LAN astrometry engine socket, or select 'Remote' to route solving tasks to public Web API endpoints on the cloud."
      },
      {
        name: "Start Plate Solve (Solve Button)",
        description: "Sends the active visual image or crop area to your selected astrometry engine to compute catalog projection grids and coordinate points."
      },
      {
        name: "AI Astro Chat and Prompts Input",
        description: "Main Gemini interaction box. Enter custom tuning prompts or press quick keys like 'Contrast Boost' or 'Background Flat' to auto-process images via LLM reasoning."
      },
      {
        name: "Download / Export Image (Save Button)",
        description: "Takes the current frame configuration (including adjustments, crop state, Stack result, or AI edits) and downloads it in JPEG, TIFF, or FITS format as preferred."
      }
    ],
    formatsTitle: "💾 Detailed Read and Write File Formats Reference",
    formats: {
      read: [
        "FITS / FIT (.fits, .fit - Standard Astronomical format. Native support for 16-bit and 32-bit raw integer/float monochrome data, bayered matrix color arrays, and extracts spatial coordinate metadata from historical WCS headers)",
        "TIFF / TIF (.tiff, .tif - Lossless tags based graphics. Handles 16-bit, 24-bit, or massive 48-bit color dynamically. Extremely useful for loading results of raw external astro-processing packages)",
        "JPEG / PNG / WEBP (.jpg, .jpeg, .png, .webp - Standard browser-supported formats, ideal for quick references, lightweight logs, or fast local sharing)"
      ],
      write: [
        "JPEG (.jpg - Standard color format. Perfect for web sharing, quick logs, and lightweight astronomical record keeping with light compression rates)",
        "TIFF (.tiff - Pristine 16-bit uncompressed lossless data formats destined to preserve maximum bit depth, letting other desktop image tools like Photoshop continue processing)",
        "FITS (.fits - Professional scientific format bundled with astrometrical solutions (WCS headers), exposure lengths, timestamps, and filter logs directly readable by analysis programs)"
      ]
    }
  }
};

