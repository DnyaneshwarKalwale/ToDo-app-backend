const mongoose = require("mongoose");

// { id: 'task-1', title: 'Brainstorming', status: 'todo', priority: 'Low', description: 'Brainstorming brings team members diverse experience into play.' },

const todo = mongoose.Schema({
    no: {type: String, required: true},
    title: {type: String, required: true},
    status: {type: String, required: true},
    priority: {type: String, required: true},
    description: {type: String}
});
const Todo = mongoose.model('Todo', todo);
module.exports = Todo;
