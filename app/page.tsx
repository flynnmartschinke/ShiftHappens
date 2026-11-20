"use client";

import { useEffect, useRef, useState } from "react";
import CafeGame from "./cafe-game";
import { atStation, validStage, type ShiftAction, type Stage } from "./coverage";

type View = "staff" | "manager";

async function stageFrom(response: Response) {
  if (!response.ok) throw new Error("Roster request failed.");
  const result = await response.json() as { stage?: number };
  if (!validStage(result.stage)) {
    throw new Error("Roster returned an invalid state.");
  }
  return result.stage;
}

export default function Demo() {
  const [room, setRoom] = useState("");
  const [view, setView] = useState<View>("manager");
  const [stage, setStage] = useState<Stage | null>(null);
  const [busy, setBusy] = useState(false);
  const pending = useRef(new Set<ShiftAction>());
  const grillCovered = Boolean(atStation(stage, "Grill"));
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const url = new URL(location.href);
    let code = url.searchParams.get("room") ?? "";
    if (!/^[a-f0-9]{32}$/.test(code)) {
      code = crypto.randomUUID().replaceAll("-", "");
      url.searchParams.set("room", code);
      history.replaceState(null, "", url.href);
    }
    setRoom(code);
    setView(url.searchParams.get("view") === "staff" ? "staff" : "manager");
  }, []);

  useEffect(() => {
    if (!room) return;
    const aborter = new AbortController();

    async function refresh() {
      try {
        const response = await fetch(`/api/shift?room=${room}`, { signal: aborter.signal });
        const next = await stageFrom(response);
        setStage(current => current !== null && current > next ? current : next);
        setError("");
      } catch {
        if (!aborter.signal.aborted) setError("Couldn’t reach the roster. Retrying…");
      }
    }
    void refresh();
    const timer = setInterval(refresh, 2200);
    return () => { aborter.abort(); clearInterval(timer); };
  }, [room]);

  const viewLink = (role: View) => room ? `/?room=${room}&view=${role}` : "#";

  async function update(action: ShiftAction) {
    if (!room || pending.current.has(action)) return;
    pending.current.add(action);
    setBusy(true);
    setFeedback("");
    setError("");
    try {
      const response = await fetch("/api/shift", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ room, action }),
      });
      const next = await stageFrom(response);
      setStage(current => current !== null && current > next ? current : next);
    } catch {
      setError("Couldn’t update the roster. Try again.");
    } finally {
      pending.current.delete(action);
      setBusy(pending.current.size > 0);
    }
  }

  async function copyStaffLink() {
    try {
      await navigator.clipboard.writeText(new URL(viewLink("staff"), location.origin).href);
      setFeedback("Staff link copied.");
    } catch {
      setFeedback("Open Staff and copy the address from your browser.");
    }
  }

  return (
    <main className={view === "manager" ? "play-shell" : undefined}>
      <header className="top">
        <a className="brand" href={viewLink("manager")}><span aria-hidden="true">O</span> OverRostered</a>
        <span className="sample">Juniper Café</span>
      </header>
      <nav aria-label="Demo roles">
        <a href={viewLink("manager")} aria-current={view === "manager" ? "page" : undefined}>Play</a>
        <a href={viewLink("staff")} aria-current={view === "staff" ? "page" : undefined}>Staff view</a>
      </nav>

      {view === "staff" ? <>
        <h1>My shift</h1>
        <section className="card" aria-label="Mia’s scheduled shift">
          <div className="card-top">
            <div><p className="label">Mia · Juniper Café</p><h2>Friday close</h2><p>6:00–10:00 pm</p></div>
            <span className={grillCovered ? "status good" : "status"}>{grillCovered ? "Cover found" : stage ? "Reported" : "Scheduled"}</span>
          </div>
          {stage === 0 ? <button disabled={busy} onClick={() => update("report")}>I can’t work this shift</button> :
            grillCovered ? <p className="result">Jo is covering your shift.</p> :
            stage !== null ? <p className="result">Absence reported. Your manager can see it.</p> : <p className="result">Loading shift…</p>}
        </section>
        <a className="muted-link" href={viewLink("manager")}>Back to the round</a>
      </> : <>
        <CafeGame stage={stage} busy={busy} send={update} />
        <button className="link-button" disabled={!room} onClick={copyStaffLink}>Copy staff link</button>
      </>}

      <p className="feedback" role="status">{feedback || error}</p>
      <footer>Fictional staff · Scripted staff replies <a href="/">New round</a></footer>
    </main>
  );
}
