const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const port = process.env.PORT || 8000;

// MongoDB Connection
async function connectDB() {
    try {
        await mongoose.connect(process.env.MongoDB_URL); // No deprecated options
        console.log("[server] : Connected to MongoDB");
    } catch (err) {
        console.error("[server] : Error connecting to MongoDB", err);
        process.exit(1); // Exit the process if DB connection fails
    }
}

// Models
const UserSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true }, // Use email instead of username
    password: { type: String, required: true },
});

const ProjectSchema = new mongoose.Schema({
    name: { type: String, required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
});

const TodoSchema = new mongoose.Schema({
    title: { type: String, required: true },
    description: { type: String },
    priority: { type: String, required: true },
    status: { type: String, required: true },
    project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
});

const User = mongoose.model('User', UserSchema);
const Project = mongoose.model('Project', ProjectSchema);
const Todo = mongoose.model('Todo', TodoSchema);

// Middleware to authenticate user
const authMiddleware = async (req, res, next) => {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ message: 'No token, authorization denied' });

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.id);
        if (!user) return res.status(404).json({ message: 'User not found' });

        req.user = user;
        next();
    } catch (err) {
        res.status(401).json({ message: 'Token is not valid' });
    }
};

// Routes

// User Registration with Email and Password
app.post('/register', async (req, res) => {
    try {
        const { email, password } = req.body;

        // Check if email already exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ message: 'Email already exists' });
        }

        // Hash the password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create a new user
        const newUser = await User.create({ email, password: hashedPassword });

        // Generate JWT token
        const token = jwt.sign({ id: newUser._id }, process.env.JWT_SECRET, { expiresIn: '1h' });

        res.status(201).json({ token });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Error registering user" });
    }
});

// User Login with Email and Password
app.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        // Find the user by email
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Compare the password
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        // Generate JWT token
        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });

        res.json({ token });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Error logging in" });
    }
});

// Get all projects for the authenticated user
app.get('/projects', authMiddleware, async (req, res) => {
    try {
        const projects = await Project.find({ user: req.user._id }).select('-__v');
        res.json(projects);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Error fetching projects" });
    }
});

// Create a new project
app.post('/projects', authMiddleware, async (req, res) => {
    try {
        const { name } = req.body;
        const newProject = await Project.create({ name, user: req.user._id });
        res.status(201).json(newProject);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Error creating project" });
    }
});

// Get all todos for a specific project
app.get('/todos/:projectId', authMiddleware, async (req, res) => {
    try {
        const todos = await Todo.find({ project: req.params.projectId, user: req.user._id }).select('-__v');
        res.json(todos);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Error fetching todos" });
    }
});

// Create a new todo in a project
app.post('/todos/:projectId', authMiddleware, async (req, res) => {
    try {
        const { title, description, priority, status } = req.body;
        const newTodo = await Todo.create({ 
            title, 
            description, 
            priority, 
            status, 
            project: req.params.projectId, 
            user: req.user._id 
        });
        res.status(201).json(newTodo);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Error creating todo" });
    }
});

// Delete a todo
app.delete('/todos/:id', authMiddleware, async (req, res) => {
    try {
        const todoId = req.params.id;

        if (!mongoose.Types.ObjectId.isValid(todoId)) {
            return res.status(400).json({ message: "Invalid todo ID" });
        }

        const deletedTodo = await Todo.findByIdAndDelete(todoId);
        if (!deletedTodo) {
            return res.status(404).json({ message: "Todo not found" });
        }

        res.json({ message: "Todo deleted", deletedTodo });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Error deleting todo" });
    }
});

// Update a todo (including status change on drag-and-drop)
app.patch('/todos/:id', authMiddleware, async (req, res) => {
    try {
        const todoId = req.params.id;

        if (!mongoose.Types.ObjectId.isValid(todoId)) {
            return res.status(400).json({ message: "Invalid todo ID" });
        }

        const updatedTodo = await Todo.findByIdAndUpdate(todoId, req.body, {
            new: true,
            runValidators: true,
        });

        if (!updatedTodo) {
            return res.status(404).json({ message: "Todo not found" });
        }

        res.json({ message: "Todo updated", updatedTodo });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Error updating todo" });
    }
});

// Start Server
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
    connectDB();
});




// GET / - Fetch all todos.

// POST /todo_send - Create a new todo.

// DELETE /delete/:id - Delete a todo by ID.

// PATCH /update_todo/:id - Update a todo by ID.