"use client";

import { useEffect, useRef, useState } from "react";
import { answerQuestion, PROMPT_CHIPS, type AIAnswer } from "@/lib/missionAI";
import { displayText } from "@/lib/displayText";
import type { Item, Source } from "@/lib/types";

interface Turn {
  id: number;
  role: "user" | "ai";
  text: string;
  answer?: AIAnswer;
}

export default function AIPane({
  item,
  sources,
  suggestedQuestion,
  onSuggestedQuestionApplied,
}: {
  item: Item;
  sources: Source[];
  suggestedQuestion?: string;
  onSuggestedQuestionApplied?: () => void;
}) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const counter = useRef(0);

  useEffect(() => {
    if (!suggestedQuestion) return;
    setInput(displayText(suggestedQuestion));
    onSuggestedQuestionApplied?.();
  }, [suggestedQuestion, onSuggestedQuestionApplied]);

  const ask = (raw: string) => {
    const question = raw.trim();
    if (!question) return;
    const answer = answerQuestion(item, sources, question);
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
      <div className="pane-head">
        <div>
          <div className="eyebrow" style={{ marginBottom: 2 }}>
            Mission AI
          </div>
          <h3>{displayText(item.short_name)} archive assistant</h3>
        </div>
      </div>

      <p className="ai-scope">
        Ask about how it was built, what rocket launched it, what it discovered, or why it went
        silent. Every answer is pulled strictly from verified NASA records.
      </p>
      <p className="ai-record-scope">Scoped to {item.facts.length} facts, {item.phases.length} mission phases, and {new Set(item.facts.map((fact) => fact.source_id)).size} sources.</p>

      <div className="ai-thread">
        <div className="ai-msg ai-msg-bot">
          <p>
            I am the mission AI for <strong>{displayText(item.short_name)}</strong>. I use its saved facts and
            mission phases only. Ask about its design, discoveries, or where the record places it today.
          </p>
        </div>

        {turns.map((turn) =>
          turn.role === "user" ? (
            <div key={turn.id} className="ai-msg ai-msg-user">
              <p>{displayText(turn.text)}</p>
            </div>
          ) : (
            <div key={turn.id} className="ai-msg ai-msg-bot">
              <p>{displayText(turn.text)}</p>
              {turn.answer?.bullets.length ? (
                <ul>
                  {turn.answer.bullets.map((b, i) => (
                    <li key={i}>{displayText(b)}</li>
                  ))}
                </ul>
              ) : null}
              {turn.answer?.quiz?.length ? (
                <div className="ai-quiz">
                  {turn.answer.quiz.map((q, i) => (
                    <details key={i}>
                      <summary>{displayText(q.question)}</summary>
                      <p>{displayText(q.answer)}</p>
                    </details>
                  ))}
                </div>
              ) : null}
              {turn.answer?.citations.length ? (
                <div className="ai-cites">
                  {turn.answer.citations.map((c) => (
                    <a key={c.id} href={c.url} target="_blank" rel="noreferrer" className="ai-cite">
                      {displayText(c.publisher)} ↗
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
          placeholder={`Ask about ${displayText(item.short_name)}…`}
        />
        <button className="btn btn-primary btn-sm" type="submit">
          Ask
        </button>
      </form>
    </div>
  );
}
