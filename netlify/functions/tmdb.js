// netlify/functions/tmdb.js
// Node 18+ runtime expected (global fetch available). This function proxies requests to TMDb
// and reads the API key from process.env.TMDB_API_KEY
//
// Endpoints (via query params):
// - ?type=discover&genre=878&limit=20 -> discover movies with genre
// - ?type=videos&movieId=12345 -> movie videos
// - ?type=movie&movieId=12345 -> movie details
//
// Make sure to set environment variable TMDB_API_KEY in Netlify site settings.

exports.handler = async function(event) {
  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "TMDB_API_KEY not set in environment variables" }),
    };
  }

  const qs = event.queryStringParameters || {};
  const type = qs.type || "discover";

  const headers = { "Content-Type": "application/json" };

  try {
    let targetUrl = "";
    if (type === "discover") {
      // fetch discover movies for a genre
      const genre = qs.genre;
      const limit = qs.limit || 20;
      // example: /discover/movie?with_genres=878
      const params = new URLSearchParams({
        api_key: apiKey,
        with_genres: genre || "",
        sort_by: qs.sort_by || "popularity.desc",
        page: 1,
      }).toString();
      targetUrl = `https://api.themoviedb.org/3/discover/movie?${params}`;
    } else if (type === "videos") {
      const movieId = qs.movieId;
      if (!movieId) return { statusCode: 400, body: JSON.stringify({ error: "movieId required" }) };
      targetUrl = `https://api.themoviedb.org/3/movie/${movieId}/videos?api_key=${apiKey}`;
    } else if (type === "movie") {
      const movieId = qs.movieId;
      if (!movieId) return { statusCode: 400, body: JSON.stringify({ error: "movieId required" }) };
      targetUrl = `https://api.themoviedb.org/3/movie/${movieId}?api_key=${apiKey}`;
    } else {
      return { statusCode: 400, body: JSON.stringify({ error: "Unknown type" }) };
    }

    // Use global fetch (Node 18+) — Netlify run environments support it.
    const resp = await fetch(targetUrl);
    if (!resp.ok) {
      const text = await resp.text();
      return { statusCode: resp.status, body: text, headers };
    }
    const data = await resp.json();
    return {
      statusCode: 200,
      headers: {
        ...headers,
        "Access-Control-Allow-Origin": "*"
      },
      body: JSON.stringify(data)
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message })
    };
  }
};
