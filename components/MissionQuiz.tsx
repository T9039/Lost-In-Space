"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Award, CheckCircle2, ChevronRight, Flame, Radio, RotateCcw, Sparkles, XCircle } from "lucide-react";
import type { Item } from "@/lib/types";

interface Question {
  id: string;
  itemId: string;
  itemName: string;
  zone: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

function generateQuestions(items: Item[]): Question[] {
  return [
    {
      id: "q-opp-drive",
      itemId: "opportunity",
      itemName: "Opportunity (MER-B)",
      zone: "mars",
      question: "Opportunity was originally planned to survive for 90 days. What off-world driving record did it ultimately set?",
      options: [
        "45.16 km (28.06 mi) across Mars over 14+ years",
        "12.4 km (7.7 mi) within Meridiani Planum",
        "102.8 km (63.8 mi) across Jezero Crater",
        "5.2 km (3.2 mi) before entering safe mode",
      ],
      correctIndex: 0,
      explanation: "Opportunity drove 45.16 km (28.06 mi) over more than 14 Earth years, setting the all-time off-world driving distance record.",
    },
    {
      id: "q-opp-end",
      itemId: "opportunity",
      itemName: "Opportunity (MER-B)",
      zone: "mars",
      question: "What catastrophic event finally caused Opportunity to go silent on 10 June 2018?",
      options: [
        "A planet-wide dust storm blocked sunlight from its solar arrays",
        "Its primary drive motor seized in Perseverance Valley",
        "A severe software bug corrupted its flash memory",
        "Extreme sub-zero night temperatures cracked its main battery",
      ],
      correctIndex: 0,
      explanation: "A massive, global Martian dust storm blocked all sunlight from Opportunity's solar panels, draining its batteries.",
    },
    {
      id: "q-voyager-farthest",
      itemId: "voyager-1",
      itemName: "Voyager 1",
      zone: "deep-space",
      question: "Which spacecraft is the farthest human-made object from Earth, continuing to transmit from interstellar space?",
      options: [
        "Voyager 1, over 160 AU away from the Sun",
        "Pioneer 10, resting beyond the Kuiper Belt",
        "New Horizons, cruising past Pluto",
        "Voyager 2, heading toward the South Celestial Pole",
      ],
      correctIndex: 0,
      explanation: "Voyager 1 crossed the heliopause in August 2012 and remains humanity's most distant envoy in interstellar space.",
    },
    {
      id: "q-apollo-laser",
      itemId: "apollo-11-lm",
      itemName: "Apollo 11 Lunar Module",
      zone: "moon",
      question: "Which scientific payload left by Apollo 11 on the Sea of Tranquillity is still actively pinged by Earth lasers today?",
      options: [
        "Lunar Laser Ranging Retroreflector array (corner-cube prisms)",
        "Passive Seismic Experiment Package (PSEP)",
        "Solar Wind Composition Collector sheet",
        "Lunar Surface Magnetometer array",
      ],
      correctIndex: 0,
      explanation: "The Apollo 11 corner-cube retroreflector array requires no electrical power and continues to reflect ground-based laser pulses to measure Moon distance to millimeter accuracy.",
    },
    {
      id: "q-skylab-reentry",
      itemId: "skylab",
      itemName: "Skylab",
      zone: "earth-orbit",
      question: "Before disintegrating during atmospheric re-entry over the Indian Ocean and Australia in 1979, what was Skylab's legacy?",
      options: [
        "America's first crewed space station, proving humans can live long-term in orbit",
        "Humanity's first orbital solar observatory",
        "The first craft to assemble modular docking collars in LEO",
        "The first commercial microgravity factory in orbit",
      ],
      correctIndex: 0,
      explanation: "Skylab hosted three astronaut crews across 1973–1974, proving that humans could sustain productive long-duration scientific work in microgravity.",
    },
  ];
}

export default function MissionQuiz({ items }: { items: Item[] }) {
  const questions = useMemo(() => generateQuestions(items), [items]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [selectedOpt, setSelectedOpt] = useState<number | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [maxStreak, setMaxStreak] = useState(0);
  const [missedItems, setMissedItems] = useState<{ id: string; name: string }[]>([]);
  const [isFinished, setIsFinished] = useState(false);

  const currentQ = questions[currentIdx];
  const isCorrect = selectedOpt === currentQ?.correctIndex;

  function handleSelect(index: number) {
    if (confirmed) return;
    setSelectedOpt(index);
  }

  function handleConfirm() {
    if (selectedOpt === null || confirmed) return;
    setConfirmed(true);
    if (isCorrect) {
      const nextStreak = streak + 1;
      setScore((s) => s + 100 + streak * 25);
      setStreak(nextStreak);
      if (nextStreak > maxStreak) setMaxStreak(nextStreak);
    } else {
      setStreak(0);
      setMissedItems((prev) => {
        if (prev.some((m) => m.id === currentQ.itemId)) return prev;
        return [...prev, { id: currentQ.itemId, name: currentQ.itemName }];
      });
    }
  }

  function handleNext() {
    if (currentIdx + 1 < questions.length) {
      setCurrentIdx((c) => c + 1);
      setSelectedOpt(null);
      setConfirmed(false);
    } else {
      setIsFinished(true);
    }
  }

  function restart() {
    setCurrentIdx(0);
    setSelectedOpt(null);
    setConfirmed(false);
    setScore(0);
    setStreak(0);
    setMaxStreak(0);
    setMissedItems([]);
    setIsFinished(false);
  }

  return (
    <div className="quiz-terminal">
      <div className="quiz-hud-bar">
        <div className="hud-tag">
          <Radio size={14} className="hud-signal-icon" />
          <span>NASA RETRIEVAL SIMULATOR // CLEARANCE EVALUATION</span>
        </div>
        <div className="hud-metrics">
          <span className="hud-metric">
            SCORE: <strong>{score}</strong>
          </span>
          <span className={`hud-metric ${streak > 1 ? "streak-active" : ""}`}>
            <Flame size={13} /> STREAK: <strong>x{streak}</strong>
          </span>
          <span className="hud-metric">
            PHASE: <strong>{isFinished ? "COMPLETE" : `0${currentIdx + 1} / 0${questions.length}`}</strong>
          </span>
        </div>
      </div>

      {!isFinished ? (
        <div className="quiz-card targeting-frame">
          <div className="quiz-meta-row">
            <span className="quiz-zone-tag">[{currentQ.zone.toUpperCase()} ARCHIVE]</span>
            <span className="quiz-object-title">TARGET: {currentQ.itemName.toUpperCase()}</span>
          </div>

          <h2 className="quiz-prompt-text">{currentQ.question}</h2>

          <div className="quiz-options-grid">
            {currentQ.options.map((option, idx) => {
              const isChosen = selectedOpt === idx;
              let stateClass = "";
              if (confirmed) {
                if (idx === currentQ.correctIndex) stateClass = "option-correct";
                else if (isChosen) stateClass = "option-wrong";
              } else if (isChosen) {
                stateClass = "option-selected";
              }

              return (
                <button
                  key={idx}
                  className={`quiz-option-btn ${stateClass}`}
                  onClick={() => handleSelect(idx)}
                  disabled={confirmed}
                >
                  <span className="option-code">[0{idx + 1}]</span>
                  <span className="option-text">{option}</span>
                  {confirmed && idx === currentQ.correctIndex && (
                    <CheckCircle2 size={16} className="state-icon check" />
                  )}
                  {confirmed && isChosen && idx !== currentQ.correctIndex && (
                    <XCircle size={16} className="state-icon cross" />
                  )}
                </button>
              );
            })}
          </div>

          {confirmed && (
            <div className={`quiz-feedback-box ${isCorrect ? "feedback-positive" : "feedback-warning"}`}>
              <div className="feedback-head">
                <Sparkles size={15} />
                <span>{isCorrect ? "TELEMETRY CONFIRMED (+100 PTS)" : "TELEMETRY DISCREPANCY RECORDED"}</span>
              </div>
              <p className="feedback-text">{currentQ.explanation}</p>
            </div>
          )}

          <div className="quiz-actions-row">
            {!confirmed ? (
              <button
                className="btn-cyber-primary"
                onClick={handleConfirm}
                disabled={selectedOpt === null}
              >
                TRANSMIT VERIFICATION
              </button>
            ) : (
              <button className="btn-cyber-next" onClick={handleNext}>
                {currentIdx + 1 < questions.length ? "ADVANCE TO NEXT TELEMETRY" : "FINALIZE MISSION REPORT"}{" "}
                <ArrowRight size={16} />
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="quiz-report targeting-frame">
          <div className="report-header">
            <Award size={36} className="report-award-icon" />
            <div className="report-titles">
              <span className="eyebrow">MISSION FLIGHT EVALUATION // COMPLETE</span>
              <h1>DEBRIEF REPORT</h1>
            </div>
          </div>

          <div className="report-stats-grid">
            <div className="report-stat-card">
              <span className="stat-label">FINAL SCORE</span>
              <strong className="stat-num">{score}</strong>
            </div>
            <div className="report-stat-card">
              <span className="stat-label">MAX STREAK</span>
              <strong className="stat-num">{maxStreak}</strong>
            </div>
            <div className="report-stat-card">
              <span className="stat-label">CLEARANCE RATING</span>
              <strong className="stat-num stat-gold">
                {score >= 500 ? "FLIGHT DIRECTOR" : score >= 300 ? "PAYLOAD SPECIALIST" : "MISSION ANALYST"}
              </strong>
            </div>
          </div>

          {missedItems.length > 0 ? (
            <div className="missed-concepts-box">
              <div className="missed-title">
                <span>RE-ENGAGEMENT RECOMMENDED // MISSED MISSION OBJECTS:</span>
              </div>
              <div className="missed-chips-row">
                {missedItems.map((item) => (
                  <Link key={item.id} href={`/item/${item.id}`} className="missed-item-chip">
                    <span>{item.name}</span>
                    <ChevronRight size={13} />
                  </Link>
                ))}
              </div>
            </div>
          ) : (
            <div className="perfect-score-box">
              <Sparkles size={20} className="perfect-star" />
              <span>FLAWLESS RETRIEVAL // ALL TELEMETRY GROUNDED IN NASA HISTORICAL DATA</span>
            </div>
          )}

          <div className="report-action-buttons">
            <button className="btn-cyber-primary" onClick={restart}>
              <RotateCcw size={15} /> RE-RUN SIMULATION
            </button>
            <Link href="/archive" className="btn-cyber-outline">
              RETURN TO ARCHIVE
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
