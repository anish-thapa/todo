document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const taskForm = document.getElementById('add-task-form');
    const taskInput = document.getElementById('task-input');
    const priorityInput = document.getElementById('priority-input');
    const dueDateInput = document.getElementById('due-date-input');
    const notesInput = document.getElementById('notes-input');
    const taskList = document.getElementById('task-list');
    const filterStatusSelect = document.getElementById('filter-status');
    const filterPrioritySelect = document.getElementById('filter-priority');
    const clearCompletedBtn = document.getElementById('clear-completed-btn');
    const emptyMessage = document.getElementById('empty-message');
    const notificationArea = document.getElementById('notification-area'); // Notification element

    // Edit Modal Elements
    const editModal = document.getElementById('edit-modal');
    const editTaskIdInput = document.getElementById('edit-task-id');
    const editTaskTextInput = document.getElementById('edit-task-text');
    const editPrioritySelect = document.getElementById('edit-priority');
    const editDueDateInput = document.getElementById('edit-due-date');
    const editNotesText = document.getElementById('edit-notes-text');
    const saveEditBtn = document.getElementById('save-edit-btn');
    const cancelEditBtn = document.getElementById('cancel-edit-btn');

    // --- State ---
    let tasks = loadTasks(); // Load tasks from local storage

    // --- Utility Functions ---

    // Basic HTML escaping to prevent XSS
    function escapeHTML(str) {
        if (str === null || typeof str === 'undefined' || str === '') return '';
        const div = document.createElement('div');
        div.appendChild(document.createTextNode(str));
        return div.innerHTML;
     }

    // Format date for display
    function formatDate(dateString) {
        if (!dateString) return '';
        try {
            // Adding T00:00:00 helps ensure the date isn't affected by local timezone shifts when parsing
            const date = new Date(dateString + 'T00:00:00');
            // Check if date is valid after parsing
             if (isNaN(date.getTime())) {
                console.error("Invalid date string encountered:", dateString);
                return "Invalid Date";
            }
            return date.toLocaleDateString(undefined, { // Use user's locale default format
                year: 'numeric',
                month: 'short', // e.g., Oct
                day: 'numeric',
            });
        } catch (error) {
            console.error("Error formatting date:", dateString, error);
            return "Invalid Date";
        }
    }

     // Function to display notifications
     function showNotification(message, duration = 3000) {
        const notification = document.createElement('div');
        notification.className = 'notification-message';
        // Use innerHTML to allow FontAwesome icon
        notification.innerHTML = `<i class="fas fa-check-circle"></i> ${escapeHTML(message)}`;

        notificationArea.appendChild(notification);

        // Trigger the slide-in animation
        requestAnimationFrame(() => {
            // Adding a micro-delay or second frame ensures transition works on newly added elements
            requestAnimationFrame(() => {
                notification.classList.add('show');
            });
        });

        // Automatic removal timer
        const timerId = setTimeout(() => {
            removeNotification(notification);
        }, duration);

        // Allow clicking to dismiss early
        notification.addEventListener('click', () => {
            clearTimeout(timerId); // Cancel the auto-remove timer
            removeNotification(notification);
        }, { once: true }); // Click listener only runs once
    }

    // Helper to remove notification with animation
    function removeNotification(notification) {
        notification.classList.remove('show');
        // Remove the element after the hide transition completes
        notification.addEventListener('transitionend', () => {
             if (notification.parentNode) { // Check if it hasn't already been removed
                notification.remove();
             }
        }, { once: true }); // Ensure listener runs only once
         // Fallback removal if transition doesn't fire (e.g., display: none)
         setTimeout(() => {
            if (notification.parentNode) notification.remove();
         }, 500); // Slightly longer than transition duration
    }


    // --- Core Functions ---

    // Load tasks from Local Storage
    function loadTasks() {
        try {
            const tasksJson = localStorage.getItem('tasks');
            // Ensure loaded tasks have expected properties (for older data migration)
            const loadedTasks = tasksJson ? JSON.parse(tasksJson) : [];
            return loadedTasks.map(task => ({
                id: task.id || Date.now(), // Ensure ID exists
                text: task.text || '',
                priority: task.priority || 'medium',
                dueDate: (task.dueDate === '' || typeof task.dueDate === 'undefined') ? null : task.dueDate, // Ensure null for empty dates
                notes: task.notes || '', // Default to empty string if notes missing
                completed: task.completed || false
            }));
        } catch (error) {
            console.error("Error loading tasks from localStorage:", error);
            // Optionally clear corrupted data: localStorage.removeItem('tasks');
            return []; // Return empty array on error
        }
    }

    // Save tasks to Local Storage
    function saveTasks() {
        try {
             localStorage.setItem('tasks', JSON.stringify(tasks));
        } catch (error) {
             console.error("Error saving tasks to localStorage:", error);
             // Maybe notify user that data couldn't be saved
             showNotification("Error saving tasks!", 5000);
        }
    }

    // Render Tasks
    function renderTasks() {
        taskList.innerHTML = ''; // Clear current list

        const filterStatus = filterStatusSelect.value;
        const filterPriority = filterPrioritySelect.value;

        // Filter tasks
        const filteredTasks = tasks.filter(task => {
            const statusMatch = filterStatus === 'all' ||
                                (filterStatus === 'completed' && task.completed) ||
                                (filterStatus === 'active' && !task.completed);
            const priorityMatch = filterPriority === 'all' || task.priority === filterPriority;
            return statusMatch && priorityMatch;
        });

        // Sort tasks
        filteredTasks.sort((a, b) => {
            if (a.completed !== b.completed) return a.completed ? 1 : -1; // Completed last
            const priorityOrder = { high: 3, medium: 2, low: 1 };
            if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
                return priorityOrder[b.priority] - priorityOrder[a.priority]; // Higher priority first
            }
            return b.id - a.id; // Newest first
        });

        // Display empty message logic
        if (tasks.length === 0) {
             emptyMessage.classList.add('show');
             emptyMessage.textContent = "Your To-Do list is empty! Add a task above.";
        } else if (filteredTasks.length === 0) {
            emptyMessage.classList.add('show');
            emptyMessage.textContent = "No tasks match the current filters.";
        } else {
            emptyMessage.classList.remove('show');
            filteredTasks.forEach(task => {
                const taskItem = createTaskElement(task);
                taskList.appendChild(taskItem);
            });
        }
    }

    // Create Task HTML Element
    function createTaskElement(task) {
        const li = document.createElement('li');
        li.className = `task-item priority-${task.priority}`;
        li.dataset.id = task.id;
        if (task.completed) {
            li.classList.add('completed');
        }

        // Check if task is overdue (only if not completed)
        let isOverdue = false;
        if(task.dueDate && !task.completed) {
            try {
                const today = new Date();
                today.setHours(0, 0, 0, 0); // Compare against the start of today
                const dueDate = new Date(task.dueDate + 'T00:00:00'); // Prevent timezone issues
                 if (!isNaN(dueDate.getTime())) { // Check if date is valid
                     isOverdue = dueDate < today;
                 }
            } catch (e) { /* Handle potential date parsing errors gracefully */ }
        }

        // Escape user input before inserting into HTML
        const safeText = escapeHTML(task.text);
        const safeNotes = escapeHTML(task.notes);

        li.innerHTML = `
            <div class="task-content">
                <div class="task-main">
                    <input type="checkbox" class="task-complete-checkbox" ${task.completed ? 'checked' : ''} title="${task.completed ? 'Mark as active' : 'Mark as complete'}">
                    <span class="task-text">${safeText}</span>
                </div>
                <div class="task-details">
                    <span class="task-priority ${task.priority}" title="Priority: ${task.priority}">
                        <i class="fas fa-flag"></i> ${task.priority.charAt(0).toUpperCase() + task.priority.slice(1)}
                     </span>
                     ${task.dueDate ? `
                        <span class="task-due-date ${isOverdue ? 'overdue' : ''}" title="Due Date: ${task.dueDate}">
                            <i class="fas fa-calendar-alt"></i> ${formatDate(task.dueDate)} ${isOverdue ? '<span class="overdue-marker">(Overdue)</span>' : ''}
                        </span>`
                     : ''}
                </div>
                 ${task.notes ? `
                    <div class="task-notes" title="Notes">
                        <i class="fas fa-sticky-note"></i> ${safeNotes}
                    </div>`
                 : ''}
            </div>
            <div class="task-actions">
                <button class="edit-btn" title="Edit Task"><i class="fas fa-edit"></i></button>
                <button class="delete-btn" title="Delete Task"><i class="fas fa-trash-alt"></i></button>
            </div>
        `;

        // Add event listeners (using closure to capture the correct task.id)
        const checkbox = li.querySelector('.task-complete-checkbox');
        const editBtn = li.querySelector('.edit-btn');
        const deleteBtn = li.querySelector('.delete-btn');

        checkbox.addEventListener('change', () => toggleComplete(task.id));
        editBtn.addEventListener('click', () => openEditModal(task.id));
        deleteBtn.addEventListener('click', () => deleteTask(task.id));

        return li;
    }

    // Add New Task
    function addTask(e) {
        e.preventDefault();

        const text = taskInput.value.trim();
        const priority = priorityInput.value;
        const dueDate = dueDateInput.value || null;
        const notes = notesInput.value.trim();

        if (!text) {
             alert('Please enter a task description.');
             taskInput.focus();
             return;
        }

        const newTask = {
            id: Date.now(),
            text: text,
            priority: priority,
            dueDate: dueDate,
            notes: notes,
            completed: false
        };

        tasks.push(newTask);
        saveTasks();
        renderTasks();

        taskForm.reset();
        priorityInput.value = 'medium'; // Ensure default priority is reset
        taskInput.focus();
    }

    // Toggle Task Completion
    function toggleComplete(id) {
        let taskJustCompleted = false;
        const taskText = tasks.find(t => t.id === id)?.text || "Task"; // Get text for notification

        tasks = tasks.map(task => {
            if (task.id === id) {
                if (!task.completed) { // Check if it's about to become completed
                    taskJustCompleted = true;
                }
                return { ...task, completed: !task.completed };
            }
            return task;
        });

        saveTasks();
        renderTasks(); // Render changes first

        // Show notification if it was just marked complete
        if (taskJustCompleted) {
            const appreciationMessages = [
                `Completed: ${taskText.substring(0, 20)}...`,
                "Great job!", "Nicely done!", "Awesome work!", "You rock!", "One less thing to do!", "Checked off!"
            ];
            const randomMessage = appreciationMessages[Math.floor(Math.random() * appreciationMessages.length)];
            showNotification(randomMessage);
        }
    }

    // Delete Task
    function deleteTask(id) {
        const taskToDelete = tasks.find(task => task.id === id);
        const taskText = taskToDelete ? `"${escapeHTML(taskToDelete.text.substring(0, 30))}..."` : "this task";

        if (confirm(`Are you sure you want to delete ${taskText}?`)) {
            tasks = tasks.filter(task => task.id !== id);
            saveTasks();
            renderTasks();
        }
    }

    // --- Edit Modal Logic ---
    function openEditModal(id) {
        const task = tasks.find(task => task.id === id);
        if (!task) {
            console.error("Task not found for editing:", id);
            return;
        };

        editTaskIdInput.value = task.id;
        editTaskTextInput.value = task.text;
        editPrioritySelect.value = task.priority;
        editDueDateInput.value = task.dueDate || '';
        editNotesText.value = task.notes || '';

        editModal.classList.add('show');
        editTaskTextInput.focus();
        editTaskTextInput.select();
    }

    function closeEditModal() {
        editModal.classList.remove('show');
    }

    function saveEditedTask() {
        const id = parseInt(editTaskIdInput.value, 10);
        const newText = editTaskTextInput.value.trim();
        const newPriority = editPrioritySelect.value;
        const newDueDate = editDueDateInput.value || null;
        const newNotes = editNotesText.value.trim();

        if (!newText) {
            alert('Task description cannot be empty.');
            editTaskTextInput.focus();
            return;
        }

        tasks = tasks.map(task =>
            task.id === id ? {
                ...task, // Keep existing properties like 'completed'
                text: newText,
                priority: newPriority,
                dueDate: newDueDate,
                notes: newNotes
            } : task
        );

        saveTasks();
        renderTasks();
        closeEditModal();
    }

    // Clear Completed Tasks
    function clearCompleted() {
        const completedTasks = tasks.filter(task => task.completed);
        const completedCount = completedTasks.length;

        if (completedCount === 0) {
            alert("There are no completed tasks to clear.");
            return;
        }

        if (confirm(`Are you sure you want to delete ${completedCount} completed task(s)?`)) {
             tasks = tasks.filter(task => !task.completed);
             saveTasks();
             renderTasks();
             showNotification(`${completedCount} completed task(s) cleared.`);
        }
    }


    // --- Event Listeners ---
    taskForm.addEventListener('submit', addTask);
    filterStatusSelect.addEventListener('change', renderTasks);
    filterPrioritySelect.addEventListener('change', renderTasks);
    clearCompletedBtn.addEventListener('click', clearCompleted);

    // Modal Listeners
    saveEditBtn.addEventListener('click', saveEditedTask);
    cancelEditBtn.addEventListener('click', closeEditModal);
    editModal.addEventListener('click', (e) => {
        if (e.target === editModal) { // Click on background overlay
            closeEditModal();
        }
    });
     document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && editModal.classList.contains('show')) {
            closeEditModal();
        }
    });


    // --- Initial Render ---
    renderTasks(); // Load and display tasks on page load
});