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
const router = express.Router();

// MongoDB Connection
async function connectDB() {
    try {
        await mongoose.connect(process.env.MongoDB_URL);
        console.log("[server] : Connected to MongoDB");
    } catch (err) {
        console.error("[server] : Error connecting to MongoDB", err);
        process.exit(1);
    }
}

// Models
const UserSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true },
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

// Middleware
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
router.post('/register', async (req, res) => {
    try {
        const { email, password } = req.body;
        const existingUser = await User.findOne({ email });
        if (existingUser) return res.status(400).json({ message: 'Email already exists' });

        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = await User.create({ email, password: hashedPassword });
        const token = jwt.sign({ id: newUser._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
        res.status(201).json({ token });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Error registering user" });
    }
});

router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email });
        if (!user) return res.status(404).json({ message: 'User not found' });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ message: 'Invalid credentials' });

        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
        res.json({ token });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Error logging in" });
    }
});

router.get('/projects', authMiddleware, async (req, res) => {
    try {
        const projects = await Project.find({ user: req.user._id }).select('-__v');
        res.json(projects);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Error fetching projects" });
    }
});

router.post('/projects', authMiddleware, async (req, res) => {
    try {
        const { name } = req.body;
        const newProject = await Project.create({ name, user: req.user._id });
        res.status(201).json(newProject);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Error creating project" });
    }
});

router.get('/todos/:projectId', authMiddleware, async (req, res) => {
    try {
        const todos = await Todo.find({ 
            project: req.params.projectId, 
            user: req.user._id 
        }).select('-__v');
        res.json(todos);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Error fetching todos" });
    }
});

router.post('/todos/:projectId', authMiddleware, async (req, res) => {
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

router.patch('/todos/:id', authMiddleware, async (req, res) => {
    try {
        const todoId = req.params.id;
        if (!mongoose.Types.ObjectId.isValid(todoId)) {
            return res.status(400).json({ message: "Invalid todo ID" });
        }

        const updatedTodo = await Todo.findByIdAndUpdate(todoId, req.body, {
            new: true,
            runValidators: true,
        });

        if (!updatedTodo) return res.status(404).json({ message: "Todo not found" });
        res.json({ message: "Todo updated", updatedTodo });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Error updating todo" });
    }
});

// Mount router
app.use('/api', router);

// Start server
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
    connectDB();
});