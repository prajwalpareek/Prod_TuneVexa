import asyncio
import logging
import os
from contextlib import asynccontextmanager
from datetime import datetime, timedelta

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from scraper import scrape_top_200
from spotify_api import enrich_with_cover_art
from supabase_client import fetch_available_dates, fetch_songs, save_songs

load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

SCRAPE_INTERVAL_HOURS = float(os.getenv("SCRAPE_INTERVAL_HOURS", "6"))

ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5174",
    "https://tunevexa-dev.vercel.app",
    "https://dev.tunevexa.com",
]
_extra = os.getenv("EXTRA_ORIGINS", "")
if _extra:
    ALLOWED_ORIGINS += [o.strip() for o in _extra.split(",") if o.strip()]
logger.info(f"CORS allowed origins: {ALLOWED_ORIGINS}")


async def run_scrape_pipeline() -> int:
    logger.info("Starting scrape pipeline...")
    songs, chart_date = await scrape_top_200()
    logger.info(f"Scraped {len(songs)} songs (chart date: {chart_date})")
    songs_with_art = await enrich_with_cover_art(songs)
    logger.info("Cover art enrichment complete")
    await save_songs(songs_with_art, chart_date=chart_date)
    logger.info(f"Saved {len(songs_with_art)} songs to Supabase")
    return len(songs_with_art)


async def scheduled_scraper():
    while True:
        now = datetime.utcnow()
        next_run = now.replace(hour=2, minute=0, second=0, microsecond=0)
        if next_run <= now:
            next_run += timedelta(days=1)
        wait_seconds = (next_run - now).total_seconds()
        logger.info(f"Next scrape at {next_run.strftime('%Y-%m-%d 02:00 UTC')} (in {wait_seconds/3600:.1f}h)")
        await asyncio.sleep(wait_seconds)
        try:
            await run_scrape_pipeline()
        except Exception as e:
            logger.error(f"Scheduled scrape failed: {e}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    task = asyncio.create_task(scheduled_scraper())
    yield
    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        pass


app = FastAPI(title="TuneVexa API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/songs")
async def get_songs(date: str | None = Query(default=None)):
    try:
        songs = await fetch_songs(chart_date=date)
        return {"data": songs, "count": len(songs)}
    except Exception as e:
        logger.error(f"Failed to fetch songs: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch songs from database")


@app.get("/dates")
async def get_dates():
    try:
        dates = await fetch_available_dates()
        return {"dates": dates}
    except Exception as e:
        logger.error(f"Failed to fetch dates: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch available dates")


@app.post("/scrape")
async def trigger_scrape():
    try:
        count = await run_scrape_pipeline()
        return {"message": f"Successfully scraped and saved {count} songs", "count": count}
    except Exception as e:
        logger.error(f"Manual scrape failed: {e}")
        raise HTTPException(status_code=500, detail=f"Scrape failed: {str(e)}")


@app.get("/health")
async def health():
    return {"status": "ok"}
