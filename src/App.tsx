import React, { useState, useEffect } from 'react';
import { 
  AlertTriangle, 
  Key, 
  RefreshCw, 
  Play, 
  CheckCircle, 
  Plus, 
  BookOpen, 
  Sparkles, 
  ArrowRight, 
  Lock, 
  Unlock, 
  HelpCircle, 
  Send,
  X,
  Compass,
  MessageSquare,
  Clipboard,
  ShieldAlert,
  RotateCcw,
  Skull
} from 'lucide-react';

interface Character {
  id: string;
  name: string;
  role: string;
  avatar: string;
  accentColor: string;
  description: string;
}

interface Evidence {
  id: string;
  source: string;
  sourceId: string;
  content: string;
}

interface Contradiction {
  id: string;
  evidenceIdA: string;
  evidenceIdB: string;
  description: string;
  rewardClue: string;
  rewardEvidenceId: string;
  isFinalSolution: boolean;
}

interface FinalQuestion {
  question: string;
  choices: string[];
  answerIndex: number;
  explanation: string;
}

interface Scenario {
  id: string;
  title: string;
  category: string;
  difficulty: "Easy" | "Medium" | "Hard";
  intro: string;
  characters: Character[];
  evidences: Evidence[];
  contradictions: Contradiction[];
  finalQuestion: FinalQuestion;
  customUnlockedEvidences?: Record<string, Evidence>;
}

export default function App() {
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [currentScenario, setCurrentScenario] = useState<Scenario | null>(null);
  const [unlockedEvidences, setUnlockedEvidences] = useState<Evidence[]>([]);
  const [solvedContradictions, setSolvedContradictions] = useState<string[]>([]);
  
  // Game Play states
  const [selectedEvidenceIds, setSelectedEvidenceIds] = useState<string[]>([]);
  const [dialogText, setDialogText] = useState<string>('容疑者をタップして尋問を開始し、それぞれの主張を収集せよ。怪しい主張が2つ見つかったら、それらを同時に選択して「矛盾告発」を行うのだ！');
  const [dialogSpeaker, setDialogSpeaker] = useState<{name: string, role: string, avatar: string} | null>({
    name: "システムAI指導員",
    role: "調査ナビゲーター",
    avatar: "🕵️"
  });
  
  // Custom scenario generation state
  const [customTheme, setCustomTheme] = useState<string>('');
  const [customDifficulty, setCustomDifficulty] = useState<"Easy" | "Medium" | "Hard">('Medium');
  const [isGeneratingScenario, setIsGeneratingScenario] = useState<boolean>(false);
  
  // Contradiction submission state
  const [isAccusing, setIsAccusing] = useState<boolean>(false);
  const [userExplanation, setUserExplanation] = useState<string>('');
  const [accusationResult, setAccusationResult] = useState<any | null>(null);
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  
  // Escape phase state
  const [showEscapePhase, setShowEscapePhase] = useState<boolean>(false);
  const [selectedFinalChoice, setSelectedFinalChoice] = useState<number | null>(null);
  const [escapeResult, setEscapeResult] = useState<{success: boolean, explanation: string} | null>(null);
  const [escapeAttempts, setEscapeAttempts] = useState<number>(3); // Lifes

  // UI States
  const [showIntro, setShowIntro] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'evidence' | 'characters'>('evidence');
  const [selectedCharacterId, setSelectedCharacterId] = useState<string | null>(null);
  const [showAnimationText, setShowAnimationText] = useState<string>('');
  const [showCreatorModal, setShowCreatorModal] = useState<boolean>(false);
  const [showWelcomePortal, setShowWelcomePortal] = useState<boolean>(true);
  const [welcomeDifficultyFilter, setWelcomeDifficultyFilter] = useState<'All' | 'Easy' | 'Medium' | 'Hard'>('All');
  
  // Hint system state
  const [currentHintLevel, setCurrentHintLevel] = useState<number>(0); // 0 = no hints revealed, 1 = hint 1, 2 = hint 2, 3 = hint 3 (direct answer)

  // BGM & Playback Controls
  const [bgmAudio, setBgmAudio] = useState<HTMLAudioElement | null>(null);

  useEffect(() => {
    const audio = new Audio('/title.mp3');
    audio.loop = true;
    audio.volume = 0.4;
    setBgmAudio(audio);

    return () => {
      audio.pause();
    };
  }, []);

  useEffect(() => {
    if (!bgmAudio) return;

    if (showWelcomePortal) {
      const startBgm = () => {
        bgmAudio.play().catch(err => {
          console.log("Autoplay prevented, waiting for user interaction to play BGM:", err);
        });
      };
      
      startBgm();
      // Listen to click to play BGM if autoplay was blocked
      window.addEventListener('click', startBgm, { once: true });
      return () => {
        window.removeEventListener('click', startBgm);
      };
    } else {
      bgmAudio.pause();
    }
  }, [bgmAudio, showWelcomePortal]);

  const playStartSE = () => {
    const se = new Audio('/gamestart.mp3');
    se.volume = 0.6;
    se.play().catch(err => console.log("SE audio play prevented:", err));
  };

  // Fetch scenarios on load
  useEffect(() => {
    fetchScenarios();
  }, []);

  const fetchScenarios = async () => {
    try {
      const res = await fetch('/api/scenarios');
      const data = await res.json();
      if (data.success) {
        setScenarios(data.scenarios);
        // By default select first scenario but don't close welcome portal yet
        if (data.scenarios.length > 0) {
          selectScenario(data.scenarios[0], false);
        }
      }
    } catch (e) {
      console.error("Error loading scenarios:", e);
    }
  };

  const selectScenario = (scenario: Scenario, launchGame: boolean = true) => {
    setCurrentScenario(scenario);
    setUnlockedEvidences(scenario.evidences);
    setSolvedContradictions([]);
    setSelectedEvidenceIds([]);
    setShowEscapePhase(false);
    setSelectedFinalChoice(null);
    setEscapeResult(null);
    setAccusationResult(null);
    setEscapeAttempts(3);
    setShowIntro(launchGame);
    setCurrentHintLevel(0);
    if (launchGame) {
      setShowWelcomePortal(false);
      playStartSE();
    }
    
    // Set initial system guide dialog
    setDialogSpeaker({
      name: "事件指導員",
      role: "ナビゲーター",
      avatar: "🕵️"
    });
    setDialogText(`${scenario.title}へようこそ。${scenario.intro} 関係者からよく話を分析し、矛盾を暴き出してください。`);
  };

  // Generate Custom Scenario with Gemini
  const generateCustomScenario = async () => {
    if (!customTheme.trim()) {
      alert("生成したいテーマを入力してください！（例：海底都市の酸素漏出、オークション会場の美術品盗難など）");
      return;
    }
    setIsGeneratingScenario(true);
    setDialogText("Gemini AIが論理的な矛盾構造と魅力的な登場人物、追加される自白手がかりを瞬時にプロット構築しています。少々お待ち下さい...");
    setDialogSpeaker({
      name: "超高性能AI推理エンジン",
      role: "シナリオオート創作家",
      avatar: "✨"
    });

    try {
      const res = await fetch('/api/generate-scenario', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ theme: customTheme, requestedDifficulty: customDifficulty })
      });
      const data = await res.json();
      if (data.success && data.scenario) {
        const generated: Scenario = data.scenario;
        // Merge list with customized scenarios
        setScenarios(prev => [generated, ...prev]);
        selectScenario(generated);
        setCustomTheme('');
        setShowCreatorModal(false); // Close modal on success
        triggerCutscene("AI 新シナリオ生成完了！");
      } else {
        alert(data.message || "生成に失敗しました。");
      }
    } catch (e) {
      console.error(e);
      alert("AIシナリオ生成中にエラーが発生しました。");
    } finally {
      setIsGeneratingScenario(false);
    }
  };

  // Trigger special text cutscene action
  const triggerCutscene = (text: string) => {
    setShowAnimationText(text);
    setTimeout(() => {
      setShowAnimationText('');
    }, 2500);
  };

  // Handle Character Clicks for "Interrogation / Conversation"
  const handleCharacterInterrogate = (character: Character) => {
    setSelectedCharacterId(character.id);
    setDialogSpeaker({
      name: character.name,
      role: character.role,
      avatar: character.avatar
    });

    // Find if we have dynamic dialogue unlocked or static
    // Let's filter user's statement from evidences
    const charEvidences = unlockedEvidences.filter(e => e.sourceId === character.id);
    if (charEvidences.length > 0) {
      // Pick the latest unlocked/activated statement of this character to display as dialog
      const latestEvidence = charEvidences[charEvidences.length - 1];
      setDialogText(latestEvidence.content);
    } else {
      setDialogText("「私に何か不審な点でもあるのですか？ 無実の人間を疑うのはやめてください！」");
    }
  };

  // Handle Evidence Card Selection (Toggle max 2 items)
  const handleToggleEvidence = (id: string) => {
    setAccusationResult(null); // clear previous verification outcome on selection change
    if (selectedEvidenceIds.includes(id)) {
      setSelectedEvidenceIds(prev => prev.filter(item => item !== id));
    } else {
      if (selectedEvidenceIds.length >= 2) {
        // Swap out the first one
        setSelectedEvidenceIds([selectedEvidenceIds[1], id]);
      } else {
        setSelectedEvidenceIds(prev => [...prev, id]);
      }
    }
  };

  // Close the Accusation Modal and Reset State
  const closeAccusationModal = () => {
    setIsAccusing(false);
    setUserExplanation('');
    setAccusationResult(null);
  };

  // Submit dynamic explanation verification to Server
  const handleVerifyContradiction = async () => {
    if (selectedEvidenceIds.length !== 2) return;
    if (!userExplanation.trim()) {
      alert("なぜこれが矛盾しているのか、ツッコミ理由を入力してください！");
      return;
    }

    setIsVerifying(true);
    setAccusationResult(null);

    try {
      const evidenceA = unlockedEvidences.find(e => e.id === selectedEvidenceIds[0]);
      const evidenceB = unlockedEvidences.find(e => e.id === selectedEvidenceIds[1]);

      // Check if custom scenario scenario details are needed in request
      const isCustom = !["mansion_murder", "space_colony"].includes(currentScenario?.id || '');

      const res = await fetch('/api/verify-contradiction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scenarioId: currentScenario?.id,
          evidenceIdA: selectedEvidenceIds[0],
          evidenceIdB: selectedEvidenceIds[1],
          userExplanation: userExplanation,
          isCustom: isCustom,
          customScenario: isCustom ? currentScenario : null
        })
      });

      const data = await res.json();
      if (data.success) {
        setAccusationResult(data);
        
        // Let the target speaker answer immediately on screen
        if (evidenceA && evidenceB) {
          const mainLiarId = evidenceA.sourceId !== 'investigation' ? evidenceA.sourceId : evidenceB.sourceId;
          const matchedChar = currentScenario?.characters.find(c => c.id === mainLiarId);
          if (matchedChar) {
            setDialogSpeaker({
              name: matchedChar.name,
              role: matchedChar.role,
              avatar: matchedChar.avatar
            });
            setDialogText(data.characterResponse);
          }
        }

        // Apply reward clue unlock upon correct detection
        if (data.isAccepted) {
          triggerCutscene("矛盾突破！ 異議あり！");
          
          if (data.contradictionId && !solvedContradictions.includes(data.contradictionId)) {
            setSolvedContradictions(prev => [...prev, data.contradictionId]);
          } else if (isCustom && data.nextClue) {
            // Check dynamic contradiction identification for custom scenarios
            // If custom scenario matched custom contradiction id
            const matchedCustomCon = currentScenario?.contradictions.find(c => 
              (c.evidenceIdA === selectedEvidenceIds[0] && c.evidenceIdB === selectedEvidenceIds[1]) ||
              (c.evidenceIdA === selectedEvidenceIds[1] && c.evidenceIdB === selectedEvidenceIds[0])
            );
            if (matchedCustomCon && !solvedContradictions.includes(matchedCustomCon.id)) {
              setSolvedContradictions(prev => [...prev, matchedCustomCon.id]);
            }
          }

          // Merge newly unlocked clue into evidence binder
          if (data.nextClue) {
            const hasAlready = unlockedEvidences.some(e => e.id === data.nextClue.id);
            if (!hasAlready) {
              setUnlockedEvidences(prev => [...prev, {
                id: data.nextClue.id,
                source: data.nextClue.source,
                sourceId: data.nextClue.sourceId,
                content: data.nextClue.content
              }]);
              
              // Push customUnlockedEvidences in temporary custom map if custom
              if (isCustom && currentScenario) {
                if (!currentScenario.customUnlockedEvidences) {
                  currentScenario.customUnlockedEvidences = {};
                }
                currentScenario.customUnlockedEvidences[data.nextClue.id] = data.nextClue;
              }
            }
          }
          
          // Clear active choices
          setSelectedEvidenceIds([]);
        } else {
          triggerCutscene("却下！ 反論不成立");
        }
      }
    } catch (e) {
      console.error(e);
      alert("検証処理中にネットワークエラーが発生しました。");
    } finally {
      setIsVerifying(false);
    }
  };

  // Check if all core contradictions are solved
  const isReadyToEscape = currentScenario && solvedContradictions.length >= currentScenario.contradictions.length;

  // Handle final escape room submission
  const handleFinalEscapeSubmit = () => {
    if (selectedFinalChoice === null || !currentScenario) return;

    const isCorrect = selectedFinalChoice === currentScenario.finalQuestion.answerIndex;
    if (isCorrect) {
      setEscapeResult({
        success: true,
        explanation: currentScenario.finalQuestion.explanation
      });
      triggerCutscene("脱出成功！ 任務完了");
    } else {
      setEscapeAttempts(prev => {
        const newAttempts = prev - 1;
        if (newAttempts <= 0) {
          setEscapeResult({
            success: false,
            explanation: `残念…偽のアリバイに踊らされ、真犯人を逃してしまった！仕掛けられた時限ロックにより、部屋に閉じ込められてしまった。${currentScenario.finalQuestion.explanation}`
          });
          triggerCutscene("脱出失敗！ 閉鎖完了");
        } else {
          alert(`不正解！ 鍵の電子回路にエラーが発生しました。ライフ残量: ${newAttempts}`);
        }
        return newAttempts;
      });
    }
  };

  return (
    <div className="lg:h-screen lg:overflow-hidden min-h-screen bg-neutral-950 text-neutral-100 flex flex-col font-sans selection:bg-amber-500 selection:text-neutral-900 overflow-x-hidden relative">
      
      {/* Dynamic Text Cutscene overlay */}
      {showAnimationText && (
        <div className="fixed inset-0 bg-neutral-950/85 z-50 flex items-center justify-center backdrop-blur-md transition-all duration-300 animate-fade-in">
          <div className="text-center p-8 border border-neutral-800 rounded-3xl bg-neutral-900 shadow-2xl max-w-lg mx-4">
            <div className="animate-bounce mb-4 text-6xl">🔍</div>
            <h2 className="text-3xl md:text-5xl font-black tracking-wider bg-gradient-to-r from-amber-400 via-rose-500 to-indigo-500 bg-clip-text text-transparent transform scale-105 duration-500">
              {showAnimationText}
            </h2>
            <div className="mt-4 h-1 w-32 bg-amber-500 mx-auto rounded-full animate-pulse"></div>
          </div>
        </div>
      )}

      {/* Brand Navigation Bar */}
      <nav className="border-b border-neutral-800 bg-neutral-950/80 backdrop-blur-md shrink-0 z-40 px-4 py-0 flex flex-col items-center justify-center gap-1">
        <div className="flex flex-col items-center text-center gap-0">
          <h1 className="m-0 p-0 leading-none">
            <img src="/title.png" referrerPolicy="no-referrer" alt="矛盾検知脱出ゲーム" className="w-auto h-auto max-h-64 md:max-h-96 lg:max-h-[440px] max-w-full object-contain mx-auto transition-transform duration-300 hover:scale-105 -my-10 md:-my-20 lg:-my-32 block" />
          </h1>
          <p className="text-xs text-neutral-500 font-mono tracking-widest uppercase mt-0">Dynamic LLM Contradiction Escape Engine</p>
        </div>

        {/* Preset Scenarios selector */}
        <div className="flex flex-wrap items-center gap-2 justify-center">
          <button
            id="nav-btn-portal"
            onClick={() => setShowWelcomePortal(true)}
            className={`px-3 py-1.5 rounded-full text-xs font-black transition-all duration-300 border flex items-center gap-1.5 ${
              showWelcomePortal
                ? 'bg-amber-500 text-neutral-950 border-amber-400 shadow-md shadow-amber-500/10 scale-105'
                : 'bg-neutral-900/60 text-neutral-400 border-neutral-800 hover:text-neutral-200 hover:border-neutral-700'
            }`}
          >
            <span>🏠</span>
            <span>事件選択ポータル</span>
          </button>

          <div className="h-4 w-px bg-neutral-800 hidden md:block"></div>

          {scenarios.map((s) => {
            const isActive = !showWelcomePortal && currentScenario?.id === s.id;
            return (
              <button
                key={s.id}
                id={`scenario-btn-${s.id}`}
                onClick={() => selectScenario(s)}
                className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all duration-300 border flex items-center gap-1.5 ${
                  isActive 
                    ? 'bg-amber-500 text-neutral-950 border-amber-400 shadow-md shadow-amber-500/10 scale-105'
                    : 'bg-neutral-900 text-neutral-400 border-neutral-800 hover:text-neutral-200 hover:border-neutral-700'
                }`}
              >
                <span>{s.category === 'AI生成ミステリー' ? '✨' : '📁'}</span>
                <span>{s.title}</span>
                <span className={`px-1 py-0.5 rounded text-[10px] scale-90 ${
                  s.difficulty === 'Easy' ? 'bg-emerald-950 text-emerald-400' :
                  s.difficulty === 'Medium' ? 'bg-amber-950/50 text-amber-500' : 'bg-rose-950 text-rose-400'
                }`}>
                  {s.difficulty === 'Easy' ? '初級' : s.difficulty === 'Medium' ? '中級' : '上級'}
                </span>
              </button>
            );
          })}

          {/* Trigger Custom Scenario Generator Modal directly from Nav bar */}
          <button
            onClick={() => {
              setShowCreatorModal(true);
              setShowIntro(false);
            }}
            className="px-3 py-1.5 rounded-full text-xs font-black transition-all duration-300 border bg-amber-950/40 text-amber-400 border-amber-500/20 hover:bg-amber-950/60 flex items-center gap-1.5 shadow-md hover:border-amber-500/40"
          >
            <Sparkles size={11} className="text-amber-400 animate-pulse" />
            <span>AIで新事件を創る</span>
          </button>
        </div>
      </nav>

      {/* Main Playable Stage */}
      <main className="flex-1 min-h-0 max-w-7xl w-full mx-auto p-4 md:p-5 flex flex-col gap-4 overflow-hidden">
        
        {/* Scenario Intro Overlay Dossier Modal */}
        {currentScenario && showIntro && !showWelcomePortal && (
          <div className="fixed inset-0 bg-neutral-950/90 backdrop-blur-md z-45 flex items-center justify-center p-4">
            <div className="bg-neutral-900 border border-neutral-800 w-full max-w-2xl rounded-3xl p-6 md:p-8 space-y-6 relative max-h-[90vh] overflow-y-auto shadow-2xl animate-scale-up">
              <div className="absolute top-0 right-0 transform translate-x-12 -translate-y-8 text-neutral-800/10 pointer-events-none">
                <Compass size={220} className="stroke-[1]" />
              </div>
              
              <div className="flex-1 space-y-3 z-10">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 bg-amber-500/10 text-amber-400 border border-amber-500/20 text-xs font-semibold rounded-full tracking-wide">
                    {currentScenario.category}
                  </span>
                  <span className="text-xs text-neutral-500 font-mono">UUID: {currentScenario.id}</span>
                </div>
                <h2 className="text-2xl md:text-3xl font-black text-neutral-100">{currentScenario.title}</h2>
                <div className="h-0.5 bg-neutral-800 w-full rounded my-1"></div>
                <p className="text-neutral-300 text-sm leading-relaxed max-w-3xl whitespace-pre-wrap">
                  {currentScenario.intro}
                </p>
                
                <div className="pt-2 flex flex-wrap gap-4 items-center text-xs text-neutral-400 font-mono">
                  <div className="flex items-center gap-1.5 bg-neutral-950/60 px-3 py-1.5 rounded-lg border border-neutral-850">
                    <span className="text-neutral-500">容疑者数:</span> <span className="font-bold text-amber-400">{currentScenario.characters.length}名</span>
                  </div>
                  <div className="flex items-center gap-1.5 bg-neutral-950/60 px-3 py-1.5 rounded-lg border border-neutral-850">
                    <span className="text-neutral-500">暴くべき矛盾:</span> <span className="font-bold text-rose-400">{currentScenario.contradictions.length}点</span>
                  </div>
                  <div className="flex items-center gap-1.5 bg-neutral-950/60 px-3 py-1.5 rounded-lg border border-neutral-850">
                    <span className="text-neutral-500">解決済み:</span> <span className="font-bold text-emerald-400">{solvedContradictions.length} / {currentScenario.contradictions.length}</span>
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-neutral-800">
                <button 
                  id="btn-close-intro"
                  onClick={() => { playStartSE(); setShowIntro(false); }}
                  className="flex-1 bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold px-6 py-3 rounded-2xl text-xs tracking-wider transition-all duration-300 hover:scale-[1.01] shadow-md shadow-amber-500/10 flex items-center justify-center gap-2"
                >
                  <span>捜査を開始する</span>
                  <ArrowRight size={14} />
                </button>
                
                <button 
                  onClick={() => {
                    setShowCreatorModal(true);
                    setShowIntro(false);
                  }}
                  className="bg-neutral-950 border border-neutral-800 hover:border-neutral-700 text-neutral-300 px-6 py-3 rounded-2xl text-xs font-bold transition-all duration-300 flex items-center justify-center gap-2"
                >
                  <Sparkles size={14} className="text-amber-400" />
                  <span>新しい事件を構築</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Welcome Portal: Selected by User */}
        {showWelcomePortal && (
          <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-6 py-4 animate-fade-in">
            {/* Header / Guide */}
            <div className="bg-gradient-to-b from-neutral-900 via-neutral-900 to-neutral-950 border border-neutral-800 rounded-3xl p-6 md:p-8 relative overflow-hidden shadow-2xl">
              <div className="absolute top-0 right-0 w-80 h-80 bg-amber-500/5 rounded-full blur-3xl pointer-events-none"></div>
              <div className="relative z-10 flex flex-col md:flex-row gap-6 justify-between items-center text-center md:text-left">
                <div className="space-y-3">
                  <span className="px-3 py-1 bg-amber-500/10 text-amber-400 border border-amber-500/20 text-xs font-black tracking-widest uppercase rounded-full">
                    WELCOME TO DETECTIVE RECRUITMENT
                  </span>
                  <h2 className="text-2xl md:text-4xl font-black text-neutral-100 flex items-center justify-center md:justify-start gap-2">
                    <ShieldAlert className="text-amber-500 animate-pulse" size={28} />
                    <span>矛盾を暴く、AI脱出ミステリー</span>
                  </h2>
                  <p className="text-xs md:text-sm text-neutral-400 leading-relaxed max-w-2xl font-semibold">
                    容疑者たちの証言を比較し、対立する「盾と矛（矛盾）」を告発せよ。すべての矛盾を解明すれば、扉のパスワードを暴く最終脱出問題へと進めます。まずは、挑戦する「事件の難易度」や「シナリオ」を選択してください。
                  </p>
                </div>
                <div className="bg-neutral-950 border border-neutral-850 p-4 rounded-2xl shrink-0 flex flex-col items-center justify-center text-center shadow-lg">
                  <span className="text-3xl mb-1 flex items-center justify-center">🕵️‍♂️</span>
                  <span className="text-[10px] font-mono text-neutral-500">PLAYER STATUS</span>
                  <span className="text-xs font-black text-amber-500 tracking-wider">特級論理捜査官</span>
                </div>
              </div>
            </div>

            {/* Difficulty Tabs / Filter Controls */}
            <div className="flex flex-col gap-4">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-b border-neutral-800 pb-3">
                <div className="flex items-center gap-2">
                  <Key size={18} className="text-amber-500" />
                  <h3 className="text-sm font-black tracking-widest text-neutral-300 uppercase">
                    難易度別に事件を選択
                  </h3>
                </div>
                
                {/* Difficulty Filters */}
                <div className="flex rounded-xl bg-neutral-900 p-1 border border-neutral-850">
                  {([
                    { key: 'All', label: 'すべて 📁' },
                    { key: 'Easy', label: '初級 🟢' },
                    { key: 'Medium', label: '中級 🟡' },
                    { key: 'Hard', label: '上級 🔴' }
                  ] as const).map((opt) => (
                    <button
                      key={opt.key}
                      onClick={() => setWelcomeDifficultyFilter(opt.key)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all ${
                        welcomeDifficultyFilter === opt.key
                          ? 'bg-amber-500 text-neutral-950 shadow-md font-bold'
                          : 'text-neutral-400 hover:text-neutral-200'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Grid of Available Scenarios */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {scenarios
                  .filter(s => welcomeDifficultyFilter === 'All' || s.difficulty === welcomeDifficultyFilter)
                  .map((s) => {
                    return (
                      <div
                        key={s.id}
                        onClick={() => selectScenario(s)}
                        className="group bg-neutral-900/30 border border-neutral-800 hover:border-amber-500/50 rounded-3xl p-5 md:p-6 cursor-pointer transition-all duration-300 hover:bg-neutral-900/60 hover:shadow-xl hover:shadow-amber-500/5 flex flex-col justify-between gap-4 h-full relative overflow-hidden animate-fade-in"
                      >
                        {/* Decorative background light effect */}
                        <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/[0.01] rounded-full blur-2xl group-hover:bg-amber-500/[0.03] duration-500"></div>

                        <div className="space-y-3">
                          {/* Top Labels */}
                          <div className="flex items-center justify-between gap-2">
                            <span className="px-2 py-0.5 bg-neutral-950 border border-neutral-850 rounded text-[9px] font-bold text-neutral-400">
                              {s.category}
                            </span>
                            <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider ${
                              s.difficulty === 'Easy' ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/20' :
                              s.difficulty === 'Medium' ? 'bg-amber-950/40 text-amber-400 border border-amber-500/10' :
                              'bg-rose-950 text-rose-400 border border-rose-500/20'
                            }`}>
                              {s.difficulty === 'Easy' ? '🟢 初級' :
                               s.difficulty === 'Medium' ? '🟡 中級' :
                               '🔴 上級'}
                            </span>
                          </div>

                          {/* Title & Intro */}
                          <div className="space-y-1">
                            <h4 className="text-lg font-black text-neutral-100 group-hover:text-amber-400 transition-colors">
                              {s.title}
                            </h4>
                            <p className="text-xs text-neutral-400 leading-relaxed line-clamp-3">
                              {s.intro}
                            </p>
                          </div>

                          {/* Characters avatars roll */}
                          <div className="pt-2 flex items-center gap-2">
                            <span className="text-[10px] font-mono text-neutral-500 uppercase mr-1">容疑者一覧:</span>
                            <div className="flex -space-x-2">
                              {s.characters.map((char) => (
                                <div
                                  key={char.id}
                                  title={`${char.name} (${char.role})`}
                                  className="w-7 h-7 rounded-xl bg-neutral-950 border border-neutral-800 flex items-center justify-center text-xs filter drop-shadow shadow-md"
                                >
                                  {char.avatar}
                                </div>
                              ))}
                            </div>
                            <span className="text-[10px] font-bold text-neutral-500 ml-1">
                              ({s.characters.length}名)
                            </span>
                          </div>
                        </div>

                        {/* Button Action */}
                        <div className="pt-2 border-t border-neutral-850/60 mt-auto flex justify-between items-center">
                          <span className="text-[10px] text-neutral-500 font-mono">
                            矛盾数: {s.contradictions.length}点
                          </span>
                          <span
                            className="bg-neutral-950 group-hover:bg-amber-500 text-neutral-400 group-hover:text-neutral-950 border border-neutral-800 group-hover:border-amber-400 px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 shadow"
                          >
                            <span>捜査を開始する</span>
                            <ArrowRight size={12} className="group-hover:translate-x-0.5 duration-300" />
                          </span>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>

            {/* Quick Gemini Original Game Constructor card (bento grid layout) */}
            <div className="bg-gradient-to-b from-neutral-900/60 to-neutral-950 border border-neutral-800 rounded-3xl p-6 md:p-8 space-y-5 relative overflow-hidden shadow-2xl">
              <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/[0.02] rounded-full blur-3xl pointer-events-none"></div>
              
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-neutral-800 pb-4">
                <div className="space-y-1">
                  <span className="text-amber-400 uppercase tracking-widest font-mono text-[9px] font-black">
                    INFINITY MYSTERY ENGINE
                  </span>
                  <h3 className="text-xl font-black text-neutral-100 flex items-center gap-2">
                    <Sparkles className="text-amber-400 animate-pulse" size={20} />
                    <span>無限AIミステリー・オリジナル事件クリエイター</span>
                  </h3>
                </div>
                <span className="text-[10px] font-bold text-neutral-500 bg-neutral-950 px-3 py-1 rounded-full border border-neutral-850">
                  Powered by Gemini 3.5 Flash
                </span>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <div className="lg:col-span-7 space-y-4">
                  <p className="text-xs text-neutral-300 leading-relaxed font-semibold">
                    既定のシナリオをハックした後は、あなたの独自のテーマで事件を創りましょう。自由な設定やキーワード（例：『深夜のコンビニ強盗』『魔法学校の答案改ざん』など）を入力すると、Geminiが難解な論理パズル、オリジナル容疑者の証言群、そして追加される追加手がかりを完全にオートプロット生成します！
                  </p>

                  <div className="space-y-2">
                    <label className="text-xs font-mono font-bold text-neutral-400 block">事件のシチュエーション・テーマ自由記入：</label>
                    <div className="relative">
                      <input
                        type="text"
                        id="input-custom-theme-portal"
                        value={customTheme}
                        onChange={(e) => setCustomTheme(e.target.value)}
                        placeholder="例：『古代エジプトのミイラ盗難事件』『近未来の自動配送センターの不審火』など"
                        disabled={isGeneratingScenario}
                        className="w-full bg-neutral-950 border border-neutral-800 text-neutral-100 rounded-2xl px-4 py-3.5 text-xs focus:outline-none focus:border-amber-500 transition-colors pr-12 font-semibold"
                      />
                      <div className="absolute top-1/2 right-3 -translate-y-1/2 text-neutral-500">
                        <Sparkles size={16} />
                      </div>
                    </div>
                  </div>

                  {/* Recommendations */}
                  <div className="flex flex-wrap gap-1.5 pt-1 items-center">
                    <span className="text-[10px] text-neutral-500 font-mono">おすすめテーマ案:</span>
                    {[
                      "サイバー病院のハッキング",
                      "深海探査基地 of 浸水嘘",
                      "深夜 of コンビニ強盗",
                      "魔法学校 of 答案改ざん"
                    ].map((idea) => (
                      <button
                        key={idea}
                        onClick={() => setCustomTheme(idea)}
                        disabled={isGeneratingScenario}
                        className="bg-neutral-950 hover:bg-neutral-900 border border-neutral-850 text-neutral-400 hover:text-neutral-200 text-[10px] px-2.5 py-1 rounded-lg transition-colors font-semibold"
                      >
                        + {idea}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="lg:col-span-5 space-y-4 bg-neutral-950/40 p-5 rounded-2xl border border-neutral-850 flex flex-col justify-between">
                  <div className="space-y-3">
                    <label className="text-xs font-mono font-bold text-neutral-400 block">生成する難易度：</label>
                    
                    <div className="grid grid-cols-3 gap-2">
                      {(["Easy", "Medium", "Hard"] as const).map((diff) => (
                        <button
                          key={diff}
                          id={`diff-btn-portal-${diff}`}
                          onClick={() => setCustomDifficulty(diff)}
                          className={`py-2 rounded-xl text-xs font-bold border transition-all ${
                            customDifficulty === diff 
                              ? 'bg-amber-500 text-neutral-950 border-amber-400 scale-[1.03]' 
                              : 'bg-neutral-950 text-neutral-400 border-neutral-800 hover:border-neutral-700'
                          }`}
                        >
                          {diff === 'Easy' ? '初級 🟢' : diff === 'Medium' ? '中級 🟡' : '上級 🔴'}
                        </button>
                      ))}
                    </div>

                    <p className="text-[10px] text-neutral-500 leading-relaxed font-mono">
                      ※ 難易度を「Hard」にすると、Geminiは緻密で微小な時間や状況の矛盾ズレでミステリを設計します。高度なパズルになります。
                    </p>
                  </div>

                  <button
                    id="btn-generate-scenario-portal"
                    disabled={isGeneratingScenario}
                    onClick={generateCustomScenario}
                    className="w-full bg-gradient-to-r from-amber-500 via-rose-500 to-indigo-600 hover:from-amber-400 text-neutral-950 font-black tracking-widest text-xs py-3.5 rounded-2xl transition-all duration-300 transform hover:scale-[1.01] flex items-center justify-center gap-2 shadow-lg shadow-rose-500/5 mt-2"
                  >
                    {isGeneratingScenario ? (
                      <>
                        <RefreshCw className="animate-spin text-neutral-950" size={14} />
                        <span>Geminiがミステリ創作中... (約10秒)</span>
                      </>
                    ) : (
                      <>
                        <Sparkles size={14} className="text-neutral-950 animate-pulse" />
                        <span>オリジナル推理世界を構築する</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Real-time AI Character Dialog Rail (Showcases what characters say and think) */}
        {currentScenario && !showWelcomePortal && (
          <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-4 shadow-2xl relative overflow-hidden flex flex-col md:flex-row gap-4 items-center shrink-0">
            <div className="absolute top-0 right-0 flex items-center gap-1 px-4 py-1.5 bg-neutral-950 rounded-bl-2xl text-[10px] font-mono text-neutral-500 border-l border-b border-rose-950">
              <div className="h-2 w-2 rounded-full bg-rose-500 animate-ping"></div>
              <span>DETECTIVE DIALOGUE MONITOR</span>
            </div>

            {/* Character face block */}
            <div className="flex flex-col items-center justify-center text-center bg-neutral-950 border border-neutral-800 rounded-2xl p-4 w-full md:w-44 shrink-0 shadow-inner">
              <span className="text-5xl md:text-6xl mb-2 animate-pulse filter drop-shadow-[0_4px_12px_rgba(245,158,11,0.15)]">
                {dialogSpeaker?.avatar || '🕵️'}
              </span>
              <h3 className="text-sm font-black text-neutral-100 tracking-wider">
                {dialogSpeaker?.name || '指示官'}
              </h3>
              <p className="text-[10px] font-mono font-bold text-amber-500 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full mt-1">
                {dialogSpeaker?.role || 'ゲームシステム'}
              </p>
            </div>

            {/* Message Speech bubble */}
            <div className="flex-1 w-full space-y-3">
              <div className="text-neutral-300 text-sm italic md:text-base leading-relaxed bg-neutral-950/40 p-4 rounded-2xl border border-neutral-850 min-h-[5rem] flex items-center">
                “ {unlockedEvidences.length === 0 ? "事件を選択してスタートしてください。 " : dialogText} ”
              </div>
              
              <div className="flex items-center justify-between text-xs text-neutral-500">
                <span className="font-mono">STATUS: ACTIVE INQUIRY</span>
                {selectedCharacterId && (
                  <button 
                    id="btn-unfocus-char"
                    onClick={() => {
                      setSelectedCharacterId(null);
                      setDialogSpeaker({ name: "システムAI指導員", role: "調査ナビゲーター", avatar: "🕵️" });
                      setDialogText("事件の関係者のイラストを選択して尋問を切り替えてください。");
                    }}
                    className="text-amber-500 hover:text-amber-400 transition-colors flex items-center gap-1"
                  >
                    <RotateCcw size={12} />
                    <span>フォーカス解除</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Main Body Grid: Left side Characters, Right side Evidences */}
        {currentScenario && !showWelcomePortal && !showEscapePhase && (
          <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-5 overflow-hidden">
            
            {/* LEFT COLUMN: Suspect Characters (4/12 width) */}
            <div className="lg:col-span-5 flex flex-col gap-4 lg:h-full lg:overflow-y-auto pr-1">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-black tracking-widest text-neutral-400 uppercase flex items-center gap-2">
                  <MessageSquare size={16} className="text-amber-500" />
                  <span>重要関係者の尋問室</span>
                </h2>
                <span className="text-xs text-neutral-500 bg-neutral-900 border border-neutral-850 px-2 py-1 rounded-lg">タップして発言を聞く</span>
              </div>

              <div id="character-list" className="grid grid-cols-1 gap-4">
                {currentScenario.characters.map((char) => {
                  const isFocused = selectedCharacterId === char.id;
                  
                  return (
                    <div
                      key={char.id}
                      id={`char-card-${char.id}`}
                      onClick={() => handleCharacterInterrogate(char)}
                      className={`group relative border rounded-2xl p-4 transition-all duration-300 cursor-pointer overflow-hidden ${
                        isFocused 
                          ? 'bg-neutral-900 border-amber-500 shadow-lg shadow-amber-500/10 translate-x-1' 
                          : 'bg-neutral-900/40 border-neutral-800 hover:border-neutral-700 hover:bg-neutral-900/60'
                      }`}
                    >
                      {/* Character Color Accents */}
                      <div className="absolute top-0 left-0 w-1.5 h-full bg-gradient-to-b from-amber-500 to-rose-600"></div>
                      
                      <div className="flex items-start gap-4 pl-2">
                        <span className="text-4xl filter drop-shadow-md group-hover:scale-110 duration-300">
                          {char.avatar}
                        </span>
                        
                        <div className="flex-1 space-y-1">
                          <div className="flex items-center justify-between">
                            <h4 className="font-extrabold text-neutral-100 group-hover:text-amber-400 transition-colors">
                              {char.name}
                            </h4>
                            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-neutral-400 bg-neutral-950 px-2.5 py-1 rounded-md border border-neutral-850">
                              {char.role}
                            </span>
                          </div>
                          
                          <p className="text-neutral-400 text-xs leading-relaxed">
                            {char.description}
                          </p>

                          <div className="pt-2 flex items-center text-[10px] text-amber-500/80 gap-1 opacity-0 group-hover:opacity-100 transition-all duration-300">
                            <RotateCcw size={10} className="animate-spin" />
                            <span>クリックして直接問い詰める</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Tips & Progress tracker */}
              <div className="bg-neutral-900/50 border border-neutral-800 rounded-3xl p-5 space-y-4">
                <div className="flex items-center gap-2 border-b border-neutral-800 pb-2.5">
                  <Clipboard size={16} className="text-rose-500" />
                  <h4 className="text-xs font-black tracking-wider text-neutral-300 uppercase">
                    捜査進捗レポート
                  </h4>
                </div>
                
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="bg-neutral-950 border border-neutral-850 rounded-xl p-3 flex flex-col justify-between">
                    <span className="text-neutral-500 font-mono">入手した全言リスト:</span>
                    <span className="text-lg font-black text-neutral-200 mt-1">{unlockedEvidences.length} 枚</span>
                  </div>
                  <div className="bg-neutral-950 border border-neutral-850 rounded-xl p-3 flex flex-col justify-between">
                    <span className="text-neutral-500 font-mono">暴き終えた嘘:</span>
                    <span className="text-lg font-black text-rose-500 mt-1">{solvedContradictions.length} 箇所</span>
                  </div>
                </div>

                <div className="bg-neutral-950 border border-neutral-850 rounded-xl p-3">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-amber-500 mb-1">
                    <HelpCircle size={13} />
                    <span>捜査官の心得</span>
                  </div>
                  <p className="text-[11px] text-neutral-400 leading-relaxed">
                    容疑者の発言は、もう一方の関係者の証言や、現場調査で得られた物理的な形跡と真っ向からぶつかり合っている。バインダーから「2枚」の矛盾する主張を選択せよ。
                  </p>
                </div>
              </div>

              {/* Progressive Hints Section */}
              <div className="bg-neutral-900/50 border border-neutral-800 rounded-3xl p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-neutral-800 pb-2.5">
                  <div className="flex items-center gap-2">
                    <HelpCircle size={16} className="text-amber-500 animate-pulse" />
                    <h4 className="text-xs font-black tracking-wider text-neutral-300 uppercase">
                      💡 行き詰まった時のヒント
                    </h4>
                  </div>
                  {currentScenario?.hints && currentHintLevel < 3 && (
                    <button
                      onClick={() => setCurrentHintLevel(prev => Math.min(prev + 1, 3))}
                      className="text-[10px] font-bold text-amber-500 hover:text-amber-400 bg-amber-950/20 border border-amber-500/30 px-2 py-1 rounded-lg transition-all"
                    >
                      {currentHintLevel === 0 ? "ヒントを開く" : "次のヒントを解放"}
                    </button>
                  )}
                </div>

                <div className="space-y-3">
                  {currentScenario?.hints ? (
                    currentScenario.hints.map((hintText, index) => {
                      const isRevealed = currentHintLevel > index;
                      return (
                        <div
                          key={index}
                          className={`rounded-xl p-3 border transition-all duration-300 ${
                            isRevealed
                              ? 'bg-neutral-950 border-neutral-850 shadow-inner'
                              : 'bg-neutral-950/20 border-neutral-900/30 opacity-45 select-none'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1.5">
                            <span className={`text-[10px] font-bold uppercase tracking-wider ${
                              isRevealed ? 'text-amber-500' : 'text-neutral-500'
                            }`}>
                              段階 {index + 1}: {index === 0 ? "調査ポイント" : index === 1 ? "矛盾の核心" : "告発の組み合わせ"}
                            </span>
                            {!isRevealed && (
                              <button
                                onClick={() => {
                                  if (currentHintLevel === index) {
                                    setCurrentHintLevel(index + 1);
                                  }
                                }}
                                disabled={currentHintLevel !== index}
                                className={`text-[9px] font-bold px-1.5 py-0.5 rounded transition-all ${
                                  currentHintLevel === index
                                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30 hover:bg-amber-500/30 cursor-pointer'
                                    : 'bg-neutral-900 text-neutral-600 border border-neutral-850 cursor-not-allowed'
                                }`}
                              >
                                解放する
                              </button>
                            )}
                          </div>
                          {isRevealed ? (
                            <p className="text-[11px] text-neutral-300 leading-relaxed font-semibold transition-all duration-300 animate-fade-in whitespace-pre-wrap">
                              {hintText}
                            </p>
                          ) : (
                            <p className="text-[11px] leading-relaxed italic font-mono text-neutral-600">
                              (「解放する」を押すと表示されます)
                            </p>
                          )}
                        </div>
                      );
                    })
                  ) : (
                    <div className="text-center py-4 text-xs text-neutral-500 italic">
                      このシナリオにはヒント情報が設定されていません。
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN: Evidence & Clues Binder (7/12 width) */}
            <div id="evidence-stage" className="lg:col-span-7 flex flex-col gap-4 lg:h-full lg:min-h-0">
              
              <div className="flex items-center justify-between border-b border-neutral-800 pb-3 shrink-0">
                <div className="flex items-center gap-2">
                  <BookOpen size={18} className="text-amber-500" />
                  <h3 className="text-base font-black tracking-widest text-neutral-300 uppercase">
                    捜査資料・調書バインダー
                  </h3>
                </div>
                
                <span className="text-xs font-mono text-neutral-400 bg-neutral-900 border border-neutral-800 px-3 py-1 rounded-full flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 bg-rose-500 rounded-full"></span>
                  <span>選択中: {selectedEvidenceIds.length} / 2</span>
                </span>
              </div>

              {/* Scrollable grid wrapper */}
              <div className="flex-1 min-h-0 overflow-y-auto pr-1">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {unlockedEvidences.map((ev) => {
                    const isSelected = selectedEvidenceIds.includes(ev.id);
                    const isPartofResolved = currentScenario.contradictions.some(con => 
                      solvedContradictions.includes(con.id) && 
                      (con.evidenceIdA === ev.id || con.evidenceIdB === ev.id)
                    );
                    
                    return (
                      <div
                        key={ev.id}
                        id={`evidence-card-${ev.id}`}
                        onClick={() => handleToggleEvidence(ev.id)}
                        className={`group border rounded-2xl p-4 transition-all duration-300 cursor-pointer flex flex-col justify-between relative overflow-hidden ${
                          isSelected 
                            ? 'bg-amber-950/20 border-amber-500 shadow-lg shadow-amber-500/10 scale-[1.02]' 
                            : isPartofResolved
                              ? 'bg-neutral-900/60 border-neutral-800/80 opacity-75'
                              : 'bg-neutral-900/30 border-neutral-800 hover:border-neutral-700 hover:bg-neutral-900/50'
                        }`}
                      >
                        {/* Solved Stamp */}
                        {isPartofResolved && (
                          <div className="absolute top-2 right-2 flex items-center gap-1 px-2 py-0.5 bg-emerald-950 border border-emerald-500 text-[9px] font-mono rounded text-emerald-400 scale-90 z-10 font-black">
                            <CheckCircle size={10} />
                            <span>矛盾立証済</span>
                          </div>
                        )}

                        <div className="text-xs space-y-2">
                          {/* Source Label */}
                          <div className="flex items-center gap-1.5">
                            <span className="px-2 py-0.5 bg-neutral-950 border border-neutral-850 rounded text-[10px] font-bold text-neutral-300">
                              {ev.source}
                            </span>
                            <span className="text-[10px] text-neutral-500">証言 ID: {ev.id}</span>
                          </div>

                          {/* Dialogue content */}
                          <p className="text-neutral-200 text-xs italic leading-relaxed pt-1">
                            {ev.content}
                          </p>
                        </div>

                        {/* Card Bottom status indicators */}
                        <div className="mt-4 pt-3 border-t border-neutral-850 flex items-center justify-between">
                          <span className="text-[10px] font-mono text-neutral-500">
                            {isSelected ? "📍 矛盾検証対象として選択中" : "🔍 比較対象としてタップ"}
                          </span>
                          
                          <div className={`h-4 w-4 rounded-full border transition-all duration-300 flex items-center justify-center ${
                            isSelected 
                              ? 'bg-amber-500 border-amber-400' 
                              : 'border-neutral-800 bg-neutral-950'
                          }`}>
                            {isSelected && <span className="block h-1.5 w-1.5 bg-neutral-950 rounded-full"></span>}
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {/* If somehow no evidences displayed */}
                  {unlockedEvidences.length === 0 && (
                    <div className="col-span-2 text-center py-12 border border-dashed border-neutral-800 rounded-3xl text-neutral-500">
                      関係者に尋問を行い、証言データを集めてください。
                    </div>
                  )}
                </div>
              </div>

              {/* ACCUSATION DRAWER (Shows up when 2 evidences are active) */}
              {selectedEvidenceIds.length === 2 && (
                <div className="bg-neutral-900 border border-amber-500/40 rounded-3xl p-5 mt-4 shadow-xl animate-bounce-short relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full blur-2xl pointer-events-none"></div>
                  
                  <div className="flex items-center gap-2 mb-3">
                    <AlertTriangle className="text-amber-500 animate-pulse" size={20} />
                    <h4 className="text-sm font-black text-neutral-100 tracking-wider">
                      盾と矛の告発準備: 証言対決
                    </h4>
                  </div>

                  <div className="grid grid-cols-5 items-center gap-2 text-xs mb-4">
                    {/* Event A preview */}
                    <div className="col-span-2 bg-neutral-950 border border-neutral-850 p-3 rounded-xl">
                      <span className="font-extrabold text-amber-500 block mb-1">
                        {unlockedEvidences.find(e => e.id === selectedEvidenceIds[0])?.source}
                      </span>
                      <p className="text-neutral-400 line-clamp-2 italic">
                        {unlockedEvidences.find(e => e.id === selectedEvidenceIds[0])?.content}
                      </p>
                    </div>

                    {/* Centered VS node */}
                    <div className="col-span-1 text-center font-black text-neutral-500 text-lg flex flex-col items-center">
                      <span className="text-rose-500 font-mono text-xs scale-90 border border-rose-500/30 px-1 py-0.5 rounded bg-rose-500/5 mb-1 blink">CONFLICT</span>
                      <span>⚡</span>
                    </div>

                    {/* Event B preview */}
                    <div className="col-span-2 bg-neutral-950 border border-neutral-850 p-3 rounded-xl">
                      <span className="font-extrabold text-indigo-400 block mb-1">
                        {unlockedEvidences.find(e => e.id === selectedEvidenceIds[1])?.source}
                      </span>
                      <p className="text-neutral-400 line-clamp-2 italic">
                        {unlockedEvidences.find(e => e.id === selectedEvidenceIds[1])?.content}
                      </p>
                    </div>
                  </div>

                  <button
                    id="btn-trigger-accuse-modal"
                    onClick={() => {
                      setIsAccusing(true);
                      setUserExplanation('');
                      setAccusationResult(null);
                    }}
                    className="w-full bg-gradient-to-r from-amber-500 to-rose-600 hover:from-amber-400 hover:to-rose-500 text-neutral-950 font-black tracking-widest text-xs py-3 rounded-2xl transition-all duration-300 transform hover:scale-[1.01] flex items-center justify-center gap-2 shadow-lg shadow-amber-500/10"
                  >
                    <span>「異議あり！」論理的に嘘を告発する</span>
                  </button>
                </div>
              )}

              {/* ESCAPE TRIGGER SECTION (Unlocks when ready) */}
              {isReadyToEscape && !showEscapePhase && (
                <div className="bg-gradient-to-r from-emerald-950/40 via-emerald-900/10 to-teal-900/10 border border-emerald-500 rounded-3xl p-6 mt-4 relative overflow-hidden shadow-2xl">
                  <div className="absolute top-0 right-0 p-3 bg-emerald-500 text-neutral-950 text-[10px] font-mono tracking-widest font-black rounded-bl-2xl">
                    SECURITY BYPASSED
                  </div>
                  
                  <div className="space-y-2 max-w-xl">
                    <h4 className="text-lg font-black text-emerald-400 flex items-center gap-2">
                      <Unlock className="animate-bounce" size={20} />
                      <span>最終脱出ハッチが起動しました！</span>
                    </h4>
                    <p className="text-xs text-neutral-300 leading-relaxed">
                      おめでとう！ すべきすべての矛盾を暴きました。これにより、隠し部屋へのパスロックが作動中。最終的な犯人とその脱出手順を正しく告発すれば、この部屋から安全に脱出できます。
                    </p>
                    
                    <button
                      id="btn-go-escape"
                      onClick={() => setShowEscapePhase(true)}
                      className="bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-black text-xs px-6 py-3 rounded-2xl transition-all duration-300 hover:scale-105 shadow-md shadow-emerald-500/20 flex items-center gap-2 mt-4"
                    >
                      <span>真相を突きつけて脱出ゲートを開む</span>
                      <ArrowRight size={13} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ESCAPE PUZZLE INTERACTIVE VIEW (The Great Finale modal / section) */}
        {showEscapePhase && currentScenario && (
          <div className="bg-neutral-900 border-2 border-emerald-500 rounded-3xl p-6 md:p-8 space-y-6 shadow-2xl relative overflow-hidden animate-fade-in">
            <div className="absolute top-0 right-0 transform translate-x-12 -translate-y-8 text-emerald-500/5 pointer-events-none">
              <Skull size={200} />
            </div>

            <div className="border-b border-neutral-800 pb-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <span className="text-emerald-500 uppercase tracking-widest font-mono text-[10px] font-black border border-emerald-500/30 px-2 py-0.5 rounded bg-emerald-500/5 block w-max mb-1.5">
                  FINAL ESCAPE VERIFICATION
                </span>
                <h3 className="text-2xl font-black text-neutral-100 flex items-center gap-2">
                  <span>最終調書報告：「真犯人は誰だ？」</span>
                </h3>
              </div>
              
              <div className="flex items-center gap-1.5 bg-neutral-950 border border-neutral-800 px-4 py-2 rounded-xl text-xs font-mono font-bold text-neutral-400">
                <span>セキュア・パルス（残ライフ）:</span>
                <div className="flex gap-1">
                  {[...Array(3)].map((_, idx) => (
                    <span 
                      key={idx} 
                      className={`h-4 w-4 rounded-full flex items-center justify-center text-[10px] font-black ${
                        idx < escapeAttempts ? 'bg-rose-500 text-neutral-950' : 'bg-neutral-800 text-neutral-600'
                      }`}
                    >
                      ❤️
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* If resolved or failed */}
            {escapeResult ? (
              <div className={`p-6 rounded-2xl border ${
                escapeResult.success 
                  ? 'bg-emerald-950/30 border-emerald-500 text-neutral-100' 
                  : 'bg-rose-950/30 border-rose-500 text-neutral-100'
              } space-y-4`}>
                <div className="flex items-center gap-2.5 text-lg font-black">
                  {escapeResult.success ? (
                    <div className="h-10 w-10 bg-emerald-500 rounded-full flex items-center justify-center text-neutral-950 text-xl animate-pulse">✓</div>
                  ) : (
                    <div className="h-10 w-10 bg-rose-500 rounded-full flex items-center justify-center text-neutral-900 text-xl animate-shake">✗</div>
                  )}
                  <span>{escapeResult.success ? "ESCPE SUCCESS: 脱出に成功しました！" : "GAME OVER: 脱出に失敗しました"}</span>
                </div>
                
                <p className="text-sm leading-relaxed text-neutral-300">
                  {escapeResult.explanation}
                </p>

                <div className="pt-4 flex gap-3">
                  <button
                    id="btn-retry-scen"
                    onClick={() => selectScenario(currentScenario)}
                    className="bg-neutral-950 border border-neutral-800 hover:border-neutral-700 text-neutral-300 hover:text-neutral-100 font-bold text-xs px-5 py-2.5 rounded-xl transition-all flex items-center gap-1.5"
                  >
                    <RotateCcw size={12} />
                    <span>もう一度挑戦する</span>
                  </button>
                  
                  <button
                    id="btn-back-to-preset"
                    onClick={() => selectScenario(currentScenario)}
                    className="bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-xs px-5 py-2.5 rounded-xl transition-all flex items-center gap-1.5 hover:scale-[1.02] shadow-md shadow-amber-500/10"
                  >
                    <span>捜査官バインダーに戻る</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="bg-neutral-950 border border-neutral-850 rounded-2xl p-5 shadow-inner">
                  <h4 className="text-neutral-400 text-xs font-mono mb-2 uppercase">論理の最終審問</h4>
                  <p className="text-neutral-100 text-sm md:text-base font-bold leading-relaxed">
                    {currentScenario.finalQuestion.question}
                  </p>
                </div>

                <div className="space-y-3">
                  {currentScenario.finalQuestion.choices.map((choice, index) => {
                    const isSelected = selectedFinalChoice === index;
                    return (
                      <div
                        key={index}
                        id={`final-choice-${index}`}
                        onClick={() => setSelectedFinalChoice(index)}
                        className={`border rounded-2xl p-4 transition-all duration-300 cursor-pointer flex gap-3 items-center ${
                          isSelected 
                            ? 'bg-emerald-950/20 border-emerald-500 text-neutral-100 scale-[1.01]' 
                            : 'bg-neutral-950/40 border-neutral-850 hover:border-neutral-800 text-neutral-300'
                        }`}
                      >
                        <div className={`h-5 w-5 shrink-0 rounded-full border flex items-center justify-center font-bold text-xs ${
                          isSelected 
                            ? 'bg-emerald-500 border-emerald-400 text-neutral-950' 
                            : 'border-neutral-850 bg-neutral-950 text-neutral-500'
                        }`}>
                          {String.fromCharCode(65 + index)}
                        </div>
                        <p className="text-xs leading-relaxed">{choice}</p>
                      </div>
                    );
                  })}
                </div>

                <div className="flex gap-3 justify-end pt-2 border-t border-neutral-800">
                  <button
                    id="btn-abort-escape"
                    onClick={() => {
                      setShowEscapePhase(false);
                      setSelectedFinalChoice(null);
                    }}
                    className="bg-neutral-950 border border-neutral-800 text-neutral-400 font-bold text-xs px-5 py-2.5 rounded-xl transition-all"
                  >
                    戻る
                  </button>
                  <button
                    id="btn-confirm-escape"
                    disabled={selectedFinalChoice === null}
                    onClick={handleFinalEscapeSubmit}
                    className={`font-black text-xs px-6 py-2.5 rounded-xl transition-all shadow-md ${
                      selectedFinalChoice !== null 
                        ? 'bg-emerald-500 hover:bg-emerald-400 text-neutral-950 shadow-emerald-500/10' 
                        : 'bg-neutral-800 text-neutral-500 cursor-not-allowed'
                    }`}
                  >
                    論理報告書を送信し、脱出ゲートをハックする
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

      </main>

      {/* CREATIVE INFINITE DYNAMIC MIC-SCENARIO GENERATOR BOX OVERLAY MODAL */}
      {showCreatorModal && (
        <div className="fixed inset-0 bg-neutral-950/85 backdrop-blur-md z-45 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-gradient-to-b from-neutral-900 to-neutral-950 border border-neutral-800 w-full max-w-4xl rounded-3xl p-6 md:p-8 space-y-6 relative max-h-[90vh] overflow-y-auto shadow-2xl animate-scale-up">
            
            {/* Close button */}
            <button 
              onClick={() => setShowCreatorModal(false)}
              className="absolute top-4 right-4 bg-neutral-950 hover:bg-neutral-850 p-2 rounded-full border border-neutral-850 text-neutral-500 hover:text-neutral-300 transition-colors"
            >
              <X size={16} />
            </button>

            <div className="absolute top-0 right-0 w-48 h-48 bg-amber-500/5 rounded-full blur-3xl pointer-events-none"></div>
            
            <div className="flex items-start md:items-center justify-between gap-4 flex-col md:flex-row border-b border-neutral-800 pb-4">
              <div className="space-y-1">
                <span className="text-amber-500 uppercase tracking-widest font-mono text-[10px] font-black">
                  INFINITE GEMINI MYSTERY GENERATOR
                </span>
                <h3 className="text-xl font-black text-neutral-100 flex items-center gap-2">
                  <Sparkles className="text-amber-400 animate-pulse" size={20} />
                  <span>無限AIミステリー・オリジナル事件クリエイター</span>
                </h3>
              </div>
              <span className="text-xs text-neutral-500 bg-neutral-950 px-3 py-1 rounded-full border border-neutral-850">
                Powered by Gemini 3.5 Flash
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
              <div className="col-span-1 md:col-span-7 space-y-4">
                <p className="text-xs text-neutral-300 leading-relaxed">
                  定まった既存のシナリオを解き明かしたあとは、あなたの自由な発想をAIに伝えましょう。「テーマ」や「シチュエーション」を詳細に書くことで、Geminiが<b>独自の登場人物、完全に構成された証言リスト（矛盾が2箇所隠されています）、そして最終質問</b>をその場で精密にプロット設計して出力します。
                </p>

                <div className="space-y-2">
                  <label className="text-xs font-mono font-bold text-neutral-400 block">事件のシチュエーション・テーマ自由記入：</label>
                  <div className="relative">
                    <input
                      type="text"
                      id="input-custom-theme-modal"
                      value={customTheme}
                      onChange={(e) => setCustomTheme(e.target.value)}
                      placeholder="例：『古代エジプトのミイラ盗難事件』『近未来の自動配送センターの不審火』など"
                      disabled={isGeneratingScenario}
                      className="w-full bg-neutral-950 border border-neutral-800 text-neutral-100 rounded-2xl px-4 py-3 text-xs focus:outline-none focus:border-amber-500 transition-colors pr-12 font-semibold"
                    />
                    <div className="absolute top-1/2 right-3 -translate-y-1/2 text-neutral-600">
                      <Sparkles size={16} />
                    </div>
                  </div>
                </div>

                {/* Ideas / Presets triggers helper */}
                <div className="flex flex-wrap gap-2 pt-1 items-center">
                  <span className="text-[10px] text-neutral-500 font-mono">おすすめテーマ案:</span>
                  {[
                    "サイバー病院のハッキング",
                    "深海探査基地 of 浸水嘘",
                    "深夜のコンビニ強盗",
                    "魔法学校の答案改ざん"
                  ].map((idea) => (
                    <button
                      key={idea}
                      onClick={() => setCustomTheme(idea)}
                      disabled={isGeneratingScenario}
                      className="bg-neutral-950 hover:bg-neutral-905 border border-neutral-850 text-neutral-400 hover:text-neutral-200 text-[10px] px-2.5 py-1 rounded-lg transition-colors font-semibold"
                    >
                      + {idea}
                    </button>
                  ))}
                </div>
              </div>

              <div className="col-span-1 md:col-span-5 space-y-4 bg-neutral-950/40 p-5 rounded-2xl border border-neutral-850 flex flex-col justify-between">
                <div className="space-y-3">
                  <label className="text-xs font-mono font-bold text-neutral-400 block">難易度および論理パズルの堅牢度：</label>
                  
                  <div className="grid grid-cols-3 gap-2">
                    {(["Easy", "Medium", "Hard"] as const).map((diff) => (
                      <button
                        key={diff}
                        id={`diff-btn-modal-${diff}`}
                        onClick={() => setCustomDifficulty(diff)}
                        className={`py-2 rounded-xl text-xs font-bold border transition-all ${
                          customDifficulty === diff 
                            ? 'bg-amber-500 text-neutral-950 border-amber-400 scale-[1.03]' 
                            : 'bg-neutral-950 text-neutral-400 border-neutral-800 hover:border-neutral-700'
                        }`}
                      >
                        {diff === 'Easy' ? '初級 🟢' : diff === 'Medium' ? '中級 🟡' : '上級 🔴'}
                      </button>
                    ))}
                  </div>

                  <p className="text-[10px] text-neutral-500 leading-relaxed font-mono">
                    ※ 難易度を「Hard」にすると、非常に複雑な証言ズレが発生し、高い推理力が必要になります。
                  </p>
                </div>

                <button
                  id="btn-generate-scenario-modal"
                  disabled={isGeneratingScenario}
                  onClick={generateCustomScenario}
                  className="w-full bg-gradient-to-r from-amber-500 via-rose-500 to-indigo-600 hover:from-amber-400 text-neutral-950 font-black tracking-widest text-xs py-3.5 rounded-2xl transition-all duration-300 transform hover:scale-[1.01] flex items-center justify-center gap-2 shadow-lg shadow-rose-500/5 mt-2"
                >
                  {isGeneratingScenario ? (
                    <>
                      <RefreshCw className="animate-spin text-neutral-950" size={14} />
                      <span>Geminiがミステリ創作中... (約10秒)</span>
                    </>
                  ) : (
                    <>
                      <Sparkles size={14} className="text-neutral-950 animate-pulse" />
                      <span>オリジナル推理世界を構築する</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ACCUSATION DIALOG / MODAL PANEL (When clicking 'Accuse' on selected 2 items) */}
      {isAccusing && selectedEvidenceIds.length === 2 && (
        <div className="fixed inset-0 bg-neutral-950/80 backdrop-blur-md z-40 flex items-center justify-center p-4">
          <div className="bg-neutral-900 border border-neutral-800 w-full max-w-2xl rounded-3xl p-6 md:p-8 space-y-6 relative max-h-[90vh] overflow-y-auto shadow-2xl animate-scale-up">
            
            {/* Close button */}
            <button 
              id="btn-close-accuse"
              onClick={closeAccusationModal}
              className="absolute top-4 right-4 bg-neutral-950 hover:bg-neutral-850 p-2 rounded-full border border-neutral-850 text-neutral-500 hover:text-neutral-300 transition-colors"
            >
              <X size={16} />
            </button>

            <div className="border-b border-neutral-800 pb-3 flex items-center gap-2">
              <AlertTriangle className="text-amber-500" size={22} />
              <div>
                <h3 className="text-lg font-black text-neutral-100 tracking-wider">
                  対抗尋問：「異議あり！」の主張
                </h3>
                <p className="text-xs text-neutral-500">2つの言における論理を告発します</p>
              </div>
            </div>

            <div className="space-y-4">
              
              {/* Compare section */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-neutral-950 border border-neutral-850 p-4 rounded-2xl relative">
                  <span className="absolute top-2 right-2 text-[10px] font-mono text-neutral-500">証言A</span>
                  <p className="text-xs font-bold text-amber-500 mb-1.5">
                    {unlockedEvidences.find(e => e.id === selectedEvidenceIds[0])?.source}
                  </p>
                  <p className="text-xs italic leading-relaxed text-neutral-300">
                    {unlockedEvidences.find(e => e.id === selectedEvidenceIds[0])?.content}
                  </p>
                </div>

                <div className="bg-neutral-950 border border-neutral-850 p-4 rounded-2xl relative">
                  <span className="absolute top-2 right-2 text-[10px] font-mono text-neutral-500">証言B</span>
                  <p className="text-xs font-bold text-indigo-400 mb-1.5">
                    {unlockedEvidences.find(e => e.id === selectedEvidenceIds[1])?.source}
                  </p>
                  <p className="text-xs italic leading-relaxed text-neutral-300">
                    {unlockedEvidences.find(e => e.id === selectedEvidenceIds[1])?.content}
                  </p>
                </div>
              </div>

              {/* Dynamic Verification output box */}
              {accusationResult ? (
                <div className={`p-5 rounded-2xl border ${
                  accusationResult.isAccepted 
                    ? 'bg-emerald-950/20 border-emerald-500/80 text-neutral-100' 
                    : 'bg-rose-950/20 border-rose-500/80 text-neutral-300'
                } space-y-3`}>
                  <div className="flex items-center gap-2 font-black text-sm">
                    {accusationResult.isAccepted ? (
                      <span className="h-5 w-5 rounded-full bg-emerald-500 text-neutral-900 flex items-center justify-center text-xs">✓</span>
                    ) : (
                      <span className="h-5 w-5 rounded-full bg-rose-500 text-neutral-900 flex items-center justify-center text-xs">✗</span>
                    )}
                    <span>{accusationResult.isAccepted ? "論理的に正解です！矛盾を打破した！" : "却下！その指摘は妥当ではありません"}</span>
                  </div>
                  
                  {/* Character React block */}
                  <div className="bg-neutral-950/60 p-3.5 rounded-xl border border-neutral-850">
                    <span className="text-[10px] text-neutral-500 font-mono block mb-1">相手の動揺的な反応:</span>
                    <p className="text-xs text-neutral-200 italic font-medium leading-relaxed">
                      “ {accusationResult.characterResponse} ”
                    </p>
                  </div>

                  <p className="text-xs leading-relaxed text-neutral-400 font-mono">
                    <b>（論理解析解説）：</b> {accusationResult.logicExplanation}
                  </p>

                  {accusationResult.isAccepted && accusationResult.nextClue && (
                    <div className="bg-amber-500/10 border border-amber-500/30 p-3.5 rounded-xl text-neutral-100 space-y-1.5 mt-2">
                      <span className="text-xs font-bold text-amber-500 flex items-center gap-1.5">
                        <Sparkles size={13} className="animate-pulse" />
                        <span>新たな言が解放されました！ : {accusationResult.nextClue.clueMessage}</span>
                      </span>
                      <p className="text-xs leading-relaxed italic text-neutral-300">
                        {accusationResult.nextClue.content}
                      </p>
                    </div>
                  )}

                  <div className="pt-2 flex justify-end">
                    <button
                      id="btn-dismiss-result"
                      onClick={closeAccusationModal}
                      className="bg-neutral-100 hover:bg-white text-neutral-950 font-bold text-xs px-5 py-2 rounded-xl transition-all"
                    >
                      捜査を続ける
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <label className="text-xs font-mono font-bold text-neutral-400 block">
                        なぜこれらが矛盾しているのか、あなたのロジックを入力：
                      </label>
                      <button
                        onClick={() => {
                          const matched = currentScenario.contradictions.find(c => 
                            (c.evidenceIdA === selectedEvidenceIds[0] && c.evidenceIdB === selectedEvidenceIds[1]) ||
                            (c.evidenceIdA === selectedEvidenceIds[1] && c.evidenceIdB === selectedEvidenceIds[0])
                          );
                          if (matched) {
                            setUserExplanation(`【ヒントを活用】 ${matched.description}`);
                          } else {
                            setUserExplanation("恐らく主張されている内容、時間、場所やアリバイが一致していません。");
                          }
                        }}
                        className="text-[10px] text-amber-500 hover:text-amber-400 hover:underline"
                      >
                        💡 捜査のヒントを代入する
                      </button>
                    </div>
                    
                    <textarea
                      id="input-accuse-explanation"
                      rows={3}
                      value={userExplanation}
                      onChange={(e) => setUserExplanation(e.target.value)}
                      placeholder="例：『ハリスはシャワーを浴びていたと言うが、ジェイクは元栓を閉めて水は一滴も出なかったと言っており、時間帯が完全にバッティングしている。』など"
                      disabled={isVerifying}
                      className="w-full bg-neutral-950 border border-neutral-850 rounded-2xl p-4 text-xs text-neutral-100 focus:outline-none focus:border-amber-500 transition-colors placeholder:text-neutral-600 font-medium leading-relaxed resize-none"
                    />
                  </div>

                  <div className="flex gap-3 justify-end">
                    <button
                      id="btn-cancel-accuse"
                      type="button"
                      onClick={closeAccusationModal}
                      className="bg-neutral-950 border border-neutral-850 text-neutral-400 hover:text-neutral-200 font-bold text-xs px-5 py-2.5 rounded-xl transition-all"
                    >
                      キャンセル
                    </button>
                    
                    <button
                      id="btn-submit-verify"
                      disabled={!userExplanation.trim() || isVerifying}
                      onClick={handleVerifyContradiction}
                      className={`font-black text-xs px-6 py-2.5 rounded-xl transition-all flex items-center gap-1.5 shadow-md ${
                        userExplanation.trim() && !isVerifying
                          ? 'bg-amber-500 hover:bg-amber-400 text-neutral-950 shadow-amber-500/15'
                          : 'bg-neutral-800 text-neutral-500 cursor-not-allowed'
                      }`}
                    >
                      {isVerifying ? (
                        <>
                          <RefreshCw className="animate-spin text-neutral-950" size={13} />
                          <span>AI判定中...</span>
                        </>
                      ) : (
                        <>
                          <Send size={13} />
                          <span>告発（異議あり！）</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* FOOTER */}
      <footer className="border-t border-neutral-900 bg-neutral-950 py-8 px-4 text-center text-xs text-neutral-500 space-y-2 mt-12">
        <p className="font-mono">CRITICAL PATH METHOD // LOGICAL COMBAT RADAR SYSTEM</p>
        <p className="text-neutral-600">
          相手の発言の「盾と矛（矛盾）」を見抜く脱出ゲーム。AIがあなたの言葉の論理性そのものをリアルタイム診断します。
        </p>
      </footer>

    </div>
  );
}
