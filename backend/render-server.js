
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const mysql = require("mysql2/promise");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const nodemailer = require("nodemailer");

const app = express();

app.use(cors());
app.use(express.json({ limit: "1mb" }));

const pool = mysql.createPool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 5
});

// Gmail email transporter
const mailer = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD
    }
});

// Validate database IDs
function validId(id) {
    return /^\d+$/.test(String(id)) && Number(id) > 0;
}

// Safely escape user-provided text in HTML emails
function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[char]);
}

// Admin API key protection
function requireAdmin(req, res, next) {
    const expectedKey = process.env.ADMIN_API_KEY;
    const suppliedKey = req.get("x-admin-key");

    if (!expectedKey) {
        return res.status(503).json({
            success: false,
            message: "Admin access is not configured on the server."
        });
    }

    if (!suppliedKey) {
        return res.status(401).json({
            success: false,
            message: "Admin API key is required."
        });
    }

    const expected = Buffer.from(expectedKey);
    const supplied = Buffer.from(suppliedKey);

    if (
        expected.length !== supplied.length ||
        !crypto.timingSafeEqual(expected, supplied)
    ) {
        return res.status(401).json({
            success: false,
            message: "Invalid admin API key."
        });
    }

    next();
}

// Health check
app.get("/", (req, res) => {
    res.json({
        success: true,
        message: "CarRent cloud backend is running"
    });
});

// Get cars
app.get("/api/cars", async (req, res) => {
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

// Register user
app.post("/api/register", async (req, res) => {
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
            [
                fullName.trim(),
                email.trim(),
                phone.trim(),
                hashedPassword
            ]
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

// Login user
app.post("/api/login", async (req, res) => {
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
             FROM users
             WHERE email = ?`,
            [email.trim()]
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
app.post("/api/bookings", async (req, res) => {
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

        if (
            !Number.isFinite(Number(duration)) ||
            !Number.isFinite(Number(rate)) ||
            !Number.isFinite(Number(totalRent)) ||
            Number(duration) <= 0 ||
            Number(rate) < 0 ||
            Number(totalRent) < 0
        ) {
            return res.status(400).json({
                success: false,
                message: "Invalid booking amount or duration"
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
app.get("/api/bookings/history", async (req, res) => {
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

// Confirm booking and send confirmation email
app.post("/api/bookings/:id/confirm", async (req, res) => {
    const bookingId = req.params.id;

    if (!validId(bookingId)) {
        return res.status(400).json({
            success: false,
            message: "Invalid booking ID"
        });
    }

    let connection;
    let transactionStarted = false;
    let booking;

    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();
        transactionStarted = true;

        const [rows] = await connection.execute(
            `SELECT id, full_name, email, car, pickup_date,
                    pickup_time, return_date, return_time,
                    total_rent, booking_status
             FROM bookings
             WHERE id = ?
             FOR UPDATE`,
            [bookingId]
        );

        if (rows.length === 0) {
            await connection.rollback();
            transactionStarted = false;

            return res.status(404).json({
                success: false,
                message: "Booking not found"
            });
        }

        booking = rows[0];

        // Avoid sending duplicate confirmation emails on repeated requests.
        const alreadyConfirmed =
            String(booking.booking_status).toLowerCase() === "confirmed";

        if (!alreadyConfirmed) {
            await connection.execute(
                `UPDATE bookings
                 SET booking_status = 'Confirmed',
                     payment_status = 'Pending'
                 WHERE id = ?`,
                [bookingId]
            );
        }

        await connection.commit();
        transactionStarted = false;
    } catch (error) {
        if (connection && transactionStarted) {
            await connection.rollback();
        }

        console.error("Confirmation error:", error.message);

        return res.status(500).json({
            success: false,
            message: "Could not confirm booking"
        });
    } finally {
        if (connection) connection.release();
    }

    // If this booking was already confirmed, do not resend the email.
    if (String(booking.booking_status).toLowerCase() === "confirmed") {
        return res.json({
            success: true,
            bookingId: Number(bookingId),
            bookingStatus: "Confirmed",
            paymentStatus: "Pending",
            emailSent: false,
            message: "Booking was already confirmed."
        });
    }

    let emailSent = false;

    try {
        if (
            !process.env.GMAIL_USER ||
            !process.env.GMAIL_APP_PASSWORD
        ) {
            throw new Error("Gmail environment variables are missing");
        }

        const details = [
            `Booking ID: ${booking.id}`,
            `Car: ${booking.car}`,
            `Pickup date: ${booking.pickup_date}`,
            `Pickup time: ${booking.pickup_time || "Not specified"}`,
            `Return date: ${booking.return_date || "Not specified"}`,
            `Return time: ${booking.return_time || "Not specified"}`,
            `Total rent: ${booking.total_rent}`,
            "Booking status: Confirmed",
            "Payment status: Pending"
        ];

        const htmlRows = [
            ["Booking ID", booking.id],
            ["Car", booking.car],
            ["Pickup date", booking.pickup_date],
            ["Pickup time", booking.pickup_time || "Not specified"],
            ["Return date", booking.return_date || "Not specified"],
            ["Return time", booking.return_time || "Not specified"],
            ["Total rent", booking.total_rent],
            ["Booking status", "Confirmed"],
            ["Payment status", "Pending"]
        ].map(([label, value]) => `
            <tr>
                <td style="padding:9px;border:1px solid #ddd;font-weight:bold">
                    ${escapeHtml(label)}
                </td>
                <td style="padding:9px;border:1px solid #ddd">
                    ${escapeHtml(value)}
                </td>
            </tr>
        `).join("");

        await mailer.sendMail({
            from: `"CarRent" <${process.env.GMAIL_USER}>`,
            to: booking.email,
            subject: `CarRent Booking Confirmation #${booking.id}`,
            text: [
                `Hello ${booking.full_name},`,
                "",
                "Your car booking has been confirmed!",
                "",
                ...details,
                "",
                "Thank you for choosing CarRent!"
            ].join("\n"),
            html: `
                <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:24px;color:#222">
                    <h2 style="color:#2563eb">CarRent</h2>
                    <h3>Booking Confirmed!</h3>
                    <p>Hello ${escapeHtml(booking.full_name)},</p>
                    <p>Your car booking has been confirmed successfully.</p>
                    <table style="border-collapse:collapse;width:100%">
                        ${htmlRows}
                    </table>
                    <p style="margin-top:24px">Thank you for choosing CarRent!</p>
                </div>
            `
        });

        emailSent = true;
        console.log("Booking confirmation email sent for booking:", booking.id);
    } catch (error) {
        console.error("Booking email error:", error.message);
    }

    return res.json({
        success: true,
        bookingId: Number(bookingId),
        bookingStatus: "Confirmed",
        paymentStatus: "Pending",
        emailSent,
        message: emailSent
            ? "Booking confirmed and email sent."
            : "Booking confirmed, but confirmation email could not be sent."
    });
});

// All routes below require the admin API key
app.use("/api/admin", requireAdmin);

// Admin: Get all bookings
app.get("/api/admin/bookings", async (req, res) => {
    try {
        const [rows] = await pool.query(
            `SELECT id, full_name, email, phone, car, rental_type,
                    pickup_date, pickup_time, return_date, return_time,
                    duration, rate, pickup_location, total_rent,
                    payment_status, booking_status
             FROM bookings
             ORDER BY id DESC`
        );

        res.json(rows);
    } catch (error) {
        console.error("Admin bookings error:", error.message);

        res.status(500).json({
            success: false,
            message: "Could not load admin bookings"
        });
    }
});

// Admin: Get all users (never return passwords)
app.get("/api/admin/users", async (req, res) => {
    try {
        const [rows] = await pool.query(
            `SELECT id, full_name, email, phone
             FROM users
             ORDER BY id DESC`
        );

        res.json(rows);
    } catch (error) {
        console.error("Admin users error:", error.message);

        res.status(500).json({
            success: false,
            message: "Could not load users"
        });
    }
});

// Admin: Get all cars
app.get("/api/admin/cars", async (req, res) => {
    try {
        const [rows] = await pool.query(
            `SELECT id, car_name, is_available
             FROM cars
             ORDER BY id`
        );

        res.json(rows);
    } catch (error) {
        console.error("Admin cars error:", error.message);

        res.status(500).json({
            success: false,
            message: "Could not load admin cars"
        });
    }
});

// Admin: Update car availability
app.put("/api/admin/cars/:id/availability", async (req, res) => {
    const carId = req.params.id;
    const value = req.body.is_available;

    if (!validId(carId)) {
        return res.status(400).json({
            success: false,
            message: "Invalid car ID"
        });
    }

    if (typeof value !== "boolean") {
        return res.status(400).json({
            success: false,
            message: "is_available must be true or false"
        });
    }

    try {
        const [result] = await pool.execute(
            "UPDATE cars SET is_available = ? WHERE id = ?",
            [value ? 1 : 0, carId]
        );

        if (result.affectedRows === 0) {
            const [rows] = await pool.execute(
                "SELECT id FROM cars WHERE id = ?",
                [carId]
            );

            if (rows.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: "Car not found"
                });
            }
        }

        res.json({
            success: true,
            message: "Car availability updated successfully"
        });
    } catch (error) {
        console.error("Admin car update error:", error.message);

        res.status(500).json({
            success: false,
            message: "Could not update car availability"
        });
    }
});

// Admin: Update booking status
app.put("/api/admin/bookings/:id/status", async (req, res) => {
    const bookingId = req.params.id;
    const { bookingStatus } = req.body;

    if (!validId(bookingId)) {
        return res.status(400).json({
            success: false,
            message: "Invalid booking ID"
        });
    }

    if (!["Confirmed", "Cancelled", "Pending"].includes(bookingStatus)) {
        return res.status(400).json({
            success: false,
            message: "Invalid booking status"
        });
    }

    try {
        const [result] = await pool.execute(
            "UPDATE bookings SET booking_status = ? WHERE id = ?",
            [bookingStatus, bookingId]
        );

        if (result.affectedRows === 0) {
            const [rows] = await pool.execute(
                "SELECT id FROM bookings WHERE id = ?",
                [bookingId]
            );

            if (rows.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: "Booking not found"
                });
            }
        }

        res.json({
            success: true,
            message: "Booking status updated to " + bookingStatus
        });
    } catch (error) {
        console.error("Admin booking status error:", error.message);

        res.status(500).json({
            success: false,
            message: "Could not update booking status"
        });
    }
});

// Admin: Update payment status
app.put("/api/admin/bookings/:id/payment", async (req, res) => {
    const bookingId = req.params.id;
    const { paymentStatus } = req.body;

    if (!validId(bookingId)) {
        return res.status(400).json({
            success: false,
            message: "Invalid booking ID"
        });
    }

    if (!["Paid", "Pending"].includes(paymentStatus)) {
        return res.status(400).json({
            success: false,
            message: "Payment status must be Paid or Pending"
        });
    }

    try {
        const [result] = await pool.execute(
            "UPDATE bookings SET payment_status = ? WHERE id = ?",
            [paymentStatus, bookingId]
        );

        if (result.affectedRows === 0) {
            const [rows] = await pool.execute(
                "SELECT id FROM bookings WHERE id = ?",
                [bookingId]
            );

            if (rows.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: "Booking not found"
                });
            }
        }

        res.json({
            success: true,
            message: "Payment status updated to " + paymentStatus,
            note: "This status change does not process a real payment."
        });
    } catch (error) {
        console.error("Admin payment update error:", error.message);

        res.status(500).json({
            success: false,
            message: "Could not update payment status"
        });
    }
});

// Admin: Delete user only if they have no booking history
app.delete("/api/admin/users/:id", async (req, res) => {
    const userId = req.params.id;

    if (!validId(userId)) {
        return res.status(400).json({
            success: false,
            message: "Invalid user ID"
        });
    }

    try {
        const [users] = await pool.execute(
            "SELECT id, email FROM users WHERE id = ?",
            [userId]
        );

        if (users.length === 0) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        const [bookings] = await pool.execute(
            "SELECT id FROM bookings WHERE email = ? LIMIT 1",
            [users[0].email]
        );

        if (bookings.length > 0) {
            return res.status(409).json({
                success: false,
                message: "This user has booking history and cannot be deleted."
            });
        }

        await pool.execute(
            "DELETE FROM users WHERE id = ?",
            [userId]
        );

        res.json({
            success: true,
            message: "User deleted successfully"
        });
    } catch (error) {
        console.error("Admin user delete error:", error.message);

        res.status(500).json({
            success: false,
            message: "Could not delete user"
        });
    }
});

// Unknown API routes
app.use("/api", (req, res) => {
    res.status(404).json({
        success: false,
        message: `API route not found: ${req.method} ${req.originalUrl}`
    });
});

// Start server after database connection succeeds
async function startServer() {
    let connection;

    try {
        connection = await pool.getConnection();
        await connection.ping();
        connection.release();
        connection = null;

        console.log("MySQL database connected successfully");

        const PORT = process.env.PORT || 5000;

        app.listen(PORT, "0.0.0.0", () => {
            console.log("CarRent backend running on port " + PORT);
        });
    } catch (error) {
        if (connection) connection.release();

        console.error("Database connection failed:", error.message);
        process.exit(1);
    }
}

startServer();