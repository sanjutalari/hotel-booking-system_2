const express = require("express");
const router = express.Router();
const db = require("../models/data");
const { authenticate } = require("../middleware/auth");

router.use(authenticate);

function nightsBetween(checkIn, checkOut) {
  const start = new Date(checkIn);
  const end = new Date(checkOut);
  const diffMs = end - start;
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

// POST /api/bookings   { userId, hotelId, roomId, checkIn, checkOut, guests }
router.post("/", (req, res) => {
  const { hotelId, roomId, checkIn, checkOut, guests } = req.body;
  const userId = req.user.id;

  if (!userId || !hotelId || !roomId || !checkIn || !checkOut || !guests) {
    return res.status(400).json({ error: "Missing required booking fields" });
  }

  const nights = nightsBetween(checkIn, checkOut);
  if (nights <= 0) {
    return res.status(400).json({ error: "Check-out date must be after check-in date" });
  }

  const room = db.rooms.find(r => r.id === roomId && r.hotelId === hotelId);
  if (!room) return res.status(404).json({ error: "Room not found" });
  if (room.status !== "available") {
    return res.status(400).json({ error: "Room is already booked" });
  }

  const totalAmount = nights * room.price;

  const booking = {
    id: db.getNextBookingId(),
    userId,
    hotelId,
    roomId,
    checkIn,
    checkOut,
    guests,
    totalAmount,
    status: "confirmed"
  };

  db.bookings.push(booking);
  room.status = "booked"; // update Room model status

  res.status(201).json(booking);
});

// PUT /api/bookings/:id/cancel
router.put("/:id/cancel", (req, res) => {
  const booking = db.bookings.find(b => b.id === req.params.id);
  if (!booking || booking.userId !== req.user.id) return res.status(404).json({ error: "Booking not found" });

  booking.status = "cancelled";

  const room = db.rooms.find(r => r.id === booking.roomId);
  if (room) room.status = "available"; // free up the room again

  res.json(booking);
});

// POST /api/bookings/:id/feedback  { score: 1..5 }
router.post("/:id/feedback", (req, res) => {
  const booking = db.bookings.find((b) => b.id === req.params.id);
  if (!booking || booking.userId !== req.user.id) return res.status(404).json({ error: "Booking not found" });
  const score = Number(req.body.score);
  if (!score || score < 1 || score > 5) {
    return res.status(400).json({ error: "Feedback score must be between 1 and 5" });
  }
  booking.feedback = score;
  res.json(booking);
});

// GET /api/bookings/:userId  -> booking history for a user
// Joins the related Hotel + Room so the frontend can show names without extra calls.
router.get("/me", (req, res) => {
  const history = db.bookings
    .filter((b) => b.userId === req.user.id)
    .map((b) => {
      const hotel = db.hotels.find((h) => h.id === b.hotelId);
      const room = db.rooms.find((r) => r.id === b.roomId);
      return {
        ...b,
        hotelName: hotel ? hotel.name : "Hotel",
        hotelLocation: hotel ? hotel.location : "",
        roomNumber: room ? room.roomNumber : "",
        roomType: room ? room.roomType : ""
      };
    });
  res.json(history);
});

module.exports = router;
