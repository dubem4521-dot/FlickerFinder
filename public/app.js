// ========== TMDB CONFIG ==========
const TMDB_API_KEY = '903bc9618d86a908c078d4e28e22e7d0';
const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/w500';
const TMDB_BACKDROP_BASE = 'https://image.tmdb.org/t/p/original';

let currentUser = null;
let currentMovies = [];
let currentShows = [];
let currentPage = 1;
let currentMediaType = 'movie';
let currentHeroIndex = 0;
let heroInterval;
let myList = [];

// ========== AUTHENTICATION ==========
function initAuth() {
    // Check if user is already logged in via Netlify Identity
    if (window.netlifyIdentity) {
        window.netlifyIdentity.on('init', user => {
            if (user) {
                currentUser = user;
                updateAuthUI(true, user);
                loadUserList();
            } else {
                updateAuthUI(false);
            }
        });
        
        window.netlifyIdentity.on('login', user => {
            currentUser = user;
            updateAuthUI(true, user);
            loadUserList();
            showToast(`Welcome back, ${user.user_metadata.full_name || user.email.split('@')[0]}! 🎬`);
        });
        
        window.netlifyIdentity.on('logout', () => {
            currentUser = null;
            myList = [];
            updateAuthUI(false);
            showToast('Logged out successfully');
            if (document.querySelector('.nav-link.active')?.getAttribute('data-page') === 'mylist') {
                renderMyList();
            }
        });
    }
}

function updateAuthUI(isLoggedIn, user = null) {
    const authButtons = document.getElementById('authButtons');
    const userMenu = document.getElementById('userMenu');
    
    if (isLoggedIn && user) {
        authButtons.style.display = 'none';
        userMenu.style.display = 'flex';
        const userName = user.user_metadata?.full_name || user.email.split('@')[0];
        document.getElementById('userName').textContent = userName;
    } else {
        authButtons.style.display = 'flex';
        userMenu.style.display = 'none';
    }
}

function showAuthModal(mode = 'signup') {
    if (window.netlifyIdentity) {
        if (mode === 'signup') {
            window.netlifyIdentity.open('signup');
        } else {
            window.netlifyIdentity.open('login');
        }
    } else {
        alert('Please deploy to Netlify to enable authentication');
    }
}

// ========== MY LIST (Database-backed) ==========
async function loadUserList() {
    if (!currentUser) return;
    
    try {
        const response = await fetch(`/.netlify/functions/get-list?email=${encodeURIComponent(currentUser.email)}`);
        const items = await response.json();
        
        myList = items.map(item => ({
            id: item.item_id,
            mediaType: item.media_type,
            title: item.title,
            year: item.year,
            rating: item.rating,
            posterPath: item.poster_path
        }));
        
        updateMyListCount();
        
        // If on My List page, refresh
        if (document.querySelector('.nav-link.active')?.getAttribute('data-page') === 'mylist') {
            renderMyList();
        }
    } catch (error) {
        console.error('Error loading list:', error);
    }
}

function updateMyListCount() {
    const myListLink = document.querySelector('.nav-link[data-page="mylist"]');
    if (myListLink && myList.length > 0) {
        myListLink.innerHTML = `MyList <span style="background:#e50914; padding:2px 8px; border-radius:20px; font-size:0.7rem; margin-left:5px;">${myList.length}</span>`;
    } else if (myListLink) {
        myListLink.innerHTML = 'MyList';
    }
}

async function addToMyList(item) {
    if (!currentUser) {
        showToast('Please login to save to My List 🔐');
        showAuthModal('login');
        return false;
    }
    
    // Check if already in list
    if (myList.some(i => i.id === item.id && i.mediaType === item.mediaType)) {
        showToast(`⚠️ "${item.title}" is already in your list`);
        return false;
    }
    
    try {
        const response = await fetch('/.netlify/functions/add-to-list', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userEmail: currentUser.email,
                itemId: item.id,
                mediaType: item.mediaType,
                title: item.title,
                year: item.year,
                rating: item.rating,
                posterPath: item.posterPath
            })
        });
        
        if (response.ok) {
            myList.push(item);
            updateMyListCount();
            showToast(`✅ Added "${item.title}" to My List`);
            return true;
        } else {
            showToast('Failed to add to list');
            return false;
        }
    } catch (error) {
        console.error(error);
        showToast('Error adding to list');
        return false;
    }
}

async function removeFromMyList(id, mediaType) {
    if (!currentUser) return;
    
    try {
        const response = await fetch('/.netlify/functions/remove-from-list', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userEmail: currentUser.email,
                itemId: id,
                mediaType: mediaType
            })
        });
        
        if (response.ok) {
            myList = myList.filter(i => !(i.id === id && i.mediaType === mediaType));
            updateMyListCount();
            showToast('Removed from My List');
            if (document.querySelector('.nav-link.active')?.getAttribute('data-page') === 'mylist') {
                renderMyList();
            }
        }
    } catch (error) {
        console.error(error);
        showToast('Error removing from list');
    }
}

function showToast(message) {
    let toast = document.getElementById('toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'toast';
        toast.style.cssText = `
            position: fixed;
            bottom: 30px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(0,0,0,0.9);
            color: white;
            padding: 12px 24px;
            border-radius: 50px;
            font-size: 0.9rem;
            z-index: 3000;
            backdrop-filter: blur(8px);
            border: 1px solid rgba(255,255,255,0.2);
            transition: opacity 0.3s;
        `;
        document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.style.opacity = '1';
    setTimeout(() => {
        toast.style.opacity = '0';
    }, 2000);
}

// ========== FETCH TRENDING ==========
async function fetchTrending(page = 1, type = 'movie') {
    currentMediaType = type;
    try {
        const response = await fetch(`https://api.themoviedb.org/3/trending/${type}/week?api_key=${TMDB_API_KEY}&page=${page}`);
        const data = await response.json();
        if (type === 'movie') {
            currentMovies = data.results;
            renderMovieGrid(currentMovies, 'movie');
        } else {
            currentShows = data.results;
            renderMovieGrid(currentShows, 'tv');
        }
    } catch (error) {
        console.error(error);
        document.getElementById('movieGrid').innerHTML = '<div class="empty">⚠️ Failed to load. Check API key.</div>';
    }
}

function renderMovieGrid(items, type) {
    const movieGrid = document.getElementById('movieGrid');
    if (!items?.length) {
        movieGrid.innerHTML = '<div class="empty">🎬 Nothing found.</div>';
        return;
    }
    
    movieGrid.innerHTML = items.map(item => {
        const title = item.title || item.name;
        const date = item.release_date || item.first_air_date;
        const year = date?.split('-')[0] || 'N/A';
        const posterPath = item.poster_path;
        const voteAvg = item.vote_average?.toFixed(1) || 'N/A';
        
        return `
            <div class="movie-card" data-movie-id="${item.id}" data-media-type="${type}" data-movie-title="${escapeHtml(title)}">
                <div class="movie-poster">
                    ${posterPath ? `<img src="${TMDB_IMAGE_BASE}${posterPath}" alt="${escapeHtml(title)}">` : '<i class="fas fa-film"></i>'}
                </div>
                <div class="movie-info">
                    <div class="movie-title">${escapeHtml(title)}</div>
                    <div class="movie-year">${year}</div>
                    <div class="movie-rating"><i class="fas fa-star"></i> ${voteAvg}</div>
                </div>
            </div>
        `;
    }).join('');
    
    document.querySelectorAll('.movie-card').forEach(card => {
        card.addEventListener('click', () => {
            const id = card.getAttribute('data-movie-id');
            const type = card.getAttribute('data-media-type');
            openMovieModal(id, type);
        });
    });
}

// ========== HERO CAROUSEL ==========
async function initHero() {
    try {
        const response = await fetch(`https://api.themoviedb.org/3/trending/movie/week?api_key=${TMDB_API_KEY}&page=1`);
        const data = await response.json();
        const trending = data.results.slice(0, 5);
        const heroSlides = document.getElementById('heroSlides');
        const heroDots = document.getElementById('heroDots');
        
        heroSlides.innerHTML = trending.map((movie, idx) => {
            const title = movie.title || movie.name;
            const date = movie.release_date || movie.first_air_date;
            const year = date?.split('-')[0] || 'N/A';
            const backdropPath = movie.backdrop_path;
            const voteAvg = movie.vote_average?.toFixed(1) || 'N/A';
            const overview = movie.overview?.substring(0, 180) + '...' || 'No description.';
            
            return `
                <div class="hero-slide ${idx === 0 ? 'active' : ''}" style="background-image: url('${TMDB_BACKDROP_BASE}${backdropPath}')">
                    <div class="hero-overlay">
                        <div class="hero-content">
                            <h1 class="hero-title">${escapeHtml(title)}</h1>
                            <div class="hero-meta">
                                <span class="hero-rating"><i class="fas fa-star"></i> ${voteAvg}</span>
                                <span class="hero-year">${year}</span>
                                <span class="hero-age">PG-13</span>
                            </div>
                            <p class="hero-description">${escapeHtml(overview)}</p>
                            <button class="hero-btn" data-movie-id="${movie.id}" data-media-type="movie">
                                <i class="fas fa-play"></i> View Details
                            </button>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
        
        heroDots.innerHTML = trending.map((_, idx) => `<div class="hero-dot ${idx === 0 ? 'active' : ''}" data-index="${idx}"></div>`).join('');
        
        document.querySelectorAll('.hero-btn').forEach(btn => {
            btn.addEventListener('click', () => openMovieModal(btn.getAttribute('data-movie-id'), btn.getAttribute('data-media-type')));
        });
        document.querySelectorAll('.hero-dot').forEach(dot => {
            dot.addEventListener('click', () => goToHeroSlide(parseInt(dot.getAttribute('data-index'))));
        });
        startHeroAutoPlay();
    } catch (error) { console.error(error); }
}

function startHeroAutoPlay() {
    heroInterval = setInterval(() => {
        const slides = document.querySelectorAll('.hero-slide');
        if (slides.length) goToHeroSlide((currentHeroIndex + 1) % slides.length);
    }, 6000);
}

function goToHeroSlide(idx) {
    const slides = document.querySelectorAll('.hero-slide');
    const dots = document.querySelectorAll('.hero-dot');
    slides.forEach((s, i) => s.classList.toggle('active', i === idx));
    dots.forEach((d, i) => d.classList.toggle('active', i === idx));
    currentHeroIndex = idx;
}

// ========== MY LIST RENDERING ==========
function renderMyList() {
    const movieGrid = document.getElementById('movieGrid');
    const sectionTitle = document.querySelector('.section-header h2');
    if (sectionTitle) sectionTitle.innerHTML = '<i class="fas fa-list"></i> My List';
    
    if (!currentUser) {
        movieGrid.innerHTML = '<div class="empty">🔐 Please login to see your saved movies and shows!</div>';
        return;
    }
    
    if (myList.length === 0) {
        movieGrid.innerHTML = '<div class="empty">📭 Your list is empty. Click the + button on movies/TV shows to add them!</div>';
        return;
    }
    
    movieGrid.innerHTML = myList.map(item => `
        <div class="movie-card" data-movie-id="${item.id}" data-media-type="${item.mediaType}">
            <div class="movie-poster">
                ${item.posterPath ? `<img src="${TMDB_IMAGE_BASE}${item.posterPath}" alt="${escapeHtml(item.title)}">` : '<i class="fas fa-film"></i>'}
            </div>
            <div class="movie-info">
                <div class="movie-title">${escapeHtml(item.title)}</div>
                <div class="movie-year">${item.year}</div>
                <div class="movie-rating"><i class="fas fa-star"></i> ${item.rating}</div>
                <button class="remove-from-list-btn" data-id="${item.id}" data-type="${item.mediaType}" style="margin-top:10px; background:#333; border:none; padding:6px; border-radius:8px; color:white; cursor:pointer; width:100%; font-size:0.7rem;">
                    <i class="fas fa-trash"></i> Remove
                </button>
            </div>
        </div>
    `).join('');
    
    document.querySelectorAll('.remove-from-list-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const id = parseInt(btn.getAttribute('data-id'));
            const type = btn.getAttribute('data-type');
            removeFromMyList(id, type);
        });
    });
    
    document.querySelectorAll('.movie-card').forEach(card => {
        card.addEventListener('click', (e) => {
            if (e.target.classList.contains('remove-from-list-btn')) return;
            const id = card.getAttribute('data-movie-id');
            const type = card.getAttribute('data-media-type');
            openMovieModal(id, type);
        });
    });
}

// ========== MODAL ==========
async function openMovieModal(movieId, mediaType = 'movie') {
    try {
        const response = await fetch(`https://api.themoviedb.org/3/${mediaType}/${movieId}?api_key=${TMDB_API_KEY}&append_to_response=credits`);
        const data = await response.json();
        const title = data.title || data.name;
        const releaseDate = data.release_date || data.first_air_date;
        const runtime = data.runtime ? `${Math.floor(data.runtime / 60)}h ${data.runtime % 60}m` : (data.episode_run_time?.[0] ? `${Math.floor(data.episode_run_time[0] / 60)}h ${data.episode_run_time[0] % 60}m` : 'N/A');
        const cast = data.credits?.cast?.slice(0, 6).map(c => c.name).join(', ') || 'N/A';
        const posterUrl = data.poster_path ? `${TMDB_IMAGE_BASE}${data.poster_path}` : '';
        
        const formattedDate = releaseDate ? new Date(releaseDate).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : 'N/A';
        const budget = data.budget ? `$${data.budget.toLocaleString()}` : 'N/A';
        
        const languageMap = { 'en': 'English', 'es': 'Spanish', 'fr': 'French', 'de': 'German', 'ja': 'Japanese', 'ko': 'Korean', 'zh': 'Chinese', 'hi': 'Hindi' };
        const language = languageMap[data.original_language] || data.original_language?.toUpperCase() || 'N/A';
        const collection = data.belongs_to_collection?.name || 'Standalone Film';
        
        const inMyList = currentUser && myList.some(i => i.id === data.id && i.mediaType === mediaType);
        
        const modalBody = document.getElementById('modalBody');
        modalBody.innerHTML = `
            <div class="modal-bg-image" style="background-image: url('${posterUrl}')">
                <span class="modal-close">&times;</span>
                <div class="modal-body">
                    <div class="modal-two-columns">
                        <div class="modal-left">
                            <h2>${escapeHtml(title)}</h2>
                            <div class="modal-rating-row">
                                <div class="modal-star-rating"><i class="fas fa-star"></i> <span>${data.vote_average?.toFixed(1) || 'N/A'}/10</span></div>
                                <div class="modal-user-score"><i class="fas fa-users"></i> ${data.vote_count?.toLocaleString() || '0'} ratings</div>
                            </div>
                            <div class="modal-overview">${escapeHtml(data.overview || 'No overview available.')}</div>
                            <div class="modal-cast-section">
                                <h4><i class="fas fa-users"></i> Top Cast</h4>
                                <div class="modal-cast-list">
                                    ${data.credits?.cast?.slice(0, 6).map(c => `<span class="modal-cast-item">${escapeHtml(c.name)}</span>`).join('') || '<span>No cast data</span>'}
                                </div>
                            </div>
                        </div>
                        <div class="modal-right">
                            <button id="modalAddToListBtn" class="add-to-list-btn" data-id="${data.id}" data-type="${mediaType}" data-title="${escapeHtml(title)}" data-year="${formattedDate.split(',')[0]}" data-rating="${data.vote_average?.toFixed(1) || 'N/A'}" data-poster="${data.poster_path || ''}" style="width:100%; margin-bottom:20px; padding:12px; background:${inMyList ? '#333' : '#e50914'}; border:none; border-radius:12px; color:white; font-weight:600; cursor:pointer;">
                                <i class="fas ${inMyList ? 'fa-check' : 'fa-plus'}"></i> ${inMyList ? 'In My List' : 'Add to My List'}
                            </button>
                            <div class="modal-detail-item"><div class="modal-detail-label">Runtime</div><div class="modal-detail-value">${runtime}</div></div>
                            <div class="modal-detail-item"><div class="modal-detail-label">Language</div><div class="modal-detail-value">${language}</div></div>
                            <div class="modal-detail-item"><div class="modal-detail-label">Release Date</div><div class="modal-detail-value">${formattedDate}</div></div>
                            <div class="modal-detail-item"><div class="modal-detail-label">Budget</div><div class="modal-detail-value">${budget}</div></div>
                            <div class="modal-collection"><i class="fas fa-layer-group"></i> ${escapeHtml(collection)}</div>
                        </div>
                    </div>
                    <div class="modal-review-form">
                        <h4><i class="fas fa-pen"></i> Write a Review</h4>
                        <input type="text" id="modalUserName" placeholder="Your name" required>
                        <select id="modalRating" required>
                            <option value="">Rating (1-5)</option>
                            ${[1,2,3,4,5].map(r => `<option value="${r}">${'⭐'.repeat(r)}</option>`).join('')}
                        </select>
                        <textarea id="modalReviewText" rows="3" placeholder="Your review..." required></textarea>
                        <button id="submitModalReview">📝 Post Review</button>
                    </div>
                    <div class="modal-reviews-list">
                        <h4><i class="fas fa-comments"></i> Community Reviews</h4>
                        <div id="modalReviewsList">Loading reviews...</div>
                    </div>
                </div>
            </div>
        `;
        
        document.getElementById('movieModal').style.display = 'flex';
        document.querySelector('.modal-close').onclick = () => document.getElementById('movieModal').style.display = 'none';
        window.onclick = (e) => { if (e.target === document.getElementById('movieModal')) document.getElementById('movieModal').style.display = 'none'; };
        
        document.getElementById('modalAddToListBtn')?.addEventListener('click', async (e) => {
            const btn = e.target;
            const id = parseInt(btn.getAttribute('data-id'));
            const type = btn.getAttribute('data-type');
            const title = btn.getAttribute('data-title');
            const year = btn.getAttribute('data-year');
            const rating = btn.getAttribute('data-rating');
            const posterPath = btn.getAttribute('data-poster');
            
            const success = await addToMyList({
                id: id,
                mediaType: type,
                title: title,
                year: year,
                rating: rating,
                posterPath: posterPath
            });
            
            if (success) {
                btn.innerHTML = '<i class="fas fa-check"></i> In My List';
                btn.style.background = '#333';
            }
        });
        
        document.getElementById('submitModalReview').onclick = () => submitModalReview(movieId, title);
        await loadModalReviews(title);
        
    } catch (error) {
        console.error(error);
        alert('Failed to load movie details');
    }
}

async function submitModalReview(movieId, movieTitle) {
    const userName = document.getElementById('modalUserName')?.value;
    const rating = parseInt(document.getElementById('modalRating')?.value);
    const reviewText = document.getElementById('modalReviewText')?.value;
    if (!userName || !rating || !reviewText) return alert('Please fill all fields');
    try {
        const response = await fetch('/.netlify/functions/add-review', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ movieTitle, rating, reviewText, userName })
        });
        if (response.ok) {
            alert('✅ Review posted!');
            document.getElementById('modalUserName').value = '';
            document.getElementById('modalRating').value = '';
            document.getElementById('modalReviewText').value = '';
            await loadModalReviews(movieTitle);
            loadReviews();
            loadTopReviewers();
        } else alert('Error posting review');
    } catch (error) { alert('Failed to post review'); }
}

async function loadModalReviews(movieTitle) {
    try {
        const response = await fetch(`/.netlify/functions/get-reviews?movie=${encodeURIComponent(movieTitle)}`);
        const reviews = await response.json();
        const container = document.getElementById('modalReviewsList');
        if (!reviews?.length) {
            container.innerHTML = '<p>No reviews yet. Be the first!</p>';
            return;
        }
        container.innerHTML = reviews.map(review => `
            <div class="review-card" style="margin-top:12px">
                <div class="review-header">
                    <span class="review-movie"><i class="fas fa-user"></i> ${escapeHtml(review.user_name)}</span>
                    <span class="review-rating">${'⭐'.repeat(review.rating)}</span>
                </div>
                <div class="review-text">${escapeHtml(review.review_text)}</div>
                <div class="review-footer"><span><i class="fas fa-calendar"></i> ${new Date(review.created_at).toLocaleDateString()}</span></div>
            </div>
        `).join('');
    } catch (error) { console.error(error); }
}

// ========== REVIEWS & TOP REVIEWERS ==========
async function loadReviews() {
    try {
        const response = await fetch('/.netlify/functions/get-reviews');
        const reviews = await response.json();
        const container = document.getElementById('reviewsContainer');
        if (!reviews?.length) { container.innerHTML = '<div class="empty">✨ No reviews yet. Click a movie card to review!</div>'; return; }
        container.innerHTML = reviews.slice(0, 10).map(review => `
            <div class="review-card">
                <div class="review-header"><span class="review-movie"><i class="fas fa-film"></i> ${escapeHtml(review.movie_title)}</span><span class="review-rating">${'⭐'.repeat(review.rating)}</span></div>
                <div class="review-text">${escapeHtml(review.review_text.substring(0, 150))}${review.review_text.length > 150 ? '...' : ''}</div>
                <div class="review-footer"><span class="review-user"><i class="fas fa-user"></i> ${escapeHtml(review.user_name)}</span></div>
            </div>
        `).join('');
    } catch (error) { console.error(error); }
}

async function loadTopReviewers() {
    try {
        const response = await fetch('/.netlify/functions/get-reviews');
        const reviews = await response.json();
        const userCounts = {};
        reviews.forEach(r => { userCounts[r.user_name] = (userCounts[r.user_name] || 0) + 1; });
        const topUsers = Object.entries(userCounts).map(([name, count]) => ({ name, count })).sort((a,b) => b.count - a.count).slice(0,5);
        const container = document.getElementById('topReviewersContainer');
        if (!topUsers.length) { container.innerHTML = '<div class="empty">🏆 No reviewers yet.</div>'; return; }
        const rankIcons = ['🥇','🥈','🥉','4️⃣','5️⃣'];
        container.innerHTML = topUsers.map((user, idx) => `
            <div class="top-reviewer-card"><div class="top-reviewer-rank">${rankIcons[idx] || idx+1}</div><div class="top-reviewer-avatar"><i class="fas fa-user"></i></div><div class="top-reviewer-info"><div class="top-reviewer-name">${escapeHtml(user.name)}</div><div class="top-reviewer-stats"><span><i class="fas fa-pen"></i> ${user.count} reviews</span></div></div></div>
        `).join('');
    } catch (error) { console.error(error); }
}

// ========== SEARCH ==========
async function searchMovies(query) {
    if (!query.trim()) {
        if (currentMediaType === 'movie') fetchTrending(1, 'movie');
        else fetchTrending(1, 'tv');
        return;
    }
    try {
        const response = await fetch(`https://api.themoviedb.org/3/search/multi?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(query)}`);
        const data = await response.json();
        const results = data.results.filter(r => r.media_type === 'movie' || r.media_type === 'tv');
        renderMovieGrid(results, 'search');
    } catch (error) { console.error(error); }
}

// ========== NAVIGATION ==========
function setupNavigation() {
    const navLinks = document.querySelectorAll('.nav-link');
    const sectionTitle = document.querySelector('.section-header h2');
    
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            navLinks.forEach(l => l.classList.remove('active'));
            link.classList.add('active');
            
            const page = link.getAttribute('data-page');
            
            if (page === 'home') {
                sectionTitle.innerHTML = '<i class="fas fa-fire-flame"></i> Trending Now';
                fetchTrending(1, 'movie');
                currentMediaType = 'movie';
            } else if (page === 'movies') {
                sectionTitle.innerHTML = '<i class="fas fa-film"></i> Popular Movies';
                fetchTrending(1, 'movie');
                currentMediaType = 'movie';
            } else if (page === 'shows') {
                sectionTitle.innerHTML = '<i class="fas fa-tv"></i> Popular TV Shows';
                fetchTrending(1, 'tv');
                currentMediaType = 'tv';
            } else if (page === 'mylist') {
                renderMyList();
            }
        });
    });
}

// ========== PAGINATION ==========
async function nextPage() { 
    currentPage++; 
    if (currentMediaType === 'movie') await fetchTrending(currentPage, 'movie');
    else if (currentMediaType === 'tv') await fetchTrending(currentPage, 'tv');
}
async function prevPage() { 
    if (currentPage > 1) { 
        currentPage--; 
        if (currentMediaType === 'movie') await fetchTrending(currentPage, 'movie');
        else if (currentMediaType === 'tv') await fetchTrending(currentPage, 'tv');
    } 
}

// ========== EVENT LISTENERS ==========
document.querySelector('.hero-prev')?.addEventListener('click', () => { const slides = document.querySelectorAll('.hero-slide'); goToHeroSlide((currentHeroIndex - 1 + slides.length) % slides.length); });
document.querySelector('.hero-next')?.addEventListener('click', () => { const slides = document.querySelectorAll('.hero-slide'); goToHeroSlide((currentHeroIndex + 1) % slides.length); });
document.getElementById('signinBtn')?.addEventListener('click', () => showAuthModal('signup'));
document.getElementById('loginBtn')?.addEventListener('click', () => showAuthModal('login'));
document.getElementById('logoutBtn')?.addEventListener('click', () => {
    if (window.netlifyIdentity) window.netlifyIdentity.logout();
});

function escapeHtml(text) { if (!text) return ''; const div = document.createElement('div'); div.textContent = text; return div.innerHTML; }

// ========== INIT ==========
async function init() {
    initAuth();
    setupNavigation();
    await fetchTrending(1, 'movie');
    await initHero();
    await loadReviews();
    await loadTopReviewers();
    
    document.getElementById('searchInput')?.addEventListener('input', e => searchMovies(e.target.value));
    document.getElementById('gridNext')?.addEventListener('click', nextPage);
    document.getElementById('gridPrev')?.addEventListener('click', prevPage);
}

init();