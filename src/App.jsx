import React, { useState, useEffect, useRef, useCallback } from "react";

// --- Constants ---
const MIN_SESSION_MINUTES = 1;
const MAX_SESSION_MINUTES = 15;
const WARMUP_QUESTIONS_COUNT = 5;
const BREATHING_SPACE_DURATION_MS = 1500;
const LEVEL_UP_THRESHOLDS = { 1: 5, 2: 10 };
const FOCUS_QUOTE_INTERVAL = 5;
const FOCUS_QUOTE_DURATION_MS = 4000;
const LEVEL_UP_MESSAGES = { 2: "🧠 Level 2!", 3: "🚀 Level 3!" };
const MESSAGE_TIMEOUT_MS = 2500;
const MAX_LEVEL = 3;
const START_DIFFICULTY_LEVELS = { Easy: 1, Medium: 2, Hard: 3 };
const endQuotes = [ "Discipline is the bridge...", "The mind is everything...", "Focus is a skill...", "Sharp thoughts...", "Presence..."];
const focusQuotes = [ "Be present.", "Deep breaths.", "One rep...", "Clear mind.", "Observe.", "Flow state...", "Engage.", "Consistency.", "Trust.", "Just this." ];
const getRandomQuote = (type = 'end') => { const list = type === 'focus' ? focusQuotes : endQuotes; if (!list || list.length === 0) return "Session ended."; return list[Math.floor(Math.random() * list.length)]; };


// --- Helper Function ---
const calculate = (a, op, b) => {
    switch (op) {
        case "+": return a + b;
        case "-": return a - b;
        case "*": return a * b;
        default: console.error(`[Calculate] Unknown operator: ${op}`); return NaN;
    }
};

// --- Problem Generation ---
const getProblem = (difficultyLevel) => {
    let a, b, op, question, answer; // Declare vars
    const operatorsLv1 = ["+", "-"];
    const operatorsLv3 = ["+", "-", "*"];
    const currentLevel = Math.max(0, Math.min(difficultyLevel, MAX_LEVEL)); // Clamp
    console.log("[getProblem] Generating for level:", currentLevel);
    try {
        if (currentLevel <= 0) { a = Math.floor(Math.random() * 5) + 1; b = Math.floor(Math.random() * 5) + 1; op = '+'; }
        else if (currentLevel === 1) { a = Math.floor(Math.random() * 10); b = Math.floor(Math.random() * 10); op = operatorsLv1[Math.floor(Math.random() * operatorsLv1.length)]; if (op === '-' && a < b) [a, b] = [b, a]; }
        else if (currentLevel === 2) { a = Math.floor(Math.random() * 90) + 10; b = Math.floor(Math.random() * 90) + 10; op = operatorsLv1[Math.floor(Math.random() * operatorsLv1.length)]; if (op === '-' && a < b) [a, b] = [b, a]; }
        else { const range = currentLevel === 3 ? 11 : 21; const min = 2; a = Math.floor(Math.random() * range) + min; b = Math.floor(Math.random() * range) + min; op = currentLevel >= 3 ? '*' : operatorsLv3[Math.floor(Math.random() * operatorsLv3.length)]; if (op === '-' && a < b) [a, b] = [b, a]; answer = calculate(a, op, b); if (currentLevel > 3 && (!Number.isFinite(answer) || Math.abs(answer) > 1500)) { a = Math.floor(Math.random() * 11) + 2; b = Math.floor(Math.random() * 11) + 2; op = '*'; answer = calculate(a, op, b); } }
        question = `${a} ${op} ${b}`; answer = calculate(a, op, b); // Final Calculation
        if (isNaN(answer) || typeof question === 'undefined') throw new Error("Invalid generation result");
        console.log(`[getProblem] SUCCESS: Returning { q: "${question}", a: ${answer} }`);
        return { question, answer };
    } catch (error) {
        console.error("[getProblem] ERROR:", error); console.warn("[getProblem] Returning fallback: 1 + 0 = 1");
        return { question: "1 + 0", answer: 1 }; // Use distinct fallback
    }
};

// --- Main App Component ---
export default function App() {
    // --- State ---
    const [gameState, setGameState] = useState('start');
    const [currentProblem, setCurrentProblem] = useState(null);
    const [userAnswer, setUserAnswer] = useState("");
    const [minutes, setMinutes] = useState(2);
    const [endTime, setEndTime] = useState(null);
    const [timeLeft, setTimeLeft] = useState(0);
    const [difficultyLevel, setDifficultyLevel] = useState(0);
    const [warmupProgress, setWarmupProgress] = useState(0);
    const [lockedInCorrectCount, setLockedInCorrectCount] = useState(0);
    const [totalAttempts, setTotalAttempts] = useState(0);
    const [skippedCount, setSkippedCount] = useState(0);
    const [feedbackMessage, setFeedbackMessage] = useState("");
    const [focusQuote, setFocusQuote] = useState("");
    const [levelUpMsg, setLevelUpMsg] = useState("");
    const [endQuote, setEndQuote] = useState("");
    const [darkMode, setDarkMode] = useState(false);
    const [isSoundtrackMuted, setIsSoundtrackMuted] = useState(true);
    const [startDifficulty, setStartDifficulty] = useState(START_DIFFICULTY_LEVELS.Easy);

    // --- Refs ---
    const inputRef = useRef(null);
    const timeoutRef = useRef(null); // General message/quote/breathing timeout
    const timerIntervalRef = useRef(null); // Session timer
    const audioRef = useRef(null);
    // Ref to ensure handlers always access the latest problem data
    const latestProblemRef = useRef(currentProblem);

    // --- Effects ---

    // Sync state to ref whenever currentProblem changes
    useEffect(() => {
        latestProblemRef.current = currentProblem;
    }, [currentProblem]);

    // Dark Mode Management
    useEffect(() => {
        const storedMode = localStorage.getItem('lockedin_darkMode'); const initialMode = storedMode ? JSON.parse(storedMode) === true : false; setDarkMode(initialMode); if (initialMode) document.documentElement.classList.add('dark'); else document.documentElement.classList.remove('dark');
    }, []);
    useEffect(() => {
        const root = document.documentElement; if (darkMode) root.classList.add('dark'); else root.classList.remove('dark'); try { localStorage.setItem('lockedin_darkMode', JSON.stringify(darkMode)); } catch (e) {}
    }, [darkMode]);

    // Audio Control
    useEffect(() => {
        const audio = audioRef.current; if (!audio) return; audio.muted = isSoundtrackMuted;
        const shouldBePlaying = gameState === 'warmup' || gameState === 'lockedIn' || gameState === 'breathingSpace';
        if (shouldBePlaying && audio.paused) { audio.play().catch(e => console.warn("Audio play blocked:", e)); }
        else if (!shouldBePlaying && !audio.paused) { audio.pause(); }
    }, [gameState, isSoundtrackMuted]);

    // Session Timer
    useEffect(() => {
        const clearTimer = () => { if (timerIntervalRef.current) { clearInterval(timerIntervalRef.current); timerIntervalRef.current = null; } };
        if (!(gameState === 'warmup' || gameState === 'lockedIn' || gameState === 'breathingSpace') || !endTime || endTime <= Date.now()) { clearTimer(); return; }
        if (timerIntervalRef.current) return;
        timerIntervalRef.current = setInterval(() => {
            const secondsLeft = Math.max(0, Math.floor((endTime - Date.now()) / 1000)); setTimeLeft(secondsLeft);
            if (secondsLeft <= 0) { clearTimer(); setEndQuote(getRandomQuote('end')); setGameState('end'); console.log("[Timer] Ended."); }
        }, 1000);
        return clearTimer;
    }, [gameState, endTime]);

    // Timeout Cleanup
    useEffect(() => () => clearTimeout(timeoutRef.current), []);

    // Focus Input
    useEffect(() => {
        if ((gameState === 'warmup' || gameState === 'lockedIn') && currentProblem && inputRef.current) {
            const focusTimer = setTimeout(() => { inputRef.current?.focus(); }, 50);
             return () => clearTimeout(focusTimer);
        }
    }, [gameState, currentProblem]);

    // --- Handlers ---

    // Setting Toggles
    const toggleDarkMode = useCallback(() => setDarkMode(prev => !prev), []);
    const toggleSoundtrackMute = useCallback(() => setIsSoundtrackMuted(prev => !prev), []);
    const handleDifficultyChange = useCallback((event) => { setStartDifficulty(parseInt(event.target.value, 10)); }, []);
    const handleMinutesChange = (e) => { setMinutes(Math.max(MIN_SESSION_MINUTES, Math.min(MAX_SESSION_MINUTES, parseInt(e.target.value) || MIN_SESSION_MINUTES))); };

    // Reset Game -> Start Screen
    const resetForNewGame = useCallback(() => {
        console.log("[Reset] Resetting to 'start'."); setGameState('start'); setWarmupProgress(0); setLockedInCorrectCount(0); setTotalAttempts(0); setSkippedCount(0); setDifficultyLevel(0); setFeedbackMessage(""); setFocusQuote(""); setLevelUpMsg(""); setEndTime(null); setTimeLeft(0); setCurrentProblem(null); latestProblemRef.current = null; clearTimeout(timeoutRef.current); clearInterval(timerIntervalRef.current); timerIntervalRef.current = null; timeoutRef.current = null; audioRef.current?.pause();
    }, []);

    // Start Session -> Warmup
    const handleStart = useCallback(() => {
        console.log("[handleStart] Triggered."); setWarmupProgress(0); setLockedInCorrectCount(0); setTotalAttempts(0); setSkippedCount(0); setFeedbackMessage(""); setFocusQuote(""); setLevelUpMsg(""); setCurrentProblem(null); latestProblemRef.current = null; clearTimeout(timeoutRef.current); clearInterval(timerIntervalRef.current); timerIntervalRef.current = null; timeoutRef.current = null;
        const durationSeconds = Math.max(1, minutes) * 60; setEndTime(Date.now() + durationSeconds * 1000); setTimeLeft(durationSeconds); setDifficultyLevel(0); setGameState('warmup');
        console.log(`[handleStart] State:'warmup'. Fetching problem.`);
        try { const firstProblem = getProblem(0); if (!firstProblem || typeof firstProblem.answer === 'undefined') throw new Error("Inv problem"); setCurrentProblem(firstProblem); /* Sync effect will update ref */ console.log(`[handleStart] 1st problem set: ${firstProblem.question}`); }
        catch (error) { console.error("Start err:", error); resetForNewGame(); }
    }, [minutes, startDifficulty, resetForNewGame]);


    // Handle Game Progression (Correct Answer / Skip)
    const goToNextProblem = useCallback((isCorrect) => {
        console.log(`[goToNext] Correct:${isCorrect}. State:${gameState}. Lvl:${difficultyLevel}. LC#:${lockedInCorrectCount}. WC#:${warmupProgress}`);
        let currentWarmup = warmupProgress; let currentLockedIn = lockedInCorrectCount; let currentInternalLevel = difficultyLevel; let justLeveledUp = false;
        if (isCorrect) { if (gameState === 'warmup') currentWarmup++; else currentLockedIn++; }
        setWarmupProgress(currentWarmup); setLockedInCorrectCount(currentLockedIn); // Update counts immediately

        let nextInternalLevel = currentInternalLevel; let nextProblem = null; let nextGameState = gameState;

        if (gameState === 'warmup') {
            if (currentWarmup >= WARMUP_QUESTIONS_COUNT) { // --- WARMUP COMPLETE ---
                 nextInternalLevel = startDifficulty; nextGameState = 'lockedIn';
                 console.log(`[goToNext] Warmup Complete -> Lvl:${nextInternalLevel}.`);
                 try { nextProblem = getProblem(nextInternalLevel); if (!nextProblem || typeof nextProblem.answer === 'undefined') throw new Error("Invalid L1 problem");
                       setDifficultyLevel(nextInternalLevel); setCurrentProblem(nextProblem); setGameState(nextGameState); } // Direct transition
                 catch(e) { console.error("[goToNext] Error L1:",e); resetForNewGame(); return; }
            } else { // --- CONTINUE WARMUP ---
                 console.log("[goToNext] Continue Warmup");
                 try { nextProblem = getProblem(0); if (!nextProblem || typeof nextProblem.answer === 'undefined') throw new Error("Invalid Warmup prob");
                       setCurrentProblem(nextProblem); } // Update problem state only
                 catch (e) { console.error("[goToNext] Error Warmup:",e); resetForNewGame(); return; }
            }
        } else if (gameState === 'lockedIn') {
            // --- Level Up Check & Quote Check (same logic as before) ---
             if (isCorrect && currentInternalLevel < MAX_LEVEL) { const t = LEVEL_UP_THRESHOLDS[currentInternalLevel]; if (t && currentLockedIn % t === 0) { nextInternalLevel++; justLeveledUp = true; setLevelUpMsg(LEVEL_UP_MESSAGES[nextInternalLevel] || `Level ${nextInternalLevel}!`); clearTimeout(timeoutRef.current); timeoutRef.current = setTimeout(() => setLevelUpMsg(""), MESSAGE_TIMEOUT_MS);} }
             if (isCorrect && !justLeveledUp && currentLockedIn > 0 && currentLockedIn % FOCUS_QUOTE_INTERVAL === 0) { const q = getRandomQuote('focus'); setFocusQuote(q); clearTimeout(timeoutRef.current); timeoutRef.current = setTimeout(() => setFocusQuote(""), FOCUS_QUOTE_DURATION_MS);}
            // --- Breathing Space ---
             console.log("[goToNext] -> Breathing Space. Next Lvl:", nextInternalLevel);
             setGameState('breathingSpace'); setCurrentProblem(null); // Clear problem for pause
             clearTimeout(timeoutRef.current); // Ensure messages don't persist incorrectly
             timeoutRef.current = setTimeout(() => { // Schedule return
                 console.log("[Timeout] Breathing End -> Fetch Lvl:", nextInternalLevel);
                 try { const problem = getProblem(nextInternalLevel); if (!problem || typeof problem.answer === 'undefined') throw new Error(); setDifficultyLevel(nextInternalLevel); setGameState('lockedIn'); setCurrentProblem(problem); }
                 catch(e) {console.error("Error post-breath:", e); resetForNewGame();}
             }, BREATHING_SPACE_DURATION_MS);
        }
    }, [gameState, warmupProgress, lockedInCorrectCount, difficultyLevel, startDifficulty, resetForNewGame]); // Removed transient state like focusQuote, levelUpMsg


    // --- *** Handler: Submit Answer - Incorporates Time Check, Reads Answer from Ref *** ---
    const handleAnswerSubmit = useCallback(() => {
        // --- Read problem from REF first ---
        const problemFromRef = latestProblemRef.current;
        console.log(`[onSubmit Entry] State:${gameState}, Time:${timeLeft}, Ref Prob:${problemFromRef?.question}`);

        // --- Time Check ---
        if (timeLeft <= 0) {
            console.log("[onSubmit] Blocked: Time is up.");
            if (gameState !== 'end') {
                setFeedbackMessage("⏳ Time's up!");
                clearTimeout(timeoutRef.current);
                timeoutRef.current = setTimeout(() => setFeedbackMessage(""), MESSAGE_TIMEOUT_MS);
                console.warn("[onSubmit] Forcing end state due to late submit.");
                setEndQuote(getRandomQuote('end')); setGameState('end');
             }
            return;
        }
        // --- End Time Check ---

        // Check game state and problem validity (using ref)
        if (!problemFromRef || gameState === 'breathingSpace') {
             console.log(`[onSubmit] Blocked: RefProblem:${!!problemFromRef}, State:${gameState}`);
             return;
         }

        setTotalAttempts(prev => prev + 1);
        const answerTrimmed = userAnswer.trim();
        // --- Get expected answer from REF ---
        const expectedAnswer = problemFromRef.answer;

        // --- Validate expected answer and user input ---
        if (typeof expectedAnswer === 'undefined' || isNaN(expectedAnswer)) {
             console.error("[onSubmit FATAL] Ref expected answer invalid!", problemFromRef);
             resetForNewGame(); // Critical error, reset
             return;
         }
         if (answerTrimmed === "" || isNaN(answerTrimmed)) {
            setFeedbackMessage("🔢 Enter number"); clearTimeout(timeoutRef.current);
            timeoutRef.current = setTimeout(() => setFeedbackMessage(""), MESSAGE_TIMEOUT_MS);
            inputRef.current?.select(); return;
        }

        // --- Perform comparison ---
        const answerNum = parseInt(answerTrimmed, 10);
        console.log(`[onSubmit] Comparing Input:${answerNum} vs Expected:${expectedAnswer} (from Ref)`);

        if (answerNum === expectedAnswer) { // CORRECT
            console.log("[onSubmit] Result: CORRECT"); setUserAnswer(""); setFeedbackMessage("");
            goToNextProblem(true); // Use separate handler for game progression
        } else { // INCORRECT
            console.log("[onSubmit] Result: INCORRECT"); setFeedbackMessage("❌ Try again."); setUserAnswer("");
            clearTimeout(timeoutRef.current); // Clear prev msg timeouts
            timeoutRef.current = setTimeout(() => setFeedbackMessage(""), MESSAGE_TIMEOUT_MS);
            inputRef.current?.select();
        }
    // Dependencies: values read directly (state), functions called. Explicitly NO currentProblem.
    }, [userAnswer, gameState, timeLeft, goToNextProblem, resetForNewGame]);


    // Skip Handler (useCallback ok, uses ref for safety)
    const handleGiveUp = useCallback(() => {
        const problemFromRef = latestProblemRef.current;
        if (timeLeft <= 0 || !problemFromRef || gameState !== 'lockedIn') return; // Check time
         setFeedbackMessage(`Answer: ${problemFromRef.answer}`); setSkippedCount(prev => prev + 1); setUserAnswer("");
         clearTimeout(timeoutRef.current); // Clear message timers
         console.log("[handleGiveUp] Skipping"); goToNextProblem(false); // Go next
    }, [gameState, timeLeft, goToNextProblem]); // Removed currentProblem state dependency

    // KeyDown Handler (useCallback ok, adds time check)
    const handleKeyDown = useCallback((e) => {
        if (timeLeft <= 0) return; // Time check
        if (e.key === 'Enter' && (gameState === 'warmup' || gameState === 'lockedIn')) { handleAnswerSubmit(); }
    }, [handleAnswerSubmit, gameState, timeLeft]); // Add timeLeft

    // Home Button Handler (useCallback ok)
    const handleGoHome = useCallback(() => { resetForNewGame(); }, [resetForNewGame]);

    // --- Render Functions --- (JSX Copied back from "Colors" Version)

    const renderStartScreen = () => ( <div className="flex flex-col items-center justify-center text-center w-full max-w-sm"> <div className="absolute top-4 right-4 flex flex-col gap-2 items-end text-xs z-10"> <button onClick={toggleDarkMode} title="Toggle Theme" className="p-2 rounded-full bg-gray-200 dark:bg-slate-700 hover:bg-gray-300 dark:hover:bg-slate-600 transition-colors"> {darkMode ? "🌞" : "🌙"} </button> <button onClick={toggleSoundtrackMute} title="Mute/Unmute Soundtrack" className="p-2 rounded-full bg-gray-200 dark:bg-slate-700 hover:bg-gray-300 dark:hover:bg-slate-600 transition-colors"> {isSoundtrackMuted ? "🔇" : "🔈"} </button> </div> <h1 className="text-5xl font-bold mb-6 text-blue-600 dark:text-blue-400 flex items-center gap-2">🧠 LockedIn</h1> <label className="flex items-center justify-center gap-2 mb-4 text-lg text-gray-700 dark:text-gray-300"> Duration: <input type="number" value={minutes} min={MIN_SESSION_MINUTES} max={MAX_SESSION_MINUTES} onChange={handleMinutesChange} aria-label="Session duration in minutes" className="p-1 border border-gray-300 dark:border-slate-600 rounded w-16 text-center bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"/> min </label> <fieldset className="mb-6"> <legend className="text-lg text-gray-700 dark:text-gray-300 mb-2">Start Level:</legend> <div className="flex justify-center gap-4">{Object.entries(START_DIFFICULTY_LEVELS).map(([name, levelValue]) => ( <label key={levelValue} className="flex items-center gap-1.5 cursor-pointer text-sm p-2 rounded-md hover:bg-blue-50 dark:hover:bg-slate-800 border border-transparent hover:border-blue-200 dark:hover:border-slate-700 transition-colors"><input type="radio" name="startDifficulty" value={levelValue} checked={startDifficulty === levelValue} onChange={handleDifficultyChange} className="accent-blue-500 dark:accent-blue-400 h-4 w-4"/> {name} </label> ))}</div> </fieldset> <button onClick={handleStart} className="bg-gradient-to-r from-blue-500 to-blue-600 dark:from-blue-600 dark:to-blue-700 hover:from-blue-600 hover:to-blue-700 dark:hover:from-blue-700 dark:hover:to-blue-800 text-white px-10 py-4 rounded-lg text-2xl font-semibold transition-all duration-150 shadow-md hover:shadow-lg transform hover:scale-105"> Begin Activation </button> </div> );
    const renderLoadingScreen = () => ( <div className="flex flex-col items-center justify-center text-center w-full max-w-sm pt-16 sm:pt-12"><p className="text-xl animate-pulse text-gray-500 dark:text-gray-400">Loading...</p><div className="absolute top-4 left-4 right-4 flex justify-between items-center text-sm font-medium px-2 sm:px-0 z-10 opacity-20"> <span className="px-2 py-1 text-xl"> 🏠 </span> <span className="bg-gray-200 dark:bg-slate-700 px-3 py-1 rounded-full">...</span> <span className="bg-gray-200 dark:bg-slate-700 px-3 py-1 rounded-full"> ⏳ --:-- </span> <div className="flex items-center gap-2"> <span className="p-2 rounded-full bg-gray-200 dark:bg-slate-700 text-xs"> {isSoundtrackMuted ? "🔇" : "🔈"} </span> <span className="p-2 rounded-full bg-gray-200 dark:bg-slate-700 text-xs"> {darkMode ? "🌞" : "🌙"} </span> </div></div></div> );
    const renderGameScreen = () => ( <div className="flex flex-col items-center justify-center w-full max-w-md md:max-w-lg pt-16 sm:pt-12"><div className="absolute top-4 left-4 right-4 flex justify-between items-center text-sm font-medium px-2 sm:px-0 z-10"><button onClick={handleGoHome} title="End Session & Go Home" className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors text-xl"> 🏠 </button><span className="tabular-nums bg-teal-100 text-teal-800 dark:bg-teal-800 dark:text-teal-100 px-4 py-1 rounded-full font-semibold hidden sm:inline-block"> {gameState === 'warmup' ? `Warmup: ${warmupProgress}/${WARMUP_QUESTIONS_COUNT}` : `Level: ${difficultyLevel}`} </span><span className="tabular-nums bg-teal-100 text-teal-800 dark:bg-teal-800 dark:text-teal-100 px-4 py-1 rounded-full font-semibold"> ⏳ {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, "0")} </span><div className="flex items-center gap-2"><button onClick={toggleSoundtrackMute} title="Mute/Unmute Soundtrack" className="p-2 rounded-full bg-gray-200 dark:bg-slate-700 hover:bg-gray-300 dark:hover:bg-slate-600 transition-colors text-xs"> {isSoundtrackMuted ? "🔇" : "🔈"} </button><button onClick={toggleDarkMode} title="Toggle Theme" className="p-2 rounded-full bg-gray-200 dark:bg-slate-700 hover:bg-gray-300 dark:hover:bg-slate-600 transition-colors text-xs"> {darkMode ? "🌞" : "🌙"} </button></div></div><div className="h-8 text-center mb-2 font-semibold text-base"> {levelUpMsg ? <span className="animate-pulse text-green-600 dark:text-green-400">{levelUpMsg}</span> : focusQuote ? <span className="text-purple-600 dark:text-purple-400 italic">{focusQuote}</span> : <span className="opacity-0">_</span>} </div>{gameState === 'breathingSpace' ? ( <div className="flex items-center justify-center h-[290px] sm:h-[330px] w-full"> <span className="animate-pulse text-gray-400 dark:text-gray-600 text-4xl">...</span> </div> ) : currentProblem ? ( <> <h2 className="text-xl font-medium text-gray-600 dark:text-gray-400 mb-3">Solve:</h2><div className="text-6xl font-bold my-4 p-5 bg-slate-100 dark:bg-slate-800 rounded-lg shadow-md min-w-[250px] sm:min-w-[300px] text-center text-slate-800 dark:text-slate-100 tabular-nums"> {currentProblem.question} </div><div className="flex items-center gap-4 mt-3"> <input ref={inputRef} type="number" inputMode="numeric" pattern="[0-9\-]*" value={userAnswer} onChange={(e) => setUserAnswer(e.target.value)} onKeyDown={handleKeyDown} placeholder="Answer" aria-label="Your Answer" className={`text-center border-b-2 text-3xl w-32 sm:w-40 p-2 bg-transparent border-slate-300 dark:border-slate-600 focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none transition-colors placeholder-gray-500 dark:placeholder-gray-400`} autoComplete="off" /><button onClick={handleAnswerSubmit} className="bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white px-6 sm:px-8 py-3 sm:py-4 rounded-lg text-lg sm:text-xl font-semibold transition-colors shadow hover:shadow-md"> Submit </button></div>{gameState === 'lockedIn' && ( <button onClick={handleGiveUp} className="mt-5 text-xs text-gray-400 dark:text-gray-500 hover:text-orange-500 dark:hover:text-orange-400 transition-colors"> Show Answer & Skip </button> )} </> ) : null } <div className="h-7 text-center mt-4 text-lg font-semibold"> {feedbackMessage.startsWith("Answer:") ? <span className="text-orange-600 dark:text-orange-400">{feedbackMessage}</span> : feedbackMessage ? <span className="text-red-600 dark:text-red-400">{feedbackMessage}</span> : <span className="opacity-0">_</span> } </div> </div> );
    const renderEndScreen = () => { const accuracy = totalAttempts > 0 ? Math.round(((warmupProgress + lockedInCorrectCount) / totalAttempts) * 100) : 0; const totalCorrect = warmupProgress + lockedInCorrectCount; return ( <div className="flex flex-col items-center justify-center text-center gap-6 w-full max-w-md px-4"> <button onClick={toggleDarkMode} title="Toggle Theme" className="absolute top-4 right-4 p-2 rounded-full bg-gray-200 dark:bg-slate-700 hover:bg-gray-300 dark:hover:bg-slate-600 transition-colors text-xs z-10"> {darkMode ? "🌞" : "🌙"} </button><h2 className="text-3xl font-semibold text-gray-800 dark:text-gray-100">✨ Session Complete! ✨</h2><div className="text-lg bg-slate-100 dark:bg-slate-800 p-4 rounded-lg shadow-sm w-full"><p className="text-slate-700 dark:text-slate-300">Correct: <span className="font-bold text-blue-600 dark:text-blue-400">{totalCorrect}</span></p><p className="text-slate-700 dark:text-slate-300">Accuracy: <span className="font-bold text-blue-600 dark:text-blue-400">{accuracy}%</span> <span className="text-sm text-slate-500 dark:text-slate-400">({totalCorrect}/{totalAttempts})</span></p>{skippedCount > 0 && <p className="text-slate-700 dark:text-slate-300">Skipped: <span className="font-bold text-orange-600 dark:text-orange-400">{skippedCount}</span></p>}</div><p className="text-lg text-slate-600 dark:text-slate-400 max-w-md italic mt-2">"{endQuote}"</p><button onClick={resetForNewGame} className="mt-4 bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white px-6 py-3 rounded-lg text-lg font-semibold transition-colors shadow-md"> Main Menu </button> </div> ); };

    // --- Main Render ---
    return (
        <div className={`flex flex-col items-center justify-center min-h-screen p-4 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-200 transition-colors duration-300 relative overflow-hidden`}>
            <audio ref={audioRef} src="/soundtrack.mp3" loop preload="auto"></audio>
            {gameState === 'start' && renderStartScreen()}
            {gameState === 'end' && renderEndScreen()}
            {(gameState === 'warmup' || gameState === 'lockedIn' || gameState === 'breathingSpace') && (
                 (!currentProblem && gameState !== 'breathingSpace') ? renderLoadingScreen() : renderGameScreen()
            )}
        </div>
    );
}