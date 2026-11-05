/**
 * StayBook · Hotel Booking System — frontend logic
 * Plain vanilla JS: fetch() against the Express REST API,
 * then DOM manipulation (createElement / innerHTML / listeners) to render it.
 */

const API_BASE = "/api";
const USER_KEY = "staybook.user";
const TOKEN_KEY = "staybook.token";
const ACCOUNT_KEY = "staybook.account";
const SEARCH_KEY = "staybook.search";

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

function saveSearch(search) {
  lastSearch = search;
  localStorage.setItem(SEARCH_KEY, JSON.stringify(search));
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

  if (name === "search") loadHotels();
  if (name === "history") maybeLoadHistory();
}

$$("[data-nav]").forEach((el) => {
  el.addEventListener("click", () => {
    if (el.dataset.nav !== "signout") showView(el.dataset.nav);
  });
});

$$(".back-btn").forEach((btn) => {
  btn.addEventListener("click", () => showView(btn.dataset.back));
});

// ---------- hero search band ----------
$("#heroSearch").addEventListener("submit", (e) => {
  e.preventDefault();
  $("#filterLocation").value = $("#sLocation").value.trim();

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
  if (sort && sort !== "recommended") params.append("sort", sort);

  try {
    const hotels = await api(`/hotels?${params.toString()}`);
    renderHotelList(hotels);
  } catch (err) {
    container.innerHTML = "";
    toast(err.message, "error");
  }
}

function renderHotelList(hotels) {
  const container = $("#hotelList");
  const empty = $("#searchEmpty");
  container.innerHTML = "";

  $("#resultCount").textContent = hotels.length;
  $("#resultLabel").textContent = hotels.length === 1 ? "stay" : "stays";

  if (hotels.length === 0) {
    empty.classList.remove("hidden");
    return;
  }

  hotels.forEach((hotel) => {
    const card = document.createElement("article");
    card.className = "card hotel-card";
    card.innerHTML = `
      <div class="card-media">
        <img src="${hotel.image}" alt="${hotel.name}" loading="lazy">
        <span class="rating-chip"><span class="star">★</span> ${hotel.rating}</span>
      </div>
      <div class="card-body">
        <h3>${hotel.name}</h3>
        <p class="card-meta">📍 ${hotel.location}${hotel.eligible ? ` <span class="eligible-chip"><span class="tick">✓</span> Quality-checked</span>` : ""}</p>
        <div class="amenity-chips">
          ${hotel.amenities.slice(0, 3).map((a) => `<span class="chip">${a}</span>`).join("")}
          <span class="chip rooms-chip">${hotel.availableRooms ?? "—"} rooms free</span>
        </div>
        <div class="card-foot">
          <span class="price">${inr(hotel.price)} <small>/ night</small></span>
          <button class="btn btn-primary hotel-card-action" aria-label="View rooms at ${hotel.name}">View rooms</button>
        </div>
      </div>`;
    card.querySelector(".hotel-card-action").addEventListener("click", () => openHotel(hotel.id));
    container.appendChild(card);
  });
}

$("#hotelFilters").addEventListener("submit", (event) => {
  event.preventDefault();
  loadHotels();
});
$("#sortBy").addEventListener("change", loadHotels);
$("#btnReset").addEventListener("click", () => {
  ["filterLocation", "filterMinPrice", "filterMaxPrice", "filterRating"].forEach((id) => ($(`#${id}`).value = ""));
  $("#sortBy").value = "recommended";
  loadHotels();
});
$("#btnClearAll").addEventListener("click", () => {
  $("#btnReset").click();
});

// ---------- hotel detail + rooms ----------
async function openHotel(hotelId) {
  try {
    const hotel = await api(`/hotels/${hotelId}`);
    currentHotel = hotel;

    $("#hotelDetail").innerHTML = `
      <div class="hotel-hero">
        <img src="${hotel.image}" alt="${hotel.name}">
        <span class="rating-chip"><span class="star">★</span> ${hotel.rating}</span>
      </div>
      <div class="hotel-info">
        <h2>${hotel.name}</h2>
        <p class="card-meta">📍 ${hotel.location}${hotel.eligible ? ` <span class="eligible-chip"><span class="tick">✓</span> Quality-checked</span>` : ""}</p>
        <p class="hotel-price-line">${inr(hotel.price)} <small>/ night &middot; from</small></p>
        <div class="amenities-hotel">
          ${hotel.amenities.map((a) => `<span class="chip">${a}</span>`).join("")}
        </div>
      </div>`;

    $("#roomSectionTitle").textContent = `Rooms at ${hotel.name}`;
    renderRooms(await api(`/hotels/${hotelId}/rooms`));
    showView("hotel");
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
      ? "No rooms are available right now."
      : `${available.length} of ${rooms.length} rooms available — book one below.`;

  if (rooms.length === 0) {
    empty.classList.remove("hidden");
    return;
  }

  rooms.forEach((room) => {
    const free = room.status === "available";
    const card = document.createElement("article");
    card.className = `card room-card${free ? " is-clickable" : ""}`;
    card.innerHTML = `
      <div class="room-top">
        <span class="room-type-badge">${room.roomType}</span>
        <span class="status-badge ${free ? "status-available" : "status-booked"}">${room.status}</span>
      </div>
      <div class="room-media">
        <img src="${room.bedImage}" alt="Bedroom">
        <div class="rm-stack">
          <img src="${room.bathImage}" alt="Bathroom">
          ${room.hasBalcony && room.balconyImage
            ? `<img src="${room.balconyImage}" alt="Balcony">`
            : `<div class="rm-no-b">No balcony</div>`}
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
        <span class="price">${inr(room.price)} <small>/ night</small></span>
        ${free ? `<button class="btn btn-coral">Book this room</button>` : `<button class="btn btn-ghost" disabled>Unavailable</button>`}
      </div>`;
    if (free) card.addEventListener("click", () => openBooking(room));
    container.appendChild(card);
  });
}

// ---------- guest account / JWT session ----------
function updateAuthButton() {
  const button = $("#authButton");
  const signedIn = !!localStorage.getItem(TOKEN_KEY);
  button.textContent = signedIn ? "Sign out" : "Sign in";
  button.dataset.nav = signedIn ? "signout" : "auth";
}

function setAuthMode(mode) {
  authMode = mode;
  const registering = mode === "register";
  $("#authTitle").textContent = registering ? "Create your account" : "Welcome back";
  $("#authIntro").textContent = registering ? "One account keeps your trips together." : "Use your account to continue.";
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
    toast(authMode === "register" ? "Account created." : "Welcome back.");
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

// ---------- booking form ----------
function openBooking(room) {
  if (!localStorage.getItem(TOKEN_KEY)) {
    pendingRoom = room;
    showView("auth");
    toast("Sign in before confirming a room.", "info");
    return;
  }
  currentRoom = room;
  $("#bookingHotelName").textContent = currentHotel ? currentHotel.name : "—";
  $("#bookingHotelPlace").textContent = currentHotel
    ? `📍 ${currentHotel.location}`
    : "—";
  $("#bookingRoomType").textContent = room.roomType;
  $("#bookingRoomNo").textContent = room.roomNumber;
  $("#bookingRate").textContent = room.price;

  $("#bookingForm").reset();
  $("#guests").value = lastSearch && lastSearch.guests ? String(lastSearch.guests) : "2";
  $("#checkIn").value = lastSearch && lastSearch.checkIn ? lastSearch.checkIn : "";
  $("#checkOut").value = lastSearch && lastSearch.checkOut ? lastSearch.checkOut : "";

  fillGallery(room);
  syncOrderPanel();
  showView("booking");
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
    hint.textContent = "Pick dates to preview your total.";
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
  $(`#${id}`).addEventListener("change", syncOrderPanel)
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
  btn.textContent = "Confirming…";

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
    toast(`Booking confirmed. Your ID: ${booking.id}`);
  } catch (err) {
    toast(err.message, "error");
  } finally {
    btn.disabled = false;
    btn.textContent = "Confirm booking";
  }
});

// ---------- confirmation voucher ----------
function renderVoucher(b) {
  const hotel = currentHotel || {};
  const nights = nightsBetween(b.checkIn, b.checkOut);
  $("#voucherCard").innerHTML = `
    <div class="voucher">
      <div class="voucher-top">
        <span class="voucher-brand">StayBook<span>.</span></span>
        <div class="voucher-code">
          <div class="vc-label">Booking ID</div>
          <div class="vc-value">${b.id}</div>
        </div>
      </div>
      <div class="voucher-route">
        <div class="vc-stop">
          <div class="vc-label">Stay</div>
          <h3>${hotel.name || b.hotelName || "Hotel"}</h3>
          <p>📍 ${hotel.location || ""}</p>
        </div>
        <div class="vc-arrow">
          <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M5 12h14M13 6l6 6-6 6"/>
          </svg>
        </div>
        <div class="vc-stop r">
          <div class="vc-label">Room</div>
          <h3>${b.roomNumber ? "Room " + b.roomNumber : "—"}</h3>
          <p>${b.roomType || ""}</p>
        </div>
      </div>
      <div class="voucher-dash"></div>
      <div class="voucher-table">
        <div class="vc-cell"><div class="vc-label">Check-in</div><span class="vc-value">${fmtDate(b.checkIn)}</span></div>
        <div class="vc-cell"><div class="vc-label">Check-out</div><span class="vc-value">${fmtDate(b.checkOut)}</span></div>
        <div class="vc-cell"><div class="vc-label">Nights</div><span class="vc-value">${nights}</span></div>
        <div class="vc-cell"><div class="vc-label">Guests</div><span class="vc-value">${b.guests}</span></div>
      </div>
      <div class="voucher-foot">
        <div class="voucher-total">Total paid<b>${inr(b.totalAmount)}</b></div>
        <span class="status-badge status-confirmed">Confirmed</span>
      </div>
    </div>`;
}

// ---------- booking history ----------
function maybeLoadHistory() {
  if (!localStorage.getItem(TOKEN_KEY)) {
    showView("auth");
    toast("Sign in to see your bookings.", "info");
    return;
  }
  loadHistory();
}

$("#btnLoadHistory").addEventListener("click", loadHistory);

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
    <div class="stat"><div class="stat-num">${bookings.length}</div><div class="stat-label">Total bookings</div></div>
    <div class="stat"><div class="stat-num">${confirmed.length}</div><div class="stat-label">Active stays</div></div>
    <div class="stat"><div class="stat-num">${nights}</div><div class="stat-label">Nights booked</div></div>
    <div class="stat"><div class="stat-num">${inr(spent)}</div><div class="stat-label">Total spent</div></div>`;
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
        <p class="history-meta" style="margin-top:4px">Booking ${b.id}</p>
      </div>
      <div class="history-side">
        <div class="history-price">
          <div class="price" style="font-size:17px">${inr(b.totalAmount)}</div>
          <span class="status-badge ${badgeClass}" style="margin-top:6px;display:inline-block">${b.status}</span>
        </div>
        ${!cancelled ? `<button class="cancel-btn" data-cancel="${b.id}">Cancel booking</button>` : ""}
      </div>`;

    const cancelBtn = item.querySelector(".cancel-btn");
    if (cancelBtn) {
      cancelBtn.addEventListener("click", (ev) => {
        ev.stopPropagation();
        pendingCancel = b.id;
        openModal("Cancel this booking?", `Booking ${b.id} will be cancelled and Room ${b.roomNumber} will be freed up.`);
      });
    }

    if (!cancelled) {
      attachFeedback(item, b);
    }
    list.appendChild(item);
  });
}

// star-rating widget for confirmed bookings (feeds the admin's feedback norms)
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
$("#btnGoHistory").addEventListener("click", () => showView("history"));

// ---------- initial load ----------
showView("search");