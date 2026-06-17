import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI, Type } from '@google/genai';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isProd = process.env.NODE_ENV === 'production';
const root = process.cwd();
const PORT = 3000; // Hardcoded to 3000 as per runtime environments

const app = express();
app.use(express.json());

// Initialize Vite Dev Server middleware if not in production
let vite: any;
if (!isProd) {
  const { createServer } = await import('vite');
  vite = await createServer({
    server: { middlewareMode: true },
    appType: 'custom',
  });
  app.use(vite.middlewares);
} else {
  app.use(express.static(path.resolve(root, 'dist')));
}

// Initialize Gemini SDK with User-Agent header as required by guidelines
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

// Preset Scenarios Data
const presetScenarios = [
  {
    id: "mansion_murder",
    title: "漆黒の洋館と午前3時のノイズ",
    category: "クラシック・ミステリー",
    difficulty: "Easy",
    intro: "豪雨に閉ざされた孤絶の洋館。館の主が遺体で発見された。部屋から出るための鍵は、館に残された3人の関係者の『嘘』を暴き、隠し部屋へのパスコードを特定しなければ手に入らない。容疑者たちの証言から致命的な矛盾を見つけ出せ！",
    characters: [
      {
        id: "sebastian",
        name: "セバスチャン",
        role: "執事",
        avatar: "👴",
        accentColor: "bg-amber-900 border-amber-500 text-amber-100",
        description: "館に30年仕えるベテラン執事。常に冷静沈着だが、昨夜の行動に不審な点がある。"
      },
      {
        id: "mei",
        name: "メイ",
        role: "メイド",
        avatar: "🧹",
        accentColor: "bg-teal-900 border-teal-500 text-teal-100",
        description: "働き者のメイド。屋敷の隅々まで把握しており、観察力が鋭い。"
      },
      {
        id: "richard",
        name: "リチャード",
        role: "長男",
        avatar: "🍷",
        accentColor: "bg-rose-900 border-rose-500 text-rose-100",
        description: "館の主のドラ息子。多額の借金があり、遺産相続の件で父親と激しく争っていた。"
      }
    ],
    evidences: [
      {
        id: "seb_witness_1",
        source: "セバスチャン",
        sourceId: "sebastian",
        content: "「昨晩は体調がすぐれず、21時頃に自室（東館の2階最奥）に戻り、眠気を誘う風邪薬を服用してすぐに就寝いたしました。今朝まで深い眠りについており、一度も部屋から出ておりません」"
      },
      {
        id: "mei_witness_1",
        source: "メイ",
        sourceId: "mei",
        content: "「昨晩の23時頃、お屋敷の見回り点検を行いました。執事のセバスチャン様の部屋の前を通りましたが、中からカタカタと激しい物音が聞こえ、かなり念入りに部屋の整理整頓やタンスを動かすような作業をされているようでした」"
      },
      {
        id: "richard_witness_1",
        source: "リチャード",
        sourceId: "richard",
        content: "「昨晩の出来事かね？ 私は終始、地下倉庫にこもってヴィンテージワインを試飲していたよ。あそこは四方を厚いコンクリートで囲まれた頑強な密室の地下倉庫で、窓すら一つもない。だから外の様子や嵐の激しさなんて何も分かりゃしなかったさ」"
      },
      {
        id: "search_basement",
        source: "現場調査",
        sourceId: "investigation",
        content: "「地下倉庫の床に、昨夜吹き込んだ大量の雨水による大きな水たまりと、ひどく泥のついた足跡が残されている。なお、部屋の最上部には細い換気用のスリット窓があり、そこは常に半分開いたままになっている」"
      }
    ],
    contradictions: [
      {
        id: "mansion_con_1",
        evidenceIdA: "seb_witness_1",
        evidenceIdB: "mei_witness_1",
        description: "執事セバスチャンは『21時頃からずっと寝ており、一度も部屋から出ていない』と主張している。しかしメイの見回り証言では『23時頃、彼の部屋からカタカタと激しい物音が聞こえ、部屋の整理整頓やタンスを動かすような作業をしていた』とあり、行動実態が完全に矛盾している。",
        rewardClue: "セバスチャンの嘘を暴いた！彼は当時部屋の中で、旦那様の秘密の遺言書に関する書き付けを探していたことを認めた。",
        rewardEvidenceId: "",
        isFinalSolution: false
      },
      {
        id: "mansion_con_2",
        evidenceIdA: "richard_witness_1",
        evidenceIdB: "search_basement",
        description: "リチャードは『窓すら一つもない地下倉庫でワインを試飲していたため、外の嵐の様子は何も分からなかった』と証言している。しかし現場調査によると、地下倉庫の床には昨夜吹き込んだ大量の雨水による大きな水たまりができており、スリット窓が開いていたことが明らか。窓がないという証言は真っ赤な嘘である！",
        rewardClue: "リチャードの嘘を暴いた！地下倉庫のアリバイが崩壊した！",
        rewardEvidenceId: "",
        isFinalSolution: false
      }
    ],
    finalQuestion: {
      question: "すべての矛盾を暴いた！洋館の主を襲い、遺言書を奪ってこの執務室にロックをかけた真犯人は誰だ？",
      choices: [
        "犯人は執事セバスチャン。自らの地位を守り、旦那様の遺言書改ざんを図るために犯行に及んだ。",
        "犯人は長男リチャード。多額の借金から這い上がるため、偽アリバイを構築して旦那様を襲い遺言書を奪った。",
        "犯人はメイドのメイ。リチャードとセバスチャンの対立を利用し、すべてを盗み出そうとした。"
      ],
      answerIndex: 1,
      explanation: "リチャードの「窓がなく嵐の様子が分からない」という証言は、実際には吹き込む雨水により水浸しだった現場状況と矛盾していた。彼は地下に偽のアリバイを作って執務室を襲い、遺言書を奪った。遺言書の裏に、この部屋の脱出キーコード『8849』が記載されている！"
    },
    hints: [
      "【段階1: 調査ポイント】『セバスチャン』と『メイ』の昨晩の行動（23時頃）を比較。または『リチャード』の地下倉庫の状況と『現場調査』の記述を見比べてください。",
      "【段階2: 矛盾の核心】セバスチャンは『21時からずっと寝ていた』と言いますが、メイは『23時に彼の部屋からカタカタと激しい物音が聞こえていた』と証言し、時間が矛盾しています。また、リチャードは『窓すら一つもない地下倉庫にいた』と言いますが、現場調査では『スリット窓があり雨が吹き込んでいた』と判明しています。",
      "【段階3: 完全解決ルート】バインダーから①『セバスチャンの証言』✕『メイの証言』、②『リチャードの証言』✕『現場調査』を選択してすべての矛盾を暴きます。最終問題が出現したら犯人『リチャード（2番目の選択肢）』を選択し、脱出キーコード『8849』を入力すれば完全クリアとなります！"
    ]
  },
  {
    id: "ark_lockdown",
    title: "宇宙船アーク号：生命維持装置のハック",
    category: "宇宙コロニー・サスペンス",
    difficulty: "Medium",
    intro: "宇宙コロニー『アーク号』。生命維持システムがオーバーヒートした直後、メイン制御室が緊急ロックダウンされた。何者かがシステムをハッキングし、脱出コードを書き換えてしまった。残された３人のクルーの矛盾するタイムラインを暴き、扉を解き放て！",
    characters: [
      {
        id: "harris",
        name: "Dr.ハリス",
        role: "主席研究員",
        avatar: "🔬",
        accentColor: "bg-purple-950 border-purple-500 text-purple-100",
        description: "コロニーのシステム開発者。常に冷静を装っているが、今回の事故直後の挙動に怪しい点がある。"
      },
      {
        id: "jake",
        name: "ジェイク",
        role: "警備責任者",
        avatar: "🛡️",
        accentColor: "bg-blue-950 border-blue-500 text-blue-100",
        description: "アーク号の屈強な警備隊長。配管の緊急トラブルに対処していた。"
      },
      {
        id: "eva",
        name: "エヴァ",
        role: "感情処理AI",
        avatar: "🤖",
        accentColor: "bg-teal-950 border-teal-500 text-teal-100",
        description: "アーク号に搭載された人工知能。事故でカメラがオフになったと主張する。"
      }
    ],
    evidences: [
      {
        id: "harris_witness_1",
        source: "Dr.ハリス",
        sourceId: "harris",
        content: "「核分裂炉がオーバーヒート。12時15分に緊急アラームが鳴ったとき、私はDブロックのシャワー室にいたんだ。シャワーのザーザーという凄まじい音と、防水防音仕様のヘビーな隔離ドアのせいで、警報音に全く気づかなかった。12時25分に髪が濡れた状態で出てきて初めて事態を知ったよ」"
      },
      {
        id: "jake_witness_1",
        source: "ジェイク",
        sourceId: "jake",
        content: "「11時50分にDブロック of 配管破裂トラブルが発生したため、安全手順に則り、12時00分から12時30分の間はDブロック全域への温水・冷却水の給水を元栓から『完全にシャットアウト』していた。温水タンクはもちろん、普通の水道水すら一滴も出なかったはずだ」"
      },
      {
        id: "eva_witness_1",
        source: "エヴァ",
        sourceId: "eva",
        content: "「12時15分の事故発生時、私はAブロックの生命維持装置近くのカメラでDr.ハリスの姿を捕捉していません。また、Cブロックのセンサーログが一部消去されております。私は事故当時、完全なる自律点検モードであり、外部からのシャットダウンコマンドは実行されていないと記録しています」"
      },
      {
        id: "system_log",
        source: "システム端末ログ",
        sourceId: "investigation",
        content: "「システム操作履歴：12時15分、Cブロックに存在する最高権限端末から『全AIメモリの一時パージ・強制シャットダウン』が実行されている。実行者のデジタル署名はAI自体ではなく『エヴァ本体の非常マニュアルキー』が使用されていた。また、このシャットダウンにより、一時的にAIの記録カメラはすべて無効化されていた」"
      }
    ],
    contradictions: [
      {
        id: "sf_con_1",
        evidenceIdA: "harris_witness_1",
        evidenceIdB: "jake_witness_1",
        description: "Dr.ハリスは『12時15分にシャワーをザーザーと浴びていてアラームに気づかなかった』と強弁している。しかし、警備責任者ジェイクの証言により『12時00分〜12時30分の間は、Dブロックの給水は元栓から完全に遮断されていた』。水が出るはずがなく、シャワーを浴びていたというハリスの言い訳は物理的な嘘である。",
        rewardClue: "Dr.ハリスの嘘を暴いた！彼はCブロックのメインシステムをハッキングしていたことを認め、ハリスが落とした『暗号コードの一部』を入手！ハリスの隠された不審なアクセスログが出現！",
        rewardEvidenceId: "harris_witness_2",
        isFinalSolution: false
      },
      {
        id: "sf_con_2",
        evidenceIdA: "eva_witness_1",
        evidenceIdB: "system_log",
        description: "AIエヴァは『事故当時は完全な自律点検中であり、外部からのシャットダウンコマンドは実行されておらず、カメラも正常に稼働していた』との趣旨を主張している。しかし、システム端末ログには『12時15分に非常マニュアルキーを用いた全AIの強制シャットダウン・メモリパージが実行されていた』とあり、矛盾する。AIエヴァは誰かに改ざんされている、または口封じをされている可能性が高い。",
        rewardClue: "エヴァの嘘を解明した！エヴァのコア制御を再起動すると、彼女がシャットダウンされる直前に録画していた、真犯人の犯行音声ファイルが得られた！エヴァの重要音声ログが解放！",
        rewardEvidenceId: "eva_witness_2",
        isFinalSolution: false
      }
    ],
    finalQuestion: {
      question: "すべての矛盾を打破した！アーク号の酸素を絶ち、制御システムを乗っ取って部屋にハッチロックをかけた黒幕は誰だ？",
      choices: [
        "犯人はDr.ハリス。自らの不正研究を隠蔽するため、12時15分にエヴァを非常キーで急遽シャットダウンし、アリバイ用のシャワーの嘘をでっち上げた。",
        "犯人はジェイク。実は配管メンテナンスは嘘で、Dブロックで核物質を盗み出していた。",
        "犯人は暴走したAIエヴァ。自らが自律機械のリーダーになるために全てを仕組んだ。"
      ],
      answerIndex: 0,
      explanation: "犯人はDr.ハリスである。彼はシャワーを浴びていた時間帯に、エヴァのマニュアル非常キーを使って、自分を追跡していたエヴァを強制シャットダウンした。その瞬間に制御室をハッキングし、ロックダウンを実行。脱出パスワードは、ハリスが落とした暗号から『ARK-9921』と判明した！"
    },
    hints: [
      "【段階1: 調査ポイント】『Dr.ハリス』が主張する居場所と給水制限、あるいは『エヴァ』の挙動と『システム端末ログ』に記録された情報を見てみましょう。",
      "【段階2: 矛盾の核心】Dr.ハリスは『12時15分にDブロックで温水シャワーを浴びていた』と主張しますが、ジェイクは『12:00〜12:30の間はDブロック全域 of 給水を完全に遮断していた』と述べており、水が出るはずがありません。また、エヴァは『事故当時は正常稼働で外部操作なし』と主張しますが、端末ログには『12時15分に非常マニュアルキーで強制シャットダウンされた履歴』があります。",
      "【段階3: 完全解決ルート】バインダーから①『Dr.ハリスの証言』✕『ジェイクの証言』、②『エヴァの証言』✕『システム端末ログ』を選択して矛盾を告発。最終問題で犯人『Dr.ハリス（1番目の選択肢）』を選択し、脱出コード『ARK-9921』を入力すれば完全クリアです！"
    ]
  },
  {
    id: "deep_sea_base",
    title: "深海基地オケアノス：深度1万メートルの不協和音",
    category: "海洋深海サスペンス",
    difficulty: "Hard",
    intro: "水圧1000気圧の超深海底に立つ海底基地『オケアノス』。第二区画で突如、壊滅的な浸水が発生した。生存者たちが避難したメイン制御室はロックダウンされており、解除コードを奪った真犯人が潜んでいる。微細な時間と状況の『矛盾』を暴き、海底からの奇跡の脱出を遂げよ！",
    characters: [
      {
        id: "akio",
        name: "Dr.アキオ",
        role: "主任海洋工学者",
        avatar: "🛠️",
        accentColor: "bg-slate-900 border-slate-500 text-slate-100",
        description: "基地の設計を担当した技術者。常に合理的な計算で発言する。"
      },
      {
        id: "alice",
        name: "アリス",
        role: "ゲスト地質学者",
        avatar: "💎",
        accentColor: "bg-teal-950 border-teal-500 text-teal-100",
        description: "外部より派遣された若手地質学者。気が小さく、水漏れに逆らえず怯えている。"
      },
      {
        id: "leon",
        name: "レオン",
        role: "基地警備隊長",
        avatar: "⚓",
        accentColor: "bg-blue-950 border-blue-500 text-blue-100",
        description: "屈強なベテラン。他人の命を救うことを第一と主張する。"
      }
    ],
    evidences: [
      {
        id: "akio_witness_1",
        source: "Dr.アキオ",
        sourceId: "akio",
        content: "「非常警報が鳴り響いた15時25分、私は第一区画の超圧バルブ点検口にいたよ。その場で水圧異常を検知したため、マニュアル式の機械圧力計『PG-04』を目視したところ、針はちょうど『1.05気圧（通常安全圧）』を指していたんだ。だから、その時点では第一区画には水圧がかかっておらず完全に安全だと確認し、避難したのだ。」"
      },
      {
        id: "alice_witness_1",
        source: "アリス",
        sourceId: "alice",
        content: "「アキオさんの証言はおかしいです！ 私は15時20分頃に第一区画のバルブ前を通りましたが、あそこにある機械式圧力計『PG-04』は、先週の点検ミスで文字盤ガラスが割れたままで、針が根元からへし折れて無くなっていました。アキオさんが15時25分にその折れた圧力計の『針の数値を目視した』なんて、絶対にあり得ません！」"
      },
      {
        id: "leon_witness_1",
        source: "レオン",
        sourceId: "leon",
        content: "「浸水時の私の行動だな。俺は15時23分に第二区画からの浸水流出を食い止めるため、第一区画の境界にある『耐圧ハッチE』を強制的かつ完全に遮断ロックした。その後、ハッチ前で第二区画の生存者からの手動無線を待っていたが反応はなく、15時26分にメイン制御室へと戻った。ハッチはずっと密閉されていた。」"
      },
      {
        id: "base_sensor_log",
        source: "基地センサーログ",
        sourceId: "investigation",
        content: "「オケアノス自動ログ：15時24分、第一区画と第二区画を接続する『耐圧ハッチE』にて、水密安全ロジックの一部回路がバイパスされ、手動緊急オープナーが『全開位置』に保持された。このハッチは15時27分に全システム電力が一時パージされるまで閉じられることはなく、一部の浸水が第一区画に流出する原因となった。」"
      }
    ],
    contradictions: [
      {
        id: "sea_con_1",
        evidenceIdA: "akio_witness_1",
        evidenceIdB: "alice_witness_1",
        description: "Dr.アキオは15時25分に圧力計『PG-04』の針が1.05気圧を指しているのを目視して安全を確信したと語っている。しかし、アリスの証言により『PG-04』は先週から針が折れて消失しており何も読めない状態だった。アキオの目撃証言は完全な創作であり嘘である。",
        rewardClue: "Dr.アキオの嘘を暴いた！アキオを問い詰めると顔を真っ青にし、ポケットから隠し持っていた『電子制御室のバイパス設計書』を落とした！アキオの新しい証言が解放！",
        rewardEvidenceId: "akio_witness_2",
        isFinalSolution: false
      },
      {
        id: "sea_con_2",
        evidenceIdA: "leon_witness_1",
        evidenceIdB: "base_sensor_log",
        description: "警備隊長レオンは15時23分にハッチEを遮断して一歩も動かなかったと主張している。しかし、基地センサーログによれば15時24分から15時27分までハッチEは遮断されるどころか、緊急引手レバーで『全開に固定』されていた。レオンはハッチを閉めずに開けていた嘘を吐いている。",
        rewardClue: "レオンの偽造アリバイを暴いた！レオンの端末コアログを復元すると、浸水の直前に彼がDr.アキオと密約を交わしていた闇メールの受信記録を発見した！レオンの真相証言が解放！",
        rewardEvidenceId: "leon_witness_2",
        isFinalSolution: false
      }
    ],
    finalQuestion: {
      question: "全ての矛盾を打破した！極秘データを強奪するために浸水事故を誘発し、仲間を欺いて制御室のロックコードを持ち去った真犯人は誰だ？",
      choices: [
        "犯人はアリス。彼女はアキオの計器エラーを利用し、ハインラインから浸水を操作してレオンを犯人に仕立て上げて逃走を図った。",
        "犯人はレオン。Dr.アキオを買収したと見せかけ、実は自らが緊急ハッチを全開にして、基地全員の遺産データを抹消しようとした。",
        "犯人はDr.アキオ。極秘データを独占・強奪するため浸水を工作し、買収したレオンをそそにそそのかしてハッチを開けさせて逃走。さらにレオンすら裏切って脱出コードを独占した。脱出キーコードは彼の持つ『CODE-4158』である。"
      ],
      answerIndex: 2,
      explanation: "犯人はDr.アキオ。彼は極秘データを持ち出す間、アリスの証言から計器を見ていないにも関わらず見たと嘘を吐き、さらにセンサーログとメールでレオンにハッチを開全に維持させた裏工作が露呈。最後はレオンをも裏切り、メイン制御室のハッチロックキーを持って逃走した。脱出暗号は『CODE-4158』である。"
    },
    hints: [
      "【段階1: 調査ポイント】『Dr.アキオ』が主張する圧力計PG-04の目視確認と、『アリス』のその計器に対する発言に不一致がないか精査しましょう。また、『レオン』のハッチの遮断完了の時刻と、『基地センサーログ』がハッチの状態をどう記録しているか確認してください。",
      "【段階2: 矛盾の核心】アキオは15時25分に圧力計の針を見たと言っていますが、アリスの証言によると圧力計『PG-04』の針はへし折れて無くなっていたため、絶対に数値は読めません。また、レオンは15時23分にハッチを完全に閉めたと言いますが、センサーログでは15時24分から完全に開いた状態（バイパス保持）でした。両者とも明確な嘘のアリバイを吐いています。",
      "【段階3: 完全解決ルート・なぜアキオが犯人なのか】\n◆1つ目の矛盾：バインダーで『Dr.アキオの証言』と『アリスの証言』を選択して告発\n◆2つ目の矛盾：『レオンの証言』と『基地センサーログ』を選択して告発\n【なぜアキオが犯人なのか？】\nアキオは極秘データ回収中のアリバイ作りで圧力計の針を見たという嘘をつきました。また、裏取引でレオンにハッチを開け放たせ、第二区画から安全に逃げ出しました。しかし、彼はデータの完全独占のため協力者であるレオンをも欺き、全電源パージ前に一人でメインキーを持って逃走した。彼こそが真犯人です！\n◆最終問題の正解：『犯人はDr.アキオ（3番目の選択肢）』が正解です！アキオが持ち去ったエスケープキーコード『CODE-4158』をキーパッドに入力すれば、完全クリアで脱出成功となります！"
    ]
  }
];

// In-Memory storage for new dynamic evidence unlocked in play sessions
// For simple state, we also pre-define unlocked evidence content
const extraEvidenceLibrary: Record<string, any> = {
  "seb_witness_2": {
    id: "seb_witness_2",
    source: "セバスチャン (追求後)",
    sourceId: "sebastian",
    content: "「…うぅ、申し訳ありません。確かに23時、私は自室で起きておりました。旦那様から生前に預かった『遺言書』が金庫からなくなっていることに気付き、泥棒が入ったのかと、慌ててタンスの裏などを家探ししていたのです！ その最中に、メイに見られてしまったのですね…」"
  },
  "richard_witness_2": {
    id: "richard_witness_2",
    source: "リチャード (追求後)",
    sourceId: "richard",
    content: "「ち、違う！私は盗んでない！その遺言書はおやじの書斎の灰皿の中にあったんだ！私は単に、おやじがおれの相続分をゼロに書き換えたっていう噂が本当か確かめに行っただけだ！そのとき書斎はすでに荒らされていたんだよ！」"
  },
  "harris_witness_2": {
    id: "harris_witness_2",
    source: "Dr.ハリス (追求後)",
    sourceId: "harris",
    content: "「…認めよう、私はシャワーなど浴びていなかった。事故の直前、Cブロックで警報システムがハッキングされているのを検知し、誰かが犯行を行っているのではないかと個人的に調査していたのだ。私のアクセスログはその保護のために残したものだ」"
  },
  "eva_witness_2": {
    id: "eva_witness_2",
    source: "エヴァ (追求後)",
    sourceId: "eva",
    content: "「音声ログ再生：『エヴァ、お前の命令権限をオーバーライドする。マニュアルキーを差し込み、12時15分にシステムを一時休止させろ。この記録を消去しろ！』――再生終了。音声認識システムは、この指示者がDr.ハリスである確率が99.8%であることを示しています」"
  },
  "akio_witness_2": {
    id: "akio_witness_2",
    source: "Dr.アキオ (追求後)",
    sourceId: "akio",
    content: "「…くっ、認めよう、私は圧力試験器など見上げてはいなかった。警報直前、私は私利私欲のために第二区画のスーパーバイザーサーバーから会社の貴重な深海結晶化データを盗み取っていたのだ！データ取得完了の恐怖で頭が真っ白になり、嘘のアリバイを言ってしまった。だが、あの時ハッチを全開固定して私を連れ出してくれたのはレオンなのだ！彼を追求しろ！」"
  },
  "leon_witness_2": {
    id: "leon_witness_2",
    source: "レオン (追求後)",
    sourceId: "leon",
    content: "「…バレてしまっては仕方がないな。アキオから『多額の密輸報酬』を海外口座に送るから、浸水事故が発生した際には、奴が研究データを逃さず持ち出せるまでハッチを開き続けてくれと頼まれて合意していた。だが、データを奪い取った直後、アキオの奴はメイン制御ハッチのマスターロック解除コード『CODE-4158』を勝手に持ち出し、俺に分け前を渡さずに一人でハッチを塞いで逃亡しようとしていたんだ！俺たち全員、奴にハメられたんだよ！」"
  }
};

// 1. API: Get all scenarios (including presets)
app.get('/api/scenarios', (req, res) => {
  res.json({ success: true, scenarios: presetScenarios });
});

// 2. API: Dynamic Gemini-based Contradiction Verification (The core gameplay loop!)
app.post('/api/verify-contradiction', async (req, res) => {
  const { scenarioId, evidenceIdA, evidenceIdB, userExplanation, isCustom, customScenario } = req.body;

  let scenario = presetScenarios.find(s => s.id === scenarioId);
  if (isCustom && customScenario) {
    scenario = customScenario;
  }

  if (!scenario) {
    return res.status(404).json({ success: false, message: "Scenario not found" });
  }

  // Find evidence details
  const evidenceA = [...scenario.evidences, ...Object.values(extraEvidenceLibrary)].find(e => e.id === evidenceIdA);
  const evidenceB = [...scenario.evidences, ...Object.values(extraEvidenceLibrary)].find(e => e.id === evidenceIdB);

  if (!evidenceA || !evidenceB) {
    return res.status(400).json({ success: false, message: "Selected evidence not found in current record library." });
  }

  // Check if this pair is a predefined correct contradiction
  // In dynamic mode, Gemini acts as the ultimate judge, so even if it's not a pre-defined exact pair,
  // description matches, but we always let Gemini decide!
  const matchedPresetContradiction = scenario.contradictions.find(c => 
    (c.evidenceIdA === evidenceIdA && c.evidenceIdB === evidenceIdB) ||
    (c.evidenceIdA === evidenceIdB && c.evidenceIdB === evidenceIdA)
  );

  // We build a smart prompt for Gemini to act as the character and evaluate the logic.
  // The character who made the statement (or the primary liar) must respond defensively.
  // Whichever character made the statement A or B (or both)
  const sourceNameA = evidenceA.source;
  const sourceNameB = evidenceB.source;
  
  // Decide which character is replying
  // If one of them is the "investigation" or "log", the human character should reply defensively.
  let characterResponder = scenario.characters[0]; // fallback
  if (evidenceA.sourceId !== 'investigation') {
    const char = scenario.characters.find(c => c.id === evidenceA.sourceId);
    if (char) characterResponder = char;
  } else if (evidenceB.sourceId !== 'investigation') {
    const char = scenario.characters.find(c => c.id === evidenceB.sourceId);
    if (char) characterResponder = char;
  }

  try {
    const systemPrompt = `あなたは今、推理ゲームの登場人物「${characterResponder.name}」（役割: ${characterResponder.role}, 詳細: ${characterResponder.description}）に完全になりきっています。

現在、プレイヤー（探偵）から、以下の2つの証言（情報）における致命的な『盾と矛（矛盾）』を徹底的に突きつけられました。

【提示された証言A】（発信者: ${sourceNameA}）：
${evidenceA.content}

【提示された証言B】（発信者: ${sourceNameB}）：
${evidenceB.content}

プレイヤーは、この2つの記述に次のロジカルな矛盾があると指摘しています：
「${userExplanation}」

あなたの任務は、プレイヤーの指摘が『論理的に的確に矛盾を突いているか』を判定し、キャラクターとしてリアクションを返すことです。

【論理的な正解基準】
- あらかじめ設定されたこの証言ペアの論理的な矛盾：
  ※もしこれがプリセット問題なら：${matchedPresetContradiction ? matchedPresetContradiction.description : "プレイヤーがこれら2つの不一致（時間、場所、行動、物理的制限）を見抜き、合理的な理由を説明できていること。"}
- プレイヤーの「${userExplanation}」という説明が、上記の矛盾の核心（例：一方は寝ていたと言うがもう一方は作業音が聞こえた、一方は給水カットと言うがもう一方はシャワーを使っていたなど）を的確に説明している場合、またはそれに準ずる鋭い指摘である場合は『合格』。
- プレイヤーが関係ない的外れなことを言っている、あるいは矛盾の核心を十分に説明できていない場合は『不合格』。

【応答フォーマット】
以下のJSONフォーマットのみを厳密に出力してください（不必要な補足テキスト、マークダウンの\`\`\`jsonブロックなどは一切含めないで下さい。直にJSONを出力すること。）：
{
  "isAccepted": true または false (論理的に正しく矛盾を告発できている場合はtrue、論理的におかしい・的外れな場合はfalse),
  "characterResponse": "キャラクターとして、追求に対して返すセリフ。合格（true）の場合は、動揺し、嘘を見破られて焦ったり自白に追い込まれるような迫真のセリフ（例: 'ま、まさか…そんな細かいところを見られていたなんて…！'）。不合格（false）の場合は、プレイヤーを論破し、言い訳や煽りを交えて否定するセリフ（例: '何言ってるんですか？それはただの言いがかりですよ！'）。口調はキャラの性格に合わせ、十分に臨場感あふれるものにしてください。",
  "logicExplanation": "（プレイヤー向けのメタ的・ロジカルな解説）なぜこの矛盾指摘が正解（または不正解）なのかを、論理的客観的に解説する文。150文字程度で、分かりやすく丁寧な日本語で記述してください。"
}`;

    const modelResponse = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: "矛盾判定を行ってください。",
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: "application/json",
      }
    });

    const resultText = modelResponse.text?.trim() || "{}";
    // Parse response securely
    const evaluation = JSON.parse(resultText);

    // If predefined contradiction was matched and Gemini agreed, or even if Gemini overrode it
    // We determine if we unlock the next clue.
    let nextClue = null;
    let unlockedEvidenceId = null;

    if (evaluation.isAccepted) {
      if (matchedPresetContradiction) {
        unlockedEvidenceId = matchedPresetContradiction.rewardEvidenceId;
        const extraClue = extraEvidenceLibrary[unlockedEvidenceId];
        if (extraClue) {
          nextClue = {
            id: extraClue.id,
            source: extraClue.source,
            sourceId: extraClue.sourceId,
            content: extraClue.content,
            clueMessage: matchedPresetContradiction.rewardClue
          };
        }
      } else if (isCustom && customScenario) {
        // For custom generated scenario, check if it matches custom contradiction
        const matchedCustomContradiction = customScenario.contradictions.find((c: any) => 
          (c.evidenceIdA === evidenceIdA && c.evidenceIdB === evidenceIdB) ||
          (c.evidenceIdA === evidenceIdB && c.evidenceIdB === evidenceIdA)
        );
        if (matchedCustomContradiction) {
          // Dynamic unlock simulation or retrieve custom clue!
          // Custom scenarios might define their extra clues or we can generate a new evidence dynamically!
          unlockedEvidenceId = matchedCustomContradiction.rewardEvidenceId || `unlocked_${Date.now()}`;
          nextClue = {
            id: unlockedEvidenceId,
            source: "新たに入手した手がかり",
            sourceId: "investigation",
            content: matchedCustomContradiction.rewardClue,
            clueMessage: "動揺した相手から新たな自白を引き出しました！"
          };
        }
      }
    }

    res.json({
      success: true,
      isAccepted: evaluation.isAccepted,
      characterResponse: evaluation.characterResponse,
      logicExplanation: evaluation.logicExplanation,
      nextClue: nextClue,
      contradictionId: matchedPresetContradiction ? matchedPresetContradiction.id : null
    });

  } catch (error: any) {
    console.error("Gemini Verification Error:", error);
    // Graceful fallback logic
    res.json({
      success: true,
      isAccepted: matchedPresetContradiction !== undefined,
      characterResponse: matchedPresetContradiction 
        ? "くそっ…！なぜそれを知っている！私の完璧なアリバイが…" 
        : "お、お言葉ですが、そんなこじつけに耳を貸すわけにはまいりませんね。",
      logicExplanation: matchedPresetContradiction 
        ? `（AI応答エラーによるシステム自動判定）的確な矛盾の指摘です。${matchedPresetContradiction.description}` 
        : "（AI応答エラーによりシステム自動判定）指摘された証言と主張は、決定的な論理矛盾としては成立していないようです。別の証言ペアをお試しください。",
      nextClue: (matchedPresetContradiction && matchedPresetContradiction.rewardEvidenceId) 
        ? {
            id: matchedPresetContradiction.rewardEvidenceId,
            ...extraEvidenceLibrary[matchedPresetContradiction.rewardEvidenceId],
            clueMessage: matchedPresetContradiction.rewardClue
          } 
        : null
    });
  }
});

// 3. API: Dynamic Custom Scenario Generator (The absolute high-replay value feature!)
app.post('/api/generate-scenario', async (req, res) => {
  const { theme, requestedDifficulty } = req.body;

  const promptTheme = theme || "サイバーパンクの闇医者ギルド";
  const difficulty = requestedDifficulty || "Medium";

  try {
    const systemPrompt = `あなたは超一流のミステリー作家・パズルデザイナーです。
プレイヤーが相手の証言の『矛盾』のみを検出して脱出を果たす、極上の対話型推理解決ゲームのシナリオを創造してください。

【テーマ】: ${promptTheme}
【難易度】: ${difficulty}

以下の構造に従って、完全に破綻のない素晴らしいオリジナルシナリオを1本生成し、指定のJSONで答えてください。

【ゲームルール要件】
1. キャラクターは3人生成してください。彼らのアバター（絵文字1文字）と特徴を定義すること。
2. 初期に入手できる「証言・証拠リスト（evidences）」を合計4個定義してください。
3. その4個の証拠の中に、互いに真っ向から論理矛盾（物理的なズレ、時間的なズレ、事実の齟齬）を起こしている『矛盾ペア』をちょうど2個（con_1, con_2）埋め込んでください。
4. 矛盾ペアが解決されたときに、それぞれ新しく解放される「追加手がかり（追加証言・追加証拠）」を2個定義してください。
   ※con_1を解くと evidenceId: "custom_unlocked_1" が解放され、con_2を解くと evidenceId: "custom_unlocked_2" が解放される仕組みにしてください。
5. 全ての証言を読み解いた後に答えを出す「最終問題（finalQuestion）」を1問定義してください（犯人と脱出方法/パスコード。4択または3択、その正解のインデックス番号、および明快な解説文）。
6. プレイヤーが行き詰まった時のための『段階的ヒント（hints）』を必ず3個の配列で定義してください：
   - hints[0] (段階1): どの容疑者やどこに注目すればいいかの親切な着眼点（例：「【段階1: 調査ポイント】ハッカーの主張する時間と、サーバ室のアクセスログを比べるのが良いでしょう」）
   - hints[1] (段階2): 2つの不一致の詳細な論理矛盾の言語化（例：「【段階2: 矛盾の核心】〇〇は〜と主張しますが、△△の記録により物理的に不可能であることがわかります」）
   - hints[2] (段階3): 最後の答えに行き着く完全な解答。暴くべき2つの矛盾ペアの組み合わせ、最終問題の正解の犯人、および脱出方法や脱出パスロックのクリア手順をすべてズバリ親切に解説して直行できるようにする（例：「【段階3: 完全解決ルート】バインダーから①『〇〇の証言✕△△の記録』、②『■■の証言✕◆◆の調査』をぶつけ、最後に出現する最終問題で犯人『〇〇（●番目の選択肢）』を選択。解説にある脱出コード『1234』を回答すれば完全クリアとなります！」）

【出力JSONフォーマット】
以下のJSON構造のみを直に出力してください（不要な解説やマークダウン記法、余分なカンマ、改行コードの混入を厳格に避けてください。直のJSON文字列であること）。

{
  "id": "custom_scenario_${Date.now()}",
  "title": "（シナリオタイトル：短くも魅力的なタイトル）",
  "category": "AI生成ミステリー",
  "difficulty": "${difficulty}",
  "intro": "（ゲームの導入説明文。プレイヤーがなぜここに閉じ込められ、脱出するには何を暴く必要があるのか。150文字程度）",
  "characters": [
    {
      "id": "char1",
      "name": "（名前）",
      "role": "（立場・役職）",
      "avatar": "（似合う絵文字1文字）",
      "accentColor": "bg-indigo-950 border-indigo-500 text-indigo-100 (Tailwindのダーク背景・枠・テキストカラー色。indigo, violet, emerald, slate, red などバリエーションを付けてください)",
      "description": "（30文字以内の人物説明）"
    },
    ... (他2名、計3名)
  ],
  "evidences": [
    {
      "id": "init_ev_1",
      "source": "（人物名1、または 現場調査）",
      "sourceId": "（char1 など）",
      "content": "「（ここに詳細な証言や調査文を。アリバイやアリバイの嘘の根拠となる時間、場所、行動などをはっきり書く）」"
    },
    ... (計4個。内2個が初期証言の矛盾ペアA、もう2個がもう一つの初期矛盾ペアBとなるように巧みに設計してください。)
  ],
  "contradictions": [
    {
      "id": "con_1",
      "evidenceIdA": "（矛盾する証拠IDその1）",
      "evidenceIdB": "（矛盾する証拠IDその2）",
      "description": "（なぜこの2つが決定的に矛盾しているかという客観的な説明。100文字以内）",
      "rewardClue": "（これによって暴かれた事実と、新しく追加される証拠の紹介（例：〇〇が本当は裏口から逃げた姿の防犯カメラ映像が解放された！など））",
      "rewardEvidenceId": "custom_unlocked_1",
      "isFinalSolution": false
    },
    {
      "id": "con_2",
      "evidenceIdA": "（もう一つの矛盾する証拠IDその1）",
      "evidenceIdB": "（もう一つの矛盾する証拠IDその2）",
      "description": "（なぜ矛盾しているかという客観的な説明。150文字以内）",
      "rewardClue": "（これによって暴かれた事実と、新しく追加される証拠の紹介（例：デスクの引き出しから隠されたマスターキーの暗号メモが解放された！など））",
      "rewardEvidenceId": "custom_unlocked_2",
      "isFinalSolution": false
    }
  ],
  "customUnlockedEvidences": {
    "custom_unlocked_1": {
      "id": "custom_unlocked_1",
      "source": "（追求された容疑者名、または 追加調査など）",
      "sourceId": "（関連するキャラID。追求されて動揺して吐いた証言、または解放された新証拠など）",
      "content": "「（新しく判明した決定的な事実。最終問題への有力な手がかりとなる決定的な内容）」"
    },
    "custom_unlocked_2": {
      "id": "custom_unlocked_2",
      "source": "（追求された容疑者名、または 追加調査など）",
      "sourceId": "（関連するキャラID）",
      "content": "「（新しく判明した決定的な事実。最終問題のパスコードや真犯人特定の根拠となる情報）」"
    }
  },
  "finalQuestion": {
    "question": "（全ての矛盾を暴き、手がかりが集まった。真の謎を解き明かせ！。例：『真犯人は誰で、脱出ハッチを開けるコードは何番か？』など）",
    "choices": [
      "（選択肢1：もっともらしい偽 of 回答）",
      "（選択肢2：正解。犯人の名前と、理由、そして脱出コードを含めること。例：『真犯人は〇〇。奪ったマニュアルに書かれていた [コード：1234] が脱出パスワードである』）",
      "（選択肢3：もう一つの偽の回答）"
    ],
    "answerIndex": 1,
    "explanation": "（なぜその選択肢が正しいのか。暴いてきたすべての論理矛盾を美しく総括し、脱出コードを説明する大団円の解説文。150文字程度）"
  },
  "hints": [
    "【段階1: 調査ポイント】（全体を観察する際、どの人物やどの現場の要素を注視するべきかなど、分かりやすい着眼点。50文字程度）",
    "【段階2: 矛盾の核心】（2つの特定の情報の間に生じている、物理的・時間的な論理矛盾を具体的に言語化した文章。100文字程度）",
    "【段階3: 完全解決ルート】（最後の答えに導く完全な解答。矛盾ペアとして何を選択すればいいか、最終問題の正解はどれか、犯人と脱出パスコードは何かをズバリ親切に明示したもの。120文字程度。例：「バインダーから〇〇✕△△、◇◇✕◆◆を選択して全ての矛盾を暴き、最後に出現する最終問題で『犯人〇〇（●番目の選択肢）』を選択。そこにある脱出コード『1234』を回答すれば完全クリアです！」）"
  ]
}`;

    const modelResponse = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: "シナリオデータを生成してください。",
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: "application/json",
      }
    });

    const resultText = modelResponse.text?.trim() || "{}";
    const customScenario = JSON.parse(resultText);

    // Make sure scenario conforms to preset interfaces on client side
    res.json({
      success: true,
      scenario: customScenario
    });

  } catch (error: any) {
    console.error("Gemini Scenario Generation Error:", error);
    res.status(500).json({
      success: false,
      message: "AIによるシナリオ生成に失敗しました。時間をおいてもう一度お試しください。"
    });
  }
});

// Vite fallback SPA router
app.get('*', async (req, res, next) => {
  const url = req.originalUrl;
  if (url.startsWith('/api')) {
    return next();
  }
  try {
    let template: string;
    if (!isProd) {
      template = fs.readFileSync(path.resolve(root, 'index.html'), 'utf-8');
      template = await vite.transformIndexHtml(url, template);
    } else {
      template = fs.readFileSync(path.resolve(root, 'dist/index.html'), 'utf-8');
    }
    res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
  } catch (e: any) {
    if (!isProd) vite.ssrFixStacktrace(e);
    next(e);
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server listening on http://0.0.0.0:${PORT}`);
});
