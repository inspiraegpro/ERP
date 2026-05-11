
// Common Error Handling Function
function handleError(error, userMessage = 'حدث خطأ ما') {
    console.error('Error:', error);
    alert(userMessage + ': ' + (error.message || error));
}

// Common API Call Function
async function apiCall(url, options = {}) {
    try {
        console.log('API Call:', url, options);

        const token = localStorage.getItem('token');
        const response = await fetch(url, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': token ? `Bearer ${token}` : undefined,
                ...options.headers
            },
            ...options
        });

        console.log('Response status:', response.status);

        if (response.status === 401 || response.status === 403) {
            console.warn('Auth error, redirecting to login...');
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            window.location.href = '/login.html';
            return;
        }

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Error response:', errorText);
            throw new Error(`HTTP ${response.status}: ${errorText}`);
        }

        return await response.json();
    } catch (error) {
        console.error('API Error:', error);
        throw error;
    }
}

// Authentication Check Function
function checkAuth() {
    const token = localStorage.getItem('token');
    if (!token) {
        // If not logged in, redirect to login page
        window.location.href = '/login.html';
        return false;
    }

    // Check user data
    const user = localStorage.getItem('user');
    const userDisplay = document.getElementById('userDisplay');
    if (userDisplay) {
        const userData = JSON.parse(user);
        userDisplay.textContent = `👤 ${userData.username || 'مستخدم'}`;
    }

    return true;
}