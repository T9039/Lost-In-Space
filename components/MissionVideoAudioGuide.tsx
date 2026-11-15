"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Pause, Play, Volume2 } from "lucide-react";
import { displayText } from "@/lib/displayText";
import type { Item } from "@/lib/types";
import type { ActId, MissionAct } from "./MissionStoryActs";

interface NASAArchiveClip {
  videoId: string;
  title: string;
}

// Add only verified NASA archive video IDs, keyed by the canonical item ID.
const NASA_ARCHIVE_CLIPS: Record<string, NASAArchiveClip> = {};

interface NarrationCue {
  actId: ActId;
  text: string;
}

export default function MissionVideoAudioGuide({
  item,
  acts,
  onActChange,
}: {
  item: Item;
  acts: MissionAct[];
  onActChange: (actId: ActId) => void;
}) {
  const [selectedTab, setSelectedTab] = useState<"reel" | "clip">("reel");
  const [photoIndex, setPhotoIndex] = useState(0);
  const [isNarrating, setIsNarrating] = useState(false);
  const [cueIndex, setCueIndex] = useState(0);
  const [subtitle, setSubtitle] = useState("");
  const clip = NASA_ARCHIVE_CLIPS[item.id];
  const images = item.images;

  const cues = useMemo<NarrationCue[]>(
    () => acts.flatMap((act) => act.lines.map((line) => ({ actId: act.id, text: displayText(line.text) }))),
    [acts]
  );

  useEffect(() => {
    setPhotoIndex(0);
    setSelectedTab("reel");
    setIsNarrating(false);
    setCueIndex(0);
    setSubtitle("");
  }, [item.id]);

  useEffect(() => {
    if (!isNarrating || !images.length) return;
    const timer = window.setInterval(() => {
      setPhotoIndex((index) => (index + 1) % images.length);
    }, 4800);
    return () => window.clearInterval(timer);
  }, [images.length, isNarrating]);

  useEffect(() => {
    if (!isNarrating) return;
    if (cueIndex >= cues.length) {
      setIsNarrating(false);
      setSubtitle("Narration complete.");
      return;
    }

    if (!("speechSynthesis" in window)) {
      setIsNarrating(false);
      setSubtitle("Speech narration is not available in this browser.");
      return;
    }

    const cue = cues[cueIndex];
    const utterance = new SpeechSynthesisUtterance(cue.text);
    utterance.rate = 0.94;
    utterance.pitch = 1;
    utterance.onstart = () => {
      setSubtitle(cue.text);
      onActChange(cue.actId);
    };
    utterance.onboundary = (event) => {
      const wordStart = event.charIndex;
      const nextSpace = cue.text.indexOf(" ", wordStart);
      const nextEnd = nextSpace === -1 ? cue.text.length : nextSpace;
      const sentenceEnd = cue.text.indexOf(".", nextEnd);
      const end = sentenceEnd === -1 ? cue.text.length : sentenceEnd + 1;
      setSubtitle(cue.text.slice(Math.max(0, wordStart - 32), end));
    };
    utterance.onend = () => setCueIndex((index) => index + 1);
    utterance.onerror = () => setIsNarrating(false);
    window.speechSynthesis.speak(utterance);

    return () => window.speechSynthesis.cancel();
  }, [cueIndex, cues, isNarrating, onActChange]);

  const toggleNarration = () => {
    if (isNarrating) {
      window.speechSynthesis?.cancel();
      setIsNarrating(false);
      return;
    }
    setSelectedTab("reel");
    if (cueIndex >= cues.length) setCueIndex(0);
    setSubtitle("Preparing narrated reel…");
    setIsNarrating(true);
  };

  const selectActToNarrate = (actId: ActId) => {
    const index = cues.findIndex((cue) => cue.actId === actId);
    if (index < 0) return;
    window.speechSynthesis?.cancel();
    onActChange(actId);
    setCueIndex(index);
    setSubtitle("");
    setSelectedTab("reel");
    setIsNarrating(true);
  };

  const activeImage = images[photoIndex];

  return (
    <section className="mission-guide-card" aria-label="Mission video and audio guide">
      <header className="mission-guide-heading">
        <div className="eyebrow">MISSION VIDEO &amp; AUDIO GUIDE</div>
        <p>NASA archive imagery with an optional browser-narrated tour.</p>
      </header>

      <div className="mission-guide-tabs" role="tablist" aria-label="Mission media">
        <button
          type="button"
          role="tab"
          aria-selected={selectedTab === "reel"}
          className={selectedTab === "reel" ? "is-active" : ""}
          onClick={() => setSelectedTab("reel")}
        >
          Narrated NASA Reel
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={selectedTab === "clip"}
          aria-disabled={!clip}
          className={`${selectedTab === "clip" ? "is-active" : ""}${clip ? "" : " is-unmapped"}`}
          title={clip ? clip.title : "No NASA archive clip is mapped for this exhibit; the narrated reel is selected by default."}
          onClick={() => {
            if (clip) setSelectedTab("clip");
          }}
        >
          NASA Archive Clip{clip ? "" : " · UNMAPPED"}
        </button>
      </div>

      {selectedTab === "clip" && clip ? (
        <div className="mission-guide-clip">
          <div className="mission-guide-media-title">{displayText(clip.title)}</div>
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${encodeURIComponent(clip.videoId)}`}
            title={displayText(clip.title)}
            loading="lazy"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
          />
        </div>
      ) : (
        <div className="mission-guide-reel" role="tabpanel" aria-label="Narrated NASA Reel">
          <div className="mission-reel-stage">
            {activeImage ? (
              <img
                key={`${item.id}-${photoIndex}`}
                src={activeImage.src}
                alt={displayText(activeImage.caption)}
                className="mission-reel-image"
              />
            ) : (
              <div className="mission-reel-empty">NO NASA ARCHIVE PHOTOS AVAILABLE</div>
            )}
            <div className="mission-reel-overlay">
              <span>{displayText(item.short_name)} / NASA ARCHIVE</span>
              {activeImage ? <small>{displayText(activeImage.caption)}</small> : null}
            </div>
          </div>

          <div className="mission-reel-subtitle" aria-live="polite">
            {subtitle || "Start the reel to hear this mission told in three acts."}
          </div>

          <div className="mission-reel-controls">
            <button
              type="button"
              className="mission-reel-play"
              onClick={toggleNarration}
              disabled={!cues.length}
              aria-label={isNarrating ? "Pause narration" : "Play narration"}
            >
              {isNarrating ? <Pause size={15} /> : <Play size={15} />}
              {isNarrating ? "Pause narration" : "Play narrated reel"}
            </button>
            <div className="mission-reel-photo-controls" aria-label="Reel photos">
              <button
                type="button"
                aria-label="Previous archive photo"
                disabled={images.length < 2}
                onClick={() => setPhotoIndex((index) => (index - 1 + images.length) % images.length)}
              >
                <ChevronLeft size={15} />
              </button>
              <span>{images.length ? `${photoIndex + 1} / ${images.length}` : "0 / 0"}</span>
              <button
                type="button"
                aria-label="Next archive photo"
                disabled={images.length < 2}
                onClick={() => setPhotoIndex((index) => (index + 1) % images.length)}
              >
                <ChevronRight size={15} />
              </button>
            </div>
          </div>

          <div className="mission-reel-acts" aria-label="Narrate from an act">
            <Volume2 size={13} aria-hidden="true" />
            {acts.map((act) => (
              <button key={act.id} type="button" onClick={() => selectActToNarrate(act.id)}>
                Act {act.id}
              </button>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
