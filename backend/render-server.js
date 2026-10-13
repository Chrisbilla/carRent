
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const mysql = require("mysql2/promise");
const bcrypt = require("bcryptjs");

const app = express();

app.use(cors());
app.use(express.json());

const pool = mysql.createPool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 5
});

// Home / health check
app.get("/", function (req, res) {
    res.json({
        success: true,
        message: "CarRent cloud backend is running"
    });
});

// Get cars
app.get("/api/cars", async function (req, res) {
    try {
        const result = await pool.query(
            "SELECT id, car_name, is_available FROM cars"
        );
        res.json(result[0]);
    } catch (error) {
        console.error("Cars error:", error.message);
        res.status(500).json({
            success: false,
            message: "Could not load cars"
        });
    }
});

// Register
app.post("/api/register", async function (req, res) {
    try {
        const fullName = req.body.fullName;
        const email = req.body.email;
        const phone = req.body.phone;
        const password = req.body.password;

        if (!fullName || !email || !phone || !password) {
            return res.status(400).json({
                success: false,
                message: "Please fill in all required fields"
            });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        await pool.execute(
            "INSERT INTO users (full_name, email, phone, password) VALUES (?, ?, ?, ?)",
            [fullName, email, phone, hashedPassword]
        );

        res.status(201).json({
            success: true,
            message: "Registration successful"
        });
    } catch (error) {
        console.error("Register error:", error.message);
        res.status(500).json({
            success: false,
            message: "Registration failed. Email may already be registered."
        });
    }
});

// Login
app.post("/api/login", async function (req, res) {
    try {
        const email = req.body.email;
        const password = req.body.password;

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: "Email and password are required"
            });
        }

        const result = await pool.execute(
            "SELECT id, full_name, email, phone, password FROM users WHERE email = ?",
            [email]
        );

        const users = result[0];

        if (users.length === 0) {
            return res.status(401).json({
                success: false,
                message: "Invalid email or password"
            });
        }

        const user = users[0];
        const valid = await bcrypt.compare(password, user.password);

        if (!valid) {
            return res.status(401).json({
                success: false,
                message: "Invalid email or password"
            });
        }

        res.json({
            success: true,
            user: {
                id: user.id,
                fullName: user.full_name,
                email: user.email,
                phone: user.phone
            }
        });
    } catch (error) {
        console.error("Login error:", error.message);
        res.status(500).json({
            success: false,
            message: "Login failed"
        });
    }
});

// Create booking
app.post("/api/bookings", async function (req, res) {
    try {
        const fullName = req.body.fullName;
        const email = req.body.email;
        const phone = req.body.phone;
        const pickupLocation = req.body.pickupLocation;
        const car = req.body.car;
        const rentalType = req.body.rentalType;
        const pickupDate = req.body.pickupDate;
        const pickupTime = req.body.pickupTime || null;
        const returnDate = req.body.returnDate || null;
        const returnTime = req.body.returnTime || null;
        const duration = req.body.duration;
        const rate = req.body.rate;
        const totalRent = req.body.totalRent;

        if (
            !fullName || !email || !phone || !pickupLocation ||
            !car || !rentalType || !pickupDate ||
            duration == null || rate == null || totalRent == null
        ) {
            return res.status(400).json({
                success: false,
                message: "Missing booking details"
            });
        }

        const result = await pool.execute(
            "INSERT INTO bookings (full_name, email, phone, car, rental_type, pickup_date, pickup_time, return_date, return_time, duration, rate, pickup_location, total_rent) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            [
                fullName,
                email,
                phone,
                car,
                rentalType,
                pickupDate,
                pickupTime,
                returnDate,
                returnTime,
                duration,
                rate,
                pickupLocation,
                totalRent
            ]
        );

        res.status(201).json({
            success: true,
            bookingId: result[0].insertId,
            totalRent: totalRent,
            message: "Booking created successfully"
        });
    } catch (error) {
        console.error("Booking error:", error.message);
        res.status(500).json({
            success: false,
            message: "Could not create booking"
        });
    }
});

// Booking history
app.get("/api/bookings/history", async function (req, res) {
    try {
        const email = req.query.email;

        if (!email) {
            return res.status(400).json({
                success: false,
                message: "Email is required"
            });
        }

        const result = await pool.execute(
            "SELECT * FROM bookings WHERE email = ? ORDER BY id DESC",
            [email]
        );

        res.json(result[0]);
    } catch (error) {
        console.error("History error:", error.message);
        res.status(500).json({
            success: false,
            message: "Could not load booking history"
        });
    }
});

// Confirm booking
app.post("/api/bookings/:id/confirm", async function (req, res) {
    try {
        const result = await pool.execute(
            "UPDATE bookings SET payment_status = 'Paid', booking_status = 'Confirmed' WHERE id = ?",
            [req.params.id]
        );

        if (result[0].affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: "Booking not found"
            });
        }

        res.json({
            success: true,
            message: "Booking confirmed"
        });
    } catch (error) {
        console.error("Confirmation error:", error.message);
        res.status(500).json({
            success: false,
            message: "Could not confirm booking"
        });
    }
});

// Start server only after database connection succeeds
async function startServer() {
    try {
        const connection = await pool.getConnection();
        await connection.ping();
        connection.release();

        console.log("MySQL database connected successfully");

        const PORT = process.env.PORT || 5000;

        app.listen(PORT, "0.0.0.0", function () {
            console.log("CarRent backend running on port " + PORT);
        });
    } catch (error) {
        console.error("Database connection failed:", error.message);
        process.exit(1);
    }
}

startServer();

