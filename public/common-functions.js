
// Centralized Authentication Logic
function getToken() {
    return localStorage.getItem('token');
}

function getUser() {
    try {
        return JSON.parse(localStorage.getItem('user') || '{}');
    } catch (e) {
        return {};
    }
}

function logoutUser() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/login.html';
}

const Auth = {
    getToken,
    getUser,
    logout: logoutUser,
    getHeaders(includeJson = false, extraHeaders = {}) {
        const headers = { ...extraHeaders };
        const token = getToken();

        if (includeJson && !headers['Content-Type'] && !headers['content-type']) {
            headers['Content-Type'] = 'application/json';
        }

        if (token && !headers.Authorization && !headers.authorization) {
            headers.Authorization = `Bearer ${token}`;
        }

        return headers;
    }
};

window.Auth = Auth;
window.authHeaders = Auth.getHeaders;

// Override fetch to automatically add Authorization header
const originalFetch = window.fetch;
window.fetch = async function() {
    let [resource, config] = arguments;
    
    if (!config) config = {};
    if (!config.headers) config.headers = {};
    
    const token = Auth.getToken();
    
    if (config.headers instanceof Headers) {
        if (token && !config.headers.has('Authorization')) {
            config.headers.append('Authorization', `Bearer ${token}`);
        }
    } else {
        if (token && !config.headers['Authorization'] && !config.headers['authorization']) {
            config.headers['Authorization'] = `Bearer ${token}`;
        }
    }
    
    const response = await originalFetch(resource, config);
    if (response.status === 401 || response.status === 403) {
        console.warn('Auth error detected globally, logging out...');
        Auth.logout();
    }
    return response;
};

// Common Error Handling Function
function handleError(error, userMessage = 'حدث خطأ ما') {
    console.error('Error:', error);
    alert(userMessage + ': ' + (error.message || error));
}

// Common API Call Function
async function apiCall(url, options = {}) {
    try {
        console.log('API Call:', url, options);

        const response = await fetch(url, {
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            },
            ...options
        });

        console.log('Response status:', response.status);

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
    const token = getToken();
    if (!token) {
        window.location.href = '/login.html';
        return false;
    }

    const userData = getUser();
    const userDisplay = document.getElementById('userDisplay');
    if (userDisplay && userData.username) {
        userDisplay.textContent = `👤 ${userData.username}`;
    }

    return true;
}
