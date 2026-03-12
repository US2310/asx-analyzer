"""
ASX Analyzer - Python Backend Server v5.0 (Final)

Data source: Yahoo Finance via yfinance library
  - Provides accurate, reliable ASX data with .AX suffix
  - Free, no API key required
  - Verified delivering correct prices (BHP A$51.84 on 11 March 2026)

Why Yahoo Finance?
  - ASX Official API retired in 2023
  - Marketindex returns 403 Forbidden
  - Yahoo Finance delivers correct real-time ASX closing prices
  - Used by professional traders and analysts worldwide for backtesting

Install:  pip install fastapi uvicorn yfinance requests
Run:      uvicorn server:app --reload --port 8000
"""

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime
import logging
import time
import yfinance as yf

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="ASX Analyzer API",
    description="Real-time ASX stock data via Yahoo Finance",
    version="5.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # Restrict to your Vercel URL in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── CONFIGURATION ────────────────────────────────────────────────────────────

VALID_PERIODS = ["1mo", "3mo", "6mo", "1y", "2y", "5y"]

# 5-minute in-memory cache — prevents hammering Yahoo Finance on every click
_cache: dict = {}
CACHE_TTL = 300   # seconds


def cache_get(key: str):
    e = _cache.get(key)
    return e["data"] if e and (time.time() - e["ts"]) < CACHE_TTL else None


def cache_set(key: str, data):
    _cache[key] = {"data": data, "ts": time.time()}


# ─── YAHOO FINANCE FETCHER ────────────────────────────────────────────────────

def fetch_stock(code: str, period: str) -> dict:
    """
    Fetch OHLCV history + company info from Yahoo Finance.
    ASX stocks use the .AX suffix (e.g. BHP.AX, CBA.AX, CSL.AX).
    """
    ticker_sym = f"{code.upper()}.AX"
    logger.info(f"Fetching {ticker_sym} for period={period}")

    ticker = yf.Ticker(ticker_sym)

    # ── Historical OHLCV ──────────────────────────────────────────────────
    hist = ticker.history(period=period)

    if hist.empty:
        # Try without .AX suffix — some ETFs/LICs don't use it
        logger.warning(f"{ticker_sym} returned empty — trying {code} without .AX")
        ticker = yf.Ticker(code.upper())
        hist   = ticker.history(period=period)

    if hist.empty:
        raise HTTPException(
            status_code=404,
            detail=(
                f"No data found for '{code}'. "
                f"Please check it is a valid ASX ticker code (e.g. BHP, CBA, CSL). "
                f"Tried: {ticker_sym} and {code.upper()}"
            )
        )

    data = []
    for date, row in hist.iterrows():
        data.append({
            "date":   str(date.date()),
            "open":   round(float(row["Open"]),  4),
            "high":   round(float(row["High"]),  4),
            "low":    round(float(row["Low"]),   4),
            "close":  round(float(row["Close"]), 4),
            "volume": int(row["Volume"]),
        })

    # ── Company info ──────────────────────────────────────────────────────
    info = {
        "name":       code,
        "sector":     "",
        "industry":   "",
        "currency":   "AUD",
        "market_cap": None,
        "last_price": data[-1]["close"] if data else None,
        "source":     "Yahoo Finance",
    }
    try:
        raw = ticker.info
        info.update({
            "name":       raw.get("longName")       or raw.get("shortName", code),
            "sector":     raw.get("sector", ""),
            "industry":   raw.get("industry", ""),
            "currency":   raw.get("currency", "AUD"),
            "market_cap": raw.get("marketCap"),
            "last_price": raw.get("currentPrice")   or raw.get("regularMarketPrice") or data[-1]["close"],
            "change_pct": raw.get("regularMarketChangePercent"),
            "day_high":   raw.get("dayHigh")        or raw.get("regularMarketDayHigh"),
            "day_low":    raw.get("dayLow")         or raw.get("regularMarketDayLow"),
            "day_open":   raw.get("open")           or raw.get("regularMarketOpen"),
            "volume":     raw.get("volume")         or raw.get("regularMarketVolume"),
            "bid":        raw.get("bid"),
            "ask":        raw.get("ask"),
            "pe_ratio":   raw.get("trailingPE"),
            "eps":        raw.get("trailingEps"),
            "dividend":   raw.get("dividendYield"),
            "52w_high":   raw.get("fiftyTwoWeekHigh"),
            "52w_low":    raw.get("fiftyTwoWeekLow"),
            "source":     "Yahoo Finance",
        })
    except Exception as e:
        logger.warning(f"Could not fetch extended info for {ticker_sym}: {e}")

    logger.info(f"Yahoo Finance: {len(data)} candles for {ticker_sym}")
    return {"info": info, "data": data}


# ─── ENDPOINTS ────────────────────────────────────────────────────────────────

@app.get("/health")
def health_check():
    """
    Health check — verifies the API server is running and Yahoo Finance is reachable.
    Called by the React app on startup to show the connection status indicator.
    """
    yf_ok     = False
    yf_detail = "unknown"
    try:
        test = yf.Ticker("BHP.AX")
        hist = test.history(period="5d")
        if not hist.empty:
            yf_ok     = True
            yf_detail = f"OK — last close A${hist['Close'].iloc[-1]:.3f} on {str(hist.index[-1].date())}"
        else:
            yf_detail = "Connected but returned empty data"
    except Exception as e:
        yf_detail = str(e)[:100]

    return {
        "status":        "ok",
        "time":          datetime.utcnow().isoformat(),
        "yahoo_finance": "available" if yf_ok else "unavailable",
        "yf_detail":     yf_detail,
        "data_source":   "Yahoo Finance (ASX .AX suffix)",
        "cache_entries": len(_cache),
        "note":          "ASX Official API retired 2023. Yahoo Finance provides accurate ASX closing prices.",
    }


@app.get("/stock/{code}")
def get_stock(
    code: str,
    period: str = Query(default="6mo", description="Data period: 1mo 3mo 6mo 1y 2y 5y"),
):
    """
    Fetch OHLCV price history + company info for an ASX-listed stock.

    Returns up to 5 years of daily candles plus company metadata.
    Data is cached for 5 minutes to avoid rate limiting.

    Examples:
      GET /stock/BHP
      GET /stock/BHP?period=1y
      GET /stock/CSL?period=2y
    """
    if period not in VALID_PERIODS:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid period '{period}'. Choose from: {VALID_PERIODS}"
        )

    code      = code.upper().strip()
    cache_key = f"{code}_{period}"

    # Return cached response if still fresh
    cached = cache_get(cache_key)
    if cached:
        return {**cached, "from_cache": True}

    try:
        result = fetch_stock(code, period)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected error fetching {code}: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to fetch data for {code}: {str(e)}"
        )

    response = {
        "code":        code,
        "ticker":      f"{code}.AX",
        "period":      period,
        "data_source": "Yahoo Finance",
        "count":       len(result["data"]),
        "info":        result["info"],
        "data":        result["data"],
        "from_cache":  False,
    }

    cache_set(cache_key, response)
    return response


@app.get("/quote/{code}")
def get_live_quote(code: str):
    """
    Latest real-time quote — price, bid/ask, day range, volume, P/E, dividend.
    Not cached — always fetches fresh data.

    Example: GET /quote/BHP
    """
    code = code.upper().strip()
    logger.info(f"Live quote request for {code}")

    try:
        ticker = yf.Ticker(f"{code}.AX")
        info   = ticker.info

        if not info or info.get("regularMarketPrice") is None:
            raise HTTPException(
                status_code=404,
                detail=f"No live quote available for '{code}'. Check the ASX ticker code."
            )

        return {
            "code":        code,
            "ticker":      f"{code}.AX",
            "name":        info.get("longName") or info.get("shortName", code),
            "last_price":  info.get("currentPrice") or info.get("regularMarketPrice"),
            "open":        info.get("open") or info.get("regularMarketOpen"),
            "high":        info.get("dayHigh") or info.get("regularMarketDayHigh"),
            "low":         info.get("dayLow") or info.get("regularMarketDayLow"),
            "prev_close":  info.get("previousClose") or info.get("regularMarketPreviousClose"),
            "change_pct":  info.get("regularMarketChangePercent"),
            "volume":      info.get("volume") or info.get("regularMarketVolume"),
            "avg_volume":  info.get("averageVolume"),
            "bid":         info.get("bid"),
            "ask":         info.get("ask"),
            "market_cap":  info.get("marketCap"),
            "pe_ratio":    info.get("trailingPE"),
            "eps":         info.get("trailingEps"),
            "dividend":    info.get("dividendYield"),
            "52w_high":    info.get("fiftyTwoWeekHigh"),
            "52w_low":     info.get("fiftyTwoWeekLow"),
            "sector":      info.get("sector"),
            "industry":    info.get("industry"),
            "currency":    info.get("currency", "AUD"),
            "updated":     datetime.utcnow().isoformat(),
            "source":      "Yahoo Finance",
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Quote fetch failed for {code}: {str(e)}")


@app.get("/search/{query}")
def search_stocks(query: str):
    """
    Search ASX stocks by ticker code or company name.
    Example: GET /search/bank
    """
    ASX_LIST = [
        {"code": "BHP",  "name": "BHP Group"},
        {"code": "CBA",  "name": "Commonwealth Bank"},
        {"code": "CSL",  "name": "CSL Limited"},
        {"code": "NAB",  "name": "National Australia Bank"},
        {"code": "WBC",  "name": "Westpac Banking"},
        {"code": "ANZ",  "name": "ANZ Banking Group"},
        {"code": "WES",  "name": "Wesfarmers"},
        {"code": "MQG",  "name": "Macquarie Group"},
        {"code": "RIO",  "name": "Rio Tinto"},
        {"code": "TLS",  "name": "Telstra"},
        {"code": "WOW",  "name": "Woolworths Group"},
        {"code": "FMG",  "name": "Fortescue Metals"},
        {"code": "GMG",  "name": "Goodman Group"},
        {"code": "TCL",  "name": "Transurban"},
        {"code": "STO",  "name": "Santos"},
        {"code": "XRO",  "name": "Xero"},
        {"code": "ALL",  "name": "Aristocrat Leisure"},
        {"code": "COL",  "name": "Coles Group"},
        {"code": "REA",  "name": "REA Group"},
        {"code": "SEK",  "name": "SEEK"},
        {"code": "MIN",  "name": "Mineral Resources"},
        {"code": "PLS",  "name": "Pilbara Minerals"},
        {"code": "WDS",  "name": "Woodside Energy"},
        {"code": "ORG",  "name": "Origin Energy"},
        {"code": "QBE",  "name": "QBE Insurance"},
        {"code": "IAG",  "name": "Insurance Australia Group"},
        {"code": "CPU",  "name": "Computershare"},
        {"code": "ASX",  "name": "ASX Limited"},
        {"code": "APA",  "name": "APA Group"},
        {"code": "LTR",  "name": "Liontown Resources"},
        {"code": "NXT",  "name": "NextDC"},
        {"code": "APX",  "name": "Appen"},
        {"code": "WTC",  "name": "WiseTech Global"},
        {"code": "ALU",  "name": "Altium"},
        {"code": "MP1",  "name": "Megaport"},
    ]
    q       = query.upper()
    results = [s for s in ASX_LIST if q in s["code"] or q in s["name"].upper()]
    return {"query": query, "results": results[:10]}
