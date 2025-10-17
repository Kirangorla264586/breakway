const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// --- In-Memory Database (for demonstration) ---
// In a real application, you would use a database like MongoDB or PostgreSQL.
const db = {
    users: [
        // Add a default admin user for testing
        {
            id: 'U-1670000000000',
            name: 'Admin',
            email: 'admin@breakway.com',
            password: 'admin', // In production, ALWAYS hash passwords
            isAdmin: true,
        }
    ],
    orders: [],
    supportTickets: [],
};

// --- Middleware ---
app.use(cors()); // Allow requests from your frontend
app.use(express.json({ limit: '2mb' })); // To parse JSON request bodies, increased limit for profile pics

// A simple middleware to "authenticate" a user.
// In a real app, this would validate a JWT or session token.
const authMiddleware = (req, res, next) => {
    const userId = req.headers['x-user-id'];
    if (!userId) {
        return res.status(401).json({ message: 'Unauthorized: User ID is required.' });
    }
    const user = db.users.find(u => u.id === userId);
    if (!user) {
        return res.status(401).json({ message: 'Unauthorized: User not found.' });
    }
    req.user = user; // Attach user to the request object
    next();
};

// Admin-only middleware
const adminMiddleware = (req, res, next) => {
    if (!req.user || !req.user.isAdmin) {
        return res.status(403).json({ message: 'Forbidden: Admin access required.' });
    }
    next();
};


// --- API Routes ---

// USER ROUTES
app.post('/api/users/register', (req, res) => {
    const { name, contact, password } = req.body;
    if (!name || !contact || !password) {
        return res.status(400).json({ message: 'Please fill all fields.' });
    }

    const isEmail = contact.includes('@');
    if (db.users.some(u => (isEmail ? u.email : u.mobile) === contact)) {
        return res.status(409).json({ message: 'An account with this mobile/email already exists.' });
    }

    const newUser = {
        id: `U-${Date.now()}`,
        name,
        password, // WARNING: Storing plain text passwords. Use bcrypt in production.
        email: isEmail ? contact : null,
        mobile: !isEmail ? contact : null,
        address: '',
        profilePic: '',
        isAdmin: false,
    };
    db.users.push(newUser);
    res.status(201).json({ message: 'Account created successfully!', user: { id: newUser.id, name: newUser.name } });
});

app.post('/api/users/login', (req, res) => {
    const { contact, password } = req.body;
    const user = db.users.find(u => (u.email === contact || u.mobile === contact) && u.password === password);

    if (user) {
        res.json({
            message: 'Login successful!',
            user: { id: user.id, name: user.name, isAdmin: !!user.isAdmin }
        });
    } else {
        res.status(401).json({ message: 'Incorrect mobile number/email or password.' });
    }
});

app.get('/api/users/profile', authMiddleware, (req, res) => {
    // The user object is attached by the authMiddleware
    // Don't send the password back to the client
    const { password, ...userProfile } = req.user;
    res.json(userProfile);
});

app.put('/api/users/profile', authMiddleware, (req, res) => {
    const { name, email, address, profilePic } = req.body;
    const userIndex = db.users.findIndex(u => u.id === req.user.id);

    if (userIndex !== -1) {
        db.users[userIndex] = { ...db.users[userIndex], name, email, address, profilePic };
        res.json({ message: 'Profile updated successfully!', user: db.users[userIndex] });
    } else {
        res.status(404).json({ message: 'User not found.' });
    }
});


// ORDER ROUTES
app.post('/api/orders', authMiddleware, (req, res) => {
    const orderData = { ...req.body, userId: req.user.id, id: `ORD-${Date.now()}`, status: 'placed' };
    db.orders.push(orderData);
    res.status(201).json(orderData);
});

app.get('/api/orders', authMiddleware, (req, res) => {
    const userOrders = db.orders.filter(o => o.userId === req.user.id);
    res.json(userOrders);
});

app.put('/api/orders/:orderId/cancel', authMiddleware, (req, res) => {
    const { orderId } = req.params;
    const orderIndex = db.orders.findIndex(o => o.id === orderId && o.userId === req.user.id);

    if (orderIndex !== -1) {
        if (db.orders[orderIndex].status === 'placed') {
            db.orders[orderIndex].status = 'cancelled';
            res.json(db.orders[orderIndex]);
        } else {
            res.status(400).json({ message: 'Only orders with "placed" status can be cancelled.' });
        }
    } else {
        res.status(404).json({ message: 'Order not found or you do not have permission to cancel it.' });
    }
});


// ADMIN ROUTES
app.get('/api/admin/stats', authMiddleware, adminMiddleware, (req, res) => {
    res.json({
        userCount: db.users.length,
        orderCount: db.orders.length,
    });
});

app.get('/api/admin/users', authMiddleware, adminMiddleware, (req, res) => {
    // Exclude passwords from the response
    const users = db.users.map(({ password, ...user }) => user);
    res.json(users);
});

app.get('/api/admin/orders', authMiddleware, adminMiddleware, (req, res) => {
    res.json(db.orders);
});

// SUPPORT TICKET ROUTES (Simplified)
app.get('/api/support/tickets', authMiddleware, (req, res) => {
    const userTickets = db.supportTickets.filter(t => t.userId === req.user.id);
    res.json(userTickets);
});

app.post('/api/support/tickets', authMiddleware, (req, res) => {
    // This is a simplified example. You would expand this to handle threads.
    const { message } = req.body;
    const newTicket = { id: `T-${Date.now()}`, userId: req.user.id, name: req.user.name, message, status: 'open', createdAt: new Date().toISOString(), thread: [{ from: 'customer', text: message, at: new Date().toISOString() }] };
    db.supportTickets.push(newTicket);
    res.status(201).json(newTicket);
});


// --- Start Server ---
app.listen(PORT, () => {
    console.log(`🔥 Breakway Gas backend server running on http://localhost:${PORT}`);
});