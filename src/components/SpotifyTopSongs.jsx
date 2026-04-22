import React, { useEffect, useRef, useState } from "react";
import "./SpotifyTopSongs.css";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";
const PLACEHOLDER_IMG =
  "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400&q=80";

function formatNumber(value) {
  if (value === null || value === undefined) return "—";
  const abs = Math.abs(value).toLocaleString();
  if (value > 0) return `+${abs}`;
  if (value < 0) return `-${abs}`;
  return abs;
}

function formatStreams(value) {
  if (!value) return "—";
  return Number(value).toLocaleString();
}

function formatCompact(value) {
  if (value === null || value === undefined) return "—";
  const abs = Math.abs(value);
  let str;
  if (abs >= 1_000_000) str = (abs / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  else if (abs >= 1_000) str = (abs / 1_000).toFixed(0) + "K";
  else str = String(abs);
  if (value > 0) return `+${str}`;
  if (value < 0) return `-${str}`;
  return str;
}

function formatStreamsCompact(value) {
  if (!value) return "—";
  const n = Number(value);
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(0) + "K";
  return String(n);
}

function DailyBadge({ value }) {
  if (value === null || value === undefined || value === 0)
    return <span className="daily-neutral">—</span>;
  const className = value > 0 ? "daily-positive" : "daily-negative";
  return (
    <>
      <span className={`${className} full-num`}>{formatNumber(value)}</span>
      <span className={`${className} compact-num`}>{formatCompact(value)}</span>
    </>
  );
}

export default function SpotifyTopSongs() {
  const [songs, setSongs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [search, setSearch] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const [availableDates, setAvailableDates] = useState([]);
  const [selectedDate, setSelectedDate] = useState(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const fetchDates = async () => {
      try {
        const res = await fetch(`${API_URL}/dates`);
        if (!res.ok) return;
        const json = await res.json();
        const dates = json.dates || [];
        setAvailableDates(dates);
        if (dates.length > 0) setSelectedDate(dates[0]);
      } catch (_) {
        // non-fatal — dates dropdown just won't populate
      }
    };
    fetchDates();
  }, []);

  useEffect(() => {
    const fetchSongs = async () => {
      try {
        setLoading(true);
        setError(null);
        const url = selectedDate
          ? `${API_URL}/songs?date=${selectedDate}`
          : `${API_URL}/songs`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Server error: ${res.status}`);
        const json = await res.json();
        setSongs(json.data || []);
        if (json.data?.length > 0 && json.data[0].chart_date) {
          setLastUpdated(new Date(json.data[0].chart_date + "T12:00:00Z"));
        } else if (json.data?.length > 0 && json.data[0].fetched_at) {
          setLastUpdated(new Date(json.data[0].fetched_at));
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchSongs();
  }, [selectedDate]);

  return (
    <div className="spotify-wrapper">
      <header className="spotify-header">
        <div className="spotify-logo">
          <svg width="36" height="36" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M20 2L35 11V29L20 38L5 29V11L20 2Z" fill="url(#logo-gradient)" />
            <path d="M13 13L20 26L27 13" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="16" cy="18" r="1.5" fill="white" opacity="0.8" />
            <circle cx="20" cy="15" r="1.8" fill="white" />
            <circle cx="24" cy="18" r="1.5" fill="white" opacity="0.8" />
            <path d="M11 28C15 24 25 24 29 28" stroke="white" strokeWidth="2" strokeLinecap="round" opacity="0.6" />
            <defs>
              <linearGradient id="logo-gradient" x1="5" y1="2" x2="35" y2="38" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#1db954" />
                <stop offset="50%" stopColor="#1ed760" />
                <stop offset="100%" stopColor="#17a848" />
              </linearGradient>
            </defs>
          </svg>
          <span className="spotify-brand">TuneVexa</span>
        </div>
        <div className="hamburger-menu" ref={menuRef}>
          <button
            className="hamburger-btn"
            onClick={() => setMenuOpen((o) => !o)}
            aria-label="Menu"
          >
            <span />
            <span />
            <span />
          </button>
          {menuOpen && (
            <div className="hamburger-dropdown">
              <div className="hamburger-item disabled">3 Billion Club</div>
              <div className="hamburger-item disabled">2 Billion Club</div>
            </div>
          )}
        </div>
      </header>

      <main className="spotify-main">
        <div className="spotify-section-header">
          <div className="spotify-section-top">
            <div className="spotify-section-text">
              <h2 className="spotify-section-title">
                Most Streamed Songs
                <span className="section-title-date">
                  {" On "}
                  {availableDates.length > 1 ? (
                    <select
                      className="title-date-picker"
                      value={selectedDate || ""}
                      onChange={(e) => setSelectedDate(e.target.value)}
                    >
                      {availableDates.map((d) => (
                        <option key={d} value={d}>
                          {new Date(d + "T12:00:00Z").toLocaleDateString("en-US", {
                            month: "long",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </option>
                      ))}
                    </select>
                  ) : (
                    lastUpdated && lastUpdated.toLocaleDateString("en-US", {
                      month: "long",
                      day: "numeric",
                      year: "numeric",
                    })
                  )}
                </span>
              </h2>
              <p className="spotify-section-subtitle">Live Spotify Global Chart · Updated daily</p>
            </div>
            <div className="spotify-section-controls">
              <div className="spotify-search-wrapper">
                <svg className="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <circle cx="11" cy="11" r="8" stroke="#a7a7a7" strokeWidth="2"/>
                  <path d="M21 21l-4.35-4.35" stroke="#a7a7a7" strokeWidth="2" strokeLinecap="round"/>
                </svg>
                <input
                  className="spotify-search"
                  type="text"
                  placeholder="Search songs or artists…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>
          </div>
        </div>

        {loading && (
          <div className="spotify-loading">
            <div className="spinner" />
            <p>Loading charts...</p>
          </div>
        )}

        {error && (
          <div className="spotify-error">
            <p>Failed to load data: {error}</p>
            <p className="error-hint">
              Make sure the backend is running: <code>cd backend && uvicorn main:app --reload</code>
            </p>
          </div>
        )}

        {!loading && !error && songs.length > 0 && (
          <div className="spotify-table-wrapper">
            <table className="spotify-table">
              <thead>
                <tr>
                  <th className="col-rank">#</th>
                  <th className="col-title">Title</th>
                  <th className="col-streams">Daily Streams</th>
                  <th className="col-daily">Daily Change</th>
                </tr>
              </thead>
              <tbody>
                {songs
                  .filter(
                    (song) =>
                      song.track_name.toLowerCase().includes(search.toLowerCase()) ||
                      song.artist_name.toLowerCase().includes(search.toLowerCase())
                  )
                  .map((song) => (
                  <tr key={song.rank} className="spotify-row">
                    <td className="col-rank">{song.rank}</td>
                    <td className="col-title">
                      <div className="song-info">
                        <img
                          src={song.cover_art_url || PLACEHOLDER_IMG}
                          alt={song.track_name}
                          className="song-img"
                          onError={(e) => { e.target.src = PLACEHOLDER_IMG; }}
                        />
                        <div className="song-text">
                          <span className="song-name">{song.track_name}</span>
                          <span className="song-artist">{song.artist_name}</span>
                        </div>
                      </div>
                    </td>
                    <td className="col-streams">
                      <span className="full-num">{formatStreams(song.streams)}</span>
                      <span className="compact-num">{formatStreamsCompact(song.streams)}</span>
                    </td>
                    <td className="col-daily">
                      <DailyBadge value={song.daily_change} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!loading && !error && songs.length === 0 && (
          <div className="spotify-empty">
            <p>No songs yet. Trigger a scrape to load data.</p>
            <code>POST http://localhost:8000/scrape</code>
          </div>
        )}
      </main>
    </div>
  );
}
