/* =====================================================
   E-VOTING RW 04
   APP.JS
   FINAL VERSION
   - Login
   - Session
   - Candidate
   - Google Drive Photo
   - Visi & Misi menjadi poin
   - Voting
   - Result
===================================================== */


/* =====================================================
   KONFIGURASI API
===================================================== */

const API_URL =
    "https://script.google.com/macros/s/AKfycbw-yX3a_9GzhCCtByS4g_IXRJsVhMN-CnvJsKQ0EFu-01n_mwa_Jftt6ex9IlYtHQ0W0g/exec";


/* =====================================================
   STATE
===================================================== */

let currentUser = null;
let sessionToken = null;
let candidates = [];
let selectedCandidate = null;
let sessionExpiresAt = null;
let sessionTimerInterval = null;


/* =====================================================
   ELEMENT
===================================================== */

const loading =
    document.getElementById("loading");

const loadingText =
    document.getElementById("loadingText");

const loginPage =
    document.getElementById("loginPage");

const votingPage =
    document.getElementById("votingPage");

const confirmPage =
    document.getElementById("confirmPage");

const successPage =
    document.getElementById("successPage");

const resultPage =
    document.getElementById("resultPage");

const logoutButton =
    document.getElementById("logoutButton");

const candidateGrid =
    document.getElementById("candidateGrid");

const candidateCount =
    document.getElementById("candidateCount");


/* =====================================================
   LOADING
===================================================== */

function showLoading(text = "Memproses...") {

    if (loadingText) {
        loadingText.textContent = text;
    }

    if (loading) {
        loading.classList.remove("hidden");
    }

}


function hideLoading() {

    if (loading) {
        loading.classList.add("hidden");
    }

}


/* =====================================================
   PAGE
===================================================== */

function hideAllPages() {

    [
        loginPage,
        votingPage,
        confirmPage,
        successPage,
        resultPage
    ].forEach(function(page) {

        if (page) {
            page.classList.add("hidden");
        }

    });

}


function showPage(page) {

    hideAllPages();

    if (!page) {
        return;
    }

    page.classList.remove("hidden");

    window.scrollTo({
        top: 0,
        behavior: "auto"
    });

}


/* =====================================================
   MESSAGE
===================================================== */

function showMessage(
    element,
    message,
    type = "error"
) {

    if (!element) {
        return;
    }

    element.textContent =
        message || "";

    element.className =
        "message " + type;

}


function clearMessage(element) {

    if (!element) {
        return;
    }

    element.textContent = "";

    element.className =
        "message";

}


/* =====================================================
   API POST
===================================================== */

async function apiPost(data) {

    const response =
        await fetch(
            API_URL,
            {
                method: "POST",

                headers: {
                    "Content-Type":
                        "text/plain;charset=utf-8"
                },

                body:
                    JSON.stringify(data)
            }
        );

    if (!response.ok) {

        throw new Error(
            "Server tidak dapat dihubungi."
        );

    }

    const result =
        await response.json();

    return result;

}


/* =====================================================
   API GET
===================================================== */

async function apiGet(action) {

    const url =
        API_URL +
        "?action=" +
        encodeURIComponent(action);

    const response =
        await fetch(
            url,
            {
                method: "GET",
                cache: "no-store"
            }
        );

    if (!response.ok) {

        throw new Error(
            "Server tidak dapat dihubungi."
        );

    }

    const result =
        await response.json();

    return result;

}


/* =====================================================
   LOGIN
===================================================== */

const loginForm =
    document.getElementById(
        "loginForm"
    );


if (loginForm) {

    loginForm.addEventListener(
        "submit",
        handleLogin
    );

}


async function handleLogin(event) {

    event.preventDefault();

    const idInput =
        document.getElementById(
            "idPemilih"
        );

    const pinInput =
        document.getElementById(
            "pin"
        );

    const loginButton =
        document.getElementById(
            "loginButton"
        );

    const message =
        document.getElementById(
            "loginMessage"
        );

    const idPemilih =
        String(
            idInput?.value || ""
        )
        .trim()
        .toUpperCase();

    const pin =
        String(
            pinInput?.value || ""
        )
        .trim();

    clearMessage(message);

    if (!idPemilih || !pin) {

        showMessage(
            message,
            "ID Pemilih dan PIN wajib diisi."
        );

        return;

    }

    loginButton.disabled = true;

    loginButton.classList.add(
        "is-loading"
    );

    showLoading(
        "Memeriksa data pemilih..."
    );

    try {

        const result =
            await apiPost({

                action: "login",

                id_pemilih:
                    idPemilih,

                pin:
                    pin

            });

        if (!result.success) {

            showMessage(
                message,
                result.message ||
                "Login gagal."
            );

            return;

        }


        /* =========================================
           SIMPAN SESSION
        ========================================= */

        sessionToken =
            result.token;

        currentUser =
            result.pemilih;

        sessionExpiresAt =
            Number(
                result.expires_at
            );


        sessionStorage.setItem(
            "evoting_token",
            sessionToken
        );

        sessionStorage.setItem(
            "evoting_user",
            JSON.stringify(
                currentUser
            )
        );

        sessionStorage.setItem(
            "evoting_expires",
            String(
                sessionExpiresAt
            )
        );


        /* =========================================
           USER NAME
        ========================================= */

        const userName =
            document.getElementById(
                "userName"
            );

        if (userName) {

            userName.textContent =
                currentUser.nama || "-";

        }


        /* =========================================
           LOGOUT BUTTON
        ========================================= */

        if (logoutButton) {

            logoutButton.classList.remove(
                "hidden"
            );

        }


        /* =========================================
           MASUK VOTING
        ========================================= */

        showPage(
            votingPage
        );

        startSessionTimer();


        /* =========================================
           LOAD CANDIDATES
        ========================================= */

        loadCandidates()
            .catch(
                function(error) {

                    console.error(
                        "LOAD CANDIDATES:",
                        error
                    );

                }
            );


    } catch (error) {

        console.error(
            "LOGIN ERROR:",
            error
        );

        showMessage(
            message,
            error.message ||
            "Terjadi kesalahan saat login."
        );


    } finally {

        hideLoading();

        loginButton.disabled =
            false;

        loginButton.classList.remove(
            "is-loading"
        );

    }

}


/* =====================================================
   LOAD CANDIDATES
===================================================== */

async function loadCandidates() {

    const grid =
        document.getElementById(
            "candidateGrid"
        );

    if (!grid) {
        return;
    }


    /* =========================================
       RESET
    ========================================= */

    candidates = [];

    updateCandidateCount(0);


    /* =========================================
       LOADING
    ========================================= */

    grid.innerHTML = `

        <div class="candidate-loading">

            <div class="candidate-spinner"></div>

            <span>
                Memuat daftar calon...
            </span>

        </div>

    `;


    try {

        const result =
            await apiGet("calon");


        if (
            !result ||
            !result.success
        ) {

            throw new Error(
                result?.message ||
                "Gagal memuat calon."
            );

        }


        /* =========================================
           AMBIL DATA CALON
        ========================================= */

        candidates =
            Array.isArray(
                result.calon
            )
                ? result.calon
                : [];


        /* =========================================
           URUTKAN BERDASARKAN NOMOR CALON
        ========================================= */

        candidates.sort(
            function(a, b) {

                return (
                    Number(
                        a.nomor_urut || 0
                    ) -
                    Number(
                        b.nomor_urut || 0
                    )
                );

            }
        );


        /* =========================================
           JUMLAH
        ========================================= */

        updateCandidateCount(
            candidates.length
        );


        /* =========================================
           RENDER
        ========================================= */

        renderCandidates();


    } catch (error) {

        console.error(
            "LOAD CANDIDATES ERROR:",
            error
        );

        updateCandidateCount(0);

        grid.innerHTML = `

            <div class="empty-card">

                <strong>
                    Gagal memuat daftar calon
                </strong>

                <span>
                    Periksa koneksi internet Anda.
                </span>

                <button
                    type="button"
                    class="button button-primary"
                    id="retryCandidateButton"
                >
                    Coba Lagi
                </button>

            </div>

        `;


        const retryButton =
            document.getElementById(
                "retryCandidateButton"
            );


        if (retryButton) {

            retryButton.addEventListener(
                "click",
                loadCandidates
            );

        }


        throw error;

    }

}


/* =====================================================
   UPDATE CANDIDATE COUNT
===================================================== */

function updateCandidateCount(
    count
) {

    const element =
        document.getElementById(
            "candidateCount"
        );

    if (!element) {
        return;
    }

    element.textContent =
        Number(count) || 0;

}


/* =====================================================
   FORMAT VISI
===================================================== */

function formatVisi(visi) {

    if (!visi) {
        return "-";
    }

    return escapeHtml(
        String(visi).trim()
    );

}


/* =====================================================
   FORMAT MISI
=====================================================

   Google Sheets:

   Meningkatkan kegiatan kepemudaan;
   membangun komunikasi antar pemuda;
   mengembangkan kegiatan sosial

   Akan menjadi:

   • Meningkatkan kegiatan kepemudaan
   • Membangun komunikasi antar pemuda
   • Mengembangkan kegiatan sosial

===================================================== */

function formatMisi(misi) {

    if (!misi) {

        return `
            <p class="mission-empty">
                Misi belum tersedia.
            </p>
        `;

    }


    const items =
        String(misi)
            .split(";")
            .map(function(item) {

                return item.trim();

            })
            .filter(function(item) {

                return item.length > 0;

            });


    if (items.length === 0) {

        return `
            <p class="mission-empty">
                Misi belum tersedia.
            </p>
        `;

    }


    return `
        <ul class="mission-list">

            ${items.map(function(item) {

                return `
                    <li>
                        ${escapeHtml(item)}
                    </li>
                `;

            }).join("")}

        </ul>
    `;

}


/* =====================================================
   RENDER CANDIDATES
===================================================== */

function renderCandidates() {

    const grid =
        document.getElementById(
            "candidateGrid"
        );

    if (!grid) {
        return;
    }

    grid.innerHTML = "";

    updateCandidateCount(
        candidates.length
    );


    /* =========================================
       TIDAK ADA CALON
    ========================================= */

    if (
        candidates.length === 0
    ) {

        grid.innerHTML = `

            <div class="empty-card">

                <strong>
                    Belum ada calon aktif.
                </strong>

                <span>
                    Silakan hubungi administrator.
                </span>

            </div>

        `;

        return;

    }


    /* =========================================
       FRAGMENT
    ========================================= */

    const fragment =
        document.createDocumentFragment();


    candidates.forEach(
        function(candidate) {

            const card =
                document.createElement(
                    "article"
                );


            card.className =
                "candidate-card";


            card.dataset.id =
                String(
                    candidate.id_calon
                );


            /* =====================================
               NOMOR
            ===================================== */

            const nomor =
                String(
                    candidate.nomor_urut ?? ""
                )
                .padStart(
                    2,
                    "0"
                );


            /* =====================================
               DATA
            ===================================== */

            const nama =
                String(
                    candidate.nama ||
                    "Calon"
                );


            const visi =
                String(
                    candidate.visi ||
                    ""
                );


            const misi =
                String(
                    candidate.misi ||
                    ""
                );


            /* =====================================
               FOTO
            ===================================== */

            const photoUrl =
                normalizeImageUrl(
                    candidate.foto
                );


            const safePhoto =
                escapeAttribute(
                    photoUrl
                );


            const safeName =
                escapeHtml(
                    nama
                );


            /* =====================================
               VISI
            ===================================== */

            const formattedVisi =
                formatVisi(
                    visi
                );


            /* =====================================
               MISI
            ===================================== */

            const formattedMisi =
                formatMisi(
                    misi
                );


            /* =====================================
               CARD HTML
            ===================================== */

            card.innerHTML = `

                <div class="candidate-photo">

                    <img
                        class="candidate-image"
                        src="${safePhoto}"
                        alt="Foto ${safeName}"
                        loading="lazy"
                        decoding="async"
                    >

                    <div class="candidate-number">
                        ${nomor}
                    </div>

                </div>


                <div class="candidate-content">

                    <h3 class="candidate-name">
                        ${safeName}
                    </h3>


                    <!-- =========================
                         VISI SINGKAT
                    ========================== -->

                    <div class="candidate-vision">

                        <strong>
                            Visi
                        </strong>

                        <p>
                            ${formattedVisi}
                        </p>

                    </div>


                    <!-- =========================
                         VISI & MISI DETAIL
                    ========================== -->

                    <details class="mission-details">

                        <summary>
                            Lihat visi &amp; misi
                        </summary>


                        <div class="mission-content">

                            <div class="vision-section">

                                <strong>
                                    Visi
                                </strong>

                                <p>
                                    ${formattedVisi}
                                </p>

                            </div>


                            <div class="misi-section">

                                <strong>
                                    Misi
                                </strong>

                                ${formattedMisi}

                            </div>

                        </div>

                    </details>


                    <!-- =========================
                         BUTTON
                    ========================== -->

                    <button
                        type="button"
                        class="button button-primary select-candidate"
                    >
                        Pilih Calon Ini
                        <span>→</span>
                    </button>


                    <!-- =========================
                         SELECTED BADGE
                    ========================== -->

                    <div class="selected-badge">
                        ✓ Pilihan Anda
                    </div>

                </div>

            `;


            /* =====================================
               IMAGE FALLBACK
            ===================================== */

            const image =
                card.querySelector(
                    ".candidate-image"
                );


            if (image) {

                image.addEventListener(
                    "error",
                    function() {

                        this.onerror =
                            null;

                        this.src =
                            createPlaceholderImage(
                                nomor
                            );

                    },
                    {
                        once: true
                    }
                );

            }


            /* =====================================
               BUTTON
            ===================================== */

            const button =
                card.querySelector(
                    ".select-candidate"
                );


            if (button) {

                button.addEventListener(
                    "click",
                    function(event) {

                        event.preventDefault();

                        event.stopPropagation();

                        selectCandidate(
                            candidate.id_calon
                        );

                    }
                );

            }


            fragment.appendChild(
                card
            );

        }
    );


    grid.appendChild(
        fragment
    );

}


/* =====================================================
   NORMALIZE IMAGE URL
===================================================== */

function normalizeImageUrl(url) {

    if (!url) {
        return createPlaceholderImage("00");
    }

    let value = String(url).trim();

    if (!value) {
        return createPlaceholderImage("00");
    }

    // Google Drive /file/d/FILE_ID/view
    let match = value.match(
        /drive\.google\.com\/file\/d\/([^/?#]+)/
    );

    if (match && match[1]) {
        return (
            "https://drive.google.com/thumbnail?id=" +
            encodeURIComponent(match[1]) +
            "&sz=w1000"
        );
    }

    // Google Drive /thumbnail?id=FILE_ID
    match = value.match(
        /drive\.google\.com\/thumbnail\?[^#]*id=([^&#]+)/
    );

    if (match && match[1]) {
        return (
            "https://drive.google.com/thumbnail?id=" +
            encodeURIComponent(match[1]) +
            "&sz=w1000"
        );
    }

    // Google Drive /open?id=FILE_ID
    match = value.match(
        /drive\.google\.com\/open\?[^#]*id=([^&#]+)/
    );

    if (match && match[1]) {
        return (
            "https://drive.google.com/thumbnail?id=" +
            encodeURIComponent(match[1]) +
            "&sz=w1000"
        );
    }

    // Google Drive /uc?id=FILE_ID
    match = value.match(
        /drive\.google\.com\/uc\?[^#]*id=([^&#]+)/
    );

    if (match && match[1]) {
        return (
            "https://drive.google.com/thumbnail?id=" +
            encodeURIComponent(match[1]) +
            "&sz=w1000"
        );
    }

    // Google Drive URL dengan parameter id
    if (
        value.includes("drive.google.com") &&
        value.includes("id=")
    ) {
        try {

            const parsed = new URL(value);

            const id = parsed.searchParams.get("id");

            if (id) {
                return (
                    "https://drive.google.com/thumbnail?id=" +
                    encodeURIComponent(id) +
                    "&sz=w1000"
                );
            }

        } catch (error) {

            console.warn(
                "URL gambar tidak valid:",
                value
            );

        }
    }

    // URL gambar biasa
    return value;
}


/* =====================================================
   PLACEHOLDER IMAGE
===================================================== */

function createPlaceholderImage(
    number = "00"
) {

    const text =
        encodeURIComponent(
            "Calon " + number
        );

    return (
        "https://placehold.co/1000x750?text=" +
        text
    );

}


/* =====================================================
   SELECT CANDIDATE
===================================================== */

function selectCandidate(
    idCalon
) {

    const candidate =
        candidates.find(
            function(item) {

                return (
                    String(
                        item.id_calon
                    ) ===
                    String(
                        idCalon
                    )
                );

            }
        );


    if (!candidate) {
        return;
    }


    selectedCandidate =
        candidate;


    /* =========================================
       RESET CARD
    ========================================= */

    document
        .querySelectorAll(
            ".candidate-card"
        )
        .forEach(
            function(card) {

                card.classList.remove(
                    "selected"
                );

            }
        );


    /* =========================================
       SELECTED CARD
    ========================================= */

    const selectedCard =
        document.querySelector(
            '.candidate-card[data-id="' +
            CSS.escape(
                String(
                    idCalon
                )
            ) +
            '"]'
        );


    if (selectedCard) {

        selectedCard.classList.add(
            "selected"
        );

    }


    /* =========================================
       SELECTED NAME
    ========================================= */

    const selectedName =
        document.getElementById(
            "selectedCandidateName"
        );


    if (selectedName) {

        selectedName.textContent =
            candidate.nama || "-";

    }


    /* =========================================
       SELECTED NUMBER
    ========================================= */

    const selectedNumber =
        document.getElementById(
            "selectedCandidateNumber"
        );


    if (selectedNumber) {

        selectedNumber.textContent =
            String(
                candidate.nomor_urut ?? ""
            )
            .padStart(
                2,
                "0"
            );

    }


    /* =========================================
       SELECTED PANEL
    ========================================= */

    const selectedInfo =
        document.getElementById(
            "selectedInfo"
        );


    if (selectedInfo) {

        selectedInfo.classList.remove(
            "hidden"
        );


        if (
            window.innerWidth <=
            768
        ) {

            setTimeout(
                function() {

                    selectedInfo.scrollIntoView({
                        behavior: "smooth",
                        block: "nearest"
                    });

                },
                50
            );

        }

    }

}


/* =====================================================
   CONFIRM
===================================================== */

const confirmVoteButton =
    document.getElementById(
        "confirmVoteButton"
    );
if (confirmVoteButton) {

    confirmVoteButton.addEventListener(
        "click",
        showConfirmation
    );
}
function showConfirmation() {
    if (!selectedCandidate) {
        alert(
            "Silakan pilih calon terlebih dahulu."
        );
        return;
    }

    const nomor =
        String(
            selectedCandidate.nomor_urut ?? ""
        )
        .padStart(
            2,
            "0"
        );
    const number =
        document.getElementById(
            "confirmationNumber"
        );
    const name =
        document.getElementById(
            "confirmationName"
        );


    if (number) {

        number.textContent =
            nomor;

    }


    if (name) {

        name.textContent =
            selectedCandidate.nama ||
            "-";

    }


    clearMessage(
        document.getElementById(
            "voteMessage"
        )
    );


    showPage(
        confirmPage
    );

}


/* =====================================================
   BACK TO VOTING
===================================================== */

const backToVotingButton =
    document.getElementById(
        "backToVotingButton"
    );


if (backToVotingButton) {

    backToVotingButton.addEventListener(
        "click",
        function() {

            showPage(
                votingPage
            );

        }
    );

}


/* =====================================================
   SUBMIT VOTE
===================================================== */

const submitVoteButton =
    document.getElementById(
        "submitVoteButton"
    );


if (submitVoteButton) {

    submitVoteButton.addEventListener(
        "click",
        submitVote
    );

}


async function submitVote() {

    const button =
        document.getElementById(
            "submitVoteButton"
        );


    const message =
        document.getElementById(
            "voteMessage"
        );


    if (!selectedCandidate) {

        showMessage(
            message,
            "Silakan pilih calon terlebih dahulu."
        );

        return;

    }


    if (!sessionToken) {

        showMessage(
            message,
            "Session Anda tidak ditemukan. Silakan login kembali."
        );

        return;

    }


    button.disabled = true;

    button.classList.add(
        "is-loading"
    );


    showLoading(
        "Menyimpan suara Anda..."
    );


    try {

        const result =
            await apiPost({

                action: "vote",

                token:
                    sessionToken,

                id_calon:
                    selectedCandidate.id_calon

            });


        if (!result.success) {

            showMessage(
                message,
                result.message ||
                "Suara gagal disimpan."
            );

            return;

        }


        /* =========================================
           VOTE ID
        ========================================= */

        const voteId =
            document.getElementById(
                "voteId"
            );


        if (voteId) {

            voteId.textContent =
                result.vote_id ||
                "-";

        }


        /* =========================================
           CLEAR SESSION
        ========================================= */

        sessionToken = null;

        currentUser = null;

        selectedCandidate = null;


        sessionStorage.removeItem(
            "evoting_token"
        );

        sessionStorage.removeItem(
            "evoting_user"
        );

        sessionStorage.removeItem(
            "evoting_expires"
        );


        stopSessionTimer();


        if (logoutButton) {

            logoutButton.classList.add(
                "hidden"
            );

        }


        /* =========================================
           SUCCESS
        ========================================= */

        showPage(
            successPage
        );


    } catch (error) {

        console.error(
            "SUBMIT VOTE ERROR:",
            error
        );


        showMessage(
            message,
            error.message ||
            "Terjadi kesalahan saat menyimpan suara."
        );


    } finally {

        hideLoading();

        button.disabled =
            false;

        button.classList.remove(
            "is-loading"
        );

    }

}


/* =====================================================
   RESULT
===================================================== */

const viewResultButton =
    document.getElementById(
        "viewResultButton"
    );


if (viewResultButton) {

    viewResultButton.addEventListener(
        "click",
        loadResults
    );

}


async function loadResults() {

    showLoading(
        "Memuat hasil pemilihan..."
    );


    try {

        const result =
            await apiGet("hasil");


        if (!result.success) {

            throw new Error(
                result.message ||
                "Gagal memuat hasil."
            );

        }


        renderResults(
            result.hasil || []
        );


        showPage(
            resultPage
        );


    } catch (error) {

        console.error(
            "RESULT ERROR:",
            error
        );


        alert(
            error.message ||
            "Gagal memuat hasil."
        );


    } finally {

        hideLoading();

    }

}


/* =====================================================
   RENDER RESULT
===================================================== */

function renderResults(
    results
) {

    const grid =
        document.getElementById(
            "resultGrid"
        );


    if (!grid) {
        return;
    }


    grid.innerHTML = "";


    if (
        !Array.isArray(results) ||
        results.length === 0
    ) {

        grid.innerHTML = `

            <div class="empty-card">

                <strong>
                    Belum ada suara.
                </strong>

            </div>

        `;

        return;

    }


    /* =========================================
       TOTAL VOTES
    ========================================= */

    const totalVotes =
        results.reduce(
            function(total, item) {

                return (
                    total +
                    Number(
                        item.suara || 0
                    )
                );

            },
            0
        );


    /* =========================================
       SORT
    ========================================= */

    const sorted =
        [...results].sort(
            function(a, b) {

                return (
                    Number(
                        b.suara || 0
                    ) -
                    Number(
                        a.suara || 0
                    )
                );

            }
        );


    const fragment =
        document.createDocumentFragment();


    sorted.forEach(
        function(
            candidate,
            index
        ) {

            const votes =
                Number(
                    candidate.suara ||
                    0
                );


            const percentage =
                totalVotes > 0
                    ? (
                        votes /
                        totalVotes
                    ) * 100
                    : 0;


            const card =
                document.createElement(
                    "div"
                );


            card.className =
                "result-card";


            const nomor =
                String(
                    candidate.nomor_urut ??
                    ""
                )
                .padStart(
                    2,
                    "0"
                );


            const nama =
                escapeHtml(
                    candidate.nama ||
                    "Calon"
                );


            card.innerHTML = `

                <div class="result-rank">
                    ${index + 1}
                </div>


                <div class="result-main">

                    <div class="result-name">

                        No.
                        ${nomor}

                        •

                        ${nama}

                    </div>


                    <div class="result-bar-wrapper">

                        <div
                            class="result-bar"
                            style="width:${percentage}%"
                        ></div>

                    </div>

                </div>


                <div class="result-votes">

                    <strong>
                        ${votes}
                    </strong>

                    <span>
                        ${percentage.toFixed(1)}%
                    </span>

                </div>

            `;


            fragment.appendChild(
                card
            );

        }
    );


    grid.appendChild(
        fragment
    );


    /* =========================================
       TOTAL
    ========================================= */

    const total =
        document.createElement(
            "p"
        );


    total.className =
        "result-total";


    total.textContent =
        "Total suara masuk: " +
        totalVotes;


    grid.appendChild(
        total
    );

}


/* =====================================================
   REFRESH RESULT
===================================================== */

const refreshResultButton =
    document.getElementById(
        "refreshResultButton"
    );


if (refreshResultButton) {

    refreshResultButton.addEventListener(
        "click",
        loadResults
    );

}


/* =====================================================
   LOGOUT
===================================================== */

if (logoutButton) {

    logoutButton.addEventListener(
        "click",
        handleLogout
    );

}


async function handleLogout() {

    if (!sessionToken) {

        clearLocalSession();

        showPage(
            loginPage
        );

        return;

    }


    showLoading(
        "Keluar dari sistem..."
    );


    try {

        await apiPost({

            action: "logout",

            token:
                sessionToken

        });


    } catch (error) {

        console.error(
            "LOGOUT ERROR:",
            error
        );


    } finally {

        clearLocalSession();

        hideLoading();

        showPage(
            loginPage
        );

    }

}


/* =====================================================
   CLEAR SESSION
===================================================== */

function clearLocalSession() {

    sessionToken = null;

    currentUser = null;

    selectedCandidate = null;

    sessionExpiresAt = null;

    candidates = [];


    sessionStorage.removeItem(
        "evoting_token"
    );

    sessionStorage.removeItem(
        "evoting_user"
    );

    sessionStorage.removeItem(
        "evoting_expires"
    );


    stopSessionTimer();


    if (logoutButton) {

        logoutButton.classList.add(
            "hidden"
        );

    }


    const form =
        document.getElementById(
            "loginForm"
        );


    if (form) {

        form.reset();

    }


    clearMessage(
        document.getElementById(
            "loginMessage"
        )
    );


    const selectedInfo =
        document.getElementById(
            "selectedInfo"
        );


    if (selectedInfo) {

        selectedInfo.classList.add(
            "hidden"
        );

    }


    updateCandidateCount(0);

}


/* =====================================================
   SESSION TIMER
===================================================== */

function startSessionTimer() {

    stopSessionTimer();

    updateSessionTimer();

    sessionTimerInterval =
        setInterval(
            updateSessionTimer,
            1000
        );

}


function stopSessionTimer() {

    if (
        sessionTimerInterval
    ) {

        clearInterval(
            sessionTimerInterval
        );

        sessionTimerInterval =
            null;

    }

}


function updateSessionTimer() {

    const timer =
        document.getElementById(
            "sessionTimer"
        );


    if (!timer) {
        return;
    }


    if (!sessionExpiresAt) {

        timer.textContent =
            "Session aktif";

        return;

    }


    const remaining =
        Number(
            sessionExpiresAt
        ) -
        Date.now();


    if (remaining <= 0) {

        stopSessionTimer();

        clearLocalSession();

        alert(
            "Session Anda telah berakhir. Silakan login kembali."
        );

        showPage(
            loginPage
        );

        return;

    }


    const totalSeconds =
        Math.floor(
            remaining / 1000
        );


    const minutes =
        Math.floor(
            totalSeconds / 60
        );


    const seconds =
        totalSeconds % 60;


    timer.textContent =
        "Session " +
        minutes +
        ":" +
        String(
            seconds
        ).padStart(
            2,
            "0"
        );

}


/* =====================================================
   RESTORE SESSION
===================================================== */

function restoreSession() {

    const savedToken =
        sessionStorage.getItem(
            "evoting_token"
        );


    const savedUser =
        sessionStorage.getItem(
            "evoting_user"
        );


    const savedExpires =
        sessionStorage.getItem(
            "evoting_expires"
        );


    if (
        !savedToken ||
        !savedUser ||
        !savedExpires
    ) {

        return false;

    }


    try {

        sessionToken =
            savedToken;


        currentUser =
            JSON.parse(
                savedUser
            );


        sessionExpiresAt =
            Number(
                savedExpires
            );


        if (
            Date.now() >=
            sessionExpiresAt
        ) {

            clearLocalSession();

            return false;

        }


        const userName =
            document.getElementById(
                "userName"
            );


        if (userName) {

            userName.textContent =
                currentUser.nama ||
                "-";

        }


        if (logoutButton) {

            logoutButton.classList.remove(
                "hidden"
            );

        }


        return true;


    } catch (error) {

        console.error(
            "RESTORE SESSION ERROR:",
            error
        );


        clearLocalSession();


        return false;

    }

}


/* =====================================================
   ESCAPE HTML
===================================================== */

function escapeHtml(
    value
) {

    return String(
        value ?? ""
    )
    .replace(
        /&/g,
        "&amp;"
    )
    .replace(
        /</g,
        "&lt;"
    )
    .replace(
        />/g,
        "&gt;"
    )
    .replace(
        /"/g,
        "&quot;"
    )
    .replace(
        /'/g,
        "&#039;"
    );

}


/* =====================================================
   ESCAPE ATTRIBUTE
===================================================== */

function escapeAttribute(
    value
) {

    return escapeHtml(
        value
    );

}


/* =====================================================
   INITIALIZATION
===================================================== */

async function init() {

    const restored =
        restoreSession();


    if (restored) {

        showPage(
            votingPage
        );


        startSessionTimer();


        loadCandidates()
            .catch(
                function(error) {

                    console.error(
                        "INIT LOAD CANDIDATES:",
                        error
                    );

                }
            );


    } else {

        showPage(
            loginPage
        );

    }

}


/* =====================================================
   START
===================================================== */

init();