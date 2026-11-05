/**
 * StayBook admin console. All management requests require an administrator JWT.
 */

const API = "/api/admin";
const ADMIN_TOKEN_KEY = "staybook.adminToken";
const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));
const inr = (n) => "₹" + Number(n || 0).toLocaleString("en-IN");

let currentInspectId = null;
let currentRoomsId = null;

function toast(message, type = "success") {
  const el = document.createElement("div");
  el.className = `toast ${type}`;
  el.textContent = message;
  $("#toastStack").appendChild(el);
  setTimeout(() => {
    el.classList.add("out");
    setTimeout(() => el.remove(), 280);
  }, 3400);
}

function setAdminSignedIn(signedIn) {
  $("#adminLogin").classList.toggle("hidden", signedIn);
  $("#adminDashboard").classList.toggle("hidden", !signedIn);
}

async function api(path, options = {}) {
  const headers = new Headers(options.headers || {});
  const token = localStorage.getItem(ADMIN_TOKEN_KEY);
  if (token) headers.set("Authorization", "Bearer " + token);
  const res = await fetch(API + path, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && path !== "/auth/login") {
    localStorage.removeItem(ADMIN_TOKEN_KEY);
    setAdminSignedIn(false);
  }
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

$("#adminLoginForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = $("#adminLoginSubmit");
  const error = $("#adminLoginError");
  error.classList.add("hidden");
  button.disabled = true;
  button.textContent = "Checking credentials...";
  try {
    const result = await api("/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: $("#adminEmail").value.trim(),
        password: $("#adminPassword").value
      })
    });
    localStorage.setItem(ADMIN_TOKEN_KEY, result.token);
    $("#adminLoginForm").reset();
    setAdminSignedIn(true);
    toast("Signed in to StayBook admin.");
    await loadHotels();
  } catch (err) {
    error.textContent = err.message;
    error.classList.remove("hidden");
  } finally {
    button.disabled = false;
    button.textContent = "Sign in to admin";
  }
});

$("#adminLogout").addEventListener("click", () => {
  localStorage.removeItem(ADMIN_TOKEN_KEY);
  setAdminSignedIn(false);
  $("#adminLoginForm").reset();
  $("#adminEmail").focus();
});

$("#customerSiteLink").href = window.location.port === "3001" ? "http://localhost:3000/" : "/";

// ---------- tabs ----------
$$(".tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    $$(".tab-btn").forEach((b) => b.classList.toggle("active", b === btn));
    $$(".tab-view").forEach((v) => v.classList.toggle("active", v.id === `tab-${btn.dataset.tab}`));
    if (btn.dataset.tab === "hotels") loadHotels();
    if (btn.dataset.tab === "bookings") loadBookings();
  });
});

// ---------- hotels ----------
function normDot(status) {
  return `<span class="dot ${status || "pending"}"></span>`;
}

async function loadHotels() {
  const grid = $("#adminHotels");
  grid.innerHTML = "<p class='muted'>Loading hotels…</p>";
  try {
    const hotels = await api("/hotels");
    renderHotels(hotels);
  } catch (e) {
    toast(e.message, "error");
  }
}

function renderHotels(hotels) {
  const grid = $("#adminHotels");
  $("#hotelsEmpty").classList.toggle("hidden", hotels.length > 0);
  grid.innerHTML = "";

  hotels.forEach((h) => {
    const insp = h.inspection;
    const eligible = !!(insp && insp.eligible);
    const card = document.createElement("article");
    card.className = "a-card";
    card.innerHTML = `
      <div class="a-media">
        <img src="${h.image}" alt="${h.name}">
        <span class="a-rating">★ ${h.rating}</span>
      </div>
      <div class="a-body">
        <h3>${h.name}</h3>
        <p class="a-meta">📍 ${h.location} · ${inr(h.price)}/night · ${h.availableRooms}/${h.totalRooms} rooms free</p>

        <span class="eligibility ${eligible ? "ok" : "warn"}">
          ${eligible ? "✓ Eligible — passes all norms" : "◦ Under review"}
        </span>

        <div class="norm-row">
          <span class="norm">Hygiene &amp; cleanliness ${normDot(insp && insp.hygiene)}</span>
          <span class="norm">Customer service ${normDot(insp && insp.service)}</span>
          <span class="norm">Feedback ${insp ? `★ ${insp.feedbackScore}/5` : "no rating yet"} ${normDot(insp ? "pass" : "pending")}</span>
        </div>

        <div class="a-actions">
          <button class="btn btn-primary btn-sm" data-action="inspect">Inspect</button>
          <button class="btn btn-ghost btn-sm" data-action="rooms">Rooms (${h.totalRooms})</button>
          <button class="btn btn-danger btn-sm" data-action="delete">Delete</button>
        </div>
      </div>`;

    card.querySelector('[data-action="inspect"]').addEventListener("click", () => openInspect(h));
    card.querySelector('[data-action="rooms"]').addEventListener("click", () => openRooms(h));
    card.querySelector('[data-action="delete"]').addEventListener("click", () => deleteHotel(h));
    grid.appendChild(card);
  });
}

// add hotel form
$("#btnToggleAdd").addEventListener("click", () => {
  $("#addHotelForm").classList.toggle("hidden");
});
$("#btnCancelAdd").addEventListener("click", () => {
  $("#addHotelForm").classList.add("hidden");
});
$("#addHotelForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const body = {
    name: $("#hName").value.trim(),
    location: $("#hLocation").value.trim(),
    price: Number($("#hPrice").value),
    rating: Number($("#hRating").value),
    image: $("#hImage").value.trim(),
    amenities: $("#hAmenities").value.split(",").map((s) => s.trim()).filter(Boolean)
  };
  try {
    const hotel = await api("/hotels", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    toast(`Hotel ${hotel.name} (${hotel.id}) added.`);
    $("#addHotelForm").classList.add("hidden");
    $("#addHotelForm").reset();
    loadHotels();
  } catch (err) {
    toast(err.message, "error");
  }
});

async function deleteHotel(hotel) {
  if (!confirm(`Delete ${hotel.name}? Its rooms and bookings will also be removed.`)) return;
  try {
    const r = await api(`/hotels/${hotel.id}`, { method: "DELETE" });
    toast(`${r.removed} removed — ${r.roomsRemoved} rooms, ${r.bookingsRemoved} bookings cleaned up.`);
    loadHotels();
  } catch (err) {
    toast(err.message, "error");
  }
}

// ---------- inspection ----------
function openInspect(hotel) {
  currentInspectId = hotel.id;
  const insp = hotel.inspection || {};
  $("#inspectTitle").textContent = `Inspect — ${hotel.name} (${hotel.id})`;
  $("#iHygiene").value = insp.hygiene || "pass";
  $("#iService").value = insp.service || "pass";
  $("#iFeedback").value = String(insp.feedbackScore || 4);
  $("#iNote").value = insp.note || "";
  $("#inspectEligibility").textContent = insp
    ? `Last inspected ${new Date(insp.date).toLocaleDateString("en-IN")}`
    : "Not inspected yet.";
  $("#inspectPanel").classList.remove("hidden");
  $("#inspectPanel").scrollIntoView({ behavior: "smooth", block: "center" });
}

$("#btnCloseInspect").addEventListener("click", () => $("#inspectPanel").classList.add("hidden"));
$("#btnSaveInspect").addEventListener("click", async () => {
  if (!currentInspectId) return;
  const body = {
    hygiene: $("#iHygiene").value,
    service: $("#iService").value,
    feedbackScore: Number($("#iFeedback").value),
    note: $("#iNote").value.trim()
  };
  try {
    const r = await api(`/hotels/${currentInspectId}/inspect`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    toast(
      r.eligible
        ? `${r.hotelId} now passes all norms — eligible.`
        : `${r.hotelId} inspected but NOT yet eligible.`
    );
    $("#inspectPanel").classList.add("hidden");
    loadHotels();
  } catch (err) {
    toast(err.message, "error");
  }
});

// ---------- rooms management ----------
async function openRooms(hotel) {
  currentRoomsId = hotel.id;
  $("#roomsTitle").textContent = `Rooms — ${hotel.name} (${hotel.id})`;
  $("#roomsPanel").classList.remove("hidden");
  $("#roomsPanel").scrollIntoView({ behavior: "smooth", block: "center" });
  await loadRooms();
}

async function loadRooms() {
  const list = $("#roomsList");
  if (!currentRoomsId) { list.innerHTML = ""; return; }
  const allRooms = await api(`/hotels/${currentRoomsId}/rooms`).catch(() => []);
  if (!allRooms.length) {
    list.innerHTML = "<p class='muted'>No rooms yet — add the first one below.</p>";
    return;
  }
  list.innerHTML = "";
  allRooms.forEach((room) => {
    const el = document.createElement("div");
    el.className = "a-room";
    const pics = `
      <div class="a-room-pics">
        ${room.bedImage ? `<img src="${room.bedImage}" alt="Bedroom">` : `<span class="no-pic">Bed</span>`}
        ${room.bathImage ? `<img src="${room.bathImage}" alt="Bathroom">` : `<span class="no-pic">Bath</span>`}
        ${room.hasBalcony && room.balconyImage ? `<img src="${room.balconyImage}" alt="Balcony">` : `<span class="no-pic">${room.hasBalcony ? "Balcony" : "No balc"}</span>`}
      </div>`;
    el.innerHTML = `
      <div class="a-room-top">
        <span class="a-room-type">${room.roomType}</span>
        <span class="status-badge ${room.status === "available" ? "status-available" : "status-booked"}">${room.status}</span>
      </div>
      <p><b>Room ${room.roomNumber}</b></p>
      <p>${inr(room.price)}/night ${room.hasBalcony ? "· Balcony ✓" : "· No balcony"}</p>
      ${pics}
      <details class="a-room-edit">
        <summary class="btn btn-ghost btn-sm">Add / edit photos</summary>
        <div class="room-img-form">
          <label>Bedroom image URL
            <input type="text" class="in-bed" value="${room.bedImage || ""}" placeholder="https://…"></label>
          <label>Bathroom image URL
            <input type="text" class="in-bath" value="${room.bathImage || ""}" placeholder="https://…"></label>
          <label class="chk"><input type="checkbox" class="in-balc-chk" ${room.hasBalcony ? "checked" : ""}> Has balcony</label>
          <label class="balc-url ${room.hasBalcony ? "" : "hidden"}">Balcony image URL
            <input type="text" class="in-balc" value="${room.balconyImage || ""}" placeholder="https://…"></label>
          <button class="btn btn-primary btn-sm">Save photos</button>
        </div>
      </details>
      <button class="btn btn-danger btn-sm" style="margin-top:8px">Remove</button>`;

    const details = el.querySelector(".a-room-edit");
    const balChk = el.querySelector(".in-balc-chk");
    const balUrlRow = el.querySelector(".balc-url");
    balChk.addEventListener("change", () => balUrlRow.classList.toggle("hidden", !balChk.checked));

    details.querySelector("button").addEventListener("click", async (ev) => {
      ev.preventDefault();
      await saveRoomPhotos(room, el);
    });
    el.querySelector("button.btn-danger").addEventListener("click", () => deleteRoom(room));
    list.appendChild(el);
  });
}

async function saveRoomPhotos(room, card) {
  const body = {
    bedImage: card.querySelector(".in-bed").value.trim(),
    bathImage: card.querySelector(".in-bath").value.trim(),
    hasBalcony: card.querySelector(".in-balc-chk").checked
  };
  const balc = card.querySelector(".in-balc").value.trim();
  if (body.hasBalcony && balc) body.balconyImage = balc;
  try {
    await api(`/rooms/${room.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    toast(`Photos saved for Room ${room.roomNumber}.`);
    loadRooms();
  } catch (err) {
    toast(err.message, "error");
  }
}

$("#btnCloseRooms").addEventListener("click", () => $("#roomsPanel").classList.add("hidden"));

$("#btnAddRoom").addEventListener("click", async () => {
  const roomNumber = $("#rNumber").value.trim();
  const roomType = $("#rType").value.trim();
  const price = Number($("#rPrice").value);
  const hasBalcony = $("#rBalcony").checked;
  if (!roomNumber || !roomType || !price) { toast("Room number, type and price are required.", "error"); return; }
  try {
    await api(`/hotels/${currentRoomsId}/rooms`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roomNumber, roomType, price, hasBalcony, ambience: [] })
    });
    toast(`Room ${roomNumber} added.`);
    $("#addRoomForm").reset();
    loadRooms();
    loadHotels();
  } catch (err) {
    toast(err.message, "error");
  }
});

async function deleteRoom(room) {
  if (!confirm(`Remove Room ${room.roomNumber}?`)) return;
  try {
    await api(`/rooms/${room.id}`, { method: "DELETE" });
    toast(`Room ${room.roomNumber} removed.`);
    loadRooms();
    loadHotels();
  } catch (err) {
    toast(err.message, "error");
  }
}

// ---------- bookings & feedback ----------
async function loadBookings() {
  const body = $("#bookingsBody");
  try {
    const bookings = await api("/bookings");
    $("#bookingsEmpty").classList.toggle("hidden", bookings.length > 0);
    body.innerHTML = "";
    bookings.forEach((b) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td><b>${b.id}</b></td>
        <td>${b.userId}</td>
        <td>${b.hotelName}</td>
        <td>${b.roomType} · ${b.roomNumber}</td>
        <td>${b.checkIn} → ${b.checkOut}</td>
        <td>${inr(b.totalAmount)}</td>
        <td><span class="status-badge ${b.status === "confirmed" ? "status-available" : "status-booked"}">${b.status}</span></td>
        <td class="stars-sm">${b.feedback ? "★".repeat(b.feedback) + "☆".repeat(5 - b.feedback) : "—"}</td>`;
      body.appendChild(tr);
    });
  } catch (e) {
    toast(e.message, "error");
  }
}

// ---------- init ----------
async function initializeAdmin() {
  if (!localStorage.getItem(ADMIN_TOKEN_KEY)) {
    setAdminSignedIn(false);
    return;
  }
  setAdminSignedIn(true);
  try {
    await api("/auth/me");
    await loadHotels();
  } catch {
    localStorage.removeItem(ADMIN_TOKEN_KEY);
    setAdminSignedIn(false);
  }
}

initializeAdmin();