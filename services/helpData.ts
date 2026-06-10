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
    title: "天体画像ビューア＋AI ヘルプガイド",
    featuresTitle: "💫 主な天体解析・編集機能",
    features: [
      {
        title: "複数選択ライブスタッキング",
        description: "画像一覧で複数の画像（FITS/TIFF/JPEGなど）を選択し、「スタッキングを実行」ボタンをクリックすると、天体の自動位置合わせ（移動・回転アライメント）、ホットピクセル除去、加算平均ノイズ低減、光害グラデーション低減、ヒストグラム動的ストレッチをワンタップで自動適用し、ノイズの極めて少ないノーストレスなスタック画像を生成します。位置合わせが不可能なエラー画像は自動的に除外されるため、スタックの質を崩しません。"
      },
      {
        title: "AI画像処理 (Gemini連携)",
        description: "Gemini 2.5 Flash / 3.1 FlashなどのマルチモーダルAIを活用し、天体画像に合わせたテキスト指示（例:「星雲のガスを強調して背景をフラットにして」「ノイズを消して」）を伝えるだけで、専門的な天文現像ワークフローをAIが推論・適用します。"
      },
      {
        title: "選択範囲の編集",
        description: "プレビュー画面でドラッグ＆ドロップして矩形領域（クロップ範囲）を選択することで、画像全体だけでなく、指定した星雲や星団などの対象天体部分だけをピンポイントで切り抜いてローカルに保存したり、その選択範囲だけをGemini AIで編集・解析したりできます。"
      },
      {
        title: "フォルダ同期機能",
        description: "天体望遠鏡やカメラが新しい画像をキャプチャして指定した観測フォルダに保存するたびに、ビューアが新着ファイルを自動的に検知して一覧に高速同期（自動スキャン）します。リモート/屋外観測でのリアルタイム監視・プレビューに最適です。"
      },
      {
        title: "Plate Solving (アストロメトリ位置解析)",
        description: "撮影した画像に写っている星のパターンから、その天体写真が宇宙の「赤経(RA)・赤緯(DEC)・画角・傾き」のどこを指しているのかを自動解析します。ローカルサーバー(Solvers)またはリモートAPIを瞬時に切り替えて利用可能です。"
      },
      {
        title: "インタラクティブ・アノテーション",
        description: "Plate Solvingに成功すると、写真上に写っている恒星名、星雲・星団のカタログ番号(M番号、NGC、ICなど)や星座の境界線が自動オーバーレイとして重畳描画されます。マークはすべてクリック可能です。"
      },
      {
        title: "強力な外部天体データベース連携",
        description: "アノテーションをクリックすると、詳細カードが展開され、その天体に関する「Wikipedia解説自動要約」が表示されます。さらにワンクリックで、宇宙のインタラクティブマップ「Aladin Lite」、世界標準プロ基準天体データベース「SIMBAD」、および周辺星図にアクセスでき、撮影後の同定と学習をシームレスに行えます。"
      }
    ],
    controlsTitle: "🎛️ ボタン・コントロール説明",
    controls: [
      {
        name: "フォルダを開く (Folder Open)",
        description: "ローカルの画像フォルダ、またはFITS/TIFFファイルが保管された観測フォルダをブラウザ経由で安全に読み込みます。"
      },
      {
        name: "フォルダ同期 (Folder Sync)",
        description: "有効にすると、バックグラウンドでのファイル増減を監視し、新規撮影データを自動的にリストへ追加します。"
      },
      {
        name: "スタッキングを実行 (Execute Stacking)",
        description: "画像サムネイルの左上丸チェックで2枚以上を選択した際に表示されます。自動でアライメントと合成ノイズ除去、グラデーション低減を行います。"
      },
      {
        name: "Plate Solve を開始",
        description: "プレビュー画面の右ナビから実行。アストロメトリ解析を行い、星図座標データを取得します。"
      },
      {
        name: "AI画像編集 / チャット",
        description: "Geminiにプロンプトを送信し、天体写真の輝度調整、特定のガスの強調、超解像、または天体の内容質問を投げることができます。"
      },
      {
        name: "保存 / ダウンロード",
        description: "スタッキングで合成した仮想画像や、AIで現像を施した画像をJPG、TIFF、FITSなどお好みの形式でダウンロード保存します。"
      }
    ],
    formatsTitle: "💾 対応ファイル形式",
    formats: {
      read: [
        "FITS / FIT形式 (.fits, .fit - 天文標準16bit/32bitモノクロ＆カラーRAWデータ)",
        "TIFF / TIF形式 (.tiff, .tif - 16bit高ダイナミックレンジ現像画像)",
        "JPEG / PNG / WEBP形式 (.jpg, .jpeg, .png, .webp - 標準画像形式)"
      ],
      write: [
        "JPEG (.jpg - WebプレビューおよびSNS共有用の標準形式)",
        "TIFF (.tiff - 他の現像・スタックソフトに引き渡すための非圧縮16bit/24bit/32bit高階調形式)",
        "FITS (.fits - 天文解析ソフト対応のメタデータ情報付きヘッダー付き形式)"
      ]
    }
  },
  en: {
    title: "Astronomical Viewer + AI Help Guide",
    featuresTitle: "💫 Key Astronomical Features",
    features: [
      {
        title: "Multi-Image Live Stacking",
        description: "Select multiple images (FITS, TIFF, JPEGs) in the thumbnail list and click 'Execute Stacking'. The tool performs automatic star alignment (translation & rotation), hot-pixel rejection, multi-frame averaging noise reduction, background gradient flattening, and dynamic histogram stretching in a single click. Mismatched or non-alignable frames are automatically filtered out to preserve pristine quality."
      },
      {
        title: "AI Processing (Gemini Integration)",
        description: "Using multimodal models like Gemini 2.5 Flash / 3.1 Flash, you can type instructions (e.g. 'enhance the gas of the nebula and flatten the background', 'reduce noise'). The AI interprets instructions and processes the image with appropriate astronomical parameters."
      },
      {
        title: "ROI Selection (Region of Interest Crop)",
        description: "Drag over the preview canvas to specify a rect region (crop area). You can crop the ROI to save locally or pass only this region to Gemini AI to focus edits or retrieve localized object analysis."
      },
      {
        title: "Folder Auto-Synchronization",
        description: "When enabled, it monitors your telescope/camera storage output. Any newly saved frames are instantly detected and updated on the viewport grid for comfortable live-viewing during active astrophotography sessions."
      },
      {
        title: "Plate Solving (Astrometrical Pointing)",
        description: "Analyzes the star field distribution pattern to identify the target coordinates (Right Ascension, Declination), telescope field of view (FOV), and rotation angle. Seamlessly supports local solver nodes or remote engines."
      },
      {
        title: "Interactive Annotations",
        description: "Upon successful Solving, astronomical catalog markers (Messier, NGC, IC, brightest star names, constellation boundaries) are drawn on the photo. Every overlay marker is fully hoverable and clickable."
      },
      {
        title: "External Astro Database Links",
        description: "Clicking an annotation retrieves a quick summary retrieved from Wikipedia, and provides hyperlinks to professional networks like 'Aladin Lite' celestial deep map, the 'SIMBAD' Astronomical Database, and surrounding charts."
      }
    ],
    controlsTitle: "🎛️ Icon & Control Descriptions",
    controls: [
      {
        name: "Open Folder",
        description: "Safely reads files from your local astrophotography folder, instantly parsing heavy FITS and TIFF structures."
      },
      {
        name: "Folder Sync",
        description: "Enables background background polling to detect newly acquired telescope frames and syncs them automatically."
      },
      {
        name: "Execute Stacking",
        description: "Appears when 2 or more files are selected. Automates alignment, noise reduction, and gradient subtraction."
      },
      {
        name: "Start Plate Solve",
        description: "Triggers the astrometrical algorithm via the preview panel UI to identify cosmic locations and celestial names."
      },
      {
        name: "AI Image Editor / Chat",
        description: "Prompts Gemini to enhance nebula contrast, denoise background, or analyze the structure of the captured object."
      },
      {
        name: "Save / Download",
        description: "Saves virtual stacked files or AI-enhanced images to standard JPGs, high-fidelity TIFFs, or metadata-preserving FITS."
      }
    ],
    formatsTitle: "💾 Supported File Formats",
    formats: {
      read: [
        "FITS / FIT (.fits, .fit - Standard Astronomical 16bit/32bit raw files, monochrome & color)",
        "TIFF / TIF (.tiff, .tif - 16bit high dynamic range processed files)",
        "JPEG / PNG / WEBP (.jpg, .jpeg, .png, .webp - Standard browser images)"
      ],
      write: [
        "JPEG (.jpg - Compact sharing format)",
        "TIFF (.tiff - HDR 16-bit uncompressed lossless data)",
        "FITS (.fits - Astronomy format wrapped with WCS coordinates header)"
      ]
    }
  }
};
