import os
from datetime import datetime, timezone
import httpx
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY")
TABLE = "spotify_charts_dev"


def _headers() -> dict:
    return {
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": f"Bearer {SUPABASE_ANON_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=minimal",
    }


async def save_songs(songs: list[dict], chart_date=None) -> None:
    base_url = f"{SUPABASE_URL}/rest/v1/{TABLE}"
    now = datetime.now(timezone.utc).isoformat()
    chart_date_str = chart_date.isoformat() if chart_date else None

    rows = [
        {
            "rank": s["rank"],
            "track_name": s["track_name"],
            "artist_name": s["artist_name"],
            "streams": s["streams"],
            "daily_change": s["daily_change"],
            "cover_art_url": s.get("cover_art_url"),
            "fetched_at": now,
            "chart_date": chart_date_str,
        }
        for s in songs
    ]

    async with httpx.AsyncClient(timeout=30) as client:
        ins_response = await client.post(
            base_url,
            headers={
                **_headers(),
                "Prefer": "resolution=merge-duplicates,return=minimal",
            },
            params={"on_conflict": "chart_date,rank"},
            json=rows,
        )
        ins_response.raise_for_status()


async def fetch_songs(chart_date: str | None = None) -> list[dict]:
    params: dict = {
        "select": "rank,track_name,artist_name,streams,daily_change,cover_art_url,fetched_at,chart_date",
        "order": "rank.asc",
        "limit": "200",
    }
    if chart_date:
        params["chart_date"] = f"eq.{chart_date}"
    else:
        # Return the most recent available date
        latest = await fetch_latest_chart_date()
        if latest:
            params["chart_date"] = f"eq.{latest}"

    async with httpx.AsyncClient(timeout=15) as client:
        response = await client.get(
            f"{SUPABASE_URL}/rest/v1/{TABLE}",
            headers={
                "apikey": SUPABASE_ANON_KEY,
                "Authorization": f"Bearer {SUPABASE_ANON_KEY}",
            },
            params=params,
        )
        response.raise_for_status()
        return response.json()


async def fetch_available_dates() -> list[str]:
    """Return all distinct chart_dates in descending order."""
    async with httpx.AsyncClient(timeout=15) as client:
        response = await client.get(
            f"{SUPABASE_URL}/rest/v1/{TABLE}",
            headers={
                "apikey": SUPABASE_ANON_KEY,
                "Authorization": f"Bearer {SUPABASE_ANON_KEY}",
            },
            params={
                "select": "chart_date",
                "order": "chart_date.desc",
            },
        )
        response.raise_for_status()
        rows = response.json()
    seen = []
    for row in rows:
        d = row.get("chart_date")
        if d and d not in seen:
            seen.append(d)
    return seen


async def fetch_latest_chart_date() -> str | None:
    dates = await fetch_available_dates()
    return dates[0] if dates else None
