"use client";

import type { CSSProperties } from "react";
import { checkTeam, days, roleOf, roles, sampleTeam, shifts, type Person, type Role, type Team } from "./round";

const storageKey = "shift-happens-team";

/** Reads the saved team from this device, falling back to the sample team. */
export function loadTeam(): Team {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) ?? "null") as Team | null;
    const validRole = (role: unknown) => roles.some(entry => entry.id === role);
    if (saved && Array.isArray(saved.people) && Array.isArray(saved.week) && saved.week.length === shifts.length
      && saved.week.every(role => role === null || validRole(role))
      && saved.people.every(person => typeof person.name === "string" && validRole(person.role)
        && Array.isArray(person.days) && person.days.length === 7 && Number.isInteger(person.shifts))) {
      return saved;
    }
  } catch {
    // Storage can be missing or hold something unreadable; use the sample team instead.
  }
  return copyTeam(sampleTeam);
}

export function saveTeam(team: Team) {
  try {
    localStorage.setItem(storageKey, JSON.stringify(team));
  } catch {
    // The team still works for this visit if it can't be saved.
  }
}

export const copyTeam = (team: Team): Team => ({
  people: team.people.map(person => ({ ...person, days: [...person.days] })),
  week: [...team.week],
});

type Props = {
  team: Team;
  onChange: (team: Team) => void;
  onPlay: () => void;
  onBack: () => void;
};

/** "Run it for real": enter the team and the shifts the week needs, then play that week. */
export function TeamSetup({ team, onChange, onPlay, onBack }: Props) {
  const { gaps, needed, hours } = checkTeam(team);
  const named = team.people.filter(person => person.name.trim());

  function updatePerson(index: number, change: Partial<Person>) {
    onChange({ ...team, people: team.people.map((person, i) => (i === index ? { ...person, ...change } : person)) });
  }

  function toggleDay(index: number, day: number) {
    updatePerson(index, { days: team.people[index].days.map((on, i) => (i === day ? !on : on)) });
  }

  function addPerson() {
    onChange({ ...team, people: [...team.people, { name: "", role: "barista", days: days.map(() => true), shifts: 2 }] });
  }

  function removePerson(index: number) {
    onChange({ ...team, people: team.people.filter((_, i) => i !== index) });
  }

  function setShift(slot: number, role: Role | null) {
    onChange({ ...team, week: team.week.map((current, i) => (i === slot ? role : current)) });
  }

  return (
    <div className="shifts-setup">
      <h2>Run it for real</h2>
      <p>Enter your team and the shifts this week needs. You’ll play your real week, then copy the roster at the end.</p>

      <h3>Your team</h3>
      <div className="shifts-people">
        {team.people.map((person, index) => (
          <div className="shifts-person-row" key={index} style={{ "--role": roleOf(person.role).colour } as CSSProperties}>
            <input aria-label="Name" placeholder="Name" value={person.name} maxLength={12}
              onChange={event => updatePerson(index, { name: event.target.value })} />
            <select aria-label={`${person.name || "Person"}’s role`} value={person.role}
              onChange={event => updatePerson(index, { role: event.target.value as Role })}>
              {roles.map(role => <option key={role.id} value={role.id}>{role.label}</option>)}
            </select>
            <span className="shifts-days" role="group" aria-label={`Days ${person.name || "this person"} can work`}>
              {days.map((day, i) => (
                <button key={day} type="button" aria-pressed={person.days[i]} aria-label={day}
                  onClick={() => toggleDay(index, i)}>{day[0]}</button>
              ))}
            </span>
            <label className="shifts-hours">
              <input type="number" min={1} max={5} value={person.shifts}
                onChange={event => updatePerson(index, { shifts: Math.max(1, Math.min(5, Number(event.target.value) || 1)) })} />
              <span>shifts</span>
            </label>
            <button type="button" className="shifts-remove" onClick={() => removePerson(index)}
              aria-label={`Remove ${person.name || "this person"}`}>×</button>
          </div>
        ))}
      </div>
      <button type="button" className="shifts-add" onClick={addPerson}>Add person</button>

      <h3>Shifts this week</h3>
      <div className="shifts-week">
        <span />
        {days.map(day => <b key={day}>{day}</b>)}
        {(["AM", "PM"] as const).map((half, row) => (
          <div className="shifts-week-row" key={half}>
            <b>{half}</b>
            {days.map((day, i) => {
              const slot = i + row * 7;
              const role = team.week[slot];
              return (
                <select key={day} aria-label={`${shifts[slot].label}`} value={role ?? ""}
                  style={{ "--role": role ? roleOf(role).colour : "#bdb4d1" } as CSSProperties}
                  onChange={event => setShift(slot, (event.target.value || null) as Role | null)}>
                  {roles.map(entry => <option key={entry.id} value={entry.id}>{entry.label}</option>)}
                  <option value="">Closed</option>
                </select>
              );
            })}
          </div>
        ))}
      </div>

      <ul className="shifts-checks" aria-live="polite">
        {gaps.map(slot => (
          <li key={slot}>Nobody can work {shifts[slot].label} ({roleOf(team.week[slot]!).label.toLowerCase()}).</li>
        ))}
        {hours < needed && <li>Your team has {hours} shifts between them for {needed} shifts.</li>}
        {!gaps.length && hours >= needed && needed > 0 && <li className="shifts-ok">Every shift has someone who can work it.</li>}
      </ul>

      <div className="shifts-end-actions">
        <button type="button" className="shifts-copy" onClick={() => onChange(copyTeam(sampleTeam))}>Use sample team</button>
        <button type="button" className="shifts-copy" onClick={onBack}>Back</button>
        <button type="button" disabled={!needed || !named.length} onClick={onPlay}>Play this week</button>
      </div>
    </div>
  );
}
