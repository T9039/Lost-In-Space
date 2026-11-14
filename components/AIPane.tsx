"use client";

import { useRef, useState } from "react";
import { answerQuestion, PROMPT_CHIPS, type AIAnswer, type ReadingLevel } from "@/lib/missionAI";
import type { Item, Source } from "@/lib/types";

interface Turn {
  id: number;
  role: "user" | "ai";
  text: string;
  answer?: AIAnswer;
}

export default function AIPane({ item, sources }: { item: Item; sources: Source[] }) {
  const [level, setLevel] = useState<ReadingLevel>("high");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const counter = useRef(0);
  const storyPhases = [...item.phases].sort((a, b) => a.order - b.order);
  const sourceById = new Map(sources.map((source) => [source.id, source]));
  const storyFacts = item.facts.filter((fact) => fact.kind === "mission" || fact.kind === "discovery").slice(0, 2);

  const ask = (raw: string) => {
    const question = raw.trim();
    if (!question) return;
    const answer = answerQuestion(item, sources, question, level);
    counter.current += 1;
    setTurns((prev) => [
      ...prev,
      { id: counter.current, role: "user", text: question },
      { id: (counter.current += 1), role: "ai", text: answer.answer, answer },
    ]);
    setInput("");
  };

  return (
    <div className="ai-pane">
      <section className="mission-narrative-card">
        <div className="story-label">{item.type === "rover" ? "A BOT'S JOURNEY" : "A MISSION'S JOURNEY"} <span>/</span> THE STORY OF {item.short_name.toUpperCase()}</div>
        <div className="mission-story-copy">
          {storyPhases.map((phase, index) => (
            <p key={phase.id} className={phase.key === "abandoned" ? "story-silent-beat" : ""}>
              <span>{String(index + 1).padStart(2, "0")}</span>{phase.body}
            </p>
          ))}
        </div>
        {storyFacts.length ? (
          <div className="story-fact-notes">
            {storyFacts.map((fact) => {
              const source = sourceById.get(fact.source_id);
              return (
                <div key={fact.id} className="story-fact-note">
                  <b>{fact.value}</b><span>{fact.claim}</span>
                  {source ? <a href={source.url} target="_blank" rel="noreferrer">{source.publisher} ↗</a> : null}
                </div>
              );
            })}
          </div>
        ) : null}
      </section>

      <div className="pane-head">
        <div>
          <div className="eyebrow" style={{ marginBottom: 2 }}>
            Mission AI
          </div>
          <h3>{item.short_name} archive assistant</h3>
        </div>
        <div className="level-toggle" role="group" aria-label="Reading level">
          <button
            className={`level-btn ${level === "primary" ? "is-active" : ""}`}
            onClick={() => setLevel("primary")}
          >
            Primary
          </button>
          <button
            className={`level-btn ${level === "high" ? "is-active" : ""}`}
            onClick={() => setLevel("high")}
          >
            High school
          </button>
        </div>
      </div>

      <p className="ai-scope">
        Scoped to {item.facts.length} facts, {item.phases.length} phases and{" "}
        {new Set(item.facts.map((f) => f.source_id)).size} NASA sources. It cannot answer outside
        this record.
      </p>

      <div className="ai-thread">
        <div className="ai-msg ai-msg-bot">
          <p>
            I am the mission AI for <strong>{item.short_name}</strong>. I only use the stored NASA
            record — ask me why it was left behind, or make me quiz you.
          </p>
        </div>

        {turns.map((turn) =>
          turn.role === "user" ? (
            <div key={turn.id} className="ai-msg ai-msg-user">
              <p>{turn.text}</p>
            </div>
          ) : (
            <div key={turn.id} className="ai-msg ai-msg-bot">
              <p>{turn.text}</p>
              {turn.answer?.bullets.length ? (
                <ul>
                  {turn.answer.bullets.map((b, i) => (
                    <li key={i}>{b}</li>
                  ))}
                </ul>
              ) : null}
              {turn.answer?.quiz?.length ? (
                <div className="ai-quiz">
                  {turn.answer.quiz.map((q, i) => (
                    <details key={i}>
                      <summary>{q.question}</summary>
                      <p>{q.answer}</p>
                    </details>
                  ))}
                </div>
              ) : null}
              {turn.answer?.citations.length ? (
                <div className="ai-cites">
                  {turn.answer.citations.map((c) => (
                    <a key={c.id} href={c.url} target="_blank" rel="noreferrer" className="ai-cite">
                      {c.publisher} ↗
                    </a>
                  ))}
                </div>
              ) : null}
            </div>
          )
        )}
      </div>

      <div className="ai-chips">
        {PROMPT_CHIPS.map((chip) => (
          <button key={chip} className="chip chip-btn" onClick={() => ask(chip)}>
            {chip}
          </button>
        ))}
      </div>

      <form
        className="ai-input"
        onSubmit={(e) => {
          e.preventDefault();
          ask(input);
        }}
      >
        <input
          className="input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={`Ask about ${item.short_name}…`}
        />
        <button className="btn btn-primary btn-sm" type="submit">
          Ask
        </button>
      </form>
    </div>
  );
}
