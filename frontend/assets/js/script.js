function switchView(viewId, element) {
    document.querySelectorAll('.view-section').forEach(view => {
        view.classList.remove('active-view');
    });

    document.getElementById(viewId).classList.add('active-view');

    const titleMap = {
        'dashboard-view': 'Dashboard Overview',
        'venues-view': 'Venue Space Management Inventory',
        'schedule-view': 'Schedule Event Allocation Form'
    };
    document.getElementById('workspaceTitle').innerText = titleMap[viewId];

    if (element) {
        document.querySelectorAll('.menu-item').forEach(item => item.classList.remove('active'));
        element.classList.add('active');
    }
}

function openReservationWithVenue(venueName) {
    document.getElementById('eventVenue').value = venueName;
    const targetMenuOption = document.querySelector('[data-view="schedule-view"]');
    switchView('schedule-view', targetMenuOption);
}

function handleFormSubmission(e) {
    e.preventDefault();

    const title = document.getElementById('eventTitle').value;
    const venue = document.getElementById('eventVenue').value;
    const date = document.getElementById('eventDate').value;
    const time = document.getElementById('eventTime').value;

    const tableBody = document.querySelector('#eventsTable tbody');
    const newRow = document.createElement('tr');
    newRow.innerHTML = `
        <td><strong>${title}</strong></td>
        <td>${venue}</td>
        <td>${date} | ${time}</td>
        <td><span class="status-pill status-pending">Pending Review</span></td>
        <td class="admin-actions">-</td>
    `;
    tableBody.appendChild(newRow);

    const pendingElement = document.getElementById('countPending');
    pendingElement.innerText = parseInt(pendingElement.innerText, 10) + 1;

    const logFeed = document.querySelector('.notification-feed');
    const alertItem = document.createElement('div');
    alertItem.className = 'notification-item';
    alertItem.innerHTML = `<strong>System Routing:</strong> Reservation request generated for "${title}". Awaiting Administrative check. <div class="notification-time">Just now</div>`;
    logFeed.insertBefore(alertItem, logFeed.firstChild);

    document.getElementById('scheduleForm').reset();
    switchView('dashboard-view', document.querySelector('[data-view="dashboard-view"]'));
}

function switchRoleContext(selectedRole) {
    document.getElementById('currentRoleBadge').innerText = `Role: ${selectedRole}`;

    const actionHeaders = document.querySelectorAll('.admin-action-header');
    const actionCells = document.querySelectorAll('.admin-actions');

    if (selectedRole === 'Administrator') {
        actionHeaders.forEach(el => el.style.display = 'table-cell');
        actionCells.forEach(el => el.style.display = 'table-cell');
    } else {
        actionHeaders.forEach(el => el.style.display = 'none');
        actionCells.forEach(el => el.style.display = 'none');
    }
}

function processStatus(outcome) {
    const label = document.getElementById('statusLabelPending');
    const pendingElement = document.getElementById('countPending');
    const activeElement = document.getElementById('countActive');

    if (outcome === 'Approved') {
        label.className = 'status-pill status-approved';
        label.innerText = 'Approved';
        activeElement.innerText = parseInt(activeElement.innerText, 10) + 1;
    } else {
        label.className = 'status-pill status-rejected';
        label.innerText = 'Rejected';
    }

    pendingElement.innerText = Math.max(0, parseInt(pendingElement.innerText, 10) - 1);
    switchRoleContext(document.getElementById('roleSelect').value);
}

function startSession(selectionRole) {
    const roleMap = {
        Student: 'Participant',
        Faculty: 'Administrator'
    };
    const normalizedRole = roleMap[selectionRole] || selectionRole;

    const landingOverlay = document.getElementById('landingOverlay');
    const sidebar = document.querySelector('.sidebar');
    const workspace = document.querySelector('.main-workspace');
    const roleSimulator = document.querySelector('.role-simulator');

    document.getElementById('roleSelect').value = normalizedRole;
    switchRoleContext(normalizedRole);
    switchView('dashboard-view', document.querySelector('[data-view="dashboard-view"]'));

    landingOverlay.style.display = 'none';
    sidebar.classList.remove('hidden');
    workspace.classList.remove('hidden');
    roleSimulator.classList.remove('hidden');
}

document.addEventListener('DOMContentLoaded', () => {
    const roleSelect = document.getElementById('roleSelect');
    const notificationBell = document.getElementById('notificationBell');
    const menuItems = document.querySelectorAll('.sidebar-menu .menu-item');
    const venueButtons = document.querySelectorAll('.venue-select-button');
    const scheduleForm = document.getElementById('scheduleForm');
    const cancelButton = document.getElementById('scheduleCancelBtn');
    const eventsTableBody = document.querySelector('#eventsTable tbody');
    const landingButtons = document.querySelectorAll('.landing-button');

    roleSelect.addEventListener('change', event => switchRoleContext(event.target.value));

    if (notificationBell) {
        notificationBell.addEventListener('click', () => switchView('dashboard-view', document.querySelector('[data-view="dashboard-view"]')));
    }

    menuItems.forEach(item => {
        item.addEventListener('click', () => switchView(item.dataset.view, item));
    });

    landingButtons.forEach(button => {
        button.addEventListener('click', () => startSession(button.dataset.role));
    });

    venueButtons.forEach(button => {
        button.addEventListener('click', () => openReservationWithVenue(button.dataset.venue));
    });

    if (scheduleForm) {
        scheduleForm.addEventListener('submit', handleFormSubmission);
    }

    if (cancelButton) {
        cancelButton.addEventListener('click', () => switchView('dashboard-view', document.querySelector('[data-view="dashboard-view"]')));
    }

    if (eventsTableBody) {
        eventsTableBody.addEventListener('click', event => {
            if (event.target.matches('.btn-success')) {
                processStatus('Approved');
            }
            if (event.target.matches('.btn-danger')) {
                processStatus('Rejected');
            }
        });
    }
});
