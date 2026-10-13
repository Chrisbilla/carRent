```javascript
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const mysql = require("mysql2/promise");
const bcrypt = require("bcryptjs");

const app = express();

app.use(cors());
app.use(express.json());

// MySQL connection pool
const pool = mysql.createPool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 5
});

// Health check
app.get("/", function (req, res) {
    res.json({
        success: true,
        message: "CarRent cloud backend is running"
    });
});

// Get cars
app.get("/api/cars", async function (req, res) {
    try {
        const [cars] = await pool.query(
            "SELECT id, car_name, is_available FROM cars"
        );

        res.json(cars);
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
        const { fullName, email, phone, password } = req.body;

        if (!fullName || !email || !phone || !password) {
            return res.status(400).json({
                success: false,
                message: "Please fill in all required fields"
            });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        await pool.execute(
            `INSERT INTO users
            (full_name, email, phone, password)
            VALUES (?, ?, ?, ?)`,
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
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: "Email and password are required"
            });
        }

        const [users] = await pool.execute(
            `SELECT id, full_name, email, phone, password
             FROM users WHERE email = ?`,
            [email]
        );

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
        const {
            fullName,
            email,
            phone,
            pickupLocation,
            car,
            rentalType,
            pickupDate,
            pickupTime,
            returnDate,
            returnTime,
            duration,
            rate,
            totalRent
        } = req.body;

        if (
            !fullName ||
            !email ||
            !phone ||
            !pickupLocation ||
            !car ||
            !rentalType ||
            !pickupDate ||
            duration == null ||
            rate == null ||
            totalRent == null
        ) {
            return res.status(400).json({
                success: false,
                message: "Missing booking details"
            });
        }

        const [result] = await pool.execute(
            `INSERT INTO bookings
            (
                full_name, email, phone, car, rental_type,
                pickup_date, pickup_time, return_date, return_time,
                duration, rate, pickup_location, total_rent
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                fullName,
                email,
                phone,
                car,
                rentalType,
                pickupDate,
                pickupTime || null,
                returnDate || null,
                returnTime || null,
                duration,
                rate,
                pickupLocation,
                totalRent
            ]
        );

        res.status(201).json({
            success: true,
            bookingId: result.insertId,
            totalRent,
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
        const { email } = req.query;

        if (!email) {
            return res.status(400).json({
                success: false,
                message: "Email is required"
            });
        }

        const [bookings] = await pool.execute(
            "SELECT * FROM bookings WHERE email = ? ORDER BY id DESC",
            [email]
        );

        res.json(bookings);
    } catch (error) {
        console.error("History error:", error.message);

        res.status(500).json({
            success: false,
            message: "Could not load booking history"
        });
    }
});

// Confirm booking
// Frontend should send POST /api/bookings/:id/confirm
app.post("/api/bookings/:id/confirm", async function (req, res) {
    const bookingId = req.params.id;

    if (!/^\d+$/.test(bookingId) || Number(bookingId) < 1) {
        return res.status(400).json({
            success: false,
            message: "Invalid booking ID"
        });
    }

    let connection;

    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();

        const [bookings] = await connection.execute(
            "SELECT id, booking_status FROM bookings WHERE id = ? FOR UPDATE",
            [bookingId]
        );

        if (bookings.length === 0) {
            await connection.rollback();

            return res.status(404).json({
                success: false,
                message: "Booking not found. Please create a new booking."
            });
        }

        await connection.execute(
            `UPDATE bookings
             SET booking_status = 'Confirmed',
                 payment_status = 'Pending'
             WHERE id = ?`,
            [bookingId]
        );

        await connection.commit();

        return res.json({
            success: true,
            bookingId: Number(bookingId),
            bookingStatus: "Confirmed",
            paymentStatus: "Pending",
            message: "Booking confirmed successfully"
        });
    } catch (error) {
        if (connection) {
            await connection.rollback();
        }

        console.error("Confirmation error:", error.message);

        return res.status(500).json({
            success: false,
            message: "Could not confirm booking"
        });
    } finally {
        if (connection) {
            connection.release();
        }
    }
});

// Unknown API routes
app.use("/api", function (req, res) {
    res.status(404).json({
        success: false,
        message: `API route not found: ${req.method} ${req.originalUrl}`
    });
});

// Start server after database connection succeeds
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
```
