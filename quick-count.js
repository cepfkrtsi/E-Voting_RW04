/**
 * ================================================================
 * E-VOTING RW 04
 * QUICK COUNT JAVASCRIPT
 * VERSION FINAL
 * ================================================================
 *
 * SUMBER DATA:
 * 1. ONLINE  -> Apps Script E-Voting utama
 * 2. OFFLINE -> QuickCount.gs -> Google Spreadsheet "OFFLINE"
 *
 * FITUR:
 * - ONLINE menggunakan API E-Voting utama
 * - OFFLINE menggunakan QuickCount.gs API
 * - OFFLINE TIDAK menggunakan Published CSV
 * - ONLINE dan OFFLINE dimuat bersamaan
 * - Auto refresh setiap 5 detik
 * - Jika salah satu sumber gagal, sumber lainnya tetap digunakan
 * - Data lama dipertahankan jika request gagal
 * - Data ONLINE membaca response "hasil"
 * - Data OFFLINE membaca response "data"
 *
 * FORMAT SHEET OFFLINE:
 *
 * tanggal | calon_id | suara | tidak_sah
 *
 * ================================================================
 */


/* ================================================================
   KONFIGURASI
   ================================================================ */


/*
 * ==============================================================
 * API E-VOTING UTAMA
 * ==============================================================
 */
const API_URL =
    "https://script.google.com/macros/s/AKfycbw-yX3a_9GzhCCtByS4g_IXRJsVhMN-CnvJsKQ0EFu-01n_mwa_Jftt6ex9IlYtHQ0W0g/exec";


/*
 * ==============================================================
 * API QUICK COUNT OFFLINE
 * ==============================================================
 *
 * QuickCount.gs
 */
const OFFLINE_API_URL =
    "https://script.google.com/macros/s/AKfycbw1rAEtUPJuALTYw7y1awpJYfqk5oe3FvvxnQux4HnzjsvYkAyuELYLaL5pw6oIX4Ar/exec";


/*
 * ==============================================================
 * AUTO REFRESH
 * ==============================================================
 *
 * 5 detik
 */
const AUTO_REFRESH_INTERVAL =
    5 * 1000;


/*
 * ==============================================================
 * REQUEST TIMEOUT
 * ==============================================================
 */
const REQUEST_TIMEOUT =
    15000;


/* ================================================================
   STATE
   ================================================================ */

let onlineResults = [];

let offlineResults = [];

let combinedResults = [];

let lastUpdateTime = null;

let autoRefreshTimer = null;

let isLoading = false;


/* ================================================================
   DOM ELEMENT
   ================================================================ */

const electionName =
    document.getElementById(
        "electionName"
    );


const electionStatus =
    document.getElementById(
        "electionStatus"
    );


const resultsContainer =
    document.getElementById(
        "resultsContainer"
    );


const detailTableBody =
    document.getElementById(
        "detailTableBody"
    );


const winnerCard =
    document.getElementById(
        "winnerCard"
    );


const winnerName =
    document.getElementById(
        "winnerName"
    );


const winnerVotes =
    document.getElementById(
        "winnerVotes"
    );


const winnerDetail =
    document.getElementById(
        "winnerDetail"
    );


const lastUpdate =
    document.getElementById(
        "lastUpdate"
    );


const refreshButton =
    document.getElementById(
        "refreshButton"
    );


const offlineSourceStatus =
    document.getElementById(
        "offlineSourceStatus"
    );


/*
 * Beberapa kemungkinan nama element status.
 */
const connectionStatus =
    document.getElementById(
        "connectionStatus"
    ) ||
    document.getElementById(
        "connection-status"
    ) ||
    document.getElementById(
        "statusConnection"
    );


const loadingIndicator =
    document.getElementById(
        "loadingIndicator"
    ) ||
    document.getElementById(
        "loading"
    );


/* ================================================================
   HELPER - ESCAPE HTML
   ================================================================ */

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


/* ================================================================
   HELPER - NUMBER
   ================================================================ */

function formatNumber(
    value
) {

    const number =
        Number(
            value || 0
        );


    return number.toLocaleString(
        "id-ID"
    );

}


/* ================================================================
   HELPER - PERCENTAGE
   ================================================================ */

function percentage(
    value,
    total
) {

    const v =
        Number(
            value || 0
        );


    const t =
        Number(
            total || 0
        );


    if (
        t <= 0
    ) {

        return 0;

    }


    return (
        v / t
    ) * 100;

}


/* ================================================================
   SAFE FETCH
   ================================================================ */

async function safeFetch(
    url,
    options = {}
) {

    const controller =
        new AbortController();


    const timeout =
        setTimeout(
            function() {

                controller.abort();

            },
            REQUEST_TIMEOUT
        );


    try {

        const response =
            await fetch(
                url,
                {
                    ...options,
                    signal:
                        controller.signal
                }
            );


        return response;

    } catch (
        error
    ) {

        if (
            error &&
            error.name ===
                "AbortError"
        ) {

            throw new Error(
                "Request timeout."
            );

        }


        throw error;

    } finally {

        clearTimeout(
            timeout
        );

    }

}


/* ================================================================
   API GET ONLINE
   ================================================================ */

async function apiGet(
    action
) {

    const url =
        API_URL +
        "?action=" +
        encodeURIComponent(
            action
        ) +
        "&_=" +
        Date.now();


    const response =
        await safeFetch(
            url,
            {
                method:
                    "GET",

                cache:
                    "no-store",

                headers: {
                    "Accept":
                        "application/json"
                }
            }
        );


    if (
        !response.ok
    ) {

        throw new Error(
            "HTTP " +
            response.status
        );

    }


    const result =
        await response.json();


    return result;

}


/* ================================================================
   API POST ONLINE
   ================================================================ */

async function apiPost(
    data
) {

    const response =
        await safeFetch(
            API_URL +
            "?_=" +
            Date.now(),
            {
                method:
                    "POST",

                cache:
                    "no-store",

                headers: {
                    "Content-Type":
                        "text/plain;charset=utf-8"
                },

                body:
                    JSON.stringify(
                        data
                    )
            }
        );


    if (
        !response.ok
    ) {

        throw new Error(
            "HTTP " +
            response.status
        );

    }


    return await response.json();

}


/* ================================================================
   LOAD ONLINE RESULTS
   ================================================================ */

async function loadOnlineResults() {

    /*
     * ==========================================================
     * AMBIL TOKEN ADMIN
     * ==========================================================
     *
     * Token yang digunakan sistem E-Voting:
     *
     * 1. sessionStorage admin_token
     * 2. sessionStorage evoting_admin_token
     * 3. localStorage admin_token
     *
     * JANGAN menggunakan "adminToken".
     */

    let adminToken =
        null;


    try {

        adminToken =
            sessionStorage.getItem(
                "admin_token"
            ) ||
            sessionStorage.getItem(
                "evoting_admin_token"
            );

    } catch (
        error
    ) {

        console.warn(
            "SessionStorage tidak dapat diakses:",
            error
        );

    }


    /*
     * Jika token belum ditemukan,
     * coba localStorage.
     */

    if (
        !adminToken
    ) {

        try {

            adminToken =
                localStorage.getItem(
                    "admin_token"
                );

        } catch (
            error
        ) {

            console.warn(
                "LocalStorage tidak dapat diakses:",
                error
            );

        }

    }


    /*
     * ==========================================================
     * DEBUG TOKEN
     * ==========================================================
     */

    console.log(
        "STATUS TOKEN ADMIN:",
        adminToken
            ? "DITEMUKAN"
            : "TIDAK DITEMUKAN"
    );


    /*
     * ==========================================================
     * ADMIN RESULTS
     * ==========================================================
     *
     * Jika token tersedia,
     * gunakan endpoint admin_results.
     */

    if (
        adminToken
    ) {

        try {

            const result =
                await apiPost(
                    {
                        action:
                            "admin_results",

                        token:
                            adminToken
                    }
                );


            console.log(
                "RESPONSE ADMIN RESULTS:",
                result
            );


            /*
             * Response yang benar:
             *
             * {
             *     success: true,
             *     hasil: [...]
             * }
             */

            if (
                result &&
                result.success
            ) {

                return {

                    results:
                        Array.isArray(
                            result.hasil
                        )
                            ? result.hasil
                            : [],

                    authenticated:
                        true

                };

            }


            console.warn(
                "admin_results tidak berhasil. Mencoba endpoint hasil publik."
            );

        } catch (
            error
        ) {

            console.warn(
                "admin_results gagal:",
                error
            );

        }

    }


    /*
     * ==========================================================
     * FALLBACK HASIL PUBLIK
     * ==========================================================
     */

    const result =
        await apiGet(
            "hasil"
        );


    console.log(
        "RESPONSE HASIL ONLINE:",
        result
    );


    if (
        !result ||
        result.success === false
    ) {

        throw new Error(
            result &&
            result.message
                ? result.message
                : "Data online gagal dimuat."
        );

    }


    /*
     * Response yang benar:
     *
     * {
     *     success: true,
     *     hasil: [...]
     * }
     */

    return {

        results:
            Array.isArray(
                result.hasil
            )
                ? result.hasil
                : [],

        authenticated:
            false

    };

}


/* ================================================================
   LOAD OFFLINE RESULTS
   ================================================================ */

async function loadOfflineResults() {

    /*
     * Pastikan URL tersedia.
     */

    if (
        !OFFLINE_API_URL ||
        OFFLINE_API_URL.includes(
            "PASTE_URL_WEB_APP"
        )
    ) {

        throw new Error(
            "OFFLINE_API_URL belum diisi dengan URL Web App QuickCount.gs."
        );

    }


    /*
     * Cache busting.
     */

    const url =
        OFFLINE_API_URL +
        "?action=offline_results&_=" +
        Date.now();


    console.log(
        "REQUEST OFFLINE:",
        url
    );


    const response =
        await safeFetch(
            url,
            {
                method:
                    "GET",

                cache:
                    "no-store",

                headers: {
                    "Accept":
                        "application/json"
                }
            }
        );


    if (
        !response.ok
    ) {

        throw new Error(
            "Offline API HTTP " +
            response.status
        );

    }


    const result =
        await response.json();


    console.log(
        "RESPONSE OFFLINE:",
        result
    );


    /*
     * Validasi response QuickCount.gs.
     */

    if (
        !result ||
        result.success !== true
    ) {

        throw new Error(
            result &&
            result.message
                ? result.message
                : "Offline API gagal mengembalikan data."
        );

    }


    /*
     * Response QuickCount.gs:
     *
     * {
     *     success: true,
     *     data: [...]
     * }
     */

    if (
        !Array.isArray(
            result.data
        )
    ) {

        throw new Error(
            "Format data Offline tidak valid."
        );

    }


    console.log(
        "OFFLINE API BERHASIL:",
        {
            count:
                result.count,

            server_time:
                result.server_time,

            data:
                result.data
        }
    );


    return result.data;

}


/* ================================================================
   NORMALIZE ONLINE
   ================================================================ */

function normalizeOnline(
    rows
) {

    if (
        !Array.isArray(
            rows
        )
    ) {

        return [];

    }


    return rows
        .map(
            function(row) {

                if (
                    !row
                ) {

                    return null;

                }


                /*
                 * ID CALON
                 */

                const calonId =
                    String(
                        row.id_calon ??
                        row.calon_id ??
                        row.id ??
                        ""
                    )
                    .trim()
                    .toUpperCase();


                if (
                    !calonId
                ) {

                    return null;

                }


                /*
                 * SUARA
                 */

                const suara =
                    Number(
                        row.suara ??
                        row.votes ??
                        row.vote ??
                        0
                    ) || 0;


                /*
                 * NOMOR URUT
                 */

                const nomorUrut =
                    row.nomor_urut ??
                    row.nomor ??
                    "";


                /*
                 * NAMA
                 */

                const nama =
                    String(
                        row.nama ??
                        row.nama_calon ??
                        calonId
                    )
                    .trim();


                return {

                    calon_id:
                        calonId,

                    nama:
                        nama,

                    nomor_urut:
                        nomorUrut,

                    suara:
                        suara

                };

            }
        )
        .filter(
            function(item) {

                return Boolean(
                    item
                );

            }
        );

}


/* ================================================================
   NORMALIZE OFFLINE
   ================================================================ */

function normalizeOffline(
    rows
) {

    if (
        !Array.isArray(
            rows
        )
    ) {

        return [];

    }


    /*
     * Data dari QuickCount.gs:
     *
     * {
     *     tanggal,
     *     calon_id,
     *     suara,
     *     tidak_sah
     * }
     *
     * Semua baris dengan calon_id
     * yang sama dijumlahkan.
     */

    const grouped =
        {};


    rows.forEach(
        function(row) {

            if (
                !row
            ) {

                return;

            }


            /*
             * ID CALON
             */

            const calonId =
                String(
                    row.calon_id ??
                    row.id_calon ??
                    ""
                )
                .trim()
                .toUpperCase();


            if (
                !calonId
            ) {

                return;

            }


            /*
             * SUARA OFFLINE
             */

            const suara =
                Number(
                    row.suara ?? 0
                ) || 0;


            /*
             * SUARA TIDAK SAH
             */

            const tidakSah =
                Number(
                    row.tidak_sah ?? 0
                ) || 0;


            /*
             * Buat object calon
             * jika belum ada.
             */

            if (
                !grouped[
                    calonId
                ]
            ) {

                grouped[
                    calonId
                ] = {

                    calon_id:
                        calonId,

                    offline:
                        0,

                    tidak_sah:
                        0,

                    tanggal:
                        row.tanggal ||
                        ""

                };

            }


            /*
             * Tambahkan suara.
             */

            grouped[
                calonId
            ].offline +=
                suara;


            /*
             * Tambahkan suara tidak sah.
             */

            grouped[
                calonId
            ].tidak_sah +=
                tidakSah;

        }
    );


    return Object.values(
        grouped
    );

}


/* ================================================================
   COMBINE ONLINE + OFFLINE
   ================================================================ */

function combineResults(
    online,
    offline
) {

    const map =
        {};


    /*
     * ==========================================================
     * ONLINE
     * ==========================================================
     */

    online.forEach(
        function(item) {

            const id =
                String(
                    item.calon_id
                )
                .trim()
                .toUpperCase();


            if (
                !id
            ) {

                return;

            }


            /*
             * Jika calon belum ada,
             * buat object baru.
             */

            if (
                !map[id]
            ) {

                map[id] = {

                    calon_id:
                        id,

                    nama:
                        item.nama ||
                        id,

                    nomor_urut:
                        item.nomor_urut ??
                        "",

                    online:
                        0,

                    offline:
                        0,

                    tidak_sah:
                        0,

                    total:
                        0,

                    percentage:
                        0,

                    rank:
                        0

                };

            }


            /*
             * Tambahkan suara ONLINE.
             */

            map[id].online +=
                Number(
                    item.suara || 0
                );


            /*
             * Update nama.
             */

            if (
                item.nama
            ) {

                map[id].nama =
                    item.nama;

            }


            /*
             * Update nomor urut.
             */

            if (
                item.nomor_urut !==
                    undefined &&
                item.nomor_urut !==
                    null &&
                item.nomor_urut !==
                    ""
            ) {

                map[id].nomor_urut =
                    item.nomor_urut;

            }

        }
    );


    /*
     * ==========================================================
     * OFFLINE
     * ==========================================================
     */

    offline.forEach(
        function(item) {

            const id =
                String(
                    item.calon_id
                )
                .trim()
                .toUpperCase();


            if (
                !id
            ) {

                return;

            }


            /*
             * Jika calon hanya ada di OFFLINE,
             * tetap masukkan ke hasil.
             */

            if (
                !map[id]
            ) {

                map[id] = {

                    calon_id:
                        id,

                    nama:
                        id,

                    nomor_urut:
                        "",

                    online:
                        0,

                    offline:
                        0,

                    tidak_sah:
                        0,

                    total:
                        0,

                    percentage:
                        0,

                    rank:
                        0

                };

            }


            /*
             * Tambahkan suara OFFLINE.
             */

            map[id].offline +=
                Number(
                    item.offline || 0
                );


            /*
             * Tambahkan suara TIDAK SAH.
             */

            map[id].tidak_sah +=
                Number(
                    item.tidak_sah || 0
                );

        }
    );


    /*
     * ==========================================================
     * HASIL OBJECT
     * ==========================================================
     */

    const results =
        Object.values(
            map
        );


    /*
     * ==========================================================
     * TOTAL SUARA ONLINE + OFFLINE
     * ==========================================================
     */

    results.forEach(
        function(item) {

            item.total =
                Number(
                    item.online || 0
                ) +
                Number(
                    item.offline || 0
                );

        }
    );


    /*
     * ==========================================================
     * SORTING / RANKING
     * ==========================================================
     *
     * Suara terbesar berada di atas.
     *
     * Jika jumlah suara sama,
     * nomor urut calon menjadi tie breaker.
     */

    results.sort(
        function(a, b) {

            const voteDifference =
                Number(
                    b.total || 0
                ) -
                Number(
                    a.total || 0
                );


            if (
                voteDifference !==
                0
            ) {

                return voteDifference;

            }


            const nomorA =
                Number(
                    a.nomor_urut
                ) || 999999;


            const nomorB =
                Number(
                    b.nomor_urut
                ) || 999999;


            return nomorA -
                nomorB;

        }
    );


    /*
     * ==========================================================
     * TOTAL SUARA SAH
     * ==========================================================
     *
     * Suara sah =
     * online + offline.
     */

    const totalVotes =
        results.reduce(
            function(
                total,
                item
            ) {

                return (
                    total +
                    Number(
                        item.total || 0
                    )
                );

            },
            0
        );


    /*
     * ==========================================================
     * PERSENTASE + RANK
     * ==========================================================
     */

    results.forEach(
        function(
            item,
            index
        ) {

            item.rank =
                index + 1;


            item.percentage =
                percentage(
                    item.total,
                    totalVotes
                );

        }
    );


    return results;

}


/* ================================================================
   CALCULATE SUMMARY
   ================================================================ */

function calculateSummary(
    results,
    offline
) {

    /*
     * ==========================================================
     * TOTAL ONLINE
     * ==========================================================
     */

    const totalOnline =
        results.reduce(
            function(
                total,
                item
            ) {

                return (
                    total +
                    Number(
                        item.online || 0
                    )
                );

            },
            0
        );


    /*
     * ==========================================================
     * TOTAL OFFLINE
     * ==========================================================
     */

    const totalOffline =
        results.reduce(
            function(
                total,
                item
            ) {

                return (
                    total +
                    Number(
                        item.offline || 0
                    )
                );

            },
            0
        );


    /*
     * ==========================================================
     * TOTAL TIDAK SAH
     * ==========================================================
     */

    const totalInvalid =
        offline.reduce(
            function(
                total,
                item
            ) {

                return (
                    total +
                    Number(
                        item.tidak_sah || 0
                    )
                );

            },
            0
        );


    /*
     * ==========================================================
     * TOTAL SUARA SAH
     * ==========================================================
     */

    const totalValid =
        totalOnline +
        totalOffline;


    /*
     * ==========================================================
     * TOTAL SEMUA
     * ==========================================================
     */

    const totalAll =
        totalValid +
        totalInvalid;


    return {

        online:
            totalOnline,

        offline:
            totalOffline,

        valid:
            totalValid,

        invalid:
            totalInvalid,

        total:
            totalAll

    };

}


/* ================================================================
   SET LOADING
   ================================================================ */

function setLoading(
    loading
) {

    if (
        loadingIndicator
    ) {

        loadingIndicator.classList.toggle(
            "hidden",
            !loading
        );

    }


    if (
        refreshButton
    ) {

        refreshButton.disabled =
            loading;

    }

}


/* ================================================================
   CONNECTION STATUS
   ================================================================ */

function setConnectionStatus(
    type,
    text
) {

    if (
        !connectionStatus
    ) {

        return;

    }


    connectionStatus.textContent =
        text;


    connectionStatus.classList.remove(
        "online",
        "loading",
        "error"
    );


    if (
        type
    ) {

        connectionStatus.classList.add(
            type
        );

    }

}


/* ================================================================
   TOAST
   ================================================================ */

function showToast(
    message
) {

    /*
     * Gunakan toast project jika tersedia.
     */

    if (
        window.__quickCountToast
    ) {

        window.__quickCountToast(
            message
        );

        return;

    }


    /*
     * Toast existing.
     */

    const existing =
        document.getElementById(
            "toast"
        );


    if (
        existing
    ) {

        existing.textContent =
            message;


        existing.classList.add(
            "show"
        );


        setTimeout(
            function() {

                existing.classList.remove(
                    "show"
                );

            },
            2500
        );


        return;

    }


    /*
     * Fallback console.
     */

    console.log(
        "[QUICK COUNT]",
        message
    );

}


/* ================================================================
   RENDER SUMMARY
   ================================================================ */

function renderSummary(summary) {
    const onlineEl = document.getElementById("onlineTotal");
    const offlineEl = document.getElementById("offlineTotal");
    const grandEl = document.getElementById("grandTotal");
    const invalidEl = document.getElementById("invalidTotal");
    const headingEl = document.getElementById("headingTotal");

    if (onlineEl) {
        onlineEl.textContent = formatNumber(summary.online);
    }

    if (offlineEl) {
        offlineEl.textContent = formatNumber(summary.offline);
    }

    if (grandEl) {
        grandEl.textContent = formatNumber(summary.valid);
    }

    if (invalidEl) {
        invalidEl.textContent = formatNumber(summary.invalid);
    }

    if (headingEl) {
        headingEl.textContent = formatNumber(summary.valid);
    }
}


/* ================================================================
   RENDER WINNER
   ================================================================ */

function renderWinner(
    results
) {

    if (
        !winnerCard
    ) {

        return;

    }


    if (
        !results.length
    ) {

        winnerCard.classList.add(
            "hidden"
        );

        return;

    }


    const winner =
        results[0];


    winnerCard.classList.remove(
        "hidden"
    );


    if (
        winnerName
    ) {

        winnerName.textContent =
            winner.nama;

    }


    if (
        winnerVotes
    ) {

        winnerVotes.textContent =
            formatNumber(
                winner.total
            );

    }


    if (
        winnerDetail
    ) {

        winnerDetail.textContent =
            "ID " +
            winner.calon_id +
            " • Online " +
            formatNumber(
                winner.online
            ) +
            " • Offline " +
            formatNumber(
                winner.offline
            );

    }

}


/* ================================================================
   RENDER RESULTS
   ================================================================ */

function renderResults(
    results
) {

    if (
        !resultsContainer
    ) {

        return;

    }


    if (
        !results.length
    ) {

        resultsContainer.innerHTML = `
            <div class="empty-state">

                <div class="empty-state-icon">
                    🗳️
                </div>

                <strong>
                    Belum ada data suara
                </strong>

                <span>
                    Belum terdapat suara online maupun offline.
                </span>

            </div>
        `;

        return;

    }


    /*
     * Total suara sah.
     */

    const totalVotes =
        results.reduce(
            function(
                total,
                item
            ) {

                return (
                    total +
                    Number(
                        item.total || 0
                    )
                );

            },
            0
        );


    /*
     * Render kandidat.
     */

    resultsContainer.innerHTML =
        results.map(
            function(item) {

                const rankClass =
                    item.rank === 1
                        ? "rank-one"
                        : item.rank === 2
                            ? "rank-two"
                            : item.rank === 3
                                ? "rank-three"
                                : "";


                const width =
                    Math.max(
                        0,
                        Math.min(
                            100,
                            percentage(
                                item.total,
                                totalVotes
                            )
                        )
                    );


                /*
                 * Nomor calon.
                 */

                let nomor =
                    item.nomor_urut;


                if (
                    nomor !== "" &&
                    nomor !== null &&
                    nomor !== undefined
                ) {

                    nomor =
                        String(
                            nomor
                        ).padStart(
                            2,
                            "0"
                        );

                } else {

                    nomor =
                        item.calon_id;

                }


                return `
                    <article
                        class="result-item ${rankClass}"
                    >

                        <div class="rank-box">
                            ${item.rank}
                        </div>


                        <div class="candidate-info">

                            <span class="candidate-number">
                                CALON ${escapeHtml(nomor)}
                            </span>


                            <strong class="candidate-name">
                                ${escapeHtml(item.nama)}
                            </strong>


                            <span class="candidate-sub">
                                ID: ${escapeHtml(item.calon_id)}
                            </span>


                            <div class="source-split">

                                <span class="source-chip online">
                                    🌐 ${formatNumber(item.online)}
                                </span>

                                <span class="source-chip offline">
                                    📋 ${formatNumber(item.offline)}
                                </span>

                            </div>

                        </div>


                        <div class="progress-area">

                            <div class="progress-top">

                                <span class="progress-label">
                                    Perolehan suara
                                </span>

                                <span class="progress-percentage">
                                    ${Number(
                                        item.percentage || 0
                                    ).toFixed(1)}%
                                </span>

                            </div>


                            <div class="progress-track">

                                <div
                                    class="progress-fill"
                                    style="width:${width}%"
                                ></div>

                            </div>

                        </div>


                        <div class="vote-result">

                            <strong>
                                ${formatNumber(item.total)}
                            </strong>

                            <span>
                                suara sah
                            </span>

                        </div>

                    </article>
                `;

            }
        )
        .join("");

}


/* ================================================================
   RENDER TABLE
   ================================================================ */

function renderTable(
    results
) {

    if (
        !detailTableBody
    ) {

        return;

    }


    if (
        !results.length
    ) {

        detailTableBody.innerHTML = `
            <tr>

                <td
                    colspan="6"
                    class="table-loading"
                >
                    Belum ada data.
                </td>

            </tr>
        `;

        return;

    }


    detailTableBody.innerHTML =
        results.map(
            function(item) {

                return `
                    <tr>

                        <td class="table-rank">
                            ${item.rank}
                        </td>


                        <td class="table-name">

                            ${escapeHtml(item.nama)}

                            <br>

                            <small
                                style="
                                    color:#94a3b8;
                                    font-size:8px;
                                "
                            >
                                ${escapeHtml(item.calon_id)}
                            </small>

                        </td>


                        <td class="table-online">
                            ${formatNumber(item.online)}
                        </td>


                        <td class="table-offline">
                            ${formatNumber(item.offline)}
                        </td>


                        <td class="table-total">
                            ${formatNumber(item.total)}
                        </td>


                        <td class="table-percentage">
                            ${Number(
                                item.percentage || 0
                            ).toFixed(1)}%
                        </td>

                    </tr>
                `;

            }
        )
        .join("");

}


/* ================================================================
   LOAD ELECTION INFO
   ================================================================ */

async function loadElectionInfo() {

    try {

        const result =
            await apiGet(
                "config"
            );


        if (
            result &&
            result.success &&
            result.konfigurasi
        ) {

            const config =
                result.konfigurasi;


            if (
                electionName &&
                config.nama_pemilihan
            ) {

                electionName.textContent =
                    config.nama_pemilihan;

            }


            if (
                electionStatus &&
                config.status_pemilihan
            ) {

                electionStatus.textContent =
                    String(
                        config.status_pemilihan
                    )
                    .replaceAll(
                        "_",
                        " "
                    );

            }

        }

    } catch (
        error
    ) {

        console.warn(
            "Gagal memuat config pemilihan:",
            error
        );

    }

}


/* ================================================================
   UPDATE LAST UPDATE
   ================================================================ */

function updateLastUpdate() {

    lastUpdateTime =
        new Date();


    if (
        !lastUpdate
    ) {

        return;

    }


    lastUpdate.textContent =
        lastUpdateTime.toLocaleString(
            "id-ID",
            {
                day:
                    "2-digit",

                month:
                    "2-digit",

                year:
                    "numeric",

                hour:
                    "2-digit",

                minute:
                    "2-digit",

                second:
                    "2-digit"
            }
        );

}


/* ================================================================
   OFFLINE STATUS
   ================================================================ */

function setOfflineStatus(
    status
) {

    if (
        !offlineSourceStatus
    ) {

        return;

    }


    offlineSourceStatus.textContent =
        status;

}


/* ================================================================
   MAIN QUICK COUNT
   ================================================================ */

async function loadQuickCount(
    showNotification = false
) {

    /*
     * Jangan menjalankan request baru
     * jika request sebelumnya masih berjalan.
     */

    if (
        isLoading
    ) {

        console.log(
            "Quick Count masih memuat data sebelumnya."
        );

        return;

    }


    isLoading =
        true;


    setLoading(
        true
    );


    setConnectionStatus(
        "loading",
        "Memuat..."
    );


    console.log(
        "===================================="
    );


    console.log(
        "MEMUAT QUICK COUNT..."
    );


    /*
     * ==========================================================
     * ONLINE + OFFLINE BERSAMAAN
     * ==========================================================
     */

    const [
        onlineResult,
        offlineResult
    ] =
        await Promise.allSettled(
            [
                loadOnlineResults(),
                loadOfflineResults()
            ]
        );


    let onlineSuccess =
        false;


    let offlineSuccess =
        false;


    let onlineError =
        null;


    let offlineError =
        null;


    /* ==========================================================
       PROSES ONLINE
       ========================================================== */

    if (
        onlineResult.status ===
        "fulfilled"
    ) {

        const onlinePayload =
            onlineResult.value;


        /*
         * Pastikan response memiliki array.
         */

        const rows =
            onlinePayload &&
            Array.isArray(
                onlinePayload.results
            )
                ? onlinePayload.results
                : null;


        if (
            rows !== null
        ) {

            const normalized =
                normalizeOnline(
                    rows
                );


            /*
             * Request dianggap berhasil
             * meskipun array kosong.
             *
             * Ini penting agar data online
             * yang memang kosong tidak dianggap error.
             */

            onlineResults =
                normalized;


            onlineSuccess =
                true;


            console.log(
                "ONLINE BERHASIL:",
                {
                    authenticated:
                        Boolean(
                            onlinePayload.authenticated
                        ),

                    jumlahData:
                        onlineResults.length,

                    data:
                        onlineResults
                }
            );

        } else {

            /*
             * Response tidak sesuai format.
             */

            onlineSuccess =
                false;


            onlineError =
                new Error(
                    "Format response ONLINE tidak valid."
                );


            console.error(
                "ONLINE FORMAT ERROR:",
                onlinePayload
            );

        }

    } else {

        onlineError =
            onlineResult.reason;


        console.error(
            "ONLINE ERROR:",
            onlineError
        );


        /*
         * ======================================================
         * DATA ONLINE LAMA DIPERTAHANKAN
         * ======================================================
         */

        console.warn(
            "Data ONLINE sebelumnya tetap digunakan."
        );

    }


    /* ==========================================================
       PROSES OFFLINE
       ========================================================== */

    if (
        offlineResult.status ===
        "fulfilled"
    ) {

        const rows =
            offlineResult.value;


        if (
            Array.isArray(
                rows
            )
        ) {

            const normalized =
                normalizeOffline(
                    rows
                );


            offlineResults =
                normalized;


            offlineSuccess =
                true;


            console.log(
                "OFFLINE BERHASIL:",
                {
                    jumlahData:
                        offlineResults.length,

                    data:
                        offlineResults
                }
            );

        } else {

            offlineSuccess =
                false;


            offlineError =
                new Error(
                    "Format response OFFLINE tidak valid."
                );


            console.error(
                "OFFLINE FORMAT ERROR:",
                rows
            );

        }

    } else {

        offlineError =
            offlineResult.reason;


        console.error(
            "OFFLINE ERROR:",
            offlineError
        );


        /*
         * Data OFFLINE lama dipertahankan.
         */

        console.warn(
            "Data OFFLINE sebelumnya tetap digunakan."
        );

    }


    /* ================================================================
       COMBINE
       ================================================================ */

    combinedResults =
        combineResults(
            onlineResults,
            offlineResults
        );


    console.log(
        "HASIL GABUNGAN:",
        combinedResults
    );


    /* ================================================================
       SUMMARY
       ================================================================ */

    const summary =
        calculateSummary(
            combinedResults,
            offlineResults
        );


    console.log(
        "HASIL SUMMARY:",
        summary
    );


    /* ================================================================
       RENDER SUMMARY
       ================================================================ */

    renderSummary(
        summary
    );


    /* ================================================================
       RENDER WINNER
       ================================================================ */

    renderWinner(
        combinedResults
    );


    /* ================================================================
       RENDER RESULTS
       ================================================================ */

    renderResults(
        combinedResults
    );


    /* ================================================================
       RENDER TABLE
       ================================================================ */

    renderTable(
        combinedResults
    );


    /* ================================================================
       STATUS OFFLINE
       ================================================================ */

    if (
        offlineSuccess
    ) {

        setOfflineStatus(
            "TERHUBUNG"
        );

    } else if (
        offlineResults.length > 0
    ) {

        setOfflineStatus(
            "DATA LAMA"
        );

    } else {

        setOfflineStatus(
            "ERROR"
        );

    }


    /* ================================================================
       STATUS CONNECTION
       ================================================================ */

    if (
        onlineSuccess &&
        offlineSuccess
    ) {

        setConnectionStatus(
            "online",
            "Terhubung"
        );

    } else if (
        onlineSuccess
    ) {

        setConnectionStatus(
            "online",
            "Online terhubung • Offline gagal"
        );

    } else if (
        offlineSuccess
    ) {

        setConnectionStatus(
            "online",
            "Offline terhubung • Online gagal"
        );

    } else if (
        combinedResults.length > 0
    ) {

        setConnectionStatus(
            "error",
            "Menggunakan data sebelumnya"
        );

    } else {

        setConnectionStatus(
            "error",
            "Gagal memuat"
        );

    }


    /* ================================================================
       UPDATE LAST UPDATE
       ================================================================ */

    if (
        onlineSuccess ||
        offlineSuccess
    ) {

        updateLastUpdate();

    }


    /* ================================================================
       NOTIFICATION
       ================================================================ */

    if (
        showNotification
    ) {

        if (
            onlineSuccess &&
            offlineSuccess
        ) {

            showToast(
                "Quick Count berhasil diperbarui."
            );

        } else if (
            onlineSuccess
        ) {

            showToast(
                "Online berhasil. Data offline gagal diperbarui."
            );

        } else if (
            offlineSuccess
        ) {

            showToast(
                "Offline berhasil. Data online gagal diperbarui."
            );

        } else {

            showToast(
                "Gagal memperbarui Quick Count."
            );

        }

    }


    /* ================================================================
       DEBUG
       ================================================================ */

    console.log(
        "QUICK COUNT UPDATED",
        {
            onlineSuccess:
                onlineSuccess,

            offlineSuccess:
                offlineSuccess,

            onlineError:
                onlineError,

            offlineError:
                offlineError,

            onlineResults:
                onlineResults,

            offlineResults:
                offlineResults,

            combinedResults:
                combinedResults,

            summary:
                summary
        }
    );


    /* ================================================================
       SELESAI
       ================================================================ */

    isLoading =
        false;


    setLoading(
        false
    );


    console.log(
        "===================================="
    );

}


/* ================================================================
   AUTO REFRESH
   ================================================================ */

function startAutoRefresh() {

    /*
     * Hapus timer lama.
     */

    if (
        autoRefreshTimer
    ) {

        clearInterval(
            autoRefreshTimer
        );

    }


    /*
     * Timer baru.
     *
     * Setiap 5 detik.
     */

    autoRefreshTimer =
        setInterval(
            function() {

                if (
                    !isLoading
                ) {

                    loadQuickCount(
                        false
                    );

                }

            },
            AUTO_REFRESH_INTERVAL
        );


    console.log(
        "AUTO REFRESH AKTIF:",
        AUTO_REFRESH_INTERVAL / 1000,
        "detik"
    );

}


/* ================================================================
   STOP AUTO REFRESH
   ================================================================ */

function stopAutoRefresh() {

    if (
        autoRefreshTimer
    ) {

        clearInterval(
            autoRefreshTimer
        );


        autoRefreshTimer =
            null;


        console.log(
            "AUTO REFRESH DIHENTIKAN."
        );

    }

}


/* ================================================================
   REFRESH BUTTON
   ================================================================ */

if (
    refreshButton
) {

    refreshButton.addEventListener(
        "click",
        function() {

            loadQuickCount(
                true
            );

        }
    );

}


/* ================================================================
   PAGE VISIBILITY
   ================================================================ */

document.addEventListener(
    "visibilitychange",
    function() {

        if (
            document.visibilityState ===
            "visible"
        ) {

            if (
                !isLoading
            ) {

                loadQuickCount(
                    false
                );

            }

        }

    }
);


/* ================================================================
   INITIALIZATION
   ================================================================ */

async function init() {

    console.log(
        "===================================="
    );


    console.log(
        "E-VOTING RW 04 - QUICK COUNT"
    );


    console.log(
        "Quick Count initialization..."
    );


    console.log(
        "ONLINE API:",
        API_URL
    );


    console.log(
        "OFFLINE API:",
        OFFLINE_API_URL
    );


    console.log(
        "AUTO REFRESH:",
        AUTO_REFRESH_INTERVAL / 1000,
        "detik"
    );


    console.log(
        "===================================="
    );


    /*
     * Load informasi pemilihan.
     *
     * Tidak perlu menunggu.
     */

    loadElectionInfo();


    /*
     * Load quick count pertama.
     */

    await loadQuickCount(
        false
    );


    /*
     * Aktifkan auto refresh.
     */

    startAutoRefresh();

}


/* ================================================================
   GLOBAL ACCESS
   ================================================================ */

window.loadQuickCount =
    loadQuickCount;


window.startAutoRefresh =
    startAutoRefresh;


window.stopAutoRefresh =
    stopAutoRefresh;


/* ================================================================
   START
   ================================================================ */

init();