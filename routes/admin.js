const express = require("express");
const router = express.Router();
const db = require("../models/data");
const { authenticate, requireAdmin } = require("../middleware/auth");

router.use(authenticate, requireAdmin);

const DEFAULT_BED_IMAGE = "https://images.unsplash.com/photo-1611892440504-42a792e24d32?w=800";
const DEFAULT_BATH_IMAGE = "https://images.unsplash.com/photo-1584622650111-993a426fbf0a?w=800";

// A hotel is "candidate eligible" when it passes the 3 norms:
// hygiene + customer service pass, and guest feedback averages 3.5+.
function checkEligibility(record) {
  if (!record) return false;
  const hygiene = record.hygiene === "pass";
  const service = record.service === "pass";
  const feedback = (record.feedbackScore || 0) >= 3.5;
  return hygiene && service && feedback;
}

// GET /api/admin/hotels
router.get("/hotels", (req, res) => {
  const result = db.hotels.map((h) => {
    const hotelRooms = db.rooms.filter((r) => r.hotelId === h.id);
    const hotelBookings = db.bookings.filter((b) => b.hotelId === h.id);
    const ratings = hotelBookings.filter((b) => b.feedback);
    const feedbackAvg = ratings.length
      ? (ratings.reduce((s, b) => s + b.feedback, 0) / ratings.length).toFixed(1)
      : null;
    const inspection = db.inspections[h.id] || null;
    return {
      ...h,
      totalRooms: hotelRooms.length,
      availableRooms: hotelRooms.filter((r) => r.status === "available").length,
      confirmedBookings: hotelBookings.filter((b) => b.status === "confirmed").length,
      feedbackCount: ratings.length,
      feedbackAvg,
      inspection
    };
  });
  res.json(result);
});

// POST /api/admin/hotels   { name, location, price, image, rating, amenities[] }
router.post("/hotels", (req, res) => {
  const { name, location, price, image, rating, amenities } = req.body;
  if (!name || !location || !image || !price || !rating) {
    return res.status(400).json({ error: "Name, location, price, rating and image are required" });
  }
  const hotel = {
    id: db.getNextHotelId(),
    name,
    location,
    price: Number(price),
    image,
    rating: Number(rating),
    amenities: Array.isArray(amenities) ? amenities : []
  };
  db.hotels.push(hotel);
  res.status(201).json(hotel);
});

// DELETE /api/admin/hotels/:id
router.delete("/hotels/:id", (req, res) => {
  const index = db.hotels.findIndex((h) => h.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: "Hotel not found" });
  const [removed] = db.hotels.splice(index, 1);

  const beforeRooms = db.rooms.length;
  const beforeBookings = db.bookings.length;
  db.rooms = db.rooms.filter((r) => r.hotelId !== removed.id);
  db.bookings = db.bookings.filter((b) => b.hotelId !== removed.id);
  delete db.inspections[removed.id];

  res.json({
    removed: removed.id,
    roomsRemoved: beforeRooms - db.rooms.length,
    bookingsRemoved: beforeBookings - db.bookings.length
  });
});

// POST /api/admin/hotels/:id/inspect
// { hygiene: "pass"|"fail", service: "pass"|"fail", feedbackScore: 1..5, note }
router.post("/hotels/:id/inspect", (req, res) => {
  const hotel = db.hotels.find((h) => h.id === req.params.id);
  if (!hotel) return res.status(404).json({ error: "Hotel not found" });

  const { hygiene, service, feedbackScore, note } = req.body;
  if (!["pass", "fail"].includes(hygiene) || !["pass", "fail"].includes(service)) {
    return res.status(400).json({ error: "Hygiene and service must be pass or fail" });
  }
  const score = Number(feedbackScore);
  if (score < 1 || score > 5) {
    return res.status(400).json({ error: "Feedback score must be between 1 and 5" });
  }

  const record = { hygiene, service, feedbackScore: score, note: note || "", date: new Date().toISOString() };
  record.eligible = checkEligibility(record);
  db.inspections[hotel.id] = record;
  res.json({ hotelId: hotel.id, ...record });
});

// GET /api/admin/hotels/:id/rooms
router.get("/hotels/:id/rooms", (req, res) => {
  const hotel = db.hotels.find((h) => h.id === req.params.id);
  if (!hotel) return res.status(404).json({ error: "Hotel not found" });
  res.json(db.rooms.filter((r) => r.hotelId === hotel.id));
});

// POST /api/admin/hotels/:id/rooms  add a room to a hotel
router.post("/hotels/:id/rooms", (req, res) => {
  const hotel = db.hotels.find((h) => h.id === req.params.id);
  if (!hotel) return res.status(404).json({ error: "Hotel not found" });

  const { roomNumber, roomType, price, hasBalcony, bedImage, bathImage, balconyImage, ambience } = req.body;
  if (!roomNumber || !roomType || !price) {
    return res.status(400).json({ error: "Room number, type and price are required" });
  }
  const room = {
    id: db.getNextRoomId(),
    hotelId: hotel.id,
    roomNumber: String(roomNumber),
    roomType,
    price: Number(price),
    status: "available",
    bedImage: bedImage || DEFAULT_BED_IMAGE,
    bathImage: bathImage || DEFAULT_BATH_IMAGE,
    balconyImage: hasBalcony ? balconyImage || null : null,
    hasBalcony: !!hasBalcony,
    ambience: Array.isArray(ambience) ? ambience : []
  };
  db.rooms.push(room);
  res.status(201).json(room);
});

// PUT /api/admin/rooms/:roomId — update a room (photos, balcony, type/price)
router.put("/rooms/:roomId", (req, res) => {
  const room = db.rooms.find((r) => r.id === req.params.roomId);
  if (!room) return res.status(404).json({ error: "Room not found" });

  const { roomNumber, roomType, price, bedImage, bathImage, balconyImage, hasBalcony, ambience } = req.body;
  if (roomNumber !== undefined) room.roomNumber = String(roomNumber);
  if (roomType !== undefined) room.roomType = roomType;
  if (price !== undefined) room.price = Number(price);
  if (Array.isArray(ambience)) room.ambience = ambience;
  if (bedImage) room.bedImage = bedImage;
  if (bathImage) room.bathImage = bathImage;
  if (typeof hasBalcony === "boolean") room.hasBalcony = hasBalcony;

  if (room.hasBalcony) {
    if (balconyImage) room.balconyImage = balconyImage;
  } else {
    room.balconyImage = null;
  }

  res.json(room);
});

// DELETE /api/admin/rooms/:roomId
router.delete("/rooms/:roomId", (req, res) => {
  const room = db.rooms.find((r) => r.id === req.params.roomId);
  if (!room) return res.status(404).json({ error: "Room not found" });

  const active = db.bookings.some((b) => b.roomId === room.id && b.status === "confirmed");
  if (active) {
    return res.status(400).json({ error: "Room has an active booking — cancel it first" });
  }

  db.rooms = db.rooms.filter((r) => r.id !== room.id);
  res.json({ removed: room.id });
});

// GET /api/admin/bookings  -> every booking, joined with hotel/room + feedback
router.get("/bookings", (req, res) => {
  const all = db.bookings
    .map((b) => {
      const hotel = db.hotels.find((h) => h.id === b.hotelId);
      const room = db.rooms.find((r) => r.id === b.roomId);
      return {
        ...b,
        hotelName: hotel ? hotel.name : "Removed hotel",
        roomNumber: room ? room.roomNumber : "—",
        roomType: room ? room.roomType : "—"
      };
    })
    .slice()
    .reverse();
  res.json(all);
});

module.exports = router;