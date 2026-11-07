/**
 * StayBook · Curated Coastal Hotels & Stays — frontend logic
 * Plain vanilla JS: fetch() against the Express REST API,
 * then DOM manipulation (createElement / innerHTML / listeners) to render it.
 *
 * Implements:
 * - Hero section inspired by Image 1 (Harmont aesthetic, scenery canvas, floating badges, radar, search capsule)
 * - Mobile & Web App UI/UX inspired by Image 2 & 3 (greeting, filter drawer with histogram & steppers,
 *   recently explored cards, modern hotel cards with favorite hearts, comprehensive hotel detail view
 *   with photo thumbnails, property pills, review progress bars, sticky bottom bar, and bottom dock navigation)
 */

const API_BASE = "/api";
const USER_KEY = "staybook.user";
const TOKEN_KEY = "staybook.token";
const ACCOUNT_KEY = "staybook.account";
const SEARCH_KEY = "staybook.search";
const FAV_KEY = "staybook.favorites";

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

// ---------- helpers ----------
const inr = (n) => "₹" + Number(n || 0).toLocaleString("en-IN");

function fmtDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function nightsBetween(a, b) {
  if (!a || !b) return 0;
  const start = new Date(a + "T00:00:00");
  const end = new Date(b + "T00:00:00");
  return Math.round((end - start) / 86400000);
}

async function api(path, options = {}) {
  const headers = new Headers(options.headers || {});
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Something went wrong");
  return data;
}

// ---------- state ----------
let currentHotel = null;
let currentRoom = null;
let pendingRoom = null;
let authMode = "login";
let lastSearch = JSON.parse(localStorage.getItem(SEARCH_KEY) || "null") || null;
let selectedRoomType = "";
let adultsCount = 2;
let childrenCount = 0;
let cachedHotels = [];

function saveSearch(search) {
  lastSearch = search;
  localStorage.setItem(SEARCH_KEY, JSON.stringify(search));
}

// ---------- favorites storage ----------
function getFavorites() {
  try {
    return JSON.parse(localStorage.getItem(FAV_KEY) || "[]");
  } catch {
    return [];
  }
}

function isFavorite(hotelId) {
  return getFavorites().includes(hotelId);
}

function toggleFavorite(hotelId) {
  let favs = getFavorites();
  if (favs.includes(hotelId)) {
    favs = favs.filter((id) => id !== hotelId);
    toast("Removed from saved stays.", "info");
  } else {
    favs.push(hotelId);
    toast("Saved to your favorites! ❤️", "success");
  }
  localStorage.setItem(FAV_KEY, JSON.stringify(favs));
  updateFavoritesBadge();
  // Re-render favorites modal if open
  if (!$("#favoritesModalRoot").classList.contains("hidden")) {
    renderFavoritesList();
  }
}

function updateFavoritesBadge() {
  const count = getFavorites().length;
  const badge = $("#favoritesCountBadge");
  const headerBadge = $("#headerFavoritesBadge");
  if (badge) {
    badge.textContent = count;
    badge.classList.toggle("hidden", count === 0);
  }
  if (headerBadge) {
    headerBadge.textContent = count;
    headerBadge.classList.toggle("hidden", count === 0);
  }
}

// ---------- toasts ----------
function toast(message, type = "success") {
  const stack = $("#toastStack");
  const icon = type === "success" ? "✓" : type === "error" ? "!" : "i";
  const el = document.createElement("div");
  el.className = `toast ${type}`;
  el.innerHTML = `<span class="toast-icon">${icon}</span><span>${message}</span>`;
  stack.appendChild(el);
  setTimeout(() => {
    el.classList.add("out");
    setTimeout(() => el.remove(), 300);
  }, 3600);
}

// ---------- cancel modal ----------
let pendingCancel = null;

function openModal(title, text) {
  $("#modalTitle").textContent = title;
  $("#modalText").textContent = text;
  $("#modalRoot").classList.remove("hidden");
}
function closeModal() {
  $("#modalRoot").classList.add("hidden");
  pendingCancel = null;
}
$("#modalKeep").addEventListener("click", closeModal);
$("#modalConfirmCancel").addEventListener("click", async () => {
  const id = pendingCancel;
  closeModal();
  if (!id) return;
  try {
    const btn = $(`[data-cancel="${id}"]`);
    if (btn) { btn.disabled = true; btn.textContent = "Cancelling…"; }
    await api(`/bookings/${id}/cancel`, { method: "PUT" });
    toast("Booking cancelled — room freed up.");
    loadHistory();
  } catch (err) {
    toast(err.message, "error");
  }
});
$("#modalRoot").addEventListener("click", (e) => {
  if (e.target === $("#modalRoot")) closeModal();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !$("#modalRoot").classList.contains("hidden")) closeModal();
});

// ---------- skeletons ----------
function skeletonGrid(count, media = true) {
  let html = "";
  for (let i = 0; i < count; i++) {
    html += `
      <div class="card skeleton">
        ${media ? `<div class="sk-media"></div>` : ""}
        <div class="sk-body">
          <div class="sk-line short"></div>
          <div class="sk-line"></div>
          <div class="sk-chip"></div><div class="sk-chip"></div>
        </div>
      </div>`;
  }
  return html;
}

// ---------- view switching ----------
function showView(name) {
  $$(".view").forEach((v) => v.classList.remove("active"));
  const target = $(`#view-${name}`);
  if (target) target.classList.add("active");

  $$(".nav-btn").forEach((b) => b.classList.toggle("active", b.dataset.nav === name));
  $$(".dock-btn").forEach((b) => b.classList.toggle("active", b.dataset.nav === name));

  if (name === "search") loadHotels();
  if (name === "history") maybeLoadHistory();
}

$$("[data-nav]").forEach((el) => {
  el.addEventListener("click", () => {
    if (el.dataset.nav !== "signout") showView(el.dataset.nav);
  });
});

$$(".back-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    if (btn.dataset.back) {
      showView(btn.dataset.back);
      if (btn.dataset.back === "search") {
        setTimeout(() => {
          $("#exploreSection")?.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 60);
      } else {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    }
  });
});

// Navigation to rooms: scrolls down to the rooms/suites section, never jumping to the hero top
function navigateToRooms() {
  if ($("#view-hotel")?.classList.contains("active")) {
    const suites = $("#roomSectionTitle") || $("#roomList");
    if (suites) {
      suites.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
  }
  showView("search");
  setTimeout(() => {
    const explore = $("#exploreSection");
    if (explore) explore.scrollIntoView({ behavior: "smooth", block: "start" });
  }, 80);
}

// ---------- hero navigation & interactive buttons ----------
const heroBookNowBtn = $("#heroBookNowBtn");
if (heroBookNowBtn) {
  heroBookNowBtn.addEventListener("click", () => {
    const explore = $("#exploreSection");
    if (explore) explore.scrollIntoView({ behavior: "smooth", block: "start" });
    $("#sLocation")?.focus();
  });
}

$("#heroNavLocations")?.addEventListener("click", () => {
  const explore = $("#exploreSection");
  if (explore) explore.scrollIntoView({ behavior: "smooth", block: "start" });
});

$("#navRoomsLink")?.addEventListener("click", (e) => {
  e.preventDefault();
  navigateToRooms();
});
$("#heroNavRooms")?.addEventListener("click", (e) => {
  e.preventDefault();
  navigateToRooms();
});

$("#navExpLink")?.addEventListener("click", () => {
  toast("✨ Curated Experiences: Private beach dinners, coastal cycling, and sunset cabanas.", "info");
});
$("#heroNavExp")?.addEventListener("click", () => {
  toast("✨ Curated Experiences: Private beach dinners, coastal cycling, and sunset cabanas.", "info");
});

$("#navContactLink")?.addEventListener("click", () => {
  toast("📞 Concierge Support: +91 (800) STAY-BOOK · Available 24/7", "info");
});
$("#heroNavContact")?.addEventListener("click", () => {
  toast("📞 Concierge Support: +91 (800) STAY-BOOK · Available 24/7", "info");
});

// Interactive Badges in Hero
$("#badgeWifi")?.addEventListener("click", () => {
  const explore = $("#exploreSection");
  if (explore) explore.scrollIntoView({ behavior: "smooth" });
  toast("📶 All signature suites feature verified 100+ Mbps fiber Wi-Fi.", "success");
});

$("#badgeCheckin")?.addEventListener("click", () => {
  toast("🔑 Contactless self check-in available 24/7 via mobile voucher code.", "info");
});

$("#badgePet")?.addEventListener("click", () => {
  toast("🐾 Pet-friendly accommodations available across select coastal cabins.", "info");
});

// Radar Widget Button
$("#heroRadarWidget")?.addEventListener("click", () => {
  const explore = $("#exploreSection");
  if (explore) explore.scrollIntoView({ behavior: "smooth" });
  toast("📍 Live GPS Map: 4 premium destinations along the Andhra coastline.", "info");
});

// Rating Widget Button
$("#heroRatingWidget")?.addEventListener("click", () => {
  $("#filterRating").value = "4.5";
  $("#chipRating")?.classList.add("active");
  loadHotels();
  const explore = $("#exploreSection");
  if (explore) explore.scrollIntoView({ behavior: "smooth" });
  toast("★ Filtered for top-rated stays (4.5★ and above).", "success");
});

// Notifications bell
$("#btnHeaderBell")?.addEventListener("click", () => {
  toast("🔔 Welcome to StayBook! Handpicked boutique hotels ready for instant booking.", "info");
});

// ---------- hero search capsule form ----------
$("#heroSearch").addEventListener("submit", (e) => {
  e.preventDefault();
  const locVal = $("#sLocation").value.trim();
  $("#filterLocation").value = locVal;

  const checkIn = $("#sCheckIn").value;
  const checkOut = $("#sCheckOut").value;
  const guests = Number($("#sGuests").value);

  const nights = nightsBetween(checkIn, checkOut);
  if (checkIn && checkOut && nights <= 0) {
    toast("Check-out must be after check-in.", "error");
    return;
  }

  if (checkIn || checkOut || guests) {
    saveSearch({ checkIn, checkOut, guests });
  }
  showView("search");
  loadHotels();

  const explore = $("#exploreSection");
  if (explore) explore.scrollIntoView({ behavior: "smooth" });
});

// Trending destination quick tags
$$(".quick-tag-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    const dest = btn.dataset.destination;
    $("#sLocation").value = dest;
    $("#filterLocation").value = dest;
    loadHotels();
    const explore = $("#exploreSection");
    if (explore) explore.scrollIntoView({ behavior: "smooth", block: "start" });
  });
});

// Minimum selectable dates (prevent past dates)
const todayIso = new Date().toISOString().split("T")[0];
["sCheckIn", "sCheckOut", "checkIn", "checkOut", "sheetCheckIn", "sheetCheckOut"].forEach((id) => {
  const el = $(`#${id}`);
  if (el) el.min = todayIso;
});
$("#sCheckIn")?.addEventListener("change", () => {
  if ($("#sCheckIn").value) {
    $("#sCheckOut").min = $("#sCheckIn").value;
  }
});
$("#sheetCheckIn")?.addEventListener("change", () => {
  if ($("#sheetCheckIn").value) {
    $("#sheetCheckOut").min = $("#sheetCheckIn").value;
  }
});
$("#checkIn")?.addEventListener("change", () => {
  if ($("#checkIn").value) {
    $("#checkOut").min = $("#checkIn").value;
  }
});

// Quick search input in explore header
$("#filterLocation")?.addEventListener("input", () => {
  // debounce search
  clearTimeout(window._searchTimer);
  window._searchTimer = setTimeout(() => {
    loadHotels();
  }, 350);
});

// ---------- hotels: search + filter + sort ----------
async function loadHotels() {
  const container = $("#hotelList");
  const empty = $("#searchEmpty");
  empty.classList.add("hidden");

  container.innerHTML = skeletonGrid(6);
  $("#resultCount").textContent = "…";

  const params = new URLSearchParams();
  const location = $("#filterLocation").value.trim();
  const minPrice = $("#filterMinPrice").value;
  const maxPrice = $("#filterMaxPrice").value;
  const rating = $("#filterRating").value;
  const sort = $("#sortBy").value;

  if (location) params.append("location", location);
  if (minPrice) params.append("minPrice", minPrice);
  if (maxPrice) params.append("maxPrice", maxPrice);
  if (rating) params.append("minRating", rating);
  if (selectedRoomType) params.append("roomType", selectedRoomType);
  if (sort && sort !== "recommended") params.append("sort", sort);

  try {
    const hotels = await api(`/hotels?${params.toString()}`);
    cachedHotels = hotels;
    renderHotelList(hotels);
  } catch (err) {
    container.innerHTML = "";
    toast(err.message, "error");
  }
}

// Render Modern Hotel Cards matching Image 2 & 3
function renderHotelList(hotels) {
  const container = $("#hotelList");
  const empty = $("#searchEmpty");
  container.innerHTML = "";

  $("#resultCount").textContent = hotels.length;
  $("#resultLabel").textContent = hotels.length === 1 ? "retreat" : "retreats";

  if (hotels.length === 0) {
    empty.classList.remove("hidden");
    return;
  }

  hotels.forEach((hotel) => {
    const isFav = isFavorite(hotel.id);
    const card = document.createElement("article");
    card.className = "card modern-hotel-card is-clickable";
    card.innerHTML = `
      <div class="card-media">
        <img src="${hotel.image}" alt="${hotel.name}" loading="lazy">
        <button type="button" class="btn-heart${isFav ? " active" : ""}" data-fav="${hotel.id}" aria-label="Save ${hotel.name} to favorites" title="Favorite">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="${isFav ? "currentColor" : "none"}" stroke="currentColor" stroke-width="2">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
          </svg>
        </button>
      </div>
      <div class="card-body">
        <div class="card-title-price-row">
          <h3 class="card-hotel-name">${hotel.name}</h3>
          <span class="card-price">${inr(hotel.price)}<small>/night</small></span>
        </div>

        <div class="card-rating-line">
          <span class="rating-star">★</span>
          <span class="rating-score">${Number(hotel.rating).toFixed(2)}</span>
          <span class="rating-count">(${Math.round(hotel.rating * 48)} reviews)</span>
        </div>

        <p class="card-meta">
          <svg class="meta-icon" viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
          <span>${hotel.location} · 3.5 km to center</span>
        </p>

        <div class="amenity-chips">
          ${(hotel.amenities || []).slice(0, 3).map((a) => `<span class="chip">${a}</span>`).join("")}
          <span class="chip rooms-chip">${hotel.availableRooms ?? "—"} rooms free</span>
        </div>

        <div class="card-foot">
          <button class="btn btn-dark hotel-card-action" aria-label="View suites at ${hotel.name}">View suites &rarr;</button>
        </div>
      </div>`;

    // Click on card opens hotel details
    card.addEventListener("click", (e) => {
      if (e.target.closest(".btn-heart")) return;
      openHotel(hotel.id);
    });

    // Favorite heart button toggle
    const heartBtn = card.querySelector(".btn-heart");
    if (heartBtn) {
      heartBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        toggleFavorite(hotel.id);
        const favNow = isFavorite(hotel.id);
        heartBtn.classList.toggle("active", favNow);
        heartBtn.querySelector("svg").setAttribute("fill", favNow ? "currentColor" : "none");
      });
    }

    container.appendChild(card);
  });
}

$("#hotelFilters")?.addEventListener("submit", (event) => {
  event.preventDefault();
  loadHotels();
});
$("#sortBy")?.addEventListener("change", loadHotels);

// Filter reset button
$("#btnReset")?.addEventListener("click", () => {
  ["filterLocation", "filterMinPrice", "filterMaxPrice", "filterRating", "sLocation", "sheetLocation", "sheetMinPrice", "sheetMaxPrice"].forEach((id) => {
    const el = $(`#${id}`);
    if (el) el.value = "";
  });
  selectedRoomType = "";
  $$(".prop-pill").forEach((p) => p.classList.toggle("active", p.dataset.type === ""));
  $$(".pill-chip-btn").forEach((p) => p.classList.remove("active"));
  $("#chipAllPlaces")?.classList.add("active");
  $("#sortBy").value = "recommended";
  loadHotels();
  toast("Filters reset to default.");
});

$("#btnClearAll")?.addEventListener("click", () => {
  $("#btnReset")?.click();
});

// Quick pill filter chips
$("#chipAllPlaces")?.addEventListener("click", () => {
  $("#btnReset")?.click();
});

$("#chipRating")?.addEventListener("click", (e) => {
  const active = e.currentTarget.classList.toggle("active");
  $("#filterRating").value = active ? "4.5" : "";
  loadHotels();
});

$("#chipQuality")?.addEventListener("click", (e) => {
  const active = e.currentTarget.classList.toggle("active");
  if (active) {
    // filter only eligible
    const filtered = cachedHotels.filter((h) => h.eligible);
    renderHotelList(filtered);
    toast("Showing verified Quality-Checked hotels.");
  } else {
    renderHotelList(cachedHotels);
  }
});

$("#chipUnder3000")?.addEventListener("click", (e) => {
  const active = e.currentTarget.classList.toggle("active");
  $("#filterMaxPrice").value = active ? "3000" : "";
  loadHotels();
});

// ---------- Filter Drawer Modal (Image 2 left & Image 3 top-right) ----------
const filterModalRoot = $("#filterModalRoot");
const btnOpenFilterModal = $("#btnOpenFilterModal");
const chipFilterModal = $("#chipFilterModal");
const btnCloseFilterModal = $("#btnCloseFilterModal");

function openFilterModal() {
  $("#sheetLocation").value = $("#filterLocation").value;
  $("#sheetMinPrice").value = $("#filterMinPrice").value;
  $("#sheetMaxPrice").value = $("#filterMaxPrice").value;
  $("#sheetCheckIn").value = $("#sCheckIn").value;
  $("#sheetCheckOut").value = $("#sCheckOut").value;
  filterModalRoot.classList.remove("hidden");
}
function closeFilterModal() {
  filterModalRoot.classList.add("hidden");
}

btnOpenFilterModal?.addEventListener("click", openFilterModal);
chipFilterModal?.addEventListener("click", openFilterModal);
btnCloseFilterModal?.addEventListener("click", closeFilterModal);
filterModalRoot?.addEventListener("click", (e) => {
  if (e.target === filterModalRoot) closeFilterModal();
});

// Stepper controls
$("#btnAdultsDec")?.addEventListener("click", () => {
  if (adultsCount > 1) {
    adultsCount--;
    $("#adultsVal").textContent = adultsCount;
    $("#sGuests").value = String(Math.min(6, adultsCount));
  }
});
$("#btnAdultsInc")?.addEventListener("click", () => {
  if (adultsCount < 8) {
    adultsCount++;
    $("#adultsVal").textContent = adultsCount;
    $("#sGuests").value = String(Math.min(6, adultsCount));
  }
});
$("#btnChildrenDec")?.addEventListener("click", () => {
  if (childrenCount > 0) {
    childrenCount--;
    $("#childrenVal").textContent = childrenCount;
  }
});
$("#btnChildrenInc")?.addEventListener("click", () => {
  if (childrenCount < 6) {
    childrenCount++;
    $("#childrenVal").textContent = childrenCount;
  }
});

// Property type pills inside drawer
$$(".prop-pill").forEach((pill) => {
  pill.addEventListener("click", () => {
    $$(".prop-pill").forEach((p) => p.classList.remove("active"));
    pill.classList.add("active");
    selectedRoomType = pill.dataset.type || "";
  });
});

// Sheet Reset & Submit
$("#btnSheetReset")?.addEventListener("click", () => {
  $("#sheetLocation").value = "";
  $("#sheetMinPrice").value = "";
  $("#sheetMaxPrice").value = "";
  $("#sheetCheckIn").value = "";
  $("#sheetCheckOut").value = "";
  adultsCount = 2;
  childrenCount = 0;
  $("#adultsVal").textContent = "2";
  $("#childrenVal").textContent = "0";
  selectedRoomType = "";
  $$(".prop-pill").forEach((p) => p.classList.toggle("active", p.dataset.type === ""));
  $("#btnReset")?.click();
  closeFilterModal();
});

$("#sheetFilterForm")?.addEventListener("submit", (e) => {
  e.preventDefault();
  $("#filterLocation").value = $("#sheetLocation").value.trim();
  $("#filterMinPrice").value = $("#sheetMinPrice").value;
  $("#filterMaxPrice").value = $("#sheetMaxPrice").value;
  $("#sCheckIn").value = $("#sheetCheckIn").value;
  $("#sCheckOut").value = $("#sheetCheckOut").value;
  saveSearch({
    checkIn: $("#sheetCheckIn").value,
    checkOut: $("#sheetCheckOut").value,
    guests: adultsCount + childrenCount
  });
  closeFilterModal();
  loadHotels();
  const explore = $("#exploreSection");
  if (explore) explore.scrollIntoView({ behavior: "smooth" });
});

// ---------- Favorites Drawer Modal ----------
const favoritesModalRoot = $("#favoritesModalRoot");
const btnOpenFavorites = $("#btnOpenFavorites");
const btnHeaderSaved = $("#btnHeaderSaved");
const btnCloseFavModal = $("#btnCloseFavModal");

function openFavoritesDrawer() {
  renderFavoritesList();
  favoritesModalRoot.classList.remove("hidden");
}

btnOpenFavorites?.addEventListener("click", openFavoritesDrawer);
btnHeaderSaved?.addEventListener("click", openFavoritesDrawer);
btnCloseFavModal?.addEventListener("click", () => {
  favoritesModalRoot.classList.add("hidden");
});
favoritesModalRoot?.addEventListener("click", (e) => {
  if (e.target === favoritesModalRoot) favoritesModalRoot.classList.add("hidden");
});

async function renderFavoritesList() {
  const container = $("#favoritesList");
  const favIds = getFavorites();
  if (favIds.length === 0) {
    container.innerHTML = `
      <div class="fav-empty">
        <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
        <h4>No saved escapes yet</h4>
        <p>Tap the heart icon on any hotel card to save your favourite retreats for later.</p>
      </div>`;
    return;
  }

  container.innerHTML = skeletonGrid(favIds.length, false);
  try {
    const allHotels = await api("/hotels");
    const favHotels = allHotels.filter((h) => favIds.includes(h.id));
    container.innerHTML = "";
    favHotels.forEach((h) => {
      const item = document.createElement("div");
      item.className = "fav-card-item";
      item.innerHTML = `
        <img src="${h.image}" alt="${h.name}">
        <div class="fav-item-info">
          <h4>${h.name}</h4>
          <p class="fav-place">📍 ${h.location}</p>
          <span class="fav-price">${inr(h.price)} <small>/ night</small></span>
        </div>
        <div class="fav-item-actions">
          <button class="btn btn-dark btn-sm fav-open-btn">View</button>
          <button class="fav-remove-btn" title="Remove">&times;</button>
        </div>`;
      item.querySelector(".fav-open-btn").addEventListener("click", () => {
        favoritesModalRoot.classList.add("hidden");
        openHotel(h.id);
      });
      item.querySelector(".fav-remove-btn").addEventListener("click", () => {
        toggleFavorite(h.id);
        renderFavoritesList();
      });
      container.appendChild(item);
    });
  } catch {
    container.innerHTML = "<p>Unable to load favorites right now.</p>";
  }
}

// ---------- hotel detail + rooms (Image 2 Center & Image 3 Reference) ----------
async function openHotel(hotelId) {
  try {
    const hotel = await api(`/hotels/${hotelId}`);
    currentHotel = hotel;

    const rooms = await api(`/hotels/${hotelId}/rooms`);

    // Extract property images for gallery
    const galleryShots = [
      hotel.image,
      rooms[0]?.bedImage || "https://images.unsplash.com/photo-1590490360182-c33d57733427?w=800",
      rooms[0]?.bathImage || "https://images.unsplash.com/photo-1552321554-5fefe8c9ef14?w=800",
      rooms[0]?.balconyImage || "https://images.unsplash.com/photo-1521401830884-6c03c1c87ebb?w=800"
    ].filter(Boolean);

    $("#hotelDetail").innerHTML = `
      <!-- Gallery with Main Hero + Thumbnails Strip matching Image 2 & 3 -->
      <div class="modern-detail-gallery">
        <div class="detail-hero-frame">
          <img id="detailHeroImg" src="${galleryShots[0]}" alt="${hotel.name}">
        </div>
        <div class="detail-gallery-thumbs">
          ${galleryShots.slice(0, 3).map((src, idx) => `
            <div class="detail-thumb-item${idx === 0 ? " active" : ""}" data-src="${src}">
              <img src="${src}" alt="Preview ${idx + 1}">
            </div>
          `).join("")}
          <div class="detail-thumb-item thumb-more" data-src="${galleryShots[3] || galleryShots[0]}">
            <img src="${galleryShots[3] || galleryShots[0]}" alt="More photos">
            <div class="thumb-more-overlay">+48 more</div>
          </div>
        </div>
      </div>

      <!-- Hotel Info and Pricing matching Image 2 Center -->
      <div class="modern-detail-info">
        <div class="detail-title-price-row">
          <div>
            <h2 class="detail-hotel-name">${hotel.name}</h2>
            <p class="detail-location-sub">
              <svg class="meta-icon" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
              <span>${hotel.location}, Andhra Pradesh</span>
            </p>
          </div>
          <div class="detail-price-box">
            <span class="detail-price-num">${inr(hotel.price)}</span>
            <small>/night</small>
          </div>
        </div>

        <!-- Property Details Metrics Pills matching Image 2 -->
        <div class="property-metrics-row">
          <div class="metric-pill">
            <span class="metric-icon">📐</span>
            <span class="metric-text">150 m²</span>
          </div>
          <div class="metric-pill">
            <span class="metric-icon">👥</span>
            <span class="metric-text">4 guests</span>
          </div>
          <div class="metric-pill">
            <span class="metric-icon">🛁</span>
            <span class="metric-text">1 bath</span>
          </div>
          <div class="metric-pill">
            <span class="metric-icon">🛏️</span>
            <span class="metric-text">2 beds</span>
          </div>
        </div>

        <!-- Property Description with Read More Toggle -->
        <div class="property-desc-block">
          <p class="property-desc-text" id="propDescText">
            ${hotel.name} features refined coastal architecture, handpicked suites, diverse local and continental dining options, luxury wellness spa, and round-the-clock personal guest concierge. Enjoy private balcony sunrises and verified hygiene safety checks.
          </p>
          <button type="button" class="btn-read-more" id="btnToggleDesc">Read more</button>
        </div>

        <!-- Rating & Reviews Breakdown matching Image 2 Center -->
        <div class="rating-reviews-card">
          <div class="rr-header">
            <span class="rr-star">★</span>
            <span class="rr-score">${Number(hotel.rating).toFixed(2)}</span>
            <span class="rr-dot">·</span>
            <span class="rr-count">217 reviews</span>
          </div>
          <div class="rr-bars">
            <div class="rr-bar-row">
              <span class="rr-bar-label">Communication</span>
              <div class="rr-bar-track"><div class="rr-bar-fill" style="width: 100%"></div></div>
              <span class="rr-bar-val">5.0</span>
            </div>
            <div class="rr-bar-row">
              <span class="rr-bar-label">Cleanliness</span>
              <div class="rr-bar-track"><div class="rr-bar-fill" style="width: 98%"></div></div>
              <span class="rr-bar-val">4.9</span>
            </div>
            <div class="rr-bar-row">
              <span class="rr-bar-label">Location &amp; Comfort</span>
              <div class="rr-bar-track"><div class="rr-bar-fill" style="width: 96%"></div></div>
              <span class="rr-bar-val">4.8</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Sticky Bottom Booking Bar (Image 2 Center) -->
      <div class="sticky-detail-booking-bar">
        <div class="sticky-price-wrap">
          <span class="sticky-price-label">Starting from</span>
          <span class="sticky-price-val">${inr(hotel.price)} <small>/ night</small></span>
        </div>
        <button type="button" class="btn btn-dark sticky-book-btn" id="btnScrollToRooms">Select Suite</button>
      </div>
    `;

    // Gallery thumbnail click listener
    $$(".detail-thumb-item").forEach((thumb) => {
      thumb.addEventListener("click", () => {
        const src = thumb.dataset.src;
        if (src) {
          $("#detailHeroImg").src = src;
          $$(".detail-thumb-item").forEach((t) => t.classList.remove("active"));
          thumb.classList.add("active");
        }
      });
    });

    // Read more toggle
    const toggleDescBtn = $("#btnToggleDesc");
    const descText = $("#propDescText");
    let expanded = false;
    toggleDescBtn?.addEventListener("click", () => {
      expanded = !expanded;
      descText.classList.toggle("expanded", expanded);
      toggleDescBtn.textContent = expanded ? "Read less" : "Read more";
    });

    // Sticky bar button scrolls to suites
    $("#btnScrollToRooms")?.addEventListener("click", () => {
      const roomHeading = $("#roomSectionTitle");
      if (roomHeading) roomHeading.scrollIntoView({ behavior: "smooth" });
    });

    // Share button listener
    $("#btnShareHotel")?.addEventListener("click", () => {
      navigator.clipboard?.writeText(window.location.href);
      toast("Property link copied to clipboard!");
    });

    $("#roomSectionTitle").textContent = `Available Suites at ${hotel.name}`;
    renderRooms(rooms);
    showView("hotel");
    window.scrollTo({ top: 0, behavior: "smooth" });
  } catch (err) {
    toast(err.message, "error");
  }
}

function renderRooms(rooms) {
  const container = $("#roomList");
  const empty = $("#roomEmpty");
  container.innerHTML = "";
  empty.classList.add("hidden");

  const available = rooms.filter((r) => r.status === "available");
  $("#roomSubtext").textContent =
    available.length === 0
      ? "All suites are currently occupied."
      : `${available.length} of ${rooms.length} suites available — select your room to reserve.`;

  if (rooms.length === 0) {
    empty.classList.remove("hidden");
    return;
  }

  rooms.forEach((room) => {
    const free = room.status === "available";
    const card = document.createElement("article");
    card.className = `card modern-room-card${free ? " is-clickable" : ""}`;
    card.innerHTML = `
      <div class="room-top">
        <span class="room-type-badge">${room.roomType}</span>
        <span class="status-badge ${free ? "status-available" : "status-booked"}">${free ? "Available" : "Booked"}</span>
      </div>
      <div class="room-media">
        <img src="${room.bedImage}" alt="Bedroom">
        <div class="rm-stack">
          <img src="${room.bathImage}" alt="Bathroom">
          ${room.hasBalcony && room.balconyImage
            ? `<img src="${room.balconyImage}" alt="Balcony">`
            : `<div class="rm-no-b">No Balcony</div>`}
        </div>
      </div>
      <h4>Room ${room.roomNumber}</h4>
      <ul class="room-feats">
        ${(room.ambience || [])
          .slice(0, 3)
          .map((a) => `<li>• ${a}</li>`)
          .join("")}
      </ul>
      <div class="card-foot">
        <div class="price-wrap">
          <span class="price">${inr(room.price)} <small>/ night</small></span>
        </div>
        ${free ? `<button class="btn btn-dark">Reserve room</button>` : `<button class="btn btn-ghost" disabled>Reserved</button>`}
      </div>`;
    if (free) card.addEventListener("click", () => openBooking(room));
    container.appendChild(card);
  });
}

// ---------- guest account / JWT session ----------
function updateAuthButton() {
  const button = $("#authButton");
  const greeting = $("#greetingUser");
  const signedIn = !!localStorage.getItem(TOKEN_KEY);
  const accountRaw = localStorage.getItem(ACCOUNT_KEY);
  let userName = "Explorer";

  if (accountRaw) {
    try {
      const acc = JSON.parse(accountRaw);
      if (acc.name) userName = acc.name.split(" ")[0];
    } catch {}
  }

  if (greeting) {
    greeting.textContent = signedIn ? `Hey, ${userName} 👋` : "Hey, Explorer 👋";
  }

  if (button) {
    button.textContent = signedIn ? "Sign out" : "Sign in";
    button.dataset.nav = signedIn ? "signout" : "auth";
  }
}

function setAuthMode(mode) {
  authMode = mode;
  const registering = mode === "register";
  $("#authTitle").textContent = registering ? "Create your account" : "Welcome back";
  $("#authIntro").textContent = registering ? "One account manages your luxury coastal journeys." : "Access your personal booking portal.";
  $("#authNameLabel").classList.toggle("hidden", !registering);
  $("#authName").classList.toggle("hidden", !registering);
  $("#authName").required = registering;
  $("#authPassword").autocomplete = registering ? "new-password" : "current-password";
  $("#authSubmit").textContent = registering ? "Create account" : "Sign in";
  $("#authSwitchText").textContent = registering ? "Already have an account?" : "New to StayBook?";
  $("#authModeToggle").textContent = registering ? "Sign in" : "Create an account";
  $("#adminLoginLink").classList.toggle("hidden", registering);
  $("#authError").classList.add("hidden");
}

$("#authModeToggle").addEventListener("click", () => setAuthMode(authMode === "login" ? "register" : "login"));
$("#authButton").addEventListener("click", (event) => {
  if (event.currentTarget.dataset.nav !== "signout") return;
  event.preventDefault();
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(ACCOUNT_KEY);
  localStorage.removeItem(USER_KEY);
  updateAuthButton();
  toast("You have signed out.");
  showView("search");
});

$("#authForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const error = $("#authError");
  error.classList.add("hidden");
  const button = $("#authSubmit");
  button.disabled = true;
  button.textContent = authMode === "register" ? "Creating account…" : "Signing in…";
  try {
    const result = await api(`/auth/${authMode}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: $("#authName").value.trim(),
        email: $("#authEmail").value.trim(),
        password: $("#authPassword").value
      })
    });
    localStorage.setItem(TOKEN_KEY, result.token);
    localStorage.setItem(ACCOUNT_KEY, JSON.stringify(result.user));
    localStorage.setItem(USER_KEY, String(result.user.id));
    updateAuthButton();
    toast(authMode === "register" ? "Account created successfully." : "Welcome back.");
    $("#authForm").reset();
    if (pendingRoom) {
      const room = pendingRoom;
      pendingRoom = null;
      openBooking(room);
    } else {
      showView("search");
    }
  } catch (err) {
    error.textContent = err.message;
    error.classList.remove("hidden");
  } finally {
    button.disabled = false;
    button.textContent = authMode === "register" ? "Create account" : "Sign in";
  }
});

updateAuthButton();
setAuthMode("login");
updateFavoritesBadge();

// ---------- booking form ----------
function openBooking(room) {
  if (!localStorage.getItem(TOKEN_KEY)) {
    pendingRoom = room;
    showView("auth");
    toast("Please sign in or create an account to reserve this room.", "info");
    window.scrollTo({ top: 0, behavior: "smooth" });
    return;
  }
  currentRoom = room;
  if (!currentHotel && room.hotelId && cachedHotels.length) {
    currentHotel = cachedHotels.find((h) => h.id === room.hotelId) || null;
  }
  $("#bookingHotelName").textContent = currentHotel ? currentHotel.name : "—";
  $("#bookingHotelPlace").textContent = currentHotel
    ? `📍 ${currentHotel.location}`
    : "—";
  $("#bookingRoomType").textContent = room.roomType;
  $("#bookingRoomNo").textContent = room.roomNumber;
  $("#bookingRate").textContent = Number(room.price).toLocaleString("en-IN");

  $("#bookingForm").reset();
  $("#guests").value = lastSearch && lastSearch.guests ? String(lastSearch.guests) : "2";
  $("#checkIn").value = lastSearch && lastSearch.checkIn ? lastSearch.checkIn : "";
  $("#checkOut").value = lastSearch && lastSearch.checkOut ? lastSearch.checkOut : "";

  fillGallery(room);
  syncOrderPanel();
  showView("booking");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

// room picture gallery: bedroom / bathroom / balcony + ambience
function fillGallery(room) {
  const shots = [
    { src: room.bedImage, label: "Bedroom" },
    { src: room.bathImage, label: "Bathroom" }
  ];
  if (room.hasBalcony && room.balconyImage) shots.push({ src: room.balconyImage, label: "Balcony" });

  const mainImg = $("#galleryMain");
  mainImg.src = shots[0].src;
  mainImg.alt = `${room.roomType} bedroom`;

  const thumbs = $("#galleryThumbs");
  thumbs.innerHTML = "";
  shots.forEach((shot, i) => {
    const t = document.createElement("button");
    t.type = "button";
    t.className = `thumb${i === 0 ? " active" : ""}`;
    t.title = shot.label;
    t.innerHTML = `<img src="${shot.src}" alt="${shot.label}">`;
    t.addEventListener("click", () => {
      mainImg.src = shot.src;
      thumbs.querySelectorAll(".thumb").forEach((x) => x.classList.remove("active"));
      t.classList.add("active");
    });
    thumbs.appendChild(t);
  });

  $("#galleryTags").innerHTML = (room.ambience || [])
    .map((a) => `<span class="vg-chip">${a}</span>`)
    .join("");
}

function syncOrderPanel() {
  const checkIn = $("#checkIn").value;
  const checkOut = $("#checkOut").value;
  const guests = Number($("#guests").value);
  const hint = $("#dateHint");
  const rate = currentRoom ? currentRoom.price : 0;
  const nights = nightsBetween(checkIn, checkOut);

  $("#orderCheckIn").textContent = fmtDate(checkIn);
  $("#orderCheckOut").textContent = fmtDate(checkOut);
  $("#orderNights").textContent = nights ? `${nights} night${nights === 1 ? "" : "s"}` : "—";
  $("#orderGuests").textContent = guests;

  $("#checkIn").classList.remove("is-invalid");
  $("#checkOut").classList.remove("is-invalid");
  hint.classList.remove("error");

  if (!checkIn && !checkOut) {
    hint.textContent = "Select dates to preview duration and pricing.";
    $("#orderTotal").textContent = "—";
  } else if (nights > 0) {
    const total = nights * rate;
    hint.textContent = `${nights} night${nights === 1 ? "" : "s"} × ${inr(rate)} = ${inr(total)}`;
    $("#orderTotal").textContent = inr(total);
  } else {
    hint.textContent = "Check-out must be after check-in.";
    hint.classList.add("error");
    $("#checkIn").classList.add("is-invalid");
    $("#checkOut").classList.add("is-invalid");
    $("#orderTotal").textContent = "—";
  }
}

["checkIn", "checkOut", "guests"].forEach((id) =>
  $(`#${id}`)?.addEventListener("change", syncOrderPanel)
);

$("#bookingForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const checkIn = $("#checkIn").value;
  const checkOut = $("#checkOut").value;
  const guests = Number($("#guests").value);

  if (nightsBetween(checkIn, checkOut) <= 0) {
    toast("Choose a check-out date after check-in.", "error");
    return;
  }
  if (!currentHotel || !currentRoom) {
    toast("Something went wrong — pick a room again.", "error");
    return;
  }

  const btn = $("#btnConfirm");
  btn.disabled = true;
  btn.textContent = "Securing suite…";

  try {
    const booking = await api("/bookings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        hotelId: currentHotel.id,
        roomId: currentRoom.id,
        checkIn,
        checkOut,
        guests,
      }),
    });

    renderVoucher(booking);
    showView("confirm");
    toast(`Reservation confirmed! Reference ID: ${booking.id}`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  } catch (err) {
    toast(err.message, "error");
  } finally {
    btn.disabled = false;
    btn.textContent = "Confirm reservation";
  }
});

// ---------- confirmation voucher ----------
function renderVoucher(b) {
  const hotel = currentHotel || {};
  const nights = nightsBetween(b.checkIn, b.checkOut);
  $("#voucherCard").innerHTML = `
    <div class="voucher">
      <div class="voucher-top">
        <div class="voucher-brand-group">
          <span class="voucher-brand">Harmont<span>.</span></span>
          <span class="voucher-concierge-tag">Luxury Stay Voucher</span>
        </div>
        <div class="voucher-code">
          <div class="vc-label">Reservation Reference</div>
          <div class="vc-value">${b.id}</div>
        </div>
      </div>
      <div class="voucher-route">
        <div class="vc-stop">
          <div class="vc-label">Property &amp; Destination</div>
          <h3>${hotel.name || b.hotelName || "Hotel"}</h3>
          <p>📍 ${hotel.location || "Coastal Andhra"}</p>
        </div>
        <div class="vc-arrow">
          <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M5 12h14M13 6l6 6-6 6"/>
          </svg>
        </div>
        <div class="vc-stop r">
          <div class="vc-label">Reserved Suite</div>
          <h3>${b.roomNumber ? "Room " + b.roomNumber : "Suite"}</h3>
          <p>${b.roomType || "Signature"}</p>
        </div>
      </div>
      <div class="voucher-dash"></div>
      <div class="voucher-table">
        <div class="vc-cell"><div class="vc-label">Check-in</div><span class="vc-value">${fmtDate(b.checkIn)}</span></div>
        <div class="vc-cell"><div class="vc-label">Check-out</div><span class="vc-value">${fmtDate(b.checkOut)}</span></div>
        <div class="vc-cell"><div class="vc-label">Duration</div><span class="vc-value">${nights} night${nights === 1 ? "" : "s"}</span></div>
        <div class="vc-cell"><div class="vc-label">Guests</div><span class="vc-value">${b.guests} guest${b.guests === 1 ? "" : "s"}</span></div>
      </div>
      <div class="voucher-foot">
        <div class="voucher-total">Total Amount Paid<b>${inr(b.totalAmount)}</b></div>
        <span class="status-badge status-confirmed">✓ Confirmed &amp; Held</span>
      </div>
      <div class="voucher-seal-row">
        <span>Official Digital Stay Voucher · StayBook Guest Concierge</span>
        <span>Valid for check-in upon arrival</span>
      </div>
    </div>`;
}

// Print Voucher Listener
const btnPrintVoucher = $("#btnPrintVoucher");
if (btnPrintVoucher) {
  btnPrintVoucher.addEventListener("click", () => window.print());
}

// ---------- booking history ----------
function maybeLoadHistory() {
  if (!localStorage.getItem(TOKEN_KEY)) {
    showView("auth");
    toast("Sign in to review your confirmed bookings.", "info");
    return;
  }
  loadHistory();
}

$("#btnLoadHistory")?.addEventListener("click", loadHistory);

async function loadHistory() {
  if (!localStorage.getItem(TOKEN_KEY)) return maybeLoadHistory();
  const list = $("#historyList");
  const stats = $("#statsStrip");
  const empty = $("#historyEmpty");
  empty.classList.add("hidden");
  stats.classList.add("hidden");
  list.innerHTML = skeletonGrid(3, false);

  try {
    const bookings = await api("/bookings/me");
    renderHistory(bookings);
  } catch (err) {
    list.innerHTML = "";
    toast(err.message, "error");
  }
}

function renderHistory(bookings) {
  const list = $("#historyList");
  const stats = $("#statsStrip");
  const empty = $("#historyEmpty");
  list.innerHTML = "";

  if (bookings.length === 0) {
    empty.classList.remove("hidden");
    stats.classList.add("hidden");
    return;
  }

  // stats strip
  const confirmed = bookings.filter((b) => b.status !== "cancelled");
  const nights = confirmed.reduce((s, b) => s + nightsBetween(b.checkIn, b.checkOut), 0);
  const spent = confirmed.reduce((s, b) => s + b.totalAmount, 0);
  stats.innerHTML = `
    <div class="stat"><div class="stat-num">${bookings.length}</div><div class="stat-label">Total Bookings</div></div>
    <div class="stat"><div class="stat-num">${confirmed.length}</div><div class="stat-label">Active Stays</div></div>
    <div class="stat"><div class="stat-num">${nights}</div><div class="stat-label">Nights Booked</div></div>
    <div class="stat"><div class="stat-num">${inr(spent)}</div><div class="stat-label">Total Investment</div></div>`;
  stats.classList.remove("hidden");

  bookings.slice().reverse().forEach((b) => {
    const cancelled = b.status === "cancelled";
    const badgeClass = cancelled ? "status-cancelled" : "status-confirmed";
    const item = document.createElement("div");
    item.className = "history-item";
    item.innerHTML = `
      <div class="history-avatar">${(b.hotelName || "H").charAt(0)}</div>
      <div class="history-main">
        <h4>${b.hotelName || "Hotel"}</h4>
        <p class="history-meta">
          <b>${b.roomType || "Room"} · Room ${b.roomNumber || "—"}</b> &nbsp;|&nbsp;
          ${fmtDate(b.checkIn)} → ${fmtDate(b.checkOut)} &nbsp;|&nbsp; ${b.guests} guest${b.guests === 1 ? "" : "s"}
        </p>
        <p class="history-meta" style="margin-top:4px">Reference: ${b.id}</p>
      </div>
      <div class="history-side">
        <div class="history-price">
          <div class="price" style="font-size:18px">${inr(b.totalAmount)}</div>
          <span class="status-badge ${badgeClass}" style="margin-top:6px;display:inline-block">${cancelled ? "Cancelled" : "Confirmed"}</span>
        </div>
        ${!cancelled ? `<button class="cancel-btn" data-cancel="${b.id}">Cancel booking</button>` : ""}
      </div>`;

    const cancelBtn = item.querySelector(".cancel-btn");
    if (cancelBtn) {
      cancelBtn.addEventListener("click", (ev) => {
        ev.stopPropagation();
        pendingCancel = b.id;
        openModal("Cancel this booking?", `Booking ${b.id} will be cancelled and Room ${b.roomNumber} will be freed up for other guests.`);
      });
    }

    if (!cancelled) {
      attachFeedback(item, b);
    }
    list.appendChild(item);
  });
}

// star-rating widget for confirmed bookings
function attachFeedback(item, b) {
  const side = item.querySelector(".history-side");
  const fb = document.createElement("div");
  fb.className = "feedback";
  fb.innerHTML = `
    <div>
      <div class="fb-label">Rate this stay</div>
      <div class="stars">
        ${[1, 2, 3, 4, 5]
          .map((n) => `<button type="button" class="star-btn${b.feedback >= n ? " filled" : ""}" data-score="${n}" aria-label="${n} star">★</button>`)
          .join("")}
      </div>
    </div>`;

  const stars = fb.querySelectorAll(".star-btn");
  if (b.feedback) {
    stars.forEach((s) => (s.disabled = true));
    fb.insertAdjacentHTML("beforeend", `<span class="fb-msg">Thanks for your feedback!</span>`);
  } else {
    stars.forEach((btn) => {
      btn.addEventListener("click", async () => {
        const score = Number(btn.dataset.score);
        try {
          await api(`/bookings/${b.id}/feedback`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ score })
          });
          stars.forEach((s) => {
            s.classList.add("filled");
            s.disabled = true;
          });
          fb.insertAdjacentHTML("beforeend", `<span class="fb-msg">Thanks for your feedback!</span>`);
          toast("Thanks for rating your stay!");
        } catch (err) {
          toast(err.message, "error");
        }
      });
    });
  }
  side.prepend(fb);
}

// ---------- confirm → view history shortcut ----------
$("#btnGoHistory")?.addEventListener("click", () => showView("history"));

// ---------- initial load ----------
showView("search");
