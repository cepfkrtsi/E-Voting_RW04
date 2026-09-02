/* ============================================================
   E-VOTING RW 04
   QUICK COUNT JAVASCRIPT
   VERSION FINAL
   ============================================================

   FUNGSI:
   ------------------------------------------------------------
   1. Ambil suara ONLINE dari backend E-Voting
   2. Ambil suara OFFLINE dari Google Spreadsheet
   3. Gabungkan ONLINE + OFFLINE berdasarkan calon_id
   4. Hitung total suara
   5. Hitung ranking
   6. Hitung persentase
   7. Hitung suara tidak sah
   8. Tampilkan sumber suara
   9. Auto refresh
   10. Tetap menampilkan data jika salah satu sumber gagal
   11. Responsive melalui HTML/CSS
   ============================================================ */


/* ============================================================
   KONFIGURASI
   ============================================================ */


/* ------------------------------------------------------------
   API E-VOTING
   ------------------------------------------------------------ */

const API_URL =
    "https://script.google.com/macros/s/AKfycbw-yX3a_9GzhCCtByS4g_IXRJsVhMN-CnvJsKQ0EFu-01n_mwa_Jftt6ex9IlYtHQ0W0g/exec";


/* ------------------------------------------------------------
   GOOGLE SHEET OFFLINE
   ------------------------------------------------------------

   Sheet:
   OFFLINE

   Format:

   tanggal | calon_id | suara | tidak_sah

   Contoh:

   09/01/26 | C01 | 125 | 5
   09/01/26 | C02 | 110 |
   09/01/26 | C03 | 125 |

   URL menggunakan published spreadsheet.
   ------------------------------------------------------------ */

const OFFLINE_CSV_URL =
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vTbeglawIzT8EbeaEIPj-F4YWOACZcnb38vpGFN6kMWZTUmBgDtU5VvwdZZ7GOTYylZvLPwvlmG6_-M/pub?gid=1093861696&single=true&output=csv";


/* ------------------------------------------------------------
   AUTO REFRESH
   ------------------------------------------------------------

   30 detik.
   ------------------------------------------------------------ */

const AUTO_REFRESH_INTERVAL =
    30 * 1000;


/* ------------------------------------------------------------
   REQUEST TIMEOUT
   ------------------------------------------------------------

   Agar halaman tidak "memuat terus" selamanya.

   Jika server tidak merespons dalam 15 detik,
   request dianggap gagal.
   ------------------------------------------------------------ */

const REQUEST_TIMEOUT =
    15000;


/* ============================================================
   STATE
   ============================================================ */

let onlineResults = [];

let offlineResults = [];

let combinedResults = [];

let lastUpdateTime = null;

let autoRefreshTimer = null;

let isLoading = false;


/* ============================================================
   ELEMENT
   ============================================================ */

const refreshButton =
    document.getElementById(
        "refreshButton"
    );

const refreshIcon =
    document.getElementById(
        "refreshIcon"
    );

const connectionStatus =
    document.getElementById(
        "connectionStatus"
    );

const connectionText =
    document.getElementById(
        "connectionText"
    );

const electionName =
    document.getElementById(
        "electionName"
    );

const electionStatus =
    document.getElementById(
        "electionStatus"
    );

const onlineTotal =
    document.getElementById(
        "onlineTotal"
    );

const offlineTotal =
    document.getElementById(
        "offlineTotal"
    );

const grandTotal =
    document.getElementById(
        "grandTotal"
    );

const invalidTotal =
    document.getElementById(
        "invalidTotal"
    );

const headingTotal =
    document.getElementById(
        "headingTotal"
    );

const lastUpdate =
    document.getElementById(
        "lastUpdate"
    );

const winnerCard =
    document.getElementById(
        "winnerCard"
    );

const winnerName =
    document.getElementById(
        "winnerName"
    );

const winnerDetail =
    document.getElementById(
        "winnerDetail"
    );

const winnerVotes =
    document.getElementById(
        "winnerVotes"
    );

const resultsContainer =
    document.getElementById(
        "resultsContainer"
    );

const detailTableBody =
    document.getElementById(
        "detailTableBody"
    );

const offlineSourceStatus =
    document.getElementById(
        "offlineSourceStatus"
    );

const toast =
    document.getElementById(
        "toast"
    );


/* ============================================================
   UTILITY
   ============================================================ */


/* ------------------------------------------------------------
   Format angka Indonesia
   ------------------------------------------------------------ */

function formatNumber(value) {

    const number =
        Number(value || 0);

    return number.toLocaleString(
        "id-ID"
    );

}


/* ------------------------------------------------------------
   Escape HTML
   ------------------------------------------------------------ */

function escapeHtml(value) {

    return String(value ?? "")
        .replaceAll(
            "&",
            "&amp;"
        )
        .replaceAll(
            "<",
            "&lt;"
        )
        .replaceAll(
            ">",
            "&gt;"
        )
        .replaceAll(
            '"',
            "&quot;"
        )
        .replaceAll(
            "'",
            "&#039;"
        );

}


/* ------------------------------------------------------------
   Konversi angka aman
   ------------------------------------------------------------

   Mendukung:

   125
   "125"
   "1.250"
   "1,250"
   "1.250,50"
   "1,250.50"
   ------------------------------------------------------------ */

function toNumber(value) {

    if (
        value === null ||
        value === undefined ||
        value === ""
    ) {

        return 0;

    }


    let text =
        String(value)
            .trim();


    if (!text) {

        return 0;

    }


    /*
     * Hapus spasi.
     */
    text =
        text.replace(/\s/g, "");


    /*
     * Jika format:
     *
     * 1.250,50
     *
     * maka titik adalah pemisah ribuan
     * dan koma adalah desimal.
     */
    if (
        text.includes(".") &&
        text.includes(",")
    ) {

        const lastDot =
            text.lastIndexOf(".");

        const lastComma =
            text.lastIndexOf(",");


        if (
            lastComma > lastDot
        ) {

            text =
                text
                    .replace(/\./g, "")
                    .replace(",", ".");

        } else {

            text =
                text
                    .replace(/,/g, "");

        }

    }

    /*
     * Jika hanya koma:
     *
     * 1250,5
     *
     * dianggap desimal.
     */
    else if (
        text.includes(",")
    ) {

        const parts =
            text.split(",");


        /*
         * Jika setelah koma tepat 3 digit,
         * kemungkinan format ribuan:
         *
         * 1,250
         */
        if (
            parts.length === 2 &&
            parts[1].length === 3 &&
            parts[0].length <= 3
        ) {

            text =
                text.replace(",", "");

        } else {

            text =
                text.replace(",", ".");

        }

    }

    /*
     * Jika hanya titik:
     *
     * 1.250
     *
     * dianggap ribuan.
     */
    else if (
        text.includes(".")
    ) {

        const parts =
            text.split(".");


        if (
            parts.length === 2 &&
            parts[1].length === 3
        ) {

            text =
                text.replace(".", "");

        }

    }


    const number =
        Number(text);


    return Number.isFinite(number)
        ? number
        : 0;

}


/* ------------------------------------------------------------
   Persentase
   ------------------------------------------------------------ */

function percentage(
    value,
    total
) {

    const numericTotal =
        Number(total || 0);


    if (
        numericTotal <= 0
    ) {

        return 0;

    }


    return (
        Number(value || 0) /
        numericTotal
    ) * 100;

}


/* ------------------------------------------------------------
   Toast
   ------------------------------------------------------------ */

function showToast(
    message
) {

    if (!toast) {

        return;

    }


    toast.textContent =
        message || "";


    toast.classList.add(
        "show"
    );


    clearTimeout(
        showToast.timer
    );


    showToast.timer =
        setTimeout(
            function() {

                toast.classList.remove(
                    "show"
                );

            },
            3000
        );

}


/* ------------------------------------------------------------
   Connection status
   ------------------------------------------------------------ */

function setConnectionStatus(
    type,
    text
) {

    if (
        connectionStatus
    ) {

        connectionStatus.className =
            "connection-status " +
            type;

    }


    if (
        connectionText
    ) {

        connectionText.textContent =
            text || "";

    }

}


/* ------------------------------------------------------------
   Loading
   ------------------------------------------------------------ */

function setLoading(
    loading
) {

    isLoading =
        Boolean(loading);


    if (
        refreshButton
    ) {

        refreshButton.disabled =
            loading;

        refreshButton.classList.toggle(
            "loading",
            loading
        );

    }


    if (
        refreshIcon
    ) {

        refreshIcon.classList.toggle(
            "spinning",
            loading
        );

    }

}


/* ============================================================
   FETCH DENGAN TIMEOUT
   ============================================================ */


/* ------------------------------------------------------------
   safeFetch
   ------------------------------------------------------------

   Fungsi penting agar tidak loading selamanya.
   ------------------------------------------------------------ */

async function safeFetch(
    url,
    options = {},
    timeout = REQUEST_TIMEOUT
) {

    const controller =
        new AbortController();


    const timeoutId =
        setTimeout(
            function() {

                controller.abort();

            },
            timeout
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

    } catch (error) {

        if (
            error &&
            error.name === "AbortError"
        ) {

            throw new Error(
                "Request timeout. Server tidak merespons dalam " +
                (timeout / 1000) +
                " detik."
            );

        }


        throw error;

    } finally {

        clearTimeout(
            timeoutId
        );

    }

}


/* ============================================================
   API E-VOTING
   ============================================================ */


/* ------------------------------------------------------------
   GET API
   ------------------------------------------------------------ */

async function apiGet(
    action
) {

    const separator =
        API_URL.includes("?")
            ? "&"
            : "?";


    const url =
        API_URL +
        separator +
        "action=" +
        encodeURIComponent(
            action
        ) +
        "&_=" +
        Date.now();


    const response =
        await safeFetch(
            url,
            {
                method: "GET",
                cache: "no-store"
            }
        );


    if (
        !response.ok
    ) {

        throw new Error(
            "Server E-Voting mengembalikan HTTP " +
            response.status
        );

    }


    const text =
        await response.text();


    if (!text) {

        throw new Error(
            "Server E-Voting memberikan response kosong."
        );

    }


    let result;


    try {

        result =
            JSON.parse(
                text
            );

    } catch (error) {

        console.error(
            "Response API bukan JSON:",
            text
        );


        throw new Error(
            "Response server E-Voting bukan JSON yang valid."
        );

    }


    return result;

}


/* ------------------------------------------------------------
   POST API
   ------------------------------------------------------------ */

async function apiPost(
    data
) {

    const response =
        await safeFetch(
            API_URL,
            {
                method: "POST",

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
            "Server E-Voting mengembalikan HTTP " +
            response.status
        );

    }


    const text =
        await response.text();


    if (!text) {

        throw new Error(
            "Server E-Voting memberikan response kosong."
        );

    }


    let result;


    try {

        result =
            JSON.parse(
                text
            );

    } catch (error) {

        console.error(
            "Response POST bukan JSON:",
            text
        );


        throw new Error(
            "Response server E-Voting bukan JSON yang valid."
        );

    }


    return result;

}


/* ============================================================
   LOAD ONLINE
   ============================================================ */

async function loadOnlineResults() {

    /*
     * Cari token admin.
     */

    const adminToken =
        sessionStorage.getItem(
            "admin_token"
        ) ||
        sessionStorage.getItem(
            "evoting_admin_token"
        ) ||
        localStorage.getItem(
            "admin_token"
        );


    /*
     * Jika ada token,
     * gunakan admin_results.
     */

    if (
        adminToken
    ) {

        try {

            const result =
                await apiPost({
                    action:
                        "admin_results",

                    token:
                        adminToken
                });


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

            /*
             * Jika token invalid,
             * jangan langsung membuat
             * Quick Count gagal.
             *
             * Coba endpoint public.
             */

            console.warn(
                "Token admin tidak valid. Mencoba endpoint hasil publik."
            );

        } catch (error) {

            console.warn(
                "admin_results gagal:",
                error
            );

        }

    }


    /*
     * Fallback endpoint publik.
     */

    const result =
        await apiGet(
            "hasil"
        );


    if (
        !result ||
        !result.success
    ) {

        throw new Error(
            result?.message ||
            "Hasil online belum dapat diakses."
        );

    }


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


/* ============================================================
   CSV PARSER
   ============================================================ */


/* ------------------------------------------------------------
   Parse satu baris CSV
   ------------------------------------------------------------ */

function parseCsvLine(
    line
) {

    const result = [];

    let current = "";

    let insideQuotes =
        false;


    for (
        let i = 0;
        i < line.length;
        i++
    ) {

        const char =
            line[i];


        /*
         * Quote.
         */

        if (
            char === '"'
        ) {

            /*
             * Double quote di dalam field.
             */

            if (
                insideQuotes &&
                line[i + 1] === '"'
            ) {

                current += '"';

                i++;

            } else {

                insideQuotes =
                    !insideQuotes;

            }

            continue;

        }


        /*
         * Pemisah koma.
         */

        if (
            char === "," &&
            !insideQuotes
        ) {

            result.push(
                current
            );

            current = "";

            continue;

        }


        current +=
            char;

    }


    result.push(
        current
    );


    return result.map(
        function(value) {

            return String(
                value
            )
            .trim()
            .replace(
                /^"|"$/g,
                ""
            );

        }
    );

}


/* ------------------------------------------------------------
   Parse CSV penuh
   ------------------------------------------------------------ */

function parseCsv(
    text
) {

    if (
        !text
    ) {

        return [];

    }


    /*
     * Hilangkan BOM UTF-8.
     */

    let cleanText =
        String(text)
            .replace(
                /^\uFEFF/,
                ""
            );


    /*
     * Normalisasi newline.
     */

    cleanText =
        cleanText
            .replace(/\r\n/g, "\n")
            .replace(/\r/g, "\n");


    /*
     * Split line.
     */

    const lines =
        cleanText
            .split("\n")
            .filter(
                line =>
                    line.trim() !== ""
            );


    if (
        lines.length < 2
    ) {

        return [];

    }


    /*
     * Header.
     */

    const headers =
        parseCsvLine(
            lines[0]
        )
        .map(
            function(header) {

                return header
                    .trim()
                    .toLowerCase();

            }
        );


    const rows = [];


    /*
     * Data.
     */

    for (
        let i = 1;
        i < lines.length;
        i++
    ) {

        const columns =
            parseCsvLine(
                lines[i]
            );


        /*
         * Lewati baris kosong.
         */

        if (
            columns.every(
                value =>
                    String(
                        value
                    ).trim() === ""
            )
        ) {

            continue;

        }


        const row = {};


        headers.forEach(
            function(
                header,
                index
            ) {

                row[header] =
                    columns[index] ??
                    "";

            }
        );


        rows.push(
            row
        );

    }


    return rows;

}


/* ============================================================
   LOAD OFFLINE
   ============================================================ */

async function loadOfflineResults() {

    if (
        !OFFLINE_CSV_URL
    ) {

        throw new Error(
            "URL CSV OFFLINE belum diatur."
        );

    }


    /*
     * Cache busting.
     *
     * Penting agar browser tidak
     * menggunakan CSV lama.
     */

    const separator =
        OFFLINE_CSV_URL.includes("?")
            ? "&"
            : "?";


    const url =
        OFFLINE_CSV_URL +
        separator +
        "_=" +
        Date.now();


    console.log(
        "Mengambil CSV OFFLINE:",
        OFFLINE_CSV_URL
    );


    const response =
        await safeFetch(
            url,
            {
                method: "GET",

                cache: "no-store",

                headers: {
                    "Accept":
                        "text/csv,text/plain,*/*"
                }
            }
        );


    if (
        !response.ok
    ) {

        throw new Error(
            "Google Spreadsheet OFFLINE mengembalikan HTTP " +
            response.status
        );

    }


    const text =
        await response.text();


    if (
        !text ||
        !text.trim()
    ) {

        throw new Error(
            "Google Spreadsheet OFFLINE kosong."
        );

    }


    /*
     * Debug.
     */

    console.log(
        "CSV OFFLINE berhasil diambil."
    );


    const rows =
        parseCsv(
            text
        );


    if (
        !Array.isArray(rows)
    ) {

        throw new Error(
            "Format CSV OFFLINE tidak valid."
        );

    }


    return rows;

}


/* ============================================================
   NORMALIZE ONLINE
   ============================================================ */


/*
 * Backend biasanya:
 *
 * id_calon
 * nomor_urut
 * nama
 * suara
 */

function normalizeOnline(
    results
) {

    if (
        !Array.isArray(
            results
        )
    ) {

        return [];

    }


    return results
        .map(
            function(item) {

                const calonId =
                    String(
                        item?.id_calon ??
                        item?.calon_id ??
                        item?.id ??
                        ""
                    )
                    .trim()
                    .toUpperCase();


                const nama =
                    String(
                        item?.nama ??
                        item?.nama_calon ??
                        "Calon " +
                        calonId
                    )
                    .trim();


                const nomorUrut =
                    item?.nomor_urut ??
                    item?.nomor ??
                    "";


                return {

                    calon_id:
                        calonId,

                    nomor_urut:
                        nomorUrut,

                    nama:
                        nama,

                    suara:
                        toNumber(
                            item?.suara
                        )

                };

            }
        )
        .filter(
            function(item) {

                return Boolean(
                    item.calon_id
                );

            }
        );

}


/* ============================================================
   NORMALIZE OFFLINE
   ============================================================ */


/*
 * Format:
 *
 * tanggal
 * calon_id
 * suara
 * tidak_sah
 */

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


    return rows
        .map(
            function(row) {

                const calonId =
                    String(
                        row?.calon_id ??
                        ""
                    )
                    .trim()
                    .toUpperCase();


                return {

                    tanggal:
                        String(
                            row?.tanggal ??
                            ""
                        ).trim(),

                    calon_id:
                        calonId,

                    suara:
                        toNumber(
                            row?.suara
                        ),

                    tidak_sah:
                        toNumber(
                            row?.tidak_sah
                        )

                };

            }
        )
        .filter(
            function(row) {

                return Boolean(
                    row.calon_id
                );

            }
        );

}


/* ============================================================
   COMBINE ONLINE + OFFLINE
   ============================================================ */

function combineResults(
    online,
    offline
) {

    const map =
        new Map();


    /* --------------------------------------------------------
       ONLINE
       -------------------------------------------------------- */

    online.forEach(
        function(item) {

            const id =
                item.calon_id;


            if (
                !map.has(id)
            ) {

                map.set(
                    id,
                    {

                        calon_id:
                            id,

                        nomor_urut:
                            item.nomor_urut ?? "",

                        nama:
                            item.nama || (
                                "Calon " +
                                id
                            ),

                        online:
                            0,

                        offline:
                            0,

                        tidak_sah:
                            0,

                        total:
                            0,

                        rank:
                            0,

                        percentage:
                            0

                    }
                );

            }


            const current =
                map.get(id);


            current.online +=
                toNumber(
                    item.suara
                );


            /*
             * Isi nama jika sebelumnya kosong.
             */

            if (
                (
                    !current.nama ||
                    current.nama ===
                        "Calon " + id
                ) &&
                item.nama
            ) {

                current.nama =
                    item.nama;

            }


            /*
             * Isi nomor urut.
             */

            if (
                (
                    current.nomor_urut ===
                    "" ||
                    current.nomor_urut ===
                    null ||
                    current.nomor_urut ===
                    undefined
                ) &&
                item.nomor_urut !==
                    undefined &&
                item.nomor_urut !==
                    null &&
                item.nomor_urut !==
                    ""
            ) {

                current.nomor_urut =
                    item.nomor_urut;

            }

        }
    );


    /* --------------------------------------------------------
       OFFLINE
       -------------------------------------------------------- */

    offline.forEach(
        function(item) {

            const id =
                item.calon_id;


            if (
                !map.has(id)
            ) {

                map.set(
                    id,
                    {

                        calon_id:
                            id,

                        nomor_urut:
                            "",

                        nama:
                            "Calon " +
                            id,

                        online:
                            0,

                        offline:
                            0,

                        tidak_sah:
                            0,

                        total:
                            0,

                        rank:
                            0,

                        percentage:
                            0

                    }
                );

            }


            const current =
                map.get(id);


            current.offline +=
                toNumber(
                    item.suara
                );


            current.tidak_sah +=
                toNumber(
                    item.tidak_sah
                );

        }
    );


    /* --------------------------------------------------------
       Convert Map -> Array
       -------------------------------------------------------- */

    const results =
        Array.from(
            map.values()
        );


    /* --------------------------------------------------------
       TOTAL SUARA SAH
       -------------------------------------------------------- */

    results.forEach(
        function(item) {

            item.total =
                item.online +
                item.offline;

        }
    );


    /* --------------------------------------------------------
       SORT RANKING
       -------------------------------------------------------- */

    results.sort(
        function(a, b) {

            /*
             * Suara terbanyak di atas.
             */

            if (
                b.total !==
                a.total
            ) {

                return (
                    b.total -
                    a.total
                );

            }


            /*
             * Jika seri,
             * gunakan nomor urut.
             */

            const nomorA =
                toNumber(
                    a.nomor_urut
                );

            const nomorB =
                toNumber(
                    b.nomor_urut
                );


            if (
                nomorA !==
                nomorB
            ) {

                return (
                    nomorA -
                    nomorB
                );

            }


            /*
             * Fallback calon_id.
             */

            return String(
                a.calon_id
            ).localeCompare(
                String(
                    b.calon_id
                )
            );

        }
    );


    /* --------------------------------------------------------
       RANK
       -------------------------------------------------------- */

    results.forEach(
        function(
            item,
            index
        ) {

            item.rank =
                index + 1;

        }
    );


    /* --------------------------------------------------------
       PERSENTASE
       -------------------------------------------------------- */

    const totalVotes =
        results.reduce(
            function(
                total,
                item
            ) {

                return (
                    total +
                    item.total
                );

            },
            0
        );


    results.forEach(
        function(item) {

            item.percentage =
                percentage(
                    item.total,
                    totalVotes
                );

        }
    );


    return results;

}


/* ============================================================
   SUMMARY
   ============================================================ */

function calculateSummary(
    results,
    offline
) {

    const online =
        results.reduce(
            function(
                total,
                item
            ) {

                return (
                    total +
                    toNumber(
                        item.online
                    )
                );

            },
            0
        );


    const offlineTotal =
        results.reduce(
            function(
                total,
                item
            ) {

                return (
                    total +
                    toNumber(
                        item.offline
                    )
                );

            },
            0
        );


    const invalid =
        offline.reduce(
            function(
                total,
                item
            ) {

                return (
                    total +
                    toNumber(
                        item.tidak_sah
                    )
                );

            },
            0
        );


    const total =
        online +
        offlineTotal;


    return {

        online:
            online,

        offline:
            offlineTotal,

        total:
            total,

        invalid:
            invalid

    };

}


/* ============================================================
   RENDER SUMMARY
   ============================================================ */

function renderSummary(
    summary
) {

    if (
        onlineTotal
    ) {

        onlineTotal.textContent =
            formatNumber(
                summary.online
            );

    }
    if (
        offlineTotal
    ) {
        offlineTotal.textContent =
            formatNumber(
                summary.offline
            );
    }
    if (
        grandTotal
    ) {

        grandTotal.textContent =
            formatNumber(
                summary.total
            );
    }
    if (
        headingTotal
    ) {

        headingTotal.textContent =
            formatNumber(
                summary.total
            );

    }


    if (
        invalidTotal
    ) {

        invalidTotal.textContent =
            formatNumber(
                summary.invalid
            );

    }

}


/* ============================================================
   RENDER WINNER
   ============================================================ */

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


/* ============================================================
   RENDER RESULTS
   ============================================================ */

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


    const totalVotes =
        results.reduce(
            function(
                total,
                item
            ) {

                return (
                    total +
                    item.total
                );

            },
            0
        );


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
                                    ${item.percentage.toFixed(1)}%
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


/* ============================================================
   RENDER TABLE
   ============================================================ */

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
                            ${item.percentage.toFixed(1)}%
                        </td>

                    </tr>

                `;

            }
        )
        .join("");

}


/* ============================================================
   ELECTION INFO
   ============================================================ */

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

    } catch (error) {

        console.warn(
            "Gagal memuat config pemilihan:",
            error
        );

    }

}


/* ============================================================
   UPDATE LAST UPDATE
   ============================================================ */

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


/* ============================================================
   OFFLINE STATUS
   ============================================================ */

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


/* ============================================================
   MAIN QUICK COUNT
   ============================================================ */

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

        console.warn(
            "Quick Count masih memuat. Request baru dibatalkan."
        );

        return;

    }


    setLoading(
        true
    );


    setConnectionStatus(
        "loading",
        "Memuat..."
    );


    /*
     * Jalankan ONLINE dan OFFLINE
     * secara terpisah.
     *
     * Jangan menggunakan Promise.all biasa,
     * karena jika salah satu gagal,
     * semuanya dianggap gagal.
     */

    let onlineResponse =
        null;

    let offlineRows =
        null;

    let onlineError =
        null;

    let offlineError =
        null;


    try {

        onlineResponse =
            await loadOnlineResults();

    } catch (error) {

        onlineError =
            error;

        console.error(
            "ONLINE ERROR:",
            error
        );

    }


    try {

        offlineRows =
            await loadOfflineResults();

    } catch (error) {

        offlineError =
            error;

        console.error(
            "OFFLINE ERROR:",
            error
        );

    }


    /*
     * --------------------------------------------------------
     * NORMALIZE ONLINE
     * --------------------------------------------------------
     */

    if (
        onlineResponse
    ) {

        onlineResults =
            normalizeOnline(
                onlineResponse.results
            );

    }


    /*
     * --------------------------------------------------------
     * NORMALIZE OFFLINE
     * --------------------------------------------------------
     */

    if (
        offlineRows
    ) {

        offlineResults =
            normalizeOffline(
                offlineRows
            );

    }


    /*
     * --------------------------------------------------------
     * Tentukan apakah ada data baru.
     * --------------------------------------------------------
     */

    const onlineSuccess =
        !onlineError &&
        Boolean(
            onlineResponse
        );


    const offlineSuccess =
        !offlineError &&
        Array.isArray(
            offlineRows
        );


    /*
     * --------------------------------------------------------
     * Jika ONLINE gagal, pertahankan data ONLINE lama.
     * --------------------------------------------------------
     */

    if (
        onlineError &&
        onlineResults.length === 0
    ) {

        console.warn(
            "Tidak ada data ONLINE yang dapat digunakan."
        );

    }


    /*
     * --------------------------------------------------------
     * Jika OFFLINE gagal, pertahankan data OFFLINE lama.
     * --------------------------------------------------------
     */

    if (
        offlineError &&
        offlineResults.length === 0
    ) {

        console.warn(
            "Tidak ada data OFFLINE yang dapat digunakan."
        );

    }


    /*
     * --------------------------------------------------------
     * Gabungkan.
     * --------------------------------------------------------
     */

    combinedResults =
        combineResults(
            onlineResults,
            offlineResults
        );


    /*
     * --------------------------------------------------------
     * Summary.
     * --------------------------------------------------------
     */

    const summary =
        calculateSummary(
            combinedResults,
            offlineResults
        );


    /*
     * --------------------------------------------------------
     * Render.
     * --------------------------------------------------------
     */

    renderSummary(
        summary
    );


    renderWinner(
        combinedResults
    );


    renderResults(
        combinedResults
    );


    renderTable(
        combinedResults
    );


    /*
     * --------------------------------------------------------
     * STATUS SUMBER OFFLINE
     * --------------------------------------------------------
     */

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


    /*
     * --------------------------------------------------------
     * STATUS CONNECTION
     * --------------------------------------------------------
     */

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


    /*
     * --------------------------------------------------------
     * UPDATE TIME
     * --------------------------------------------------------
     */

    if (
        onlineSuccess ||
        offlineSuccess
    ) {

        updateLastUpdate();

    }


    /*
     * --------------------------------------------------------
     * NOTIFICATION
     * --------------------------------------------------------
     */

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


    /*
     * --------------------------------------------------------
     * Selesai loading.
     * --------------------------------------------------------
     */

    setLoading(
        false
    );

}


/* ============================================================
   AUTO REFRESH
   ============================================================ */

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
     * Buat timer baru.
     */

    autoRefreshTimer =
        setInterval(
            function() {

                /*
                 * Refresh diam-diam.
                 */

                loadQuickCount(
                    false
                );

            },
            AUTO_REFRESH_INTERVAL
        );

}


/* ============================================================
   STOP AUTO REFRESH
   ============================================================ */

function stopAutoRefresh() {

    if (
        autoRefreshTimer
    ) {

        clearInterval(
            autoRefreshTimer
        );

        autoRefreshTimer =
            null;

    }

}


/* ============================================================
   REFRESH BUTTON
   ============================================================ */

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


/* ============================================================
   PAGE VISIBILITY
   ============================================================ */


/*
 * Ketika tab kembali aktif,
 * lakukan refresh.
 *
 * Ini berguna kalau halaman ditinggal
 * beberapa menit.
 */

document.addEventListener(
    "visibilitychange",
    function() {

        if (
            document.visibilityState ===
            "visible"
        ) {

            /*
             * Hanya refresh jika
             * tidak sedang loading.
             */

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


/* ============================================================
   INITIALIZATION
   ============================================================ */

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
        "API:",
        API_URL
    );

    console.log(
        "OFFLINE CSV:",
        OFFLINE_CSV_URL
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


/* ============================================================
   GLOBAL ACCESS
   ============================================================ */


/*
 * Supaya tombol "Coba Lagi"
 * dari HTML inline bisa memanggil fungsi.
 */

window.loadQuickCount =
    loadQuickCount;


/*
 * Jalankan aplikasi.
 */

init();