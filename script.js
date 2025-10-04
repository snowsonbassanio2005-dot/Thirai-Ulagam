/* script.js
 - calls Netlify function endpoints at /.netlify/functions/tmdb
 - makes rows for the requested genre ids
 - handles hero trailer, hover previews, and Netlify Identity auth
*/

const GENRES = [
  { id: 878, name: "AI" },
  { id: 528, name: "Food" },
  { id: 18,  name: "Drama" },
  { id: 27,  name: "Horror" },
  { id: 35,  name: "Comedy" },
];

const IMAGE_BASE = "https://image.tmdb.org/t/p/w500";
const YT_EMBED = (key, params = "") => `https://www.youtube.com/embed/${key}?rel=0&enablejsapi=1&playsinline=1&${params}`;

// Helpers
async function tmdbFetch(qs = {}) {
  const params = new URLSearchParams(qs).toString();
  const url = `/.netlify/functions/tmdb?${params}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("TMDb function error");
  return res.json();
}

// CREATE ROW
async function makeRow(genre) {
  const container = document.getElementById("rowsContainer");
  const row = document.createElement("section");
  row.className = "row";
  const title = document.createElement("h3");
  title.textContent = genre.name;
  row.appendChild(title);

  const track = document.createElement("div");
  track.className = "row-track";
  row.appendChild(track);

  container.appendChild(row);

  try {
    const data = await tmdbFetch({ type: "discover", genre: genre.id, limit: 20 });
    (data.results || []).forEach(movie => {
      const card = createPosterCard(movie);
      track.appendChild(card);
    });
  } catch (err) {
    console.error("Failed to load row:", genre, err);
    track.innerHTML = `<div style="padding:12px;color:#cfcfcf">Failed to load ${genre.name}</div>`;
  }
}

// Poster card
function createPosterCard(movie) {
  const el = document.createElement("div");
  el.className = "poster";
  el.dataset.id = movie.id;

  const img = document.createElement("img");
  img.src = movie.poster_path ? IMAGE_BASE + movie.poster_path : "";
  img.alt = movie.title || movie.name;
  el.appendChild(img);

  const title = document.createElement("div");
  title.className = "title";
  title.textContent = movie.title || movie.name;
  el.appendChild(title);

  // hover preview: try to fetch video on mouseenter
  let previewTimer = null;
  el.addEventListener("mouseenter", async () => {
    previewTimer = setTimeout(async () => {
      const frame = document.createElement("div");
      frame.className = "preview-frame";
      frame.innerHTML = `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center"></div>`;
      el.appendChild(frame);

      try {
        const data = await tmdbFetch({ type: "videos", movieId: movie.id });
        const vid = (data.results || []).find(v => v.site === "YouTube" && (v.type === "Trailer" || v.type === "Teaser" || v.type === "Clip"));
        if (vid) {
          // embed small YouTube iframe
          const iframe = document.createElement("iframe");
          iframe.src = YT_EMBED(vid.key, "autoplay=1&mute=1&controls=0&loop=1&playlist=" + vid.key);
          iframe.width = "100%";
          iframe.height = "100%";
          iframe.style.border = "0";
          iframe.allow = "autoplay; encrypted-media; picture-in-picture";
          frame.firstElementChild.appendChild(iframe);
        } else {
          // fallback: subtle zoom effect - reuse poster image
          frame.firstElementChild.innerHTML = `<div style="padding:10px;color:#ddd;text-align:center">Preview not available</div>`;
        }
      } catch (err) {
        frame.firstElementChild.innerHTML = `<div style="padding:10px;color:#ddd;text-align:center">Preview failed</div>`;
      }
    }, 350); // little delay to avoid spamming function on quick mouse moves
  });
  el.addEventListener("mouseleave", () => {
    if (previewTimer) {
      clearTimeout(previewTimer);
      previewTimer = null;
    }
    const frame = el.querySelector(".preview-frame");
    if (frame) frame.remove();
  });

  // click opens large trailer in hero
  el.addEventListener("click", async () => {
    openHeroWithMovie(movie);
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  return el;
}

// HERO
async function setHero(movie) {
  document.getElementById("heroTitle").textContent = movie.title || movie.name || "Featured";
  document.getElementById("heroOverview").textContent = movie.overview || "";

  // fetch videos
  try {
    const data = await tmdbFetch({ type: "videos", movieId: movie.id });
    const vid = (data.results || []).find(v => v.site === "YouTube" && (v.type === "Trailer" || v.type === "Teaser"));
    const container = document.getElementById("heroVideoContainer");
    container.innerHTML = "";
    if (vid) {
      const iframe = document.createElement("iframe");
      iframe.src = YT_EMBED(vid.key, "autoplay=1&mute=1&controls=1&loop=1&playlist=" + vid.key);
      iframe.allow = "autoplay; encrypted-media; picture-in-picture";
      iframe.setAttribute("title", "Hero trailer");
      iframe.style.width = "100%";
      iframe.style.height = "100%";
      iframe.style.border = "0";
      container.appendChild(iframe);
    } else {
      // fallback: large background poster
      const poster = document.createElement("div");
      poster.style.backgroundImage = movie.backdrop_path ? `url(${IMAGE_BASE + movie.backdrop_path})` : (movie.poster_path ? `url(${IMAGE_BASE + movie.poster_path})` : '');
      poster.style.backgroundSize = "cover";
      poster.style.backgroundPosition = "center";
      poster.style.position = "absolute";
      poster.style.inset = "0";
      poster.style.opacity = "0.6";
      container.appendChild(poster);
    }
  } catch (err) {
    console.error("Hero video fetch failed", err);
  }
}

async function openHeroWithMovie(movie) {
  await setHero(movie);
}

// initial load: choose featured (trending or top of first genre)
async function init() {
  // create rows
  for (const g of GENRES) {
    await makeRow(g);
  }

  // featured: pick first genre top movie
  try {
    const first = GENRES[0];
    const data = await tmdbFetch({ type: "discover", genre: first.id, limit: 10, sort_by: "vote_average.desc" });
    const featured = (data.results || [])[0];
    if (featured) {
      await setHero(featured);
    }
  } catch (err) {
    console.error("Failed to set featured", err);
  }
}

// Netlify Identity (auth)
function initAuth() {
  if (window.netlifyIdentity) {
    const identity = window.netlifyIdentity;
    // show a small modal with netlify's builtin widget
    document.getElementById("loginBtn").addEventListener("click", () => identity.open());
    document.getElementById("signupBtn").addEventListener("click", () => identity.open("signup"));
    // optionally react to login:
    identity.on("login", user => {
      identity.close();
      document.getElementById("loginBtn").textContent = user.email;
      console.log("logged in", user);
    });
    identity.on("logout", () => {
      document.getElementById("loginBtn").textContent = "Login";
    });
  } else {
    // fallback: show our simple modal
    const loginBtn = document.getElementById("loginBtn");
    const signupBtn = document.getElementById("signupBtn");
    const modal = document.getElementById("fallbackAuthModal");
    const close = document.getElementById("closeFallback");
    const form = document.getElementById("fallbackForm");
    const title = document.getElementById("fallbackTitle");
    const nameField = document.getElementById("nameField");
    let forSignup = false;

    loginBtn.addEventListener("click", () => { forSignup = false; title.textContent = "Login"; nameField.style.display = "none"; modal.classList.remove("hidden"); });
    signupBtn.addEventListener("click", () => { forSignup = true; title.textContent = "Sign up"; nameField.style.display = "block"; modal.classList.remove("hidden"); });
    close.addEventListener("click", () => modal.classList.add("hidden"));

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const email = document.getElementById("emailField").value;
      const password = document.getElementById("passwordField").value;
      const name = document.getElementById("nameField").value;

      // Fallback: just show a success message; for production enable Netlify Identity.
      const msg = document.getElementById("fallbackMsg");
      msg.textContent = "This fallback modal doesn't create a real user. To enable real sign up/login, enable Netlify Identity in your site (see README).";
    });
  }
}

window.addEventListener("DOMContentLoaded", () => {
  init();
  initAuth();
  // hero play button scrolls to hero video container (already autoplay muted)
  document.getElementById("playHero").addEventListener("click", () => {
    const v = document.getElementById("heroVideoContainer");
    v.scrollIntoView({ behavior: "smooth" });
  });
});
